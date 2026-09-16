// ─── Field Registry v1 — structural and firewall tests ────────────────────────
// Pure data tests: no DB. These encode the KR-approved mapping guarantees:
// unique IDs, complete metadata, the ask-once model, the practitioner
// firewall (intake can never write analysis/observation fields), and the
// controlled-language rule over every registry label and note.

import { describe, it, expect } from 'vitest'
import {
  V2_FIELD_REGISTRY, v2FieldById, v2IntakeWritableFields, v2ConfirmOnlyFields,
  v2FieldsForDomain, V2_FAMILY_RELATIVES, V2_FAMILY_CATEGORIES, V2_SYSTEM_KEYS,
} from './fieldRegistry'
import { V2_PROVENANCE_STATES } from './provenance'

describe('field registry v1 — structure', () => {
  it('has no duplicate field IDs', () => {
    const ids = V2_FIELD_REGISTRY.map((field) => field.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every field carries label, domain, source and an explicit synopsis destination (or null)', () => {
    for (const field of V2_FIELD_REGISTRY) {
      expect(field.id.length, field.id).toBeGreaterThan(0)
      expect(field.label.length, field.id).toBeGreaterThan(0)
      expect(field.domain, field.id).toBeTruthy()
      expect(field.source, field.id).toBeTruthy()
      expect('synopsisSection' in field, field.id).toBe(true)
    }
  })

  it('covers every approved domain', () => {
    const domains = new Set(V2_FIELD_REGISTRY.map((field) => field.domain))
    for (const domain of ['identity', 'care_context', 'case_snapshot', 'care_in_place', 'concerns',
      'diagnoses', 'medications', 'supplements', 'family', 'early_life', 'systems', 'reproductive',
      'food', 'lifestyle', 'timeline', 'observation', 'safety', 'analysis'] as const) {
      expect(domains.has(domain), domain).toBe(true)
    }
  })

  it('instantiates the full family grid (relatives × categories)', () => {
    expect(v2FieldsForDomain('family')).toHaveLength(V2_FAMILY_RELATIVES.length * V2_FAMILY_CATEGORIES.length)
    expect(v2FieldById('intake.family.mother.thyroid_endocrine')).toBeDefined()
    expect(v2FieldById('intake.family.other[n].detail')).toBeDefined()
  })

  it('instantiates all twelve systems with the five per-system fields', () => {
    expect(v2FieldsForDomain('systems')).toHaveLength(V2_SYSTEM_KEYS.length * 5)
  })

  it('family mental_health is sensitive (needs why-we-ask) for every relative', () => {
    const rows = V2_FIELD_REGISTRY.filter((field) => field.id.endsWith('.mental_health'))
    expect(rows).toHaveLength(V2_FAMILY_RELATIVES.length)
    for (const row of rows) expect(row.sensitive, row.id).toBe(true)
  })

  it('every reproductive field is sensitive AND skippable', () => {
    for (const field of v2FieldsForDomain('reproductive')) {
      expect(field.sensitive, field.id).toBe(true)
      expect(field.skippable, field.id).toBe(true)
    }
  })

  it('uploads and photo are placeholder-only (no active storage in this build)', () => {
    for (const id of ['intake.care.uploads[n].file_ref', 'intake.diagnoses[n].documents[m].file_ref', 'practitioner.observation.photo']) {
      expect(v2FieldById(id)?.placeholderOnly, id).toBe(true)
    }
  })
})

describe('field registry v1 — ask-once model', () => {
  it('profile and care-profile fields are ask-once and never duplicated inside intake domains', () => {
    for (const field of v2ConfirmOnlyFields()) {
      expect(['account_profile', 'care_profile']).toContain(field.source)
    }
    // No intake-sourced field re-asks a profile fact.
    for (const field of V2_FIELD_REGISTRY.filter((entry) => entry.source === 'intake_v2')) {
      expect(field.id.startsWith('profile.'), field.id).toBe(false)
      expect(field.id.startsWith('care_profile.'), field.id).toBe(false)
      expect(field.askOnce ?? false, field.id).toBe(false)
    }
  })

  it('operational contact fields are excluded from practitioner export by default', () => {
    for (const id of ['profile.email', 'profile.phone', 'profile.address']) {
      const field = v2FieldById(id)
      expect(field?.exportExcluded, id).toBe(true)
      expect(field?.synopsisSection, id).toBeNull()
    }
  })
})

describe('field registry v1 — practitioner firewall', () => {
  it('every practitioner.analysis.* field is practitioner-only, analysis-sourced, and NOT intake-writable', () => {
    const analysis = V2_FIELD_REGISTRY.filter((field) => field.id.startsWith('practitioner.analysis.'))
    expect(analysis).toHaveLength(11)
    const writable = new Set(v2IntakeWritableFields().map((field) => field.id))
    for (const field of analysis) {
      expect(field.practitionerOnly, field.id).toBe(true)
      expect(field.source, field.id).toBe('practitioner_analysis')
      expect(field.synopsisSection, field.id).toBe('analysis_plan')
      expect(writable.has(field.id), field.id).toBe(false)
    }
  })

  it('physical observations and interaction review are practitioner-only and NOT intake-writable', () => {
    const writable = new Set(v2IntakeWritableFields().map((field) => field.id))
    for (const field of V2_FIELD_REGISTRY.filter((entry) =>
      entry.id.startsWith('practitioner.observation.') || entry.id === 'practitioner.medications.interaction_review')) {
      expect(field.practitionerOnly, field.id).toBe(true)
      expect(writable.has(field.id), field.id).toBe(false)
    }
  })

  it('intake-writable fields never include a practitioner.* or safety.* or derived field', () => {
    for (const field of v2IntakeWritableFields()) {
      expect(field.id.startsWith('practitioner.'), field.id).toBe(false)
      expect(field.id.startsWith('safety.'), field.id).toBe(false)
      expect(field.derived ?? false, field.id).toBe(false)
    }
  })

  it('safety fields are derived from clinician-owned metadata, never asked', () => {
    const safety = v2FieldsForDomain('safety')
    expect(safety).toHaveLength(6)
    for (const field of safety) {
      expect(field.source, field.id).toBe('safety_derived')
      expect(field.derived, field.id).toBe(true)
      expect(field.synopsisSection, field.id).toBe('safety_review')
    }
  })
})

describe('field registry v1 — provenance & language', () => {
  it('the provenance model is exactly the four approved states', () => {
    expect([...V2_PROVENANCE_STATES]).toEqual(['client_reported', 'practitioner_verified', 'corrected', 'missing'])
  })

  it('no registry label or note uses banned interpretive language', () => {
    // Terms that would smuggle assessment into a facts registry. Attributed/
    // negated usage is checked by hand in review; labels and notes must not
    // carry these except inside an explicit negation ("never", "not", "no ").
    const banned = /(root cause|most likely|likely condition|risk score|high risk|low risk|urgent|triage|prognosis|predict|detect)/i
    for (const field of V2_FIELD_REGISTRY) {
      const text = `${field.label} ${field.notes ?? ''}`
      const match = text.match(banned)
      if (match) {
        const negated = new RegExp(`(never|not|no)[^.]*${match[0]}`, 'i').test(text)
        expect(negated, `${field.id}: "${match[0]}" outside a negation`).toBe(true)
      }
    }
  })
})
