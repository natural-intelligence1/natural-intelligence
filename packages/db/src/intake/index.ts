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

// ── Canonical Intake projection (the one answer truth) ────────────────────────
export { getCanonicalIntake, normaliseAnswerValue, CANONICAL_ANSWER_ORDER } from './getCanonicalIntake'
export type {
  CanonicalIntake, CanonicalSection, CanonicalAnswer, CanonicalLegacyField,
  CanonicalIntakeSession, CanonicalCompletion, SupersededAnswer,
  AnswerSource, AnswerStatus, SupportLevel,
} from './getCanonicalIntake'

// ── The V1 question model — one registry, shared ──────────────────────────────
export {
  INTAKE_SECTIONS, INTAKE_QUESTIONS, LEGACY_ONLY_FIELDS, MIRRORED_COLUMNS,
  RESPONSE_METADATA_COLUMNS, SUPPORT_LEVEL_KEYS, UNSUPPORTED_KEYS, getIntakeQuestion,
} from './questionRegistry'
export type { IntakeQuestion, IntakeSection, LegacyOnlyField, AnswerShape } from './questionRegistry'

// ── Collection kill-switch (containment patch) ────────────────────────────────
export { isIntakeCollectionEnabled, assertIntakeCollectionEnabled } from './collectionFlag'
