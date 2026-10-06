// ─── packages/db/src/intakeV2/updates.ts ─────────────────────────────────────
// Dated client updates after submission, and the factual "Since last review"
// delta builder.
//
// Two rules shape this module:
//
// 1. THE SUBMITTED SNAPSHOT IS NEVER REWRITTEN. `buildCaseSnapshot` already
//    deep-freezes what the client submitted. Anything the client changes
//    afterwards becomes a DATED UPDATE recorded alongside it, so the record
//    always shows both what was submitted and what changed since.
//
// 2. THE DELTA IS FACTUAL AND NEVER CAUSAL. This builder reports "what is
//    different and when", with a source for every line. It never writes
//    "X improved because of Y" — the strongest form it will ever produce is
//    a plain sequence, attributed, and only where both facts are dated.

import type { V2CaseSnapshot } from './caseSnapshot'

export const UPDATE_KINDS = [
  'client_report', 'medication_change', 'supplement_change', 'new_document',
  'new_lab_result', 'outcome_measure', 'daily_path_obstacle', 'question_answered',
  'protocol_version', 'practitioner_note',
] as const
export type UpdateKind = (typeof UPDATE_KINDS)[number]

export const UPDATE_KIND_LABELS: Record<UpdateKind, string> = {
  client_report:       'New client report',
  medication_change:   'Medicine change',
  supplement_change:   'Supplement change',
  new_document:        'New document',
  new_lab_result:      'New lab result',
  outcome_measure:     'Outcome measure change',
  daily_path_obstacle: 'DailyPath obstacle',
  question_answered:   'Open question answered',
  protocol_version:    'Protocol version change',
  practitioner_note:   'Practitioner note',
}

export type UpdateAuthorRole = 'client' | 'practitioner' | 'system'

export interface DatedUpdate {
  id: string
  at: string
  authorRole: UpdateAuthorRole
  /** Practitioner or client id. Required — every delta line is attributable. */
  authorId: string
  kind: UpdateKind
  /** Short factual statement. No causal connectives. */
  statement: string
  /** The field/record this concerns, so the UI can link to source. */
  sourceRef: string
  /** What it was before, where a before exists. */
  previousValue?: string | null
  newValue?: string | null
  /** Concern this relates to, when it relates to one. */
  concernId?: string | null
}

/**
 * Record a change WITHOUT touching the submitted snapshot. The snapshot is
 * returned unchanged, by identity — callers cannot accidentally persist a
 * mutated version.
 */
export function recordUpdate(
  snapshot: V2CaseSnapshot, updates: DatedUpdate[], update: DatedUpdate,
): { snapshot: V2CaseSnapshot; updates: DatedUpdate[] } {
  return { snapshot, updates: [...updates, update] }
}

// ─── Since last review ───────────────────────────────────────────────────────

export interface SinceLastReviewSection {
  kind: UpdateKind
  label: string
  entries: DatedUpdate[]
}

export interface SinceLastReview {
  /** The review this is measured from. Null when there has been no review. */
  since: string | null
  generatedAt: string
  sections: SinceLastReviewSection[]
  /** Total across all sections — drives "nothing has changed" states. */
  count: number
}

/** Order deltas are shown in: what the client said first, admin last. */
const SECTION_ORDER: UpdateKind[] = [
  'client_report', 'outcome_measure', 'new_lab_result', 'new_document',
  'medication_change', 'supplement_change', 'daily_path_obstacle',
  'question_answered', 'protocol_version', 'practitioner_note',
]

/**
 * Everything factually different since the given review point, grouped and
 * source-attributed. Returns an empty-but-valid structure when nothing has
 * changed, so the UI can say so plainly rather than rendering nothing.
 */
export function buildSinceLastReview(
  updates: DatedUpdate[], since: string | null, generatedAt: string,
): SinceLastReview {
  const cutoff = since ? new Date(since).getTime() : null
  const inWindow = updates
    .filter((u) => cutoff === null || new Date(u.at).getTime() > cutoff)
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())

  const sections: SinceLastReviewSection[] = []
  for (const kind of SECTION_ORDER) {
    const entries = inWindow.filter((u) => u.kind === kind)
    if (entries.length > 0) {
      sections.push({ kind, label: UPDATE_KIND_LABELS[kind], entries })
    }
  }
  return { since, generatedAt, sections, count: inWindow.length }
}

/**
 * The ONLY sequence statement this system will produce. It states order and
 * attributes both halves; it never asserts that one caused the other, and it
 * refuses to say anything at all unless both facts are dated and the client
 * reported the later one themselves.
 */
export function describeSequence(
  earlier: DatedUpdate, later: DatedUpdate,
): string | null {
  if (later.authorRole !== 'client') return null
  const a = new Date(earlier.at).getTime()
  const b = new Date(later.at).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return null
  return `Client reported "${later.statement}" after ${earlier.statement} began ` +
         `(${new Date(earlier.at).toISOString().slice(0, 10)} → ` +
         `${new Date(later.at).toISOString().slice(0, 10)}).`
}
