// ─── packages/db/src/intakeV2/safetyWorkflow.ts ──────────────────────────────
// MACHINERY ONLY. This module moves a reported safety answer through human
// review and records what a person decided. It activates no rule content, and
// it contains no clinical rule content of its own.
//
// What this module does NOT do, by construction:
//   · It does not assess risk, rank urgency or decide referral.
//   · It does not close an item. Only a named human decision closes an item.
//   · It does not generate a decision, a reason or a recommendation.
//   · It never writes an acknowledgement or decision without a named actor.
//
// The lifecycle is deliberately small and one-directional except for reopen:
//
//   open → acknowledged → decided → resolved
//                ↑                      │
//                └──────── reopened ────┘
//
// `open` is the only state NI can create. Every later transition requires a
// named reviewer, a timestamp, and — for a decision — the human's own words.
// Every transition is appended to an audit trail; nothing is ever rewritten.
//
// The rule content that decides WHICH answers become safety items lives in the
// approved clinical set and is applied by deriveV2SafetyReviewItems. Clinical
// validation is closed and approved with amendments; this module deliberately
// takes the item as given and adds no rule of its own.

import type { V2SafetyReviewItem } from './synopsisMapping'

export const SAFETY_WORKFLOW_VERSION = 'safety-workflow.v1'

export const SAFETY_STATES = [
  'open', 'acknowledged', 'decided', 'resolved', 'reopened',
] as const
export type SafetyState = (typeof SAFETY_STATES)[number]

export const SAFETY_STATE_LABELS: Record<SafetyState, string> = {
  open:         'Awaiting review',
  acknowledged: 'Seen by practitioner',
  decided:      'Decision recorded',
  resolved:     'Closed',
  reopened:     'Reopened',
}

/** States in which the item still needs a human. Drives "needs attention". */
export const SAFETY_OPEN_STATES: readonly SafetyState[] = [
  'open', 'acknowledged', 'reopened',
]

export function isOpen(item: SafetyReviewRecord): boolean {
  return SAFETY_OPEN_STATES.includes(item.state)
}

// ─── Audit trail ─────────────────────────────────────────────────────────────

export const SAFETY_EVENT_KINDS = [
  'raised', 'acknowledged', 'decision_recorded', 'action_recorded',
  'resolved', 'reopened', 'reviewer_assigned',
] as const
export type SafetyEventKind = (typeof SAFETY_EVENT_KINDS)[number]

export interface SafetyAuditEvent {
  id: string
  kind: SafetyEventKind
  at: string
  /** Null only for `raised`, which NI performs. Every other event is human. */
  actor: string | null
  /** The human's own words, where the event carries them. Never generated. */
  detail?: string
}

// ─── The record ──────────────────────────────────────────────────────────────

export interface SafetyDecision {
  /** The practitioner's own words. NI supplies no vocabulary for this. */
  decision: string
  decidedBy: string
  decidedAt: string
}

export interface SafetyAction {
  id: string
  /** What was actually done, in the practitioner's words. */
  action: string
  takenBy: string
  takenAt: string
}

export interface SafetyReviewRecord {
  id: string
  caseId: string
  /** The derived item, carried verbatim. Never edited by this module. */
  item: V2SafetyReviewItem
  state: SafetyState
  /** The named human responsible for reviewing it. */
  assignedReviewer: string | null
  acknowledgedBy: string | null
  acknowledgedAt: string | null
  decision: SafetyDecision | null
  actions: SafetyAction[]
  resolvedBy: string | null
  resolvedAt: string | null
  /** Append-only. */
  audit: SafetyAuditEvent[]
  raisedAt: string
  workflowVersion: string
}

export type SafetyRefusal =
  | 'no_actor'
  | 'no_decision_text'
  | 'no_action_text'
  | 'not_acknowledged'
  | 'no_decision_recorded'
  | 'already_resolved'
  | 'not_resolved'

export interface SafetyResult {
  record: SafetyReviewRecord | null
  refusedReason?: SafetyRefusal
}

const append = (
  record: SafetyReviewRecord, kind: SafetyEventKind, at: string,
  actor: string | null, detail?: string,
): SafetyAuditEvent[] => [
  ...record.audit,
  { id: `${record.id}:${kind}:${record.audit.length}`, kind, at, actor, ...(detail ? { detail } : {}) },
]

/**
 * Raise an item for human review. The ONLY thing NI does here, and the only
 * transition without an actor. The item arrives already derived by the
 * approved clinical set; nothing about it is interpreted.
 */
export function raiseSafetyItem(args: {
  id: string; caseId: string; item: V2SafetyReviewItem; at: string
  assignedReviewer?: string | null
}): SafetyReviewRecord {
  const record: SafetyReviewRecord = {
    id: args.id,
    caseId: args.caseId,
    item: args.item,
    state: 'open',
    assignedReviewer: args.assignedReviewer ?? null,
    acknowledgedBy: null,
    acknowledgedAt: null,
    decision: null,
    actions: [],
    resolvedBy: null,
    resolvedAt: null,
    audit: [{ id: `${args.id}:raised:0`, kind: 'raised', at: args.at, actor: null }],
    raisedAt: args.at,
    workflowVersion: SAFETY_WORKFLOW_VERSION,
  }
  if (args.assignedReviewer) {
    return {
      ...record,
      audit: append(record, 'reviewer_assigned', args.at, args.assignedReviewer),
    }
  }
  return record
}

/** Name the human responsible. Required before a decision can be recorded. */
export function assignReviewer(
  record: SafetyReviewRecord, reviewer: string | null, at: string,
): SafetyResult {
  if (!reviewer) return { record: null, refusedReason: 'no_actor' }
  return {
    record: {
      ...record,
      assignedReviewer: reviewer,
      audit: append(record, 'reviewer_assigned', at, reviewer),
    },
  }
}

/** A named human confirms they have seen it. Not a decision. */
export function acknowledgeSafetyItem(
  record: SafetyReviewRecord, actor: string | null, at: string,
): SafetyResult {
  if (!actor) return { record: null, refusedReason: 'no_actor' }
  if (record.state === 'resolved') return { record: null, refusedReason: 'already_resolved' }
  return {
    record: {
      ...record,
      state: 'acknowledged',
      acknowledgedBy: actor,
      acknowledgedAt: at,
      audit: append(record, 'acknowledged', at, actor),
    },
  }
}

/**
 * Record the human decision. Requires acknowledgement first, a named actor,
 * and the practitioner's own words — NI offers no decision vocabulary, so
 * there is nothing here for a clinician to merely click through.
 */
export function recordSafetyDecision(
  record: SafetyReviewRecord,
  args: { decision: string; actor: string | null; at: string },
): SafetyResult {
  if (!args.actor) return { record: null, refusedReason: 'no_actor' }
  if (!args.decision.trim()) return { record: null, refusedReason: 'no_decision_text' }
  if (record.state === 'resolved') return { record: null, refusedReason: 'already_resolved' }
  if (record.state === 'open') return { record: null, refusedReason: 'not_acknowledged' }
  return {
    record: {
      ...record,
      state: 'decided',
      decision: { decision: args.decision, decidedBy: args.actor, decidedAt: args.at },
      audit: append(record, 'decision_recorded', args.at, args.actor, args.decision),
    },
  }
}

/** Record what was actually done. Append-only; actions are never replaced. */
export function recordSafetyAction(
  record: SafetyReviewRecord,
  args: { id: string; action: string; actor: string | null; at: string },
): SafetyResult {
  if (!args.actor) return { record: null, refusedReason: 'no_actor' }
  if (!args.action.trim()) return { record: null, refusedReason: 'no_action_text' }
  if (record.state === 'resolved') return { record: null, refusedReason: 'already_resolved' }
  return {
    record: {
      ...record,
      actions: [...record.actions,
        { id: args.id, action: args.action, takenBy: args.actor, takenAt: args.at }],
      audit: append(record, 'action_recorded', args.at, args.actor, args.action),
    },
  }
}

/**
 * Close the item. Requires a recorded human decision — there is no path that
 * resolves a safety item without a person having decided something and said
 * so in their own words.
 */
export function resolveSafetyItem(
  record: SafetyReviewRecord, actor: string | null, at: string,
): SafetyResult {
  if (!actor) return { record: null, refusedReason: 'no_actor' }
  if (record.state === 'resolved') return { record: null, refusedReason: 'already_resolved' }
  if (!record.decision) return { record: null, refusedReason: 'no_decision_recorded' }
  return {
    record: {
      ...record,
      state: 'resolved',
      resolvedBy: actor,
      resolvedAt: at,
      audit: append(record, 'resolved', at, actor),
    },
  }
}

/**
 * Reopen a closed item. The previous decision and actions are PRESERVED — the
 * audit trail is the record of what was decided and when, and reopening adds
 * to it rather than erasing it.
 */
export function reopenSafetyItem(
  record: SafetyReviewRecord,
  args: { actor: string | null; at: string; reason?: string },
): SafetyResult {
  if (!args.actor) return { record: null, refusedReason: 'no_actor' }
  if (record.state !== 'resolved') return { record: null, refusedReason: 'not_resolved' }
  return {
    record: {
      ...record,
      state: 'reopened',
      resolvedBy: null,
      resolvedAt: null,
      audit: append(record, 'reopened', args.at, args.actor, args.reason),
    },
  }
}

/** Items still needing a human, oldest first. Order only — never ranked. */
export function openSafetyItems(records: SafetyReviewRecord[]): SafetyReviewRecord[] {
  return records
    .filter(isOpen)
    .sort((a, b) => new Date(a.raisedAt).getTime() - new Date(b.raisedAt).getTime())
}
