// ─── packages/db/src/cockpit/caseTakingSignOff.ts ────────────────────────────
// THE canonical authorisation guard for signing off a CASE-TAKING record,
// and the single write path that performs the signature.
//
// WHY IT EXISTS. Migration 0066 adds a database trigger
// (enforce_case_taking_authority) that gates end-user sessions. Like the live
// Protocol trigger it copies, that trigger returns early when
// auth.uid() IS NULL, because RLS and triggers are end-user controls and a
// service-role caller has no uid. So BEING SERVER-SIDE MUST NEVER, ON ITS
// OWN, BE SUFFICIENT TO SIGN. This guard is what makes server-side signing
// safe, and it must run before every privileged write.
//
// ── IT DOES NOT IMPLEMENT ELIGIBILITY, AND IT DOES NOT RESTATE THE STATE
//    MACHINE ───────────────────────────────────────────────────────────────
//
// Two authorities are delegated, never re-derived:
//
//   ROLE + ELIGIBILITY  practitioner_eligibility(actor, 'lead') — the live
//                       role-aware function from 0064. Its verdict is final.
//   WORKFLOW STATE      SIGNABLE_CASE_TAKING_STATES, derived from the
//                       transition rules already in ./caseTaking, which are
//                       unit-tested there. A second state machine is exactly
//                       what must not exist.
//
// ── WHAT IT IS NOT ──────────────────────────────────────────────────────────
//
// This is NOT Protocol signing. intakeV2/protocolSigning.ts guards signing a
// PROTOCOL — adopting a plan of care. Case-taking sign-off asserts "this is
// the reviewed record of the consultation". Accordingly:
//
//   * sole_unregistered_lead is DELIBERATELY ABSENT. It is a Protocol-specific
//     application rule and stays Protocol-only. An NI Verified Practitioner
//     who is the active, eligible Lead may sign a case-taking record.
//   * practitioner_classes are not consulted at all, for the same reason.
//
// ── VOCABULARY BOUNDARY ─────────────────────────────────────────────────────
//
// Clinical case authority is case_team_roles.team_role ('lead' | 'care_team' |
// 'student') and nothing else. It is NOT client_practitioner_links.role
// ('lead' | 'specialist' | 'reviewer' | 'temporary'), which is relationship
// metadata carrying no clinical authority. The two vocabularies share the word
// 'lead'; the architect ruled in 0064 that the shared word does not make the
// concepts equivalent. The resolver below reads case_team_roles only, and a
// link role must never be passed in here.
//
// ── FAIL-CLOSED ─────────────────────────────────────────────────────────────
//
// Every check refuses by default. A missing input is a refusal. A failed
// lookup is a refusal, never a pass.

import type { CaseTakingActorRole as CaptureActorRole } from './caseTakingActor'
import type { CaseRole, CaseTakingState } from './caseTaking'
import type { Database } from '../types'

export const CASE_TAKING_SIGNOFF_GUARD_VERSION = 'case-taking-signoff-guard.v1'

/**
 * The states a deliberate sign-off may proceed from.
 *
 * 'in_progress' is absent on purpose, matching signOff() in ./caseTaking: the
 * Lead must have either received a submission or marked their own work ready.
 * Signing straight out of an in-progress record would make sign-off a side
 * effect of finishing typing.
 */
export const SIGNABLE_CASE_TAKING_STATES: readonly CaseTakingState[] = [
  'submitted_to_lead', 'lead_review', 'ready_for_sign_off',
]

/** The one role that may sign. Kept as a constant so the check is greppable. */
export const SIGNING_CASE_ROLE: CaseRole = 'lead'

export const CASE_TAKING_SIGNOFF_REFUSALS = [
  'no_actor',
  'actor_not_practitioner',
  'signer_not_attributed',
  'case_not_identified',
  'session_not_found',
  'already_signed',
  'state_forbids_sign_off',
  'role_lookup_failed',
  'no_active_case_role',
  'not_lead',
  'not_eligible',
] as const
export type CaseTakingSignOffRefusalCode = (typeof CASE_TAKING_SIGNOFF_REFUSALS)[number]

export const CASE_TAKING_SIGNOFF_REFUSAL_MESSAGES:
  Record<CaseTakingSignOffRefusalCode, string> = {
  no_actor:               'No acting practitioner was supplied.',
  actor_not_practitioner: 'Only a practitioner may sign off a case-taking record.',
  signer_not_attributed:  'The sign-off must be attributed to the practitioner performing it.',
  case_not_identified:    'The case-taking session is not linked to a case, so no Lead can be established.',
  session_not_found:      'The case-taking session could not be read.',
  already_signed:         'This version is already signed off. Create an amendment instead.',
  state_forbids_sign_off: 'The case-taking record is not in a state that permits sign-off.',
  role_lookup_failed:     'The practitioner’s role on this case could not be established.',
  no_active_case_role:    'The practitioner has no active role on this case.',
  not_lead:               'Only the Lead Responsible Practitioner may sign off case-taking.',
  not_eligible:           'The practitioner does not currently pass Lead eligibility.',
}

/** Mirrors the live practitioner_eligibility(uuid, text) columns this reads. */
export interface LeadEligibilityVerdict {
  eligible: boolean
  blockers: string[]
}

/**
 * Resolves the actor's ACTIVE role on the case from case_team_roles.
 * `'lookup_failed'` is distinct from `null`: an unreadable role is not the
 * same as a known absence, and both refuse but for different reasons.
 */
export type ActiveCaseRoleResolver =
  (caseId: string, practitionerId: string) => Promise<CaseRole | null | 'lookup_failed'>

export type LeadEligibilityResolver =
  (practitionerId: string) => Promise<LeadEligibilityVerdict>

export interface CaseTakingSignOffDeps {
  activeCaseRole: ActiveCaseRoleResolver
  leadEligibility: LeadEligibilityResolver
}

/** The session as read immediately before signing. */
export interface CaseTakingSessionUnderSignature {
  id: string
  caseId: string | null
  state: CaseTakingState | null
  /** Non-null means already signed. */
  signedOffAt: string | null
  /** Optimistic concurrency token, passed through to the write. */
  revision: number | null
}

export interface CaseTakingSignOffRequest {
  actor: { practitionerId: string | null; role: CaptureActorRole }
  /** Who the signature will be attributed to. Must equal the actor. */
  signedOffBy: string | null
  session: CaseTakingSessionUnderSignature
  at: string
}

export interface CaseTakingSignOffRefusal {
  code: CaseTakingSignOffRefusalCode
  message: string
  /** Carried verbatim from the eligibility authority when it refused. */
  blockers?: string[]
}

export interface CaseTakingSignOffAttribution {
  sessionId: string
  caseId: string
  signedOffBy: string
  caseRole: CaseRole
  at: string
  /** The revision the decision was made against, for the conditional write. */
  revision: number | null
  guardVersion: string
}

export type CaseTakingSignOffAuthorisation =
  | { authorised: true; attribution: CaseTakingSignOffAttribution }
  | { authorised: false; refusal: CaseTakingSignOffRefusal }

const refuse = (
  code: CaseTakingSignOffRefusalCode, blockers?: string[],
): CaseTakingSignOffAuthorisation => ({
  authorised: false,
  refusal: {
    code,
    message: CASE_TAKING_SIGNOFF_REFUSAL_MESSAGES[code],
    ...(blockers ? { blockers } : {}),
  },
})

/**
 * Decide whether this case-taking sign-off may proceed. Returns a decision —
 * it performs no write and has no side effect.
 *
 * The six requirements, in the order checked:
 *
 *   A  an authenticated practitioner actor          no_actor / actor_not_practitioner
 *   D  signed_off_by is the actor                   signer_not_attributed
 *   F  the session is not already signed            already_signed
 *   E  the session is in a signable state           state_forbids_sign_off
 *   B  active case_team_roles.team_role = 'lead'    no_active_case_role / not_lead
 *   C  practitioner_eligibility(actor,'lead')       not_eligible
 *
 * Cheap local checks run before the two lookups so an obviously invalid
 * request costs no database round-trip. Order affects only which refusal is
 * reported first; every check is independent and all must pass.
 */
export async function authoriseCaseTakingSignOff(
  request: CaseTakingSignOffRequest,
  deps: CaseTakingSignOffDeps,
): Promise<CaseTakingSignOffAuthorisation> {
  const { actor, signedOffBy, session } = request

  // ── A. Authenticated practitioner identity ──
  // A service-role or automated caller has no practitioner identity and the
  // 'system' capture role, so it cannot pass this gate however it is wrapped.
  if (!actor.practitionerId) return refuse('no_actor')
  if (actor.role !== 'practitioner') return refuse('actor_not_practitioner')

  // ── D. The signature is attributed to the actor, explicitly ──
  if (!signedOffBy) return refuse('signer_not_attributed')
  if (signedOffBy !== actor.practitionerId) return refuse('signer_not_attributed')

  // ── Session identity ──
  if (session.state === null) return refuse('session_not_found')
  if (!session.caseId) return refuse('case_not_identified')

  // ── F. Not already signed ──
  if (session.signedOffAt !== null) return refuse('already_signed')
  if (session.state === 'signed_off') return refuse('already_signed')

  // ── E. A state that permits a deliberate sign-off ──
  if (!SIGNABLE_CASE_TAKING_STATES.includes(session.state)) {
    return refuse('state_forbids_sign_off')
  }

  // ── B. Active Lead on THIS case, from case_team_roles ──
  const caseRole = await deps.activeCaseRole(session.caseId, actor.practitionerId)
  if (caseRole === 'lookup_failed') return refuse('role_lookup_failed')
  if (caseRole === null) return refuse('no_active_case_role')
  if (caseRole !== SIGNING_CASE_ROLE) return refuse('not_lead')

  // ── C. Eligibility: delegated, final, never re-derived here ──
  const verdict = await deps.leadEligibility(actor.practitionerId)
  if (!verdict || verdict.eligible !== true) {
    return refuse('not_eligible', verdict?.blockers ?? ['eligibility_unavailable'])
  }

  return {
    authorised: true,
    attribution: {
      sessionId: session.id,
      caseId: session.caseId,
      signedOffBy,
      caseRole,
      at: request.at,
      revision: session.revision,
      guardVersion: CASE_TAKING_SIGNOFF_GUARD_VERSION,
    },
  }
}

export class CaseTakingSignOffRefused extends Error {
  readonly code: CaseTakingSignOffRefusalCode
  readonly blockers?: string[]
  constructor(refusal: CaseTakingSignOffRefusal) {
    super(refusal.message)
    this.name = 'CaseTakingSignOffRefused'
    this.code = refusal.code
    this.blockers = refusal.blockers
  }
}

/**
 * Throwing form, for call sites that should simply not continue. Mirrors
 * assertProtocolSigningAuthorised.
 */
export async function assertCaseTakingSignOffAuthorised(
  request: CaseTakingSignOffRequest,
  deps: CaseTakingSignOffDeps,
): Promise<CaseTakingSignOffAttribution> {
  const decision = await authoriseCaseTakingSignOff(request, deps)
  if (!decision.authorised) throw new CaseTakingSignOffRefused(decision.refusal)
  return decision.attribution
}

// ─── Production resolvers ────────────────────────────────────────────────────

/**
 * The client surface these resolvers need.
 *
 * Narrow by design rather than `SupabaseClient<Database>`: this module is
 * reached from the cockpit barrel, which a client component may import, and
 * the guard is a decision function that should be callable with a stub in
 * tests. It asks for exactly the two operations it performs.
 *
 * `case_taking_sessions` and `case_taking_answers` now exist in the generated
 * Database types (regenerated from the live catalogue after 0066 was applied
 * on 7 November 2026), so `Tables` below is real: a typo in a table name is a
 * compile error, not a runtime surprise. The earlier `from: (t: string) => any`
 * placeholder — which existed only because the tables were not yet in the
 * catalogue — is gone.
 */

/** Table names this module is permitted to touch. */
export type SignOffTable = Extract<
  keyof Database['public']['Tables'],
  'case_taking_sessions' | 'case_team_roles'
>

/** The chainable surface actually used: filters, then a returning select. */
export interface SignOffQuery {
  select: (cols: string) => SignOffQuery
  update: (patch: Record<string, unknown>) => SignOffQuery
  eq: (col: string, val: unknown) => SignOffQuery
  is: (col: string, val: null) => SignOffQuery
  limit: (n: number) => Promise<{ data: unknown; error: unknown }>
  then: (
    resolve: (value: { data: unknown; error: unknown }) => unknown,
  ) => unknown
}

export interface SignOffClient {
  from: (table: SignOffTable) => SignOffQuery
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>
}

/**
 * The production role resolver: the ACTIVE row in case_team_roles.
 *
 * `ended_at IS NULL` is the activity rule, matching
 * can_access_case_care_profile and enforce_case_taking_authority. It reads
 * case_team_roles and NOTHING ELSE — in particular never
 * client_practitioner_links, whose `role` column is relationship metadata.
 *
 * Any failure to obtain a role is 'lookup_failed', a refusal.
 */
export function caseTeamRoleResolver(client: SignOffClient): ActiveCaseRoleResolver {
  return async (caseId, practitionerId) => {
    const { data, error } = await client
      .from('case_team_roles')
      .select('team_role')
      .eq('case_id', caseId)
      .eq('practitioner_id', practitionerId)
      .is('ended_at', null)
      .limit(1)
    if (error) return 'lookup_failed'
    const rows = Array.isArray(data) ? (data as { team_role?: unknown }[]) : []
    const role = rows[0]?.team_role
    if (typeof role !== 'string') return null
    return role as CaseRole
  }
}

/**
 * The production eligibility resolver: the live role-aware function from
 * 0064, asked specifically about 'lead'. Its verdict is final and nothing
 * here re-derives credentials, indemnity, scope or agreement state.
 *
 * Any failure to obtain a verdict is a refusal, not a pass.
 */
export function leadEligibilityResolver(client: SignOffClient): LeadEligibilityResolver {
  return async (practitionerId) => {
    const { data, error } = await client.rpc(
      'practitioner_eligibility',
      { p_practitioner_id: practitionerId, p_case_role: SIGNING_CASE_ROLE },
    )
    if (error) return { eligible: false, blockers: ['eligibility_lookup_failed'] }
    const row = Array.isArray(data)
      ? (data[0] as { eligible?: unknown; blockers?: unknown } | undefined)
      : (data as { eligible?: unknown; blockers?: unknown } | null)
    if (!row) return { eligible: false, blockers: ['eligibility_no_result'] }
    return {
      eligible: row.eligible === true,
      blockers: Array.isArray(row.blockers) ? (row.blockers as string[]) : [],
    }
  }
}

// ─── THE ONE WRITE PATH ──────────────────────────────────────────────────────

export type CaseTakingSignOffOutcome =
  | { signed: true; attribution: CaseTakingSignOffAttribution }
  | { signed: false; refusal: CaseTakingSignOffRefusal }

/** The same surface; named separately only to document intent at call sites. */
export type SignOffWriteClient = SignOffClient

/**
 * Sign off a case-taking session. THE ONLY SUPPORTED WAY to set
 * signed_off_at / signed_off_by, and the only place in the codebase that
 * writes either column.
 *
 * There is deliberately no "force", no "skipAuthorisation" and no variant
 * that takes a pre-computed attribution: a bypass helper is how a guard stops
 * being a guard. A structural test asserts no other module writes those
 * columns.
 *
 * Three independent defences, in order:
 *   1. authoriseCaseTakingSignOff() — this guard, which covers the
 *      service-role path that RLS and the trigger cannot.
 *   2. The conditional UPDATE below — `signed_off_at IS NULL` and the
 *      revision token, so a session signed or edited since it was read
 *      affects zero rows rather than being overwritten.
 *   3. enforce_case_taking_authority() in the database, for end-user
 *      sessions. Defence in depth, not a substitute for 1.
 */
export async function signOffCaseTakingSession(
  client: SignOffWriteClient,
  request: CaseTakingSignOffRequest,
  deps?: Partial<CaseTakingSignOffDeps>,
): Promise<CaseTakingSignOffOutcome> {
  const resolved: CaseTakingSignOffDeps = {
    activeCaseRole: deps?.activeCaseRole ?? caseTeamRoleResolver(client),
    leadEligibility: deps?.leadEligibility ?? leadEligibilityResolver(client),
  }

  const decision = await authoriseCaseTakingSignOff(request, resolved)
  if (!decision.authorised) return { signed: false, refusal: decision.refusal }

  const { attribution } = decision

  let query: SignOffQuery = client.from('case_taking_sessions')
    .update({
      state: 'signed_off',
      signed_off_by: attribution.signedOffBy,
      signed_off_at: attribution.at,
    })
    .eq('id', attribution.sessionId)
    .is('signed_off_at', null)

  if (attribution.revision !== null) {
    query = query.eq('revision', attribution.revision)
  }

  const { data, error } = await query.select('id')

  if (error) return { signed: false, refusal: { code: 'already_signed', message: String(error) } }
  const rows = Array.isArray(data) ? data : []
  if (rows.length === 0) {
    // Signed or edited between the read and the write. Report it rather than
    // claiming a signature that did not happen.
    return {
      signed: false,
      refusal: {
        code: 'already_signed',
        message: CASE_TAKING_SIGNOFF_REFUSAL_MESSAGES.already_signed,
      },
    }
  }

  return { signed: true, attribution }
}
