// ─── apps/web/app/dashboard/intake/types.ts ──────────────────────────────────
// Shared types used by IntakeForm and useIntakeAnswers hook.
// Kept in a separate file to avoid circular imports.

// ─── FoodSymptomLink ─────────────────────────────────────────────────────────
// R4: answer shape for the food-symptom association question (Section 2 digestive).
// Both arrays are required — never null. Empty arrays mean "none / not noticed."
// presets: selected from the predefined chip list (stored in original case).
// custom:  user-entered free-text items (trimmed, lowercased, deduped at entry).

export interface FoodSymptomLink {
  presets: string[]
  custom:  string[]
}

// ─── FormState ────────────────────────────────────────────────────────────────

export interface FormState {
  arrival_emotion:           string
  primary_concerns:          string[]
  concern_duration:          string
  symptom_pattern:           string
  // Sprint 16.3 Tier 1 — Section 1 additions (items 1–3)
  concern_severity_baseline: number | null
  aggravating_factors:       string
  relieving_factors:         string
  systems_reviewed:       string[]
  gi_bloating:            boolean | null
  gi_timing:              string[]
  gi_severity:            number | null
  gi_stool_type:          number | null
  // Sprint 16.3 Tier 1 — Section 2 digestive additions (items 4–5)
  food_symptom_link:      FoodSymptomLink          // R4: never null; { presets:[], custom:[] } = no link
  gi_stool_frequency:     number | null
  energy_low_times:          string[]
  energy_curve:              string
  energy_severity:           number | null
  // Sprint 16.3 Tier 1 — Section 2 energy addition (item 9)
  post_exertional_worsening: boolean | null
  // Sprint 16.3 Tier 1 — Section 2 hormonal additions (items 6–8)
  // R3: menstrual gating derived from menstrual_status; not stored separately.
  menstrual_status:          string
  menstrual_cycle_length:    number | null
  menstrual_flow_heaviness:  number | null
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
  // Sprint 16.3 Tier 1 — Section 4 additions (items 10–11)
  // R6: stored as enum 'none'|'low'|'moderate'|'high'; '' = unanswered
  caffeine_intake:        string
  alcohol_intake:         string
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
