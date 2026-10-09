// ─── packages/db/src/intakeV2/protocolSigning.ts ─────────────────────────────
// THE canonical authorisation guard for signing or releasing a Protocol.
//
// Every server-side signing entry point must call this BEFORE the privileged
// database write. Migration 0059 adds a database trigger that gates end-user
// sessions, but service-role callers bypass RLS by design — so being
// server-side must never, on its own, be sufficient to sign. This guard is
// what makes server-side signing safe.
//
// ── IT DOES NOT IMPLEMENT ELIGIBILITY ───────────────────────────────────────
//
// There is exactly one eligibility authority: the live database function
//   practitioner_assignment_eligibility(uuid) -> TABLE(eligible, reasons)
// which already enforces active status, class determined, CURRENT AGREEMENT
// ACCEPTANCE, credential verification, INDEMNITY present and in date, and
// registration for registered classes. This guard DELEGATES to it through an
// injected resolver and treats its verdict as final. Nothing here re-derives
// any of those rules — a second eligibility system is exactly what must not
// exist.
//
// Likewise the care-team rules are reused, not restated: CareTeamMembership
// and its guards come from ./careTeam, and the actor rule from
// ./governanceControls (canSignClinicalConclusions).
//
// ── FAIL-CLOSED ─────────────────────────────────────────────────────────────
//
// Every check refuses by default. A missing input is a refusal, never a pass.

import type { V2Actor } from './governanceControls'
import { canSignClinicalConclusions } from './governanceControls'
import type { CareTeamMembership } from './careTeam'
import { isMembershipVisible } from './careTeam'

export const PROTOCOL_SIGNING_GUARD_VERSION = 'protocol-signing-guard.v1'

/** Mirrors live `practitioners.category` (text). Labels live in
 *  practitioners/credentialing.ts — this is the value set, not a second model.
 *  'unregistered' is the NI Verified Practitioner class. */
export const PRACTITIONER_CLASSES = [
  'regulated_clinician', 'voluntary_registered', 'unregistered',
] as const
export type PractitionerClass = (typeof PRACTITIONER_CLASSES)[number]

/** Classes that may carry sole clinical responsibility for a signed Protocol. */
const CLASSES_THAT_MAY_BE_SOLE_LEAD: readonly PractitionerClass[] = [
  'regulated_clinician', 'voluntary_registered',
]

export const SIGNING_REFUSAL_CODES = [
  'no_actor',
  'actor_cannot_sign',
  'student_cannot_sign',
  'signer_not_attributed',
  'author_not_explicit',
  'version_not_explicit',
  'already_signed',
  'superseded',
  'case_not_linked',
  'case_state_forbids_signing',
  'no_active_case_role',
  'not_lead',
  'sole_unregistered_lead',
  'not_eligible',
] as const
export type SigningRefusalCode = (typeof SIGNING_REFUSAL_CODES)[number]

export const SIGNING_REFUSAL_MESSAGES: Record<SigningRefusalCode, string> = {
  no_actor:                   'No acting practitioner was supplied.',
  actor_cannot_sign:          'Only a practitioner may sign clinical conclusions.',
  student_cannot_sign:        'A Student Practitioner cannot sign a Protocol.',
  signer_not_attributed:      'The signature must be attributed to the practitioner performing the action.',
  author_not_explicit:        'The signatory must be stated explicitly.',
  version_not_explicit:       'The protocol version being signed must be stated explicitly.',
  already_signed:             'This protocol version is already signed. Create a revision instead.',
  superseded:                 'This protocol version has been superseded and cannot be signed.',
  case_not_linked:            'The protocol is not linked to a case, so no Lead can be established.',
  case_state_forbids_signing: 'The case is not in a state that permits signing.',
  no_active_case_role:        'The practitioner has no active role on this case.',
  not_lead:                   'Only the Lead Responsible Practitioner may sign the Protocol.',
  sole_unregistered_lead:     'An NI Verified Practitioner cannot sign as the sole Lead Responsible Practitioner.',
  not_eligible:               'The practitioner does not currently pass assignment eligibility.',
}

/** The authoritative verdict shape — matches the live DB function exactly. */
export interface EligibilityVerdict {
  eligible: boolean
  reasons: string[]
}

/** Injected so the guard DELEGATES rather than duplicates. In production this
 *  is backed by practitioner_assignment_eligibility(); in tests it is stubbed. */
export type EligibilityResolver = (practitionerId: string) => Promise<EligibilityVerdict>

export type CaseSigningState = 'open' | 'closed' | 'archived'

export interface ProtocolUnderSignature {
  id: string
  /** Explicit — the guard refuses to sign an unstated version. */
  version: number | null
  /** Null when unsigned. Non-null means already signed. */
  signedAt: string | null
  /** True when another version already supersedes this one. */
  isSuperseded: boolean
}

export interface ProtocolSigningRequest {
  actor: { practitionerId: string | null; role: V2Actor }
  /** Who the signature will be attributed to. Must equal the actor. */
  signedBy: string | null
  caseId: string | null
  caseState: CaseSigningState
  protocol: ProtocolUnderSignature
  /** The case's care team, from the existing care-team model. */
  team: CareTeamMembership[]
  /** practitionerId → live practitioners.category, for the sole-LRP rule. */
  practitionerClasses: Record<string, PractitionerClass>
  at: string
}

export interface SigningRefusal {
  code: SigningRefusalCode
  message: string
  /** Carried verbatim from the eligibility authority when it refused. */
  eligibilityReasons?: string[]
}

export interface SigningAttribution {
  protocolId: string
  version: number
  signedBy: string
  caseId: string
  at: string
  guardVersion: string
}

export type SigningAuthorisation =
  | { authorised: true; attribution: SigningAttribution }
  | { authorised: false; refusal: SigningRefusal }

const refuse = (
  code: SigningRefusalCode, eligibilityReasons?: string[],
): SigningAuthorisation => ({
  authorised: false,
  refusal: { code, message: SIGNING_REFUSAL_MESSAGES[code], ...(eligibilityReasons ? { eligibilityReasons } : {}) },
})

/**
 * Decide whether this Protocol signature may proceed. Returns a decision —
 * it performs no write and has no side effect.
 *
 * Order matters only for which refusal is reported first; every check is
 * independent and all must pass.
 */
export async function authoriseProtocolSigning(
  request: ProtocolSigningRequest,
  deps: { eligibility: EligibilityResolver },
): Promise<SigningAuthorisation> {
  const { actor, signedBy, caseId, caseState, protocol, team, practitionerClasses } = request

  // ── Actor ──
  if (!actor.practitionerId) return refuse('no_actor')
  if (!canSignClinicalConclusions(actor.role)) return refuse('actor_cannot_sign')

  // ── Attribution is explicit and is the actor ──
  if (!signedBy) return refuse('author_not_explicit')
  if (signedBy !== actor.practitionerId) return refuse('signer_not_attributed')
  if (!Number.isInteger(protocol.version) || (protocol.version as number) < 1) {
    return refuse('version_not_explicit')
  }

  // ── Content state ──
  if (protocol.signedAt !== null) return refuse('already_signed')
  if (protocol.isSuperseded) return refuse('superseded')

  // ── Case state ──
  if (!caseId) return refuse('case_not_linked')
  if (caseState !== 'open') return refuse('case_state_forbids_signing')

  // ── Role on the case (reusing the care-team model) ──
  const membership = team.find(
    (m) => m.practitionerId === actor.practitionerId && isMembershipVisible(m))
  if (!membership) return refuse('no_active_case_role')
  if (membership.teamRole === 'student') return refuse('student_cannot_sign')
  if (membership.teamRole !== 'lead') return refuse('not_lead')

  // ── Category 3: an NI Verified Practitioner cannot be the sole LRP ──
  const signerClass = practitionerClasses[actor.practitionerId]
  if (!signerClass || !CLASSES_THAT_MAY_BE_SOLE_LEAD.includes(signerClass)) {
    const hasQualifiedColleague = team.some((m) =>
      m.practitionerId !== actor.practitionerId &&
      isMembershipVisible(m) &&
      m.teamRole !== 'student' &&
      CLASSES_THAT_MAY_BE_SOLE_LEAD.includes(practitionerClasses[m.practitionerId]))
    if (!hasQualifiedColleague) return refuse('sole_unregistered_lead')
  }

  // ── Eligibility: delegated, final, never re-derived here ──
  const verdict = await deps.eligibility(actor.practitionerId)
  if (!verdict || verdict.eligible !== true) {
    return refuse('not_eligible', verdict?.reasons ?? ['eligibility_unavailable'])
  }

  return {
    authorised: true,
    attribution: {
      protocolId: protocol.id,
      version: protocol.version as number,
      signedBy,
      caseId,
      at: request.at,
      guardVersion: PROTOCOL_SIGNING_GUARD_VERSION,
    },
  }
}

export class ProtocolSigningRefused extends Error {
  readonly code: SigningRefusalCode
  readonly eligibilityReasons?: string[]
  constructor(refusal: SigningRefusal) {
    super(refusal.message)
    this.name = 'ProtocolSigningRefused'
    this.code = refusal.code
    this.eligibilityReasons = refusal.eligibilityReasons
  }
}

/**
 * Throwing form, for call sites that should simply not continue. Mirrors
 * assertPractitionerAssignable in the practitioners layer.
 *
 * Server-side signing entry points call THIS immediately before the
 * privileged write.
 */
export async function assertProtocolSigningAuthorised(
  request: ProtocolSigningRequest,
  deps: { eligibility: EligibilityResolver },
): Promise<SigningAttribution> {
  const decision = await authoriseProtocolSigning(request, deps)
  if (!decision.authorised) throw new ProtocolSigningRefused(decision.refusal)
  return decision.attribution
}

/**
 * The production resolver: the live eligibility function, unmodified.
 * Any failure to obtain a verdict is a refusal, not a pass.
 */
export function rpcEligibilityResolver(
  client: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> },
): EligibilityResolver {
  return async (practitionerId: string): Promise<EligibilityVerdict> => {
    const { data, error } = await client.rpc(
      'practitioner_assignment_eligibility', { p_practitioner_id: practitionerId })
    if (error) return { eligible: false, reasons: ['eligibility_lookup_failed'] }
    const row = Array.isArray(data) ? (data[0] as EligibilityVerdict | undefined) : (data as EligibilityVerdict | null)
    if (!row) return { eligible: false, reasons: ['eligibility_no_result'] }
    return { eligible: row.eligible === true, reasons: row.reasons ?? [] }
  }
}
