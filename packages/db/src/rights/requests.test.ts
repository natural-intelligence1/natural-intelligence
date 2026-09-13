// Sprint 3 — unit tests for rights-request constants and the status machine.
import { describe, it, expect } from 'vitest'
import {
  RIGHTS_REQUEST_TYPES, isRightsRequestType, isValidTransition,
  isGlobalRestrictionRow, isProcessingBlocked, isRightsChannelAvailable,
} from './requests'
import { makeStubClient } from '../practitioners/__test-helpers__/stubQueryClient'
import {
  CONSENT_PURPOSES, CONSENT_TEXTS, REQUIRED_INTAKE_CONSENTS,
  isConsentPurpose, CONSENT_TEXT_VERSION,
} from '../consent/purposes'

describe('rights request types', () => {
  it('covers all six GDPR/consent channels', () => {
    expect([...RIGHTS_REQUEST_TYPES].sort()).toEqual(
      ['access', 'consent_withdrawal', 'correction', 'erasure', 'export', 'restriction'],
    )
  })
  it('rejects unknown types', () => {
    expect(isRightsRequestType('access')).toBe(true)
    expect(isRightsRequestType('delete-everything')).toBe(false)
  })
})

describe('status machine', () => {
  it('allows forward flow', () => {
    expect(isValidTransition('new', 'acknowledged')).toBe(true)
    expect(isValidTransition('acknowledged', 'in_progress')).toBe(true)
    expect(isValidTransition('in_progress', 'fulfilled')).toBe(true)
    expect(isValidTransition('new', 'refused')).toBe(true)
  })
  it('terminal states accept no transitions', () => {
    for (const t of ['fulfilled', 'refused', 'withdrawn'] as const) {
      expect(isValidTransition(t, 'new')).toBe(false)
      expect(isValidTransition(t, 'in_progress')).toBe(false)
    }
  })
  it('no backwards flow', () => {
    expect(isValidTransition('in_progress', 'new')).toBe(false)
    expect(isValidTransition('acknowledged', 'new')).toBe(false)
  })
})

describe('global-restriction semantics (second review, item 5)', () => {
  it('restriction and erasure are always global', () => {
    expect(isGlobalRestrictionRow({ request_type: 'restriction', consent_type: null })).toBe(true)
    expect(isGlobalRestrictionRow({ request_type: 'erasure', consent_type: 'anything' })).toBe(true)
  })
  it('blanket withdrawal (no purpose) is global', () => {
    expect(isGlobalRestrictionRow({ request_type: 'consent_withdrawal', consent_type: null })).toBe(true)
  })
  it('withdrawing data_processing is treated as a GLOBAL restriction', () => {
    expect(isGlobalRestrictionRow({ request_type: 'consent_withdrawal', consent_type: 'data_processing' })).toBe(true)
  })
  it('purpose-specific withdrawals are NOT global', () => {
    expect(isGlobalRestrictionRow({ request_type: 'consent_withdrawal', consent_type: 'anonymised_research' })).toBe(false)
    expect(isGlobalRestrictionRow({ request_type: 'access', consent_type: null })).toBe(false)
  })
})

describe('isProcessingBlocked — enforcement question', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type LooseClient = any

  it('a GLOBAL restriction blocks every purpose', async () => {
    const { client } = makeStubClient([
      { data: [{ id: 'r1', request_type: 'restriction', consent_type: null }], error: null },
    ])
    expect(await isProcessingBlocked(client as LooseClient, 'm1', 'ai_assisted_processing')).toBe(true)
  })

  it('a purpose-specific withdrawal blocks that purpose', async () => {
    const { client } = makeStubClient([
      { data: [], error: null },          // no global restriction rows
      { data: [{ id: 'r2' }], error: null }, // withdrawal naming this purpose
    ])
    expect(await isProcessingBlocked(client as LooseClient, 'm1', 'ai_assisted_processing')).toBe(true)
  })

  it('a purpose-specific withdrawal does NOT block other purposes', async () => {
    const { client } = makeStubClient([
      // hasActiveRestriction sees the row but it is not global…
      { data: [{ id: 'r2', request_type: 'consent_withdrawal', consent_type: 'anonymised_research' }], error: null },
      // …and no withdrawal names the queried purpose.
      { data: [], error: null },
    ])
    expect(await isProcessingBlocked(client as LooseClient, 'm1', 'ai_assisted_processing')).toBe(false)
  })

  it('unblocked when nothing is on file', async () => {
    const { client } = makeStubClient([
      { data: [], error: null },
      { data: [], error: null },
    ])
    expect(await isProcessingBlocked(client as LooseClient, 'm1', 'ai_assisted_processing')).toBe(false)
  })
})

describe('consent purposes', () => {
  it('every purpose has exact text; new purposes carry the DRAFT marker', () => {
    for (const p of CONSENT_PURPOSES) {
      expect(CONSENT_TEXTS[p].length).toBeGreaterThan(20)
      if (p !== 'platform_terms' && p !== 'data_processing') {
        expect(CONSENT_TEXTS[p]).toContain('DRAFT — requires solicitor/clinician review')
      }
    }
  })
  it('required-at-intake set is record_holding + ai_assisted_processing', () => {
    expect([...REQUIRED_INTAKE_CONSENTS].sort()).toEqual(['ai_assisted_processing', 'record_holding'])
  })
  it('version stamp present and purpose guard works', () => {
    expect(CONSENT_TEXT_VERSION).toBe('s3-draft-2')
    expect(isConsentPurpose('record_holding')).toBe(true)
    expect(isConsentPurpose('sell_my_data')).toBe(false)
  })
  it('AI consent text states the no-clinical-decision rule', () => {
    expect(CONSENT_TEXTS.ai_assisted_processing).toContain('makes no clinical decision')
  })
})

describe('isRightsChannelAvailable — privacy-page degraded state (final review, item 4)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type LooseClient = any

  it('false when the table is missing (pre-0051) — page must render the degraded state', async () => {
    const { client } = makeStubClient([
      { data: null, error: { code: '42P01', message: 'relation "client_rights_requests" does not exist' } },
    ])
    expect(await isRightsChannelAvailable(client as LooseClient)).toBe(false)
  })

  it('true when the table is queryable', async () => {
    const { client } = makeStubClient([{ data: [], error: null }])
    expect(await isRightsChannelAvailable(client as LooseClient)).toBe(true)
  })
})
