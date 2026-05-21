// PS.4 — buildPersonalisationBlock tests.
//
// 5-case matrix (PS.4 spec Part 3) plus extras to verify:
//   • Islamic framing instruction appears iff (religion='muslim' AND
//     preference='show')
//   • Secular framing instruction otherwise
//   • Biological sex line varies (female / male / not recorded)
//   • biological-only block (BioHub Option iii) never contains religious copy

import { describe, it, expect } from 'vitest'
import type { PersonalisationForGeneration } from '../personalisation/getPersonalisationForGeneration'
import {
  buildPersonalisationBlock,
  buildBiologicalContextBlock,
  isIslamicFramingEnabled,
} from './buildPersonalisationBlock'

const RELIGION_TERMS = [
  'islamic', 'muslim', 'religion', 'religious', 'ihsan', 'amanah',
] as const

function ctx(over: Partial<PersonalisationForGeneration>): PersonalisationForGeneration {
  return {
    biologicalSex:              null,
    religion:                   'prefer_not_to_say',
    religiousContentPreference: 'hide',
    ...over,
  }
}

describe('isIslamicFramingEnabled', () => {
  const cases: Array<[string, PersonalisationForGeneration, boolean]> = [
    ['muslim + show     → true',  ctx({ religion: 'muslim',            religiousContentPreference: 'show' }), true ],
    ['muslim + hide     → false', ctx({ religion: 'muslim',            religiousContentPreference: 'hide' }), false],
    ['christian + show  → false', ctx({ religion: 'christian',         religiousContentPreference: 'show' }), false],
    ['prefer_not + show → false', ctx({ religion: 'prefer_not_to_say', religiousContentPreference: 'show' }), false],
    ['null sex + muslim+show → true (sex irrelevant to gate)',
                                  ctx({ biologicalSex: null, religion: 'muslim', religiousContentPreference: 'show' }), true ],
  ]
  for (const [label, p, expected] of cases) {
    it(label, () => expect(isIslamicFramingEnabled(p)).toBe(expected))
  }
})

describe('buildPersonalisationBlock — 5-case matrix (PS.4 Part 3)', () => {

  it('female + secular: female sex, secular framing, no religious copy', () => {
    const out = buildPersonalisationBlock(ctx({
      biologicalSex: 'female', religion: 'prefer_not_to_say', religiousContentPreference: 'hide',
    }))
    expect(out).toContain('Biological sex: female')
    expect(out).toContain('female-pattern clinical interpretation')
    expect(out).toContain('Framing preference: secular')
    expect(out).toContain('secular language')
    for (const t of RELIGION_TERMS) {
      expect(out.toLowerCase()).not.toContain(t)
    }
  })

  it('female + islamic: female sex, Islamic framing instruction, ihsan/amanah present', () => {
    const out = buildPersonalisationBlock(ctx({
      biologicalSex: 'female', religion: 'muslim', religiousContentPreference: 'show',
    }))
    expect(out).toContain('Biological sex: female')
    expect(out).toContain('Framing preference: Islamic')
    expect(out).toContain('ihsan')
    expect(out).toContain('amanah')
    expect(out).toContain('Clinical recommendations remain governed by evidence')
    expect(out).not.toContain('secular')
  })

  it('male + secular: male sex, secular framing', () => {
    const out = buildPersonalisationBlock(ctx({
      biologicalSex: 'male', religion: 'prefer_not_to_say', religiousContentPreference: 'hide',
    }))
    expect(out).toContain('Biological sex: male')
    expect(out).toContain('male-pattern clinical interpretation')
    expect(out).toContain('Framing preference: secular')
    expect(out).not.toContain('Islamic')
    expect(out).not.toContain('ihsan')
  })

  it('null sex + secular: not recorded, no sex-specific claims, secular framing', () => {
    const out = buildPersonalisationBlock(ctx({
      biologicalSex: null, religion: 'prefer_not_to_say', religiousContentPreference: 'hide',
    }))
    expect(out).toContain('Biological sex: not recorded')
    expect(out).toContain('avoid sex-specific clinical claims')
    expect(out).toContain('Framing preference: secular')
  })

  it('null sex + islamic (rare): not recorded sex, Islamic framing — safely composes', () => {
    const out = buildPersonalisationBlock(ctx({
      biologicalSex: null, religion: 'muslim', religiousContentPreference: 'show',
    }))
    expect(out).toContain('Biological sex: not recorded')
    expect(out).toContain('avoid sex-specific clinical claims')
    expect(out).toContain('Framing preference: Islamic')
    // Clinical safety preserved even with religious framing on
    expect(out).not.toContain('female-pattern')
    expect(out).not.toContain('male-pattern')
  })
})

describe('buildBiologicalContextBlock (BioHub Option iii — clinical-only)', () => {
  it('contains biological sex, NEVER contains religious framing copy', () => {
    const variants: PersonalisationForGeneration[] = [
      ctx({ biologicalSex: 'female', religion: 'muslim',      religiousContentPreference: 'show' }),
      ctx({ biologicalSex: 'male',   religion: 'christian',   religiousContentPreference: 'show' }),
      ctx({ biologicalSex: null,     religion: 'muslim',      religiousContentPreference: 'show' }),
    ]
    for (const p of variants) {
      const out = buildBiologicalContextBlock(p).toLowerCase()
      expect(out).toContain('biological sex')
      // Hard architectural assertion — biohub prompt must never carry these:
      expect(out).not.toContain('islamic')
      expect(out).not.toContain('muslim')
      expect(out).not.toContain('religious')
      expect(out).not.toContain('religion')
      expect(out).not.toContain('framing')
      expect(out).not.toContain('ihsan')
      expect(out).not.toContain('amanah')
    }
  })

  it('renders female reference ranges instruction when biologicalSex=female', () => {
    const out = buildBiologicalContextBlock(ctx({ biologicalSex: 'female' }))
    expect(out).toContain('female-specific reference ranges')
  })

  it('renders male reference ranges instruction when biologicalSex=male', () => {
    const out = buildBiologicalContextBlock(ctx({ biologicalSex: 'male' }))
    expect(out).toContain('male-specific reference ranges')
  })

  it('renders cautious instruction when biologicalSex is null', () => {
    const out = buildBiologicalContextBlock(ctx({ biologicalSex: null }))
    expect(out).toContain('not recorded')
    expect(out).toContain('avoid sex-specific reference ranges')
  })
})
