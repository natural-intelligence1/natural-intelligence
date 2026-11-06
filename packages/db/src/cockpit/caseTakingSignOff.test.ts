// ─── caseTakingSignOff.test.ts ────────────────────────────────────────────────
// The application authority guard for case-taking sign-off.
//
// WHAT THESE TESTS ARE DEFENDING. The database trigger added by 0066
// (enforce_case_taking_authority) returns early when auth.uid() IS NULL,
// exactly as the live Protocol trigger it copies does — RLS and triggers are
// end-user controls, and a service-role caller has no uid. So the trigger
// cannot be the only defence: a server action holding the service-role key
// would sail through it. This guard is the defence that covers that path, and
// these tests are what prove it closed.

import { describe, it, expect } from 'vitest'
import {
  authoriseCaseTakingSignOff, assertCaseTakingSignOffAuthorised,
  CaseTakingSignOffRefused, signOffCaseTakingSession,
  caseTeamRoleResolver, leadEligibilityResolver,
  SIGNABLE_CASE_TAKING_STATES, SIGNING_CASE_ROLE,
  CASE_TAKING_SIGNOFF_GUARD_VERSION, CASE_TAKING_SIGNOFF_REFUSALS,
  type CaseTakingSignOffRequest, type CaseTakingSignOffDeps,
} from './caseTakingSignOff'
import { CASE_TAKING_STATES, type CaseRole, type CaseTakingState } from './caseTaking'

const LEAD = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const CASE = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
const SESSION = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
const AT = '2026-11-07T09:00:00.000Z'

function request(over: Partial<{
  practitionerId: string | null
  role: 'practitioner' | 'student' | 'client' | 'system'
  signedOffBy: string | null
  caseId: string | null
  state: CaseTakingState | null
  signedOffAt: string | null
  revision: number | null
}> = {}): CaseTakingSignOffRequest {
  return {
    actor: {
      practitionerId: 'practitionerId' in over ? over.practitionerId! : LEAD,
      role: over.role ?? 'practitioner',
    },
    signedOffBy: 'signedOffBy' in over ? over.signedOffBy! : LEAD,
    session: {
      id: SESSION,
      caseId: 'caseId' in over ? over.caseId! : CASE,
      state: 'state' in over ? over.state! : 'ready_for_sign_off',
      signedOffAt: over.signedOffAt ?? null,
      revision: 'revision' in over ? over.revision! : 3,
    },
    at: AT,
  }
}

/** Deps that say yes. Each test narrows exactly one thing. */
function deps(over: Partial<{
  role: CaseRole | null | 'lookup_failed'
  eligible: boolean
  blockers: string[]
}> = {}): CaseTakingSignOffDeps {
  return {
    activeCaseRole: async () => ('role' in over ? over.role! : 'lead'),
    leadEligibility: async () => ({
      eligible: over.eligible ?? true,
      blockers: over.blockers ?? [],
    }),
  }
}

// ─── The nine required proofs ────────────────────────────────────────────────

describe('1. an active eligible Lead CAN sign', () => {
  it('authorises and returns full attribution', async () => {
    const decision = await authoriseCaseTakingSignOff(request(), deps())
    expect(decision.authorised).toBe(true)
    if (!decision.authorised) throw new Error('unreachable')
    expect(decision.attribution).toEqual({
      sessionId: SESSION,
      caseId: CASE,
      signedOffBy: LEAD,
      caseRole: 'lead',
      at: AT,
      revision: 3,
      guardVersion: CASE_TAKING_SIGNOFF_GUARD_VERSION,
    })
  })

  it('authorises from every signable state', async () => {
    for (const state of SIGNABLE_CASE_TAKING_STATES) {
      const decision = await authoriseCaseTakingSignOff(request({ state }), deps())
      expect(decision.authorised, `state ${state}`).toBe(true)
    }
  })
})

describe('2. a non-Lead CANNOT sign', () => {
  it('refuses a care_team practitioner', async () => {
    const decision = await authoriseCaseTakingSignOff(request(), deps({ role: 'care_team' }))
    expect(decision.authorised).toBe(false)
    if (decision.authorised) throw new Error('unreachable')
    expect(decision.refusal.code).toBe('not_lead')
  })

  it('refuses even when that practitioner is eligible as a Lead elsewhere', async () => {
    // Eligibility is not authority. Being capable of leading some case does
    // not make you the Lead on THIS one.
    const decision = await authoriseCaseTakingSignOff(
      request(), deps({ role: 'care_team', eligible: true }))
    expect(decision.authorised).toBe(false)
  })
})

describe('3. an inactive / ended Lead CANNOT sign', () => {
  it('refuses when no active role row exists', async () => {
    // The resolver returns null precisely when every row has ended_at set.
    const decision = await authoriseCaseTakingSignOff(request(), deps({ role: null }))
    expect(decision.authorised).toBe(false)
    if (decision.authorised) throw new Error('unreachable')
    expect(decision.refusal.code).toBe('no_active_case_role')
  })

  it('refuses when the role cannot be read at all', async () => {
    const decision = await authoriseCaseTakingSignOff(
      request(), deps({ role: 'lookup_failed' }))
    expect(decision.authorised).toBe(false)
    if (decision.authorised) throw new Error('unreachable')
    expect(decision.refusal.code).toBe('role_lookup_failed')
  })
})

describe('4. an ineligible Lead CANNOT sign', () => {
  it('refuses and carries the blockers verbatim', async () => {
    const decision = await authoriseCaseTakingSignOff(
      request(),
      deps({ eligible: false, blockers: ['indemnity_expired', 'agreement_not_accepted'] }),
    )
    expect(decision.authorised).toBe(false)
    if (decision.authorised) throw new Error('unreachable')
    expect(decision.refusal.code).toBe('not_eligible')
    expect(decision.refusal.blockers).toEqual(['indemnity_expired', 'agreement_not_accepted'])
  })

  it('refuses when the eligibility verdict is unavailable', async () => {
    const decision = await authoriseCaseTakingSignOff(request(), {
      activeCaseRole: async () => 'lead',
      // A resolver that cannot answer must not be read as a yes.
      leadEligibility: async () => (undefined as never),
    })
    expect(decision.authorised).toBe(false)
    if (decision.authorised) throw new Error('unreachable')
    expect(decision.refusal.code).toBe('not_eligible')
    expect(decision.refusal.blockers).toEqual(['eligibility_unavailable'])
  })

  it('asks the eligibility authority specifically about the lead role', async () => {
    const asked: [string, string][] = []
    const client = {
      from: () => unusedQuery(),
      rpc: async (fn: string, args: Record<string, unknown>) => {
        asked.push([fn, String(args.p_case_role)])
        return { data: [{ eligible: true, blockers: [] }], error: null }
      },
    }
    await leadEligibilityResolver(client)(LEAD)
    expect(asked).toEqual([['practitioner_eligibility', 'lead']])
  })
})

describe('5. an actor CANNOT sign as another practitioner', () => {
  it('refuses when signed_off_by is someone else', async () => {
    const decision = await authoriseCaseTakingSignOff(
      request({ practitionerId: OTHER, signedOffBy: LEAD }), deps())
    expect(decision.authorised).toBe(false)
    if (decision.authorised) throw new Error('unreachable')
    expect(decision.refusal.code).toBe('signer_not_attributed')
  })

  it('refuses when the attribution is left unstated', async () => {
    const decision = await authoriseCaseTakingSignOff(request({ signedOffBy: null }), deps())
    expect(decision.authorised).toBe(false)
    if (decision.authorised) throw new Error('unreachable')
    expect(decision.refusal.code).toBe('signer_not_attributed')
  })

  it('refuses a Lead forging a colleague’s signature', async () => {
    // The actor IS the active eligible Lead, but attributes to someone else.
    const decision = await authoriseCaseTakingSignOff(
      request({ practitionerId: LEAD, signedOffBy: OTHER }), deps())
    expect(decision.authorised).toBe(false)
  })
})

describe('6. a supervised / non-practitioner actor CANNOT sign', () => {
  it('refuses a student', async () => {
    const decision = await authoriseCaseTakingSignOff(request({ role: 'student' }), deps())
    expect(decision.authorised).toBe(false)
    if (decision.authorised) throw new Error('unreachable')
    expect(decision.refusal.code).toBe('actor_not_practitioner')
  })

  it('refuses a student even when their case role says lead', async () => {
    // Defence in depth: a mis-seeded role row cannot promote a student.
    const decision = await authoriseCaseTakingSignOff(
      request({ role: 'student' }), deps({ role: 'lead' }))
    expect(decision.authorised).toBe(false)
  })

  it('refuses a student by case role as well', async () => {
    const decision = await authoriseCaseTakingSignOff(request(), deps({ role: 'student' }))
    expect(decision.authorised).toBe(false)
    if (decision.authorised) throw new Error('unreachable')
    expect(decision.refusal.code).toBe('not_lead')
  })

  it('refuses a client actor', async () => {
    const decision = await authoriseCaseTakingSignOff(request({ role: 'client' }), deps())
    expect(decision.authorised).toBe(false)
  })
})

describe('7. an invalid lifecycle state CANNOT sign', () => {
  it('refuses from in_progress', async () => {
    // The Lead must have received a submission or marked their own work
    // ready. Otherwise sign-off becomes a side effect of finishing typing.
    const decision = await authoriseCaseTakingSignOff(
      request({ state: 'in_progress' }), deps())
    expect(decision.authorised).toBe(false)
    if (decision.authorised) throw new Error('unreachable')
    expect(decision.refusal.code).toBe('state_forbids_sign_off')
  })

  it('refuses when the session could not be read', async () => {
    const decision = await authoriseCaseTakingSignOff(request({ state: null }), deps())
    expect(decision.authorised).toBe(false)
    if (decision.authorised) throw new Error('unreachable')
    expect(decision.refusal.code).toBe('session_not_found')
  })

  it('refuses when the session is not linked to a case', async () => {
    const decision = await authoriseCaseTakingSignOff(request({ caseId: null }), deps())
    expect(decision.authorised).toBe(false)
    if (decision.authorised) throw new Error('unreachable')
    expect(decision.refusal.code).toBe('case_not_identified')
  })

  it('covers every known state exactly once — signable or refused', async () => {
    // Guards against a sixth state being added and silently becoming
    // signable, or silently becoming unreachable.
    const outcomes = new Map<CaseTakingState, boolean>()
    for (const state of CASE_TAKING_STATES) {
      const decision = await authoriseCaseTakingSignOff(request({ state }), deps())
      outcomes.set(state, decision.authorised)
    }
    expect([...outcomes.entries()]).toEqual([
      ['in_progress', false],
      ['submitted_to_lead', true],
      ['lead_review', true],
      ['ready_for_sign_off', true],
      ['signed_off', false],
    ])
  })
})

describe('8. an already-signed session CANNOT be signed again', () => {
  it('refuses when signed_off_at is set', async () => {
    const decision = await authoriseCaseTakingSignOff(
      request({ state: 'signed_off', signedOffAt: '2026-11-06T10:00:00.000Z' }), deps())
    expect(decision.authorised).toBe(false)
    if (decision.authorised) throw new Error('unreachable')
    expect(decision.refusal.code).toBe('already_signed')
  })

  it('refuses a signature timestamp without the signed_off state', async () => {
    // An inconsistent row must not become a second signing opportunity.
    const decision = await authoriseCaseTakingSignOff(
      request({ state: 'lead_review', signedOffAt: '2026-11-06T10:00:00.000Z' }), deps())
    expect(decision.authorised).toBe(false)
    if (decision.authorised) throw new Error('unreachable')
    expect(decision.refusal.code).toBe('already_signed')
  })

  it('refuses the signed_off state without a timestamp', async () => {
    const decision = await authoriseCaseTakingSignOff(request({ state: 'signed_off' }), deps())
    expect(decision.authorised).toBe(false)
    if (decision.authorised) throw new Error('unreachable')
    expect(decision.refusal.code).toBe('already_signed')
  })
})

describe('9. a service-role path WITHOUT authorisation cannot sign through the API', () => {
  /** Records every table write attempted, so "nothing was written" is provable. */
  function spyClient(updateRows: unknown[] = [{ id: SESSION }]) {
    const writes: Record<string, unknown>[] = []
    const chain = {
      update: (patch: Record<string, unknown>) => { writes.push(patch); return chain },
      eq: () => chain,
      is: () => chain,
      select: () => chain,
      limit: async () => ({ data: updateRows, error: null }),
      then: (r: (v: { data: unknown; error: unknown }) => unknown) =>
        Promise.resolve({ data: updateRows, error: null }).then(r),
    }
    return {
      writes,
      client: {
        from: () => chain,
        rpc: async () => ({ data: [{ eligible: true, blockers: [] }], error: null }),
      },
    }
  }

  it('a system actor with service-role credentials writes NOTHING', async () => {
    // The shape of the real risk: a server action holding the service-role
    // key, where RLS does not apply and the DB trigger waves auth.uid() IS
    // NULL straight through.
    const { writes, client } = spyClient()
    const outcome = await signOffCaseTakingSession(
      client, request({ role: 'system', practitionerId: null }), deps())
    expect(outcome.signed).toBe(false)
    if (outcome.signed) throw new Error('unreachable')
    expect(outcome.refusal.code).toBe('no_actor')
    expect(writes).toEqual([])
  })

  it('a service-role caller impersonating a practitioner id still fails the role check', async () => {
    const { writes, client } = spyClient()
    const outcome = await signOffCaseTakingSession(
      client, request(), deps({ role: null }))
    expect(outcome.signed).toBe(false)
    expect(writes).toEqual([])
  })

  it('a service-role caller fails when the practitioner is ineligible', async () => {
    const { writes, client } = spyClient()
    const outcome = await signOffCaseTakingSession(
      client, request(), deps({ eligible: false, blockers: ['indemnity_expired'] }))
    expect(outcome.signed).toBe(false)
    expect(writes).toEqual([])
  })

  it('writes ONLY after the guard authorises, and only the signature columns', async () => {
    const { writes, client } = spyClient()
    const outcome = await signOffCaseTakingSession(client, request(), deps())
    expect(outcome.signed).toBe(true)
    expect(writes).toEqual([{
      state: 'signed_off',
      signed_off_by: LEAD,
      signed_off_at: AT,
    }])
  })

  it('reports a conflict rather than a signature when the write matches no row', async () => {
    // Signed or edited between the read and the write: the conditional
    // UPDATE (signed_off_at IS NULL + revision) matches nothing.
    const { client } = spyClient([])
    const outcome = await signOffCaseTakingSession(client, request(), deps())
    expect(outcome.signed).toBe(false)
    if (outcome.signed) throw new Error('unreachable')
    expect(outcome.refusal.code).toBe('already_signed')
  })

  it('guards the write with signed_off_at IS NULL and the revision token', async () => {
    const calls: string[] = []
    const chain = {
      update: () => chain,
      eq: (col: string) => { calls.push(`eq:${col}`); return chain },
      is: (col: string) => { calls.push(`is:${col}`); return chain },
      select: () => chain,
      limit: async () => ({ data: [{ id: SESSION }], error: null }),
      then: (r: (v: { data: unknown; error: unknown }) => unknown) =>
        Promise.resolve({ data: [{ id: SESSION }], error: null }).then(r),
    }
    const client = {
      from: () => chain,
      rpc: async () => ({ data: [{ eligible: true, blockers: [] }], error: null }),
    }
    await signOffCaseTakingSession(client, request({ revision: 7 }), deps())
    expect(calls).toEqual(['eq:id', 'is:signed_off_at', 'eq:revision'])
  })

  it('omits the revision predicate when no revision was read', async () => {
    const calls: string[] = []
    const chain = {
      update: () => chain,
      eq: (col: string) => { calls.push(`eq:${col}`); return chain },
      is: (col: string) => { calls.push(`is:${col}`); return chain },
      select: () => chain,
      limit: async () => ({ data: [{ id: SESSION }], error: null }),
      then: (r: (v: { data: unknown; error: unknown }) => unknown) =>
        Promise.resolve({ data: [{ id: SESSION }], error: null }).then(r),
    }
    const client = {
      from: () => chain,
      rpc: async () => ({ data: [{ eligible: true, blockers: [] }], error: null }),
    }
    await signOffCaseTakingSession(client, request({ revision: null }), deps())
    expect(calls).toEqual(['eq:id', 'is:signed_off_at'])
  })

  it('uses the real resolvers when none are injected', async () => {
    // So a production call site cannot accidentally get permissive test deps.
    const seen: string[] = []
    const chain = {
      select: () => chain, eq: () => chain, is: () => chain,
      limit: async () => ({ data: [{ team_role: 'lead' }], error: null }),
      update: () => chain,
      then: (r: (v: { data: unknown; error: unknown }) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(r),
    }
    const client = {
      from: (t: string) => { seen.push(t); return chain },
      rpc: async (fn: string) => {
        seen.push(`rpc:${fn}`)
        return { data: [{ eligible: true, blockers: [] }], error: null }
      },
    }
    await signOffCaseTakingSession(client, request())
    expect(seen).toContain('case_team_roles')
    expect(seen).toContain('rpc:practitioner_eligibility')
  })
})

// ─── The role resolver reads the right table ─────────────────────────────────

describe('the role resolver reads case_team_roles and nothing else', () => {
  function roleClient(rows: unknown, error: unknown = null) {
    const seen: { table: string | null; filters: string[] } = { table: null, filters: [] }
    const chain = {
      select: () => chain,
      eq: (col: string) => { seen.filters.push(col); return chain },
      is: (col: string) => { seen.filters.push(`is:${col}`); return chain },
      limit: async () => ({ data: rows, error }),
      update: () => chain,
      then: (r: (v: { data: unknown; error: unknown }) => unknown) =>
        Promise.resolve({ data: rows, error }).then(r),
    }
    return {
      seen,
      client: {
        from: (t: string) => { seen.table = t; return chain },
        rpc: async () => ({ data: null, error: null }),
      },
    }
  }

  it('queries case_team_roles filtered on the case, the practitioner and ended_at', async () => {
    const { seen, client } = roleClient([{ team_role: 'lead' }])
    const role = await caseTeamRoleResolver(client)(CASE, LEAD)
    expect(role).toBe('lead')
    expect(seen.table).toBe('case_team_roles')
    expect(seen.filters).toEqual(['case_id', 'practitioner_id', 'is:ended_at'])
  })

  it('NEVER reads client_practitioner_links', async () => {
    // Its `role` column is relationship metadata and carries no clinical
    // authority. The two vocabularies share the word 'lead'; 0064 ruled that
    // the shared word does not make the concepts equivalent.
    const { seen, client } = roleClient([{ team_role: 'lead' }])
    await caseTeamRoleResolver(client)(CASE, LEAD)
    expect(seen.table).not.toBe('client_practitioner_links')
  })

  it('returns null when there is no active role', async () => {
    const { client } = roleClient([])
    expect(await caseTeamRoleResolver(client)(CASE, LEAD)).toBeNull()
  })

  it('returns lookup_failed on a read error, not null', async () => {
    // A failed read is not a known absence, and must not be reported as one.
    const { client } = roleClient(null, { code: '42501', message: 'permission denied' })
    expect(await caseTeamRoleResolver(client)(CASE, LEAD)).toBe('lookup_failed')
  })

  it('returns null on a malformed row rather than guessing', async () => {
    const { client } = roleClient([{ team_role: 42 }])
    expect(await caseTeamRoleResolver(client)(CASE, LEAD)).toBeNull()
  })
})

describe('the eligibility resolver fails closed', () => {
  const client = (data: unknown, error: unknown = null) => ({
    from: () => unusedQuery(),
    rpc: async () => ({ data, error }),
  })

  it('reads eligible and blockers from the live function shape', async () => {
    const verdict = await leadEligibilityResolver(
      client([{ eligible: true, blockers: [] }]))(LEAD)
    expect(verdict).toEqual({ eligible: true, blockers: [] })
  })

  it('refuses on a lookup error', async () => {
    const verdict = await leadEligibilityResolver(
      client(null, { message: 'boom' }))(LEAD)
    expect(verdict).toEqual({ eligible: false, blockers: ['eligibility_lookup_failed'] })
  })

  it('refuses when the function returns no row', async () => {
    const verdict = await leadEligibilityResolver(client([]))(LEAD)
    expect(verdict).toEqual({ eligible: false, blockers: ['eligibility_no_result'] })
  })

  it('treats a non-true eligible value as ineligible', async () => {
    for (const value of ['true', 1, null, undefined, {}]) {
      const verdict = await leadEligibilityResolver(
        client([{ eligible: value, blockers: [] }]))(LEAD)
      expect(verdict.eligible, `eligible=${JSON.stringify(value)}`).toBe(false)
    }
  })
})

// ─── Shape and boundary ─────────────────────────────────────────────────────

describe('the throwing form', () => {
  it('returns the attribution when authorised', async () => {
    const attribution = await assertCaseTakingSignOffAuthorised(request(), deps())
    expect(attribution.signedOffBy).toBe(LEAD)
  })

  it('throws a typed refusal carrying the code', async () => {
    await expect(assertCaseTakingSignOffAuthorised(request(), deps({ role: 'care_team' })))
      .rejects.toThrow(CaseTakingSignOffRefused)
    try {
      await assertCaseTakingSignOffAuthorised(request(), deps({ eligible: false, blockers: ['x'] }))
      throw new Error('expected a refusal')
    } catch (e) {
      expect(e).toBeInstanceOf(CaseTakingSignOffRefused)
      expect((e as CaseTakingSignOffRefused).code).toBe('not_eligible')
      expect((e as CaseTakingSignOffRefused).blockers).toEqual(['x'])
    }
  })
})

describe('the boundary with Protocol signing is kept', () => {
  it('does not apply sole_unregistered_lead', async () => {
    // Case-taking sign-off means "this is the reviewed record of the
    // consultation", not "I professionally adopt this treatment Protocol".
    // No practitioner class is consulted, so a sole NI Verified Practitioner
    // Lead can sign a case-taking record.
    const decision = await authoriseCaseTakingSignOff(request(), deps())
    expect(decision.authorised).toBe(true)
  })

  it('has no refusal code for sole_unregistered_lead', () => {
    expect([...CASE_TAKING_SIGNOFF_REFUSALS]).not.toContain('sole_unregistered_lead')
  })

  it('signs only as the lead case role', () => {
    expect(SIGNING_CASE_ROLE).toBe('lead')
  })

  it('does not permit sign-off from in_progress, matching the state machine', () => {
    expect(SIGNABLE_CASE_TAKING_STATES).not.toContain('in_progress')
    expect(SIGNABLE_CASE_TAKING_STATES).not.toContain('signed_off')
  })
})


/**
 * A SignOffQuery stand-in for tests that exercise only the RPC side.
 *
 * Every method throws: these tests assert the eligibility resolver's
 * behaviour, and `from` must never be reached. A silent no-op stub would hide
 * an accidental table read; this one fails loudly.
 */
function unusedQuery(): never {
  throw new Error('from() must not be called in this test')
}
