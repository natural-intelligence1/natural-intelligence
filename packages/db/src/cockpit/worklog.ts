// ─── packages/db/src/cockpit/worklog.ts ─────────────────────────────────────
// Consultation timer and operational work log.
//
// ── WHAT THIS IS FOR, AND WHAT IT IS NOT FOR ────────────────────────────────
//
// For: a practitioner's work log, evidence for payment, and capacity
// analysis. NOT for performance scoring — nothing here ranks, compares or
// rates a practitioner, and no function returns a score.
//
// ── NO CLINICAL CONTENT. THIS IS ENFORCED, NOT REQUESTED. ───────────────────
//
// The operational log is payroll/capacity data and must carry no detailed
// clinical health information. `WorkLogEntry` has no field that could hold
// one, and `overrunReason` is a CHOICE FROM A FIXED LIST rather than free
// text — because free text is where a clinical detail would end up. A
// practitioner's clinical note belongs in the case record; there is no path
// from here to there and none from there to here.
//
// ── THE TIMER HAS NO INFLUENCE OVER THE CONSULTATION ────────────────────────
//
// It cannot hide, shorten, reorder or suppress a question. This module
// exports no function that takes a question, a section or a capture state,
// and nothing in the cockpit's question or safety logic imports it. That
// absence is the guarantee; `TIMER_CANNOT_AFFECT_CONTENT` records it so a
// test can assert the module's surface stays that way.

export const TIMER_STATES = ['not_started', 'running', 'paused', 'completed'] as const
export type TimerState = (typeof TIMER_STATES)[number]

/**
 * The APPROVED overrun reasons (UI handover §0 — LOCKED PRODUCT DESIGN).
 *
 * A closed list on purpose: free text here would collect clinical detail into
 * an operational record. The wording and the set are approved; an earlier
 * draft of this module had a different seven-item list of my own, which was
 * replaced wholesale rather than merged.
 */
export const OVERRUN_REASONS = [
  'complexity_or_additional_history',
  'client_accessibility_or_support_needs',
  'technical_interruption',
  'safety_or_safeguarding_clarification',
  'client_interruption',
  'other',
] as const
export type OverrunReason = (typeof OVERRUN_REASONS)[number]

export const OVERRUN_REASON_LABELS: Record<OverrunReason, string> = {
  complexity_or_additional_history:      'Complexity or additional history',
  client_accessibility_or_support_needs: 'Client accessibility or support needs',
  technical_interruption:                'Technical interruption',
  safety_or_safeguarding_clarification:  'Safety or safeguarding clarification',
  client_interruption:                   'Client interruption',
  other:                                 'Other',
}

/**
 * The operational record. Every field here is safe to send to payroll.
 *
 * The approved field list (UI handover §5) is exactly: practitioner, work
 * reference, planned duration, active duration, pause duration, overrun, and
 * the structured overrun reason. Nothing clinical, and no free-text field
 * that could become clinical — any clinical note goes to the case record
 * under clinical access controls, by a different path entirely.
 */
export interface WorkLogEntry {
  caseId: string
  practitionerId: string
  practitionerDisplayName: string
  /** Operational reference for payment and capacity, e.g. NI-W-0217. */
  workReference: string
  plannedMinutes: number
  /** Accumulated active time, excluding pauses. */
  activeSeconds: number
  /** Total paused time, logged as its own segment. */
  pauseSeconds: number
  startedAt: string | null
  completedAt: string | null
  pauseCount: number
  overran: boolean
  overrunSeconds: number
  overrunReason: OverrunReason | null
}

export interface TimerSession {
  state: TimerState
  plannedMinutes: number
  startedAt: string | null
  /** When the current running stretch began. Null while paused. */
  runningSince: string | null
  accumulatedSeconds: number
  /** Total paused time. Logged as its own segment, per the approved log. */
  pausedSeconds: number
  /** When the current pause began. Null while running. */
  pausedSince: string | null
  pauseCount: number
  /** Optional, operational, shown on the paused state. Never clinical. */
  pauseReason: string | null
  completedAt: string | null
  overrunReason: OverrunReason | null
}

export const TIMER_CANNOT_AFFECT_CONTENT = {
  /** No function in this module accepts a question, section or capture state. */
  takesNoClinicalInput: true,
  /** Nothing in the question, digging or safety logic imports this module. */
  notImportedByClinicalLogic: true,
  /** The log cannot hold a clinical note. */
  operationalFieldsOnly: true,
} as const

export function newTimer(plannedMinutes: number): TimerSession {
  return {
    state: 'not_started',
    plannedMinutes,
    startedAt: null,
    runningSince: null,
    accumulatedSeconds: 0,
    pausedSeconds: 0,
    pausedSince: null,
    pauseCount: 0,
    pauseReason: null,
    completedAt: null,
    overrunReason: null,
  }
}

const secondsBetween = (from: string, to: string) =>
  Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 1000))

export function startTimer(t: TimerSession, at: string): TimerSession {
  if (t.state === 'running' || t.state === 'completed') return t
  return { ...t, state: 'running', startedAt: t.startedAt ?? at, runningSince: at }
}

/** Pause. Capture is saved and nothing is lost; the pause becomes its own
 *  logged segment with an optional operational reason. */
export function pauseTimer(t: TimerSession, at: string, reason?: string): TimerSession {
  if (t.state !== 'running' || !t.runningSince) return t
  return {
    ...t,
    state: 'paused',
    accumulatedSeconds: t.accumulatedSeconds + secondsBetween(t.runningSince, at),
    runningSince: null,
    pausedSince: at,
    pauseCount: t.pauseCount + 1,
    pauseReason: reason?.trim() || null,
  }
}

export function resumeTimer(t: TimerSession, at: string): TimerSession {
  if (t.state !== 'paused') return t
  return {
    ...t,
    state: 'running',
    runningSince: at,
    pausedSeconds: t.pausedSeconds + (t.pausedSince ? secondsBetween(t.pausedSince, at) : 0),
    pausedSince: null,
    pauseReason: null,
  }
}

/** Paused seconds as of `at`, including the current pause. */
export function pausedSeconds(t: TimerSession, at: string): number {
  return t.state === 'paused' && t.pausedSince
    ? t.pausedSeconds + secondsBetween(t.pausedSince, at)
    : t.pausedSeconds
}

/** Active seconds as of `at`, including the current running stretch. */
export function activeSeconds(t: TimerSession, at: string): number {
  return t.state === 'running' && t.runningSince
    ? t.accumulatedSeconds + secondsBetween(t.runningSince, at)
    : t.accumulatedSeconds
}

export function isOverrunning(t: TimerSession, at: string): boolean {
  return activeSeconds(t, at) > t.plannedMinutes * 60
}

export function overrunSeconds(t: TimerSession, at: string): number {
  return Math.max(0, activeSeconds(t, at) - t.plannedMinutes * 60)
}

export type CompleteTimerResult =
  | { ok: true; session: TimerSession }
  /** Overran and no structured reason was given. */
  | { ok: false; reason: 'overrun_reason_required'; session: TimerSession }

/**
 * Complete the consultation.
 *
 * An overrun needs a structured reason — that is what makes the log usable as
 * payment evidence and capacity data. It is refused rather than defaulted,
 * because a guessed reason is worse than none.
 */
export function completeTimer(
  t: TimerSession, at: string,
  overrun?: { reason: OverrunReason },
): CompleteTimerResult {
  // Stop the clock without counting a pause: finishing is not pausing.
  const stopped: TimerSession = t.state === 'running' && t.runningSince
    ? {
        ...t,
        accumulatedSeconds: activeSeconds(t, at),
        runningSince: null,
      }
    : { ...t, pausedSeconds: pausedSeconds(t, at), pausedSince: null }

  const over = overrunSeconds(stopped, at) > 0
  if (over && !overrun) {
    return { ok: false, reason: 'overrun_reason_required', session: stopped }
  }

  return {
    ok: true,
    session: {
      ...stopped,
      state: 'completed',
      completedAt: at,
      overrunReason: over ? overrun!.reason : null,
    },
  }
}

/**
 * The operational record for payroll and capacity.
 *
 * ── IT CANNOT CARRY A CLINICAL NOTE, BY CONSTRUCTION ────────────────────────
 *
 * Note the arguments: a timer, two ids, a display name and a work reference.
 * There is no note parameter and no free-text field on WorkLogEntry. The
 * clinical note offered when finishing a consultation goes to the CASE
 * RECORD under clinical access controls, by a different path that does not
 * pass through here — so a clinical detail cannot reach payroll data even by
 * mistake.
 */
export function toWorkLogEntry(
  t: TimerSession,
  args: {
    caseId: string
    practitionerId: string
    practitionerDisplayName: string
    workReference: string
    at: string
  },
): WorkLogEntry {
  return {
    caseId: args.caseId,
    practitionerId: args.practitionerId,
    practitionerDisplayName: args.practitionerDisplayName,
    workReference: args.workReference,
    plannedMinutes: t.plannedMinutes,
    activeSeconds: activeSeconds(t, args.at),
    pauseSeconds: pausedSeconds(t, args.at),
    startedAt: t.startedAt,
    completedAt: t.completedAt,
    pauseCount: t.pauseCount,
    overran: overrunSeconds(t, args.at) > 0,
    overrunSeconds: overrunSeconds(t, args.at),
    overrunReason: t.overrunReason,
  }
}

/** mm:ss for the chrome. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(h > 0 ? m : m).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${String(sec).padStart(2, '0')}` : `${mm}:${String(sec).padStart(2, '0')}`
}
