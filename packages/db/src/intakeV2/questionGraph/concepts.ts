// ─── packages/db/src/intakeV2/questionGraph/concepts.ts ─────────────────────
// The canonical CONCEPT layer: the genuinely distinct things NI asks or
// records, beneath the 384 registry fields.
//
// WHY THIS EXISTS
//
// 384 is a count of storage locations, not of questions. Two generated
// matrices account for more than half of it: family history is 16 categories
// asked about 9 relatives (144 fields), and the systems review is 12 systems
// with 5 capture aspects each (60 fields). Treating those as 204 distinct
// concepts would badly misdescribe what NI actually asks.
//
// HOW IT IS BUILT
//
// Derived from V2_FIELD_REGISTRY at module load, by explicit collapse rules
// below — not hand-authored. A hand-written concept list would drift from the
// registry the first time a field changed, and the registry is the thing that
// must stay authoritative. The registry is read, never modified.
//
// The derivation is deterministic: same registry in, same concepts out.

import { V2_FIELD_REGISTRY, type V2FieldDef, type V2FieldDomain } from '../fieldRegistry'

/** How the fields under one concept relate to each other. */
export type ConceptRelation =
  /** One underlying fact, asked separately about several subjects
   *  (each relative, each body system). */
  | 'context_variant'
  /** One attribute of an entity the client may list more than once
   *  (each medication, each concern). */
  | 'repeated_capture'
  /** Not a question: a record of HOW capture went — nothing reported,
   *  prompt shown, free text offered. */
  | 'provenance_state'
  /** Genuinely its own fact. */
  | 'separate_fact'
  /** Two field IDs that mean the same thing. None are currently detected;
   *  the kind exists so a future duplicate is nameable rather than silently
   *  collapsed into something else. */
  | 'duplicate_representation'

export interface ConceptDef {
  /** Stable identifier. Derived from the field pattern, with enumerated
   *  dimensions replaced by '*', e.g. 'family.*.cancer'. */
  id: string
  /** Human-readable name. */
  name: string
  /** What the concept means, in plain English. */
  meaning: string
  domain: V2FieldDomain
  relation: ConceptRelation
  /** Every registry field ID that collapses into this concept. */
  fieldIds: string[]
  /** The enumerated dimension values, where the concept is a context
   *  variant: which relatives, which systems. */
  variants: string[]
  /** True when this concept is a capture-state record rather than something
   *  a person is asked. */
  isCaptureState: boolean
}

/** Capture-state suffixes: these record how asking went, not an answer. */
const CAPTURE_STATE = /\.(none_reported|missing_prompt|free_text|not_sure|prefer_not_to_say|declined)$/

/** Enumerated-dimension domains: one question asked across many subjects.
 *  The dimension sits at a known position in the field ID. */
const ENUMERATED: Partial<Record<V2FieldDomain, { dimensionIndex: number; label: string }>> = {
  // intake.family.<relative>.<category>
  family: { dimensionIndex: 2, label: 'relative' },
  // intake.systems.<system>.<aspect>
  systems: { dimensionIndex: 2, label: 'system' },
}

function titleise(segment: string): string {
  return segment
    .replace(/\[n\]/g, '')
    .split(/[._]/)
    .filter(Boolean)
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ')
}

interface Collapsed { key: string; relation: ConceptRelation; variant: string | null }

function collapse(field: V2FieldDef): Collapsed {
  const enumerated = ENUMERATED[field.domain]
  if (enumerated) {
    const parts = field.id.split('.')
    const variant = parts[enumerated.dimensionIndex]
    const key = parts.map((p, i) => (i === enumerated.dimensionIndex ? '*' : p)).join('.')
    return { key, relation: 'context_variant', variant }
  }
  if (field.id.includes('[n]')) {
    return { key: field.id.replace('[n]', ''), relation: 'repeated_capture', variant: null }
  }
  return { key: field.id, relation: 'separate_fact', variant: null }
}

function buildConcepts(registry: readonly V2FieldDef[]): ConceptDef[] {
  const byKey = new Map<string, ConceptDef>()

  for (const field of registry) {
    const { key, relation, variant } = collapse(field)
    let concept = byKey.get(key)

    if (!concept) {
      const isCaptureState = CAPTURE_STATE.test(key)
      concept = {
        id: key,
        name: titleise(key.split('.').slice(-1)[0]) || key,
        // The registry's own label is the best available plain-English
        // meaning. Generated fields share a label across variants, which is
        // exactly why they collapse together.
        meaning: field.label,
        domain: field.domain,
        relation: isCaptureState ? 'provenance_state' : relation,
        fieldIds: [],
        variants: [],
        isCaptureState,
      }
      byKey.set(key, concept)
    }

    concept.fieldIds.push(field.id)
    if (variant && !concept.variants.includes(variant)) concept.variants.push(variant)
  }

  return [...byKey.values()].sort((a, b) => a.id.localeCompare(b.id))
}

/** The derived concept layer. Read-only. */
export const CONCEPT_LAYER: readonly ConceptDef[] = Object.freeze(buildConcepts(V2_FIELD_REGISTRY))

export function conceptById(id: string): ConceptDef | undefined {
  return CONCEPT_LAYER.find((c) => c.id === id)
}

/** Which concept a given registry field belongs to. */
export function conceptForField(fieldId: string): ConceptDef | undefined {
  return CONCEPT_LAYER.find((c) => c.fieldIds.includes(fieldId))
}

/** Concepts that represent something a person is actually asked, excluding
 *  capture-state records. This is the honest "how many questions could NI
 *  ask" number. */
export function questionBearingConcepts(): ConceptDef[] {
  return CONCEPT_LAYER.filter((c) => !c.isCaptureState)
}

export interface ConceptLayerSummary {
  registryFields: number
  concepts: number
  questionBearingConcepts: number
  captureStateConcepts: number
  byRelation: Record<ConceptRelation, number>
  byDomain: Record<string, { fields: number; concepts: number }>
}

export function summariseConceptLayer(): ConceptLayerSummary {
  const byRelation = {
    context_variant: 0, repeated_capture: 0, provenance_state: 0,
    separate_fact: 0, duplicate_representation: 0,
  } as Record<ConceptRelation, number>
  const byDomain: Record<string, { fields: number; concepts: number }> = {}

  for (const c of CONCEPT_LAYER) {
    byRelation[c.relation] += 1
    byDomain[c.domain] ??= { fields: 0, concepts: 0 }
    byDomain[c.domain].concepts += 1
    byDomain[c.domain].fields += c.fieldIds.length
  }

  return {
    registryFields: V2_FIELD_REGISTRY.length,
    concepts: CONCEPT_LAYER.length,
    questionBearingConcepts: questionBearingConcepts().length,
    captureStateConcepts: CONCEPT_LAYER.filter((c) => c.isCaptureState).length,
    byRelation,
    byDomain,
  }
}
