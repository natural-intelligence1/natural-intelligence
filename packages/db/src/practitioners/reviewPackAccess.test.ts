// Sprint 3 — review-pack workspace mode: flag semantics, safe-column reads,
// no-fallback behaviour and the generation contract's de-identification of
// the case's contextual free text.
import { describe, it, expect, afterEach } from 'vitest'
import {
  isReviewPacksEnabled, getReviewPackForCase,
  assertSynopsisSharingPermitted, generateAndStoreReviewPack,
} from './reviewPackAccess'
import { buildReviewPack, ITEM_WITHHELD } from './reviewPack'
import { makeStubClient } from './__test-helpers__/stubQueryClient'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseClient = any

const FLAG = 'PRACTITIONER_REVIEW_PACKS_ENABLED'
const savedFlag = process.env[FLAG]
afterEach(() => {
  if (savedFlag === undefined) delete process.env[FLAG]
  else process.env[FLAG] = savedFlag
})

describe('PRACTITIONER_REVIEW_PACKS_ENABLED flag', () => {
  it('is OFF when unset (default)', () => {
    delete process.env[FLAG]
    expect(isReviewPacksEnabled()).toBe(false)
  })
  it('is OFF for every value except the exact string "true"', () => {
    for (const v of ['false', 'TRUE', 'True', '1', 'yes', ' true', 'true ']) {
      process.env[FLAG] = v
      expect(isReviewPacksEnabled()).toBe(false)
    }
  })
  it('is ON only for exactly "true"', () => {
    process.env[FLAG] = 'true'
    expect(isReviewPacksEnabled()).toBe(true)
  })
})

describe('getReviewPackForCase — safe columns and no fallback', () => {
  it('selects ONLY the safe columns — never audit/source fields', async () => {
    const { client, calls } = makeStubClient([{ data: null, error: null }])
    await getReviewPackForCase(client as LooseClient, 'case-1')
    expect(calls).toHaveLength(1)
    expect(calls[0].target).toBe('practitioner_review_packs')
    const cols = calls[0].columns ?? ''
    expect(cols).toBe('id, case_id, pseudonym, pack, pack_version, generated_at')
    for (const forbidden of ['source_intake_id', 'suppressed_fields', 'transformed_fields', 'generated_by', '*']) {
      expect(cols).not.toContain(forbidden)
    }
  })

  it('returns null on error (pre-migration / RLS denial) — caller must show the blocked state', async () => {
    const { client } = makeStubClient([
      { data: null, error: { code: '42P01', message: 'relation does not exist' } },
    ])
    expect(await getReviewPackForCase(client as LooseClient, 'case-1')).toBeNull()
  })

  it('returns null when no pack exists — never a substitute data source', async () => {
    const { client } = makeStubClient([{ data: null, error: null }])
    expect(await getReviewPackForCase(client as LooseClient, 'case-1')).toBeNull()
  })

  it('returns the pack row when one exists', async () => {
    const row = {
      id: 'p1', case_id: 'case-1', pseudonym: 'NI-4F7A2C',
      pack: { clinical: { stressLevel: 7 } }, pack_version: 2, generated_at: '2026-09-11T00:00:00Z',
    }
    const { client } = makeStubClient([{ data: row, error: null }])
    expect(await getReviewPackForCase(client as LooseClient, 'case-1')).toEqual(row)
  })
})

describe('generation contract — case primary_concern is token-normalised, never free text', () => {
  it('a long identifying case concern merged into primaryConcerns cannot pass through', () => {
    // Mirrors generateAndStoreReviewPack: the case's free-text primary_concern
    // is appended to the primaryConcerns list before the default-deny build.
    const summary = {
      primaryConcerns: [
        'fatigue',
        'Ongoing insomnia since moving to 12 Elm Road — GP is Dr Sarah Jones (sarah.jones@nhs.net)',
      ],
      stressLevel: 7,
    }
    const pack = buildReviewPack('case-1', summary)
    const tokens = pack.clinical.primaryConcerns as string[]
    expect(tokens[0]).toBe('fatigue')
    // toSafeToken: >3 words / >30 chars → withheld marker, so names, addresses
    // and emails in contextual free text can never surface.
    expect(tokens[1]).toBe(ITEM_WITHHELD)
    const serialised = JSON.stringify(pack)
    expect(serialised).not.toContain('Elm Road')
    expect(serialised).not.toContain('Sarah')
    expect(serialised).not.toContain('nhs.net')
  })
})

describe('assertSynopsisSharingPermitted — fail-closed consent gate', () => {
  const granted = {
    data: { consented: true, withdrawn_at: null, consented_at: '2026-09-01T00:00:00Z' },
    error: null,
  }
  const noBlocks = { data: [], error: null }

  it('throws when there is NO active deidentified_synopsis_sharing consent', async () => {
    const { client } = makeStubClient([{ data: null, error: null }])
    await expect(assertSynopsisSharingPermitted(client as LooseClient, 'm1'))
      .rejects.toThrow(/no active consent for de-identified synopsis sharing/)
  })

  it('throws when the consent read errors (pre-migration / degraded) — fail closed', async () => {
    const { client } = makeStubClient([
      { data: null, error: { code: '42703', message: 'column does not exist' } },
    ])
    await expect(assertSynopsisSharingPermitted(client as LooseClient, 'm1'))
      .rejects.toThrow(/no active consent/)
  })

  it('throws when consent was granted but later withdrawn', async () => {
    const { client } = makeStubClient([
      { data: { consented: true, withdrawn_at: '2026-09-10T00:00:00Z', consented_at: 'x' }, error: null },
    ])
    await expect(assertSynopsisSharingPermitted(client as LooseClient, 'm1'))
      .rejects.toThrow(/no active consent/)
  })

  it('throws on a GLOBAL restriction even with active consent', async () => {
    const { client } = makeStubClient([
      granted,
      { data: [{ id: 'r1', request_type: 'restriction', consent_type: null }], error: null },
    ])
    await expect(assertSynopsisSharingPermitted(client as LooseClient, 'm1'))
      .rejects.toThrow(/restriction, erasure request or consent withdrawal/)
  })

  it('throws on a purpose-specific withdrawal request even with an (older) active consent row', async () => {
    const { client } = makeStubClient([
      granted,
      { data: [], error: null }, // no global rows
      { data: [{ id: 'r2' }], error: null }, // withdrawal naming this purpose
    ])
    await expect(assertSynopsisSharingPermitted(client as LooseClient, 'm1'))
      .rejects.toThrow(/restriction, erasure request or consent withdrawal/)
  })

  it('passes only with active consent AND nothing blocking on file', async () => {
    const { client } = makeStubClient([granted, noBlocks, noBlocks])
    await expect(assertSynopsisSharingPermitted(client as LooseClient, 'm1')).resolves.toBeUndefined()
  })
})

describe('generateAndStoreReviewPack — consent enforced before any identified read', () => {
  it('refuses to generate for a member without synopsis-sharing consent', async () => {
    const { client, calls } = makeStubClient([
      // 1. case lookup succeeds
      { data: { id: 'case-1', client_id: 'm1', primary_concern: null }, error: null },
      // 2. consent lookup: no row
      { data: null, error: null },
    ])
    await expect(generateAndStoreReviewPack(client as LooseClient, 'case-1', 'admin-1'))
      .rejects.toThrow(/no active consent for de-identified synopsis sharing/)
    // Only client_cases + consent_records were touched — the identified intake
    // tables were never read and nothing was inserted.
    expect(calls.map((c) => c.target)).toEqual(['client_cases', 'consent_records'])
  })
})
