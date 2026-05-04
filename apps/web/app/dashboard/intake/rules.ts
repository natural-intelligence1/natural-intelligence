// ─── rules.ts ─────────────────────────────────────────────────────────────────
// Clinical rules engine for the intake question system.
// Rules fire based on answers (intake_answers.answer JSON) and produce:
//   - Hypothesis score adjustments (stored in intake_hypothesis_scores)
//   - Clinical flags (stored in intake_flags)
//
// Rules are evaluated server-side after each answer is saved.

export type HypothesisKey =
  | 'gut_dysbiosis'
  | 'low_stomach_acid'
  | 'sibo'
  | 'food_intolerance'
  | 'blood_sugar_instability'
  | 'hpa_axis_stress'
  | 'nervous_system_dysregulation'
  | 'mitochondrial_dysfunction'
  | 'sex_hormone_imbalance'
  | 'thyroid_pattern'

export type FlagSeverity = 'info' | 'important' | 'urgent'
export type FlagType = 'advise_gp' | 'red_flag' | 'clinical_note'

export interface ScoreAdjustment {
  hypothesis: HypothesisKey
  delta: number
}

export interface FlagSpec {
  severity: FlagSeverity
  type: FlagType
  message: string
  recommendedAction: string
}

export interface Rule {
  id: string
  questionId: string
  description: string
  // Returns true if the rule should fire for a given answer
  matches: (answer: unknown) => boolean
  scoreAdjustments?: ScoreAdjustment[]
  flag?: FlagSpec
}

// ─── Rule definitions ─────────────────────────────────────────────────────────

export const RULES: Rule[] = [

  // ── Bristol stool chart ───────────────────────────────────────────────────

  {
    id:          'bristol_type_1_2',
    questionId:  'gi_stool_type',
    description: 'Constipation pattern (Bristol types 1–2)',
    matches:     (a) => typeof a === 'object' && a !== null && 'type' in (a as object) && ((a as { type: number }).type <= 2),
    scoreAdjustments: [
      { hypothesis: 'gut_dysbiosis',    delta: 2 },
      { hypothesis: 'low_stomach_acid', delta: 1 },
    ],
  },

  {
    id:          'bristol_type_5_6',
    questionId:  'gi_stool_type',
    description: 'Loose stool pattern (Bristol types 5–6)',
    matches:     (a) => typeof a === 'object' && a !== null && 'type' in (a as object) && (((a as { type: number }).type === 5) || ((a as { type: number }).type === 6)),
    scoreAdjustments: [
      { hypothesis: 'gut_dysbiosis',   delta: 2 },
      { hypothesis: 'sibo',            delta: 1 },
      { hypothesis: 'food_intolerance', delta: 1 },
    ],
  },

  {
    id:          'bristol_type_7_frequent',
    questionId:  'gi_stool_type',
    description: 'Liquid stool pattern (Bristol type 7) — flags for GP review',
    matches:     (a) => typeof a === 'object' && a !== null && 'type' in (a as object) && ((a as { type: number }).type === 7),
    scoreAdjustments: [
      { hypothesis: 'gut_dysbiosis',   delta: 3 },
      { hypothesis: 'sibo',            delta: 2 },
      { hypothesis: 'food_intolerance', delta: 2 },
    ],
    flag: {
      severity:          'important',
      type:              'advise_gp',
      message:           'Frequent loose or liquid stools warrant medical review.',
      recommendedAction: 'If this is frequent or new, please speak with your GP to rule out any underlying cause.',
    },
  },

  // ── Urine colour ─────────────────────────────────────────────────────────

  {
    id:          'urine_red_brown',
    questionId:  'hydration_colour',
    description: 'Red/brown urine — clinical red flag',
    matches:     (a) => typeof a === 'object' && a !== null && 'value' in (a as object) && ((a as { value: string }).value === 'red_brown'),
    flag: {
      severity:          'important',
      type:              'advise_gp',
      message:           'Red, pink, or brown urine may indicate a medical condition requiring review.',
      recommendedAction: 'Please speak with your GP about this, especially if unexplained or new.',
    },
  },

  // ── Energy curve ─────────────────────────────────────────────────────────

  {
    id:          'energy_curve_afternoon_crash',
    questionId:  'energy_curve_pattern',
    description: 'Afternoon crash energy pattern → blood sugar instability',
    matches:     (a) => typeof a === 'object' && a !== null && 'value' in (a as object) && ((a as { value: string }).value === 'afternoon_crash'),
    scoreAdjustments: [
      { hypothesis: 'blood_sugar_instability', delta: 3 },
    ],
  },

  {
    id:          'energy_curve_morning_low',
    questionId:  'energy_curve_pattern',
    description: 'Morning low energy → HPA axis / cortisol rhythm',
    matches:     (a) => typeof a === 'object' && a !== null && 'value' in (a as object) && ((a as { value: string }).value === 'morning_low'),
    scoreAdjustments: [
      { hypothesis: 'hpa_axis_stress', delta: 3 },
    ],
  },

  {
    id:          'energy_curve_evening_wired',
    questionId:  'energy_curve_pattern',
    description: 'Evening wired pattern → HPA + nervous system dysregulation',
    matches:     (a) => typeof a === 'object' && a !== null && 'value' in (a as object) && ((a as { value: string }).value === 'evening_wired'),
    scoreAdjustments: [
      { hypothesis: 'hpa_axis_stress',                delta: 2 },
      { hypothesis: 'nervous_system_dysregulation',   delta: 2 },
    ],
  },

  {
    id:          'energy_curve_all_day_fatigue',
    questionId:  'energy_curve_pattern',
    description: 'All-day fatigue → mitochondrial dysfunction',
    matches:     (a) => typeof a === 'object' && a !== null && 'value' in (a as object) && ((a as { value: string }).value === 'all_day_fatigue'),
    scoreAdjustments: [
      { hypothesis: 'mitochondrial_dysfunction', delta: 3 },
    ],
  },

  // ── Cycle patterns ────────────────────────────────────────────────────────

  {
    id:          'cycle_irregular',
    questionId:  'cycle_symptom_pattern',
    description: 'Irregular cycle → thyroid + sex hormone imbalance',
    matches:     (a) => {
      if (typeof a !== 'object' || a === null || !('values' in (a as object))) return false
      const vals = (a as { values: string[] }).values
      return vals.includes('irregular')
    },
    scoreAdjustments: [
      { hypothesis: 'thyroid_pattern',       delta: 2 },
      { hypothesis: 'sex_hormone_imbalance', delta: 2 },
    ],
  },

  {
    id:          'cycle_heavy_pre',
    questionId:  'cycle_symptom_pattern',
    description: 'Heavy bleeding + pre-period symptoms → sex hormone imbalance',
    matches:     (a) => {
      if (typeof a !== 'object' || a === null || !('values' in (a as object))) return false
      const vals = (a as { values: string[] }).values
      return vals.includes('heavy_bleeding') && vals.includes('pre_period')
    },
    scoreAdjustments: [
      { hypothesis: 'sex_hormone_imbalance', delta: 4 },
    ],
  },

  {
    id:          'cycle_mid_cycle',
    questionId:  'cycle_symptom_pattern',
    description: 'Mid-cycle symptoms → sex hormone imbalance',
    matches:     (a) => {
      if (typeof a !== 'object' || a === null || !('values' in (a as object))) return false
      const vals = (a as { values: string[] }).values
      return vals.includes('mid_cycle')
    },
    scoreAdjustments: [
      { hypothesis: 'sex_hormone_imbalance', delta: 2 },
    ],
  },

  // ── Digestive timing ──────────────────────────────────────────────────────

  {
    id:          'timing_low_acid_pattern',
    questionId:  'gi_symptom_timing',
    description: 'Before + immediately after meals → low stomach acid / SIBO pattern',
    matches:     (a) => {
      if (typeof a !== 'object' || a === null || !('values' in (a as object))) return false
      const vals = (a as { values: string[] }).values
      return vals.includes('before_meals') && vals.includes('immediately_after')
    },
    scoreAdjustments: [
      { hypothesis: 'low_stomach_acid', delta: 2 },
      { hypothesis: 'sibo',             delta: 1 },
    ],
  },

  {
    id:          'timing_dysbiosis_pattern',
    questionId:  'gi_symptom_timing',
    description: 'Delayed post-meal symptoms → motility / dysbiosis',
    matches:     (a) => {
      if (typeof a !== 'object' || a === null || !('values' in (a as object))) return false
      const vals = (a as { values: string[] }).values
      return vals.includes('1_2hrs_after') || vals.includes('3_4hrs_after')
    },
    scoreAdjustments: [
      { hypothesis: 'gut_dysbiosis', delta: 2 },
      { hypothesis: 'sibo',         delta: 1 },
    ],
  },

  // ── Body map system mappings ───────────────────────────────────────────────
  // (informational — used to determine primary_system, not scored directly)

]

// ─── Evaluate rules for a single answer ──────────────────────────────────────

export interface RuleResult {
  ruleId:      string
  questionId:  string
  adjustments: ScoreAdjustment[]
  flag:        FlagSpec | null
}

export function evaluateAnswer(
  questionId: string,
  answer:     unknown,
): RuleResult[] {
  return RULES
    .filter(r => r.questionId === questionId && r.matches(answer))
    .map(r => ({
      ruleId:      r.id,
      questionId:  r.questionId,
      adjustments: r.scoreAdjustments ?? [],
      flag:        r.flag ?? null,
    }))
}

// ─── Body map → system mapping ────────────────────────────────────────────────

export const BODY_MAP_SYSTEM_WEIGHTS: Record<string, Partial<Record<string, number>>> = {
  upper_abdomen:  { digestive: 3 },
  lower_abdomen:  { digestive: 2, hormonal: 2 },
  pelvic:         { hormonal: 3 },
  joints:         { musculoskeletal: 3, immune: 1 },
  muscles:        { musculoskeletal: 2, immune: 1 },
  head_neck:      { cognitive: 2, nervous_system: 2 },
  chest:          { cardiovascular: 1, nervous_system: 1 },
  skin:           { immune: 2, digestive: 1 },
  back_lower:     { musculoskeletal: 2, hormonal: 1 },
  limbs:          { musculoskeletal: 1, nervous_system: 1 },
}
