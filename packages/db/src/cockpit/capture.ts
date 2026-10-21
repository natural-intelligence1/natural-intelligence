// ─── packages/db/src/cockpit/capture.ts ─────────────────────────────────────
// LIVE CASE CAPTURE — the right pane's state, as a pure domain model.
//
// Two rules shape this file, and both are about not losing things:
//
// 1. A CHANGED ANSWER NEVER DELETES THE OLD ONE. The previous answer, its
//    provenance and its timestamp are kept; the new answer becomes current;
//    everything captured downstream of the old answer stays in the record.
//    Branches whose trigger no longer holds are FLAGGED for reconciliation,
//    not emptied. "No longer relevant" is a status a human applies, never a
//    deletion NI performs.
//
// 2. UNANSWERED IS NOT "NO". There is no code path that turns absence into a
//    negative answer. `not_asked` and `declined` are distinct recorded states,
//    and both are distinct from an answer of "No".
//
// Guidance never enters the record: this module has no field for it and no
// function that accepts it. Only explicitly asked, captured or observed
// content becomes a CapturedAnswer.

import type { V2Provenance } from '../intakeV2/provenance'
import {
  PILOT_DIGGING_EDGES, edgesTriggeredBy, orderedTargets, targetKey,
  type DiggingEdge, type DiggingReviewStatus,
} from './diggingEdges'
import { canPersistCanonically, persistenceBlockReason } from './mappingPack'
import { pilotQuestionById, type PilotSectionId } from './pilot'

/** Structural lifecycle. Separate axis from review status. */
export const BRANCH_LIFECYCLE = [
  'collapsed', 'activated', 'expanded', 'sufficient', 'summary', 'reopened',
] as const
export type BranchLifecycleState = (typeof BRANCH_LIFECYCLE)[number]

/** Who put this in the record. */
export const CAPTURE_ACTOR_ROLES = ['practitioner', 'student', 'client', 'system'] as const
export type CaptureActorRole = (typeof CAPTURE_ACTOR_ROLES)[number]

export interface CaptureActor {
  id: string
  displayName: string
  role: CaptureActorRole
  /** Required for a student. The supervision relationship stays explicit. */
  supervisorId?: string | null
}

/** One superseded answer, kept whole. */
export interface AnswerRevision {
  value: unknown
  provenance: V2Provenance
  at: string
  actorId: string
  /** Why it changed, in the human's words. Never composed by NI. */
  note?: string
}

export interface CapturedAnswer {
  questionId: string
  section: PilotSectionId
  value: unknown
  provenance: V2Provenance
  at: string
  actor: CaptureActor
  /** Append-only. Oldest first. Never truncated. */
  history: AnswerRevision[]
  /** A student entry is a draft until a supervisor accepts it. */
  draft: boolean
  /** Set by a human when an answer is superseded by circumstance rather than
   *  corrected. Never set by NI. */
  noLongerRelevant?: boolean
  /** True where the answer is stored in session state only, because no
   *  approved mapping exists. Mirrors the gate; never guessed. */
  canonicalWriteBlocked: boolean
  canonicalBlockReason: string | null
}

export interface BranchCapture {
  edgeId: string
  section: PilotSectionId
  lifecycle: BranchLifecycleState
  reviewStatus: DiggingReviewStatus
  /** The trigger values that opened it, verbatim. */
  openedBy: string[]
  /** targetKey -> captured detail. */
  answers: Record<string, CapturedAnswer>
  /** Append-only lifecycle audit. */
  history: Array<{ from: BranchLifecycleState; to: BranchLifecycleState; at: string; reason: string }>
  /** Set when the triggering answer changed such that this branch may no
   *  longer apply. The branch and its content REMAIN; a human decides. */
  needsReconciliation: boolean
  reconciliationReason?: string
}

export interface CaptureState {
  caseId: string
  answers: Record<string, CapturedAnswer>
  branches: Record<string, BranchCapture>
}

export function newCaptureState(caseId: string): CaptureState {
  return { caseId, answers: {}, branches: {} }
}

const asList = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(String) : typeof v === 'string' ? [v] : []

function moveBranch(
  b: BranchCapture, to: BranchLifecycleState, at: string, reason: string,
): BranchCapture {
  if (b.lifecycle === to) return b
  return { ...b, lifecycle: to, history: [...b.history, { from: b.lifecycle, to, at, reason }] }
}

/**
 * Record an answer to a top-level pilot question.
 *
 * Opens any digging branch its value triggers, and flags — never empties —
 * branches whose trigger no longer holds.
 */
export function recordAnswer(
  state: CaptureState,
  args: {
    questionId: string
    value: unknown
    provenance: V2Provenance
    at: string
    actor: CaptureActor
    note?: string
  },
): CaptureState {
  const q = pilotQuestionById(args.questionId)
  if (!q) return state

  const previous = state.answers[args.questionId]
  const blocked = !canPersistCanonically(args.questionId)

  const answer: CapturedAnswer = {
    questionId: args.questionId,
    section: q.section as PilotSectionId,
    value: args.value,
    provenance: args.provenance,
    at: args.at,
    actor: args.actor,
    // The old answer is pushed into history, with its own provenance and
    // timestamp. Nothing is overwritten in place.
    history: previous
      ? [...previous.history, {
          value: previous.value, provenance: previous.provenance,
          at: previous.at, actorId: previous.actor.id, note: args.note,
        }]
      : [],
    draft: args.actor.role === 'student',
    canonicalWriteBlocked: blocked,
    canonicalBlockReason: blocked ? persistenceBlockReason(args.questionId) : null,
  }

  let branches = { ...state.branches }
  const selected = asList(args.value)

  // Open branches the new answer triggers.
  for (const edge of edgesTriggeredBy(args.questionId, selected)) {
    const existing = branches[edge.id]
    const openedBy = edge.trigger.anyOf.filter((t) => selected.includes(t))
    if (!existing) {
      branches[edge.id] = {
        edgeId: edge.id,
        section: edge.section,
        lifecycle: 'activated',
        reviewStatus: edge.reviewStatus,
        openedBy,
        answers: {},
        history: [{ from: 'collapsed', to: 'activated', at: args.at, reason: `Answer included: ${openedBy.join(', ')}` }],
        needsReconciliation: false,
      }
    } else if (existing.needsReconciliation) {
      // The trigger came back. Reopen rather than leave it flagged.
      branches[edge.id] = moveBranch(
        { ...existing, openedBy, needsReconciliation: false, reconciliationReason: undefined },
        'reopened', args.at, 'The triggering answer was given again',
      )
    }
  }

  // Flag — never empty — branches whose trigger no longer holds.
  if (previous) {
    const stillTriggered = new Set(edgesTriggeredBy(args.questionId, selected).map((e) => e.id))
    for (const edge of PILOT_DIGGING_EDGES.filter((e) => e.sourceQuestionId === args.questionId)) {
      const b = branches[edge.id]
      if (!b || stillTriggered.has(edge.id)) continue
      branches[edge.id] = {
        ...b,
        needsReconciliation: true,
        reconciliationReason:
          `The answer that opened this changed on ${args.at}. Everything captured here is kept. ` +
          'Mark it no longer relevant, or reopen it.',
      }
    }
  }

  return { ...state, answers: { ...state.answers, [args.questionId]: answer }, branches }
}

/** Record detail inside a digging branch. Never raises a safety item. */
export function recordBranchDetail(
  state: CaptureState,
  args: {
    edgeId: string
    targetKey: string
    value: unknown
    provenance: V2Provenance
    at: string
    actor: CaptureActor
    note?: string
  },
): CaptureState {
  const branch = state.branches[args.edgeId]
  if (!branch) return state

  const previous = branch.answers[args.targetKey]
  const detail: CapturedAnswer = {
    questionId: args.targetKey,
    section: branch.section,
    value: args.value,
    provenance: args.provenance,
    at: args.at,
    actor: args.actor,
    history: previous
      ? [...previous.history, {
          value: previous.value, provenance: previous.provenance,
          at: previous.at, actorId: previous.actor.id, note: args.note,
        }]
      : [],
    draft: args.actor.role === 'student',
    // Branch detail has no canonical destination at all in the pilot — no
    // digging target carries a field id. Stated, not implied.
    canonicalWriteBlocked: true,
    canonicalBlockReason: 'Digging detail has no canonical destination field in the pilot.',
  }

  const withDetail: BranchCapture = {
    ...branch,
    answers: { ...branch.answers, [args.targetKey]: detail },
  }
  const expanded = withDetail.lifecycle === 'activated'
    ? moveBranch(withDetail, 'expanded', args.at, 'Detail capture began')
    : withDetail

  const sufficient = isBranchSufficient(expanded)
  const next = sufficient && expanded.lifecycle !== 'sufficient' && expanded.lifecycle !== 'summary'
    ? moveBranch(expanded, 'sufficient', args.at, 'Every answer counting towards sufficiency is recorded')
    : expanded

  return { ...state, branches: { ...state.branches, [args.edgeId]: next } }
}

/** Factual sufficiency only: every sufficiency-counting target has a value.
 *  Says nothing about whether the answers are clinically adequate. */
export function isBranchSufficient(branch: BranchCapture): boolean {
  const edge = PILOT_DIGGING_EDGES.find((e) => e.id === branch.edgeId)
  if (!edge) return false
  const needed = orderedTargets(edge).filter((t) => t.countsTowardsSufficiency)
  if (needed.length === 0) return false
  return needed.every((t) => branch.answers[targetKey(edge, t)] !== undefined)
}

/** Which targets are still outstanding, in asking order. */
export function outstandingTargets(branch: BranchCapture): Array<{
  target: ReturnType<typeof orderedTargets>[number]; key: string
}> {
  const edge = PILOT_DIGGING_EDGES.find((e) => e.id === branch.edgeId)
  if (!edge) return []
  return orderedTargets(edge)
    .map((target) => ({ target, key: targetKey(edge, target) }))
    .filter(({ key }) => branch.answers[key] === undefined)
}

/** Collapse a sufficient branch to a summary. Answers remain intact. */
export function summariseBranch(state: CaptureState, edgeId: string, at: string): CaptureState {
  const b = state.branches[edgeId]
  if (!b || !isBranchSufficient(b)) return state
  return {
    ...state,
    branches: { ...state.branches, [edgeId]: moveBranch(b, 'summary', at, 'Collapsed to summary') },
  }
}

/** Reopen a branch. The prior lifecycle history is preserved. */
export function reopenBranch(
  state: CaptureState, edgeId: string, at: string, reason: string,
): CaptureState {
  const b = state.branches[edgeId]
  if (!b) return state
  return {
    ...state,
    branches: {
      ...state.branches,
      [edgeId]: moveBranch(
        { ...b, needsReconciliation: false, reconciliationReason: undefined },
        'reopened', at, reason,
      ),
    },
  }
}

/**
 * A human marks a branch no longer relevant.
 *
 * Requires an actor and a reason, and KEEPS every captured answer. This is a
 * status, not a delete — the record still shows what was asked and answered
 * before circumstances changed.
 */
export function markBranchNoLongerRelevant(
  state: CaptureState,
  args: { edgeId: string; at: string; actor: CaptureActor; reason: string },
): CaptureState {
  const b = state.branches[args.edgeId]
  if (!b) return state
  if (!args.reason.trim()) return state
  // A student cannot retire a clinical branch on their own.
  if (args.actor.role === 'student') return state
  return {
    ...state,
    branches: {
      ...state.branches,
      [args.edgeId]: {
        ...b,
        needsReconciliation: false,
        reconciliationReason: `No longer relevant — ${args.actor.displayName}, ${args.at}: ${args.reason}`,
        reviewStatus: 'resolved',
      },
    },
  }
}

// ── Reading the state ───────────────────────────────────────────────────────

export function answersForSection(state: CaptureState, section: PilotSectionId): CapturedAnswer[] {
  return Object.values(state.answers).filter((a) => a.section === section)
}

export function branchesForSection(state: CaptureState, section: PilotSectionId): BranchCapture[] {
  return Object.values(state.branches).filter((b) => b.section === section)
}

/** Branches opened but not yet factually sufficient. */
export function unfinishedBranches(state: CaptureState, section?: PilotSectionId): BranchCapture[] {
  return Object.values(state.branches).filter((b) =>
    (section === undefined || b.section === section)
    && b.lifecycle !== 'summary'
    && b.reviewStatus !== 'resolved'
    && !isBranchSufficient(b))
}

export function branchesNeedingReconciliation(state: CaptureState, section?: PilotSectionId): BranchCapture[] {
  return Object.values(state.branches).filter((b) =>
    (section === undefined || b.section === section) && b.needsReconciliation)
}

/** Every answer a student entered that no supervisor has accepted. */
export function studentDrafts(state: CaptureState): CapturedAnswer[] {
  return [
    ...Object.values(state.answers),
    ...Object.values(state.branches).flatMap((b) => Object.values(b.answers)),
  ].filter((a) => a.draft)
}

/** Answers that have been changed at least once. */
export function amendedAnswers(state: CaptureState): CapturedAnswer[] {
  return Object.values(state.answers).filter((a) => a.history.length > 0)
}

export function edgeFor(edgeId: string): DiggingEdge | undefined {
  return PILOT_DIGGING_EDGES.find((e) => e.id === edgeId)
}
