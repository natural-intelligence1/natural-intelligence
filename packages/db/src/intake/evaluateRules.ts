// ─── packages/db/src/intake/evaluateRules.ts ──────────────────────────────────
// Pure, framework-agnostic UI branching evaluator.
// Accepts a raw AnswerMap + a set of Rules, returns a RuleEvaluation.
// No DB, no async, no React, no globals — same input always yields same output.

import type {
  AnswerMap,
  Rule,
  RuleEvaluation,
  RuleTraceEntry,
} from './types'
import { normalizeAnswers } from './normalizeAnswers'

// ─── Public API ───────────────────────────────────────────────────────────────

export function evaluateRules(answers: AnswerMap, rules: Rule[]): RuleEvaluation {
  const normalized = normalizeAnswers(answers)

  // ── Step 1: evaluate each rule, build raw fired list + full trace ──────────
  const fired: Rule[]            = []
  const trace: RuleTraceEntry[]  = []

  for (const rule of rules) {
    const answerValue = normalized[rule.when.questionId]
    const matched     = applyOperator(rule.when.op, answerValue, rule.when.value)

    if (matched) {
      fired.push(rule)
      trace.push({
        ruleId:         rule.id,
        fired:          true,
        reason:         rule.activates.reason,
        matchedAgainst: answerValue,
      })
    }
    // Non-fired rules are omitted from trace per spec
  }

  // ── Step 2: conflict resolution for exclusive rules ────────────────────────
  // Group exclusive fired rules by (activationType, targetParent).
  // targetParent: first path segment before '/', e.g. 'section2/digestive' → 'section2'
  // For non-sub-branch targets (no '/'), the full target IS the group key.
  // Highest priority wins; losers get suppressedBy set in trace.

  const survivors = resolveExclusive(fired, trace)

  // ── Step 3: build RuleEvaluation from survivors ────────────────────────────
  const activeSections:    string[]                    = []
  const activeSubBranches: Record<string, string[]>   = {}
  const flags:             string[]                   = []

  for (const rule of survivors) {
    const { type, target } = rule.activates

    if (type === 'section') {
      if (!activeSections.includes(target)) {
        activeSections.push(target)
      }
    } else if (type === 'subBranch') {
      // target format: 'section2/digestive'
      const slashIdx = target.indexOf('/')
      if (slashIdx !== -1) {
        const parent = target.slice(0, slashIdx)
        const branch = target.slice(slashIdx + 1)
        if (!activeSubBranches[parent]) activeSubBranches[parent] = []
        if (!activeSubBranches[parent].includes(branch)) {
          activeSubBranches[parent].push(branch)
        }
      } else {
        // Malformed subBranch target — still surface it under its own key
        if (!activeSubBranches[target]) activeSubBranches[target] = []
      }
    } else if (type === 'flag') {
      if (!flags.includes(target)) {
        flags.push(target)
      }
    }
  }

  return { activeSections, activeSubBranches, flags, trace }
}

// ─── Operator evaluation ──────────────────────────────────────────────────────

function applyOperator(op: Rule['when']['op'], answer: unknown, conditionValue: unknown): boolean {
  switch (op) {
    case 'eq':
      return answer === conditionValue

    case 'in': {
      if (!Array.isArray(conditionValue)) return false
      return conditionValue.includes(answer)
    }

    case 'gte':
      return typeof answer === 'number' && typeof conditionValue === 'number'
        ? answer >= conditionValue
        : false

    case 'lte':
      return typeof answer === 'number' && typeof conditionValue === 'number'
        ? answer <= conditionValue
        : false

    case 'contains': {
      // Normalize condition values to an array for uniform handling
      const needles: string[] = Array.isArray(conditionValue)
        ? conditionValue.map(v => String(v).toLowerCase())
        : [String(conditionValue).toLowerCase()]

      if (typeof answer === 'string') {
        // String haystack: answer contains ANY needle as substring
        return needles.some(needle => answer.includes(needle))
      }

      if (Array.isArray(answer)) {
        // Array haystack: ANY element contains ANY needle as substring
        return answer.some(
          elem => typeof elem === 'string' &&
                  needles.some(needle => elem.includes(needle))
        )
      }

      return false
    }

    default:
      return false
  }
}

// ─── Exclusive conflict resolution ────────────────────────────────────────────

/**
 * For each exclusive group (activationType + targetParent), keep only the
 * highest-priority rule. All others receive a `suppressedBy` entry in the trace.
 * Non-exclusive rules always survive.
 */
function resolveExclusive(fired: Rule[], trace: RuleTraceEntry[]): Rule[] {
  // Separate exclusive from non-exclusive
  const exclusive    = fired.filter(r => r.exclusive)
  const nonExclusive = fired.filter(r => !r.exclusive)

  // Build groups: key = `${activationType}::${targetParent}`
  const groups = new Map<string, Rule[]>()

  for (const rule of exclusive) {
    const key = exclusiveGroupKey(rule)
    const group = groups.get(key)
    if (!group) {
      groups.set(key, [rule])
    } else {
      group.push(rule)
    }
  }

  const survivors: Rule[] = [...nonExclusive]

  for (const [, group] of groups) {
    // Sort descending by priority; first element wins
    group.sort((a, b) => b.priority - a.priority)
    const winner = group[0]
    survivors.push(winner)

    // Mark losers as suppressed in trace
    for (let i = 1; i < group.length; i++) {
      const loser      = group[i]
      const traceEntry = trace.find(t => t.ruleId === loser.id)
      if (traceEntry) {
        traceEntry.suppressedBy = winner.id
      }
    }
  }

  return survivors
}

function exclusiveGroupKey(rule: Rule): string {
  const { type, target } = rule.activates
  const slashIdx         = target.indexOf('/')
  const targetParent     = slashIdx !== -1 ? target.slice(0, slashIdx) : target
  return `${type}::${targetParent}`
}
