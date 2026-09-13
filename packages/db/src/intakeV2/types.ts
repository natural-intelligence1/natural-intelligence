// ─── packages/db/src/intakeV2/types.ts ────────────────────────────────────────
// NI Pre-Consultation Health Intake (V2) — question registry types.
//
// V2 is a guided pre-consultation intake: it gathers the client's factual
// health story, organises it cleanly, and prepares the practitioner to take a
// better case. It is NOT a full clinical consultation; deep symptom digging
// lives in the practitioner call sheet (callSheet.ts), behind the
// practitioner layer.
//
// SaMD boundary (counsel, Sep 2026): V2 may COLLECT · ORGANISE · STORE ·
// DISPLAY BACK · STRUCTURE FOR A PRACTITIONER. Every question carries an
// explicit `samd` classification; nothing infers, scores, ranks, predicts,
// diagnoses, triages or recommends. Safety-relevant answers are CAPTURED and
// marked for practitioner review internally; the client is never given a
// risk label — only static safety information.

export type V2SectionId =
  | 'arrival' | 'about' | 'care_in_place' | 'concerns' | 'medical_history'
  | 'medication' | 'supplements' | 'family' | 'early_life'
  | 'systems_overview' | 'digestion' | 'nervous' | 'sleep' | 'mood_stress'
  | 'energy_metabolic' | 'reproductive' | 'immune' | 'breathing' | 'urinary'
  | 'heart' | 'muscles_joints' | 'skin'
  | 'food_diary' | 'food_frequency' | 'eating_habits' | 'drinks'
  | 'lifestyle' | 'timeline' | 'review'

export type V2AnswerType =
  | 'text' | 'textarea' | 'date' | 'number' | 'select' | 'multichip'
  | 'frequency' | 'yesno' | 'repeatable' | 'stool_form' | 'timeline' | 'diary'

/** SaMD classification — every question must carry one. */
export type V2SamdClass =
  | 'collect_only'       // plain factual collection
  | 'safety_capture'     // captured + marked for practitioner review; NEVER triaged to the client
  | 'practitioner_only'  // never asked of / shown to the self-serve client
  | 'held_back'          // defined but not enabled pending Legal/MHRA review

export interface V2RepeatableField {
  key: string
  label: string
  type: 'text' | 'select' | 'yesno'
  options?: string[]
}

export interface V2ShowIf {
  questionId: string
  /** show when the referenced answer (array) includes ANY of these values */
  includesAny?: string[]
  /** show when the referenced answer equals this value */
  equals?: string
}

export interface V2QuestionDef {
  /** Stable id, e.g. 'v2.about.full_name'. Never reuse or renumber. */
  id: string
  version: 1
  section: V2SectionId
  /** Screen grouping within the section (one tight group per screen). */
  screen: number
  label: string
  help?: string
  /** One-line 'why we ask' shown on sensitive/intrusive questions. */
  whyWeAsk?: string
  type: V2AnswerType
  options?: string[]
  itemFields?: V2RepeatableField[]
  /** Required for submission of the selected service path. Default false. */
  required?: boolean
  /** Skippable and returnable. Default true (everything non-essential). */
  skippable?: boolean
  sensitive?: boolean
  servicePath: 'all' | 'self_serve' | 'practitioner_led'
  source: 'client' | 'practitioner'
  showIf?: V2ShowIf
  /** Which practitioner-view section this maps to. */
  practitionerViewSection: string
  /** Which factual read-back section this maps to. */
  summarySection: string
  samd: V2SamdClass
  /** Option values within this question that are safety-capture answers. */
  safetyOptions?: string[]
  retentionCategory?: string
}

export interface V2SectionDef {
  id: V2SectionId
  title: string
  intro?: string
  /** Honest time estimate shown on the path. */
  estimateMinutes: number
  /** Section only appears when this condition holds (progressive disclosure). */
  showIf?: V2ShowIf
  optional?: boolean
}

/** Neutral internal safety-review labels (never user-facing risk language). */
export interface V2SafetyCapture {
  safety_capture_answered: boolean
  requires_practitioner_review: boolean
  review_status: 'pending' | 'reviewed'
  reviewed_by: string | null
  reviewed_at: string | null
  action_recorded: string | null
}
