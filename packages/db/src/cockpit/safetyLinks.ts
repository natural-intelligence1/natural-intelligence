// ─── packages/db/src/cockpit/safetyLinks.ts ─────────────────────────────────
// Red-flag answer → NEEDS HUMAN REVIEW, and the stream linkage around it.
//
// ── ANNEX 1 IS NOT IN THIS REPOSITORY ───────────────────────────────────────
//
// The mission specifies Annex 1 wording and Rule 7 / Rule 9 / Rule 26
// behaviour. Neither Annex 1 nor those rules exist anywhere in the repo — the
// only reference is one line in docs/planning/connected-care-v4-delta-map.md
// saying "36 items on the current NI sheet map to Annex 1", pointing at an
// approved reply document held outside version control.
//
// So this module does NOT invent safety wording or rule identifiers.
// Fabricating clinical safety content would be the worst possible thing to
// invent here.
//
// What it DOES implement is the locked BEHAVIOUR from the brief, over the
// safety content that IS approved and present: the clinician-owned
// `safetyOptions` metadata on the approved registry questions, derived through
// the existing `deriveV2SafetyReviewItems` and recorded through the existing
// `safetyWorkflow`. Neither is reimplemented here.
//
// Every item carries `annexRuleId: null` and `annexStatus: 'awaiting_annex_1'`
// so the rule linkage drops in when Annex 1 arrives.
//
// ── TWO THINGS THE FOUNDER SHOULD KNOW ──────────────────────────────────────
//
// 1. The locked rule is "YES or NOT SURE on an approved red-flag question →
//    NEEDS HUMAN REVIEW". None of the three pilot red-flag questions is a
//    yes/no/not-sure question — all three are multi-select chip questions. The
//    rule is implemented in its general form: selecting an approved red-flag
//    value raises review, AND an uncertain answer to a question that carries
//    red flags raises review. The literal Yes/Not-sure shape lives at
//    `v2.mood.safety` (Mood & stress), outside the pilot domains.
//
// 2. `deriveV2SafetyReviewItems` matches `safetyOptions` only, so it does not
//    catch the uncertain-answer case. That is handled as a second, clearly
//    separated pass here, with `matchedOptions: []` because nothing matched —
//    which is the truthful value, not a workaround.

import {
  deriveV2SafetyReviewItems, type V2SafetyReviewItem,
} from '../intakeV2/synopsisMapping'
import {
  raiseSafetyItem, isOpen as workflowIsOpen, type SafetyReviewRecord,
} from '../intakeV2/safetyWorkflow'
import { pilotQuestionById, pilotRedFlagQuestions, type PilotSectionId } from './pilot'

export const ANNEX_1_STATUS = {
  present: false,
  whatIsMissing: ['Annex 1 approved wording', 'Rule 7', 'Rule 9', 'Rule 26'],
  onlyReferenceInRepo:
    'docs/planning/connected-care-v4-delta-map.md — "36 items on the current NI sheet map to Annex 1"',
  approvedContentUsedInstead:
    'safetyOptions metadata on the approved V2 registry questions — clinician-owned, already in the repo',
  consequence:
    'Red-flag BEHAVIOUR is implemented and demonstrable. Annex rule IDENTIFIERS and any Annex-specific ' +
    'wording are absent, and no substitute has been written. Every review item carries a null annexRuleId.',
} as const

/** Answers meaning "I do not know". Never read as "No". */
export const UNCERTAIN_VALUES = ['Not sure', 'Sometimes', 'Unsure', "Don't know"] as const
/** Answers meaning "I would rather not say". Not a No either. */
export const DECLINED_VALUES = ['Prefer not to say'] as const

export type RedFlagTriggerReason =
  | 'red_flag_value_selected'
  | 'uncertain_answer_to_red_flag_question'

export interface CockpitSafetyItem {
  id: string
  questionId: string
  section: PilotSectionId
  questionLabel: string
  /** The approved option values that matched, verbatim. Empty for an
   *  uncertain answer, because nothing matched. */
  matchedOptions: string[]
  /** Everything the client reported for that question, verbatim. */
  rawAnswer: string[]
  reason: RedFlagTriggerReason
  /** Asked ONCE, linked to every relevant stream. A list because the rule is
   *  one-to-many, even where the pilot yields one. */
  linkedSections: PilotSectionId[]
  /** The record from the existing workflow. Not reimplemented here. */
  record: SafetyReviewRecord
  annexRuleId: null
  annexStatus: 'awaiting_annex_1'
  /** Always false: follow-up detail never raises an item. Kept in the type so
   *  the rule is visible, not merely absent. */
  raisedByFollowUpDetail: false
}

export interface CockpitAnswerInput {
  questionId: string
  /** A chip list, or a single select value. */
  value: unknown
  capturedAt?: string
}

const asList = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(String) : typeof value === 'string' ? [value] : []

/** Does this one value trigger human review for this question? */
export function triggersHumanReview(questionId: string, value: string): RedFlagTriggerReason | null {
  const q = pilotQuestionById(questionId)
  if (!q) return null
  if ((q.safetyOptions ?? []).includes(value)) return 'red_flag_value_selected'
  const hasRedFlags = (q.safetyOptions?.length ?? 0) > 0
  if (hasRedFlags && (UNCERTAIN_VALUES as readonly string[]).includes(value)) {
    return 'uncertain_answer_to_red_flag_question'
  }
  return null
}

/**
 * Every section a red-flag question belongs to.
 *
 * Returns a LIST because a red-flag question is asked once and linked to every
 * relevant stream. In the pilot each sits in one section, but a caller that
 * assumed one would break the moment a shared red-flag question appears.
 */
export function linkedSectionsFor(questionId: string): PilotSectionId[] {
  const q = pilotQuestionById(questionId)
  return q ? [q.section as PilotSectionId] : []
}

function wrap(
  item: V2SafetyReviewItem, reason: RedFlagTriggerReason, caseId: string, at: string,
): CockpitSafetyItem | null {
  const q = pilotQuestionById(item.sourceQuestionId)
  if (!q) return null
  const id = `safety:${caseId}:${item.sourceQuestionId}`
  return {
    id,
    questionId: item.sourceQuestionId,
    section: q.section as PilotSectionId,
    questionLabel: item.questionLabel,
    matchedOptions: item.matchedOptions,
    rawAnswer: item.rawAnswer,
    reason,
    linkedSections: linkedSectionsFor(item.sourceQuestionId),
    record: raiseSafetyItem({ id, caseId, item, at }),
    annexRuleId: null,
    annexStatus: 'awaiting_annex_1',
    raisedByFollowUpDetail: false,
  }
}

/**
 * Derive the case's safety review items from captured answers.
 *
 * ONE ITEM PER QUESTION, carrying every matched red flag — which is what
 * "asked once" means in the record. Two passes:
 *
 *   1. the approved derivation, for red-flag values actually selected;
 *   2. an uncertainty pass, for "not sure" on a question that carries red
 *      flags, which the approved derivation does not cover.
 *
 * A question caught by pass 1 is never also raised by pass 2.
 */
export function deriveCockpitSafetyItems(args: {
  caseId: string
  answers: readonly CockpitAnswerInput[]
  at: string
}): CockpitSafetyItem[] {
  const pilotAnswers = args.answers.filter((a) => pilotQuestionById(a.questionId))

  const matched = deriveV2SafetyReviewItems(
    pilotAnswers.map((a) => ({ questionId: a.questionId, value: a.value, capturedAt: a.capturedAt })),
  )
  const out: CockpitSafetyItem[] = []
  const seen = new Set<string>()

  for (const item of matched) {
    const wrapped = wrap(item, 'red_flag_value_selected', args.caseId, args.at)
    if (wrapped) { out.push(wrapped); seen.add(item.sourceQuestionId) }
  }

  for (const a of pilotAnswers) {
    if (seen.has(a.questionId)) continue
    const q = pilotQuestionById(a.questionId)
    if (!q || (q.safetyOptions?.length ?? 0) === 0) continue
    const reported = asList(a.value)
    const uncertain = reported.filter((v) => (UNCERTAIN_VALUES as readonly string[]).includes(v))
    if (uncertain.length === 0) continue

    const wrapped = wrap(
      {
        sourceQuestionId: q.id,
        questionLabel: q.label,
        rawAnswer: reported,
        matchedOptions: [],   // nothing matched; this is the truthful value
        capturedAt: a.capturedAt ?? null,
        reviewStatus: 'unreviewed',
      },
      'uncertain_answer_to_red_flag_question', args.caseId, args.at,
    )
    if (wrapped) { out.push(wrapped); seen.add(q.id) }
  }

  return out
}

/**
 * Follow-up DETAIL captured inside a digging branch.
 *
 * Exists to make the locked rule visible: detail may be captured and does NOT
 * itself trigger review. There is no code path from a digging answer to a new
 * safety item, and this says so rather than leaving the absence implicit.
 */
export function raiseForFollowUpDetail(): CockpitSafetyItem[] {
  return []
}

// ── Case-level consolidation ────────────────────────────────────────────────

export interface SafetyConsolidation {
  open: CockpitSafetyItem[]
  closed: CockpitSafetyItem[]
  sectionsWithOpenItems: PilotSectionId[]
  anyOpen: boolean
  /** A view over items the streams raised. It cannot create, alter or close
   *  anything, which is what makes it a summary and not a questionnaire. */
  isReadOnlyView: true
}

export function consolidateSafety(items: readonly CockpitSafetyItem[]): SafetyConsolidation {
  const open = items.filter((i) => workflowIsOpen(i.record))
  return {
    open,
    closed: items.filter((i) => !workflowIsOpen(i.record)),
    sectionsWithOpenItems: [...new Set(open.flatMap((i) => i.linkedSections))],
    anyOpen: open.length > 0,
    isReadOnlyView: true,
  }
}

/** Open items raised in OTHER streams — what a section footer must show as
 *  case-wide rather than as blocking the current section. */
export function openItemsElsewhere(
  items: readonly CockpitSafetyItem[], current: PilotSectionId,
): CockpitSafetyItem[] {
  return consolidateSafety(items).open.filter((i) => !i.linkedSections.includes(current))
}

export function openItemsInSection(
  items: readonly CockpitSafetyItem[], current: PilotSectionId,
): CockpitSafetyItem[] {
  return consolidateSafety(items).open.filter((i) => i.linkedSections.includes(current))
}

/** Every approved red-flag value in the pilot, for the review-mode surface. */
export function pilotRedFlagInventory(): Array<{
  questionId: string; section: PilotSectionId; label: string; value: string; offersNotSure: boolean
}> {
  return pilotRedFlagQuestions().flatMap((q) =>
    q.redFlagValues.map((value) => ({
      questionId: q.questionId, section: q.section, label: q.label, value,
      offersNotSure: q.offersNotSure,
    })))
}

export { workflowIsOpen as isSafetyItemOpen }
