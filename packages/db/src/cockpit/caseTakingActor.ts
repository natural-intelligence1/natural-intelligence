// ─── packages/db/src/cockpit/caseTakingActor.ts ──────────────────────────────
// Who is acting, for case-taking purposes.
//
// WHY THIS FILE EXISTS. These two declarations previously lived in
// ./capture.ts, and caseTaking.ts / caseTakingSignOff.ts imported them from
// there as types. That was free at runtime but not at module level:
// capture.ts has runtime imports from ./mappingPack, ./pilot and
// ./diggingEdges, so the case-taking state machine and its sign-off guard
// could not be compiled without roughly two thousand lines of Consultation
// Cockpit pilot code coming with them.
//
// The case-taking persistence release is a BACKEND foundation. Dragging the
// Cockpit pilot into it to satisfy two type aliases would have meant
// releasing code the architect explicitly held back. So the declarations are
// extracted here, where both the state machine and the guard can reach them
// and nothing else is required.
//
// CaptureActor in ./capture.ts (on the UX branch) is structurally the same
// shape. When that branch is reconciled, capture.ts should re-export these
// rather than redeclare them — one definition, not two that drift.

/** Who put something in the record. Mirrors CAPTURE_ACTOR_ROLES. */
export const CASE_TAKING_ACTOR_ROLES = [
  'practitioner', 'student', 'client', 'system',
] as const

export type CaseTakingActorRole = (typeof CASE_TAKING_ACTOR_ROLES)[number]

export function isCaseTakingActorRole(v: string): v is CaseTakingActorRole {
  return (CASE_TAKING_ACTOR_ROLES as readonly string[]).includes(v)
}

/**
 * The acting person, carrying the display name used for attribution.
 *
 * `role` is NOT clinical case authority — that is case_team_roles.team_role,
 * resolved separately. This says what kind of participant they are; a
 * 'system' actor can never sign off, which is the first gate in
 * authoriseCaseTakingSignOff.
 */
export interface CaseTakingActorIdentity {
  id: string
  displayName: string
  role: CaseTakingActorRole
  /** Required for a student. The supervision relationship stays explicit. */
  supervisorId?: string | null
}
