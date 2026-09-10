// Sprint 3 — unit tests for the de-identification builder (pure, no DB).
// Review amendment 5: prove that CONTEXTUAL identifying text is withheld —
// not merely emails/phones/links — and that no verbatim free text survives.
import { describe, it, expect } from 'vitest'
import {
  buildReviewPack, scrubIdentifiers, makePseudonym, toShortItems,
  isShortDuration, ITEM_WITHHELD,
} from './reviewPack'

const SYNTHETIC_SUMMARY = {
  arrivalEmotion: 'hopeful',
  primaryConcerns: ['energy', 'digestion'],
  primarySystem: 'digestive',
  stressLevel: 7,
  sleepQuality: 4,
  energyLevel: 3,
  concernSeverity: 6,
  postExertionalWorsening: true,
  // list fields — transformed, item-by-item:
  diagnosedConditions: [
    'hypothyroidism',
    'extremely-rare syndrome diagnosed at the Ilford specialist clinic in 2019',
  ],
  currentMedications: 'synthetic-med 10mg, prescribed by Dr Smith at Albert Road surgery after my accident',
  currentSupplements: 'magnesium; vitamin D',
  symptomOnset: 'about two years ago',
  // prose — must be suppressed outright:
  dietDescription: 'Mostly home cooked. I eat at my sister Fatima’s house on Fridays.',
  mostWantToUnderstand: 'Why I crashed after my second child — I am Jane from Ilford.',
  timelineLastWell: 'Before we moved to 42 Albert Road.',
  bestSelfDescription: 'Narrative best-self text.',
  someFutureField: 'anything unknown must be suppressed too',
  emptyField: null,
}

describe('buildReviewPack — default-deny, no verbatim free text', () => {
  const pack = buildReviewPack('case-1234-uuid', SYNTHETIC_SUMMARY)

  it('passes structured clinical fields through', () => {
    expect(pack.clinical.stressLevel).toBe(7)
    expect(pack.clinical.primaryConcerns).toEqual(['energy', 'digestion'])
    expect(pack.clinical.postExertionalWorsening).toBe(true)
  })

  it('transforms list fields to short items and withholds contextual entries', () => {
    expect(pack.clinical.currentSupplements).toEqual(['magnesium', 'vitamin D'])
    const meds = pack.clinical.currentMedications as string[]
    expect(meds[0]).toBe('synthetic-med 10mg')
    // the "prescribed by Dr Smith at Albert Road surgery…" context is withheld
    expect(meds[1]).toBe(ITEM_WITHHELD)
    expect(pack.transformedFields).toContain('currentMedications')
  })

  it('treats rare/verbose diagnosed conditions as potentially identifying', () => {
    const conditions = pack.clinical.diagnosedConditions as string[]
    expect(conditions[0]).toBe('hypothyroidism')
    expect(conditions[1]).toBe(ITEM_WITHHELD)   // rare-condition story dropped
  })

  it('keeps only duration-shaped symptom onset', () => {
    expect(pack.clinical.symptomOnset).toBe('about two years ago')
    const longOnset = buildReviewPack('c', { symptomOnset: 'it started when I was working nights at the Ilford depot and my manager…' })
    expect(longOnset.clinical.symptomOnset).toBeUndefined()
    expect(longOnset.suppressedFields).toContain('symptomOnset')
  })

  it('suppresses dietDescription and ALL prose/unknown fields outright', () => {
    for (const f of ['dietDescription', 'mostWantToUnderstand', 'timelineLastWell', 'bestSelfDescription', 'someFutureField']) {
      expect(pack.clinical[f]).toBeUndefined()
      expect(pack.suppressedFields).toContain(f)
    }
  })

  it('no contextual identifying text survives anywhere in the serialised pack', () => {
    const json = JSON.stringify(pack)
    for (const leak of ['Jane from Ilford', 'Albert Road', 'Dr Smith', 'Fatima', 'specialist clinic', 'accident']) {
      expect(json).not.toContain(leak)
    }
  })

  it('null fields are dropped, not suppressed-listed', () => {
    expect(pack.suppressedFields).not.toContain('emptyField')
  })

  it('pseudonym is deterministic, name-free and case-scoped', () => {
    expect(pack.pseudonym).toMatch(/^NI-[0-9A-F]{6}$/)
    expect(makePseudonym('case-1234-uuid')).toBe(pack.pseudonym)
    expect(makePseudonym('another-case')).not.toBe(pack.pseudonym)
  })
})

describe('toShortItems', () => {
  it('withholds items carrying identifiers even when short', () => {
    expect(toShortItems('med a, ring 07700 900123')).toEqual(['med a', ITEM_WITHHELD])
  })
  it('withholds long or wordy items', () => {
    expect(toShortItems(['ok item', 'this one is a five word story'])).toEqual(['ok item', ITEM_WITHHELD])
  })
})

describe('isShortDuration', () => {
  it('accepts short duration phrases and rejects narratives/identifiers', () => {
    expect(isShortDuration('since spring 2019')).toBe(true)
    expect(isShortDuration('after I emailed jane@x.com about it')).toBe(false)
  })
})

describe('scrubIdentifiers', () => {
  it('removes emails, phones, long numbers, links, handles', () => {
    const out = scrubIdentifiers('a@b.co +44 7700 900123 1234567890 https://x.test @someone keep-this')
    expect(out).not.toMatch(/a@b\.co|900123|1234567890|https|@someone/)
    expect(out).toContain('keep-this')
  })
})
