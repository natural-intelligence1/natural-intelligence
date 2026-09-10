// Sprint 3 — unit tests for rights-request constants and the status machine.
import { describe, it, expect } from 'vitest'
import {
  RIGHTS_REQUEST_TYPES, isRightsRequestType, isValidTransition,
  isGlobalRestrictionRow,
} from './requests'
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
    expect(CONSENT_TEXT_VERSION).toBe('s3-draft-1')
    expect(isConsentPurpose('record_holding')).toBe(true)
    expect(isConsentPurpose('sell_my_data')).toBe(false)
  })
  it('AI consent text states the no-clinical-decision rule', () => {
    expect(CONSENT_TEXTS.ai_assisted_processing).toContain('makes no clinical decision')
  })
})
