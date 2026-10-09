// ─── packages/db/src/intakeV2/provenance.ts ───────────────────────────────────
// Global provenance convention for every factual field in the Intake V2 →
// Synopsis architecture (KR-approved Field Mapping v1).
//
// The client's original answer is preserved VERBATIM for the life of the
// record: a practitioner correction is recorded BESIDE it with actor and time,
// and can never overwrite it. This module is pure data + pure functions — no
// DB, no interpretation.
//
// V4 EXTENSION (approved design): the original four states are kept exactly as
// they were and the approved separation is added alongside them. Nothing is
// renamed or removed, so existing callers and stored facts stay valid.
//
// The distinctions that matter clinically:
//   • `not_asked` is NOT `no`, and NOT `missing`. A question the branch never
//     opened must never read as a negative answer.
//   • `unconfirmed` is a client report we could not corroborate — not a denial.
//   • `declined` means the client chose to discuss it with a person instead.
//   • `system_organised` / `system_structured_from_client_language` mark what
//     NI arranged, so it can never be mistaken for something the client said
//     in those words, or for clinical interpretation.
//   • `practitioner_interpreted` is the ONLY state that may carry clinical
//     meaning, and only a practitioner may set it.

export const V2_PROVENANCE_STATES = [
  // Original four — unchanged, still the default path.
  'client_reported',
  'practitioner_verified',
  'corrected',
  'missing',
  // V4 additions.
  'documented_record',
  'unconfirmed',
  'not_asked',
  'declined',
  'system_organised',
  'system_structured_from_client_language',
  'practitioner_interpreted',
] as const

/** States NI may set without a human. Everything else requires a practitioner. */
export const SYSTEM_SETTABLE_PROVENANCE = [
  'client_reported', 'missing', 'not_asked', 'declined',
  'system_organised', 'system_structured_from_client_language',
] as const

/** States that carry clinical meaning and are practitioner-owned. */
export const PRACTITIONER_ONLY_PROVENANCE = [
  'practitioner_verified', 'corrected', 'practitioner_interpreted',
] as const

export function isPractitionerOnlyProvenance(p: V2Provenance): boolean {
  return (PRACTITIONER_ONLY_PROVENANCE as readonly string[]).includes(p)
}

/** True only for a real client-supplied answer. `not_asked`, `missing`,
 *  `declined` and `unconfirmed` all return false — none of them is a "no". */
export function isAffirmativeClientAnswer(fact: V2SourcedFact<unknown>): boolean {
  if (fact.provenance !== 'client_reported' && fact.provenance !== 'corrected'
      && fact.provenance !== 'practitioner_verified' && fact.provenance !== 'documented_record') {
    return false
  }
  return fact.value !== null && fact.value !== undefined && fact.value !== ''
}

export type V2Provenance = (typeof V2_PROVENANCE_STATES)[number]

export interface V2Correction<T = unknown> {
  /** The practitioner's correction — displayed beside the original, never over it. */
  value: T
  actor: string
  at: string // ISO timestamp
}

export interface V2SourcedFact<T = unknown> {
  /** The client's original answer, verbatim. Never mutated. */
  value: T
  provenance: V2Provenance
  correction?: V2Correction<T>
  verifiedBy?: string
  verifiedAt?: string
  /** Where a documented value came from (report id, document ref). */
  sourceRef?: string
  /** The client's own words, kept whenever NI imposed structure on them. */
  originalWording?: string
  /** When the fact was captured — drives "when" in the provenance answer. */
  capturedAt?: string
  /** Practitioner interpretation sits BESIDE the fact, never replacing it. */
  interpretation?: V2Interpretation
}

/** A practitioner's reading of a fact. Separate object so a factual surface
 *  can render the fact while deliberately omitting the interpretation. */
export interface V2Interpretation {
  text: string
  practitionerId: string
  at: string
}

/** Attach practitioner interpretation without touching the underlying fact.
 *  The fact's own provenance is preserved — interpretation is additive. */
export function interpretFact<T>(
  fact: V2SourcedFact<T>, text: string, practitionerId: string, at: string,
): V2SourcedFact<T> {
  return { ...fact, interpretation: { text, practitionerId, at } }
}

export function clientReported<T>(value: T): V2SourcedFact<T> {
  return { value, provenance: 'client_reported' }
}

export function missingFact<T = string>(): V2SourcedFact<T | null> {
  return { value: null, provenance: 'missing' }
}

/** A question this client's branches never opened. Distinct from `missing`
 *  (asked, unanswered) and emphatically distinct from a negative answer. */
export function notAsked<T = string>(): V2SourcedFact<T | null> {
  return { value: null, provenance: 'not_asked' }
}

/** The client preferred to discuss this with a person. Never a refusal to
 *  record, and never a negative answer. */
export function declined<T = string>(): V2SourcedFact<T | null> {
  return { value: null, provenance: 'declined' }
}

/** A value taken from a document or record rather than reported in conversation. */
export function documentedRecord<T>(value: T, sourceRef?: string): V2SourcedFact<T> {
  return { value, provenance: 'documented_record', ...(sourceRef ? { sourceRef } : {}) }
}

/** NI grouped or ordered existing client facts. No new meaning is added. */
export function systemOrganised<T>(value: T): V2SourcedFact<T> {
  return { value, provenance: 'system_organised' }
}

/** NI gave structure to something the client said, preserving their words.
 *  `originalWording` is required precisely so the client's phrasing survives. */
export function systemStructuredFromClientLanguage<T>(
  value: T, originalWording: string,
): V2SourcedFact<T> {
  return {
    value,
    provenance: 'system_structured_from_client_language',
    originalWording,
  }
}

/** Practitioner verification: marks the fact verified without changing the
 *  client's value. */
export function verifyFact<T>(fact: V2SourcedFact<T>, actor: string, at: string): V2SourcedFact<T> {
  return { ...fact, provenance: 'practitioner_verified', verifiedBy: actor, verifiedAt: at }
}

/** Practitioner correction: the original client value is kept verbatim; the
 *  correction sits beside it with actor and time (the audit trail). */
export function correctFact<T>(
  fact: V2SourcedFact<T>, correctedValue: T, actor: string, at: string,
): V2SourcedFact<T> {
  return {
    ...fact, // fact.value — the original — is carried forward untouched
    provenance: 'corrected',
    correction: { value: correctedValue, actor, at },
  }
}
