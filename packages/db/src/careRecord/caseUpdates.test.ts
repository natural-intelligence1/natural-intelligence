// Client update → practitioner "Since last review".
//
// The read path is real, so these tests cover the case_events → DatedUpdate
// mapping precisely. The write path is blocked, so they pin the refusal: a
// client update must never appear to succeed while nothing is stored.
//
// Pure — no database, no network. The RLS behaviour these rely on is asserted
// by the policies themselves, not re-implemented here.

import { describe, it, expect, vi } from 'vitest'
import {
  eventToUpdate, loadCaseUpdates, recordClientUpdate, checkFactualStatement,
  provenanceLabel, isClientReported, isUnattributed, sinceLastReviewFor,
  buildSinceLastReviewView, CLIENT_UPDATE_WRITE_PATH, CASE_EVENT_TYPES,
} from './caseUpdates'

const REVIEW = '2026-09-18T10:00:00.000Z'
const NOW = '2026-10-05T09:00:00.000Z'

const row = (o: Partial<Parameters<typeof eventToUpdate>[0]> = {}) => ({
  id: 'e-1',
  case_id: 'case-1',
  event_type: 'follow_up_answer',
  source_table: null,
  source_id: null,
  event_payload: { statement: 'Slept through on 5 of the last 7 nights.' },
  created_at: '2026-10-02T07:15:00.000Z',
  ...o,
})

describe('case_events → DatedUpdate', () => {
  it('maps a client follow-up answer to a client report', () => {
    const u = eventToUpdate(row())!
    expect(u.kind).toBe('client_report')
    expect(u.authorRole).toBe('client')
    expect(u.statement).toBe('Slept through on 5 of the last 7 nights.')
    expect(provenanceLabel(u)).toBe('Client reported')
    expect(isClientReported(u)).toBe(true)
  })

  it('dates an update when it HAPPENED, not when it was typed', () => {
    // The rule that matters most for a factual delta. A client reporting on
    // Tuesday something that happened on Sunday must be dated Sunday, or the
    // practitioner reads the sequence wrongly.
    const u = eventToUpdate(row({
      created_at: '2026-10-02T07:15:00.000Z',
      event_payload: { statement: 'Headache.', occurred_at: '2026-09-29T20:00:00.000Z' },
    }))!
    expect(u.at).toBe('2026-09-29T20:00:00.000Z')
  })

  it('falls back to created_at, never to now', () => {
    expect(eventToUpdate(row())!.at).toBe('2026-10-02T07:15:00.000Z')
  })

  it('skips an event with no statement rather than inventing one', () => {
    // A dated blank line is worse than no line, and this module must never
    // describe someone's record in words of its own.
    expect(eventToUpdate(row({ event_payload: { question_id: 'q-1' } }))).toBeNull()
    expect(eventToUpdate(row({ event_payload: null }))).toBeNull()
    expect(eventToUpdate(row({ event_payload: { statement: '   ' } }))).toBeNull()
  })

  it('ignores an event_type outside the CHECK constraint', () => {
    expect(eventToUpdate(row({ event_type: 'something_new' }))).toBeNull()
  })

  it('covers every event_type the CHECK permits', () => {
    // If a migration widens the CHECK, this fails rather than silently
    // dropping the new type out of every practitioner's delta.
    for (const t of CASE_EVENT_TYPES) {
      const u = eventToUpdate(row({ event_type: t, event_payload: { statement: 'x' } }))
      expect(u, `event_type ${t} produced no update`).not.toBeNull()
    }
  })

  it('attributes a practitioner decision to the practitioner in the payload', () => {
    const u = eventToUpdate(row({
      event_type: 'practitioner_decision',
      event_payload: { recommendation: 'Continue current plan.', practitioner_id: 'prac-7' },
    }))!
    expect(u.authorRole).toBe('practitioner')
    expect(u.authorId).toBe('prac-7')
    expect(isUnattributed(u)).toBe(false)
    expect(provenanceLabel(u)).toBe('Practitioner')
  })

  it('marks a line unattributed rather than guessing a person', () => {
    // GAP 2 made visible. case_events has no author column, so an event whose
    // payload names nobody must not look attributed.
    const u = eventToUpdate(row())!
    expect(isUnattributed(u)).toBe(true)
    expect(u.authorId).toBe('unattributed:client')
  })

  it('keeps a before and after as two values', () => {
    const u = eventToUpdate(row({
      event_type: 'gp_record_upload',
      event_payload: { statement: 'Dose changed.', previous_value: '5mg', new_value: '10mg' },
    }))!
    expect(u.previousValue).toBe('5mg')
    expect(u.newValue).toBe('10mg')
    expect(u.kind).toBe('new_document')
  })

  it('links to the source record where the event names one', () => {
    expect(eventToUpdate(row({ source_table: 'lab_reports', source_id: 'lab-9' }))!.sourceRef)
      .toBe('lab_reports/lab-9')
    expect(eventToUpdate(row())!.sourceRef).toBe('case_events/follow_up_answer')
  })
})

describe('the reader', () => {
  const fakeClient = (rows: unknown[] | null, error: unknown = null) => ({
    from: () => ({
      select: () => ({
        eq: () => ({ order: () => Promise.resolve({ data: rows, error }) }),
      }),
    }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any

  it('returns mapped updates for a case', async () => {
    const got = await loadCaseUpdates(fakeClient([row(), row({ id: 'e-2' })]), 'case-1')
    expect(got.map((u) => u.id)).toEqual(['e-1', 'e-2'])
  })

  it('drops unmappable rows without failing the whole read', async () => {
    const got = await loadCaseUpdates(
      fakeClient([row(), row({ id: 'e-2', event_payload: null })]), 'case-1',
    )
    expect(got.map((u) => u.id)).toEqual(['e-1'])
  })

  it('surfaces a query error instead of reporting an empty case', async () => {
    // "Nothing has changed since your last review" must never be the way a
    // practitioner finds out the query failed.
    await expect(loadCaseUpdates(fakeClient(null, { message: 'permission denied' }), 'case-1'))
      .rejects.toBeTruthy()
  })

  it('treats no rows as an empty list', async () => {
    expect(await loadCaseUpdates(fakeClient([]), 'case-1')).toEqual([])
    expect(await loadCaseUpdates(fakeClient(null), 'case-1')).toEqual([])
  })
})

describe('the client writer', () => {
  const DRAFT = {
    caseId: 'case-1', actorUserId: 'client-1',
    statement: 'Slept through on five of seven nights.',
    occurredAt: '2026-10-02T07:15:00.000Z',
  }

  type Row = Record<string, unknown>

  /** Captures exactly what would be sent to case_events. */
  function writerClient(result: { data?: unknown; error?: unknown } = {}) {
    const insert = vi.fn((_row: Row) => ({
      select: () => ({
        single: () => Promise.resolve({
          data: result.data ?? { id: 'event-1' }, error: result.error ?? null,
        }),
      }),
    }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { client: { from: () => ({ insert }) } as any, insert }
  }

  it('writes one follow_up_answer, attributed to the client', async () => {
    const { client, insert } = writerClient()
    const r = await recordClientUpdate(client, DRAFT)

    expect(r).toEqual({ stored: true, eventId: 'event-1' })
    expect(insert).toHaveBeenCalledWith({
      case_id: 'case-1',
      event_type: 'follow_up_answer',
      event_payload: { statement: 'Slept through on five of seven nights.' },
      actor_user_id: 'client-1',
      actor_capacity: 'client',
      occurred_at: '2026-10-02T07:15:00.000Z',
    })
  })

  it('never sends created_at — the database stamps it', async () => {
    // Otherwise a client could backdate their own submission and appear to
    // have reported something before a review that had already happened.
    const { client, insert } = writerClient()
    await recordClientUpdate(client, DRAFT)
    expect(Object.keys(insert.mock.calls[0][0])).not.toContain('created_at')
  })

  it('cannot be used to write any other event type or capacity', async () => {
    const { client, insert } = writerClient()
    await recordClientUpdate(client, DRAFT)
    const row = insert.mock.calls[0][0] as Record<string, unknown>
    expect(row.event_type).toBe('follow_up_answer')
    expect(row.actor_capacity).toBe('client')
  })

  it('records a before and after only when both exist', async () => {
    const { client, insert } = writerClient()
    await recordClientUpdate(client, { ...DRAFT, previousValue: '5mg', newValue: '10mg' })
    expect(insert.mock.calls[0][0].event_payload).toMatchObject({
      previous_value: '5mg', new_value: '10mg',
    })

    // A lone "after" is not a change, and recording it as one would overstate
    // what the client reported.
    const second = writerClient()
    await recordClientUpdate(second.client, { ...DRAFT, newValue: '10mg' })
    expect(second.insert.mock.calls[0][0].event_payload).toEqual({ statement: DRAFT.statement })
  })

  it('rejects causal phrasing before it reaches the database', async () => {
    const { client, insert } = writerClient()
    const r = await recordClientUpdate(client, {
      ...DRAFT, statement: 'My sleep improved because I stopped the magnesium.',
    })
    expect(r).toMatchObject({ stored: false, reason: 'invalid' })
    expect(insert).not.toHaveBeenCalled()
  })

  it('rejects a missing or future date', async () => {
    const { client } = writerClient()
    expect(await recordClientUpdate(client, { ...DRAFT, occurredAt: 'not a date' }))
      .toMatchObject({ reason: 'invalid' })
    expect(await recordClientUpdate(client, { ...DRAFT, occurredAt: '2099-01-01T00:00:00.000Z' }))
      .toMatchObject({ reason: 'invalid' })
  })

  it('reports the unapplied migration distinctly from a refusal', async () => {
    // These must not look the same. One is "NI has not switched this on yet";
    // the other is "the database says you may not do that".
    const unmigrated = writerClient({
      data: null, error: { code: '42703', message: 'column "actor_capacity" does not exist' },
    })
    expect(await recordClientUpdate(unmigrated.client, DRAFT)).toMatchObject({
      stored: false, reason: 'awaiting_migration',
      migration: '0062_case_events_client_authorship.sql',
    })

    const refused = writerClient({
      data: null, error: { code: '42501', message: 'new row violates row-level security policy' },
    })
    expect(await recordClientUpdate(refused.client, DRAFT)).toMatchObject({
      stored: false, reason: 'not_permitted',
    })
  })

  it('never retries a refusal another way', async () => {
    // No service-role fallback. A refusal is final.
    const refused = writerClient({
      data: null, error: { code: '42501', message: 'new row violates row-level security policy' },
    })
    await recordClientUpdate(refused.client, DRAFT)
    expect(refused.insert).toHaveBeenCalledTimes(1)
  })

  it('names the migration and what it adds', () => {
    expect(CLIENT_UPDATE_WRITE_PATH.status).toBe('awaiting_migration')
    expect(CLIENT_UPDATE_WRITE_PATH.table).toBe('case_events')
    expect(CLIENT_UPDATE_WRITE_PATH.migration).toBe('0062_case_events_client_authorship.sql')
    expect(CLIENT_UPDATE_WRITE_PATH.adds.join(' ')).toMatch(/case_events_client_insert/)
    expect(CLIENT_UPDATE_WRITE_PATH.divergenceToFlag).toMatch(/case_practitioner_work/)
  })
})

describe('both ends share one pipeline', () => {
  it('a client-written event reaches Since last review through the same builder', async () => {
    // The app-level guarantee: what the client writes is what the practitioner
    // reads, through buildSinceLastReview, with no second code path and no
    // copy taken in between.
    const written: Record<string, unknown>[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = {
      from: () => ({
        insert: (row: Record<string, unknown>) => {
          written.push(row)
          return { select: () => ({ single: () => Promise.resolve({ data: { id: 'e-new' }, error: null }) }) }
        },
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({
              // What the practitioner's reader would see for that row.
              data: written.map((w, i) => ({
                id: `e-${i}`, case_id: w.case_id, event_type: w.event_type,
                source_table: null, source_id: null, event_payload: w.event_payload,
                created_at: '2026-10-02T09:00:00.000Z',
                actor_user_id: w.actor_user_id, actor_capacity: w.actor_capacity,
                occurred_at: w.occurred_at,
              })),
              error: null,
            }),
          }),
        }),
      }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any

    const stored = await recordClientUpdate(client, {
      caseId: 'case-1', actorUserId: 'client-1',
      statement: 'Slept through on five of seven nights.',
      occurredAt: '2026-10-02T07:15:00.000Z',
    })
    expect(stored.stored).toBe(true)

    const updates = await loadCaseUpdates(client, 'case-1')
    const view = buildSinceLastReviewView(updates, REVIEW, NOW)

    expect(view.nothingChanged).toBe(false)
    expect(view.clientReportedCount).toBe(1)
    expect(view.unattributedCount).toBe(0)        // 0062 attributes it properly
    const entry = view.review.sections[0].entries[0]
    expect(entry.statement).toBe('Slept through on five of seven nights.')
    expect(provenanceLabel(entry)).toBe('Client reported')
    expect(entry.authorId).toBe('client-1')
    // Dated when it happened, not when NI received it.
    expect(entry.at).toBe('2026-10-02T07:15:00.000Z')
  })
})

describe('factual capture only', () => {
  it('accepts a plain dated fact', () => {
    expect(checkFactualStatement('Slept through the night on 5 of the last 7 nights.').ok).toBe(true)
  })

  it('rejects causal phrasing', () => {
    // The client may well be right. Causation is the practitioner's to draw,
    // and a record that states it has already interpreted itself.
    for (const s of [
      'My sleep improved because I stopped the magnesium.',
      'Headaches were caused by the new dose.',
      'Felt flat due to the late nights.',
      'Changed the dose, as a result sleep is better.',
    ]) {
      const r = checkFactualStatement(s)
      expect(r.ok, s).toBe(false)
      expect(r.problems[0]).toMatch(/what happened and when/i)
    }
  })

  it('rejects empty and over-long text', () => {
    expect(checkFactualStatement('   ').ok).toBe(false)
    expect(checkFactualStatement('a'.repeat(1001)).ok).toBe(false)
  })

  it('does not classify, score or rank what it accepts', () => {
    const r = checkFactualStatement('Woke at 3am four times.')
    expect(Object.keys(r).sort()).toEqual(['ok', 'problems'])
  })
})

describe('the delta reuses the shipped builder', () => {
  const updates = [
    eventToUpdate(row({ id: 'a', event_payload: { statement: 'Slept through.' } }))!,
    eventToUpdate(row({
      id: 'b', event_type: 'gp_record_upload',
      event_payload: { statement: 'GP changed dose.', occurred_at: '2026-09-21T09:05:00.000Z' },
    }))!,
    eventToUpdate(row({
      id: 'old', event_payload: { statement: 'Before the review.', occurred_at: '2026-09-02T11:00:00.000Z' },
    }))!,
  ]

  it('excludes anything before the review point', () => {
    const r = sinceLastReviewFor(updates, REVIEW, NOW)
    const ids = r.sections.flatMap((s) => s.entries).map((e) => e.id)
    expect(ids).toContain('a')
    expect(ids).toContain('b')
    expect(ids).not.toContain('old')
    expect(r.count).toBe(2)
  })

  it('groups by kind using the builder\'s own labels', () => {
    const r = sinceLastReviewFor(updates, REVIEW, NOW)
    expect(r.sections.map((s) => s.kind)).toEqual(['client_report', 'new_document'])
    expect(r.sections[0].label).toBe('New client report')
  })

  it('reports nothing changed as a real answer', () => {
    const v = buildSinceLastReviewView([], REVIEW, NOW)
    expect(v.nothingChanged).toBe(true)
    expect(v.review.count).toBe(0)
    expect(v.review.since).toBe(REVIEW)
  })

  it('counts client-reported and unattributed lines for the practitioner', () => {
    const v = buildSinceLastReviewView(updates, REVIEW, NOW)
    expect(v.clientReportedCount).toBe(2)
    expect(v.unattributedCount).toBe(2)
    expect(v.clientWritesUnavailable).toBe(true)
  })

  it('still reports storage unavailable when the window is empty', () => {
    // Otherwise an empty delta reads as "the client has said nothing", when
    // the truth is that the client has no way to say anything.
    expect(buildSinceLastReviewView([], REVIEW, NOW).clientWritesUnavailable).toBe(true)
  })
})
