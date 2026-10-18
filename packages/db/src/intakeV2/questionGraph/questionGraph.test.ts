// Question graph integrity. Pure and deterministic — no database, no network.
//
// Two kinds of test here, and the difference matters:
//
//   · INTEGRITY tests assert things that must always hold (no duplicate ids,
//     no edge pointing at a question that does not exist). These should never
//     fail, and if they do something is genuinely broken.
//
//   · POSITION tests record what is currently true and incomplete — that no
//     bridge mapping exists, that 384 fields carry no lawful basis. They are
//     written to FAIL when the position improves, so that closing a gap
//     forces someone to come here and acknowledge it rather than letting it
//     pass silently. Each says so where it could otherwise look like a bug.

import { describe, it, expect } from 'vitest'
import { V2_QUESTIONS, V2_SECTIONS } from '../registry'
import { V2_FIELD_REGISTRY } from '../fieldRegistry'
import {
  CONCEPT_LAYER, conceptForField, questionBearingConcepts, summariseConceptLayer,
  BRIDGE_ENTRIES, suggestedByName, bridgeCoverage, orphanQuestionIds, orphanFieldIds,
  recordedEdges, classifyQuestions, diggingStatus, summariseGraph,
  fieldGovernanceGaps, questionGovernanceGaps, summariseGovernance, GOVERNANCE_REQUIREMENTS,
} from './index'

// ── Concept layer integrity ───────────────────────────────────────────────

describe('concept layer', () => {
  it('has no duplicate concept ids', () => {
    const ids = CONCEPT_LAYER.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('accounts for every registry field exactly once', () => {
    const mapped = CONCEPT_LAYER.flatMap((c) => c.fieldIds)
    expect(mapped.length).toBe(V2_FIELD_REGISTRY.length)
    expect(new Set(mapped).size).toBe(V2_FIELD_REGISTRY.length)
  })

  it('references only field ids that exist', () => {
    const real = new Set(V2_FIELD_REGISTRY.map((f) => f.id))
    for (const c of CONCEPT_LAYER) for (const f of c.fieldIds) expect(real.has(f)).toBe(true)
  })

  it('maps every field back to exactly one concept', () => {
    for (const f of V2_FIELD_REGISTRY) expect(conceptForField(f.id)?.id).toBeDefined()
  })

  it('collapses fewer concepts than fields — the point of the layer', () => {
    const s = summariseConceptLayer()
    expect(s.registryFields).toBe(384)
    expect(s.concepts).toBeLessThan(s.registryFields)
  })

  it('collapses the family matrix to its categories, not its relatives', () => {
    const family = CONCEPT_LAYER.filter((c) => c.domain === 'family')
    // 9 relatives x 16 categories = 144 fields, but only 16 things asked.
    expect(family.length).toBe(16)
    expect(family.every((c) => c.variants.length === 9)).toBe(true)
    expect(family.flatMap((c) => c.fieldIds).length).toBe(144)
  })

  it('collapses the systems review to its aspects, not its systems', () => {
    const systems = CONCEPT_LAYER.filter((c) => c.domain === 'systems')
    expect(systems.length).toBe(5)
    expect(systems.every((c) => c.variants.length === 12)).toBe(true)
  })

  it('separates capture-state records from things a person is asked', () => {
    const s = summariseConceptLayer()
    expect(s.captureStateConcepts).toBeGreaterThan(0)
    expect(s.questionBearingConcepts).toBe(s.concepts - s.captureStateConcepts)
    expect(questionBearingConcepts().every((c) => !c.isCaptureState)).toBe(true)
  })

  it('every concept carries a meaning', () => {
    for (const c of CONCEPT_LAYER) expect(c.meaning.trim().length).toBeGreaterThan(0)
  })
})

// ── Bridge ────────────────────────────────────────────────────────────────

describe('question ↔ concept ↔ field bridge', () => {
  it('asserts no mapping that has not been authored', () => {
    // POSITION TEST. The bridge is empty by design: not one mapping has been
    // approved. When real entries are added this will fail — that is correct,
    // and the fix is to update the expectation deliberately.
    expect(BRIDGE_ENTRIES).toHaveLength(0)
  })

  it('every bridge entry, when there are any, references real ids and states a basis', () => {
    const questions = new Set(V2_QUESTIONS.map((q) => q.id))
    const fields = new Set(V2_FIELD_REGISTRY.map((f) => f.id))
    const concepts = new Set(CONCEPT_LAYER.map((c) => c.id))
    for (const e of BRIDGE_ENTRIES) {
      expect(questions.has(e.questionId)).toBe(true)
      expect(concepts.has(e.conceptId)).toBe(true)
      for (const f of e.fieldIds) expect(fields.has(f)).toBe(true)
      expect(e.basis.trim().length).toBeGreaterThan(0)
    }
  })

  it('reports every question and every field as an orphan, because they are', () => {
    expect(orphanQuestionIds()).toHaveLength(V2_QUESTIONS.length)
    expect(orphanFieldIds()).toHaveLength(V2_FIELD_REGISTRY.length)
  })

  it('keeps name suggestions strictly out of the bridge', () => {
    const suggestions = suggestedByName()
    expect(suggestions.length).toBeGreaterThan(0)          // they do exist
    expect(BRIDGE_ENTRIES).toHaveLength(0)                 // and are not mappings
    expect(suggestions.every((s) => s.basis === 'name_similarity')).toBe(true)
  })

  it('suggestions reference only real questions and fields', () => {
    const questions = new Set(V2_QUESTIONS.map((q) => q.id))
    const fields = new Set(V2_FIELD_REGISTRY.map((f) => f.id))
    for (const s of suggestedByName()) {
      expect(questions.has(s.questionId)).toBe(true)
      for (const f of s.candidateFieldIds) expect(fields.has(f)).toBe(true)
    }
  })

  it('coverage totals are internally consistent', () => {
    const c = bridgeCoverage()
    expect(c.questions).toBe(V2_QUESTIONS.length)
    expect(c.fields).toBe(V2_FIELD_REGISTRY.length)
    expect(c.concepts).toBe(CONCEPT_LAYER.length)
    expect(c.mappedQuestions + c.orphanQuestions).toBeLessThanOrEqual(c.questions)
  })
})

// ── Edges ─────────────────────────────────────────────────────────────────

describe('graph edges', () => {
  it('every recorded edge names a source question that exists', () => {
    const ids = new Set(V2_QUESTIONS.map((q) => q.id))
    for (const e of recordedEdges()) expect(ids.has(e.sourceQuestionId)).toBe(true)
  })

  it('every edge target exists', () => {
    const questions = new Set(V2_QUESTIONS.map((q) => q.id))
    const sections = new Set(V2_SECTIONS.map((s) => s.id))
    for (const e of recordedEdges()) {
      if (e.targetKind === 'question') expect(questions.has(e.targetId)).toBe(true)
      else expect(sections.has(e.targetId as never)).toBe(true)
    }
  })

  it('every edge carries a real condition', () => {
    for (const e of recordedEdges()) {
      const hasCondition = e.condition.equals !== undefined || (e.condition.includesAny?.length ?? 0) > 0
      expect(hasCondition).toBe(true)
    }
  })

  it('every recorded edge is marked recorded, never proposed', () => {
    expect(recordedEdges().every((e) => e.provenance === 'recorded')).toBe(true)
  })

  it('classifies every question exactly once', () => {
    const c = classifyQuestions()
    expect(c).toHaveLength(V2_QUESTIONS.length)
    expect(new Set(c.map((x) => x.questionId)).size).toBe(V2_QUESTIONS.length)
  })

  it('classification totals reconcile', () => {
    const s = summariseGraph()
    expect(s.foundational + s.conditional + s.triggered + s.digging).toBe(s.questions)
  })

  it('never classifies anything as DIGGING, and says why', () => {
    // POSITION TEST. Depth is not encoded, so inferring it would mean
    // inventing clinical follow-up relationships from wording.
    expect(summariseGraph().digging).toBe(0)
    const d = diggingStatus()
    expect(d.supported).toBe(false)
    expect(d.requiredToSupport.length).toBeGreaterThan(0)
  })

  it('records how few questions actually drive the branching', () => {
    // POSITION TEST, and the most useful number in the module: if this is a
    // very short list, the whole adaptive model rests on a handful of answers.
    const sources = summariseGraph().branchingSourceQuestions
    expect(sources.length).toBeLessThanOrEqual(5)
    expect(sources).toContain('v2.systems.noticed')
  })
})

// ── Governance ────────────────────────────────────────────────────────────

describe('governance metadata', () => {
  it('reports the gap rather than hiding it', () => {
    // POSITION TEST. All four requirements are missing on all 384 fields.
    // This test exists so that no one can make validation pass by supplying
    // a default lawful basis in code.
    const s = summariseGovernance()
    expect(s.complete).toBe(false)
    expect(s.fieldsWithAnyGap).toBe(384)
    for (const req of GOVERNANCE_REQUIREMENTS) {
      expect(s.fieldsMissingByRequirement[req]).toBe(384)
    }
  })

  it('flags health-bearing fields among the gaps', () => {
    expect(summariseGovernance().fieldsLikelySpecialCategoryWithGaps).toBeGreaterThan(0)
  })

  it('reports retentionCategory as declared but never populated', () => {
    // POSITION TEST. The key exists on V2QuestionDef and not one of the 115
    // questions sets it — which reads as implemented and is not.
    expect(summariseGovernance().questionsMissingRetentionCategory).toBe(V2_QUESTIONS.length)
  })

  it('does not count SaMD classification as governance metadata', () => {
    const s = summariseGovernance()
    expect(s.questionsWithSamd).toBe(V2_QUESTIONS.length)   // it is fully populated
    expect(s.complete).toBe(false)                           // and changes nothing
  })

  it('names exact field ids so the gap is actionable', () => {
    const gaps = fieldGovernanceGaps()
    expect(gaps.length).toBeGreaterThan(0)
    expect(gaps[0].fieldId).toMatch(/\w/)
    expect(gaps[0].missing.length).toBeGreaterThan(0)
  })

  it('names exact question ids too', () => {
    const gaps = questionGovernanceGaps()
    expect(gaps.length).toBeGreaterThan(0)
    expect(gaps.every((g) => g.questionId.startsWith('v2.'))).toBe(true)
  })
})
