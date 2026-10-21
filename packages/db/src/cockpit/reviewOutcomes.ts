// ─── packages/db/src/cockpit/reviewOutcomes.ts ──────────────────────────────
// The approved V4 human-review outcomes.
//
// LOCKED PRODUCT DESIGN (UI handover §0). The list, its wording and its order
// are approved; this module does not invent, extend or reorder them.
//
// ── WHAT NI DOES NOT DO HERE ────────────────────────────────────────────────
//
// Nothing is pre-selected. Nothing is recommended. No outcome is scored,
// ranked, or inferred from the answer that raised the item. NI shows the
// approved list and records what a named human chose — that is the whole of
// its part. There is deliberately no function that takes a safety item and
// returns a suggested outcome.
//
// ── QUEUE STATE IS NOT OUTCOME ──────────────────────────────────────────────
//
// `unassigned / assigned / acknowledged / resolved` are WORKFLOW states and
// live in the existing safetyWorkflow audit trail. They are not outcomes and
// must never appear in the outcome list. NEEDS HUMAN REVIEW is the only
// clinical review label shown in the product.

export const V4_REVIEW_OUTCOMES = [
  'prompt_clinical_review',
  'routine_practitioner_review',
  'safeguarding_action',
  'needs_human_contact_for_more_information',
  'no_further_action_required',
] as const
export type V4ReviewOutcome = (typeof V4_REVIEW_OUTCOMES)[number]

/** Approved labels, verbatim. */
export const V4_REVIEW_OUTCOME_LABELS: Record<V4ReviewOutcome, string> = {
  prompt_clinical_review:                   'Prompt clinical review',
  routine_practitioner_review:              'Routine practitioner review',
  safeguarding_action:                      'Safeguarding action',
  needs_human_contact_for_more_information: 'Needs human contact for more information',
  no_further_action_required:               'No further action required',
}

export function isV4ReviewOutcome(value: string): value is V4ReviewOutcome {
  return (V4_REVIEW_OUTCOMES as readonly string[]).includes(value)
}

/** Nothing is pre-selected. Stated as a value so a test can assert it. */
export const DEFAULT_REVIEW_OUTCOME: null = null

export interface RecordedOutcome {
  outcome: V4ReviewOutcome
  /** What was actually done, in the reviewer's own words. */
  actionTaken: string
  reviewerId: string
  reviewerDisplayName: string
  at: string
}

export type RecordOutcomeResult =
  | { ok: true; recorded: RecordedOutcome }
  | { ok: false; reason: 'no_outcome_selected' | 'unknown_outcome' | 'no_reviewer' | 'not_permitted' }

/**
 * Record a human review outcome.
 *
 * Refuses rather than defaults on every missing piece. An outcome without a
 * named human is not a review, and a blank one chosen by the UI would be NI
 * making the clinical decision.
 *
 * `canClose` is passed in rather than decided here — a student may capture a
 * safety answer and may not close the item, and that boundary belongs to
 * studentMode.ts, not to this module.
 */
export function recordReviewOutcome(args: {
  outcome: string | null
  actionTaken?: string
  reviewerId: string
  reviewerDisplayName: string
  at: string
  canClose: boolean
}): RecordOutcomeResult {
  if (!args.canClose) return { ok: false, reason: 'not_permitted' }
  if (args.outcome === null || args.outcome === '') return { ok: false, reason: 'no_outcome_selected' }
  if (!isV4ReviewOutcome(args.outcome)) return { ok: false, reason: 'unknown_outcome' }
  if (!args.reviewerId || !args.reviewerDisplayName.trim()) return { ok: false, reason: 'no_reviewer' }

  return {
    ok: true,
    recorded: {
      outcome: args.outcome,
      // Optional on the board, so an empty string is a legitimate record of
      // "no action beyond the outcome itself" rather than a missing field.
      actionTaken: (args.actionTaken ?? '').trim(),
      reviewerId: args.reviewerId,
      reviewerDisplayName: args.reviewerDisplayName,
      at: args.at,
    },
  }
}
