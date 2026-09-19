// ─── packages/db/src/intakeV2/synopsisMapping.ts ──────────────────────────────
// Intake-to-Synopsis mapping v1: the approved synopsis section sequence, the
// intake screen sequence, and the safety review derivation.
//
// SAFETY: which answers are safety-relevant is defined ONCE, by the clinical
// team, in the question registry (samd 'safety_capture' + enumerated
// safetyOptions). deriveV2SafetyReviewItems only INTERSECTS answers with
// that metadata — code invents no flags, produces no rank, urgency label,
// referral, test suggestion or triage. Raw answers are surfaced for the
// PRACTITIONER to adjudicate.
//
// LIVE-DATA DEPENDENCY (do not bypass): the live Synopsis V2 will consume
// real client health data. Live wiring must use the approved Sprint 3
// data-access model — consent enforcement, the de-identification /
// review-pack boundary and the client_cases access controls — and live
// rendering of real cases requires clinician sign-off and KR authorisation.

import { V2_QUESTIONS } from './registry'
import { V2_FIELD_REGISTRY, type V2FieldDef, type V2SynopsisSectionId } from './fieldRegistry'

// ─── Synopsis section sequence (approved order; Analysis & Plan is a tab) ────

export interface V2SynopsisSectionDef {
  id: V2SynopsisSectionId
  order: number
  title: string
  /** Separate practitioner-authored tab, never part of the facts surface. */
  separateTab?: boolean
  note?: string
}

// Solicitor-approved heading (control 9 terminology ruling, 18 Sep 2026) —
// replaces the earlier "Safety answers for practitioner review".
export const V2_SAFETY_BLOCK_TITLE = 'Safety-related information reported by client'

export const V2_SAFETY_BOUNDARY_TEXT =
  'Natural Intelligence surfaces reported answers for practitioner review. ' +
  'It does not assess risk, rank urgency or make referral decisions.'

export const V2_SAFETY_EMPTY_STATE =
  'No safety-review answers are currently available from the approved trigger set.'

// ─── Static emergency / non-monitoring wording (solicitor control 2) ─────────
// STATIC by design: always visible, never triggered by answers, never
// personalised — no software assessment of urgency exists anywhere.

export const V2_NON_MONITORING_WORDING =
  'Natural Intelligence is not an emergency service, and information submitted through this ' +
  'intake is not continuously monitored. If you need urgent medical help, contact your GP, ' +
  'NHS 111 or 999 as appropriate.'

// ─── Summary provenance / audit metadata (solicitor control 4) ────────────────
// Every generated practitioner synopsis carries this audit record. Field-level
// provenance (client_reported / practitioner_verified / corrected with
// author + time / missing) lives on each fact via V2SourcedFact — the
// original client answer is preserved verbatim and a correction sits beside
// it, never over it.

// ─── Default synopsis view policy (SK declutter, 18 Sep 2026) ─────────────────
// The practitioner sees THE CLIENT STORY — not the database, questionnaire
// or audit log. Provenance/audit stays fully in the MODEL; the default view
// hides it behind one understated "Source details" disclosure per item.
// The preview/live UI must obey this policy; a test pins it.

export const V2_SYNOPSIS_DEFAULT_VIEW = {
  showQuestionIds: false,
  showOriginalQuestionText: false,
  showPerLineProvenanceChips: false,
  showPerLineTimestamps: false,
  showWorkflowMetadata: false,
  showEmptyFields: false,
  showNoneReportedRows: false,
  provenanceDisclosureLabel: 'Source details',
} as const

export const V2_INTAKE_SCHEMA_VERSION = 'intake-v2.registry.v1'
export const V2_SYNOPSIS_WORKFLOW_VERSION = 'synopsis-v2.workflow.v1'

export interface V2SynopsisAuditMetadata {
  generatedAt: string
  /** Reference to the source intake submission (session id / snapshot ref). */
  sourceSubmissionRef: string
  intakeSchemaVersion: typeof V2_INTAKE_SCHEMA_VERSION
  synopsisWorkflowVersion: typeof V2_SYNOPSIS_WORKFLOW_VERSION
  /** Every registry field id that contributed to this synopsis. */
  sourceFieldIds: string[]
}

export function buildV2SynopsisAuditMetadata(input: {
  generatedAt: string
  sourceSubmissionRef: string
  sourceFieldIds: string[]
}): V2SynopsisAuditMetadata {
  return Object.freeze({
    generatedAt: input.generatedAt,
    sourceSubmissionRef: input.sourceSubmissionRef,
    intakeSchemaVersion: V2_INTAKE_SCHEMA_VERSION,
    synopsisWorkflowVersion: V2_SYNOPSIS_WORKFLOW_VERSION,
    sourceFieldIds: [...input.sourceFieldIds],
  })
}

export const V2_SYNOPSIS_SECTIONS: V2SynopsisSectionDef[] = [
  { id: 'safety_review', order: 1, title: V2_SAFETY_BLOCK_TITLE, note: V2_SAFETY_BOUNDARY_TEXT },
  { id: 'case_snapshot', order: 2, title: 'Case snapshot' },
  { id: 'concerns', order: 3, title: 'Presenting concerns' },
  { id: 'diagnoses', order: 4, title: 'Diagnoses, investigations & referrals (as reported)' },
  { id: 'timeline', order: 5, title: 'Health timeline' },
  { id: 'medications_supplements', order: 6, title: 'Medication & supplements' },
  { id: 'family_history', order: 7, title: 'Family history' },
  { id: 'early_life', order: 8, title: 'Early life & past health' },
  { id: 'systems_review', order: 9, title: 'Systems review' },
  { id: 'physical_observations', order: 10, title: 'Physical observations' },
  { id: 'food_kitchen', order: 11, title: 'Food, drink & kitchen reality' },
  { id: 'lifestyle_environment', order: 12, title: 'Lifestyle & environmental context' },
  { id: 'analysis_plan', order: 13, title: 'Analysis & Plan', separateTab: true,
    note: 'Practitioner-authored only. Empty by default. NI never pre-fills, suggests or drafts here.' },
]

export function v2FieldsForSynopsisSection(section: V2SynopsisSectionId): V2FieldDef[] {
  return V2_FIELD_REGISTRY.filter((field) => field.synopsisSection === section)
}

// ─── Intake screen sequence (approved) ────────────────────────────────────────

export const V2_INTAKE_SCREEN_SEQUENCE = [
  'Consent gate',
  'Confirm your details',
  'Arrival',
  'Main concerns',
  'Care in place',
  'Diagnoses, investigations & referrals',
  'Medications',
  'Supplements',
  'Body systems',
  'Reproductive branch',
  'Early life and past health',
  'Family history',
  'Food and kitchen reality',
  'Lifestyle and environment',
  'Timeline',
  'Review and submit',
] as const

// ─── Safety review derivation (clinician-owned metadata only) ─────────────────

export interface V2SafetyReviewItem {
  /** safety.review_item[n].source_question_id */
  sourceQuestionId: string
  questionLabel: string
  /** safety.review_item[n].raw_answer — verbatim, complete. */
  rawAnswer: string[]
  /** The subset that matched the clinician-enumerated safetyOptions. */
  matchedOptions: string[]
  /** safety.review_item[n].captured_at */
  capturedAt: string | null
  /** Practitioner-owned adjudication fields — start empty, never pre-set. */
  reviewStatus: 'unreviewed'
}

export function deriveV2SafetyReviewItems(
  answers: { questionId: string; value: unknown; capturedAt?: string }[],
): V2SafetyReviewItem[] {
  const items: V2SafetyReviewItem[] = []
  for (const entry of answers) {
    const question = V2_QUESTIONS.find((q) => q.id === entry.questionId)
    if (!question || question.samd !== 'safety_capture' || !question.safetyOptions) continue
    const reported = Array.isArray(entry.value)
      ? (entry.value as unknown[]).map(String)
      : typeof entry.value === 'string' ? [entry.value] : []
    const matched = reported.filter((option) => question.safetyOptions!.includes(option))
    if (matched.length > 0) {
      items.push({
        sourceQuestionId: question.id,
        questionLabel: question.label,
        rawAnswer: reported,
        matchedOptions: matched,
        capturedAt: entry.capturedAt ?? null,
        reviewStatus: 'unreviewed',
      })
    }
  }
  return items
}
