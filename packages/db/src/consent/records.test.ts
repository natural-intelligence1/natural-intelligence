// Sprint 3 — consent read helpers are FAIL-CLOSED: any error, absence or
// withdrawal counts as not consented, so intake saves cannot proceed on
// uncertainty. (The intake actions call hasAllConsents before every save.)
import { describe, it, expect } from 'vitest'
import { hasActiveConsent, hasAllConsents, withdrawConsent } from './records'
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
