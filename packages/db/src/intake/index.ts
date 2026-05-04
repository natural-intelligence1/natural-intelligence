// ─── packages/db/src/intake/index.ts ──────────────────────────────────────────
// Barrel export for the UI branching engine.
// Import from '@natural-intelligence/db/intake' or from this barrel.

export type {
  AnswerMap,
  ActivationType,
  RuleOperator,
  RuleCondition,
  RuleActivation,
  Rule,
  RuleEvaluation,
  RuleTraceEntry,
} from './types'

export { normalizeAnswers } from './normalizeAnswers'
export { evaluateRules }   from './evaluateRules'
export { BRANCHING_RULES } from './branchingRules'
