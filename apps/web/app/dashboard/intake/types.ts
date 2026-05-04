// ─── apps/web/app/dashboard/intake/types.ts ──────────────────────────────────
// Shared types used by IntakeForm and useIntakeAnswers hook.
// Kept in a separate file to avoid circular imports.

// ─── FormState ────────────────────────────────────────────────────────────────

export interface FormState {
  arrival_emotion:        string
  primary_concerns:       string[]
  concern_duration:       string
  symptom_pattern:        string
  systems_reviewed:       string[]
  gi_bloating:            boolean | null
  gi_timing:              string[]
  gi_severity:            number | null
  gi_stool_type:          number | null
  energy_low_times:       string[]
  energy_curve:           string
  energy_severity:        number | null
  hormonal_symptoms:      string[]
  cycle_patterns:         string[]
  timeline_last_well:     string
  timeline_trigger:       string
  sleep_hours:            number | null
  sleep_quality:          number | null
  stress_level:           number | null
  energy_level:           number | null
  exercise_frequency:     string
  diet_description:       string
  diagnosed_conditions:   string[]
  current_medications:    string
  current_supplements:    string
  past_treatments:        string
  practitioner_types:     string[]
  surgeries_or_injuries:  string
  family_history:         string[]
  psychosocial_impact:    string
  psychosocial_worry:     string
  psychosocial_supported: string
  health_goals:           string[]
  timeline_expectation:   string
  biggest_barrier:        string
  readiness_time:         string
  readiness_budget:       string
  readiness_change:       string
}

// ─── Persist types ────────────────────────────────────────────────────────────

export type PersistMeta = {
  clinicalObjective?: string
  mappedSystems?:     string[]
  mappedHypotheses?:  string[]
}

/** Passed to every Section as the `persist` prop. */
export type PersistFn = (
  questionId:    keyof FormState,
  value:         unknown,
  sectionNumber: number,
  meta?:         PersistMeta,
) => void
