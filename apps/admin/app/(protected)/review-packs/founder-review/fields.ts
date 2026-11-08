// ─── Founder Review — field label registry ───────────────────────────────────
// Labels and grouping ONLY. This file holds no answer, no example value and no
// default: every value rendered by the review surface comes from the database.
//
// That distinction is the point. A fixture supplies CONTENT when the database
// has none, which is exactly what this surface must never do. A label registry
// supplies the QUESTION WORDING for content that is already there — and if the
// database has nothing for a field, the surface says so.
//
// The wording is lifted from the live form
// (apps/web/app/dashboard/intake/IntakeForm.tsx) rather than reworded here, so
// the Founder reads the question the client was actually asked. The section
// numbers are the ones written to the database by `persist(field, value,
// SECTION, …)`, which are the original section numbers — the form's visible
// chapter order was later rearranged and does not match them.

export type FieldSource =
  /** A column on the single wide `intake_responses` row. */
  | 'response'
  /** A row in `intake_answers`, keyed by `question_id`. */
  | 'answer'

export interface ReviewField {
  /** `intake_responses` column name, or `intake_answers.question_id`. */
  key: string
  /** The question as the client was asked it. */
  label: string
  source: FieldSource
  /** Shown only when the adaptive branch applies, so absence is expected. */
  conditional?: boolean
}

export interface ReviewSection {
  /** `section_id` as stored. */
  id: string
  title: string
  fields: ReviewField[]
}

export const REVIEW_SECTIONS: ReviewSection[] = [
  {
    id: '0',
    title: 'Arrival',
    fields: [
      { key: 'arrival_emotion', label: 'How are you feeling arriving here today?', source: 'response' },
    ],
  },
  {
    id: '1',
    title: 'Your story',
    fields: [
      {
        key: 'most_want_to_understand',
        label: 'If we get this right, what would you most want to understand about what’s happening to you?',
        source: 'response',
      },
      { key: 'primary_concerns', label: 'What’s been on your mind most?', source: 'response' },
      { key: 'concern_duration', label: 'How long has this been with you?', source: 'response' },
      { key: 'symptom_pattern', label: 'How does it tend to show up day to day?', source: 'response' },
      {
        key: 'concern_severity_baseline',
        label: 'How much does this shape your day right now?',
        source: 'answer',
      },
      { key: 'aggravating_factors', label: 'What tends to make it worse, if anything?', source: 'answer' },
      { key: 'relieving_factors', label: 'What tends to help, if anything?', source: 'answer' },
    ],
  },
  {
    id: '2',
    title: 'Deeper dive, and your best',
    fields: [
      { key: 'systems_reviewed', label: 'Which body systems feel most affected?', source: 'response' },
      { key: 'gi_bloating', label: 'Do you experience bloating?', source: 'answer', conditional: true },
      { key: 'gi_timing', label: 'When does it happen?', source: 'answer', conditional: true },
      { key: 'gi_severity', label: 'How severe is it on a bad day?', source: 'answer', conditional: true },
      {
        key: 'food_symptom_link',
        label: 'Foods you have linked to your symptoms',
        source: 'answer',
        conditional: true,
      },
      {
        key: 'gi_stool_frequency',
        label: 'On average, how often do you have a bowel movement?',
        source: 'answer',
        conditional: true,
      },
      {
        key: 'hormonal_symptoms',
        label: 'Which of these do you experience?',
        source: 'answer',
        conditional: true,
      },
      {
        key: 'cycle_patterns',
        label: 'Do your symptoms follow a cycle pattern?',
        source: 'answer',
        conditional: true,
      },
      { key: 'menstrual_status', label: 'Your menstrual status', source: 'answer', conditional: true },
      {
        key: 'menstrual_cycle_length',
        label: 'What is your typical cycle length?',
        source: 'answer',
        conditional: true,
      },
      {
        key: 'menstrual_flow_heaviness',
        label: 'How would you describe your typical flow?',
        source: 'answer',
        conditional: true,
      },
      {
        key: 'energy_low_times',
        label: 'When is your energy typically lowest?',
        source: 'answer',
        conditional: true,
      },
      {
        key: 'energy_curve',
        label: 'Which pattern describes your energy across the day?',
        source: 'answer',
        conditional: true,
      },
      {
        key: 'energy_severity',
        label: 'How severe is the fatigue on a bad day?',
        source: 'answer',
        conditional: true,
      },
      { key: 'timeline_last_well', label: 'When did you last feel genuinely well?', source: 'response' },
      {
        key: 'best_self_description',
        label: 'What was different about your life back then?',
        source: 'response',
      },
      { key: 'best_self_sleep', label: 'How was your sleep back then?', source: 'response' },
      { key: 'best_self_energy', label: 'How was your energy back then?', source: 'response' },
      { key: 'best_self_mood', label: 'How was your mood back then?', source: 'response' },
      {
        key: 'best_self_recovery_goal',
        label: 'If you could get one thing back, what would it be?',
        source: 'response',
      },
    ],
  },
  {
    id: '3',
    title: 'What changed',
    fields: [
      { key: 'timeline_trigger', label: 'What was happening around then? (in your own words)', source: 'response' },
      {
        key: 'post_exertional_worsening',
        label: 'Do you feel noticeably worse the day after physical or mental exertion?',
        source: 'answer',
      },
    ],
  },
  {
    id: '4',
    title: 'Daily life',
    fields: [
      { key: 'sleep_hours', label: 'How much sleep do you get?', source: 'response' },
      { key: 'sleep_quality', label: 'How would you rate the quality of that sleep?', source: 'response' },
      { key: 'stress_level', label: 'What is your typical stress level?', source: 'response' },
      { key: 'energy_level', label: 'How would you rate your day-to-day energy?', source: 'response' },
      { key: 'exercise_frequency', label: 'How often do you exercise?', source: 'response' },
      { key: 'diet_description', label: 'What best describes your diet?', source: 'response' },
      { key: 'caffeine_intake', label: 'How much caffeine do you typically have?', source: 'answer' },
      { key: 'alcohol_intake', label: 'How much alcohol do you typically have?', source: 'answer' },
    ],
  },
  {
    id: '5',
    title: 'Medical background',
    fields: [
      { key: 'diagnosed_conditions', label: 'Any existing diagnoses or conditions?', source: 'response' },
      { key: 'current_medications', label: 'Current medications', source: 'response' },
      { key: 'current_supplements', label: 'Current supplements', source: 'response' },
      { key: 'past_treatments', label: 'Treatments or approaches you’ve tried', source: 'response' },
      { key: 'family_history', label: 'Family health history', source: 'response' },
      {
        key: 'gi_stool_type',
        label: 'Bowel pattern — which type most resembles yours?',
        source: 'answer',
        conditional: true,
      },
    ],
  },
  {
    id: '6',
    title: 'Mind and emotion',
    fields: [
      { key: 'psychosocial_impact', label: 'How has this affected your daily life?', source: 'response' },
      {
        key: 'psychosocial_worry',
        label: 'What worries you most about your health right now?',
        source: 'response',
      },
      { key: 'psychosocial_supported', label: 'Do you feel supported?', source: 'response' },
    ],
  },
  {
    id: '8',
    title: 'Readiness',
    fields: [
      {
        key: 'readiness_budget',
        label: 'How would you describe your health budget right now?',
        source: 'response',
      },
    ],
  },
]

/**
 * Columns the form no longer writes. Sprint B Phase 1 deleted the questions
 * behind most of them, so a value here is historical. They are listed — rather
 * than dropped — because a column holding data must never be silently hidden
 * from a review surface; the surface labels them as retired and shows them
 * only when they actually carry a value.
 */
export const RETIRED_RESPONSE_FIELDS: ReviewField[] = [
  { key: 'biggest_barrier', label: 'Biggest barrier', source: 'response' },
  { key: 'health_goals', label: 'Health goals', source: 'response' },
  { key: 'practitioner_types', label: 'Practitioner types already seen', source: 'response' },
  { key: 'readiness_change', label: 'Readiness to change', source: 'response' },
  { key: 'readiness_time', label: 'Time available', source: 'response' },
  { key: 'surgeries_or_injuries', label: 'Surgeries or injuries', source: 'response' },
  { key: 'symptom_onset', label: 'Symptom onset', source: 'response' },
  { key: 'timeline_expectation', label: 'Timeline expectation', source: 'response' },
  { key: 'timeline_trigger_type', label: 'Trigger type', source: 'response' },
  { key: 'working_with_practitioners', label: 'Already working with practitioners', source: 'response' },
]

/** Routing and provenance, not clinical answers. Shown in the Intake header. */
export const RECORD_FIELDS: ReviewField[] = [
  { key: 'primary_system', label: 'Primary system (triage)', source: 'response' },
  { key: 'heard_about_ni', label: 'How they heard about NI', source: 'response' },
]

/**
 * Columns that are record-keeping rather than answers. Excluded from the
 * "stored but unlabelled" sweep so the sweep surfaces genuine gaps only.
 */
export const RESPONSE_METADATA_COLUMNS: ReadonlySet<string> = new Set([
  'id',
  'member_id',
  'case_id',
  'created_at',
  'updated_at',
  'version',
  'is_complete',
  'completed_sections',
  'consent_to_ai_analysis',
  'consent_given_at',
])

/** Every `intake_responses` column this registry accounts for. */
export const REGISTERED_RESPONSE_KEYS: ReadonlySet<string> = new Set([
  ...REVIEW_SECTIONS.flatMap((s) => s.fields.filter((f) => f.source === 'response').map((f) => f.key)),
  ...RETIRED_RESPONSE_FIELDS.map((f) => f.key),
  ...RECORD_FIELDS.map((f) => f.key),
])

/** Every `intake_answers.question_id` this registry accounts for. */
export const REGISTERED_ANSWER_KEYS: ReadonlySet<string> = new Set(
  REVIEW_SECTIONS.flatMap((s) => s.fields.filter((f) => f.source === 'answer').map((f) => f.key)),
)

/**
 * Every key this registry labels, from either source.
 *
 * The form's `persist()` writes BOTH the denormalised `intake_responses`
 * column AND a per-question `intake_answers` row for the same question. So a
 * question labelled here as a column is also a legitimate answer row, and
 * checking an answer row against the column-only set would report a labelled
 * question as unlabelled.
 */
export const REGISTERED_KEYS: ReadonlySet<string> = new Set([
  ...REGISTERED_RESPONSE_KEYS,
  ...REGISTERED_ANSWER_KEYS,
])
