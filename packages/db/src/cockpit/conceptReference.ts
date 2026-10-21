// ─── packages/db/src/cockpit/conceptReference.ts ────────────────────────────
// CONCEPT REFERENCE = conceptId + required variant where parameterised.
//
// ── THE PROBLEM THIS CLOSES ─────────────────────────────────────────────────
//
// The concept layer collapses enumerated dimensions to `*`, so Digestion,
// Sleep and Energy all resolve to `intake.systems.*.symptoms`. The concept id
// alone is therefore NOT a semantic identity: three body systems share it.
//
// A grouping, mapping, Graph Explorer display, validation pass or Synopsis
// rule that keyed on the concept id would merge three systems into one and
// report a client's digestive symptoms under sleep.
//
// ── THE FIX, AND WHAT IT IS NOT ─────────────────────────────────────────────
//
// The concept TEMPLATE model is preserved exactly as it is — the concept
// count does not rise by cloning `intake.systems.*.symptoms` into twelve
// per-system concepts. What changes is that a REFERENCE to a parameterised
// concept is invalid without its variant, and the type system enforces it:
// `ConceptReference.variant` is `string | null`, and every constructor
// refuses to produce a reference with a null variant for a parameterised
// concept.
//
// Equality is on the pair. `sameConcept()` compares both, so nothing can
// accidentally treat two variants of one template as interchangeable.

import { conceptById, conceptForField } from '../intakeV2/questionGraph/concepts'

/** A concept id is parameterised when it carries an enumerated dimension. */
export function isParameterised(conceptId: string): boolean {
  return conceptId.includes('*')
}

export interface ConceptReference {
  conceptId: string
  /** REQUIRED where the concept is parameterised. Null only for concepts
   *  that carry no enumerated dimension at all. */
  variant: string | null
}

export type ConceptReferenceResult =
  | { ok: true; ref: ConceptReference }
  | { ok: false; reason: 'unknown_concept' | 'variant_required' | 'variant_not_valid_for_concept' | 'variant_not_applicable'; detail: string }

/**
 * Build a reference, refusing anything semantically incomplete.
 *
 * Fail-closed in both directions: a parameterised concept without a variant
 * is refused, and a variant that the concept does not actually have is
 * refused too — the second catches a plausible-looking but wrong system key,
 * which is exactly the mistake a label-based assumption produces.
 */
export function conceptReference(conceptId: string, variant?: string | null): ConceptReferenceResult {
  const concept = conceptById(conceptId)
  if (!concept) {
    return { ok: false, reason: 'unknown_concept', detail: `No concept ${conceptId} in the layer.` }
  }

  if (isParameterised(conceptId)) {
    if (!variant) {
      return {
        ok: false, reason: 'variant_required',
        detail:
          `${conceptId} is parameterised and shared by ${concept.variants.length} variant(s) ` +
          `(${concept.variants.join(', ')}). A reference without one is ambiguous.`,
      }
    }
    if (!concept.variants.includes(variant)) {
      return {
        ok: false, reason: 'variant_not_valid_for_concept',
        detail: `“${variant}” is not a variant of ${conceptId}. Valid: ${concept.variants.join(', ')}.`,
      }
    }
    return { ok: true, ref: { conceptId, variant } }
  }

  if (variant) {
    return {
      ok: false, reason: 'variant_not_applicable',
      detail: `${conceptId} carries no enumerated dimension, so “${variant}” means nothing here.`,
    }
  }
  return { ok: true, ref: { conceptId, variant: null } }
}

/**
 * The reference a canonical field resolves to.
 *
 * Derives the variant from the field id itself rather than from any label, so
 * `intake.systems.digestive.symptoms` cannot resolve to the sleep variant
 * however the product section is named.
 */
export function conceptReferenceForField(fieldId: string): ConceptReferenceResult {
  const concept = conceptForField(fieldId)
  if (!concept) {
    return { ok: false, reason: 'unknown_concept', detail: `No concept resolves field ${fieldId}.` }
  }
  if (!isParameterised(concept.id)) return { ok: true, ref: { conceptId: concept.id, variant: null } }

  // The variant is the field segment the concept replaced with '*'.
  const pattern = concept.id.split('.')
  const actual = fieldId.split('.')
  const index = pattern.findIndex((p) => p === '*')
  const variant = index >= 0 ? actual[index] : undefined
  return conceptReference(concept.id, variant)
}

/** A stable key for a reference. Includes the variant, always. */
export function conceptRefKey(ref: ConceptReference): string {
  return ref.variant ? `${ref.conceptId}#${ref.variant}` : ref.conceptId
}

/**
 * Semantic equality.
 *
 * Two references to the same parameterised concept with different variants
 * are NOT the same thing, and this is the function that says so.
 */
export function sameConcept(a: ConceptReference, b: ConceptReference): boolean {
  return a.conceptId === b.conceptId && a.variant === b.variant
}

/** Group by full reference, never by concept id alone. */
export function groupByConceptReference<T>(
  items: readonly T[], refOf: (item: T) => ConceptReference,
): Map<string, { ref: ConceptReference; items: T[] }> {
  const out = new Map<string, { ref: ConceptReference; items: T[] }>()
  for (const item of items) {
    const ref = refOf(item)
    const key = conceptRefKey(ref)
    const existing = out.get(key)
    if (existing) existing.items.push(item)
    else out.set(key, { ref, items: [item] })
  }
  return out
}

/** Human-readable, for the review surface. */
export function describeConceptReference(ref: ConceptReference): string {
  return ref.variant ? `${ref.conceptId} (variant: ${ref.variant})` : ref.conceptId
}
