// ─── Approved lawful-basis + retention profiles — tests ───────────────────────

import { describe, it, expect } from 'vitest'
import {
  LAWFUL_BASIS_PROFILES, resolvePractitionerCareArticle9,
  RETENTION_PROFILES, resolveRetention, MINOR_RETENTION_GATE,
} from './legalProfiles'
import { V2_SYNOPSIS_DEFAULT_VIEW } from './synopsisMapping'

describe('C1 — lawful-basis profiles', () => {
  it('the approved profiles resolve the framework pairings', () => {
    expect(LAWFUL_BASIS_PROFILES.SELF_SERVE_HEALTH.article6).toBe('art6_1_b_contract')
    expect(LAWFUL_BASIS_PROFILES.SELF_SERVE_HEALTH.article9).toBe('art9_2_a_explicit_consent')
    expect(LAWFUL_BASIS_PROFILES.QUALIFYING_HEALTHCARE.article9).toBe('art9_2_h_health_social_care')
    expect(LAWFUL_BASIS_PROFILES.OPTIONAL_SPECIAL_CATEGORY.article6).toBe('art6_1_a_consent')
    expect(LAWFUL_BASIS_PROFILES.SECURITY_ACCESS_AUDIT.article6).toBe('art6_1_f_legitimate_interests')
  })

  it('Category-2-only care does NOT automatically receive 9(2)(h): safe default is explicit consent', () => {
    expect(resolvePractitionerCareArticle9({ qualifyingConfidentialityEstablished: false }))
      .toBe('art9_2_a_explicit_consent')
    expect(resolvePractitionerCareArticle9({ qualifyingConfidentialityEstablished: true }))
      .toBe('art9_2_h_health_social_care')
  })

  it('safeguarding remains case-specific — never a generic health-data permission; vital interests is emergency-only', () => {
    expect(LAWFUL_BASIS_PROFILES.SAFEGUARDING.article6).toBe('case_specific_assessment_required')
    expect(LAWFUL_BASIS_PROFILES.SAFEGUARDING.article9).toBe('case_specific_assessment_required')
    expect(LAWFUL_BASIS_PROFILES.SAFEGUARDING.note).toMatch(/never a generic/i)
    expect(LAWFUL_BASIS_PROFILES.VITAL_INTERESTS.note).toMatch(/genuine emergency/i)
  })
})

describe('C2 — approved adult retention baseline', () => {
  it('the approved profiles resolve the solicitor baseline', () => {
    expect(RETENTION_PROFILES.practitioner_care_record.adultBaseline).toContain('8 years')
    expect(RETENTION_PROFILES.account_identity.adultBaseline).toContain('90 days')
    expect(RETENTION_PROFILES.consent_records.adultBaseline).toContain('6 years')
    expect(RETENTION_PROFILES.rights_requests.adultBaseline).toContain('3 years')
    expect(RETENTION_PROFILES.governance_review_packs.adultBaseline).toContain('6 years')
    expect(RETENTION_PROFILES.safeguarding_records.adultBaseline).toMatch(/8 years.*legal hold/i)
    const adult = resolveRetention('practitioner_care_record', { subjectIsMinor: false })
    expect(adult.status).toBe('adult_baseline_approved')
  })

  it('MINORS never silently inherit the adult schedule — the hard gate applies', () => {
    for (const profileId of Object.keys(RETENTION_PROFILES) as (keyof typeof RETENTION_PROFILES)[]) {
      const result = resolveRetention(profileId, { subjectIsMinor: true })
      expect(result.status).toBe('minor_schedule_required')
      if (result.status === 'minor_schedule_required') {
        expect(result.gate).toBe(MINOR_RETENTION_GATE)
      }
    }
    expect(MINOR_RETENTION_GATE).toContain('UNDER-18')
  })
})

describe('SK declutter — default synopsis view policy', () => {
  it('the default view hides question ids, per-line provenance/timestamps, workflow metadata and empty rows', () => {
    expect(V2_SYNOPSIS_DEFAULT_VIEW.showQuestionIds).toBe(false)
    expect(V2_SYNOPSIS_DEFAULT_VIEW.showOriginalQuestionText).toBe(false)
    expect(V2_SYNOPSIS_DEFAULT_VIEW.showPerLineProvenanceChips).toBe(false)
    expect(V2_SYNOPSIS_DEFAULT_VIEW.showPerLineTimestamps).toBe(false)
    expect(V2_SYNOPSIS_DEFAULT_VIEW.showWorkflowMetadata).toBe(false)
    expect(V2_SYNOPSIS_DEFAULT_VIEW.showEmptyFields).toBe(false)
    expect(V2_SYNOPSIS_DEFAULT_VIEW.showNoneReportedRows).toBe(false)
    expect(V2_SYNOPSIS_DEFAULT_VIEW.provenanceDisclosureLabel).toBe('Source details')
  })
})
