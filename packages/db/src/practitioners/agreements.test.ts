// Sprint 3 — agreement gate fail-closed semantics and the RPC-only
// acceptance path (unit level; the SQL-side rejection of direct inserts is
// exercised by the live RLS suite).
import { describe, it, expect, afterEach } from 'vitest'
import {
  hasAcceptedCurrentAgreement, acceptCurrentAgreementViaRpc, isAgreementGateEnabled,
  isDraftSeedingAllowed, assertDraftSeedingAllowed, DRAFT_SEED_BLOCKED_MESSAGE,
  AGREEMENT_VERSION, AGREEMENT_TEXTS, PRACTITIONER_CATEGORIES,
} from './agreements'
import { makeStubClient } from './__test-helpers__/stubQueryClient'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseClient = any

const FLAG = 'PRACTITIONER_AGREEMENT_GATE'
const savedFlag = process.env[FLAG]
afterEach(() => {
  if (savedFlag === undefined) delete process.env[FLAG]
  else process.env[FLAG] = savedFlag
})

describe('hasAcceptedCurrentAgreement — fail-closed', () => {
  it('RPC error (incl. pre-migration missing function) counts as NOT accepted', async () => {
    const { client } = makeStubClient([
      { data: null, error: { code: '42883', message: 'function does not exist' } },
    ])
    expect(await hasAcceptedCurrentAgreement(client as LooseClient)).toBe(false)
  })
  it('false / null / non-boolean results count as NOT accepted', async () => {
    for (const data of [false, null, 'true', 1, undefined]) {
      const { client } = makeStubClient([{ data, error: null }])
      expect(await hasAcceptedCurrentAgreement(client as LooseClient)).toBe(false)
    }
  })
  it('only a strict boolean true counts as accepted', async () => {
    const { client } = makeStubClient([{ data: true, error: null }])
    expect(await hasAcceptedCurrentAgreement(client as LooseClient)).toBe(true)
  })
  it('checks via the RPC — never by reading acceptance rows directly', async () => {
    const { client, calls } = makeStubClient([{ data: true, error: null }])
    await hasAcceptedCurrentAgreement(client as LooseClient)
    expect(calls).toEqual([
      { kind: 'rpc', target: 'has_accepted_current_agreement', args: undefined },
    ])
  })
})

describe('acceptCurrentAgreementViaRpc — the ONLY acceptance write path', () => {
  it('writes via the accept_current_agreement RPC, never a table insert', async () => {
    const { client, calls } = makeStubClient([
      { data: [{ agreement_id: 'a1', agreement_version: 's3-draft-1' }], error: null },
    ])
    const res = await acceptCurrentAgreementViaRpc(client as LooseClient, 'a1')
    expect(res).toEqual({ agreementId: 'a1', agreementVersion: 's3-draft-1' })
    expect(calls).toHaveLength(1)
    expect(calls[0].kind).toBe('rpc')
    expect(calls[0].target).toBe('accept_current_agreement')
    expect(calls[0].args).toEqual({ p_expected_agreement_id: 'a1' })
  })
  it('surfaces RPC rejection (stale displayed agreement / version mismatch) as an error', async () => {
    const { client } = makeStubClient([
      { data: null, error: { code: 'P0001', message: 'displayed agreement is no longer current' } },
    ])
    await expect(acceptCurrentAgreementViaRpc(client as LooseClient, 'stale-id'))
      .rejects.toThrow(/no longer current/)
  })
  it('throws when the RPC returns no agreement reference', async () => {
    const { client } = makeStubClient([{ data: [], error: null }])
    await expect(acceptCurrentAgreementViaRpc(client as LooseClient))
      .rejects.toThrow(/no agreement reference/)
  })
})

describe('PRACTITIONER_AGREEMENT_GATE flag', () => {
  it('default OFF; only exactly "true" enables it', () => {
    delete process.env[FLAG]
    expect(isAgreementGateEnabled()).toBe(false)
    for (const v of ['TRUE', '1', 'yes', 'false']) {
      process.env[FLAG] = v
      expect(isAgreementGateEnabled()).toBe(false)
    }
    process.env[FLAG] = 'true'
    expect(isAgreementGateEnabled()).toBe(true)
  })
})

// ─── Draft-seed production protection ────────────────────────────────────────
// AGREEMENT_TEXTS is placeholder wording whose own banner says it needs
// solicitor review. Publishing it sets is_current, which the eligibility gate
// reads, and an acceptance of it is immutable. It must be impossible outside
// development, regardless of admin authentication.

describe('draft agreement seeding — production protection', () => {
  const PROD_ENVS: NodeJS.ProcessEnv[] = [
    { NODE_ENV: 'production' },
    { NODE_ENV: 'production', VERCEL_ENV: 'production' },
    { NODE_ENV: 'production', VERCEL_ENV: 'preview' },
    { VERCEL_ENV: 'production', NODE_ENV: 'development' }, // explicit prod wins
  ]

  it('refuses in every production-like environment', () => {
    for (const env of PROD_ENVS) {
      expect(isDraftSeedingAllowed(env)).toBe(false)
      expect(() => assertDraftSeedingAllowed(env)).toThrow(DRAFT_SEED_BLOCKED_MESSAGE)
    }
  })

  it('fails closed on an unknown or absent environment', () => {
    for (const env of [{}, { NODE_ENV: undefined }, { NODE_ENV: 'staging' }] as NodeJS.ProcessEnv[]) {
      expect(isDraftSeedingAllowed(env)).toBe(false)
      expect(() => assertDraftSeedingAllowed(env)).toThrow()
    }
  })

  it('allows development and test only', () => {
    for (const env of [{ NODE_ENV: 'development' }, { NODE_ENV: 'test' }] as NodeJS.ProcessEnv[]) {
      expect(isDraftSeedingAllowed(env)).toBe(true)
      expect(() => assertDraftSeedingAllowed(env)).not.toThrow()
    }
  })

  it('a Vercel preview build cannot publish drafts', () => {
    // Preview deployments also run with NODE_ENV=production.
    const preview: NodeJS.ProcessEnv = { NODE_ENV: 'production', VERCEL_ENV: 'preview' }
    expect(() => assertDraftSeedingAllowed(preview)).toThrow(/cannot be published in production/i)
  })

  it('the refusal names the version it is protecting against', () => {
    expect(DRAFT_SEED_BLOCKED_MESSAGE).toContain(AGREEMENT_VERSION)
    expect(DRAFT_SEED_BLOCKED_MESSAGE).toMatch(/solicitor/i)
  })

  it('the seeded text is still demonstrably draft — the guard is warranted', () => {
    for (const category of PRACTITIONER_CATEGORIES) {
      expect(AGREEMENT_TEXTS[category].body).toMatch(/DRAFT/)
      expect(AGREEMENT_TEXTS[category].body).toMatch(/pending solicitor drafting/i)
    }
    expect(AGREEMENT_VERSION).toMatch(/draft/i)
  })
})
