// ─── questionBank.ts ──────────────────────────────────────────────────────────
// Central registry of all clinical intake questions.
// Questions are rendered by IntakeQuestionRenderer based on their inputType.
// showIf rules determine dynamic visibility based on prior answers.

export type InputType =
  | 'chip_cloud'
  | 'chip_cloud_single'
  | 'tag_input'
  | 'textarea'
  | 'visual_scale'
  | 'scale_5_dots'
  | 'sleep_slider'
  | 'emoji_card'
  | 'bristol_stool'
  | 'urine_colour'
  | 'body_map'
  | 'timing_selector'
  | 'energy_curve'
  | 'cycle_pattern'

export type Operator = 'includes' | 'equals' | 'not_equals' | 'exists' | 'gte' | 'lte'

export interface ShowIfCondition {
  questionId?: string
  field?: 'primary_system'        // session-level field
  operator: Operator
  value: unknown
}

export interface Question {
  id: string
  section: string
  inputType: InputType
  label: string
  helperText?: string
  educationTipId?: string
  placeholder?: string
  options?: string[]
  context?: 'digestive' | 'energy' | 'general'
  showIf?: ShowIfCondition[]      // AND logic; at least one must match for OR
  showIfAny?: ShowIfCondition[]   // OR logic — shown if ANY condition matches
  required?: boolean
}

// ─── Question registry ────────────────────────────────────────────────────────

export const QUESTIONS: Question[] = [

  // ── Triage ──────────────────────────────────────────────────────────────────

  {
    id:        'symptom_body_location',
    section:   'triage',
    inputType: 'body_map',
    label:     'Where do you experience symptoms or pain?',
    helperText: 'Select all that apply.',
  },

  {
    id:        'primary_concerns',
    section:   'triage',
    inputType: 'chip_cloud',
    label:     'What are your main health concerns right now?',
    options: [
      'Persistent fatigue', 'Poor sleep', 'Low mood', 'Digestive issues',
      'Hormonal symptoms', 'Brain fog', 'Anxiety or worry', 'Joint pain',
      'Weight changes', 'Hair thinning', 'Skin issues', 'Low libido',
      'Frequent infections', 'Headaches', 'Something else',
    ],
  },

  // ── Digestive ────────────────────────────────────────────────────────────────

  {
    id:        'gi_stool_type',
    section:   'digestive',
    inputType: 'bristol_stool',
    label:     'Which most resembles your typical bowel movement?',
    educationTipId: 'bristol_tip',
    showIfAny: [
      { questionId: 'primary_concerns', operator: 'includes', value: 'Digestive issues' },
      { field: 'primary_system', operator: 'equals', value: 'digestive' },
    ],
  },

  {
    id:        'gi_symptom_timing',
    section:   'digestive',
    inputType: 'timing_selector',
    label:     'When do digestive symptoms tend to occur?',
    context:   'digestive',
    showIfAny: [
      { field: 'primary_system', operator: 'equals', value: 'digestive' },
      { questionId: 'primary_concerns', operator: 'includes', value: 'Digestive issues' },
    ],
  },

  {
    id:        'bloating_severity',
    section:   'digestive',
    inputType: 'visual_scale',
    label:     'How severe is the bloating on a bad day?',
    showIf: [
      { questionId: 'gi_other_symptoms', operator: 'includes', value: 'Bloating' },
    ],
  },

  // ── Energy ───────────────────────────────────────────────────────────────────

  {
    id:        'energy_curve_pattern',
    section:   'energy',
    inputType: 'energy_curve',
    label:     'Which pattern best describes your energy across the day?',
    showIfAny: [
      { questionId: 'primary_concerns', operator: 'includes', value: 'Persistent fatigue' },
      { questionId: 'primary_concerns', operator: 'includes', value: 'Brain fog' },
    ],
  },

  {
    id:        'fatigue_severity',
    section:   'energy',
    inputType: 'visual_scale',
    label:     'How severe is the fatigue on a bad day?',
    showIfAny: [
      { questionId: 'primary_concerns', operator: 'includes', value: 'Persistent fatigue' },
    ],
  },

  // ── Lifestyle ────────────────────────────────────────────────────────────────

  {
    id:        'hydration_colour',
    section:   'lifestyle',
    inputType: 'urine_colour',
    label:     'What colour is your urine typically?',
    helperText: 'This gives us useful information about hydration and kidney function.',
  },

  // ── Hormonal ─────────────────────────────────────────────────────────────────

  {
    id:        'cycle_symptom_pattern',
    section:   'hormonal',
    inputType: 'cycle_pattern',
    label:     'Do your symptoms follow a hormonal or cycle pattern?',
    showIfAny: [
      { field: 'primary_system', operator: 'equals', value: 'hormonal' },
      { questionId: 'primary_concerns', operator: 'includes', value: 'Hormonal symptoms' },
      { questionId: 'symptom_body_location', operator: 'includes', value: 'pelvic' },
      { questionId: 'symptom_body_location', operator: 'includes', value: 'lower_abdomen' },
    ],
  },

]

// ─── Lookup helper ────────────────────────────────────────────────────────────

export function getQuestion(id: string): Question | undefined {
  return QUESTIONS.find(q => q.id === id)
}

export function getQuestionsBySection(section: string): Question[] {
  return QUESTIONS.filter(q => q.section === section)
}

// ─── Education tips ───────────────────────────────────────────────────────────

export const EDUCATION_TIPS: Record<string, string> = {
  bristol_tip: 'The Bristol Stool Chart is a clinical tool used to assess bowel transit time and digestive health. It is not a diagnosis.',
}
