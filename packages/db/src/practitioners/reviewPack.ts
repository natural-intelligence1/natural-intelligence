// ─── packages/db/src/practitioners/reviewPack.ts ──────────────────────────────
// Sprint 3 — de-identified practitioner review pack builder.
//
// PURE and deterministic (unit-tested): takes an identified intake summary and
// produces the pseudonymous pack a practitioner is allowed to see. Design is
// DEFAULT-DENY: any field not explicitly allow-listed is suppressed and
// recorded in suppressedFields. Practitioner-facing output is pseudonymous
// personal health data, NOT anonymous — NI retains attribution and audit
// internally (case_id / source_intake_id on practitioner_review_packs).

export interface ReviewPack {
  pseudonym: string
  packVersion: 1
  /** Structured, clinically necessary, identifier-scrubbed content. */
  clinical: Record<string, unknown>
  /** Names of source fields withheld (narrative/identifying by default). */
  suppressedFields: string[]
  note: string
}

/** Fields passed through unchanged: scores, booleans, enums, clinical tag lists. */
const STRUCTURED_ALLOW = [
  'arrivalEmotion', 'primaryConcerns', 'primarySystem', 'stressLevel',
  'sleepQuality', 'energyLevel', 'concernSeverity', 'postExertionalWorsening',
  'diagnosedConditions',
] as const

/** Clinically necessary short text — kept, but identifier-scrubbed. */
const SCRUBBED_TEXT_ALLOW = [
  'dietDescription', 'currentMedications', 'currentSupplements', 'symptomOnset',
] as const

/**
 * Strips direct identifiers from clinically necessary text: emails, phone-like
 * and long digit sequences (NHS numbers etc.), URLs and @handles.
 */
export function scrubIdentifiers(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email removed]')
    .replace(/(?:\+?\d[\s-]?){9,15}\d/g, '[number removed]')
    .replace(/\b\d{6,}\b/g, '[number removed]')
    .replace(/https?:\/\/\S+/gi, '[link removed]')
    .replace(/@[A-Za-z0-9_]{3,}/g, '[handle removed]')
}

/** Deterministic pseudonymous case reference, e.g. "NI-4F7A2C". Never a name. */
export function makePseudonym(caseId: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < caseId.length; i++) {
    h ^= caseId.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return 'NI-' + h.toString(16).toUpperCase().padStart(8, '0').slice(0, 6)
}

/**
 * Builds the de-identified pack from an identified summary object.
 * DEFAULT-DENY: every key on `summary` that is not on an allow-list is
 * suppressed. Narrative free text (e.g. mostWantToUnderstand, timeline
 * narratives, Best Self answers) is therefore withheld by default and only
 * releasable later on explicit clinical justification.
 */
export function buildReviewPack(
  caseId: string,
  summary: Record<string, unknown>,
): ReviewPack {
  const clinical: Record<string, unknown> = {}
  const suppressed: string[] = []

  for (const [key, value] of Object.entries(summary)) {
    if (value === null || value === undefined) continue
    if ((STRUCTURED_ALLOW as readonly string[]).includes(key)) {
      clinical[key] = value
    } else if ((SCRUBBED_TEXT_ALLOW as readonly string[]).includes(key)) {
      clinical[key] = typeof value === 'string' ? scrubIdentifiers(value) : value
    } else {
      suppressed.push(key)
    }
  }

  return {
    pseudonym: makePseudonym(caseId),
    packVersion: 1,
    clinical,
    suppressedFields: suppressed.sort(),
    note:
      'De-identified review pack. Narrative and demographic detail is withheld ' +
      'by default; request via NI where clinically necessary. Pseudonymous, not ' +
      'anonymous — Natural Intelligence retains attribution internally.',
  }
}
