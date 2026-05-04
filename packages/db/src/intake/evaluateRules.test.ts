import { describe, it, expect } from 'vitest'
import { evaluateRules } from './evaluateRules'
import type { Rule } from './types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeRule = (overrides: Partial<Rule> & Pick<Rule, 'id' | 'when' | 'activates'>): Rule => ({
  priority:  0,
  exclusive: false,
  ...overrides,
})

// ─── Operator: eq ─────────────────────────────────────────────────────────────

describe('operator: eq', () => {
  const rule = makeRule({
    id:        'r1',
    when:      { questionId: 'mood', op: 'eq', value: 'good' },
    activates: { type: 'flag', target: 'mood_good' },
  })

  it('fires when string matches after normalisation', () => {
    const result = evaluateRules({ mood: '  GOOD  ' }, [rule])
    expect(result.flags).toContain('mood_good')
  })

  it('does not fire when value differs', () => {
    const result = evaluateRules({ mood: 'bad' }, [rule])
    expect(result.flags).not.toContain('mood_good')
  })

  it('fires for exact boolean match', () => {
    const r = makeRule({
      id:        'r_bool',
      when:      { questionId: 'active', op: 'eq', value: true },
      activates: { type: 'flag', target: 'is_active' },
    })
    expect(evaluateRules({ active: true }, [r]).flags).toContain('is_active')
    expect(evaluateRules({ active: false }, [r]).flags).not.toContain('is_active')
  })

  it('fires for exact numeric match after coercion', () => {
    const r = makeRule({
      id:        'r_num',
      when:      { questionId: 'score', op: 'eq', value: 8 },
      activates: { type: 'flag', target: 'score_8' },
    })
    expect(evaluateRules({ score: '8' }, [r]).flags).toContain('score_8')
  })
})

// ─── Operator: in ─────────────────────────────────────────────────────────────

describe('operator: in', () => {
  const rule = makeRule({
    id:        'r_in',
    when:      { questionId: 'level', op: 'in', value: ['low', 'medium'] },
    activates: { type: 'flag', target: 'level_low_or_medium' },
  })

  it('fires when value is in the set', () => {
    expect(evaluateRules({ level: 'LOW' }, [rule]).flags).toContain('level_low_or_medium')
    expect(evaluateRules({ level: 'medium' }, [rule]).flags).toContain('level_low_or_medium')
  })

  it('does not fire when value is outside the set', () => {
    expect(evaluateRules({ level: 'high' }, [rule]).flags).not.toContain('level_low_or_medium')
  })
})

// ─── Operator: gte / lte ──────────────────────────────────────────────────────

describe('operator: gte', () => {
  const rule = makeRule({
    id:        'r_gte',
    when:      { questionId: 'score', op: 'gte', value: 8 },
    activates: { type: 'flag', target: 'high_score' },
  })

  it('fires at boundary', () => {
    expect(evaluateRules({ score: 8 }, [rule]).flags).toContain('high_score')
  })

  it('fires above boundary', () => {
    expect(evaluateRules({ score: 10 }, [rule]).flags).toContain('high_score')
  })

  it('does not fire below boundary', () => {
    expect(evaluateRules({ score: 7 }, [rule]).flags).not.toContain('high_score')
  })

  it('coerces string before comparing', () => {
    expect(evaluateRules({ score: '9' }, [rule]).flags).toContain('high_score')
  })
})

describe('operator: lte', () => {
  const rule = makeRule({
    id:        'r_lte',
    when:      { questionId: 'score', op: 'lte', value: 3 },
    activates: { type: 'flag', target: 'low_score' },
  })

  it('fires at boundary', () => {
    expect(evaluateRules({ score: 3 }, [rule]).flags).toContain('low_score')
  })

  it('fires below boundary', () => {
    expect(evaluateRules({ score: 1 }, [rule]).flags).toContain('low_score')
  })

  it('does not fire above boundary', () => {
    expect(evaluateRules({ score: 4 }, [rule]).flags).not.toContain('low_score')
  })
})

// ─── Operator: contains ───────────────────────────────────────────────────────

describe('operator: contains — string answer', () => {
  const rule = makeRule({
    id:        'r_cont',
    when:      { questionId: 'notes', op: 'contains', value: 'bloat' },
    activates: { type: 'flag', target: 'bloat_flag' },
  })

  it('fires on substring match', () => {
    expect(evaluateRules({ notes: 'I have bloating issues' }, [rule]).flags).toContain('bloat_flag')
  })

  it('is case-insensitive', () => {
    expect(evaluateRules({ notes: 'SEVERE BLOATING' }, [rule]).flags).toContain('bloat_flag')
  })

  it('does not fire on non-matching string', () => {
    expect(evaluateRules({ notes: 'head pain' }, [rule]).flags).not.toContain('bloat_flag')
  })
})

describe('operator: contains — array answer', () => {
  const rule = makeRule({
    id:        'r_arr_cont',
    when:      { questionId: 'concerns', op: 'contains', value: ['bloat', 'digest'] },
    activates: { type: 'flag', target: 'digestive_flag' },
  })

  it('fires when any array element contains any needle', () => {
    expect(evaluateRules({ concerns: ['terrible bloating', 'poor sleep'] }, [rule]).flags)
      .toContain('digestive_flag')
  })

  it('normalises array elements before matching', () => {
    expect(evaluateRules({ concerns: ['  DIGESTIVE ISSUES  ', 'fatigue'] }, [rule]).flags)
      .toContain('digestive_flag')
  })

  it('does not fire when no element matches', () => {
    expect(evaluateRules({ concerns: ['poor sleep', 'low energy'] }, [rule]).flags)
      .not.toContain('digestive_flag')
  })
})

// ─── Exclusive conflict resolution ────────────────────────────────────────────

describe('exclusive conflict resolution', () => {
  const ruleHigh = makeRule({
    id:        'r_high',
    when:      { questionId: 'concern', op: 'eq', value: 'x' },
    activates: { type: 'subBranch', target: 'section2/digestive' },
    priority:  40,
    exclusive: true,
  })
  const ruleLow = makeRule({
    id:        'r_low',
    when:      { questionId: 'concern', op: 'eq', value: 'x' },
    activates: { type: 'subBranch', target: 'section2/energy' },
    priority:  20,
    exclusive: true,
  })

  it('only the highest-priority exclusive rule activates', () => {
    const result = evaluateRules({ concern: 'x' }, [ruleHigh, ruleLow])
    expect(result.activeSubBranches['section2']).toEqual(['digestive'])
    expect(result.activeSubBranches['section2']).not.toContain('energy')
  })

  it('loser is recorded as suppressedBy in trace', () => {
    const result = evaluateRules({ concern: 'x' }, [ruleHigh, ruleLow])
    const loserEntry = result.trace.find(t => t.ruleId === 'r_low')
    expect(loserEntry?.suppressedBy).toBe('r_high')
  })

  it('winner has no suppressedBy', () => {
    const result = evaluateRules({ concern: 'x' }, [ruleHigh, ruleLow])
    const winnerEntry = result.trace.find(t => t.ruleId === 'r_high')
    expect(winnerEntry?.suppressedBy).toBeUndefined()
  })

  it('non-exclusive rules fire alongside exclusive winners', () => {
    const flagRule = makeRule({
      id:        'r_flag',
      when:      { questionId: 'concern', op: 'eq', value: 'x' },
      activates: { type: 'flag', target: 'some_flag' },
      exclusive: false,
    })
    const result = evaluateRules({ concern: 'x' }, [ruleHigh, ruleLow, flagRule])
    expect(result.flags).toContain('some_flag')
    expect(result.activeSubBranches['section2']).toEqual(['digestive'])
  })
})

// ─── subBranch target parsing ─────────────────────────────────────────────────

describe('subBranch target parsing', () => {
  it('populates activeSubBranches with correct parent/branch split', () => {
    const rule = makeRule({
      id:        'r_sb',
      when:      { questionId: 'q', op: 'eq', value: 'yes' },
      activates: { type: 'subBranch', target: 'section3/hormonal' },
    })
    const result = evaluateRules({ q: 'yes' }, [rule])
    expect(result.activeSubBranches['section3']).toContain('hormonal')
  })
})

// ─── activeSections ──────────────────────────────────────────────────────────

describe('activeSections', () => {
  it('populates activeSections when type is section', () => {
    const rule = makeRule({
      id:        'r_sec',
      when:      { questionId: 'q', op: 'eq', value: 'yes' },
      activates: { type: 'section', target: 'systems_urinary' },
    })
    const result = evaluateRules({ q: 'yes' }, [rule])
    expect(result.activeSections).toContain('systems_urinary')
  })
})

// ─── Empty / missing answers ──────────────────────────────────────────────────

describe('empty and missing answers', () => {
  it('returns empty result for empty answers with any rules', () => {
    const rule = makeRule({
      id:        'r_x',
      when:      { questionId: 'q', op: 'eq', value: 'yes' },
      activates: { type: 'flag', target: 'f' },
    })
    const result = evaluateRules({}, [rule])
    expect(result.activeSections).toEqual([])
    expect(result.activeSubBranches).toEqual({})
    expect(result.flags).toEqual([])
    expect(result.trace).toEqual([])
  })

  it('returns empty result for empty rules', () => {
    const result = evaluateRules({ q: 'yes' }, [])
    expect(result.activeSections).toEqual([])
    expect(result.activeSubBranches).toEqual({})
    expect(result.flags).toEqual([])
    expect(result.trace).toEqual([])
  })
})

// ─── Trace audit ──────────────────────────────────────────────────────────────

describe('trace', () => {
  it('only includes fired rules in trace (not non-matching)', () => {
    const r1 = makeRule({
      id:        'match',
      when:      { questionId: 'q', op: 'eq', value: 'yes' },
      activates: { type: 'flag', target: 'f1' },
    })
    const r2 = makeRule({
      id:        'no_match',
      when:      { questionId: 'q', op: 'eq', value: 'no' },
      activates: { type: 'flag', target: 'f2' },
    })
    const result = evaluateRules({ q: 'yes' }, [r1, r2])
    expect(result.trace.map(t => t.ruleId)).toEqual(['match'])
  })

  it('records matchedAgainst in trace', () => {
    const rule = makeRule({
      id:        'r',
      when:      { questionId: 'score', op: 'gte', value: 5 },
      activates: { type: 'flag', target: 'f' },
    })
    const result = evaluateRules({ score: '7' }, [rule])
    expect(result.trace[0].matchedAgainst).toBe(7)
  })

  it('records reason from activates.reason', () => {
    const rule = makeRule({
      id:        'r',
      when:      { questionId: 'q', op: 'eq', value: 'yes' },
      activates: { type: 'flag', target: 'f', reason: 'Test reason' },
    })
    const result = evaluateRules({ q: 'yes' }, [rule])
    expect(result.trace[0].reason).toBe('Test reason')
  })
})
