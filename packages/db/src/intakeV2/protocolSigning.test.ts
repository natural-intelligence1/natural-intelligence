// The canonical Protocol signing guard.
//
// The point of these tests: migration 0059's database trigger gates END-USER
// sessions, but service-role callers bypass RLS by design. So the application
// layer must refuse unauthorised signing even though the database technically
// could write. Every negative case below is exactly that scenario — a
// server-side caller holding full DB privilege, correctly refused.

import { describe, it, expect, vi } from 'vitest'
import {
  authoriseProtocolSigning, assertProtocolSigningAuthorised,
  ProtocolSigningRefused, rpcEligibilityResolver,
  PROTOCOL_SIGNING_GUARD_VERSION, SIGNING_REFUSAL_CODES, SIGNING_REFUSAL_MESSAGES,
  PRACTITIONER_CLASSES,
  type ProtocolSigningRequest, type EligibilityResolver, type PractitionerClass,
} from './protocolSigning'
import type { CareTeamMembership } from './careTeam'

const AT = '2026-10-09T10:00:00.000Z'
const LEAD = 'prac-lead'
const COLLEAGUE = 'prac-colleague'

const eligible: EligibilityResolver = async () => ({ eligible: true, reasons: [] })
const ineligible = (reasons: string[]): EligibilityResolver =>
  async () => ({ eligible: false, reasons })

const member = (over: Partial<CareTeamMembership> = {}): CareTeamMembership => ({
  practitionerId: LEAD,
  practitionerName: 'Amara Okafor',
  profession: 'Nutritional Therapist' as CareTeamMembership['profession'],
  teamRole: 'lead',
  assignment: { status: 'assigned', assignedBy: 'admin-1', assignedAt: AT },
  clientApproval: { status: 'approved', at: AT },
  ...over,
})

const req = (over: Partial<ProtocolSigningRequest> = {}): ProtocolSigningRequest => ({
  actor: { practitionerId: LEAD, role: 'practitioner' },
  signedBy: LEAD,
  caseId: 'case-1',
  caseState: 'open',
  protocol: { id: 'proto-1', version: 3, signedAt: null, isSuperseded: false },
  team: [member()],
  practitionerClasses: { [LEAD]: 'voluntary_registered' },
  at: AT,
  ...over,
})

// ─── The authorised path ─────────────────────────────────────────────────────

describe('authoriseProtocolSigning — the one path that is allowed', () => {
  it('A. an eligible active Lead, signing their own attributed version, is authorised', async () => {
    const d = await authoriseProtocolSigning(req(), { eligibility: eligible })
    expect(d.authorised).toBe(true)
    if (!d.authorised) return
    expect(d.attribution).toEqual({
      protocolId: 'proto-1', version: 3, signedBy: LEAD, caseId: 'case-1',
      at: AT, guardVersion: PROTOCOL_SIGNING_GUARD_VERSION,
    })
  })

  it('B. a regulated clinician Lead is equally authorised', async () => {
    const d = await authoriseProtocolSigning(
      req({ practitionerClasses: { [LEAD]: 'regulated_clinician' } }), { eligibility: eligible })
    expect(d.authorised).toBe(true)
  })

  it('C. the attribution records the explicit author and version', async () => {
    const d = await authoriseProtocolSigning(
      req({ protocol: { id: 'p9', version: 12, signedAt: null, isSuperseded: false } }),
      { eligibility: eligible })
    expect(d.authorised && d.attribution.version).toBe(12)
    expect(d.authorised && d.attribution.signedBy).toBe(LEAD)
  })
})

// ─── Negative: a fully-privileged server caller, correctly refused ───────────

describe('server-side callers are refused by the DOMAIN layer, not the database', () => {
  const cases: [string, Partial<ProtocolSigningRequest>, string][] = [
    ['D. no acting practitioner',
      { actor: { practitionerId: null, role: 'practitioner' } }, 'no_actor'],
    ['E. an automated job cannot sign',
      { actor: { practitionerId: LEAD, role: 'automated_job' } }, 'actor_cannot_sign'],
    ['F. an AI pipeline cannot sign',
      { actor: { practitionerId: LEAD, role: 'ai' } }, 'actor_cannot_sign'],
    ['G. an NI admin cannot sign a clinical conclusion',
      { actor: { practitionerId: LEAD, role: 'ni_admin' } }, 'actor_cannot_sign'],
    ['H. a client cannot sign',
      { actor: { practitionerId: LEAD, role: 'client_intake' } }, 'actor_cannot_sign'],
    ['I. the signatory must be stated',
      { signedBy: null }, 'author_not_explicit'],
    ['J. a practitioner cannot sign on someone else’s behalf',
      { signedBy: COLLEAGUE }, 'signer_not_attributed'],
    ['K. the version must be explicit',
      { protocol: { id: 'p', version: null, signedAt: null, isSuperseded: false } }, 'version_not_explicit'],
    ['L. version zero is not a version',
      { protocol: { id: 'p', version: 0, signedAt: null, isSuperseded: false } }, 'version_not_explicit'],
    ['M. an already-signed version cannot be re-signed',
      { protocol: { id: 'p', version: 3, signedAt: AT, isSuperseded: false } }, 'already_signed'],
    ['N. a superseded version cannot be signed',
      { protocol: { id: 'p', version: 2, signedAt: null, isSuperseded: true } }, 'superseded'],
    ['O. a protocol with no case has no Lead',
      { caseId: null }, 'case_not_linked'],
    ['P. a closed case does not permit signing',
      { caseState: 'closed' }, 'case_state_forbids_signing'],
    ['Q. an archived case does not permit signing',
      { caseState: 'archived' }, 'case_state_forbids_signing'],
    ['R. a practitioner with no role on the case cannot sign',
      { team: [] }, 'no_active_case_role'],
    ['S. an ended assignment is not an active role',
      { team: [member({ assignment: { status: 'ended', assignedBy: 'a', assignedAt: AT, endedAt: AT } })] },
      'no_active_case_role'],
    ['T. a student cannot sign',
      { team: [member({ teamRole: 'student', supervisorId: COLLEAGUE })] }, 'student_cannot_sign'],
    ['U. a non-Lead care team member cannot sign',
      { team: [member({ teamRole: 'care_team' })] }, 'not_lead'],
  ]

  for (const [name, over, code] of cases) {
    it(name, async () => {
      const d = await authoriseProtocolSigning(req(over), { eligibility: eligible })
      expect(d.authorised).toBe(false)
      if (d.authorised) return
      expect(d.refusal.code).toBe(code)
      expect(d.refusal.message.length).toBeGreaterThan(0)
    })
  }
})

// ─── Category 3 — NI Verified Practitioner sole-LRP prohibition ──────────────

describe('an NI Verified Practitioner cannot act as the sole LRP', () => {
  it('V. refused when they are the only practitioner on the case', async () => {
    const d = await authoriseProtocolSigning(
      req({ practitionerClasses: { [LEAD]: 'unregistered' } }), { eligibility: eligible })
    expect(d.authorised).toBe(false)
    expect(!d.authorised && d.refusal.code).toBe('sole_unregistered_lead')
  })

  it('W. refused when the only colleague is also unregistered', async () => {
    const d = await authoriseProtocolSigning(req({
      team: [member(), member({ practitionerId: COLLEAGUE, teamRole: 'care_team' })],
      practitionerClasses: { [LEAD]: 'unregistered', [COLLEAGUE]: 'unregistered' },
    }), { eligibility: eligible })
    expect(!d.authorised && d.refusal.code).toBe('sole_unregistered_lead')
  })

  it('X. refused when the only qualified colleague is a student', async () => {
    const d = await authoriseProtocolSigning(req({
      team: [member(), member({ practitionerId: COLLEAGUE, teamRole: 'student', supervisorId: LEAD })],
      practitionerClasses: { [LEAD]: 'unregistered', [COLLEAGUE]: 'regulated_clinician' },
    }), { eligibility: eligible })
    expect(!d.authorised && d.refusal.code).toBe('sole_unregistered_lead')
  })

  it('Y. refused when the qualified colleague’s assignment has ended', async () => {
    const d = await authoriseProtocolSigning(req({
      team: [member(), member({ practitionerId: COLLEAGUE, teamRole: 'care_team',
        assignment: { status: 'ended', assignedBy: 'a', assignedAt: AT, endedAt: AT } })],
      practitionerClasses: { [LEAD]: 'unregistered', [COLLEAGUE]: 'voluntary_registered' },
    }), { eligibility: eligible })
    expect(!d.authorised && d.refusal.code).toBe('sole_unregistered_lead')
  })

  it('Z. allowed when an active registered colleague is on the case', async () => {
    const d = await authoriseProtocolSigning(req({
      team: [member(), member({ practitionerId: COLLEAGUE, teamRole: 'care_team' })],
      practitionerClasses: { [LEAD]: 'unregistered', [COLLEAGUE]: 'regulated_clinician' },
    }), { eligibility: eligible })
    expect(d.authorised).toBe(true)
  })

  it('AA. an unknown class is treated as not permitted to be sole LRP', async () => {
    const d = await authoriseProtocolSigning(
      req({ practitionerClasses: {} }), { eligibility: eligible })
    expect(!d.authorised && d.refusal.code).toBe('sole_unregistered_lead')
  })
})

// ─── Eligibility is delegated, never re-derived ──────────────────────────────

describe('eligibility comes from the single authority', () => {
  it('AB. refuses when the authority says no, carrying its reasons verbatim', async () => {
    const reasons = ['indemnity_expired', 'no_current_agreement_acceptance']
    const d = await authoriseProtocolSigning(req(), { eligibility: ineligible(reasons) })
    expect(d.authorised).toBe(false)
    if (d.authorised) return
    expect(d.refusal.code).toBe('not_eligible')
    expect(d.refusal.eligibilityReasons).toEqual(reasons)
  })

  it('AC. each authoritative reason is surfaced, not collapsed', async () => {
    for (const reason of [
      'practitioner_not_active', 'practitioner_class_not_set',
      'no_current_agreement_acceptance', 'credentials_not_verified',
      'indemnity_missing', 'indemnity_expired',
    ]) {
      const d = await authoriseProtocolSigning(req(), { eligibility: ineligible([reason]) })
      expect(!d.authorised && d.refusal.eligibilityReasons).toEqual([reason])
    }
  })

  it('AD. the guard calls the authority exactly once, with the acting practitioner', async () => {
    const spy = vi.fn(async () => ({ eligible: true, reasons: [] }))
    await authoriseProtocolSigning(req(), { eligibility: spy })
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(LEAD)
  })

  it('AE. a structural refusal short-circuits before the authority is consulted', async () => {
    const spy = vi.fn(async () => ({ eligible: true, reasons: [] }))
    await authoriseProtocolSigning(req({ team: [] }), { eligibility: spy })
    expect(spy).not.toHaveBeenCalled()
  })

  it('AF. an eligibility lookup failure is a refusal, never a pass', async () => {
    const resolver = rpcEligibilityResolver({
      rpc: async () => ({ data: null, error: { message: 'boom' } }),
    })
    const d = await authoriseProtocolSigning(req(), { eligibility: resolver })
    expect(d.authorised).toBe(false)
    expect(!d.authorised && d.refusal.eligibilityReasons).toEqual(['eligibility_lookup_failed'])
  })

  it('AG. an empty eligibility result is a refusal, never a pass', async () => {
    const resolver = rpcEligibilityResolver({ rpc: async () => ({ data: [], error: null }) })
    const d = await authoriseProtocolSigning(req(), { eligibility: resolver })
    expect(!d.authorised && d.refusal.eligibilityReasons).toEqual(['eligibility_no_result'])
  })

  it('AH. the resolver calls the live function by its real name and argument', async () => {
    const rpc = vi.fn(async () => ({ data: [{ eligible: true, reasons: [] }], error: null }))
    await rpcEligibilityResolver({ rpc })('prac-x')
    expect(rpc).toHaveBeenCalledWith(
      'practitioner_assignment_eligibility', { p_practitioner_id: 'prac-x' })
  })
})

// ─── Throwing form, for call sites that must not continue ───────────────────

describe('assertProtocolSigningAuthorised', () => {
  it('AI. returns the attribution when authorised', async () => {
    const a = await assertProtocolSigningAuthorised(req(), { eligibility: eligible })
    expect(a.signedBy).toBe(LEAD)
    expect(a.guardVersion).toBe(PROTOCOL_SIGNING_GUARD_VERSION)
  })

  it('AJ. throws a typed refusal carrying the code', async () => {
    await expect(
      assertProtocolSigningAuthorised(req({ team: [] }), { eligibility: eligible }),
    ).rejects.toBeInstanceOf(ProtocolSigningRefused)

    try {
      await assertProtocolSigningAuthorised(
        req(), { eligibility: ineligible(['indemnity_expired']) })
      throw new Error('should not reach here')
    } catch (e) {
      expect(e).toBeInstanceOf(ProtocolSigningRefused)
      expect((e as ProtocolSigningRefused).code).toBe('not_eligible')
      expect((e as ProtocolSigningRefused).eligibilityReasons).toEqual(['indemnity_expired'])
    }
  })
})

// ─── The guard decides; it never acts ───────────────────────────────────────

describe('the guard has no side effect', () => {
  it('AK. does not mutate the request it was given', async () => {
    const r = req()
    const snapshot = JSON.parse(JSON.stringify(r))
    await authoriseProtocolSigning(r, { eligibility: eligible })
    expect(JSON.parse(JSON.stringify(r))).toEqual(snapshot)
  })

  it('AL. every refusal code has a non-empty message', () => {
    for (const code of SIGNING_REFUSAL_CODES) {
      expect(SIGNING_REFUSAL_MESSAGES[code]).toBeTruthy()
      expect(SIGNING_REFUSAL_MESSAGES[code].length).toBeGreaterThan(10)
    }
    // Total both ways: no orphan message without a code.
    expect(Object.keys(SIGNING_REFUSAL_MESSAGES).sort())
      .toEqual([...SIGNING_REFUSAL_CODES].sort())
  })

  it('AM. only the two registered classes may be a sole LRP', () => {
    const classes: PractitionerClass[] = [...PRACTITIONER_CLASSES]
    expect(classes).toEqual(['regulated_clinician', 'voluntary_registered', 'unregistered'])
  })
})
