// ─── packages/db/src/cockpit/guidance.ts ────────────────────────────────────
// CONTEXTUAL PRACTITIONER GUIDE — the left pane.
//
// ── GUIDANCE NEVER ENTERS THE CLINICAL RECORD ───────────────────────────────
//
// This module returns `GuidancePanel`, which is a read-only view object. It
// has no identifier a capture function would accept, no provenance field and
// no value field. `capture.ts` takes question ids, target keys and values —
// nothing that this module produces can be passed to it. The separation is
// structural, not a convention to remember.
//
// ── IT SUPPORTS, IT DOES NOT COMPETE ────────────────────────────────────────
//
// Every block is short, and the whole panel is capped. A guide that fills the
// screen pulls the practitioner's attention away from the person in front of
// them, which is the failure this pane is most likely to cause.
//
// ── IT NEVER MAKES THE CLINICAL JUDGEMENT ───────────────────────────────────
//
// "How to ask" is phrasing help. "Explore" lists what the graph says is worth
// opening. "Don't miss" names approved red-flag questions not yet asked. None
// of it says what an answer means, how likely anything is, or what to do
// about it. The practitioner answers "what should I ask now?" — NI only makes
// the material easy to see.

import { buildCallSheet, type CallSheet } from '../intakeV2/callSheetBuilder'
import {
  PILOT_DIGGING_EDGES, edgesForQuestion, orderedTargets, targetKey,
} from './diggingEdges'
import {
  isBranchSufficient, outstandingTargets, type CaptureState,
} from './capture'
import { openItemsInSection, openItemsElsewhere, type CockpitSafetyItem } from './safetyLinks'
import {
  pilotQuestions, pilotQuestionById, pilotStreamTitle,
  PILOT_SECTION_IDS, type PilotSectionId,
} from './pilot'
import { mappingFor } from './mappingPack'

/** The approved blocks, in display order. */
export const GUIDANCE_BLOCKS = [
  'why_this_matters',
  'how_to_ask',
  'client_already_told_us',
  'explore',
  'dont_miss',
  'relevant_now_safety',
  'still_to_cover',
  'student_support',
] as const
export type GuidanceBlockId = (typeof GUIDANCE_BLOCKS)[number]

export const GUIDANCE_BLOCK_TITLES: Record<GuidanceBlockId, string> = {
  why_this_matters:        'Why this matters',
  how_to_ask:              'How to ask',
  client_already_told_us:  'Client already told us',
  explore:                 'Explore',
  dont_miss:               'Don’t miss',
  relevant_now_safety:     'Relevant now · safety screening',
  still_to_cover:          'Still to cover',
  student_support:         'Student support',
}

export interface GuidanceLine {
  text: string
  /** Where this line came from, so review mode can show provenance. */
  source: 'approved_question_metadata' | 'client_answer' | 'digging_graph' | 'ni_pilot_guidance'
  /** The question or edge this line is about, for review mode only. */
  ref?: string
}

export interface GuidanceBlock {
  id: GuidanceBlockId
  title: string
  lines: GuidanceLine[]
}

export interface GuidancePanel {
  section: PilotSectionId
  streamTitle: string
  /** The question the practitioner is on, where one is focused. */
  focusQuestionId: string | null
  blocks: GuidanceBlock[]
  /** Structural guarantee, asserted by a test: nothing here is capturable. */
  readonly isAdvisoryOnly: true
}

/** Per-question "why this matters". NI pilot guidance — procedural, never
 *  evaluative, and never a statement about what an answer means. */
const WHY_THIS_MATTERS: Record<string, string> = {
  'v2.digestion.noticed':
    'Digestion touches energy, mood, skin and sleep, so this answer often explains complaints the client came in about for other reasons.',
  'v2.digestion.bowel_frequency':
    'Frequency and form together describe a habit. One without the other is hard to interpret later.',
  'v2.digestion.stool_form':
    'A picture gets a more accurate answer than words, and gives you a consistent reference at the next review.',
  'v2.sleep.hours':
    'Hours slept sets the context for everything else in this stream. Ask before the detail, not after.',
  'v2.sleep.noticed':
    'How sleep is disturbed matters more than that it is disturbed — falling asleep, staying asleep and waking early are different pictures.',
  'v2.energy.noticed':
    'Energy, appetite and temperature move together often enough that asking them in one breath is worth it.',
}

/** Phrasing help. Opening a question well changes the answer you get. */
const HOW_TO_ASK: Record<string, string[]> = {
  'v2.digestion.noticed': [
    'Open wide before narrowing: “Tell me how your digestion has been.”',
    'Then read the list back as a prompt, rather than asking each item in turn.',
  ],
  'v2.digestion.bowel_frequency': [
    'Ask what is usual for them, not what they think ought to be usual.',
  ],
  'v2.digestion.stool_form': [
    'Hand over the chart and let them point. It is quicker and less awkward for both of you.',
  ],
  'v2.sleep.hours': [
    'Ask about a usual night, then ask whether weekends differ.',
  ],
  'v2.sleep.noticed': [
    'Ask them to walk you through last night, start to finish.',
  ],
  'v2.energy.noticed': [
    'Ask when in the day energy is at its worst — the pattern is more useful than a rating.',
  ],
}

const line = (
  text: string, source: GuidanceLine['source'], ref?: string,
): GuidanceLine => ({ text, source, ...(ref ? { ref } : {}) })

/** Short enough to support rather than compete. */
const MAX_LINES_PER_BLOCK = 4

function trim(lines: GuidanceLine[]): GuidanceLine[] {
  return lines.slice(0, MAX_LINES_PER_BLOCK)
}

/**
 * Build the guide for a section, optionally focused on one question.
 *
 * `callSheet` is accepted rather than built here so the cockpit reuses the
 * client's actual pre-consultation sheet where one exists, and shows nothing
 * in that block where one does not.
 */
export function buildGuidancePanel(args: {
  section: PilotSectionId
  focusQuestionId?: string | null
  state: CaptureState
  safetyItems?: readonly CockpitSafetyItem[]
  callSheet?: CallSheet | null
  isStudent?: boolean
}): GuidancePanel {
  const { section, state } = args
  const focus = args.focusQuestionId ?? null
  const safetyItems = args.safetyItems ?? []
  const blocks: GuidanceBlock[] = []

  const push = (id: GuidanceBlockId, lines: GuidanceLine[]) => {
    const kept = trim(lines)
    if (kept.length > 0) blocks.push({ id, title: GUIDANCE_BLOCK_TITLES[id], lines: kept })
  }

  // ── Why this matters / How to ask — only with a focused question.
  if (focus) {
    const why = WHY_THIS_MATTERS[focus]
    if (why) push('why_this_matters', [line(why, 'ni_pilot_guidance', focus)])

    const q = pilotQuestionById(focus)
    const howLines = [
      ...(HOW_TO_ASK[focus] ?? []).map((t) => line(t, 'ni_pilot_guidance', focus)),
      // The approved whyWeAsk copy, where the question carries it.
      ...(q?.whyWeAsk ? [line(`Client-facing wording: “${q.whyWeAsk}”`, 'approved_question_metadata', focus)] : []),
    ]
    push('how_to_ask', howLines)
  }

  // ── Client already told us — from the pre-consultation call sheet.
  if (args.callSheet) {
    const relevant = args.callSheet.sections
      .flatMap((s) => s.items)
      .filter((i) => !focus || i.sourceRef?.includes(section) || i.concernId)
      .slice(0, MAX_LINES_PER_BLOCK)
    push('client_already_told_us', relevant.map((i) =>
      line(i.clientWording ? `“${i.clientWording}”` : i.prompt, 'client_answer', i.id)))
  }

  // ── Explore — branches open and not yet sufficient.
  const exploreLines: GuidanceLine[] = []
  for (const b of Object.values(state.branches)) {
    if (b.section !== section) continue
    if (b.lifecycle === 'summary' || isBranchSufficient(b)) continue
    const edge = PILOT_DIGGING_EDGES.find((e) => e.id === b.edgeId)
    if (!edge) continue
    const next = outstandingTargets(b)[0]
    if (!next) continue
    exploreLines.push(line(
      next.target.practitionerPrompt
        ?? pilotQuestionById(next.target.targetQuestionId ?? '')?.label
        ?? 'Continue this line of questioning.',
      'digging_graph', b.edgeId,
    ))
  }
  // Branches a current answer would open but which have not been opened.
  if (focus) {
    const answered = state.answers[focus]
    if (!answered) {
      for (const edge of edgesForQuestion(focus)) {
        if (state.branches[edge.id]) continue
        exploreLines.push(line(
          `If they report “${edge.trigger.anyOf[0]}”, there is a line of questioning ready.`,
          'digging_graph', edge.id,
        ))
      }
    }
  }
  push('explore', exploreLines)

  // ── Don't miss — approved red-flag questions in THIS section not yet asked.
  const dontMiss = pilotQuestions(section)
    .filter((q) => (q.safetyOptions?.length ?? 0) > 0)
    .filter((q) => state.answers[q.id] === undefined)
    .map((q) => line(
      `Not yet asked: “${q.label}”. It carries approved safety screening.`,
      'approved_question_metadata', q.id,
    ))
  push('dont_miss', dontMiss)

  // ── Relevant now · safety screening — items raised in this section.
  const here = openItemsInSection(safetyItems, section)
  push('relevant_now_safety', here.map((i) => line(
    i.matchedOptions.length > 0
      ? `Reported: ${i.matchedOptions.join('; ')}. Awaiting human review.`
      : `Answered “not sure” to “${i.questionLabel}”. Awaiting human review.`,
    'approved_question_metadata', i.questionId,
  )))

  // ── Still to cover — this section, then elsewhere, clearly separated.
  const stillHere = pilotQuestions(section)
    .filter((q) => state.answers[q.id] === undefined)
    .filter((q) => (q.safetyOptions?.length ?? 0) === 0)
    .map((q) => line(`${q.label}`, 'approved_question_metadata', q.id))

  const elsewhereCount = openItemsElsewhere(safetyItems, section).length
  const elsewhereLines = elsewhereCount > 0
    ? [line(
        `${elsewhereCount} safety item(s) open in other streams. Not part of this section.`,
        'approved_question_metadata',
      )]
    : []
  push('still_to_cover', [...stillHere, ...elsewhereLines])

  // ── Student support.
  if (args.isStudent) {
    push('student_support', [
      line('Capture what the client says in their own words. You do not need to decide what it means.', 'ni_pilot_guidance'),
      line('Your entries are saved as drafts, attributed to you, and sent to your supervisor.', 'ni_pilot_guidance'),
      line('Ask the safety questions. You are not expected to close the review they raise.', 'ni_pilot_guidance'),
    ])
  }

  return {
    section,
    streamTitle: pilotStreamTitle(section),
    focusQuestionId: focus,
    blocks,
    isAdvisoryOnly: true,
  }
}

/** The four questions the acceptance test says a practitioner must always be
 *  able to answer, resolved from the current state. */
export interface PractitionerOrientation {
  whatShouldIAskNow: string | null
  whatShouldIExploreNext: string | null
  whatMustINotOverlook: string | null
  whatStillNeedsRecordingOrReview: string | null
}

export function orient(args: {
  section: PilotSectionId
  state: CaptureState
  safetyItems?: readonly CockpitSafetyItem[]
}): PractitionerOrientation {
  const { section, state } = args
  const safetyItems = args.safetyItems ?? []

  const nextUnanswered = pilotQuestions(section).find((q) => state.answers[q.id] === undefined)

  let exploreNext: string | null = null
  for (const b of Object.values(state.branches)) {
    if (b.section !== section || isBranchSufficient(b) || b.lifecycle === 'summary') continue
    const next = outstandingTargets(b)[0]
    if (next) {
      exploreNext = next.target.practitionerPrompt
        ?? pilotQuestionById(next.target.targetQuestionId ?? '')?.label
        ?? null
      break
    }
  }

  const unaskedRedFlag = pilotQuestions(section)
    .find((q) => (q.safetyOptions?.length ?? 0) > 0 && state.answers[q.id] === undefined)

  const openHere = openItemsInSection(safetyItems, section).length
  const openElse = openItemsElsewhere(safetyItems, section).length
  const blockedWrites = Object.values(state.answers)
    .filter((a) => a.section === section && a.canonicalWriteBlocked).length

  const needs: string[] = []
  if (openHere > 0) needs.push(`${openHere} safety item(s) here awaiting human review`)
  if (openElse > 0) needs.push(`${openElse} open elsewhere`)
  if (blockedWrites > 0) needs.push(`${blockedWrites} answer(s) held in session only — mapping not approved`)

  return {
    whatShouldIAskNow: nextUnanswered?.label ?? null,
    whatShouldIExploreNext: exploreNext,
    whatMustINotOverlook: unaskedRedFlag
      ? `“${unaskedRedFlag.label}” carries approved safety screening and has not been asked.`
      : null,
    whatStillNeedsRecordingOrReview: needs.length > 0 ? needs.join(' · ') : null,
  }
}

// ── Node details · review mode ──────────────────────────────────────────────

export interface NodeDetails {
  questionId: string
  conceptId: string | null
  fieldIds: string[]
  mappingStatus: string
  captureOwner: string | null
  provenanceRule: string | null
  /** Digging edges sourced from this question. */
  edges: Array<{ id: string; trigger: string[]; reviewStatus: string; safetyLinked: boolean; targets: number }>
  /** Approved red-flag values on this question, verbatim. */
  redFlagValues: string[]
  annexRuleId: null
  callSheetLinked: boolean
  samd: string
  /** True while the answer cannot reach a canonical field. */
  writeBlocked: boolean
  writeBlockReason: string | null
}

/**
 * The technical plumbing, for Founder/product/architecture inspection only.
 *
 * Nothing here is shown in normal practitioner mode — question ids, concept
 * ids, field paths, mapping statuses and edge internals all live behind this
 * one function, so hiding them is a matter of not calling it.
 */
export function nodeDetails(questionId: string, state?: CaptureState): NodeDetails | null {
  const q = pilotQuestionById(questionId)
  if (!q) return null
  const m = mappingFor(questionId)
  const captured = state?.answers[questionId]

  return {
    questionId,
    conceptId: m?.conceptId ?? null,
    fieldIds: m?.fieldIds ?? [],
    mappingStatus: m?.status ?? 'UNMAPPED',
    captureOwner: m?.captureOwner ?? null,
    provenanceRule: m?.provenance ?? null,
    edges: edgesForQuestion(questionId).map((e) => ({
      id: e.id,
      trigger: [...e.trigger.anyOf],
      reviewStatus: e.reviewStatus,
      safetyLinked: e.safetyLinked,
      targets: orderedTargets(e).length,
    })),
    redFlagValues: [...(q.safetyOptions ?? [])],
    annexRuleId: null,
    callSheetLinked: false,
    samd: q.samd,
    writeBlocked: captured ? captured.canonicalWriteBlocked : true,
    writeBlockReason: captured?.canonicalBlockReason ?? (m?.gap ?? null),
  }
}

/** Every target key for an edge, for review mode. */
export function edgeTargetKeys(edgeId: string): string[] {
  const edge = PILOT_DIGGING_EDGES.find((e) => e.id === edgeId)
  if (!edge) return []
  return orderedTargets(edge).map((t) => targetKey(edge, t))
}

export { PILOT_SECTION_IDS, buildCallSheet }
export type { CallSheet }
