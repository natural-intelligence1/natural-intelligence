// Practitioner-scoped consent.
//
// The test that matters most is the first one: consent naming Practitioner A
// must not authorise Practitioner B. Everything else here defends that result
// against the ways it could quietly stop holding.

import { describe, it, expect, vi } from 'vitest'
import {
  hasActivePractitionerAccessConsent, listPractitionerAccessConsents,
  withdrawPractitionerAccess, isPractitionerScopedConsent,
  PRACTITIONER_SCOPED_CONSENTS, CONSENT_SEMANTICS,
} from './practitionerAccess'
import { hasActiveConsent, hasAllConsents, withdrawConsent } from './records'
import type { ConsentPurpose } from './purposes'

const MEMBER = 'member-1'
const PRAC_A = 'prac-a'
const PRAC_B = 'prac-b'

interface Row {
  profile_id: string
  consent_type: string
  context_practitioner_id: string | null
  consented: boolean
  consented_at: string
  withdrawn_at: string | null
  consent_version?: string | null
}

/**
 * A client that applies the same filters PostgREST would, over an in-memory
 * table. The point is to prove the QUERY is scoped correctly — a stub that
 * ignored .eq() would pass even with the practitioner filter deleted.
 */
function fakeClient(rows: Row[], opts: { failRead?: boolean } = {}) {
  const build = () => {
    let out = [...rows]
    let limited = false
    const api: Record<string, unknown> = {
      select: () => api,
      eq: (col: string, val: unknown) => {
        out = out.filter((r) => (r as unknown as Record<string, unknown>)[col] === val)
        return api
      },
      order: (col: string, o?: { ascending?: boolean }) => {
        out.sort((a, b) => {
          const x = String((a as unknown as Record<string, unknown>)[col] ?? '')
          const y = String((b as unknown as Record<string, unknown>)[col] ?? '')
          return o?.ascending === false ? y.localeCompare(x) : x.localeCompare(y)
        })
        return api
      },
      limit: (n: number) => { out = out.slice(0, n); limited = true; return api },
      maybeSingle: () => Promise.resolve(
        opts.failRead ? { data: null, error: { message: 'boom' } }
                      : { data: out[0] ?? null, error: null },
      ),
      then: (resolve: (v: unknown) => unknown) => resolve(
        opts.failRead ? { data: null, error: { message: 'boom' } } : { data: out, error: null },
      ),
    }
    void limited
    return api
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { from: () => build(), rpc: vi.fn() } as any
}

const grant = (practitionerId: string | null, at: string, withdrawnAt: string | null = null): Row => ({
  profile_id: MEMBER, consent_type: 'practitioner_access',
  context_practitioner_id: practitionerId, consented: true,
  consented_at: at, withdrawn_at: withdrawnAt, consent_version: 's3-draft-2',
})

describe('consent for one practitioner does not authorise another', () => {
  it('A\'s consent authorises A', async () => {
    const c = fakeClient([grant(PRAC_A, '2026-10-01T00:00:00Z')])
    expect(await hasActivePractitionerAccessConsent(c, MEMBER, PRAC_A)).toBe(true)
  })

  it('A\'s consent does NOT authorise B', async () => {
    // THE TEST. Before this module existed, hasActiveConsent would have
    // answered true here, because it filters on profile + consent type alone.
    const c = fakeClient([grant(PRAC_A, '2026-10-01T00:00:00Z')])
    expect(await hasActivePractitionerAccessConsent(c, MEMBER, PRAC_B)).toBe(false)
  })

  it('consent for both authorises both, independently', async () => {
    const c = fakeClient([grant(PRAC_A, '2026-10-01T00:00:00Z'), grant(PRAC_B, '2026-10-02T00:00:00Z')])
    expect(await hasActivePractitionerAccessConsent(c, MEMBER, PRAC_A)).toBe(true)
    expect(await hasActivePractitionerAccessConsent(c, MEMBER, PRAC_B)).toBe(true)
  })

  it('withdrawing from A leaves B authorised, and vice versa', async () => {
    const c = fakeClient([
      grant(PRAC_A, '2026-10-01T00:00:00Z', '2026-10-05T00:00:00Z'),
      grant(PRAC_B, '2026-10-02T00:00:00Z'),
    ])
    expect(await hasActivePractitionerAccessConsent(c, MEMBER, PRAC_A)).toBe(false)
    expect(await hasActivePractitionerAccessConsent(c, MEMBER, PRAC_B)).toBe(true)
  })

  it('another member\'s consent for A does not authorise A for this member', async () => {
    const c = fakeClient([{ ...grant(PRAC_A, '2026-10-01T00:00:00Z'), profile_id: 'member-2' }])
    expect(await hasActivePractitionerAccessConsent(c, MEMBER, PRAC_A)).toBe(false)
  })
})

describe('fail-closed', () => {
  it('no row means no consent', async () => {
    expect(await hasActivePractitionerAccessConsent(fakeClient([]), MEMBER, PRAC_A)).toBe(false)
  })

  it('a read error means no consent', async () => {
    const c = fakeClient([grant(PRAC_A, '2026-10-01T00:00:00Z')], { failRead: true })
    expect(await hasActivePractitionerAccessConsent(c, MEMBER, PRAC_A)).toBe(false)
  })

  it('a refusal recorded against A is not a grant', async () => {
    const c = fakeClient([{ ...grant(PRAC_A, '2026-10-01T00:00:00Z'), consented: false }])
    expect(await hasActivePractitionerAccessConsent(c, MEMBER, PRAC_A)).toBe(false)
  })

  it('a withdrawn grant is not a grant', async () => {
    const c = fakeClient([grant(PRAC_A, '2026-10-01T00:00:00Z', '2026-10-09T00:00:00Z')])
    expect(await hasActivePractitionerAccessConsent(c, MEMBER, PRAC_A)).toBe(false)
  })

  it('an unscoped practitioner_access row authorises nobody', async () => {
    // A row with no practitioner named cannot be attributed, so it cannot
    // be made to stand in for a specific one.
    const c = fakeClient([grant(null, '2026-10-01T00:00:00Z')])
    expect(await hasActivePractitionerAccessConsent(c, MEMBER, PRAC_A)).toBe(false)
    expect(await listPractitionerAccessConsents(c, MEMBER)).toEqual([])
  })

  it('a missing member or practitioner is not a wildcard', async () => {
    const c = fakeClient([grant(PRAC_A, '2026-10-01T00:00:00Z')])
    expect(await hasActivePractitionerAccessConsent(c, '', PRAC_A)).toBe(false)
    expect(await hasActivePractitionerAccessConsent(c, MEMBER, '')).toBe(false)
  })

  it('the latest row for that exact pairing decides', async () => {
    const c = fakeClient([
      grant(PRAC_A, '2026-10-01T00:00:00Z', '2026-10-02T00:00:00Z'),
      grant(PRAC_A, '2026-10-03T00:00:00Z'),
    ])
    expect(await hasActivePractitionerAccessConsent(c, MEMBER, PRAC_A)).toBe(true)
  })
})

describe('the member-wide helpers refuse practitioner-scoped purposes', () => {
  const scoped = 'practitioner_access' as unknown as ConsentPurpose

  it('practitioner_access is not a member-wide purpose', () => {
    expect(isPractitionerScopedConsent('practitioner_access')).toBe(true)
    expect(isPractitionerScopedConsent('record_holding')).toBe(false)
    expect(PRACTITIONER_SCOPED_CONSENTS).toContain('practitioner_access')
  })

  it('hasActiveConsent answers false rather than answering practitioner-blind', async () => {
    // It must not say "yes, for some practitioner". A cast gets a refusal.
    const c = fakeClient([grant(PRAC_A, '2026-10-01T00:00:00Z')])
    expect(await hasActiveConsent(c, MEMBER, scoped)).toBe(false)
  })

  it('hasAllConsents cannot be satisfied by a practitioner-scoped purpose', async () => {
    const c = fakeClient([grant(PRAC_A, '2026-10-01T00:00:00Z')])
    expect(await hasAllConsents(c, MEMBER, [scoped])).toBe(false)
  })

  it('withdrawConsent refuses rather than withdrawing from every practitioner', async () => {
    // The RPC treats a null practitioner as "all of them". This throws
    // instead of quietly revoking a whole care team's access.
    const c = fakeClient([])
    await expect(withdrawConsent(c, scoped)).rejects.toThrow(/scoped to one practitioner/i)
    expect(c.rpc).not.toHaveBeenCalled()
  })
})

describe('withdrawing access from one practitioner', () => {
  it('always names the practitioner in the RPC call', async () => {
    const c = fakeClient([])
    c.rpc.mockResolvedValue({ data: 1, error: null })
    expect(await withdrawPractitionerAccess(c, PRAC_A)).toBe(1)
    expect(c.rpc).toHaveBeenCalledWith('withdraw_own_consent', {
      p_consent_type: 'practitioner_access',
      p_context_practitioner_id: PRAC_A,
    })
  })

  it('refuses to run without one', async () => {
    const c = fakeClient([])
    await expect(withdrawPractitionerAccess(c, '')).rejects.toThrow(/every practitioner/i)
    expect(c.rpc).not.toHaveBeenCalled()
  })

  it('surfaces an RPC failure instead of reporting success', async () => {
    const c = fakeClient([])
    c.rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'nope' } })
    await expect(withdrawPractitionerAccess(c, PRAC_A)).rejects.toThrow(/nope/)
  })
})

describe('listing who has access', () => {
  it('reports the latest state per practitioner', async () => {
    const c = fakeClient([
      grant(PRAC_A, '2026-10-01T00:00:00Z', '2026-10-02T00:00:00Z'),
      grant(PRAC_A, '2026-10-03T00:00:00Z'),
      grant(PRAC_B, '2026-10-04T00:00:00Z', '2026-10-05T00:00:00Z'),
    ])
    const all = await listPractitionerAccessConsents(c, MEMBER)
    expect(all).toHaveLength(2)
    expect(all.find((x) => x.practitionerId === PRAC_A)?.active).toBe(true)
    expect(all.find((x) => x.practitionerId === PRAC_B)?.active).toBe(false)
  })

  it('returns an empty list on a read error rather than guessing', async () => {
    expect(await listPractitionerAccessConsents(fakeClient([], { failRead: true }), MEMBER)).toEqual([])
  })
})

describe('the divergence from the live database function', () => {
  it('takes the stricter reading when a grant is followed by a refusal', async () => {
    // has_practitioner_access_consent() in the database asks whether ANY
    // active row exists, so it would answer true here. This module asks
    // whether the LATEST row is active, so it answers false. Stricter is the
    // safe direction — nothing this module permits would be refused by the
    // database — but which is canonical is the Founder's call, and this test
    // exists so the choice cannot drift unnoticed.
    const c = fakeClient([
      grant(PRAC_A, '2026-10-01T00:00:00Z'),
      { ...grant(PRAC_A, '2026-10-06T00:00:00Z'), consented: false },
    ])
    expect(await hasActivePractitionerAccessConsent(c, MEMBER, PRAC_A)).toBe(false)
    expect(CONSENT_SEMANTICS.thisModuleIsStricter).toBe(true)
    expect(CONSENT_SEMANTICS.needsFounderDecision).toBe(true)
  })
})

describe('consent is never manufactured', () => {
  it('reads nothing but consent_records', async () => {
    // Case-team membership, client_practitioner_links, an assignment and case
    // ownership are not consent. If this module ever consulted one, this test
    // would see the table name.
    const seen: string[] = []
    const c = {
      from: (t: string) => {
        seen.push(t)
        const api: Record<string, unknown> = {
          select: () => api, eq: () => api, order: () => api, limit: () => api,
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
          then: (r: (v: unknown) => unknown) => r({ data: [], error: null }),
        }
        return api
      },
      rpc: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any

    await hasActivePractitionerAccessConsent(c, MEMBER, PRAC_A)
    await listPractitionerAccessConsents(c, MEMBER)
    expect([...new Set(seen)]).toEqual(['consent_records'])
  })
})
