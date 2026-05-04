// ─── branchingRules.parity.test.ts ───────────────────────────────────────────
// Parity table: verifies that evaluateRules + BRANCHING_RULES produces the
// expected section2 sub-branch for each concern scenario.
//
// These are the reference cases from the C5.1 parity audit.
// Cases marked [IMPROVEMENT] were regressions in detectPrimarySystem relative
// to evaluateRules — evaluateRules is more comprehensive (broader needles).

import { describe, it, expect } from 'vitest'
import { evaluateRules }        from './evaluateRules'
import { BRANCHING_RULES }      from './branchingRules'

// ─── Helper ───────────────────────────────────────────────────────────────────

function branch(concerns: string[]): string {
  const result = evaluateRules(
    { primary_concerns: concerns },
    BRANCHING_RULES,
  )
  const active = result.activeSubBranches['section2'] ?? []
  return active.length === 0 ? 'general' : active[0]
}

// ─── Parity table ─────────────────────────────────────────────────────────────

describe('BRANCHING_RULES — section2 branch parity', () => {

  // ── Digestive (priority 40) ─────────────────────────────────────────────────

  it('case 1: digestive — "Digestive issues or bloating"', () => {
    expect(branch(['Digestive issues or bloating'])).toBe('digestive')
  })

  it('case 2: digestive — "gut health problems"', () => {
    expect(branch(['gut health problems'])).toBe('digestive')
  })

  it('case 9: digestive — "stomach pain" [IMPROVEMENT: sb_digestive has "stomach"]', () => {
    expect(branch(['stomach pain'])).toBe('digestive')
  })

  it('case 10: digestive — "nausea"', () => {
    expect(branch(['nausea'])).toBe('digestive')
  })

  it('case 11: digestive — "reflux"', () => {
    expect(branch(['reflux'])).toBe('digestive')
  })

  // ── Hormonal (priority 30) ──────────────────────────────────────────────────

  it('case 3: hormonal — "hormonal imbalance"', () => {
    expect(branch(['hormonal imbalance'])).toBe('hormonal')
  })

  it('E1: hormonal — "Hormonal symptoms" (exact UI chip)', () => {
    expect(branch(['Hormonal symptoms'])).toBe('hormonal')
  })

  it('hormonal — "PCOS"', () => {
    expect(branch(['PCOS'])).toBe('hormonal')
  })

  it('hormonal — "menopause symptoms"', () => {
    expect(branch(['menopause symptoms'])).toBe('hormonal')
  })

  it('hormonal — "thyroid issues"', () => {
    expect(branch(['thyroid issues'])).toBe('hormonal')
  })

  it('hormonal — "irregular period"', () => {
    expect(branch(['irregular period'])).toBe('hormonal')
  })

  // ── Energy (priority 20) ────────────────────────────────────────────────────

  it('case 4: energy — "Always tired or exhausted"', () => {
    expect(branch(['Always tired or exhausted'])).toBe('energy')
  })

  it('case 5: energy — "low energy all the time"', () => {
    expect(branch(['low energy all the time'])).toBe('energy')
  })

  it('energy — "fatigue"', () => {
    expect(branch(['fatigue'])).toBe('energy')
  })

  it('energy — "wired but tired"', () => {
    expect(branch(['wired but tired'])).toBe('energy')
  })

  // ── Cognitive (priority 10) ─────────────────────────────────────────────────

  it('case 6: cognitive — "Brain fog or poor focus"', () => {
    expect(branch(['Brain fog or poor focus'])).toBe('cognitive')
  })

  it('case 7: cognitive — "memory problems"', () => {
    expect(branch(['memory problems'])).toBe('cognitive')
  })

  it('cognitive — "sluggish thinking"', () => {
    expect(branch(['sluggish thinking'])).toBe('cognitive')
  })

  // ── General fallback ────────────────────────────────────────────────────────

  it('case 8: general — no matching concerns → general', () => {
    expect(branch(['Anxiety or low mood', 'Skin problems'])).toBe('general')
  })

  it('general — empty array → general', () => {
    expect(branch([])).toBe('general')
  })

  // ── Priority resolution: higher-priority wins ────────────────────────────────

  it('priority: digestive beats energy (p40 > p20)', () => {
    expect(branch(['Digestive issues or bloating', 'Always tired or exhausted'])).toBe('digestive')
  })

  it('priority: digestive beats hormonal (p40 > p30)', () => {
    expect(branch(['bloating', 'hormonal imbalance'])).toBe('digestive')
  })

  it('priority: hormonal beats energy (p30 > p20)', () => {
    expect(branch(['hormonal imbalance', 'fatigue'])).toBe('hormonal')
  })

  it('priority: hormonal beats cognitive (p30 > p10)', () => {
    expect(branch(['hormonal imbalance', 'brain fog'])).toBe('hormonal')
  })

  it('priority: energy beats cognitive (p20 > p10)', () => {
    expect(branch(['Always tired or exhausted', 'Brain fog or poor focus'])).toBe('energy')
  })

})

// ─── Sprint 16.3 Tier 1 flag rules ───────────────────────────────────────────
// R8: all Tier 1 rules activate type='flag' only.
// Tests: firing condition + boundary non-firing for each rule.

describe('BRANCHING_RULES — Sprint 16.3 Tier 1 flags', () => {

  function flags(answers: Record<string, unknown>): string[] {
    return evaluateRules(answers, BRANCHING_RULES).flags
  }

  // ── flag_severity_high (concern_severity_baseline >= 8) ────────────────────

  it('flag_severity_high fires at baseline = 8 (boundary)', () => {
    expect(flags({ concern_severity_baseline: 8 })).toContain('flag_severity_high')
  })

  it('flag_severity_high fires at baseline = 10', () => {
    expect(flags({ concern_severity_baseline: 10 })).toContain('flag_severity_high')
  })

  it('flag_severity_high does NOT fire at baseline = 7 (below boundary)', () => {
    expect(flags({ concern_severity_baseline: 7 })).not.toContain('flag_severity_high')
  })

  it('flag_severity_high does NOT fire when concern_severity_baseline is null', () => {
    expect(flags({ concern_severity_baseline: null })).not.toContain('flag_severity_high')
  })

  // ── flag_post_exertional_pattern (post_exertional_worsening === true) ──────

  it('flag_post_exertional_pattern fires when post_exertional_worsening = true', () => {
    expect(flags({ post_exertional_worsening: true })).toContain('flag_post_exertional_pattern')
  })

  it('flag_post_exertional_pattern does NOT fire when post_exertional_worsening = false', () => {
    expect(flags({ post_exertional_worsening: false })).not.toContain('flag_post_exertional_pattern')
  })

  it('flag_post_exertional_pattern does NOT fire when post_exertional_worsening is null', () => {
    expect(flags({ post_exertional_worsening: null })).not.toContain('flag_post_exertional_pattern')
  })

  // ── Additive behaviour: both flags can fire simultaneously ─────────────────

  it('both flags fire together when both conditions are met', () => {
    const result = flags({ concern_severity_baseline: 9, post_exertional_worsening: true })
    expect(result).toContain('flag_severity_high')
    expect(result).toContain('flag_post_exertional_pattern')
  })

  // ── Flags do not suppress section2 sub-branch competition ──────────────────

  it('flag_severity_high fires alongside digestive sub-branch (exclusive = false)', () => {
    const result = evaluateRules(
      { primary_concerns: ['bloating'], concern_severity_baseline: 9 },
      BRANCHING_RULES,
    )
    expect(result.flags).toContain('flag_severity_high')
    expect((result.activeSubBranches['section2'] ?? [])[0]).toBe('digestive')
  })

})

// ─── Sprint 16.3 Tier 1 Commit 2 — flag_menstrual_flow_high ──────────────────

describe('BRANCHING_RULES — flag_menstrual_flow_high (Commit 2)', () => {

  function flags(answers: Record<string, unknown>): string[] {
    return evaluateRules(answers, BRANCHING_RULES).flags
  }

  // ── Firing condition: menstrual_flow_heaviness >= 5 ────────────────────────

  it('flag_menstrual_flow_high fires at flow_heaviness = 5 (boundary / Flooding)', () => {
    expect(flags({ menstrual_flow_heaviness: 5 })).toContain('flag_menstrual_flow_high')
  })

  // ── Boundary non-firing: below threshold ───────────────────────────────────

  it('flag_menstrual_flow_high does NOT fire at flow_heaviness = 4 (Very heavy)', () => {
    expect(flags({ menstrual_flow_heaviness: 4 })).not.toContain('flag_menstrual_flow_high')
  })

  it('flag_menstrual_flow_high does NOT fire when menstrual_flow_heaviness is null', () => {
    expect(flags({ menstrual_flow_heaviness: null })).not.toContain('flag_menstrual_flow_high')
  })

  // ── Additive: fires alongside other Tier 1 flags ────────────────────────────

  it('all three Tier 1 flags fire simultaneously when all conditions are met', () => {
    const result = flags({
      concern_severity_baseline: 9,
      post_exertional_worsening: true,
      menstrual_flow_heaviness:  5,
    })
    expect(result).toContain('flag_severity_high')
    expect(result).toContain('flag_post_exertional_pattern')
    expect(result).toContain('flag_menstrual_flow_high')
  })

})

// ─── Sprint 16.3 Tier 1 Commit 2 — showCycleQuestions gate logic ─────────────
// Gate: menstrual_status is set AND not in { prefer_not_to_say, post_menopause,
//        surgical_menopause, never_menstruated }

describe('showCycleQuestions gate — menstrual_status values', () => {

  const GATE_EXCLUDED = new Set([
    'prefer_not_to_say', 'post_menopause', 'surgical_menopause', 'never_menstruated',
  ])
  const CYCLE_STATUSES = ['regular_cycles', 'irregular', 'on_hrt', 'on_ocp']

  function showCycle(status: string): boolean {
    return status !== '' && !GATE_EXCLUDED.has(status)
  }

  it.each(CYCLE_STATUSES)('shows cycle questions for menstrual_status = %s', status => {
    expect(showCycle(status)).toBe(true)
  })

  it.each([...GATE_EXCLUDED])('hides cycle questions for menstrual_status = %s', status => {
    expect(showCycle(status)).toBe(false)
  })

  it('hides cycle questions when menstrual_status is empty (unanswered)', () => {
    expect(showCycle('')).toBe(false)
  })

})
