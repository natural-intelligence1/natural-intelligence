// ─── packages/db/src/intakeV2/branchLifecycle.ts ─────────────────────────────
// Branch lifecycle for the adaptive journey:
//
//   collapsed → activated → expanded → factually sufficient → concise summary
//
// and, crucially, REOPENING when later information makes a branch relevant
// again. Reopening never discards what was already answered.
//
// "Factually sufficient" means only that the questions this branch needed are
// answered — it is a completeness test, never a clinical judgement that enough
// is known. A branch with every required field answered is sufficient even if
// a practitioner would still want to ask more; that is what the Call Sheet is
// for.
//
// This layer sits ON TOP of the existing showIf visibility in flow.ts. It adds
// state and history; it does not replace the engine.

import type { V2SectionId } from './types'

export const BRANCH_STATES = [
  'collapsed', 'activated', 'expanded', 'factually_sufficient', 'summarised',
] as const
export type BranchState = (typeof BRANCH_STATES)[number]

export interface BranchStatus {
  section: V2SectionId
  state: BranchState
  /** Required question ids for this branch to be factually sufficient. */
  requiredQuestionIds: string[]
  /** Question ids currently holding an answer. */
  answeredQuestionIds: string[]
  /** Append-only audit of every transition, including reopenings. */
  history: BranchTransition[]
}

export interface BranchTransition {
  from: BranchState
  to: BranchState
  at: string
  /** Why it moved — an activating answer, sufficiency, or a reopening trigger. */
  reason: string
}

export function newBranch(
  section: V2SectionId, requiredQuestionIds: string[],
): BranchStatus {
  return {
    section, state: 'collapsed', requiredQuestionIds,
    answeredQuestionIds: [], history: [],
  }
}

function transition(
  branch: BranchStatus, to: BranchState, at: string, reason: string,
): BranchStatus {
  if (branch.state === to) return branch
  return {
    ...branch,
    state: to,
    history: [...branch.history, { from: branch.state, to, at, reason }],
  }
}

/** The client's answer made this area relevant. */
export function activateBranch(branch: BranchStatus, at: string, reason: string): BranchStatus {
  if (branch.state !== 'collapsed') return branch
  return transition(branch, 'activated', at, reason)
}

export function expandBranch(branch: BranchStatus, at: string): BranchStatus {
  if (branch.state !== 'activated') return branch
  return transition(branch, 'expanded', at, 'Client opened the questions')
}

/** Factual sufficiency: every required question for the branch is answered. */
export function isFactuallySufficient(branch: BranchStatus): boolean {
  if (branch.requiredQuestionIds.length === 0) return false
  const answered = new Set(branch.answeredQuestionIds)
  return branch.requiredQuestionIds.every((q) => answered.has(q))
}

/**
 * Record an answer and advance the branch if — and only if — it is now
 * factually sufficient. A branch can never be closed early by the system.
 */
export function recordAnswer(
  branch: BranchStatus, questionId: string, at: string,
): BranchStatus {
  const answered = branch.answeredQuestionIds.includes(questionId)
    ? branch.answeredQuestionIds
    : [...branch.answeredQuestionIds, questionId]
  let next: BranchStatus = { ...branch, answeredQuestionIds: answered }

  if (next.state === 'collapsed') next = transition(next, 'activated', at, 'Answer recorded')
  if (next.state === 'activated') next = transition(next, 'expanded', at, 'Answering in progress')
  if (next.state === 'expanded' && isFactuallySufficient(next)) {
    next = transition(next, 'factually_sufficient', at, 'All required questions answered')
  }
  return next
}

/** Collapse to a concise summary once sufficient. Answers remain intact. */
export function summariseBranch(branch: BranchStatus, at: string): BranchStatus {
  if (branch.state !== 'factually_sufficient') return branch
  return transition(branch, 'summarised', at, 'Collapsed to summary')
}

/**
 * Later information made this branch relevant again. The branch returns to
 * `expanded` — never to `collapsed` — and EVERY previous answer is preserved.
 * The reopening is recorded so the practitioner can see it happened.
 */
export function reopenBranch(
  branch: BranchStatus, at: string, reason: string,
): BranchStatus {
  if (branch.state !== 'factually_sufficient' && branch.state !== 'summarised') return branch
  const reopened = transition(branch, 'expanded', at, `Reopened: ${reason}`)
  // answeredQuestionIds is carried through untouched by `transition`.
  return reopened
}

/** Branches the client still needs to look at before submission. */
export function openBranches(branches: BranchStatus[]): BranchStatus[] {
  return branches.filter((b) => b.state === 'activated' || b.state === 'expanded')
}

/**
 * A branch that was never activated is NOT a negative finding. This helper
 * exists so no caller can mistake "collapsed" for "client said no".
 */
export function wasNeverAsked(branch: BranchStatus): boolean {
  return branch.state === 'collapsed' && branch.history.length === 0
}
