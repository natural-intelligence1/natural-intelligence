// ─── packages/db/src/careRecord/caseUpdates.ts ──────────────────────────────
// Client update → practitioner "Since last review".
//
// SOURCE OF TRUTH: case_events. Not a new table — it already keys on
// client_cases(id), already carries a type and a timestamp, and already has
// both read policies this flow needs. Its event_type CHECK already contains
// `follow_up_answer`, which is the client-report type.
//
// ── READ PATH LIVE. WRITE PATH AWAITING MIGRATION 0062. ────────────────────
//
// `loadCaseUpdates` works today for both sides and deliberately works BOTH
// sides of the migration: it selects * and treats the 0062 columns as
// optional, so the practitioner Overview does not break before the apply and
// gains real attribution after it.
//
// `recordClientUpdate` is written against the post-migration contract, as
// authorised. Until 0062 is applied it cannot succeed, and it says so
// precisely — see ClientUpdateResult. It never falls back to service_role:
// that would move the authorisation decision out of the database and into
// this file, which is the weakening the care contract exists to prevent.

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildSinceLastReview, UPDATE_KIND_LABELS,
  type DatedUpdate, type SinceLastReview, type UpdateAuthorRole, type UpdateKind,
} from '../intakeV2/updates'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any>

/** The migration that opens the client write path. */
export const CLIENT_UPDATE_WRITE_PATH = {
  status: 'awaiting_migration' as const,
  migration: '0062_case_events_client_authorship.sql',
  table: 'case_events',
  eventType: 'follow_up_answer' as const,
  /** What the client surface should tell a client while this is true. */
  what: 'recording your own updates is not switched on yet',
  adds: [
    'case_events_client_insert — a client may insert ONLY follow_up_answer, ONLY on their own case, ONLY attributed to themselves',
    'actor_user_id references profiles(id) on delete set null — the authenticated human who created the event',
    'actor_capacity in (client, practitioner, admin_support, system) — the capacity they acted in',
    'occurred_at timestamptz — when it happened, as distinct from created_at, when NI received it',
    'trg_block_case_event_rewrite — append-only for every role, service_role included',
    'trg_enforce_case_event_authorship — a human capacity must name its actor; a client cannot backdate created_at',
  ],
  /** Separate from this flow, and not fixed by 0062. */
  divergenceToFlag:
    'case_events_practitioner_select authorises practitioners through case_practitioner_work, ' +
    'while the wired case-team flow reads case_team_roles. A practitioner on the care team is ' +
    'therefore not guaranteed to be able to read that case\'s events.',
} as const

/** case_events.event_type, as the CHECK constraint defines it. */
export const CASE_EVENT_TYPES = [
  'intake_answer', 'follow_up_answer', 'lab_upload', 'gp_record_upload',
  'grocery_receipt', 'practitioner_note', 'practitioner_decision', 'protocol_update',
] as const
export type CaseEventType = (typeof CASE_EVENT_TYPES)[number]

/** case_events.actor_capacity, added by 0062. */
export const ACTOR_CAPACITIES = ['client', 'practitioner', 'admin_support', 'system'] as const
export type ActorCapacity = (typeof ACTOR_CAPACITIES)[number]

/**
 * case_events.event_type → the UpdateKind vocabulary the delta builder groups
 * by. Several events map onto one kind, which is correct: a GP record and a
 * grocery receipt are both "a new document" to a practitioner scanning a
 * delta, and the specific event_type stays on sourceRef.
 */
const KIND_BY_EVENT: Record<CaseEventType, UpdateKind> = {
  intake_answer:        'question_answered',
  follow_up_answer:     'client_report',
  lab_upload:           'new_lab_result',
  gp_record_upload:     'new_document',
  grocery_receipt:      'new_document',
  practitioner_note:    'practitioner_note',
  practitioner_decision:'practitioner_note',
  protocol_update:      'protocol_version',
}

/** Capacity → the delta's author role. */
const ROLE_BY_CAPACITY: Record<ActorCapacity, UpdateAuthorRole> = {
  client: 'client', practitioner: 'practitioner',
  admin_support: 'practitioner', system: 'system',
}

/** Fallback for rows predating 0062, which carry no capacity. Derived from
 *  the event type, which is the only signal such a row has. */
const ROLE_BY_EVENT: Record<CaseEventType, UpdateAuthorRole> = {
  intake_answer:        'client',
  follow_up_answer:     'client',
  lab_upload:           'client',
  gp_record_upload:     'client',
  grocery_receipt:      'client',
  practitioner_note:    'practitioner',
  practitioner_decision:'practitioner',
  protocol_update:      'system',
}

/** The 0062 columns are optional so one reader serves both sides of the
 *  apply. Undefined means "not migrated yet"; null means "migrated, not
 *  recorded". The reader treats them the same, but the distinction is real. */
interface CaseEventRow {
  id: string
  case_id: string
  event_type: string
  source_table: string | null
  source_id: string | null
  event_payload: Record<string, unknown> | null
  created_at: string
  actor_user_id?: string | null
  actor_capacity?: string | null
  occurred_at?: string | null
}

function str(payload: Record<string, unknown> | null, key: string): string | null {
  const raw = payload?.[key]
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null
}

/**
 * One case_events row as a DatedUpdate.
 *
 * Dated by when it HAPPENED: the occurred_at column first, then the legacy
 * payload key, then created_at. Never now.
 */
export function eventToUpdate(row: CaseEventRow): DatedUpdate | null {
  if (!(CASE_EVENT_TYPES as readonly string[]).includes(row.event_type)) return null
  const type = row.event_type as CaseEventType
  const p = row.event_payload

  // A delta line with no statement would be a dated blank. Skipped rather
  // than rendered, and rather than described by this module in words of its
  // own — summarising someone's record is interpretation.
  const statement = str(p, 'statement') ?? str(p, 'note') ?? str(p, 'recommendation')
  if (statement === null) return null

  const capacity = (ACTOR_CAPACITIES as readonly string[]).includes(row.actor_capacity ?? '')
    ? (row.actor_capacity as ActorCapacity)
    : null
  const role = capacity ? ROLE_BY_CAPACITY[capacity] : ROLE_BY_EVENT[type]

  return {
    id: row.id,
    at: row.occurred_at ?? str(p, 'occurred_at') ?? row.created_at,
    authorRole: role,
    // `unattributed:<role>` is deliberately not a plausible-looking id, so an
    // unattributed line cannot be mistaken for an attributed one. Rows
    // predating 0062 have no actor column; erased people have a null one.
    authorId: row.actor_user_id
      ?? str(p, 'author_id') ?? str(p, 'practitioner_id')
      ?? `unattributed:${role}`,
    kind: KIND_BY_EVENT[type],
    statement,
    sourceRef: row.source_table && row.source_id
      ? `${row.source_table}/${row.source_id}`
      : `case_events/${type}`,
    previousValue: str(p, 'previous_value'),
    newValue: str(p, 'new_value'),
    concernId: str(p, 'concern_id'),
  }
}

/**
 * Every recorded update on a case, as DatedUpdates.
 *
 * `select *` rather than a column list, deliberately: it is one narrow table,
 * and it means this reader works identically before and after 0062 instead of
 * erroring on columns that do not exist yet.
 *
 * Which rows come back depends on who is asking — the client sees their own
 * case, a practitioner sees cases they hold work on. This does not re-check
 * that; the database does, and duplicating the rule here would let the two
 * drift.
 */
export async function loadCaseUpdates(
  client: AnyClient,
  caseId: string,
): Promise<DatedUpdate[]> {
  const { data, error } = await client
    .from('case_events')
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? [] as CaseEventRow[])
    .map((row: CaseEventRow) => eventToUpdate(row))
    .filter((u): u is DatedUpdate => u !== null)
}

/** How a practitioner sees the origin of a line. The client's own words are
 *  labelled as such and never presented as a clinical observation. */
export function provenanceLabel(update: DatedUpdate): string {
  const byRole: Record<UpdateAuthorRole, string> = {
    client: 'Client reported',
    practitioner: 'Practitioner',
    system: 'Recorded by NI',
  }
  return byRole[update.authorRole]
}

export function isClientReported(update: DatedUpdate): boolean {
  return update.authorRole === 'client'
}

/** True where attribution fell back to the role because nothing in the row
 *  named a person: a row predating 0062, or one whose actor has been erased. */
export function isUnattributed(update: DatedUpdate): boolean {
  return update.authorId.startsWith('unattributed:')
}

/** Connectives that turn a report into a claim about cause. A client may of
 *  course believe one thing caused another; the RECORD states what happened
 *  and when, and leaves causation to the practitioner. */
const CAUSAL = /\b(because|caused|due to|therefore|so that|as a result|led to|triggered by|thanks to)\b/i

export interface StatementCheck { ok: boolean; problems: string[] }

/** Guard a client-entered statement before it is stored. Factual capture
 *  only — this rejects causal phrasing and empty text. It does NOT interpret,
 *  score, classify or prioritise the content. */
export function checkFactualStatement(statement: string): StatementCheck {
  const problems: string[] = []
  const text = statement.trim()
  if (text.length === 0) problems.push('An update needs some text.')
  if (text.length > 1000) problems.push('Keep an update under 1000 characters.')
  if (CAUSAL.test(text)) {
    problems.push(
      'Record what happened and when, rather than why. Your practitioner will consider the why with you.',
    )
  }
  return { ok: problems.length === 0, problems }
}

export interface ClientUpdateDraft {
  caseId: string
  /** The authenticated client. The database checks this against the JWT; it
   *  is passed here only so the row can be built. */
  actorUserId: string
  statement: string
  /** When it happened, as the client states it. Must not be in the future. */
  occurredAt: string
  concernId?: string
  previousValue?: string
  newValue?: string
}

export type ClientUpdateResult =
  | { stored: true; eventId: string }
  | { stored: false; reason: 'invalid'; problems: string[] }
  /** 0062 is not applied here yet. */
  | { stored: false; reason: 'awaiting_migration'; migration: string; detail: string }
  /** The database refused it: not the caller's case, or not their identity. */
  | { stored: false; reason: 'not_permitted'; detail: string }

/** Postgres said the column or policy does not exist — i.e. pre-0062. */
function looksUnmigrated(error: { code?: string; message?: string }): boolean {
  return error.code === '42703' || /actor_capacity|actor_user_id|occurred_at/i.test(error.message ?? '')
}

/**
 * Record one factual client-reported update.
 *
 * Captures what happened and when, who reported it, and a structured
 * before/after only where one genuinely applies. It does not interpret,
 * diagnose, prioritise or generate practitioner judgement, and it does not
 * write anything the client did not say.
 *
 * occurred_at (when it happened, client-stated) and created_at (when NI
 * received it) are kept separate. created_at is stamped by the database, not
 * supplied here, so a client cannot backdate their own submission.
 */
export async function recordClientUpdate(
  client: AnyClient,
  draft: ClientUpdateDraft,
): Promise<ClientUpdateResult> {
  const check = checkFactualStatement(draft.statement)
  if (!check.ok) return { stored: false, reason: 'invalid', problems: check.problems }

  if (Number.isNaN(Date.parse(draft.occurredAt))) {
    return { stored: false, reason: 'invalid', problems: ['Say when this happened.'] }
  }
  if (Date.parse(draft.occurredAt) > Date.now()) {
    return { stored: false, reason: 'invalid', problems: ['That date is in the future.'] }
  }

  const payload: Record<string, string> = { statement: draft.statement.trim() }
  if (draft.concernId) payload.concern_id = draft.concernId
  // Only where a before AND an after both genuinely exist. A lone "after" is
  // not a change, and recording it as one would overstate what was reported.
  if (draft.previousValue && draft.newValue) {
    payload.previous_value = draft.previousValue
    payload.new_value = draft.newValue
  }

  const { data, error } = await client
    .from('case_events')
    .insert({
      case_id: draft.caseId,
      event_type: CLIENT_UPDATE_WRITE_PATH.eventType,
      event_payload: payload,
      actor_user_id: draft.actorUserId,
      actor_capacity: 'client',
      occurred_at: draft.occurredAt,
      // created_at deliberately omitted: the database stamps it.
    })
    .select('id')
    .single()

  if (error) {
    if (looksUnmigrated(error)) {
      return {
        stored: false, reason: 'awaiting_migration',
        migration: CLIENT_UPDATE_WRITE_PATH.migration,
        detail: error.message,
      }
    }
    // Everything else is the database refusing on the merits — wrong case,
    // wrong identity, forbidden event type. Reported as refused, never
    // retried another way.
    return { stored: false, reason: 'not_permitted', detail: error.message }
  }

  return { stored: true, eventId: (data as { id: string }).id }
}

/**
 * Since-last-review for a case, assembled from stored updates.
 *
 * Delegates to the shipped buildSinceLastReview — grouping, ordering and the
 * review cutoff are NOT reimplemented here. This only supplies the updates.
 */
export function sinceLastReviewFor(
  updates: readonly DatedUpdate[],
  since: string | null,
  generatedAt: string = new Date().toISOString(),
): SinceLastReview {
  return buildSinceLastReview([...updates], since, generatedAt)
}

export interface SinceLastReviewView {
  review: SinceLastReview
  /** True when the window holds nothing — so the UI says "nothing has
   *  changed" rather than rendering an empty frame. */
  nothingChanged: boolean
  clientReportedCount: number
  /** Lines whose author could not be read. Shown, not hidden. */
  unattributedCount: number
  /** True while a client cannot record an update at all. Lets a practitioner
   *  surface distinguish "the client has said nothing" from "the client
   *  cannot yet tell us anything". */
  clientWritesUnavailable: boolean
}

export function buildSinceLastReviewView(
  updates: readonly DatedUpdate[],
  since: string | null,
  generatedAt?: string,
): SinceLastReviewView {
  const review = sinceLastReviewFor(updates, since, generatedAt)
  const entries = review.sections.flatMap((s) => s.entries)
  return {
    review,
    nothingChanged: review.count === 0,
    clientReportedCount: entries.filter(isClientReported).length,
    unattributedCount: entries.filter(isUnattributed).length,
    clientWritesUnavailable: CLIENT_UPDATE_WRITE_PATH.status === 'awaiting_migration',
  }
}

export { UPDATE_KIND_LABELS }
export type { DatedUpdate, SinceLastReview, UpdateKind, UpdateAuthorRole }
