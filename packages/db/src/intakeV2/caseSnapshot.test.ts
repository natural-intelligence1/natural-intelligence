// ─── Case snapshot builder + provenance preservation — tests ──────────────────

import { describe, it, expect } from 'vitest'
import { buildCaseSnapshot, type V2AccountProfile, type V2CareProfile } from './caseSnapshot'
import { clientReported, correctFact, verifyFact, missingFact } from './provenance'

const profile: V2AccountProfile = {
  legalName: 'Rowan Example', preferredName: 'Rowan', dob: '1985-03-14',
  email: 'rowan@example.test', phone: '07000 000000', address: '1 Sample Street',
}
const care: V2CareProfile = { sex: 'female', occupation: 'Teacher', heightCm: 165, weightKg: 62 }
const answers = { 'intake.concerns[0].own_words': 'Exactly what I typed — verbatim.' }

describe('buildCaseSnapshot (pure, no persistence)', () => {
  it('derives age at submission from DOB', () => {
    const snapshot = buildCaseSnapshot({ accountProfile: profile, careProfile: care, intakeAnswers: answers, submittedAt: '2026-09-16T09:00:00Z' })
    expect(snapshot.ageDerived).toBe(41)
    // Day before the birthday → one year less.
    expect(buildCaseSnapshot({ accountProfile: profile, careProfile: care, intakeAnswers: {}, submittedAt: '2026-03-13T09:00:00Z' }).ageDerived).toBe(40)
  })

  it('derives BMI as a NUMBER only — and null when height/weight are absent', () => {
    const snapshot = buildCaseSnapshot({ accountProfile: profile, careProfile: care, intakeAnswers: {}, submittedAt: '2026-09-16T09:00:00Z' })
    expect(snapshot.bmiDerived).toBe(22.8)
    expect(typeof snapshot.bmiDerived).toBe('number')
    // No label/category/interpretation key exists anywhere on the snapshot.
    expect(JSON.stringify(snapshot)).not.toMatch(/category|label|band|interpretation|healthy|overweight|underweight|obese/i)
    expect(buildCaseSnapshot({ accountProfile: profile, careProfile: {}, intakeAnswers: {}, submittedAt: '2026-09-16T09:00:00Z' }).bmiDerived).toBeNull()
  })

  it('freezes intake answers verbatim and excludes operational contact fields from the practitioner-facing profile', () => {
    const snapshot = buildCaseSnapshot({ accountProfile: profile, careProfile: care, intakeAnswers: answers, submittedAt: '2026-09-16T09:00:00Z' })
    expect(snapshot.intakeFrozen['intake.concerns[0].own_words']).toBe('Exactly what I typed — verbatim.')
    expect(snapshot.profileFrozen).toEqual({ legalName: 'Rowan Example', preferredName: 'Rowan', dob: '1985-03-14' })
    expect(JSON.stringify(snapshot)).not.toContain('rowan@example.test')
    expect(JSON.stringify(snapshot)).not.toContain('07000 000000')
  })

  it('is pure and the result is frozen (point-in-time record cannot be rewritten)', () => {
    const inputAnswers = { ...answers }
    const snapshot = buildCaseSnapshot({ accountProfile: profile, careProfile: care, intakeAnswers: inputAnswers, submittedAt: '2026-09-16T09:00:00Z' })
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.intakeFrozen)).toBe(true)
    expect(Object.isFrozen(snapshot.profileFrozen)).toBe(true)
    expect(() => { (snapshot.intakeFrozen as Record<string, unknown>)['intake.concerns[0].own_words'] = 'rewritten' }).toThrow()
    expect(inputAnswers).toEqual(answers) // inputs untouched
  })
})

describe('provenance — original answer preservation', () => {
  it('a correction NEVER overwrites the client answer: it sits beside it with actor and time', () => {
    const fact = clientReported('Magnesium (client unsure which form)')
    const corrected = correctFact(fact, 'Magnesium citrate 200 mg', 'Practitioner A', '2026-09-16T10:00:00Z')
    expect(corrected.value).toBe('Magnesium (client unsure which form)') // verbatim original
    expect(corrected.provenance).toBe('corrected')
    expect(corrected.correction).toEqual({ value: 'Magnesium citrate 200 mg', actor: 'Practitioner A', at: '2026-09-16T10:00:00Z' })
    expect(fact.correction).toBeUndefined() // original object untouched
  })

  it('verification keeps the value and records who/when; missing is an explicit state', () => {
    const verified = verifyFact(clientReported('Walks the school run daily'), 'Practitioner A', '2026-09-16T10:05:00Z')
    expect(verified.value).toBe('Walks the school run daily')
    expect(verified.provenance).toBe('practitioner_verified')
    expect(verified.verifiedBy).toBe('Practitioner A')
    expect(missingFact().provenance).toBe('missing')
  })
})
