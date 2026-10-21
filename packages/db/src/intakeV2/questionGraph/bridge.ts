// ─── packages/db/src/intakeV2/questionGraph/bridge.ts ───────────────────────
// QUESTION ID ↔ CONCEPT ID ↔ FIELD ID.
//
// THE SITUATION THIS MODELS
//
// NI has two independently-authored id spaces that have never met:
//
//   · 115 questions (V2_QUESTIONS), ids like 'v2.about.dob', whose answers
//     are persisted keyed by question_id;
//   · 387 canonical fields (V2_FIELD_REGISTRY), ids like 'profile.dob',
//     used for synopsis layout and care-team scoping.
//
// V2QuestionDef has no fieldId and nothing in the codebase translates between
// them. So today every question is an orphan and every field is an orphan.
//
// THE RULE THIS MODULE ENFORCES ON ITSELF
//
// Unknown stays unknown. BRIDGE_ENTRIES below is deliberately empty: not one
// mapping is asserted, because not one has been authored or approved. A
// name-similarity heuristic could populate perhaps 21 of 115, and every one
// would be a guess wearing the costume of a fact.
//
// Instead, `suggestedByName()` reports likely correspondences SEPARATELY and
// explicitly labelled as unverified. Nothing merges suggestions into the
// bridge. That separation is the entire point of the module: a future Intake
// can ask what is known, what is suspected, and what is unknown, and get
// three different answers.

import { V2_QUESTIONS } from '../registry'
import { V2_FIELD_REGISTRY } from '../fieldRegistry'
import { CONCEPT_LAYER, conceptForField, type ConceptDef } from './concepts'

export type BridgeConfidence =
  /** Authored and approved. Safe to rely on. */
  | 'mapped'
  /** Some fields of the concept are mapped, others are not. */
  | 'partial'
  /** Known to need a decision no one has taken. */
  | 'unresolved'

export interface BridgeEntry {
  questionId: string
  conceptId: string
  /** A question may legitimately populate more than one field. */
  fieldIds: string[]
  confidence: BridgeConfidence
  /** Why this mapping is asserted. Required: an unexplained mapping is a
   *  guess that has been allowed to look official. */
  basis: string
}

/**
 * The authored bridge. EMPTY BY DESIGN.
 *
 * Populating this is a product and clinical-governance decision, not a
 * code-generation task. When entries are added each needs a `basis` saying
 * who decided and on what grounds.
 */
export const BRIDGE_ENTRIES: readonly BridgeEntry[] = Object.freeze([])

// ── Suggestions, kept strictly separate from the bridge ────────────────────

export interface BridgeSuggestion {
  questionId: string
  /** Candidate fields sharing the question's trailing name segment. */
  candidateFieldIds: string[]
  conceptIds: string[]
  /** Always 'name_similarity'. Never promoted to a mapping automatically. */
  basis: 'name_similarity'
}

const tailOf = (id: string): string => id.split('.').slice(-1)[0].replace('[n]', '')

/**
 * Likely correspondences by trailing name segment, e.g. 'v2.about.dob' and
 * 'profile.dob'. UNVERIFIED. Advisory input for whoever authors the bridge;
 * never a substitute for them.
 */
export function suggestedByName(): BridgeSuggestion[] {
  const byTail = new Map<string, string[]>()
  for (const f of V2_FIELD_REGISTRY) {
    const t = tailOf(f.id)
    byTail.set(t, [...(byTail.get(t) ?? []), f.id])
  }

  const out: BridgeSuggestion[] = []
  for (const q of V2_QUESTIONS) {
    const candidates = byTail.get(tailOf(q.id))
    if (!candidates?.length) continue
    const conceptIds = [...new Set(
      candidates.map((f) => conceptForField(f)?.id).filter((x): x is string => !!x),
    )]
    out.push({ questionId: q.id, candidateFieldIds: candidates, conceptIds, basis: 'name_similarity' })
  }
  return out
}

// ── Coverage ───────────────────────────────────────────────────────────────

export interface BridgeCoverage {
  questions: number
  fields: number
  concepts: number
  /** Questions with at least one authored mapping. */
  mappedQuestions: number
  partiallyMappedQuestions: number
  /** Questions with no authored mapping at all. */
  orphanQuestions: number
  /** Fields no authored mapping reaches. */
  orphanFields: number
  /** Concepts no authored mapping reaches. */
  orphanConcepts: number
  /** Explicitly flagged as needing a decision. */
  unresolved: number
  /** Unverified name correspondences — NOT mappings. */
  nameSuggestions: number
}

export function bridgeCoverage(): BridgeCoverage {
  const mappedQ = new Set(BRIDGE_ENTRIES.filter((e) => e.confidence === 'mapped').map((e) => e.questionId))
  const partialQ = new Set(BRIDGE_ENTRIES.filter((e) => e.confidence === 'partial').map((e) => e.questionId))
  const mappedF = new Set(BRIDGE_ENTRIES.flatMap((e) => e.fieldIds))
  const mappedC = new Set(BRIDGE_ENTRIES.map((e) => e.conceptId))

  return {
    questions: V2_QUESTIONS.length,
    fields: V2_FIELD_REGISTRY.length,
    concepts: CONCEPT_LAYER.length,
    mappedQuestions: mappedQ.size,
    partiallyMappedQuestions: partialQ.size,
    orphanQuestions: V2_QUESTIONS.filter((q) => !mappedQ.has(q.id) && !partialQ.has(q.id)).length,
    orphanFields: V2_FIELD_REGISTRY.filter((f) => !mappedF.has(f.id)).length,
    orphanConcepts: CONCEPT_LAYER.filter((c) => !mappedC.has(c.id)).length,
    unresolved: BRIDGE_ENTRIES.filter((e) => e.confidence === 'unresolved').length,
    nameSuggestions: suggestedByName().length,
  }
}

export function orphanQuestionIds(): string[] {
  const reached = new Set(BRIDGE_ENTRIES.map((e) => e.questionId))
  return V2_QUESTIONS.filter((q) => !reached.has(q.id)).map((q) => q.id)
}

export function orphanFieldIds(): string[] {
  const reached = new Set(BRIDGE_ENTRIES.flatMap((e) => e.fieldIds))
  return V2_FIELD_REGISTRY.filter((f) => !reached.has(f.id)).map((f) => f.id)
}

export function orphanConcepts(): ConceptDef[] {
  const reached = new Set(BRIDGE_ENTRIES.map((e) => e.conceptId))
  return CONCEPT_LAYER.filter((c) => !reached.has(c.id))
}
