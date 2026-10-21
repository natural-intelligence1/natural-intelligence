// ─── packages/db/src/cockpit/safetyLinks.ts ─────────────────────────────────
// Approved Annex 1 safety questions as EXPLICIT ASK-ONCE NODES.
//
// ── THE CORRECTION THIS FILE CARRIES ────────────────────────────────────────
//
// Previously the pilot derived red flags from the registry's `safetyOptions`
// chips. That proved the mechanics and was never the clinical authority. An
// approved Annex rule is now its own node: verbatim approved wording, a
// YES / NO / NOT SURE primary answer, and structured factual follow-up.
//
// A system multi-select may establish relevance, prevent a duplicate ask, or
// satisfy the fact where it genuinely answers it. It may never substitute
// different wording or semantics — see annex1.ts for the per-link reasoning.
//
// ONE FACT, MANY STREAMS. A node is answered once and linked to every stream
// Annex 1 names. Answering it in Digestion answers it everywhere.
//
// ── SAFETY SIGNALS WITHOUT A SUPPLIED ANNEX RULE ────────────────────────────
//
// Three pilot rules were supplied out of Annex 1's 37. Other registry
// `safetyOptions` values — "Difficulty swallowing", "A change in your usual
// bowel habit", "Night sweats that soak the bedding", "Swelling at the front
// of the neck" — have no supplied rule. They are NOT dropped: losing a safety
// signal is worse than carrying an unlabelled one. They still raise review,
// marked `annexStatus: 'rule_not_supplied_for_pilot'` so nobody mistakes them
// for approved Annex wording.

import {
  raiseSafetyItem, isOpen as workflowIsOpen, type SafetyReviewRecord,
} from '../intakeV2/safetyWorkflow'
import type { V2SafetyReviewItem } from '../intakeV2/synopsisMapping'
import {
  ANNEX_1_PILOT_RULES, ANNEX_FOLLOW_UPS, annexRuleById, annexRulesForSection,
  linkFromSelection, answerTriggersReview, rule26Threshold,
  type AnnexRule, type AnnexAnswer, type AnnexNotice, type WeightLossDetail,
  type ThresholdState,
} from './annex1'
import { pilotQuestionById, pilotRedFlagQuestions, type PilotSectionId } from './pilot'

export const ANNEX_1_STATUS = {
  present: true,
  source: 'NI Intake V4 — Clinical Validation Reply, 3 October 2026, Annex 1',
  validationStatus: 'CLOSED — APPROVED WITH AMENDMENTS',
  approvedRuleCount: 37,
  rulesSuppliedForPilot: [7, 9, 26],
  note:
    'Registry safetyOptions are NOT the clinical wording authority. They remain in use only as ' +
    'relevance signals, and for safety values whose Annex rule was not supplied for this pilot.',
} as const

/** Answers meaning "I do not know". Never read as "No". */
export const UNCERTAIN_VALUES = ['Not sure', 'Sometimes', 'Unsure', "Don't know"] as const
/** Answers meaning "I would rather not say". Not a No either. */
export const DECLINED_VALUES = ['Prefer not to say'] as const

export type RedFlagTriggerReason =
  /** The approved Annex question was answered YES (threshold met where one applies). */
  | 'annex_question_yes'
  /** The approved Annex question was answered NOT SURE. */
  | 'annex_question_not_sure'
  /** A system answer genuinely satisfied the approved question's YES. */
  | 'system_answer_satisfied_yes'
  /** A safety value with no Annex rule supplied for this pilot. */
  | 'safety_value_without_supplied_rule'

// ── The node ────────────────────────────────────────────────────────────────

export type SafetyNodeState =
  /** Not relevant yet, and not asked. */
  | 'dormant'
  /** A system answer made it relevant; the approved question is still unasked. */
  | 'relevant_unasked'
  /** Answered, by the approved question or by an equivalent system answer. */
  | 'answered'

export interface SafetyNodeAnswer {
  answer: AnnexAnswer
  at: string
  actorId: string
  actorDisplayName: string
  /** How the answer arrived. A system-satisfied YES is marked as such so the
   *  record never implies the approved question was read out when it was not. */
  via: 'approved_question' | 'system_answer_equivalent'
  /** The system option that satisfied it, where via is the second. */
  viaOptionValue?: string
  /** Structured follow-up, keyed by ANNEX_FOLLOW_UPS id. Detail only. */
  followUp?: Record<string, string>
  /** Rule 26 only. */
  weightLoss?: WeightLossDetail
}

export interface SafetyNode {
  /** Stable per case + rule. One fact, one node. */
  id: string
  ruleId: string
  ruleNumber: number
  topic: string
  /** The approved question, verbatim. What the practitioner reads out. */
  approvedQuestion: string
  notice: AnnexNotice
  /** Annex 1's stream names, verbatim. */
  annexStreams: string[]
  /** Pilot sections those streams fall within. Explicit translation. */
  linkedSections: PilotSectionId[]
  state: SafetyNodeState
  /** Why it became relevant, where it did. */
  relevanceReason: string | null
  answer: SafetyNodeAnswer | null
  /** For a quantified rule. 'unknown' is fail-closed and raises review. */
  threshold: ThresholdState | null
  /** True while this node needs a human. */
  needsHumanReview: boolean
  triggerReason: RedFlagTriggerReason | null
}

export interface CockpitAnswerInput {
  questionId: string
  value: unknown
  capturedAt?: string
}

const asList = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(String) : typeof v === 'string' ? [v] : []

function emptyNode(rule: AnnexRule, caseId: string): SafetyNode {
  return {
    id: `safety:${caseId}:${rule.id}`,
    ruleId: rule.id,
    ruleNumber: rule.ruleNumber,
    topic: rule.topic,
    approvedQuestion: rule.approvedQuestion,
    notice: rule.notice,
    annexStreams: [...rule.askedOnceIn],
    linkedSections: [...rule.pilotSections] as PilotSectionId[],
    state: 'dormant',
    relevanceReason: null,
    answer: null,
    threshold: rule.quantified ? 'unknown' : null,
    needsHumanReview: false,
    triggerReason: null,
  }
}

/**
 * Build every pilot safety node from the current answers.
 *
 * Pure and total: one node per supplied Annex rule, always, whatever has been
 * answered. A node that is dormant is still present, which is what lets the
 * guide say "not yet asked" rather than silently omitting it.
 */
export function buildSafetyNodes(args: {
  caseId: string
  answers: readonly CockpitAnswerInput[]
  /** Answers given directly to approved safety questions, keyed by rule id. */
  nodeAnswers?: Readonly<Record<string, SafetyNodeAnswer>>
}): SafetyNode[] {
  return ANNEX_1_PILOT_RULES.map((rule) => {
    const node = emptyNode(rule, args.caseId)
    const direct = args.nodeAnswers?.[rule.id]

    // 1. A direct answer to the approved question always wins.
    if (direct) {
      const threshold = rule.quantified ? rule26Threshold(direct.weightLoss) : null
      const triggers = answerTriggersReview(rule, direct.answer, direct.weightLoss)
      return {
        ...node,
        state: 'answered',
        answer: direct,
        threshold,
        needsHumanReview: triggers,
        triggerReason: triggers
          ? (direct.answer === 'NOT_SURE' ? 'annex_question_not_sure' : 'annex_question_yes')
          : null,
        relevanceReason: node.relevanceReason,
      }
    }

    // 2. Otherwise, see what the system answers do.
    for (const input of args.answers) {
      const selected = asList(input.value)
      const link = linkFromSelection(rule, input.questionId, selected)
      if (!link) continue

      if (link.kind === 'satisfies_yes') {
        const q = pilotQuestionById(input.questionId)
        return {
          ...node,
          state: 'answered',
          relevanceReason: `Reported “${link.optionValue}”`,
          answer: {
            answer: 'YES',
            at: input.capturedAt ?? new Date().toISOString(),
            actorId: 'system',
            actorDisplayName: 'Client selection',
            via: 'system_answer_equivalent',
            viaOptionValue: link.optionValue,
          },
          threshold: rule.quantified ? 'unknown' : null,
          needsHumanReview: true,
          triggerReason: 'system_answer_satisfied_yes',
          linkedSections: node.linkedSections.length > 0
            ? node.linkedSections
            : [q?.section as PilotSectionId].filter(Boolean),
        }
      }

      // establishes_relevance — the approved question must still be asked.
      node.state = 'relevant_unasked'
      node.relevanceReason = `Reported “${link.optionValue}”`
    }

    return node
  })
}

/** Nodes a practitioner still has to ask. */
export function unaskedRelevantNodes(nodes: readonly SafetyNode[]): SafetyNode[] {
  return nodes.filter((n) => n.state === 'relevant_unasked')
}

export function nodesForSection(nodes: readonly SafetyNode[], section: PilotSectionId): SafetyNode[] {
  return nodes.filter((n) => n.linkedSections.includes(section))
}

// ── Review items ────────────────────────────────────────────────────────────

export interface CockpitSafetyItem {
  id: string
  /** The Annex rule, where one backs this item. */
  annexRuleId: string | null
  annexRuleNumber: number | null
  annexStatus: 'approved_annex_1_rule' | 'rule_not_supplied_for_pilot'
  notice: AnnexNotice | null
  /** The approved question, verbatim, or the registry question's label where
   *  no Annex rule was supplied. */
  questionLabel: string
  /** The system question this came from, where it did. */
  questionId: string | null
  section: PilotSectionId
  /** Verbatim values that matched. */
  matchedOptions: string[]
  rawAnswer: string[]
  reason: RedFlagTriggerReason
  /** Asked once, linked to every relevant stream. */
  linkedSections: PilotSectionId[]
  annexStreams: string[]
  record: SafetyReviewRecord
  /** Always false: follow-up detail never raises an item. */
  raisedByFollowUpDetail: false
}

function recordFor(id: string, caseId: string, item: V2SafetyReviewItem, at: string): SafetyReviewRecord {
  return raiseSafetyItem({ id, caseId, item, at })
}

/**
 * Review items for a case.
 *
 * Two sources, both honest about what backs them:
 *   1. Annex-backed nodes that need a human;
 *   2. registry safety values with no supplied Annex rule, which still raise
 *      review but are labelled as not Annex-approved.
 */
export function deriveCockpitSafetyItems(args: {
  caseId: string
  answers: readonly CockpitAnswerInput[]
  at: string
  nodeAnswers?: Readonly<Record<string, SafetyNodeAnswer>>
}): CockpitSafetyItem[] {
  const out: CockpitSafetyItem[] = []
  const nodes = buildSafetyNodes(args)

  // 1. Annex-backed.
  for (const node of nodes) {
    if (!node.needsHumanReview) continue
    const rule = annexRuleById(node.ruleId)!
    const viaOption = node.answer?.viaOptionValue
    const item: V2SafetyReviewItem = {
      sourceQuestionId: node.ruleId,
      questionLabel: node.approvedQuestion,
      rawAnswer: viaOption ? [viaOption] : [node.answer?.answer ?? 'NOT_SURE'],
      matchedOptions: viaOption ? [viaOption] : [node.answer?.answer ?? 'NOT_SURE'],
      capturedAt: node.answer?.at ?? args.at,
      reviewStatus: 'unreviewed',
    }
    out.push({
      id: node.id,
      annexRuleId: rule.id,
      annexRuleNumber: rule.ruleNumber,
      annexStatus: 'approved_annex_1_rule',
      notice: rule.notice,
      questionLabel: node.approvedQuestion,
      questionId: null,
      section: node.linkedSections[0],
      matchedOptions: item.matchedOptions,
      rawAnswer: item.rawAnswer,
      reason: node.triggerReason!,
      linkedSections: node.linkedSections,
      annexStreams: node.annexStreams,
      record: recordFor(node.id, args.caseId, item, args.at),
      raisedByFollowUpDetail: false,
    })
  }

  // 2. Safety values with no supplied Annex rule. Carried, not dropped.
  const annexOwned = new Set(
    ANNEX_1_PILOT_RULES.flatMap((r) => r.systemAnswerLinks
      .filter((l) => l.kind === 'satisfies_yes')
      .map((l) => `${l.questionId}::${l.optionValue}`)),
  )

  for (const input of args.answers) {
    const q = pilotQuestionById(input.questionId)
    if (!q || (q.safetyOptions?.length ?? 0) === 0) continue
    const reported = asList(input.value)
    const matched = reported.filter((v) =>
      (q.safetyOptions ?? []).includes(v) && !annexOwned.has(`${q.id}::${v}`))
    const uncertain = reported.filter((v) => (UNCERTAIN_VALUES as readonly string[]).includes(v))
    const values = matched.length > 0 ? matched : uncertain
    if (values.length === 0) continue

    const id = `safety:${args.caseId}:${q.id}:unsupplied`
    const item: V2SafetyReviewItem = {
      sourceQuestionId: q.id,
      questionLabel: q.label,
      rawAnswer: reported,
      matchedOptions: matched,
      capturedAt: input.capturedAt ?? args.at,
      reviewStatus: 'unreviewed',
    }
    out.push({
      id,
      annexRuleId: null,
      annexRuleNumber: null,
      annexStatus: 'rule_not_supplied_for_pilot',
      notice: null,
      questionLabel: q.label,
      questionId: q.id,
      section: q.section as PilotSectionId,
      matchedOptions: matched,
      rawAnswer: reported,
      reason: 'safety_value_without_supplied_rule',
      linkedSections: [q.section as PilotSectionId],
      annexStreams: [],
      record: recordFor(id, args.caseId, item, args.at),
      raisedByFollowUpDetail: false,
    })
  }

  return out
}

/**
 * Follow-up DETAIL captured against a node.
 *
 * Exists to make the locked rule visible: detail may be captured and does NOT
 * itself raise anything. There is no code path from a follow-up answer to a
 * new item.
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
  /** Open items whose approved notice is NOW. Reported, never acted on. */
  noticeNowCount: number
  /** A view over what the streams raised. It cannot create, alter or close. */
  isReadOnlyView: true
}

export function consolidateSafety(items: readonly CockpitSafetyItem[]): SafetyConsolidation {
  const open = items.filter((i) => workflowIsOpen(i.record))
  return {
    open,
    closed: items.filter((i) => !workflowIsOpen(i.record)),
    sectionsWithOpenItems: [...new Set(open.flatMap((i) => i.linkedSections))],
    anyOpen: open.length > 0,
    noticeNowCount: open.filter((i) => i.notice === 'NOW').length,
    isReadOnlyView: true,
  }
}

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

/** Approved Annex questions in the pilot, for review mode. */
export function annexNodeInventory(): Array<{
  ruleId: string; ruleNumber: number; topic: string; approvedQuestion: string
  notice: AnnexNotice; annexStreams: string[]; pilotSections: string[]; quantified: boolean
}> {
  return ANNEX_1_PILOT_RULES.map((r) => ({
    ruleId: r.id, ruleNumber: r.ruleNumber, topic: r.topic,
    approvedQuestion: r.approvedQuestion, notice: r.notice,
    annexStreams: [...r.askedOnceIn], pilotSections: [...r.pilotSections],
    quantified: r.quantified,
  }))
}

/** Registry safety values still carried without a supplied Annex rule. */
export function unsuppliedSafetyValues(): Array<{
  questionId: string; section: PilotSectionId; value: string
}> {
  const annexOwned = new Set(
    ANNEX_1_PILOT_RULES.flatMap((r) => r.systemAnswerLinks
      .filter((l) => l.kind === 'satisfies_yes')
      .map((l) => `${l.questionId}::${l.optionValue}`)),
  )
  return pilotRedFlagQuestions().flatMap((q) =>
    q.redFlagValues
      .filter((v) => !annexOwned.has(`${q.questionId}::${v}`))
      .map((value) => ({ questionId: q.questionId, section: q.section, value })))
}

export { ANNEX_FOLLOW_UPS, annexRulesForSection, workflowIsOpen as isSafetyItemOpen }
export type { AnnexRule, AnnexAnswer, AnnexNotice, WeightLossDetail, ThresholdState }
