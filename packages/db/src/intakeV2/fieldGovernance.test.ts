// ─── Solicitor controls 1 & 5 — governance metadata tests ─────────────────────
// Prove every field resolves complete purpose/minimisation and retention/
// deletion metadata, and that legal values are explicit states, never
// guesses.

import { describe, it, expect } from 'vitest'
import { resolveAllV2FieldGovernance, V2_CANDIDATE_LAWFUL_BASES, V2_REQUIRED_FIELD_IDS } from './fieldGovernance'
import { V2_FIELD_REGISTRY, v2FieldById } from './fieldRegistry'

const resolved = resolveAllV2FieldGovernance()

describe('control 1 — field purpose / data-minimisation metadata', () => {
  it('every one of the registry fields resolves a full governance record', () => {
    expect(resolved).toHaveLength(V2_FIELD_REGISTRY.length)
    for (const { field, governance } of resolved) {
      expect(governance.purpose.length, field.id).toBeGreaterThan(10)
      expect(['required', 'optional']).toContain(governance.requirement)
      expect('conditionalRule' in governance, field.id).toBe(true)
      expect(['standard', 'sensitive']).toContain(governance.sensitivity)
      expect(['client_and_practitioner', 'practitioner_only', 'operational_only']).toContain(governance.accessScope)
      expect(['assigned_practitioner_only', 'not_shared_operational']).toContain(governance.sharingScope)
      expect(typeof governance.exportEligible, field.id).toBe('boolean')
      expect(['sourced_fact', 'derived', 'practitioner_authored']).toContain(governance.provenanceBehaviour)
    }
  })

  it('only the legally-required minimum is marked required — minimisation by default', () => {
    const required = resolved.filter(({ governance }) => governance.requirement === 'required')
    expect(required.map(({ field }) => field.id).sort()).toEqual([...V2_REQUIRED_FIELD_IDS].sort())
  })

  it('pathway/system fields carry their conditional rule; sensitive fields resolve sensitive', () => {
    for (const { field, governance } of resolved) {
      if (field.domain === 'reproductive') {
        expect(governance.conditionalRule, field.id).toMatch(/pathway/i)
        expect(governance.sensitivity, field.id).toBe('sensitive')
      }
      if (field.domain === 'systems') expect(governance.conditionalRule, field.id).toMatch(/selects that system/i)
      if (field.sensitive) expect(governance.sensitivity, field.id).toBe('sensitive')
    }
  })

  it('operational contact fields are operational-scope, unshared and export-ineligible', () => {
    for (const id of ['profile.email', 'profile.phone', 'profile.address']) {
      const { governance } = resolved.find(({ field }) => field.id === id)!
      expect(governance.accessScope).toBe('operational_only')
      expect(governance.sharingScope).toBe('not_shared_operational')
      expect(governance.exportEligible).toBe(false)
    }
  })

  it('practitioner-only fields resolve practitioner_only access and practitioner_authored provenance', () => {
    for (const { field, governance } of resolved) {
      if (field.practitionerOnly) {
        expect(governance.accessScope, field.id).toBe('practitioner_only')
        expect(governance.provenanceBehaviour, field.id).toBe('practitioner_authored')
      }
    }
  })
})

describe('controls 1 & 5 — approved lawful-basis framework (solicitor follow-up)', () => {
  it('every field resolves an approved profile with concrete Article 6 and Article 9 values', () => {
    for (const { field, governance } of resolved) {
      expect(governance.lawfulBasisProfile, field.id).toBeTruthy()
      expect(governance.article6Basis, field.id).not.toBe('legal_review_required')
      expect(governance.article9Condition, field.id).not.toBe('legal_review_required')
    }
  })

  it('practitioner-care health fields default to the SAFE 9(2)(a) — 9(2)(h) is never automatic', () => {
    const { governance } = resolved.find(({ field }) => field.id === 'intake.concerns[n].own_words')!
    expect(governance.lawfulBasisProfile).toBe('QUALIFYING_HEALTHCARE')
    expect(governance.article6Basis).toBe('art6_1_b_contract')
    expect(governance.article9Condition).toBe('art9_2_a_explicit_consent') // safe default
  })

  it('identity fields resolve ACCOUNT_OPERATION (contract, not special category); faith practices resolve OPTIONAL_SPECIAL_CATEGORY', () => {
    const identity = resolved.find(({ field }) => field.id === 'profile.email')!
    expect(identity.governance.lawfulBasisProfile).toBe('ACCOUNT_OPERATION')
    expect(identity.governance.article9Condition).toBe('not_special_category')
    const faith = resolved.find(({ field }) => field.id === 'intake.lifestyle.faith_cultural_practices')!
    expect(faith.governance.lawfulBasisProfile).toBe('OPTIONAL_SPECIAL_CATEGORY')
    expect(faith.governance.article9Condition).toBe('art9_2_a_explicit_consent')
  })

  it('candidate bases remain quoted from the published privacy policy', () => {
    expect(V2_CANDIDATE_LAWFUL_BASES.source).toContain('legal/privacy')
    expect(V2_CANDIDATE_LAWFUL_BASES.candidates.some((entry) => entry.includes('Article 9(2)(a)'))).toBe(true)
  })
})

describe('control 5 — approved adult retention baseline', () => {
  it('every field resolves an approved retention profile with rule id, A/B eligibility and reason', () => {
    for (const { field, governance } of resolved) {
      expect(governance.retentionRuleId, field.id).toMatch(/^retention\./)
      expect(governance.retentionStatus, field.id).toBe('adult_baseline_approved')
      expect(['eligible_for_deletion_on_request', 'retained_subject_to_documented_rule']).toContain(governance.deletionEligibility)
      expect(governance.retentionReason.length, field.id).toBeGreaterThan(20)
    }
  })

  it('practitioner-care record fields carry the approved 8-year baseline; identity carries the 90-day closure rule', () => {
    const health = resolved.find(({ field }) => field.id === v2FieldById('intake.concerns[n].own_words')!.id)!
    expect(health.governance.retentionProfileId).toBe('practitioner_care_record')
    expect(health.governance.deletionEligibility).toBe('retained_subject_to_documented_rule')
    expect(health.governance.retentionReason).toContain('8 years')
    const identity = resolved.find(({ field }) => field.id === 'profile.email')!
    expect(identity.governance.retentionProfileId).toBe('account_identity')
    expect(identity.governance.deletionEligibility).toBe('eligible_for_deletion_on_request')
    expect(identity.governance.retentionReason).toContain('90 days')
  })
})
