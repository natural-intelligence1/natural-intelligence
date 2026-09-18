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

describe('controls 1 & 5 — legal placeholders are explicit, never guessed', () => {
  it('every field resolves Article 6 and Article 9 to the explicit legal_review_required state', () => {
    for (const { field, governance } of resolved) {
      expect(governance.article6Basis, field.id).toBe('legal_review_required')
      expect(governance.article9Condition, field.id).toBe('legal_review_required')
    }
  })

  it('candidate bases are quoted from the published privacy policy, as candidates only', () => {
    expect(V2_CANDIDATE_LAWFUL_BASES.source).toContain('legal/privacy')
    expect(V2_CANDIDATE_LAWFUL_BASES.candidates.some((entry) => entry.includes('Article 9(2)(a)'))).toBe(true)
  })
})

describe('control 5 — retention / deletion metadata', () => {
  it('every field resolves retention rule id, status, deletion eligibility and reason', () => {
    for (const { field, governance } of resolved) {
      expect(governance.retentionRuleId, field.id).toMatch(/^retention\./)
      expect(governance.retentionStatus, field.id).toBe('retention_policy_pending')
      expect(['eligible_for_deletion_on_request', 'retained_subject_to_documented_rule',
        'retention_policy_pending', 'legal_review_required']).toContain(governance.deletionEligibility)
      expect(governance.retentionReason.length, field.id).toBeGreaterThan(20)
    }
  })

  it('health-record fields are category B (retained subject to documented rule) — nothing implies immediate deletion', () => {
    const healthField = v2FieldById('intake.concerns[n].own_words')!
    const { governance } = resolved.find(({ field }) => field.id === healthField.id)!
    expect(governance.deletionEligibility).toBe('retained_subject_to_documented_rule')
    expect(governance.retentionRuleId).toBe('retention.health_record.v1')
    // No retention PERIOD is stated anywhere (not approved yet).
    for (const { governance: entry } of resolved) {
      expect(JSON.stringify(entry)).not.toMatch(/\b\d+\s*(year|month|day)s?\b/i)
    }
  })
})
