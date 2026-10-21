// ─── packages/db/src/cockpit/sectionStatus.ts ───────────────────────────────
// THIS SECTION versus CASE-WIDE SAFETY.
//
// The distinction this file exists to protect: a requirement belonging to
// another stream must never look like it is blocking the section in front of
// the practitioner. Conflating the two produces a footer that is permanently
// red, which trains people to ignore it — the opposite of a safety feature.
//
// So the two are returned as separate objects with separate language, and the
// only thing that can block FINISHING A SECTION is something in that section.
// Case-wide safety never blocks a section and never stops being visible.
//
// FINISHING A SECTION NEVER CLOSES A HUMAN-REVIEW ITEM. `finishSection` below
// cannot touch a safety record — it has no access to one — and the label it
// returns says so.

import {
  isBranchSufficient, unfinishedBranches, branchesNeedingReconciliation,
  type CaptureState,
} from './capture'
import { consolidateSafety, openItemsElsewhere, openItemsInSection, type CockpitSafetyItem } from './safetyLinks'
import { pilotQuestions, type PilotSectionId } from './pilot'

/** The wording for the finish control. Must not imply review is closed. */
export const FINISH_SECTION_LABEL = 'Finish section · review remains open'
export const FINISH_SECTION_LABEL_CLEAR = 'Finish section'

export interface SectionStatus {
  section: PilotSectionId
  /** Required questions in this section with no answer. NOT treated as "No". */
  mandatoryUnanswered: string[]
  /** Branches opened in this section that are not factually sufficient. */
  unfinishedDigging: string[]
  /** Branches in this section flagged after a triggering answer changed. */
  needsReconciliation: string[]
  /** Open safety items raised in THIS section. Visible here, but they do not
   *  block finishing — a human review is not the practitioner's to complete
   *  by filling in a form. */
  openSafetyInThisSection: number
  /** True when nothing in this section is outstanding. */
  clear: boolean
}

export interface CaseWideSafetyStatus {
  /** Open items raised in other streams. Shown, never blocking. */
  openElsewhere: number
  /** Sections other than the current one holding open items. */
  sectionsElsewhere: PilotSectionId[]
  /** Pilot sections with a red-flag question that has not been asked at all.
   *  "Unasked" is a real state, distinct from "asked and answered No". */
  unaskedSafetyElsewhere: Array<{ section: PilotSectionId; questionId: string }>
  /** Items with a decision recorded but not yet resolved. */
  decidedNotResolved: number
  anyOpenAnywhere: boolean
}

/**
 * Status of the section in front of the practitioner.
 *
 * `mandatoryUnanswered` lists questions with NO recorded answer. An answer of
 * "No", a recorded `declined` and a recorded `not_asked` are all answers and
 * none of them appears here — absence of a record is the only thing that does.
 */
export function sectionStatus(
  state: CaptureState,
  section: PilotSectionId,
  safetyItems: readonly CockpitSafetyItem[] = [],
): SectionStatus {
  const mandatoryUnanswered = pilotQuestions(section)
    .filter((q) => q.required === true)
    .filter((q) => state.answers[q.id] === undefined)
    .map((q) => q.id)

  const unfinishedDigging = unfinishedBranches(state, section).map((b) => b.edgeId)
  const needsReconciliation = branchesNeedingReconciliation(state, section).map((b) => b.edgeId)
  const openSafetyInThisSection = openItemsInSection(safetyItems, section).length

  return {
    section,
    mandatoryUnanswered,
    unfinishedDigging,
    needsReconciliation,
    openSafetyInThisSection,
    clear: mandatoryUnanswered.length === 0
      && unfinishedDigging.length === 0
      && needsReconciliation.length === 0,
  }
}

/**
 * Case-wide safety, which belongs to the whole case and not to this section.
 *
 * Deliberately returns counts and locations, never anything a section footer
 * could present as "you must do this to continue".
 */
export function caseWideSafetyStatus(
  state: CaptureState,
  current: PilotSectionId,
  safetyItems: readonly CockpitSafetyItem[] = [],
): CaseWideSafetyStatus {
  const elsewhere = openItemsElsewhere(safetyItems, current)
  const consolidated = consolidateSafety(safetyItems)

  // A red-flag question in another stream that has not been asked at all.
  const unasked = pilotQuestions()
    .filter((q) => (q.safetyOptions?.length ?? 0) > 0)
    .filter((q) => q.section !== current)
    .filter((q) => state.answers[q.id] === undefined)
    .map((q) => ({ section: q.section as PilotSectionId, questionId: q.id }))

  return {
    openElsewhere: elsewhere.length,
    sectionsElsewhere: [...new Set(elsewhere.flatMap((i) => i.linkedSections))],
    unaskedSafetyElsewhere: unasked,
    decidedNotResolved: consolidated.open.filter((i) => i.record.decision !== null).length,
    anyOpenAnywhere: consolidated.anyOpen,
  }
}

export interface FinishSectionGate {
  /** May the practitioner mark this section finished? */
  canFinish: boolean
  /** The label to show. Says review remains open whenever it does. */
  label: string
  /** Shown BEFORE finishing, so nothing is a surprise afterwards. */
  blockers: string[]
  /** Shown alongside, but explicitly not blocking. */
  remainsOpen: string[]
  /** True when finishing leaves a human-review item open — which it may, and
   *  which must be stated rather than hidden. */
  leavesReviewOpen: boolean
}

/**
 * The finish-section gate.
 *
 * Can block on this section's own gaps. CANNOT close a safety item, and
 * CANNOT be blocked by another stream's requirement. Open review in this
 * section is surfaced in `remainsOpen`, not in `blockers`: a practitioner
 * finishing their questions does not and should not resolve a review that
 * needs a named human decision.
 */
export function finishSectionGate(
  state: CaptureState,
  section: PilotSectionId,
  safetyItems: readonly CockpitSafetyItem[] = [],
): FinishSectionGate {
  const s = sectionStatus(state, section, safetyItems)
  const caseWide = caseWideSafetyStatus(state, section, safetyItems)

  const blockers: string[] = []
  for (const q of s.mandatoryUnanswered) blockers.push(`Required question not answered: ${q}`)
  for (const b of s.unfinishedDigging) blockers.push(`Digging branch not finished: ${b}`)
  for (const b of s.needsReconciliation) blockers.push(`Branch needs reconciliation after an answer changed: ${b}`)

  const remainsOpen: string[] = []
  if (s.openSafetyInThisSection > 0) {
    remainsOpen.push(
      `${s.openSafetyInThisSection} safety item(s) raised in this section still need a human review. ` +
      'Finishing the section does not close them.',
    )
  }
  if (caseWide.openElsewhere > 0) {
    remainsOpen.push(
      `${caseWide.openElsewhere} safety item(s) open in other streams: ` +
      `${caseWide.sectionsElsewhere.join(', ')}. Not blocking this section.`,
    )
  }
  if (caseWide.unaskedSafetyElsewhere.length > 0) {
    remainsOpen.push(
      `${caseWide.unaskedSafetyElsewhere.length} safety question(s) not yet asked in other streams. ` +
      'Not blocking this section.',
    )
  }

  const leavesReviewOpen = s.openSafetyInThisSection > 0 || caseWide.anyOpenAnywhere
  return {
    canFinish: blockers.length === 0,
    label: leavesReviewOpen ? FINISH_SECTION_LABEL : FINISH_SECTION_LABEL_CLEAR,
    blockers,
    remainsOpen,
    leavesReviewOpen,
  }
}

/**
 * Finish a section.
 *
 * Returns the capture state UNCHANGED with respect to safety, because it has
 * no safety argument and therefore no way to alter one. The signature is the
 * guarantee: finishing a section cannot close a human-review item.
 */
export function finishSection(
  state: CaptureState, section: PilotSectionId, safetyItems: readonly CockpitSafetyItem[] = [],
): { state: CaptureState; finished: boolean; gate: FinishSectionGate } {
  const gate = finishSectionGate(state, section, safetyItems)
  // Summarise every sufficient branch in the section; nothing else changes.
  if (!gate.canFinish) return { state, finished: false, gate }
  const branches = { ...state.branches }
  for (const [id, b] of Object.entries(branches)) {
    if (b.section === section && isBranchSufficient(b) && b.lifecycle !== 'summary') {
      branches[id] = { ...b, lifecycle: 'summary' }
    }
  }
  return { state: { ...state, branches }, finished: true, gate }
}
