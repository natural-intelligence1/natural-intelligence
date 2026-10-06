// ─── packages/db/src/intakeV2/concerns.ts ────────────────────────────────────
// The Concern Card — the connective hub of the record.
//
// One concern object carries the client's wording and LINKS to everything
// related to it: timeline entries, influences, evidence, clarification items.
// It deliberately holds references rather than copies, so a fact lives in one
// place and cannot drift between modules.
//
// Everything on the card is factual or client-expressed. There is no severity,
// no priority, no ranking and no clinical label — a concern is what the client
// brought, not what anyone concluded about it.

import type { V2SourcedFact } from './provenance'
import type { InfluenceRecord } from './influences'

/** A text fact that may legitimately be absent. `null` carries an absence
 *  state — `missing`, `not_asked` or `declined` — never a negative answer. */
export type TextFact = V2SourcedFact<string | null>

export interface ConcernCard {
  id: string
  /** The client's own words. The heading everything else hangs from. */
  ownWords: V2SourcedFact<string>
  /** A short neutral label for lists. NI-organised, never diagnostic. */
  label: V2SourcedFact<string>
  /** What the client said better would look like. */
  desiredImprovement?: TextFact
  onset?: TextFact
  course?: TextFact
  pattern?: TextFact
  /** How it affects daily life, in the client's terms. */
  impact?: TextFact
  /** Body-system areas the client indicated as relevant — under CONSIDERATION
   *  only. This is never promoted to "systems under stress", which stays
   *  practitioner-authored. */
  relevantStreams: string[]
  /** References, not copies. */
  timelineEntryIds: string[]
  influenceIds: string[]
  evidenceIds: string[]
  /** What the client already tried, and any previous assessment or care. */
  whatHelps?: TextFact
  alreadyTried?: TextFact
  previousCare?: TextFact
  /** Gaps for a human to ask about. Feeds the Call Sheet; never a diagnosis. */
  clarificationItems: ClarificationItem[]
  capturedAt: string
}

export const CLARIFICATION_REASONS = [
  'missing_factual_information',
  'inconsistency_needs_clarifying',
  'reported_result_unverified',
  'client_preferred_to_discuss',
  'record_requires_verification',
] as const
export type ClarificationReason = (typeof CLARIFICATION_REASONS)[number]

export const CLARIFICATION_REASON_LABELS: Record<ClarificationReason, string> = {
  missing_factual_information:   'Not yet answered',
  inconsistency_needs_clarifying:'Two answers do not line up',
  reported_result_unverified:    'Reported result not yet seen',
  client_preferred_to_discuss:   'Client preferred to discuss in person',
  record_requires_verification:  'Record needs verifying',
}

export interface ClarificationItem {
  id: string
  concernId: string | null
  reason: ClarificationReason
  /** Plain factual prompt — "what", never "why" or "likely". */
  prompt: string
  /** The field or question this gap relates to, when there is one. */
  fieldRef?: string
  createdAt: string
}

/** Concerns in the order the client gave them. NI does not reorder by
 *  apparent importance — that would be a clinical judgement. */
export function concernsInClientOrder(concerns: ConcernCard[]): ConcernCard[] {
  return [...concerns].sort(
    (a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime(),
  )
}

/** Influences attached to a concern, resolved from the shared pool. */
export function influencesForConcern(
  concern: ConcernCard, allInfluences: InfluenceRecord[],
): InfluenceRecord[] {
  return allInfluences.filter(
    (i) => concern.influenceIds.includes(i.id) || i.concernId === concern.id,
  )
}

/** Every open clarification item across the record, for the Call Sheet. */
export function allClarificationItems(concerns: ConcernCard[]): ClarificationItem[] {
  return concerns.flatMap((c) => c.clarificationItems)
}

/**
 * Derive clarification items from the state of a concern. Purely structural:
 * it notices absence and deferral, never significance. A missing answer
 * produces "not yet answered" — never "may indicate".
 */
export function deriveClarificationItems(
  concern: ConcernCard, now: string,
): ClarificationItem[] {
  const items: ClarificationItem[] = []
  const add = (reason: ClarificationReason, prompt: string, fieldRef?: string) => {
    items.push({
      id: `${concern.id}:${reason}:${fieldRef ?? items.length}`,
      concernId: concern.id, reason, prompt, fieldRef, createdAt: now,
    })
  }

  const factualGaps: [keyof ConcernCard, string, string][] = [
    ['onset',   'When did this start?',                 'onset'],
    ['course',  'Has it changed since it began?',       'course'],
    ['pattern', 'Is there a pattern to when it happens?', 'pattern'],
    ['impact',  'How does it affect day-to-day life?',  'impact'],
  ]
  for (const [key, prompt, ref] of factualGaps) {
    const fact = concern[key] as TextFact | undefined
    if (!fact || fact.provenance === 'missing' || fact.provenance === 'not_asked') {
      add('missing_factual_information', prompt, ref)
    } else if (fact.provenance === 'declined') {
      add('client_preferred_to_discuss', prompt, ref)
    }
  }
  return items
}
