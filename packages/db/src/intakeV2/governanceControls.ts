// ─── packages/db/src/intakeV2/governanceControls.ts ───────────────────────────
// Solicitor controls 6, 7 and 8 (LEGAL SECOND PASS — GREEN, 18 Sep 2026),
// implemented at the governance/model/guard level. Live practitioner and
// student wiring is intentionally absent, so these guards are the CANONICAL
// rules that any future live surface must call — the future server-side
// enforcement points are documented on each.

// ═══ Control 6 — student access / supervision / audit ════════════════════════
// Approved architecture, modelled. REAL-CLIENT STUDENT ACCESS IS DISABLED:
// no student role exists in the live system, and none may be added without
// wiring these guards into the Sprint 3 data-access layer (RLS + server
// actions — the 0052-era practitioner-workspace work).

export type V2Actor =
  | 'client_intake'      // the client filling their own intake
  | 'practitioner'       // the assigned, authorised practitioner
  | 'student'            // supervised student assisting a practitioner
  | 'ni_admin'           // NI administrator
  | 'ai'                 // any AI pipeline
  | 'automated_job'      // any scheduled/automated process
  | 'synopsis_generation' // the synopsis rendering/generation path

export const V2_STUDENT_ACCESS_REQUIREMENTS = [
  'The client knows a student is assisting',
  'Named supervisor linkage exists',
  'Minimum-necessary access only',
  'Audit of who entered/changed information',
  'A student cannot independently verify clinical facts',
  'A student cannot independently sign clinical conclusions',
  'A student cannot independently populate or approve the final Analysis & Plan',
  'The client can review/confirm answers entered on their behalf',
  'Access ends when authorised supervision/case involvement ends',
] as const

export interface V2StudentAccessContext {
  clientInformedOfStudent: boolean
  namedSupervisorId: string | null
  supervisionActive: boolean
  caseInvolvementActive: boolean
}

/** A student may access a case ONLY while every condition holds. Fail-closed. */
export function canStudentAccessCase(context: V2StudentAccessContext): boolean {
  return (
    context.clientInformedOfStudent === true &&
    typeof context.namedSupervisorId === 'string' && context.namedSupervisorId.length > 0 &&
    context.supervisionActive === true &&
    context.caseInvolvementActive === true
  )
}

/** Only the practitioner verifies clinical facts — never a student alone,
 *  never NI, never automation. */
export function canVerifyClinicalFacts(actor: V2Actor): boolean {
  return actor === 'practitioner'
}

/** Only the practitioner signs clinical conclusions. */
export function canSignClinicalConclusions(actor: V2Actor): boolean {
  return actor === 'practitioner'
}

/** Entries a student makes on a client's behalf must be client-reviewable:
 *  they carry the entering actor for audit and are never auto-confirmed. */
export function studentEntryRequiresClientConfirmation(actor: V2Actor): boolean {
  return actor === 'student'
}

// ═══ Control 7 — practitioner-only Analysis & Plan ═══════════════════════════
// practitioner.analysis.* fields are practitioner-authored, practitioner-
// approved, empty by default. NOT writable by intake, AI, NI administrators,
// students, synopsis generation or automated jobs.
//
// FUTURE ENFORCEMENT POINT (documented; live wiring intentionally absent):
// when the Analysis & Plan surface is built for real cases, every write
// must pass through a server action that (a) authenticates a practitioner
// with ACTIVE authorised work on that case (Sprint 3 model) and (b) calls
// this guard; the backing table needs RLS granting INSERT/UPDATE to that
// practitioner only. Until then the preview is inert and nothing writes.

export function canWriteAnalysisField(actor: V2Actor, fieldId: string): boolean {
  if (!fieldId.startsWith('practitioner.analysis.')) return false
  return actor === 'practitioner'
}

// ═══ Control 8 — hard LEGAL/MHRA REVIEW REQUIRED change-control gate ═════════
// This is its own governance gate, never combined with another control.
//
// DEVELOPER INTEGRATION NOTE: before building, enabling, prompting for, or
// merging ANYTHING on this list — in any app, pipeline, prompt or copy —
// STOP. Fresh Legal/MHRA review is mandatory first. Reference this constant
// in the PR/change description; tests below this module guard the current
// Intake/Synopsis model against these concepts appearing silently.

export const LEGAL_MHRA_GATE_LABEL = 'LEGAL/MHRA REVIEW REQUIRED'

export const LEGAL_MHRA_GATED_CAPABILITIES = [
  'confidence scores',
  'NI-generated severity scores',
  'NI-generated risk scores',
  'diagnostic/dysfunction labels',
  'disease prediction',
  'personalised red-flag triage',
  'inferred causes/root causes',
  'treatment recommendations',
  'supplement recommendations',
  'dosage guidance',
  'ranked practitioner options',
  'practitioner-facing clinical decision support',
  'automated Analysis & Plan content',
  'automatic care-plan generation',
  'claims that NI itself diagnoses, detects, predicts, treats, manages or recommends',
] as const

export const LEGAL_MHRA_GATE_STATEMENT =
  `${LEGAL_MHRA_GATE_LABEL}: fresh Legal/MHRA review is mandatory before Natural Intelligence ` +
  'adds any of the gated capabilities. This gate is a standing change-control boundary — it is ' +
  'not cleared by architecture approval and is never combined with another control.'
