// ─── packages/db/src/cockpit/studentMode.ts ─────────────────────────────────
// What a student may and may not do in the cockpit.
//
// Built as an explicit capability matrix rather than scattered `if` checks,
// so the boundary can be read in one place and tested as a whole. The
// existing care-team rules own the supervision relationship itself
// (validateRoleForMembership refuses a student role without a supervisor);
// this adds only what the cockpit needs on top.
//
// THE LINE: a student records FACTS and OBSERVATIONS, attributed and as
// drafts. A student does not make, finalise or close anything requiring
// qualified judgement. Every student entry carries their name — attribution
// is not optional and there is no anonymous student capture.

import type { CaptureActor } from './capture'

export const COCKPIT_CAPABILITIES = [
  // Permitted to a student.
  'capture_client_answer',
  'record_client_words',
  'add_attributed_observation_draft',
  'save_and_pause',
  'submit_for_supervision',
  'ask_safety_question',
  // Not permitted to a student.
  'verify_qualified_matter',
  'finalise_practitioner_interpretation',
  'close_safety_review',
  'sign_or_release_protocol',
  'mark_branch_no_longer_relevant',
  'finish_section',
] as const
export type CockpitCapability = (typeof COCKPIT_CAPABILITIES)[number]

/** Capabilities a student holds. Everything else is refused. */
export const STUDENT_CAPABILITIES: readonly CockpitCapability[] = [
  'capture_client_answer',
  'record_client_words',
  'add_attributed_observation_draft',
  'save_and_pause',
  'submit_for_supervision',
  'ask_safety_question',
]

/**
 * A student may ASK a safety question and record the answer — withholding the
 * question would be worse than a student asking it. What they may not do is
 * close the review it raises.
 */
export const STUDENT_MAY_ASK_SAFETY_QUESTIONS = true as const

export interface CapabilityDecision {
  allowed: boolean
  /** Shown to the student. Explains the boundary rather than just refusing. */
  reason?: string
  /** True where the action is available to them as a supervised draft. */
  asDraft?: boolean
}

export function can(actor: CaptureActor, capability: CockpitCapability): CapabilityDecision {
  if (actor.role === 'system') {
    return { allowed: false, reason: 'NI does not capture or finalise clinical content.' }
  }
  if (actor.role === 'client') {
    return capability === 'capture_client_answer' || capability === 'record_client_words'
      ? { allowed: true }
      : { allowed: false, reason: 'This is a practitioner action.' }
  }
  if (actor.role === 'practitioner') {
    return { allowed: true }
  }

  // Student.
  if (!actor.supervisorId) {
    return {
      allowed: false,
      reason: 'A supervising practitioner must be recorded on this case before a student can capture.',
    }
  }
  if (STUDENT_CAPABILITIES.includes(capability)) {
    return { allowed: true, asDraft: capability === 'add_attributed_observation_draft' }
  }

  const reasons: Partial<Record<CockpitCapability, string>> = {
    verify_qualified_matter:
      'Verifying this needs a qualified practitioner. Capture what the client said and submit it for supervision.',
    finalise_practitioner_interpretation:
      'Interpretation is finalised by your supervising practitioner. Your notes are kept and attributed to you.',
    close_safety_review:
      'A safety review is closed by the supervising practitioner or Lead Responsible Practitioner, never automatically.',
    sign_or_release_protocol:
      'Signing a Protocol is the responsible practitioner\'s own professional act.',
    mark_branch_no_longer_relevant:
      'Retiring a line of questioning is a clinical judgement. Flag it for your supervisor instead.',
    finish_section:
      'Your supervising practitioner finishes the section after reviewing what you captured.',
  }
  return { allowed: false, reason: reasons[capability] ?? 'This action needs a qualified practitioner.' }
}

export function isStudent(actor: CaptureActor): boolean {
  return actor.role === 'student'
}

/** Every student entry is attributed. There is no anonymous capture. */
export function attributionLine(actor: CaptureActor, at: string): string {
  const when = new Date(at).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  if (actor.role === 'student') {
    return `${actor.displayName} · student · draft for supervision · ${when}`
  }
  if (actor.role === 'practitioner') return `${actor.displayName} · ${when}`
  if (actor.role === 'client') return `Client reported · ${when}`
  return `Recorded by NI · ${when}`
}

export interface SupervisionSubmission {
  caseId: string
  section: string
  studentId: string
  studentName: string
  supervisorId: string
  submittedAt: string
  /** Counts only. The clinical content stays in the case record. */
  draftAnswerCount: number
  openSafetyItemCount: number
  /** The student's own handover words. Theirs, never composed by NI. */
  handoverNote: string | null
}

export type SubmitResult =
  | { ok: true; submission: SupervisionSubmission }
  | { ok: false; reason: 'not_a_student' | 'no_supervisor' | 'nothing_to_submit' }

/**
 * Submit captured drafts for supervision.
 *
 * Does NOT close anything. It hands over, and the supervisor decides. Open
 * safety items are counted into the submission so they travel with it rather
 * than being left behind in a section the student has stopped looking at.
 */
export function submitForSupervision(args: {
  actor: CaptureActor
  caseId: string
  section: string
  at: string
  draftAnswerCount: number
  openSafetyItemCount: number
  handoverNote?: string
}): SubmitResult {
  if (args.actor.role !== 'student') return { ok: false, reason: 'not_a_student' }
  if (!args.actor.supervisorId) return { ok: false, reason: 'no_supervisor' }
  if (args.draftAnswerCount === 0 && args.openSafetyItemCount === 0) {
    return { ok: false, reason: 'nothing_to_submit' }
  }
  return {
    ok: true,
    submission: {
      caseId: args.caseId,
      section: args.section,
      studentId: args.actor.id,
      studentName: args.actor.displayName,
      supervisorId: args.actor.supervisorId,
      submittedAt: args.at,
      draftAnswerCount: args.draftAnswerCount,
      openSafetyItemCount: args.openSafetyItemCount,
      handoverNote: args.handoverNote?.trim() || null,
    },
  }
}
