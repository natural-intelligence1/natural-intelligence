// ─── packages/db/src/intakeV2/callSheetBuilder.ts ────────────────────────────
// Assembles the practitioner Call Sheet for a case: the single page a
// practitioner reads before a consultation, listing what to ask and what to
// check, in a sensible order, with a source for every line.
//
// The digging trees themselves live in ./callSheet. This module only ASSEMBLES
// — it decides nothing. Four rules shape it, and each one is a test:
//
// 1. NI NEVER COMPOSES CLINICAL PROSE. Every prompt this builder emits is
//    taken verbatim from a fixed table: a tree prompt, a concern's derived
//    clarification prompt, or SAFETY_PROMPT applied to a verbatim question
//    label. The builder never writes a sentence of its own about a client.
//
// 2. CLIENT WORDING IS CARRIED, NOT PARAPHRASED. Where an item exists because
//    of something the client said, their words travel with it unchanged.
//
// 3. SAFETY ITEMS COME FIRST AND ARE NOT ADJUDICATED HERE. They sort to the
//    top so they cannot be buried, and their reviewStatus is passed through
//    untouched. Ranking urgency, assessing risk and deciding referral all stay
//    in the human layer (see V2_SAFETY_BOUNDARY_TEXT).
//
// 4. A PRACTITIONER ENTRY NEVER OVERWRITES A CLIENT ANSWER. A note or a
//    correction is recorded ALONGSIDE the original, with actor and time.
//
// A practitioner may of course reach clinical conclusions — that is their job,
// not NI's. Those conclusions carry practitioner-only provenance, which the
// factual synopsis builder already filters out. This module does not police
// what a clinician writes; it polices what NI generates.

import type { CallSheetPrompt, CallSheetTree, CallSheetEntry } from './callSheet'
import { callSheetTreesForAnswers } from './callSheet'
import type { ConcernCard, ClarificationItem } from './concerns'
import { CLARIFICATION_REASON_LABELS, deriveClarificationItems } from './concerns'
import type { V2SafetyReviewItem } from './synopsisMapping'

export const CALL_SHEET_BUILDER_VERSION = 'call-sheet.v1'

// ─── Sections, in consultation order ─────────────────────────────────────────

export const CALL_SHEET_SECTION_IDS = [
  'awaiting_safety_review',
  'client_concerns',
  'factual_gaps',
  'to_verify',
  'client_deferred',
  'practitioner_added',
] as const
export type CallSheetSectionId = (typeof CALL_SHEET_SECTION_IDS)[number]

export const CALL_SHEET_SECTION_TITLES: Record<CallSheetSectionId, string> = {
  awaiting_safety_review: 'Reported in intake, awaiting your review',
  client_concerns:        'What the client brought',
  factual_gaps:           'Not yet answered',
  to_verify:              'Worth verifying',
  client_deferred:        'Client preferred to discuss in person',
  practitioner_added:     'Added by you',
}

export const CALL_SHEET_ITEM_ORIGINS = [
  'client_selection', 'factual_gap', 'client_deferred',
  'unverified_record', 'inconsistency', 'safety_capture', 'practitioner_added',
] as const
export type CallSheetItemOrigin = (typeof CALL_SHEET_ITEM_ORIGINS)[number]

export interface CallSheetItem {
  id: string
  /** Verbatim from a fixed table. Never composed by NI about this client. */
  prompt: string
  origin: CallSheetItemOrigin
  /** Where to look, so the practitioner can reach the source record. */
  sourceRef?: string
  /** The client's own words, where the item exists because of them. */
  clientWording?: string
  concernId?: string | null
  /** True only where the source question was a clinician-enumerated capture. */
  safetyFollowUp?: boolean
}

export interface CallSheetSection {
  id: CallSheetSectionId
  title: string
  items: CallSheetItem[]
}

export interface CallSheet {
  caseId: string
  generatedAt: string
  builderVersion: string
  sections: CallSheetSection[]
  /** Total across sections — drives the "nothing to prepare" state. */
  count: number
  /** Trees surfaced by the client's selections, kept whole for drill-down. */
  trees: CallSheetTree[]
}

/** The ONLY sentence this module applies to a safety capture. Procedural, not
 *  evaluative: it says what to do next, never what the answer might mean. */
export const SAFETY_PROMPT =
  (questionLabel: string) =>
    `Reported in intake under “${questionLabel}” and not yet reviewed. ` +
    `Confirm with the client what they meant, then record your decision.`

/** Which clarification reasons belong in which section. */
const GAP_SECTION: Record<ClarificationItem['reason'], CallSheetSectionId> = {
  missing_factual_information:    'factual_gaps',
  inconsistency_needs_clarifying: 'to_verify',
  reported_result_unverified:     'to_verify',
  record_requires_verification:   'to_verify',
  client_preferred_to_discuss:    'client_deferred',
}

const GAP_ORIGIN: Record<ClarificationItem['reason'], CallSheetItemOrigin> = {
  missing_factual_information:    'factual_gap',
  inconsistency_needs_clarifying: 'inconsistency',
  reported_result_unverified:     'unverified_record',
  record_requires_verification:   'unverified_record',
  client_preferred_to_discuss:    'client_deferred',
}

export interface CallSheetInput {
  caseId: string
  /** Raw intake answers, used only to surface digging trees. */
  answers: Record<string, unknown>
  /** Concerns in the client's own order. Supplies wording and gaps. */
  concerns: ConcernCard[]
  /** Safety captures as derived by deriveV2SafetyReviewItems. Passed through. */
  safetyItems: V2SafetyReviewItem[]
  /** Items the practitioner put on the sheet themselves. */
  practitionerAdded?: CallSheetItem[]
  generatedAt: string
}

/**
 * Build the Call Sheet. Returns an empty-but-valid structure when there is
 * nothing to prepare, so the UI can say so plainly rather than render nothing.
 */
export function buildCallSheet(input: CallSheetInput): CallSheet {
  const { caseId, answers, concerns, safetyItems, generatedAt } = input

  // ── 1. Safety captures, first, unadjudicated ──
  const safety: CallSheetItem[] = safetyItems.map((item) => ({
    id: `safety:${item.sourceQuestionId}`,
    prompt: SAFETY_PROMPT(item.questionLabel),
    origin: 'safety_capture',
    sourceRef: item.sourceQuestionId,
    // Verbatim, complete — the matched subset is not substituted for the answer.
    clientWording: item.rawAnswer.join(', '),
    safetyFollowUp: true,
  }))

  // ── 2. What the client brought: digging trees for their selections ──
  const trees = callSheetTreesForAnswers(answers)
  const concernWording = new Map<string, string>()
  for (const concern of concerns) concernWording.set(concern.id, concern.ownWords.value)

  const treeItems: CallSheetItem[] = trees.flatMap((tree) =>
    tree.prompts.map((p: CallSheetPrompt) => ({
      id: `${tree.key}:${p.id}`,
      prompt: p.prompt,
      origin: 'client_selection' as CallSheetItemOrigin,
      sourceRef: tree.title,
      safetyFollowUp: p.safetyFollowUp,
    })),
  )

  // ── 3. Gaps, deferrals and things to verify, from the concerns ──
  // The section is decided from the clarification REASON while we still have
  // it; origin is derived from the same table but is never routed back from.
  const gapItems: { section: CallSheetSectionId; item: CallSheetItem }[] = []
  for (const concern of concerns) {
    const derived = concern.clarificationItems.length > 0
      ? concern.clarificationItems
      : deriveClarificationItems(concern, generatedAt)
    for (const item of derived) {
      gapItems.push({
        section: GAP_SECTION[item.reason],
        item: {
          id: item.id,
          prompt: item.prompt,
          origin: GAP_ORIGIN[item.reason],
          sourceRef: CLARIFICATION_REASON_LABELS[item.reason],
          clientWording: concernWording.get(concern.id),
          concernId: item.concernId,
        },
      })
    }
  }

  const bySection = (id: CallSheetSectionId) =>
    gapItems.filter((g) => g.section === id).map((g) => g.item)

  const sections: CallSheetSection[] = []
  const push = (id: CallSheetSectionId, items: CallSheetItem[]) => {
    if (items.length > 0) sections.push({ id, title: CALL_SHEET_SECTION_TITLES[id], items })
  }

  push('awaiting_safety_review', safety)
  push('client_concerns', treeItems)
  push('factual_gaps', bySection('factual_gaps'))
  push('to_verify', bySection('to_verify'))
  push('client_deferred', bySection('client_deferred'))
  push('practitioner_added', input.practitionerAdded ?? [])

  return {
    caseId,
    generatedAt,
    builderVersion: CALL_SHEET_BUILDER_VERSION,
    sections,
    count: sections.reduce((n, s) => n + s.items.length, 0),
    trees,
  }
}

// ─── Practitioner entries — alongside, never over ────────────────────────────

export type CallSheetEntryRefusal =
  | 'no_actor'
  | 'no_content'

export interface RecordEntryResult {
  entry: CallSheetEntry | null
  refusedReason?: CallSheetEntryRefusal
}

/**
 * Record a practitioner note and/or correction against a client answer. The
 * client's answer is returned untouched on the result; a correction sits in
 * its own field with the actor and time that produced it.
 *
 * Refuses rather than silently writing an unattributable record.
 */
export function recordCallSheetEntry(args: {
  questionId: string
  clientAnswer: unknown
  note?: string | null
  correction?: unknown
  missingInformation?: string | null
  actor: string | null
  recordedAt: string
}): RecordEntryResult {
  const { questionId, clientAnswer, actor, recordedAt } = args
  const note = args.note ?? null
  const hasCorrection = Object.prototype.hasOwnProperty.call(args, 'correction')
    && args.correction !== undefined
  const missingInformation = args.missingInformation ?? null

  if (!actor) return { entry: null, refusedReason: 'no_actor' }
  if (!note && !hasCorrection && !missingInformation) {
    return { entry: null, refusedReason: 'no_content' }
  }

  return {
    entry: {
      questionId,
      clientAnswer,                                   // identity-preserved
      practitionerNote: note,
      practitionerCorrection: hasCorrection ? args.correction : null,
      verificationStatus: hasCorrection
        ? 'practitioner_corrected'
        : note || missingInformation ? 'practitioner_verified' : 'client_reported',
      missingInformation,
      actor,
      recordedAt,
    },
  }
}

/** Every item on the sheet, in section order. */
export function allCallSheetItems(sheet: CallSheet): CallSheetItem[] {
  return sheet.sections.flatMap((s) => s.items)
}
