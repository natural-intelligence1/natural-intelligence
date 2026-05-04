// ─── packages/db/src/intake/index.ts ──────────────────────────────────────────
// Barrel export for the intake engine (UI branching + storage layer).

// ── Types ─────────────────────────────────────────────────────────────────────
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

export type { SaveIntakeAnswerInput, IntakeAnswerRow }  from './saveIntakeAnswer'
export type { IntakeSessionRow }                        from './getOrCreateIntakeSession'

// ── Engine ────────────────────────────────────────────────────────────────────
export { normalizeAnswers } from './normalizeAnswers'
export { evaluateRules }   from './evaluateRules'
export { BRANCHING_RULES } from './branchingRules'

// ── Storage ───────────────────────────────────────────────────────────────────
export { saveIntakeAnswer }          from './saveIntakeAnswer'
export { getOrCreateIntakeSession }  from './getOrCreateIntakeSession'
export { sectionIdFromNumber, sectionNumberFromId } from './sectionCoercion'
