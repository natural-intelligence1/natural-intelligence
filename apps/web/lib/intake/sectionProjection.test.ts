// ─── sectionProjection.test.ts ───────────────────────────────────────────────
// Regression guard on the dual-write defect.
//
// The defect, concretely: Tree Khan answered "most_want_to_understand" with an
// empty string on 4 November. The answer row kept the blank; the column was
// written as `'' || null` and became NULL. A practitioner reading the column —
// which is what getIntakeSummary does — saw "never answered" for a question
// the client had looked at and chosen to leave empty.
//
// So the rule under test is three-way, not two-way:
//
//     value present            → the value
//     empty AND reached        → '' or []   ("asked, left blank")
//     empty AND never reached  → null       ("never asked")
//
// A test that only checks "empty becomes ''" would pass a change that claims
// a deliberate blank for every question the client never saw, which is the
// same defect pointing the other way. Both halves are asserted.

import { describe, it, expect } from 'vitest'
import { getSectionData } from './sectionProjection'
import type { FormState } from '@/app/dashboard/intake/types'

/** Only the fields these tests touch; the projection reads nothing else. */
function form(over: Partial<FormState> = {}): FormState {
  return {
    arrival_emotion: '',
    most_want_to_understand: '',
    primary_concerns: [],
    concern_duration: '',
    symptom_pattern: '',
    systems_reviewed: [],
    timeline_last_well: '',
    best_self_description: '',
    best_self_sleep: '',
    best_self_energy: '',
    best_self_mood: '',
    best_self_recovery_goal: '',
    timeline_trigger: '',
    sleep_hours: null,
    sleep_quality: null,
    stress_level: null,
    energy_level: null,
    exercise_frequency: '',
    diet_description: '',
    diagnosed_conditions: [],
    current_medications: '',
    current_supplements: '',
    past_treatments: '',
    family_history: [],
    psychosocial_impact: '',
    psychosocial_worry: '',
    psychosocial_supported: '',
    readiness_budget: '',
    ...over,
  } as unknown as FormState
}

describe('a reached-but-blank answer is no longer collapsed into "not asked"', () => {
  it('writes "" when the client reached the question and left it empty', () => {
    const data = getSectionData(form(), 2, 'general', new Set(['most_want_to_understand']))
    expect(data.most_want_to_understand).toBe('')
  })

  it('writes null when the client never reached the question', () => {
    const data = getSectionData(form(), 2, 'general', new Set())
    expect(data.most_want_to_understand).toBeNull()
  })

  it('writes the value when there is one, reached or not', () => {
    const answered = form({ most_want_to_understand: 'why am I so tired' })
    expect(getSectionData(answered, 2, 'general', new Set(['most_want_to_understand'])).most_want_to_understand)
      .toBe('why am I so tired')
    expect(getSectionData(answered, 2, 'general', new Set()).most_want_to_understand)
      .toBe('why am I so tired')
  })

  it('reproduces the exact Tree Khan case', () => {
    // Reached (an answer row exists), answered empty. Before this fix the
    // column got NULL; the answer store said "". They now agree.
    const data = getSectionData(
      form({ most_want_to_understand: '' }),
      2,
      'general',
      new Set(['arrival_emotion', 'most_want_to_understand']),
    )
    expect(data.most_want_to_understand).toBe('')
    expect(data.most_want_to_understand).not.toBeNull()
  })
})

describe('the same rule applies to multi-selects', () => {
  it('writes [] only when the client reached the question', () => {
    expect(getSectionData(form(), 2, 'general', new Set(['primary_concerns'])).primary_concerns).toEqual([])
    expect(getSectionData(form(), 2, 'general', new Set()).primary_concerns).toBeNull()
  })

  it('no longer claims "nothing selected" for every client', () => {
    // Before the fix `primary_concerns: f.primary_concerns` wrote [] always,
    // so an untouched step still recorded a deliberate empty selection.
    expect(getSectionData(form(), 2, 'general').primary_concerns).toBeNull()
  })

  it('writes the selection when there is one', () => {
    const data = getSectionData(form({ primary_concerns: ['Poor sleep'] }), 2, 'general', new Set())
    expect(data.primary_concerns).toEqual(['Poor sleep'])
  })
})

describe('every free-text field in every section follows the rule', () => {
  const cases: Array<[number, string]> = [
    [1, 'arrival_emotion'],
    [2, 'concern_duration'],
    [2, 'symptom_pattern'],
    [3, 'timeline_last_well'],
    [3, 'best_self_description'],
    [3, 'best_self_sleep'],
    [3, 'best_self_energy'],
    [3, 'best_self_mood'],
    [3, 'best_self_recovery_goal'],
    [4, 'timeline_trigger'],
    [6, 'exercise_frequency'],
    [6, 'diet_description'],
    [7, 'current_medications'],
    [7, 'current_supplements'],
    [7, 'past_treatments'],
    [8, 'psychosocial_impact'],
    [8, 'psychosocial_worry'],
    [10, 'readiness_budget'],
  ]

  for (const [step, field] of cases) {
    it(`${field} (step ${step}): blank when reached, null when not`, () => {
      expect(getSectionData(form(), step, 'general', new Set([field]))[field]).toBe('')
      expect(getSectionData(form(), step, 'general', new Set())[field]).toBeNull()
    })
  }

  const lists: Array<[number, string]> = [
    [2, 'primary_concerns'],
    [5, 'systems_reviewed'],
    [7, 'diagnosed_conditions'],
    [7, 'family_history'],
  ]

  for (const [step, field] of lists) {
    it(`${field} (step ${step}): empty list when reached, null when not`, () => {
      expect(getSectionData(form(), step, 'general', new Set([field]))[field]).toEqual([])
      expect(getSectionData(form(), step, 'general', new Set())[field]).toBeNull()
    })
  }
})

describe('nothing else about the projection changed', () => {
  it('still writes the derived primary_system on steps 2 and 5', () => {
    expect(getSectionData(form(), 2, 'digestive').primary_system).toBe('digestive')
    expect(getSectionData(form(), 5, 'energy').primary_system).toBe('energy')
  })

  it('still passes numeric scales straight through, including null', () => {
    const data = getSectionData(form({ sleep_hours: 7, stress_level: 3 }), 6, 'general')
    expect(data.sleep_hours).toBe(7)
    expect(data.stress_level).toBe(3)
    expect(data.energy_level).toBeNull()
  })

  it('still derives psychosocial_supported as a boolean', () => {
    expect(getSectionData(form({ psychosocial_supported: 'alone' }), 8, 'general').psychosocial_supported).toBe(false)
    expect(getSectionData(form({ psychosocial_supported: 'not_really' }), 8, 'general').psychosocial_supported).toBe(false)
    expect(getSectionData(form({ psychosocial_supported: 'mixed' }), 8, 'general').psychosocial_supported).toBe(true)
    expect(getSectionData(form({ psychosocial_supported: 'supported' }), 8, 'general').psychosocial_supported).toBe(true)
  })

  it('leaves psychosocial_supported null when unanswered — a boolean has no blank', () => {
    expect(getSectionData(form(), 8, 'general', new Set(['psychosocial_supported'])).psychosocial_supported)
      .toBeNull()
  })

  it('still returns {} for the empty goals step', () => {
    expect(getSectionData(form(), 9, 'general')).toEqual({})
    expect(getSectionData(form(), 99, 'general')).toEqual({})
  })

  it('writes the same column set as before for every step', () => {
    const keys = (s: number) => Object.keys(getSectionData(form(), s, 'general')).sort()
    expect(keys(1)).toEqual(['arrival_emotion'])
    expect(keys(2)).toEqual([
      'concern_duration', 'most_want_to_understand', 'primary_concerns',
      'primary_system', 'symptom_pattern',
    ])
    expect(keys(3)).toEqual([
      'best_self_description', 'best_self_energy', 'best_self_mood',
      'best_self_recovery_goal', 'best_self_sleep', 'timeline_last_well',
    ])
    expect(keys(4)).toEqual(['timeline_trigger'])
    expect(keys(5)).toEqual(['primary_system', 'systems_reviewed'])
    expect(keys(6)).toEqual([
      'diet_description', 'energy_level', 'exercise_frequency',
      'sleep_hours', 'sleep_quality', 'stress_level',
    ])
    expect(keys(7)).toEqual([
      'current_medications', 'current_supplements', 'diagnosed_conditions',
      'family_history', 'past_treatments',
    ])
    expect(keys(8)).toEqual(['psychosocial_impact', 'psychosocial_supported', 'psychosocial_worry'])
    expect(keys(10)).toEqual(['readiness_budget'])
  })

  it('defaults to the old behaviour when no reached set is supplied', () => {
    // A caller that forgets the set must degrade to "never asked", never to
    // a fabricated blank.
    const data = getSectionData(form(), 2, 'general')
    expect(data.most_want_to_understand).toBeNull()
    expect(data.concern_duration).toBeNull()
  })
})
