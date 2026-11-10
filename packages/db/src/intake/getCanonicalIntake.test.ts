// ─── getCanonicalIntake.test.ts ──────────────────────────────────────────────
// The twelve things that have to be true for Stage 3 to read one answer truth.
//
// The ones that matter most, because getting them wrong is silent:
//
//   · A BLANK ANSWER IS NOT A MISSING ANSWER. The form's `|| null` coercion
//     collapsed "reached and left blank" into NULL in the column. The answer
//     store kept the blank, so the projection must too — and must not let the
//     column's NULL win just because the answer looks empty.
//   · THE LATEST ANSWER WINS, DETERMINISTICALLY. intake_answers is unique on
//     (session_id, question_id), not (member, question), so one member can
//     hold several rows for one question. Ordering by timestamp alone is not
//     a total order; the id tiebreak is what makes the result reproducible.
//   · HISTORY SURVIVES. A superseded answer is returned, never dropped.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import { getCanonicalIntake, normaliseAnswerValue, CANONICAL_ANSWER_ORDER } from './getCanonicalIntake'
import type { CanonicalIntake, SupportLevel } from './getCanonicalIntake'
import { INTAKE_QUESTIONS, getIntakeQuestion, LEGACY_ONLY_FIELDS } from './questionRegistry'

const HERE = dirname(fileURLToPath(import.meta.url))
const SOURCE = readFileSync(join(HERE, 'getCanonicalIntake.ts'), 'utf8')
const REGISTRY_SOURCE = readFileSync(join(HERE, 'questionRegistry.ts'), 'utf8')

type ReadClient = SupabaseClient<Database>

const MEMBER = 'member-1'
const OLD_SESSION = 'session-old'
const NEW_SESSION = 'session-new'

interface Fixture {
  answers?: Array<Record<string, unknown>>
  response?: Record<string, unknown> | null
  sessions?: Array<Record<string, unknown>>
}

/**
 * A double that applies the projection's own ordering before returning rows,
 * exactly as PostgREST would. If the reader stopped ordering, or ordered by
 * something else, the multi-session tests would notice.
 */
function mkClient(fx: Fixture) {
  const orderKeys: string[] = []

  function chain(table: string) {
    const c: Record<string, unknown> = {}
    const noop = () => c
    for (const m of ['eq', 'in', 'limit']) c[m] = noop
    c.select = noop
    c.order = (col: string) => {
      if (table === 'intake_answers') orderKeys.push(col)
      return c
    }
    const data = () => {
      if (table === 'intake_answers') {
        const rows = [...(fx.answers ?? [])]
        rows.sort((a, b) => {
          const k = (r: Record<string, unknown>, f: string) => String(r[f] ?? '')
          for (const f of CANONICAL_ANSWER_ORDER) {
            const cmp = k(b, f).localeCompare(k(a, f))
            if (cmp !== 0) return cmp
          }
          return 0
        })
        return { data: rows, error: null }
      }
      if (table === 'intake_responses') return { data: fx.response ?? null, error: null }
      return { data: fx.sessions ?? [], error: null }
    }
    c.maybeSingle = async () => data()
    c.single = async () => data()
    c.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(data()).then(res, rej)
    return c
  }

  const client = { from: (t: string) => chain(t) } as unknown as ReadClient
  return { client, orderKeys }
}

const answer = (o: Partial<Record<string, unknown>>) => ({
  id: 'a1',
  session_id: NEW_SESSION,
  question_id: 'most_want_to_understand',
  section_id: '1',
  answer: 'something',
  answered_at: '2026-11-08T10:00:00.000Z',
  updated_at: '2026-11-08T10:00:00.000Z',
  ...o,
})

function find(intake: CanonicalIntake, questionId: string) {
  for (const s of intake.sections) {
    const a = s.answers.find((x) => x.questionId === questionId)
    if (a) return a
  }
  return undefined
}

// ─── 1. Answer rows override the legacy column ───────────────────────────────

describe('1 — answer rows override legacy column projection', () => {
  it('prefers the answer row when both stores hold a value', async () => {
    const { client } = mkClient({
      answers: [answer({ answer: 'from the answer store' })],
      response: { id: 'r1', most_want_to_understand: 'from the legacy column' },
    })
    const a = find(await getCanonicalIntake(client, MEMBER), 'most_want_to_understand')!
    expect(a.value).toBe('from the answer store')
    expect(a.source).toBe('answer')
  })

  it('prefers a BLANK answer row over a populated legacy column', async () => {
    // The sharp case. An empty answer still means the client reached the
    // question; the column is a projection written later and may be stale.
    const { client } = mkClient({
      answers: [answer({ answer: '' })],
      response: { id: 'r1', most_want_to_understand: 'stale column value' },
    })
    const a = find(await getCanonicalIntake(client, MEMBER), 'most_want_to_understand')!
    expect(a.source).toBe('answer')
    expect(a.status).toBe('blank')
    expect(a.value).toBe('')
  })

  it('falls back to the column only when no answer row exists', async () => {
    const { client } = mkClient({
      answers: [],
      response: { id: 'r1', most_want_to_understand: 'only the column has this' },
    })
    const a = find(await getCanonicalIntake(client, MEMBER), 'most_want_to_understand')!
    expect(a.source).toBe('legacy_column')
    expect(a.value).toBe('only the column has this')
  })

  it('reports absent when neither store holds anything', async () => {
    const { client } = mkClient({ answers: [], response: { id: 'r1' } })
    const a = find(await getCanonicalIntake(client, MEMBER), 'most_want_to_understand')!
    expect(a.status).toBe('unanswered')
    expect(a.source).toBe('absent')
    expect(a.value).toBeNull()
  })
})

// ─── 2. Multi-session precedence ─────────────────────────────────────────────

describe('2 — latest answer across sessions wins deterministically', () => {
  const older = answer({
    id: 'a-old',
    session_id: OLD_SESSION,
    answer: 'what I said in November',
    answered_at: '2026-11-04T22:56:23.000Z',
    updated_at: '2026-11-04T22:56:23.000Z',
  })
  const newer = answer({
    id: 'a-new',
    session_id: NEW_SESSION,
    answer: 'what I say now',
    answered_at: '2026-11-20T09:00:00.000Z',
    updated_at: '2026-11-20T09:00:00.000Z',
  })

  it('takes the newer session answer as canonical', async () => {
    const { client } = mkClient({ answers: [older, newer] })
    const a = find(await getCanonicalIntake(client, MEMBER), 'most_want_to_understand')!
    expect(a.value).toBe('what I say now')
    expect(a.sessionId).toBe(NEW_SESSION)
  })

  it('does not depend on the order rows arrive in', async () => {
    const forwards = await getCanonicalIntake(mkClient({ answers: [older, newer] }).client, MEMBER)
    const backwards = await getCanonicalIntake(mkClient({ answers: [newer, older] }).client, MEMBER)
    expect(find(forwards, 'most_want_to_understand')!.value).toBe('what I say now')
    expect(find(backwards, 'most_want_to_understand')!.value).toBe('what I say now')
  })

  it('prefers updated_at over answered_at — a re-answer within a session wins', async () => {
    // An UPSERT moves updated_at but leaves answered_at at first-answer time,
    // so ordering on answered_at alone would return the stale row.
    const firstAnsweredButEditedLater = answer({
      id: 'a-edited',
      session_id: NEW_SESSION,
      answer: 'edited later',
      answered_at: '2026-11-01T00:00:00.000Z',
      updated_at: '2026-11-30T00:00:00.000Z',
    })
    const answeredLaterNeverEdited = answer({
      id: 'a-plain',
      session_id: OLD_SESSION,
      answer: 'answered later, never edited',
      answered_at: '2026-11-10T00:00:00.000Z',
      updated_at: '2026-11-10T00:00:00.000Z',
    })
    const { client } = mkClient({ answers: [answeredLaterNeverEdited, firstAnsweredButEditedLater] })
    const a = find(await getCanonicalIntake(client, MEMBER), 'most_want_to_understand')!
    expect(a.value).toBe('edited later')
  })

  it('breaks an exact timestamp tie by id, so the result is reproducible', async () => {
    const tieA = answer({ id: 'aaa', session_id: OLD_SESSION, answer: 'A' })
    const tieB = answer({ id: 'zzz', session_id: NEW_SESSION, answer: 'Z' })
    const one = await getCanonicalIntake(mkClient({ answers: [tieA, tieB] }).client, MEMBER)
    const two = await getCanonicalIntake(mkClient({ answers: [tieB, tieA] }).client, MEMBER)
    expect(find(one, 'most_want_to_understand')!.value).toBe('Z')
    expect(find(two, 'most_want_to_understand')!.value).toBe('Z')
  })

  it('documents and applies the ordering key', async () => {
    expect(CANONICAL_ANSWER_ORDER).toEqual(['updated_at', 'answered_at', 'id'])
    const { client, orderKeys } = mkClient({ answers: [] })
    await getCanonicalIntake(client, MEMBER)
    expect(orderKeys).toEqual(['updated_at', 'answered_at', 'id'])
  })

  it('never assumes one session per member', () => {
    expect(SOURCE).toMatch(/unique on\s*\n\/\/\s*\(session_id, question_id\)|session_id, question_id/)
    expect(SOURCE).not.toMatch(/\.limit\(1\)[\s\S]{0,80}intake_answers/)
  })
})

// ─── 3. History is preserved ─────────────────────────────────────────────────

describe('3 — the old session remains queryable and history is preserved', () => {
  it('returns the superseded answer rather than discarding it', async () => {
    const { client } = mkClient({
      answers: [
        answer({ id: 'a-old', session_id: OLD_SESSION, answer: 'old', updated_at: '2026-11-04T00:00:00.000Z' }),
        answer({ id: 'a-new', session_id: NEW_SESSION, answer: 'new', updated_at: '2026-11-20T00:00:00.000Z' }),
      ],
    })
    const a = find(await getCanonicalIntake(client, MEMBER), 'most_want_to_understand')!
    expect(a.value).toBe('new')
    expect(a.superseded).toHaveLength(1)
    expect(a.superseded[0].value).toBe('old')
    expect(a.superseded[0].sessionId).toBe(OLD_SESSION)
  })

  it('lists every session, old ones included, with their answer counts', async () => {
    const { client } = mkClient({
      answers: [
        answer({ id: 'a1', session_id: OLD_SESSION, question_id: 'arrival_emotion', answer: 'curious', updated_at: '2026-11-04T00:00:00.000Z' }),
        answer({ id: 'a2', session_id: NEW_SESSION, question_id: 'most_want_to_understand', answer: 'x', updated_at: '2026-11-20T00:00:00.000Z' }),
      ],
      sessions: [
        { id: NEW_SESSION, status: 'in_progress', started_at: '2026-11-20T00:00:00.000Z', completed_at: null },
        { id: OLD_SESSION, status: 'completed', started_at: '2026-11-04T00:00:00.000Z', completed_at: '2026-11-08T00:00:00.000Z' },
      ],
    })
    const intake = await getCanonicalIntake(client, MEMBER)
    expect(intake.sessions.map((s) => s.id)).toEqual([NEW_SESSION, OLD_SESSION])
    expect(intake.sessions.find((s) => s.id === OLD_SESSION)!.answerCount).toBe(1)
    expect(intake.sessions.find((s) => s.id === OLD_SESSION)!.status).toBe('completed')
  })

  it('counts how many of each session is still canonical, rather than flagging both', async () => {
    // Observed on the live walkthrough: Tree Khan's 4 November sitting still
    // owns one answer while the 10 November one owns the rest. A boolean
    // "current" flag marked BOTH sessions current, which reads as two live
    // sittings. The count says what actually happened.
    const { client } = mkClient({
      answers: [
        // superseded by the new session
        answer({ id: 'a-old-1', session_id: OLD_SESSION, question_id: 'arrival_emotion', section_id: '0', answer: 'curious', updated_at: '2026-11-04T00:00:00.000Z' }),
        // still canonical: the new session never touched this question
        answer({ id: 'a-old-2', session_id: OLD_SESSION, question_id: 'most_want_to_understand', answer: '', updated_at: '2026-11-04T00:00:01.000Z' }),
        answer({ id: 'a-new-1', session_id: NEW_SESSION, question_id: 'arrival_emotion', section_id: '0', answer: 'hopeful', updated_at: '2026-11-10T00:00:00.000Z' }),
        answer({ id: 'a-new-2', session_id: NEW_SESSION, question_id: 'concern_duration', answer: 'over_a_year', updated_at: '2026-11-10T00:00:01.000Z' }),
      ],
      sessions: [
        { id: NEW_SESSION, status: 'completed', started_at: '2026-11-10T00:00:00.000Z', completed_at: null },
        { id: OLD_SESSION, status: 'completed', started_at: '2026-11-04T00:00:00.000Z', completed_at: null },
      ],
    })
    const intake = await getCanonicalIntake(client, MEMBER)
    const oldS = intake.sessions.find((s) => s.id === OLD_SESSION)!
    const newS = intake.sessions.find((s) => s.id === NEW_SESSION)!

    expect(oldS.answerCount).toBe(2)
    expect(oldS.canonicalCount).toBe(1) // only most_want_to_understand survives
    expect(newS.answerCount).toBe(2)
    expect(newS.canonicalCount).toBe(2)
    // Every canonical answer is owned by exactly one session.
    expect(oldS.canonicalCount + newS.canonicalCount).toBe(3)
  })

  it('deletes nothing — the projection has no mutation verb', () => {
    for (const verb of ['insert', 'update', 'upsert', 'delete', 'rpc']) {
      expect(SOURCE).not.toContain(`.${verb}(`)
    }
  })
})

// ─── 4 & 5. Coverage of both kinds of field ──────────────────────────────────

describe('4 — answer-only clinical-depth fields appear', () => {
  it('surfaces a field that exists in no column at all', async () => {
    const { client } = mkClient({
      answers: [answer({ question_id: 'post_exertional_worsening', section_id: '3', answer: true })],
      response: { id: 'r1' },
    })
    const a = find(await getCanonicalIntake(client, MEMBER), 'post_exertional_worsening')!
    expect(a.value).toBe(true)
    expect(a.source).toBe('answer')
    expect(getIntakeQuestion('post_exertional_worsening')!.legacyColumn).toBeNull()
  })

  it('registers all twenty answer-only questions', () => {
    const answerOnly = INTAKE_QUESTIONS.filter((q) => q.legacyColumn === null).map((q) => q.id)
    expect(answerOnly).toHaveLength(20)
    for (const id of [
      'aggravating_factors', 'relieving_factors', 'concern_severity_baseline',
      'post_exertional_worsening', 'gi_stool_type', 'energy_curve',
      'menstrual_status', 'caffeine_intake', 'alcohol_intake', 'food_symptom_link',
    ]) {
      expect(answerOnly).toContain(id)
    }
  })
})

describe('5 — legacy-only fields remain available', () => {
  it('returns a derived column that has no question behind it', async () => {
    const { client } = mkClient({ answers: [], response: { id: 'r1', primary_system: 'general' } })
    const intake = await getCanonicalIntake(client, MEMBER)
    const ps = intake.legacyOnly.find((f) => f.column === 'primary_system')!
    expect(ps.value).toBe('general')
    expect(ps.kind).toBe('derived')
  })

  it('returns a stale column that still holds a value', async () => {
    const { client } = mkClient({
      answers: [],
      response: { id: 'r1', working_with_practitioners: false },
    })
    const intake = await getCanonicalIntake(client, MEMBER)
    expect(intake.legacyOnly.find((f) => f.column === 'working_with_practitioners')!.value).toBe(false)
  })

  it('omits legacy-only fields that hold nothing', async () => {
    const { client } = mkClient({ answers: [], response: { id: 'r1', health_goals: null } })
    const intake = await getCanonicalIntake(client, MEMBER)
    expect(intake.legacyOnly.map((f) => f.column)).not.toContain('health_goals')
  })

  it('surfaces an unaccounted column rather than hiding it', async () => {
    const { client } = mkClient({
      answers: [],
      response: { id: 'r1', some_column_added_later: 'value' },
    })
    const intake = await getCanonicalIntake(client, MEMBER)
    expect(intake.legacyOnly.map((f) => f.column)).toContain('some_column_added_later')
  })

  it('registers the twelve legacy-only fields', () => {
    expect(LEGACY_ONLY_FIELDS).toHaveLength(12)
    expect(LEGACY_ONLY_FIELDS.filter((f) => f.kind === 'derived').map((f) => f.column)).toEqual([
      'primary_system',
    ])
  })
})

// ─── 6 & 7. Shape normalisation ──────────────────────────────────────────────

describe('6 — current_supplements normalises across both stores', () => {
  it('keeps an array from the answer store as a list', async () => {
    const { client } = mkClient({
      answers: [answer({ question_id: 'current_supplements', section_id: '5', answer: ['Vitamin D', 'Magnesium'] })],
    })
    const a = find(await getCanonicalIntake(client, MEMBER), 'current_supplements')!
    expect(a.value).toEqual(['Vitamin D', 'Magnesium'])
  })

  it('splits the legacy comma-joined string into the same list', async () => {
    const { client } = mkClient({
      answers: [],
      response: { id: 'r1', current_supplements: 'Vitamin D, Magnesium' },
    })
    const a = find(await getCanonicalIntake(client, MEMBER), 'current_supplements')!
    expect(a.value).toEqual(['Vitamin D', 'Magnesium'])
    expect(a.source).toBe('legacy_column')
  })

  it('gives both stores the same shape, so no consumer has to ask which', async () => {
    const fromAnswer = find(
      await getCanonicalIntake(
        mkClient({ answers: [answer({ question_id: 'current_supplements', section_id: '5', answer: ['Iron'] })] }).client,
        MEMBER,
      ),
      'current_supplements',
    )!
    const fromColumn = find(
      await getCanonicalIntake(
        mkClient({ answers: [], response: { id: 'r1', current_supplements: 'Iron' } }).client,
        MEMBER,
      ),
      'current_supplements',
    )!
    expect(fromAnswer.value).toEqual(fromColumn.value)
  })

  it('treats an empty list as blank, not as content', async () => {
    const { client } = mkClient({
      answers: [answer({ question_id: 'current_supplements', section_id: '5', answer: [] })],
    })
    const a = find(await getCanonicalIntake(client, MEMBER), 'current_supplements')!
    expect(a.status).toBe('blank')
  })
})

describe('7 — psychosocial_supported normalises across both stores', () => {
  it('keeps the option key and derives the boolean', async () => {
    const { client } = mkClient({
      answers: [answer({ question_id: 'psychosocial_supported', section_id: '6', answer: 'not_really' })],
    })
    const a = find(await getCanonicalIntake(client, MEMBER), 'psychosocial_supported')!
    expect(a.value).toEqual<SupportLevel>({ key: 'not_really', supported: false })
  })

  it('treats "mixed" and "supported" as supported', () => {
    const q = getIntakeQuestion('psychosocial_supported')!
    expect(normaliseAnswerValue(q, 'supported')).toEqual({ key: 'supported', supported: true })
    expect(normaliseAnswerValue(q, 'mixed')).toEqual({ key: 'mixed', supported: true })
    expect(normaliseAnswerValue(q, 'alone')).toEqual({ key: 'alone', supported: false })
  })

  it('admits the key is unrecoverable from the legacy boolean', async () => {
    // The form derived a boolean and threw the key away. Saying `key: null` is
    // the honest answer; inventing one would be a fabricated clinical detail.
    const { client } = mkClient({
      answers: [],
      response: { id: 'r1', psychosocial_supported: false },
    })
    const a = find(await getCanonicalIntake(client, MEMBER), 'psychosocial_supported')!
    expect(a.value).toEqual<SupportLevel>({ key: null, supported: false })
    expect(a.source).toBe('legacy_column')
  })

  it('counts a legacy boolean as content, not as blank', async () => {
    const { client } = mkClient({ answers: [], response: { id: 'r1', psychosocial_supported: false } })
    const a = find(await getCanonicalIntake(client, MEMBER), 'psychosocial_supported')!
    expect(a.status).toBe('answered')
  })
})

// ─── 8. Blank is not missing ─────────────────────────────────────────────────

describe('8 — a blank answer stays distinguishable from a missing one', () => {
  it('separates answered, blank and unanswered', async () => {
    const { client } = mkClient({
      answers: [
        answer({ id: 'a1', question_id: 'most_want_to_understand', answer: 'I want to know why' }),
        answer({ id: 'a2', question_id: 'concern_duration', section_id: '1', answer: '' }),
      ],
      response: { id: 'r1' },
    })
    const intake = await getCanonicalIntake(client, MEMBER)
    expect(find(intake, 'most_want_to_understand')!.status).toBe('answered')
    expect(find(intake, 'concern_duration')!.status).toBe('blank')
    expect(find(intake, 'symptom_pattern')!.status).toBe('unanswered')
  })

  it('does not count a blank towards the answered total', async () => {
    const { client } = mkClient({
      answers: [answer({ question_id: 'arrival_emotion', section_id: '0', answer: '' })],
    })
    const intake = await getCanonicalIntake(client, MEMBER)
    expect(intake.answeredCount).toBe(0)
    expect(find(intake, 'arrival_emotion')!.status).toBe('blank')
  })

  it('reproduces the real Tree Khan divergence correctly', async () => {
    // most_want_to_understand: answer row holds "", the column holds NULL
    // because getSectionData wrote `'' || null`. The honest reading is
    // "reached, left blank", not "never answered".
    const { client } = mkClient({
      answers: [
        answer({ id: 'a1', question_id: 'arrival_emotion', section_id: '0', answer: 'curious', updated_at: '2026-11-04T22:55:52.770Z' }),
        answer({ id: 'a2', question_id: 'most_want_to_understand', section_id: '1', answer: '', updated_at: '2026-11-04T22:56:23.453Z' }),
      ],
      response: {
        id: 'r1', arrival_emotion: 'curious', primary_concerns: [],
        primary_system: 'general', most_want_to_understand: null,
        is_complete: true, completed_sections: 6,
      },
    })
    const intake = await getCanonicalIntake(client, MEMBER)
    const mwtu = find(intake, 'most_want_to_understand')!
    expect(mwtu.status).toBe('blank')
    expect(mwtu.source).toBe('answer')
    expect(find(intake, 'arrival_emotion')!.status).toBe('answered')
    expect(find(intake, 'primary_concerns')!.status).toBe('blank')
    expect(intake.answeredCount).toBe(1)
  })
})

// ─── Registry integrity ──────────────────────────────────────────────────────

describe('the registry is the one question model', () => {
  it('has unique question ids', () => {
    const ids = INTAKE_QUESTIONS.map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('covers the 48 questions the live form persists', () => {
    expect(INTAKE_QUESTIONS).toHaveLength(48)
    expect(INTAKE_QUESTIONS.filter((q) => q.legacyColumn !== null)).toHaveLength(28)
  })

  it('carries labels and sections, never answers', () => {
    for (const q of INTAKE_QUESTIONS) {
      expect(q.label.length).toBeGreaterThan(3)
      expect(q.sectionId).toMatch(/^\d$/)
    }
    expect(REGISTRY_SOURCE).not.toMatch(/^\s*(value|answer|example|default|sample)\s*:/m)
  })

  it('names a legacy column at most once', () => {
    const cols = INTAKE_QUESTIONS.map((q) => q.legacyColumn).filter(Boolean)
    expect(new Set(cols).size).toBe(cols.length)
  })

  it('does not reuse a legacy-only column as a question mirror', () => {
    const mirrored = new Set(INTAKE_QUESTIONS.map((q) => q.legacyColumn).filter(Boolean))
    for (const f of LEGACY_ONLY_FIELDS) expect(mirrored.has(f.column)).toBe(false)
  })
})

describe('the projection is not a snapshot', () => {
  it('creates no table, copy or mirror', () => {
    for (const t of ['review_case', 'preview_case', 'founder_case', 'intake_snapshot', 'case_intake']) {
      expect(SOURCE).not.toContain(t)
    }
  })

  it('reads only the three intake tables', () => {
    const tables = [...SOURCE.matchAll(/\.from\('([a-z_]+)'\)/g)].map((m) => m[1])
    expect(new Set(tables)).toEqual(new Set(['intake_answers', 'intake_responses', 'intake_sessions']))
  })
})
