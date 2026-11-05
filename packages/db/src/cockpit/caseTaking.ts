// ─── packages/db/src/cockpit/caseTaking.ts ──────────────────────────────────
// Who may complete case-taking, and who may sign it off.
//
// THE FOUNDER RULING THIS IMPLEMENTS (4 Nov 2026)
//
// Anyone NI has authorised to take a case operates in the Cockpit AS A
// PRACTITIONER. A supervised student may conduct case-taking, capture
// answers, amend, and add observations within scope. The difference is not
// what they can do during the consultation — it is AUTHORITY AT COMPLETION.
//
//   not the Lead  →  IN PROGRESS → SUBMITTED TO LEAD → LEAD REVIEW → SIGNED OFF
//   the Lead      →  IN PROGRESS → READY FOR SIGN-OFF → SIGNED OFF
//
// Sign-off is the Lead's own deliberate act. Until it happens the record is
// editable; after it, that signed version is immutable and a correction is an
// amendment creating the next revision, never an overwrite.
//
// ── THIS IS NOT PROTOCOL SIGNING ────────────────────────────────────────────
//
// intakeV2/protocolSigning.ts is the canonical guard for signing or releasing
// a PROTOCOL — a plan of care. This module is about the CASE-TAKING RECORD:
// the account of the consultation. They are different acts at different
// moments, and conflating them would mean either that taking a case commits
// you to a plan, or that a plan can be signed by whoever happened to write
// the notes.
//
// What they share is the AUTHORITY QUESTION, and that is deliberately reused
// rather than re-answered: "is this actor the Lead on this case" is settled by
// case_team_roles.team_role, the same column authoriseProtocolSigning reads
// through membership.teamRole, and the same vocabulary migration 0064 made
// role-aware. There is no second opinion about who the Lead is.
//
// ── VOCABULARY BOUNDARY — read before 'improving' this ──────────────────────
//
// CaseRole here is 'lead' | 'care_team' | 'student' — case_team_roles.team_role.
// It is NOT client_practitioner_links.role ('lead' | 'specialist' | 'reviewer'
// | 'temporary'), which is relationship metadata and carries no clinical
// authority. The two vocabularies share the word 'lead' and the architect has
// already ruled, in 0064, that the shared word does not make the concepts
// equivalent. Do not accept a link role here.
//
// ── NOTHING HERE PERSISTS ───────────────────────────────────────────────────
//
// This is the state machine and the authority rules, unit-tested. Storing a
// case-taking state needs a table that does not exist, and creating one needs
// Founder approval, so the Cockpit holds the state in the session exactly as
// it holds captured answers. The proposal is in the mission report.

import type { CaptureActor } from './capture'

// ─── Case role ───────────────────────────────────────────────────────────────

/** case_team_roles.team_role. The only vocabulary of clinical case authority. */
export const CASE_ROLES = ['lead', 'care_team', 'student'] as const
export type CaseRole = (typeof CASE_ROLES)[number]

export function isCaseRole(v: string): v is CaseRole {
  return (CASE_ROLES as readonly string[]).includes(v)
}

// ─── States ──────────────────────────────────────────────────────────────────

export const CASE_TAKING_STATES = [
  'in_progress',
  'submitted_to_lead',
  'lead_review',
  'ready_for_sign_off',
  'signed_off',
] as const
export type CaseTakingState = (typeof CASE_TAKING_STATES)[number]

/** What the practitioner sees. Plain, and the same words in every surface. */
export const CASE_TAKING_STATE_LABELS: Record<CaseTakingState, string> = {
  in_progress:        'In progress',
  submitted_to_lead:  'Submitted to Lead',
  lead_review:        'Lead review',
  ready_for_sign_off: 'Ready for sign-off',
  signed_off:         'Signed off',
}

/** Before sign-off the record is editable. After it, that version is not. */
export function isEditable(state: CaseTakingState): boolean {
  return state !== 'signed_off'
}

// ─── Who the actor is on THIS case ───────────────────────────────────────────

export interface CaseTakingActor {
  /** The capture actor — carries the display name and attribution. */
  actor: CaptureActor
  /** Their role on this case, from case_team_roles.team_role. */
  caseRole: CaseRole
}

export function isLead(a: CaseTakingActor): boolean {
  return a.caseRole === 'lead'
}

/**
 * Supervised practitioners present AS practitioners. The role pill reads
 * "Practitioner · Supervised", not "Student mode" — the founder's ruling is
 * that supervision is a qualifier on the same role, not a separate product
 * experience. The governance underneath is unchanged: a student still cannot
 * sign off, and still cannot close a safety review.
 */
export function roleLabel(a: CaseTakingActor): string {
  if (a.caseRole === 'student') return 'Practitioner · Supervised'
  if (a.caseRole === 'lead') return 'Practitioner · Lead'
  return 'Practitioner'
}

// ─── The completion action available now ─────────────────────────────────────

export type CaseTakingAction =
  | 'submit_to_lead'
  | 'mark_ready_for_sign_off'
  | 'sign_off'
  | 'amend'
  | 'none'

export interface CompletionOffer {
  action: CaseTakingAction
  /** The button's words. State-aware: it says what will happen now. */
  label: string
  /** Why it is unavailable, where it is. Shown, not swallowed. */
  blockedReason: string | null
  /** Open safety reviews do not block; they change the wording. */
  leavesReviewOpen: boolean
}

/**
 * The ONE meaningful action for this actor, in this state, right now.
 *
 * One action, not seven. Where an action is unavailable the reason is
 * returned rather than the button simply being absent — a practitioner who
 * cannot finish needs to know why, and "the button is missing" is not an
 * explanation.
 *
 * Open safety reviews never prevent completion. They are carried into the
 * wording, because a Lead signing off needs to know an open review travels
 * with it, and a section that silently claims to be complete while a red flag
 * is unresolved is the exact failure this is written against.
 */
export function completionOffer(
  a: CaseTakingActor,
  state: CaseTakingState,
  openSafetyReviews: number,
): CompletionOffer {
  const leavesReviewOpen = openSafetyReviews > 0
  const suffix = leavesReviewOpen ? ' · review remains open' : ''

  if (state === 'signed_off') {
    return isLead(a)
      ? { action: 'amend', label: 'Amend — creates a new version', blockedReason: null, leavesReviewOpen }
      : {
          action: 'none',
          label: 'Signed off',
          blockedReason: 'This case-taking record is signed off. Only the Lead Responsible Practitioner may amend it.',
          leavesReviewOpen,
        }
  }

  if (isLead(a)) {
    // The Lead's own path. Two steps: mark it ready, then deliberately sign.
    if (state === 'in_progress') {
      return { action: 'mark_ready_for_sign_off', label: `Ready for sign-off${suffix}`, blockedReason: null, leavesReviewOpen }
    }
    // Submitted by someone else, under review, or the Lead's own ready state.
    return { action: 'sign_off', label: `Sign off${suffix}`, blockedReason: null, leavesReviewOpen }
  }

  // Not the Lead — including a supervised practitioner.
  if (state === 'in_progress') {
    return { action: 'submit_to_lead', label: `Submit to Lead${suffix}`, blockedReason: null, leavesReviewOpen }
  }

  return {
    action: 'none',
    label: CASE_TAKING_STATE_LABELS[state],
    blockedReason: state === 'submitted_to_lead' || state === 'lead_review'
      ? 'With the Lead Responsible Practitioner. You can still add to the record.'
      : 'Only the Lead Responsible Practitioner may sign off case-taking.',
    leavesReviewOpen,
  }
}

// ─── Transitions ─────────────────────────────────────────────────────────────

export const CASE_TAKING_REFUSALS = [
  'not_the_lead',
  'wrong_state',
  'already_signed_off',
  'nothing_captured',
  'signer_not_attributed',
] as const
export type CaseTakingRefusalCode = (typeof CASE_TAKING_REFUSALS)[number]

export const CASE_TAKING_REFUSAL_MESSAGES: Record<CaseTakingRefusalCode, string> = {
  not_the_lead:          'Only the Lead Responsible Practitioner may do this.',
  wrong_state:           'The case-taking record is not in a state that permits this.',
  already_signed_off:    'This version is signed off. Create an amendment instead.',
  nothing_captured:      'There is nothing captured to submit.',
  signer_not_attributed: 'The sign-off must be attributed to the practitioner performing it.',
}

export interface CaseTakingRecord {
  caseId: string
  state: CaseTakingState
  /** 1 for the first record; each amendment after sign-off increments it. */
  revision: number
  /** Set once, on sign-off. Never cleared — an amendment starts a new revision. */
  signedOffBy: string | null
  signedOffAt: string | null
  /** Who last handed it on, and when. */
  submittedBy: string | null
  submittedAt: string | null
  /** Append-only. Every transition, attributed and dated. */
  history: CaseTakingEvent[]
}

export interface CaseTakingEvent {
  at: string
  action: CaseTakingAction
  from: CaseTakingState
  to: CaseTakingState
  actorId: string
  actorDisplayName: string
  caseRole: CaseRole
  /** Open safety reviews at the moment of the transition. Recorded, not hidden. */
  openSafetyReviews: number
}

export type CaseTakingResult =
  | { ok: true; record: CaseTakingRecord }
  | { ok: false; code: CaseTakingRefusalCode; message: string }

export function newCaseTakingRecord(caseId: string): CaseTakingRecord {
  return {
    caseId,
    state: 'in_progress',
    revision: 1,
    signedOffBy: null,
    signedOffAt: null,
    submittedBy: null,
    submittedAt: null,
    history: [],
  }
}

const refuse = (code: CaseTakingRefusalCode): CaseTakingResult =>
  ({ ok: false, code, message: CASE_TAKING_REFUSAL_MESSAGES[code] })

function withEvent(
  record: CaseTakingRecord,
  a: CaseTakingActor,
  action: CaseTakingAction,
  to: CaseTakingState,
  at: string,
  openSafetyReviews: number,
  patch: Partial<CaseTakingRecord> = {},
): CaseTakingRecord {
  return {
    ...record,
    ...patch,
    state: to,
    history: [
      ...record.history,
      {
        at, action, from: record.state, to,
        actorId: a.actor.id,
        actorDisplayName: a.actor.displayName,
        caseRole: a.caseRole,
        openSafetyReviews,
      },
    ],
  }
}

export interface TransitionInput {
  record: CaseTakingRecord
  actor: CaseTakingActor
  at: string
  /** Counts only. The clinical content stays in the case record. */
  capturedAnswers: number
  openSafetyReviews: number
}

/**
 * A non-Lead hands the case-taking record to the Lead.
 *
 * Available to a supervised practitioner as well as a qualified one: the
 * founder's ruling is that a supervised practitioner completes their part of
 * case-taking like anyone else. Submission closes nothing and decides
 * nothing — it hands over, and the Lead decides.
 */
export function submitToLead(input: TransitionInput): CaseTakingResult {
  const { record, actor, at, capturedAnswers, openSafetyReviews } = input
  if (record.state === 'signed_off') return refuse('already_signed_off')
  if (isLead(actor)) return refuse('wrong_state')
  if (record.state !== 'in_progress') return refuse('wrong_state')
  if (capturedAnswers === 0) return refuse('nothing_captured')

  return {
    ok: true,
    record: withEvent(record, actor, 'submit_to_lead', 'submitted_to_lead', at, openSafetyReviews, {
      submittedBy: actor.actor.id,
      submittedAt: at,
    }),
  }
}

/** The Lead opens what was submitted. A read step, recorded because the
 *  question "did the Lead look at this before signing" must be answerable. */
export function beginLeadReview(input: TransitionInput): CaseTakingResult {
  const { record, actor, at, openSafetyReviews } = input
  if (record.state === 'signed_off') return refuse('already_signed_off')
  if (!isLead(actor)) return refuse('not_the_lead')
  if (record.state !== 'submitted_to_lead') return refuse('wrong_state')

  return { ok: true, record: withEvent(record, actor, 'none', 'lead_review', at, openSafetyReviews) }
}

/** The Lead, having taken the case themselves, marks it ready for their own
 *  deliberate sign-off. Two steps on purpose: finishing the notes and
 *  accepting clinical responsibility are not the same keystroke. */
export function markReadyForSignOff(input: TransitionInput): CaseTakingResult {
  const { record, actor, at, capturedAnswers, openSafetyReviews } = input
  if (record.state === 'signed_off') return refuse('already_signed_off')
  if (!isLead(actor)) return refuse('not_the_lead')
  if (record.state !== 'in_progress') return refuse('wrong_state')
  if (capturedAnswers === 0) return refuse('nothing_captured')

  return { ok: true, record: withEvent(record, actor, 'mark_ready_for_sign_off', 'ready_for_sign_off', at, openSafetyReviews) }
}

/**
 * The Lead signs off. The only transition that makes a version immutable.
 *
 * Refuses from 'in_progress': the Lead must have either received a submission
 * or marked their own work ready. Signing straight out of an in-progress
 * record would make sign-off a side effect of finishing typing.
 */
export function signOff(input: TransitionInput & { signedBy: string | null }): CaseTakingResult {
  const { record, actor, at, openSafetyReviews, signedBy } = input
  if (record.state === 'signed_off') return refuse('already_signed_off')
  if (!isLead(actor)) return refuse('not_the_lead')
  if (!signedBy || signedBy !== actor.actor.id) return refuse('signer_not_attributed')
  if (record.state === 'in_progress') return refuse('wrong_state')

  return {
    ok: true,
    record: withEvent(record, actor, 'sign_off', 'signed_off', at, openSafetyReviews, {
      signedOffBy: signedBy,
      signedOffAt: at,
    }),
  }
}

/**
 * Amend after sign-off. Creates the NEXT revision in progress; the signed
 * version it supersedes is untouched, and its signature is not carried
 * forward — a new version needs its own sign-off.
 */
export function amendAfterSignOff(input: TransitionInput): CaseTakingResult {
  const { record, actor, at, openSafetyReviews } = input
  if (record.state !== 'signed_off') return refuse('wrong_state')
  if (!isLead(actor)) return refuse('not_the_lead')

  return {
    ok: true,
    record: withEvent(record, actor, 'amend', 'in_progress', at, openSafetyReviews, {
      revision: record.revision + 1,
      signedOffBy: null,
      signedOffAt: null,
      submittedBy: null,
      submittedAt: null,
    }),
  }
}

/** Apply whichever transition the offer named. One entry point for the UI. */
export function applyCompletion(
  action: CaseTakingAction,
  input: TransitionInput & { signedBy?: string | null },
): CaseTakingResult {
  switch (action) {
    case 'submit_to_lead':          return submitToLead(input)
    case 'mark_ready_for_sign_off': return markReadyForSignOff(input)
    case 'sign_off':                return signOff({ ...input, signedBy: input.signedBy ?? input.actor.actor.id })
    case 'amend':                   return amendAfterSignOff(input)
    case 'none':                    return refuse('wrong_state')
  }
}
