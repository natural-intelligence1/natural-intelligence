// ─── packages/db/src/cockpit/annex1.ts ──────────────────────────────────────
// ANNEX 1 — the authoritative clinical safety source for the pilot.
//
//   NI Intake V4 — Clinical Validation Reply, 3 October 2026, Annex 1
//   Clinical validation: CLOSED — APPROVED WITH AMENDMENTS
//   37 approved NI-authored red-flag rules; three supplied for this pilot.
//
// ── WHAT CHANGED, AND WHY IT MATTERED ───────────────────────────────────────
//
// The pilot previously derived red flags from the registry's `safetyOptions`
// metadata. That was acceptable for proving mechanics and is NOT the clinical
// wording authority. The correction: an approved Annex rule is an EXPLICIT
// SAFETY QUESTION NODE with its own verbatim wording and a YES / NO / NOT SURE
// answer — never a chip hidden inside an unrelated symptom multi-select.
//
// The difference is not cosmetic. Rule 7 asks about blood "in or on your
// stools, or when you wipe". The chip it was riding on says only "Blood in the
// stool". A client who bleeds only on wiping answers the chip NO and the
// approved question YES, and the old model would have recorded a NO that the
// client never gave.
//
// ── ASK ONCE ────────────────────────────────────────────────────────────────
//
// One underlying safety FACT, linked to every relevant stream. Not: hide the
// question inside one stream's symptom list. The fact is asked once, carries
// one answer, and surfaces wherever it is relevant.
//
// ── WHAT AN EXISTING SYSTEM ANSWER MAY AND MAY NOT DO ───────────────────────
//
// It may establish relevance, prevent duplicate asking, and satisfy the fact
// where it genuinely answers it equivalently. It may never substitute
// different wording or semantics. Each link below states which, and why.
//
// The asymmetry worth noticing: an affirmative chip can satisfy a YES, because
// a narrower positive is still a positive. NOT selecting a chip can NEVER
// satisfy a NO, because the client was never asked the broader question.
// `absenceCanSatisfyNo` is false everywhere and there is no code path to set it.

export const ANNEX_1_SOURCE = {
  document: 'NI Intake V4 — Clinical Validation Reply',
  date: '2026-10-03',
  annex: 'Annex 1',
  validationStatus: 'CLOSED — APPROVED WITH AMENDMENTS',
  approvedRuleCount: 37,
  rulesSuppliedForPilot: [7, 9, 26],
  present: true,
} as const

/** The primary answer to an approved safety question. */
export const ANNEX_ANSWERS = ['YES', 'NO', 'NOT_SURE'] as const
export type AnnexAnswer = (typeof ANNEX_ANSWERS)[number]

/** How soon the approved notice applies. Carried verbatim; NI does not act
 *  on it, rank it, or convert it into urgency advice for the client. */
export type AnnexNotice = 'NOW' | 'END'

export interface AnnexFollowUp {
  id: string
  prompt: string
  /** Where applicable to the rule. Detail NEVER triggers review by itself. */
  appliesTo: 'all' | 'quantified_only'
}

/**
 * The follow-up detail captured for every red-flag YES / NOT SURE, where
 * applicable. Approved as a set, not per rule.
 *
 * NONE OF THESE TRIGGERS REVIEW. They are captured because a reviewing human
 * will want them; the review is already open by the time they are asked.
 */
export const ANNEX_FOLLOW_UPS: readonly AnnexFollowUp[] = Object.freeze([
  { id: 'started',    prompt: 'When did it start?', appliesTo: 'all' },
  { id: 'frequency',  prompt: 'How often?', appliesTo: 'all' },
  { id: 'ongoing',    prompt: 'Is it still happening?', appliesTo: 'all' },
  { id: 'gp_seen',    prompt: 'Have you seen a GP, or had tests? When?', appliesTo: 'all' },
  { id: 'associated', prompt: 'Any associated pain or discomfort?', appliesTo: 'all' },
])

/** How an existing system answer relates to an approved safety question. */
export type SystemAnswerLinkKind =
  /** The system answer genuinely answers the approved question's YES. A
   *  narrower positive is still a positive. */
  | 'satisfies_yes'
  /** The system answer makes the rule relevant but does not answer it. The
   *  approved question must still be asked. */
  | 'establishes_relevance'

export interface SystemAnswerLink {
  questionId: string
  /** The approved option value, verbatim from the registry. */
  optionValue: string
  kind: SystemAnswerLinkKind
  /** Why this link is what it is. Required — a link without a reason is a
   *  guess, and a guess here loses or invents a safety fact. */
  rationale: string
}

export interface AnnexRule {
  /** Stable id used everywhere a rule is referenced. */
  id: string
  ruleNumber: number
  /** Annex 1's own domain heading, verbatim. */
  annexDomain: string
  topic: string
  /** The approved question. VERBATIM. Never re-worded, never paraphrased,
   *  never replaced by a system question's label. */
  approvedQuestion: string
  /** The approved trigger, in Annex 1's own words. */
  triggerDescription: string
  /** Answers that put the fact in front of a human. */
  triggersReviewOn: readonly AnnexAnswer[]
  /** True where a YES alone is not sufficient and a threshold applies. */
  quantified: boolean
  /** Annex 1's stream names, verbatim. These are NOT pilot section ids. */
  askedOnceIn: readonly string[]
  /** The pilot sections those streams fall within. An explicit translation,
   *  not a synonym rule. */
  pilotSections: readonly string[]
  notice: AnnexNotice
  /** Existing system answers and what each may do. */
  systemAnswerLinks: readonly SystemAnswerLink[]
  /** Structural guarantee: not selecting a chip never answers NO. */
  absenceCanSatisfyNo: false
}

export const ANNEX_1_PILOT_RULES: readonly AnnexRule[] = Object.freeze([
  {
    id: 'annex1.rule7',
    ruleNumber: 7,
    annexDomain: 'DIGESTION',
    topic: 'Any rectal bleeding (adult)',
    approvedQuestion: 'Have you noticed blood in or on your stools, or when you wipe?',
    triggerDescription: 'YES',
    triggersReviewOn: ['YES', 'NOT_SURE'],
    quantified: false,
    askedOnceIn: ['GIT: Diarrhoea', 'GIT: Mucus/blood', 'GIT: Frequency/stool'],
    pilotSections: ['digestion'],
    notice: 'END',
    systemAnswerLinks: [
      {
        questionId: 'v2.digestion.noticed',
        optionValue: 'Blood in the stool',
        kind: 'satisfies_yes',
        rationale:
          'Reporting blood in the stool IS blood in or on the stools. The approved question is ' +
          'broader (it also covers blood on wiping), but a narrower positive still answers YES. ' +
          'Its ABSENCE answers nothing, because wiping was never asked about.',
      },
      {
        questionId: 'v2.digestion.noticed',
        optionValue: 'Mucus in the stool',
        kind: 'establishes_relevance',
        rationale:
          'Mucus is not blood. It puts the client in the GIT: Mucus/blood stream where Rule 7 is ' +
          'asked, and nothing more.',
      },
    ],
    absenceCanSatisfyNo: false,
  },
  {
    id: 'annex1.rule9',
    ruleNumber: 9,
    annexDomain: 'DIGESTION',
    topic: 'Black, tarry stools; vomiting blood or coffee-ground material',
    approvedQuestion:
      'Have your stools been black and sticky like tar, or have you vomited blood or something like coffee grounds?',
    triggerDescription: 'YES TO EITHER',
    triggersReviewOn: ['YES', 'NOT_SURE'],
    quantified: false,
    askedOnceIn: ['GIT: Diarrhoea', 'GIT: Nausea/vomiting', 'GIT: Mucus/blood'],
    pilotSections: ['digestion'],
    notice: 'NOW',
    systemAnswerLinks: [
      {
        questionId: 'v2.digestion.noticed',
        optionValue: 'Black, tar-like stool',
        kind: 'satisfies_yes',
        rationale:
          'This is the first limb of the approved question, in the client\'s own selection. YES to ' +
          'either limb is the trigger, so one limb answered affirmatively answers the question.',
      },
      {
        questionId: 'v2.digestion.noticed',
        optionValue: 'Vomiting',
        kind: 'establishes_relevance',
        rationale:
          'Vomiting is NOT vomiting blood or coffee-ground material. Treating it as the second ' +
          'limb would invent a report the client did not make. It establishes relevance only.',
      },
    ],
    absenceCanSatisfyNo: false,
  },
  {
    id: 'annex1.rule26',
    ruleNumber: 26,
    annexDomain: 'URINARY & METABOLIC',
    topic: 'Unexplained weight loss',
    approvedQuestion: 'Have you lost weight without trying? How much, and over how long?',
    triggerDescription:
      'Unintentional loss AND either 5% or more over 6–12 months, or noticeable unexplained loss over weeks',
    triggersReviewOn: ['YES', 'NOT_SURE'],
    quantified: true,
    askedOnceIn: ['Endocrine: Weight', 'Endocrine: Fatigue', 'Endocrine: Frequent urination'],
    pilotSections: ['energy_metabolic'],
    notice: 'END',
    systemAnswerLinks: [
      {
        questionId: 'v2.energy.noticed',
        optionValue: 'Weight going down without trying',
        kind: 'establishes_relevance',
        rationale:
          'Deliberately NOT satisfies_yes. The approved trigger needs a quantity and a timeframe, ' +
          'and the chip carries neither. Treating it as a YES would either raise a review the ' +
          'threshold does not support, or record a trigger NI cannot evidence.',
      },
    ],
    absenceCanSatisfyNo: false,
  },
] as const)

export function annexRuleById(id: string): AnnexRule | undefined {
  return ANNEX_1_PILOT_RULES.find((r) => r.id === id)
}

export function annexRulesForSection(section: string): AnnexRule[] {
  return ANNEX_1_PILOT_RULES.filter((r) => r.pilotSections.includes(section))
}

/** Every rule a given system question can touch, by any link kind. */
export function annexRulesLinkedToQuestion(questionId: string): AnnexRule[] {
  return ANNEX_1_PILOT_RULES.filter((r) =>
    r.systemAnswerLinks.some((l) => l.questionId === questionId))
}

/**
 * What a set of selected option values does to a rule.
 *
 * Returns the strongest link the selection reaches. Absence returns null —
 * never a NO.
 */
export function linkFromSelection(
  rule: AnnexRule, questionId: string, selected: readonly string[],
): SystemAnswerLink | null {
  const links = rule.systemAnswerLinks.filter(
    (l) => l.questionId === questionId && selected.includes(l.optionValue))
  return links.find((l) => l.kind === 'satisfies_yes') ?? links[0] ?? null
}

// ── Rule 26's quantified trigger ────────────────────────────────────────────

export type ThresholdState = 'met' | 'not_met' | 'unknown'

export interface WeightLossDetail {
  /** Percentage of body weight lost, where the client can say. */
  percentLost?: number | null
  /** Over how many months. */
  overMonths?: number | null
  /** The client describes it as noticeable and unexplained over weeks. */
  noticeableOverWeeks?: boolean | null
}

/**
 * Does Rule 26's threshold hold?
 *
 * FAIL-CLOSED on uncertainty: where the client reports unintentional loss but
 * cannot give a quantity or timeframe, this returns 'unknown' and the caller
 * raises review. NI cannot rule a threshold out on absent information, and
 * recording "threshold not met" from silence would be exactly that.
 *
 * ONLY a quantity that is genuinely below the approved threshold returns
 * 'not_met'.
 */
export function rule26Threshold(detail: WeightLossDetail | null | undefined): ThresholdState {
  if (!detail) return 'unknown'
  if (detail.noticeableOverWeeks === true) return 'met'

  const pct = detail.percentLost
  const months = detail.overMonths
  if (typeof pct === 'number' && typeof months === 'number') {
    if (pct >= 5 && months >= 6 && months <= 12) return 'met'
    // Below 5% across the approved window, with both figures given, is the
    // one case the Annex trigger does not reach.
    if (pct < 5 && months >= 6 && months <= 12) {
      return detail.noticeableOverWeeks === false ? 'not_met' : 'unknown'
    }
    // Outside the 6–12 month window the percentage limb does not apply, and
    // the "over weeks" limb has not been answered.
    return detail.noticeableOverWeeks === false ? 'not_met' : 'unknown'
  }
  return 'unknown'
}

/**
 * Does this answer put the fact in front of a human?
 *
 * NOT SURE always does. YES does, except on a quantified rule where the
 * approved threshold is genuinely not met.
 */
export function answerTriggersReview(
  rule: AnnexRule, answer: AnnexAnswer, detail?: WeightLossDetail | null,
): boolean {
  if (answer === 'NOT_SURE') return true
  if (answer !== 'YES') return false
  if (!rule.quantified) return true
  return rule26Threshold(detail) !== 'not_met'
}

export interface AnnexSummary {
  source: typeof ANNEX_1_SOURCE
  rulesInPilot: number
  byNotice: Record<AnnexNotice, number>
  quantifiedRules: string[]
  /** Streams named by Annex 1, verbatim. */
  annexStreams: string[]
  totalFollowUps: number
}

export function summariseAnnex(): AnnexSummary {
  return {
    source: ANNEX_1_SOURCE,
    rulesInPilot: ANNEX_1_PILOT_RULES.length,
    byNotice: {
      NOW: ANNEX_1_PILOT_RULES.filter((r) => r.notice === 'NOW').length,
      END: ANNEX_1_PILOT_RULES.filter((r) => r.notice === 'END').length,
    },
    quantifiedRules: ANNEX_1_PILOT_RULES.filter((r) => r.quantified).map((r) => r.id),
    annexStreams: [...new Set(ANNEX_1_PILOT_RULES.flatMap((r) => [...r.askedOnceIn]))],
    totalFollowUps: ANNEX_FOLLOW_UPS.length,
  }
}
