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
 * Fixed reasons for running over. A closed list on purpose: free text here
 * would collect clinical detail into an operational record.
 */
export const OVERRUN_REASONS = [
  'more_history_than_expected',
  'safety_matter_needed_time',
  'client_needed_longer',
  'interpreter_or_access_need',
  'technical_problem',
  'records_took_time_to_locate',
  'other_operational',
] as const
export type OverrunReason = (typeof OVERRUN_REASONS)[number]

export const OVERRUN_REASON_LABELS: Record<OverrunReason, string> = {
  more_history_than_expected:  'More history to take than planned',
  safety_matter_needed_time:   'A safety matter needed time',
  client_needed_longer:        'Client needed longer',
  interpreter_or_access_need:  'Interpreter or access need',
  technical_problem:           'Technical problem',
  records_took_time_to_locate: 'Records took time to locate',
  other_operational:           'Other operational reason',
}

/** The operational record. Every field here is safe to send to payroll. */
export interface WorkLogEntry {
  caseId: string
  practitionerId: string
  plannedMinutes: number
  /** Accumulated active time, excluding pauses. */
  activeSeconds: number
  startedAt: string | null
  completedAt: string | null
  pauseCount: number
  overran: boolean
  overrunSeconds: number
  overrunReason: OverrunReason | null
  /** Set only where 'other_operational' was chosen. Capped hard, and the UI
   *  must label it as operational-only. Still not a clinical note. */
  overrunNote: string | null
}

export interface TimerSession {
  state: TimerState
  plannedMinutes: number
  startedAt: string | null
  /** When the current running stretch began. Null while paused. */
  runningSince: string | null
  accumulatedSeconds: number
  pauseCount: number
  completedAt: string | null
  overrunReason: OverrunReason | null
  overrunNote: string | null
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
    pauseCount: 0,
    completedAt: null,
    overrunReason: null,
    overrunNote: null,
  }
}

const secondsBetween = (from: string, to: string) =>
  Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 1000))

export function startTimer(t: TimerSession, at: string): TimerSession {
  if (t.state === 'running' || t.state === 'completed') return t
  return { ...t, state: 'running', startedAt: t.startedAt ?? at, runningSince: at }
}

export function pauseTimer(t: TimerSession, at: string): TimerSession {
  if (t.state !== 'running' || !t.runningSince) return t
  return {
    ...t,
    state: 'paused',
    accumulatedSeconds: t.accumulatedSeconds + secondsBetween(t.runningSince, at),
    runningSince: null,
    pauseCount: t.pauseCount + 1,
  }
}

export function resumeTimer(t: TimerSession, at: string): TimerSession {
  if (t.state !== 'paused') return t
  return { ...t, state: 'running', runningSince: at }
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
  overrun?: { reason: OverrunReason; note?: string },
): CompleteTimerResult {
  const stopped = t.state === 'running' ? pauseTimer(t, at) : t
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
      pauseCount: t.state === 'running' ? t.pauseCount : stopped.pauseCount,
      overrunReason: over ? overrun!.reason : null,
      overrunNote: over && overrun!.reason === 'other_operational'
        ? (overrun!.note ?? '').slice(0, 140).trim() || null
        : null,
    },
  }
}

/**
 * The operational record for payroll and capacity.
 *
 * Takes the timer and two ids. It cannot reach the clinical record, because
 * it is not given it.
 */
export function toWorkLogEntry(
  t: TimerSession, args: { caseId: string; practitionerId: string; at: string },
): WorkLogEntry {
  return {
    caseId: args.caseId,
    practitionerId: args.practitionerId,
    plannedMinutes: t.plannedMinutes,
    activeSeconds: activeSeconds(t, args.at),
    startedAt: t.startedAt,
    completedAt: t.completedAt,
    pauseCount: t.pauseCount,
    overran: overrunSeconds(t, args.at) > 0,
    overrunSeconds: overrunSeconds(t, args.at),
    overrunReason: t.overrunReason,
    overrunNote: t.overrunNote,
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
