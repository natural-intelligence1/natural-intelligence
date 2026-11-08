// ─── packages/db/src/intake/questionRegistry.ts ──────────────────────────────
// The V1 Intake question model. ONE registry, shared.
//
// WHAT THIS IS
//
// Question wording, section grouping, conditionality and — where one exists —
// the legacy `intake_responses` column that mirrors the question. Every
// consumer that needs to say "what did this client tell NI?" interprets
// `intake_answers` through this file. Nobody reconstructs the question model
// independently: a second copy is a second answer.
//
// WHAT THIS IS NOT
//
// It holds no answer, no example and no default. A registry supplies the
// QUESTION; the database supplies the ANSWER. If the database has nothing,
// the projection says so rather than filling the gap.
//
// WORDING
//
// Lifted verbatim from the live form (apps/web/app/dashboard/intake/
// IntakeForm.tsx) rather than reworded here, so a practitioner reads the
// question the client was actually asked.
//
// SECTION NUMBERS
//
// `sectionId` is what the form writes to `intake_answers.section_id` via
// `persist(field, value, SECTION, …)`. These are the ORIGINAL section numbers.
// The form's visible chapter order was rearranged later and does not match
// them; the stored value is what matters here.
//
// This describes Intake V1, the flow that is live. Intake V2 has its own
// registry (intakeV2/registry.ts) and its own question set.

/** Shapes that need normalising because the two stores disagree. */
export type AnswerShape =
  /** `intake_answers` holds a string[]; the legacy column holds "a, b, c". */
  | 'supplement_list'
  /** `intake_answers` holds an option key; the legacy column holds a boolean. */
  | 'support_level'

export interface IntakeQuestion {
  /** `intake_answers.question_id`. */
  id: string
  /** The question as the client was asked it. */
  label: string
  /** `intake_answers.section_id` as stored. */
  sectionId: string
  /**
   * The `intake_responses` column that mirrors this question, or null when
   * the question lives only in the answer store. Fallback only — a present
   * answer row always wins.
   */
  legacyColumn: string | null
  /** Shown only on an adaptive branch, so absence is expected, not a gap. */
  conditional?: boolean
  /** Set when the two stores hold this question in different shapes. */
  shape?: AnswerShape
}

export interface IntakeSection {
  id: string
  title: string
  questions: IntakeQuestion[]
}

/**
 * A field that exists ONLY as an `intake_responses` column — there is no
 * question behind it in the live form, so there can be no answer row.
 */
export interface LegacyOnlyField {
  column: string
  label: string
  /** derived: computed by the form. stale: nothing writes it any more. */
  kind: 'derived' | 'stale'
}

export const INTAKE_SECTIONS: IntakeSection[] = [
  {
    id: '0',
    title: 'Arrival',
    questions: [
      {
        id: 'arrival_emotion',
        label: 'How are you feeling arriving here today?',
        sectionId: '0',
        legacyColumn: 'arrival_emotion',
      },
    ],
  },
  {
    id: '1',
    title: 'Your story',
    questions: [
      {
        id: 'most_want_to_understand',
        label:
          'If we get this right, what would you most want to understand about what’s happening to you?',
        sectionId: '1',
        legacyColumn: 'most_want_to_understand',
      },
      {
        id: 'primary_concerns',
        label: 'What’s been on your mind most?',
        sectionId: '1',
        legacyColumn: 'primary_concerns',
      },
      {
        id: 'concern_duration',
        label: 'How long has this been with you?',
        sectionId: '1',
        legacyColumn: 'concern_duration',
      },
      {
        id: 'symptom_pattern',
        label: 'How does it tend to show up day to day?',
        sectionId: '1',
        legacyColumn: 'symptom_pattern',
      },
      {
        id: 'concern_severity_baseline',
        label: 'How much does this shape your day right now?',
        sectionId: '1',
        legacyColumn: null,
      },
      {
        id: 'aggravating_factors',
        label: 'What tends to make it worse, if anything?',
        sectionId: '1',
        legacyColumn: null,
      },
      {
        id: 'relieving_factors',
        label: 'What tends to help, if anything?',
        sectionId: '1',
        legacyColumn: null,
      },
    ],
  },
  {
    id: '2',
    title: 'Deeper dive, and your best',
    questions: [
      {
        id: 'systems_reviewed',
        label: 'Which body systems feel most affected?',
        sectionId: '2',
        legacyColumn: 'systems_reviewed',
      },
      { id: 'gi_bloating', label: 'Do you experience bloating?', sectionId: '2', legacyColumn: null, conditional: true },
      { id: 'gi_timing', label: 'When does it happen?', sectionId: '2', legacyColumn: null, conditional: true },
      { id: 'gi_severity', label: 'How severe is it on a bad day?', sectionId: '2', legacyColumn: null, conditional: true },
      {
        id: 'food_symptom_link',
        label: 'Foods you have linked to your symptoms',
        sectionId: '2',
        legacyColumn: null,
        conditional: true,
      },
      {
        id: 'gi_stool_frequency',
        label: 'On average, how often do you have a bowel movement?',
        sectionId: '2',
        legacyColumn: null,
        conditional: true,
      },
      {
        id: 'hormonal_symptoms',
        label: 'Which of these do you experience?',
        sectionId: '2',
        legacyColumn: null,
        conditional: true,
      },
      {
        id: 'cycle_patterns',
        label: 'Do your symptoms follow a cycle pattern?',
        sectionId: '2',
        legacyColumn: null,
        conditional: true,
      },
      { id: 'menstrual_status', label: 'Your menstrual status', sectionId: '2', legacyColumn: null, conditional: true },
      {
        id: 'menstrual_cycle_length',
        label: 'What is your typical cycle length?',
        sectionId: '2',
        legacyColumn: null,
        conditional: true,
      },
      {
        id: 'menstrual_flow_heaviness',
        label: 'How would you describe your typical flow?',
        sectionId: '2',
        legacyColumn: null,
        conditional: true,
      },
      {
        id: 'energy_low_times',
        label: 'When is your energy typically lowest?',
        sectionId: '2',
        legacyColumn: null,
        conditional: true,
      },
      {
        id: 'energy_curve',
        label: 'Which pattern describes your energy across the day?',
        sectionId: '2',
        legacyColumn: null,
        conditional: true,
      },
      {
        id: 'energy_severity',
        label: 'How severe is the fatigue on a bad day?',
        sectionId: '2',
        legacyColumn: null,
        conditional: true,
      },
      {
        id: 'timeline_last_well',
        label: 'When did you last feel genuinely well?',
        sectionId: '2',
        legacyColumn: 'timeline_last_well',
      },
      {
        id: 'best_self_description',
        label: 'What was different about your life back then?',
        sectionId: '2',
        legacyColumn: 'best_self_description',
      },
      { id: 'best_self_sleep', label: 'How was your sleep back then?', sectionId: '2', legacyColumn: 'best_self_sleep' },
      { id: 'best_self_energy', label: 'How was your energy back then?', sectionId: '2', legacyColumn: 'best_self_energy' },
      { id: 'best_self_mood', label: 'How was your mood back then?', sectionId: '2', legacyColumn: 'best_self_mood' },
      {
        id: 'best_self_recovery_goal',
        label: 'If you could get one thing back, what would it be?',
        sectionId: '2',
        legacyColumn: 'best_self_recovery_goal',
      },
    ],
  },
  {
    id: '3',
    title: 'What changed',
    questions: [
      {
        id: 'timeline_trigger',
        label: 'What was happening around then? (in your own words)',
        sectionId: '3',
        legacyColumn: 'timeline_trigger',
      },
      {
        id: 'post_exertional_worsening',
        label: 'Do you feel noticeably worse the day after physical or mental exertion?',
        sectionId: '3',
        legacyColumn: null,
      },
    ],
  },
  {
    id: '4',
    title: 'Daily life',
    questions: [
      { id: 'sleep_hours', label: 'How much sleep do you get?', sectionId: '4', legacyColumn: 'sleep_hours' },
      {
        id: 'sleep_quality',
        label: 'How would you rate the quality of that sleep?',
        sectionId: '4',
        legacyColumn: 'sleep_quality',
      },
      { id: 'stress_level', label: 'What is your typical stress level?', sectionId: '4', legacyColumn: 'stress_level' },
      {
        id: 'energy_level',
        label: 'How would you rate your day-to-day energy?',
        sectionId: '4',
        legacyColumn: 'energy_level',
      },
      {
        id: 'exercise_frequency',
        label: 'How often do you exercise?',
        sectionId: '4',
        legacyColumn: 'exercise_frequency',
      },
      {
        id: 'diet_description',
        label: 'What best describes your diet?',
        sectionId: '4',
        legacyColumn: 'diet_description',
      },
      { id: 'caffeine_intake', label: 'How much caffeine do you typically have?', sectionId: '4', legacyColumn: null },
      { id: 'alcohol_intake', label: 'How much alcohol do you typically have?', sectionId: '4', legacyColumn: null },
    ],
  },
  {
    id: '5',
    title: 'Medical background',
    questions: [
      {
        id: 'diagnosed_conditions',
        label: 'Any existing diagnoses or conditions?',
        sectionId: '5',
        legacyColumn: 'diagnosed_conditions',
      },
      { id: 'current_medications', label: 'Current medications', sectionId: '5', legacyColumn: 'current_medications' },
      {
        id: 'current_supplements',
        label: 'Current supplements',
        sectionId: '5',
        legacyColumn: 'current_supplements',
        shape: 'supplement_list',
      },
      {
        id: 'past_treatments',
        label: 'Treatments or approaches you’ve tried',
        sectionId: '5',
        legacyColumn: 'past_treatments',
      },
      { id: 'family_history', label: 'Family health history', sectionId: '5', legacyColumn: 'family_history' },
      {
        id: 'gi_stool_type',
        label: 'Bowel pattern — which type most resembles yours?',
        sectionId: '5',
        legacyColumn: null,
        conditional: true,
      },
    ],
  },
  {
    id: '6',
    title: 'Mind and emotion',
    questions: [
      {
        id: 'psychosocial_impact',
        label: 'How has this affected your daily life?',
        sectionId: '6',
        legacyColumn: 'psychosocial_impact',
      },
      {
        id: 'psychosocial_worry',
        label: 'What worries you most about your health right now?',
        sectionId: '6',
        legacyColumn: 'psychosocial_worry',
      },
      {
        id: 'psychosocial_supported',
        label: 'Do you feel supported?',
        sectionId: '6',
        legacyColumn: 'psychosocial_supported',
        shape: 'support_level',
      },
    ],
  },
  {
    id: '8',
    title: 'Readiness',
    questions: [
      {
        id: 'readiness_budget',
        label: 'How would you describe your health budget right now?',
        sectionId: '8',
        legacyColumn: 'readiness_budget',
      },
    ],
  },
]

/**
 * Columns with no question behind them. `primary_system` is derived by the
 * form and written straight to the column; the rest are stale — the questions
 * were deleted in Sprint B Phase 1 and nothing writes them now. They are
 * listed rather than dropped because a column holding data must never be
 * silently hidden from a clinical reader.
 */
export const LEGACY_ONLY_FIELDS: LegacyOnlyField[] = [
  { column: 'primary_system', label: 'Primary system (triage)', kind: 'derived' },
  { column: 'heard_about_ni', label: 'How they heard about NI', kind: 'stale' },
  { column: 'biggest_barrier', label: 'Biggest barrier', kind: 'stale' },
  { column: 'health_goals', label: 'Health goals', kind: 'stale' },
  { column: 'practitioner_types', label: 'Practitioner types already seen', kind: 'stale' },
  { column: 'readiness_change', label: 'Readiness to change', kind: 'stale' },
  { column: 'readiness_time', label: 'Time available', kind: 'stale' },
  { column: 'surgeries_or_injuries', label: 'Surgeries or injuries', kind: 'stale' },
  { column: 'symptom_onset', label: 'Symptom onset', kind: 'stale' },
  { column: 'timeline_expectation', label: 'Timeline expectation', kind: 'stale' },
  { column: 'timeline_trigger_type', label: 'Trigger type', kind: 'stale' },
  { column: 'working_with_practitioners', label: 'Already working with practitioners', kind: 'stale' },
]

/** Record-keeping columns, not answers. Excluded from every answer sweep. */
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

/** Every question in registry order. */
export const INTAKE_QUESTIONS: IntakeQuestion[] = INTAKE_SECTIONS.flatMap((s) => s.questions)

const BY_ID = new Map(INTAKE_QUESTIONS.map((q) => [q.id, q]))

export function getIntakeQuestion(questionId: string): IntakeQuestion | undefined {
  return BY_ID.get(questionId)
}

/** The `intake_responses` columns that mirror a question. */
export const MIRRORED_COLUMNS: ReadonlySet<string> = new Set(
  INTAKE_QUESTIONS.map((q) => q.legacyColumn).filter((c): c is string => c !== null),
)

/** Option keys for `psychosocial_supported`, and which mean "unsupported". */
export const SUPPORT_LEVEL_KEYS = ['supported', 'mixed', 'not_really', 'alone'] as const
export const UNSUPPORTED_KEYS: ReadonlySet<string> = new Set(['not_really', 'alone'])
