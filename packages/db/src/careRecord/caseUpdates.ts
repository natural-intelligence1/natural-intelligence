// ─── packages/db/src/careRecord/caseUpdates.ts ──────────────────────────────
// Client update → practitioner "Since last review".
//
// SOURCE OF TRUTH: case_events. Not a new table — this one already exists,
// already keys on client_cases(id), already carries a type and a timestamp,
// and already has BOTH read policies this flow needs:
//
//   case_events_member_select        client, where client_cases.client_id = auth.uid()
//   case_events_practitioner_select  practitioner, via case_practitioner_work
//   case_events_service_all          service_role, ALL
//
// Its event_type CHECK already contains `follow_up_answer`, with zero rows —
// the vocabulary anticipated exactly this flow.
//
// ── THE READ PATH IS REAL. THE WRITE PATH IS BLOCKED BY ONE POLICY. ─────────
//
// `loadCaseUpdates` below is a genuine query against case_events under RLS,
// and works today for both sides. What a client CANNOT do is insert: the only
// insert-capable policy is case_events_service_all, i.e. service_role. There
// is no INSERT policy for a client on their own case.
//
// Writing through service_role from a server action would "work" and is NOT
// done here: it would move the authorisation decision out of the database and
// into this file, which is the weakening the care contract exists to prevent.
// The founder gate is a policy, so the fix is a policy.
//
// See CLIENT_UPDATE_STORAGE_GAP for the three gaps, smallest first.
// NO MIGRATION HAS BEEN WRITTEN.

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildSinceLastReview, UPDATE_KIND_LABELS,
  type DatedUpdate, type SinceLastReview, type UpdateAuthorRole, type UpdateKind,
} from '../intakeV2/updates'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any>

/** case_events.event_type, as the CHECK constraint defines it. */
export const CASE_EVENT_TYPES = [
  'intake_answer', 'follow_up_answer', 'lab_upload', 'gp_record_upload',
  'grocery_receipt', 'practitioner_note', 'practitioner_decision', 'protocol_update',
] as const
export type CaseEventType = (typeof CASE_EVENT_TYPES)[number]

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

/** Who authored each event type. case_events has NO author column, so this is
 *  derived from the type rather than read — see gap 2. */
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

/** The gap, stated once so the report and the code cannot disagree. */
export const CLIENT_UPDATE_STORAGE_GAP = {
  readPath: 'available' as const,
  writePath: 'blocked' as const,
  table: 'case_events',
  gaps: [
    {
      n: 1,
      severity: 'blocking' as const,
      what: 'No INSERT policy lets a client write an event for their own case.',
      detail:
        'case_events has exactly one insert-capable policy, case_events_service_all ' +
        '(auth.role() = \'service_role\'). Clients have SELECT only.',
      smallestFix:
        'One INSERT policy on case_events: with check ( event_type = \'follow_up_answer\' ' +
        'and exists (select 1 from client_cases cc where cc.id = case_id and cc.client_id = auth.uid()) ). ' +
        'Restricting the policy to follow_up_answer means a client cannot forge a ' +
        'practitioner_note or a protocol_update, which a broader policy would permit.',
    },
    {
      n: 2,
      severity: 'attribution' as const,
      what: 'case_events has no author column, so a line cannot be reliably attributed to a person.',
      detail:
        'Author is carried inconsistently inside event_payload — practitioner_decision has ' +
        'practitioner_id, practitioner_note has only `note`, intake_answer has question_id/section. ' +
        'Nothing enforces it. DatedUpdate.authorId is required precisely because every delta ' +
        'line must be attributable, so this reader falls back to the role when the payload is silent.',
      smallestFix:
        'author_id uuid references profiles(id), plus a not-null event_payload->>\'statement\' ' +
        'for follow_up_answer. Then attribution is read, not inferred.',
    },
    {
      n: 3,
      severity: 'integrity' as const,
      what: 'Append-only holds by absence of policy, not by constraint.',
      detail:
        'Clients have no UPDATE or DELETE policy, so they cannot rewrite history today. But unlike ' +
        'case_contributions — which has trg_block_contribution_rewrite — nothing in case_events ' +
        'would stop a later policy from permitting it.',
      smallestFix:
        'A BEFORE UPDATE OR DELETE trigger matching block_contribution_rewrite, so a correction ' +
        'adds an event and never edits one.',
    },
  ],
  /** Separate from the gaps above, and not this flow\'s to fix. */
  divergenceToFlag:
    'case_events_practitioner_select authorises practitioners through case_practitioner_work, ' +
    'while the wired case-team flow reads case_team_roles. A practitioner on the case team is ' +
    'therefore not guaranteed to be able to read that case\'s events. Both sides should resolve ' +
    'practitioner access the same way before this flow is called wired.',
  requiresFounderApproval: true,
} as const

interface CaseEventRow {
  id: string
  case_id: string
  event_type: string
  source_table: string | null
  source_id: string | null
  event_payload: Record<string, unknown> | null
  created_at: string
}

function str(payload: Record<string, unknown> | null, key: string): string | null {
  const raw = payload?.[key]
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null
}

/**
 * One case_events row as a DatedUpdate.
 *
 * `occurred_at` in the payload wins over created_at where present: when a
 * client reports on Tuesday something that happened on Sunday, the delta must
 * date it Sunday. Falls back to created_at, never to now.
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

  const role = ROLE_BY_EVENT[type]
  return {
    id: row.id,
    at: str(p, 'occurred_at') ?? row.created_at,
    authorRole: role,
    // Gap 2: no author column. `unattributed:<role>` is deliberately not a
    // plausible-looking id, so an unattributed line cannot be mistaken for
    // an attributed one.
    authorId: str(p, 'author_id') ?? str(p, 'practitioner_id') ?? `unattributed:${role}`,
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
 * A real query under RLS. Which rows come back depends on who is asking:
 * the client sees their own case's events, a practitioner sees events for
 * cases they hold work on. This function does not re-check that — the
 * database does, and duplicating the rule here would let the two drift.
 */
export async function loadCaseUpdates(
  client: AnyClient,
  caseId: string,
): Promise<DatedUpdate[]> {
  const { data, error } = await client
    .from('case_events')
    .select('id, case_id, event_type, source_table, source_id, event_payload, created_at')
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
 *  named a person. Gap 2 made visible rather than hidden. */
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
 *  score or classify the content. */
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
  authorId: string
  statement: string
  /** When it happened, as the client states it. Distinct from when recorded. */
  occurredAt: string
  concernId?: string
}

export type ClientUpdateResult =
  | { stored: false; reason: 'storage_gap'; gap: typeof CLIENT_UPDATE_STORAGE_GAP; problems?: undefined }
  | { stored: false; reason: 'invalid'; problems: string[]; gap?: undefined }

/**
 * The write path, as far as it can honestly go.
 *
 * Validates exactly as a real implementation would, then refuses with
 * `storage_gap`. It does NOT fall back to service_role, and does not write
 * the client's words to a table that is not for them. A client telling NI
 * something and being shown success while nothing is kept would be the worst
 * available outcome; the second worst is it being kept somewhere a
 * practitioner will never look.
 *
 * When gap 1 is closed this becomes an insert of one follow_up_answer event,
 * and the signature does not change.
 */
export async function recordClientUpdate(
  _client: AnyClient,
  draft: ClientUpdateDraft,
): Promise<ClientUpdateResult> {
  const check = checkFactualStatement(draft.statement)
  if (!check.ok) return { stored: false, reason: 'invalid', problems: check.problems }
  return { stored: false, reason: 'storage_gap', gap: CLIENT_UPDATE_STORAGE_GAP }
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
  /** True while no client update can be stored at all. Lets a practitioner
   *  surface distinguish "the client has said nothing" from "the client
   *  cannot yet tell us anything". */
  storageUnavailable: boolean
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
    storageUnavailable: CLIENT_UPDATE_STORAGE_GAP.writePath === 'blocked',
  }
}

export { UPDATE_KIND_LABELS }
export type { DatedUpdate, SinceLastReview, UpdateKind, UpdateAuthorRole }
