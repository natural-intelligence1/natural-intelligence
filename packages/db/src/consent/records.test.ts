// Sprint 3 — consent read helpers are FAIL-CLOSED: any error, absence or
// withdrawal counts as not consented, so intake saves cannot proceed on
// uncertainty. (The intake actions call hasAllConsents before every save.)
import { describe, it, expect } from 'vitest'
import { hasActiveConsent, hasAllConsents, withdrawConsent, recordSignupConsents } from './records'
import { CONSENT_TEXTS, CONSENT_TEXT_VERSION } from './purposes'
import { makeStubClient } from '../practitioners/__test-helpers__/stubQueryClient'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseClient = any

describe('hasActiveConsent — fail-closed', () => {
  it('query error counts as NOT consented', async () => {
    const { client } = makeStubClient([
      { data: null, error: { code: '42P01', message: 'relation does not exist' } },
    ])
    expect(await hasActiveConsent(client as LooseClient, 'm1', 'record_holding')).toBe(false)
  })
  it('no consent row counts as NOT consented', async () => {
    const { client } = makeStubClient([{ data: null, error: null }])
    expect(await hasActiveConsent(client as LooseClient, 'm1', 'record_holding')).toBe(false)
  })
  it('a withdrawn grant counts as NOT consented', async () => {
    const { client } = makeStubClient([
      { data: { consented: true, withdrawn_at: '2026-09-10T00:00:00Z', consented_at: '2026-09-01T00:00:00Z' }, error: null },
    ])
    expect(await hasActiveConsent(client as LooseClient, 'm1', 'record_holding')).toBe(false)
  })
  it('a declined row counts as NOT consented', async () => {
    const { client } = makeStubClient([
      { data: { consented: false, withdrawn_at: null, consented_at: '2026-09-01T00:00:00Z' }, error: null },
    ])
    expect(await hasActiveConsent(client as LooseClient, 'm1', 'record_holding')).toBe(false)
  })
  it('an active grant counts as consented', async () => {
    const { client } = makeStubClient([
      { data: { consented: true, withdrawn_at: null, consented_at: '2026-09-01T00:00:00Z' }, error: null },
    ])
    expect(await hasActiveConsent(client as LooseClient, 'm1', 'record_holding')).toBe(true)
  })
})

describe('hasAllConsents — intake save precondition', () => {
  const granted = { data: { consented: true, withdrawn_at: null, consented_at: 'x' }, error: null }

  it('false when ANY required purpose is missing (intake save must block)', async () => {
    const { client } = makeStubClient([granted, { data: null, error: null }])
    expect(await hasAllConsents(
      client as LooseClient, 'm1', ['record_holding', 'ai_assisted_processing'],
    )).toBe(false)
  })
  it('true only when every purpose has an active grant', async () => {
    const { client } = makeStubClient([granted, granted])
    expect(await hasAllConsents(
      client as LooseClient, 'm1', ['record_holding', 'ai_assisted_processing'],
    )).toBe(true)
  })
})

describe('withdrawConsent — RPC-only, append-only model', () => {
  it('goes through the withdraw_own_consent RPC, never a table update', async () => {
    const { client, calls } = makeStubClient([{ data: 2, error: null }])
    expect(await withdrawConsent(client as LooseClient, 'anonymised_research')).toBe(2)
    expect(calls).toEqual([
      { kind: 'rpc', target: 'withdraw_own_consent', args: { p_consent_type: 'anonymised_research' } },
    ])
  })
  it('throws loudly on RPC failure rather than reporting success', async () => {
    const { client } = makeStubClient([
      { data: null, error: { code: '42883', message: 'function does not exist' } },
    ])
    await expect(withdrawConsent(client as LooseClient, 'anonymised_research'))
      .rejects.toThrow(/withdrawConsent failed/)
  })
})

describe('recordSignupConsents — versioned rows with pre-0051 fallback', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type LooseClient = any

  it('writes platform_terms + data_processing with version, exact text, source and actor', async () => {
    const { client, calls } = makeStubClient([{ data: null, error: null }])
    const res = await recordSignupConsents(client as LooseClient, 'u1', 'a@test.local')
    expect(res).toEqual({ ok: true, downgraded: false, error: null })
    expect(calls).toHaveLength(1)
    const rows = calls[0].args as Array<Record<string, unknown>>
    expect(rows.map((r) => r.consent_type)).toEqual(['platform_terms', 'data_processing'])
    for (const row of rows) {
      expect(row.profile_id).toBe('u1')
      expect(row.consented).toBe(true)
      expect(row.consent_version).toBe(CONSENT_TEXT_VERSION)
      expect(row.source).toBe('signup_form')
      expect(row.actor).toBe('member')
    }
    expect(rows[0].consent_text).toBe(CONSENT_TEXTS.platform_terms)
    expect(rows[1].consent_text).toBe(CONSENT_TEXTS.data_processing)
  })

  it('falls back to legacy columns ONLY on a missing-column (pre-0051) error', async () => {
    const { client, calls } = makeStubClient([
      { data: null, error: { code: 'PGRST204', message: "Could not find the 'consent_version' column" } },
      { data: null, error: null },
    ])
    const res = await recordSignupConsents(client as LooseClient, 'u1', 'a@test.local')
    expect(res).toEqual({ ok: true, downgraded: true, error: null })
    expect(calls).toHaveLength(2)
    const legacyRows = calls[1].args as Array<Record<string, unknown>>
    expect(legacyRows.map((r) => r.consent_type)).toEqual(['platform_terms', 'data_processing'])
    for (const row of legacyRows) {
      expect(row).not.toHaveProperty('consent_version')
      expect(row).not.toHaveProperty('consent_text')
      expect(row).not.toHaveProperty('source')
      expect(row).not.toHaveProperty('actor')
    }
  })

  it('42703 (undefined column) also triggers the fallback', async () => {
    const { client, calls } = makeStubClient([
      { data: null, error: { code: '42703', message: 'column does not exist' } },
      { data: null, error: null },
    ])
    const res = await recordSignupConsents(client as LooseClient, 'u1', 'a@test.local')
    expect(res.ok).toBe(true)
    expect(res.downgraded).toBe(true)
    expect(calls).toHaveLength(2)
  })

  it('does NOT swallow other errors — no fallback, error returned intact', async () => {
    const rlsError = { code: '42501', message: 'new row violates row-level security policy' }
    const { client, calls } = makeStubClient([{ data: null, error: rlsError }])
    const res = await recordSignupConsents(client as LooseClient, 'u1', 'a@test.local')
    expect(res).toEqual({ ok: false, downgraded: false, error: rlsError })
    expect(calls).toHaveLength(1) // no legacy retry on a non-schema error
  })

  it('reports a failed fallback as an error too', async () => {
    const { client } = makeStubClient([
      { data: null, error: { code: 'PGRST204', message: 'missing column' } },
      { data: null, error: { code: '42501', message: 'rls denied' } },
    ])
    const res = await recordSignupConsents(client as LooseClient, 'u1', 'a@test.local')
    expect(res.ok).toBe(false)
    expect(res.downgraded).toBe(true)
    expect(res.error?.code).toBe('42501')
  })
})
