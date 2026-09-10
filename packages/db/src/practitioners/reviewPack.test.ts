// Sprint 3 — unit tests for the de-identification builder (pure, no DB).
import { describe, it, expect } from 'vitest'
import { buildReviewPack, scrubIdentifiers, makePseudonym } from './reviewPack'

const SYNTHETIC_SUMMARY = {
  arrivalEmotion: 'hopeful',
  primaryConcerns: ['energy', 'digestion'],
  primarySystem: 'digestive',
  stressLevel: 7,
  sleepQuality: 4,
  energyLevel: 3,
  concernSeverity: 6,
  postExertionalWorsening: true,
  diagnosedConditions: ['synthetic-condition-a'],
  dietDescription: 'Mostly home cooked. Contact me at test@example.com or 07700 900123.',
  currentMedications: 'synthetic-med 10mg',
  currentSupplements: 'magnesium',
  symptomOnset: 'about two years ago',
  // narrative / identifying — must be suppressed by default:
  mostWantToUnderstand: 'Why I crashed after my second child — I am Jane from Ilford.',
  timelineLastWell: 'Before we moved to 42 Albert Road.',
  timelineTrigger: 'A very identifying story.',
  bestSelfDescription: 'Narrative best-self text.',
  someFutureField: 'anything unknown must be suppressed too',
  emptyField: null,
}

describe('buildReviewPack — default-deny de-identification', () => {
  const pack = buildReviewPack('case-1234-uuid', SYNTHETIC_SUMMARY)

  it('passes structured clinical fields through', () => {
    expect(pack.clinical.stressLevel).toBe(7)
    expect(pack.clinical.primaryConcerns).toEqual(['energy', 'digestion'])
    expect(pack.clinical.postExertionalWorsening).toBe(true)
    expect(pack.clinical.diagnosedConditions).toEqual(['synthetic-condition-a'])
  })

  it('suppresses ALL narrative and unknown fields by default', () => {
    for (const f of ['mostWantToUnderstand', 'timelineLastWell', 'timelineTrigger', 'bestSelfDescription', 'someFutureField']) {
      expect(pack.clinical[f]).toBeUndefined()
      expect(pack.suppressedFields).toContain(f)
    }
  })

  it('scrubs identifiers from clinically necessary text', () => {
    const diet = String(pack.clinical.dietDescription)
    expect(diet).not.toContain('test@example.com')
    expect(diet).not.toContain('900123')
    expect(diet).toContain('Mostly home cooked')
  })

  it('never includes the raw narrative anywhere in the serialised pack', () => {
    const json = JSON.stringify(pack)
    expect(json).not.toContain('Jane from Ilford')
    expect(json).not.toContain('42 Albert Road')
  })

  it('null/undefined fields are dropped, not suppressed-listed', () => {
    expect(pack.suppressedFields).not.toContain('emptyField')
  })

  it('pseudonym is deterministic, name-free and case-scoped', () => {
    expect(pack.pseudonym).toMatch(/^NI-[0-9A-F]{6}$/)
    expect(makePseudonym('case-1234-uuid')).toBe(pack.pseudonym)
    expect(makePseudonym('another-case')).not.toBe(pack.pseudonym)
  })
})

describe('scrubIdentifiers', () => {
  it('removes emails, phones, long numbers, links, handles', () => {
    const out = scrubIdentifiers('a@b.co +44 7700 900123 1234567890 https://x.test @someone keep-this')
    expect(out).not.toMatch(/a@b\.co|900123|1234567890|https|@someone/)
    expect(out).toContain('keep-this')
  })
})
