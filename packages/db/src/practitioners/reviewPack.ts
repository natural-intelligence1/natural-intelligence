// ─── packages/db/src/practitioners/reviewPack.ts ──────────────────────────────
// Sprint 3 — de-identified practitioner review pack builder.
//
// PURE and deterministic (unit-tested): takes an identified intake summary and
// produces the pseudonymous pack a practitioner is allowed to see. Design is
// DEFAULT-DENY, and (review amendment 5) NO raw or verbatim free text passes
// through at all:
//   • structured scores/booleans/enums/tag-lists pass unchanged;
//   • clinically necessary list fields (medications, supplements, diagnosed
//     conditions) are TRANSFORMED into short structured items — any item long
//     enough to carry narrative or contextual identification is withheld
//     item-by-item (rare/verbose condition names included);
//   • symptomOnset is kept only when it matches a short duration-like shape;
//   • dietDescription and ALL other prose narrative is suppressed outright;
//   • anything not explicitly listed is suppressed.
// Practitioner-facing output is pseudonymous personal health data, NOT
// anonymous — NI retains attribution and audit internally (review_pack_audit).

export interface ReviewPack {
  pseudonym: string
  packVersion: 1
  /** Structured, clinically necessary, de-identified content. */
  clinical: Record<string, unknown>
  /** Source fields transformed into a safer structured form. */
  transformedFields: string[]
  /** Source fields withheld entirely (narrative/identifying by default). */
  suppressedFields: string[]
  note: string
}

export const ITEM_WITHHELD = '[item withheld]'

// Second review, item 6: "structured" is enforced by TYPE and SHAPE, not
// trust. Numeric and boolean fields pass only with the right primitive type;
// string fields that SHOULD be fixed options (arrivalEmotion, primarySystem)
// and tag lists (primaryConcerns) are normalised through the same short-token
// rule as everything else, so user-entered free text cannot leak through a
// field we expected to be an enum.
const NUMERIC_ALLOW  = ['stressLevel', 'sleepQuality', 'energyLevel', 'concernSeverity'] as const
const BOOLEAN_ALLOW  = ['postExertionalWorsening'] as const
const TOKEN_ALLOW    = ['arrivalEmotion', 'primarySystem'] as const
const TOKEN_LIST_ALLOW = ['primaryConcerns'] as const

/** A single fixed-option-shaped token: ≤3 words, ≤30 chars, no identifiers. */
export function toSafeToken(raw: unknown): string {
  const s = String(raw).trim()
  const scrubbed = scrubIdentifiers(s)
  const words = scrubbed.split(/\s+/).filter(Boolean).length
  if (scrubbed !== s || words > 3 || scrubbed.length > 30 || scrubbed.length === 0) return ITEM_WITHHELD
  return scrubbed
}

/** Clinically necessary LIST fields — transformed to short structured items. */
const LIST_TRANSFORM = ['currentMedications', 'currentSupplements', 'diagnosedConditions'] as const

/** Kept only when it matches a short duration-like shape (e.g. "about two years ago"). */
const DURATION_FIELD = 'symptomOnset'

/**
 * Strips direct identifiers from text: emails, phone-like and long digit
 * sequences (NHS numbers etc.), URLs and @handles.
 */
export function scrubIdentifiers(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email removed]')
    .replace(/(?:\+?\d[\s-]?){9,15}\d/g, '[number removed]')
    .replace(/\b\d{6,}\b/g, '[number removed]')
    .replace(/https?:\/\/\S+/gi, '[link removed]')
    .replace(/@[A-Za-z0-9_]{3,}/g, '[handle removed]')
}

/**
 * Transforms a free-text list ("magnesium, vit D; prescribed by Dr X…") into
 * short structured items. An item survives only if, after identifier
 * scrubbing, it is ≤4 words, ≤40 characters and carried no scrubbed
 * identifier — anything longer is narrative/contextual and is withheld
 * item-by-item. This is what makes rare, verbose or story-carrying entries
 * (including rare condition descriptions) drop out.
 */
export function toShortItems(raw: string | string[]): string[] {
  const parts = Array.isArray(raw)
    ? raw.map(String)
    : String(raw).split(/[,;\n]+/)
  return parts
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p) => {
      const scrubbed = scrubIdentifiers(p)
      const wordCount = scrubbed.split(/\s+/).filter(Boolean).length
      const hadIdentifier = scrubbed !== p
      if (hadIdentifier || wordCount > 4 || scrubbed.length > 40) return ITEM_WITHHELD
      return scrubbed
    })
}

/** True when a scrubbed onset string is a short duration-like phrase. */
export function isShortDuration(raw: string): boolean {
  const scrubbed = scrubIdentifiers(raw.trim())
  if (scrubbed !== raw.trim()) return false
  const words = scrubbed.split(/\s+/).filter(Boolean).length
  return words <= 6 && scrubbed.length <= 40
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
 * DEFAULT-DENY: every key on `summary` that is not explicitly allow-listed or
 * transform-listed is suppressed — narrative free text (mostWantToUnderstand,
 * timelines, Best Self, diet description) is therefore withheld by default
 * and only releasable later on explicit clinical justification.
 */
export function buildReviewPack(
  caseId: string,
  summary: Record<string, unknown>,
): ReviewPack {
  const clinical: Record<string, unknown> = {}
  const transformed: string[] = []
  const suppressed: string[] = []

  for (const [key, value] of Object.entries(summary)) {
    if (value === null || value === undefined) continue
    if ((NUMERIC_ALLOW as readonly string[]).includes(key)) {
      if (typeof value === 'number' && Number.isFinite(value)) clinical[key] = value
      else suppressed.push(key)   // wrong type = untrusted shape → suppress
    } else if ((BOOLEAN_ALLOW as readonly string[]).includes(key)) {
      if (typeof value === 'boolean') clinical[key] = value
      else suppressed.push(key)
    } else if ((TOKEN_ALLOW as readonly string[]).includes(key)) {
      clinical[key] = toSafeToken(value)
      transformed.push(key)
    } else if ((TOKEN_LIST_ALLOW as readonly string[]).includes(key)) {
      const items = Array.isArray(value) ? value : [value]
      clinical[key] = items.map(toSafeToken)
      transformed.push(key)
    } else if ((LIST_TRANSFORM as readonly string[]).includes(key)) {
      clinical[key] = toShortItems(value as string | string[])
      transformed.push(key)
    } else if (key === DURATION_FIELD && typeof value === 'string') {
      if (isShortDuration(value)) {
        clinical[key] = value.trim()
        transformed.push(key)
      } else {
        suppressed.push(key)
      }
    } else {
      suppressed.push(key)
    }
  }

  return {
    pseudonym: makePseudonym(caseId),
    packVersion: 1,
    clinical,
    transformedFields: transformed.sort(),
    suppressedFields: suppressed.sort(),
    note:
      'De-identified review pack. No verbatim free text is included: list ' +
      'fields are reduced to short structured items and narrative is withheld ' +
      'by default — request via NI where clinically necessary. Pseudonymous, ' +
      'not anonymous — Natural Intelligence retains attribution internally.',
  }
}
