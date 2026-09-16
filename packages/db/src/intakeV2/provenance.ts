// ─── packages/db/src/intakeV2/provenance.ts ───────────────────────────────────
// Global provenance convention for every factual field in the Intake V2 →
// Synopsis architecture (KR-approved Field Mapping v1).
//
// Every factual field supports exactly four provenance states. The client's
// original answer is preserved VERBATIM for the life of the record: a
// practitioner correction is recorded BESIDE it with actor and time, and can
// never overwrite it. This module is pure data + pure functions — no DB, no
// interpretation.

export const V2_PROVENANCE_STATES = [
  'client_reported',
  'practitioner_verified',
  'corrected',
  'missing',
] as const

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
}

export function clientReported<T>(value: T): V2SourcedFact<T> {
  return { value, provenance: 'client_reported' }
}

export function missingFact<T = string>(): V2SourcedFact<T | null> {
  return { value: null, provenance: 'missing' }
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
