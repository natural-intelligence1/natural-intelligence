// ─── packages/db/src/intake/types.ts ──────────────────────────────────────────
// Shared types for the UI branching engine.
// Distinct from clinicalScoringRules.ts (hypothesis scoring, synopsis pipeline).
// This engine controls FORM RENDERING only — which sections/branches activate.

export type RuleOperator =
  | 'eq'       // strict equality
  | 'in'       // value is in a provided set
  | 'gte'      // numeric ≥
  | 'lte'      // numeric ≤
  | 'contains' // substring match — works on strings and arrays of strings

export type ActivationType = 'section' | 'subBranch' | 'flag'

export interface RuleCondition {
  questionId: string
  op:         RuleOperator
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value:      any
}

export interface RuleActivation {
  type:   ActivationType
  target: string
  /**
   * Optional human-readable explanation. Surfaces in the RuleResult for
   * debugging and admin/practitioner review.
   * Example: "Digestive concern detected — bloating mentioned"
   */
  reason?: string
}

export interface Rule {
  id:        string
  when:      RuleCondition
  activates: RuleActivation
  /**
   * Higher priority wins when exclusive rules collide.
   * Default: 0. Negative values allowed (lower priority).
   * Recommended spread: 10-point steps to leave room for future insertions.
   */
  priority:  number
  /**
   * If true, only ONE rule per (activates.type, group) may activate.
   * Group is derived from the target: 'section2/digestive' → group 'section2'.
   * Highest priority wins; others are suppressed.
   * Use for sub-branch competition where the form can render only one path.
   *
   * If false, the rule contributes additively.
   * Use for flags and concurrent section activation.
   */
  exclusive: boolean
}

export interface RuleEvaluation {
  activeSections:    string[]
  activeSubBranches: Record<string, string[]>
  flags:             string[]
  /**
   * Full audit trail of rules that fired (matched condition), including
   * suppressed ones (exclusive losers).
   * Rules that did not fire are omitted from the trace.
   */
  trace: RuleTraceEntry[]
}

export interface RuleTraceEntry {
  ruleId:          string
  fired:           boolean
  suppressedBy?:   string   // present if this rule lost an exclusive collision
  reason?:         string   // copied from activation.reason
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  matchedAgainst?: any      // the normalized answer value that satisfied the condition
}

/** The full set of answers collected so far, keyed by questionId. */
export type AnswerMap = Record<string, unknown>
