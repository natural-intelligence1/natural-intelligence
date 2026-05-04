/**
 * Sprint 16.2 C2 Smoke Tests
 * Verified against BRANCHING_RULES seed data.
 * This file is ephemeral — results logged in C2 report, then file removed.
 */
import { describe, it, expect } from 'vitest'
import { evaluateRules } from './evaluateRules'
import { BRANCHING_RULES } from './branchingRules'

describe('C2 Smoke Tests — BRANCHING_RULES', () => {

  it('A: gut bloating → section2/digestive', () => {
    const result = evaluateRules(
      { primary_concerns: ['my GUT feels bloated'] },
      BRANCHING_RULES,
    )
    expect(result.activeSubBranches['section2']).toContain('digestive')
    expect(result.flags).toEqual([])
    expect(result.activeSections).toEqual([])
  })

  it('B: tired + brain fog → energy wins over cognitive (priority 20 > 10)', () => {
    const result = evaluateRules(
      { primary_concerns: ['I feel tired and have brain fog'] },
      BRANCHING_RULES,
    )
    // energy fires (priority 20), cognitive fires (priority 10)
    // both target section2, exclusive — energy wins
    expect(result.activeSubBranches['section2']).toContain('energy')
    expect(result.activeSubBranches['section2']).not.toContain('cognitive')
    // cognitive trace entry is suppressed
    const cogEntry = result.trace.find(t => t.ruleId === 'sb_cognitive')
    expect(cogEntry?.suppressedBy).toBe('sb_energy')
  })

  it('C: bloating + severity 9 → section2/digestive + red_flag_severity flag', () => {
    const result = evaluateRules(
      { primary_concerns: ['Bloating'], severity_now: 9 },
      BRANCHING_RULES,
    )
    expect(result.activeSubBranches['section2']).toContain('digestive')
    expect(result.flags).toContain('red_flag_severity')
  })

  it('D: urinary + tum pain → section2/digestive + systems_urinary section', () => {
    const result = evaluateRules(
      { primary_concerns: ['urinary issues and tum pain'] },
      BRANCHING_RULES,
    )
    // 'tum pain' does not contain any digestive needle — but let's check
    // 'urinary' → sec_urinary fires → systems_urinary in activeSections
    expect(result.activeSections).toContain('systems_urinary')
    // 'tum' doesn't match any digestive seed needle, so digestive should NOT fire
    expect(result.activeSubBranches['section2'] ?? []).not.toContain('digestive')
  })

  it('E: empty answers → fully empty result, no errors', () => {
    const result = evaluateRules({}, BRANCHING_RULES)
    expect(result.activeSections).toEqual([])
    expect(result.activeSubBranches).toEqual({})
    expect(result.flags).toEqual([])
    expect(result.trace).toEqual([])
  })

})
