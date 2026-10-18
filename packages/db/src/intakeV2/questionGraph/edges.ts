// ─── packages/db/src/intakeV2/questionGraph/edges.ts ────────────────────────
// The question graph: which questions open which others, and why.
//
// FOUR EDGE CLASSES, as specified:
//
//   FOUNDATIONAL  normally presented regardless of prior answers
//   CONDITIONAL   opens because a domain/system became relevant
//   TRIGGERED     follows one specific earlier answer
//   DIGGING       deeper exploration inside an already-open branch
//
// RECORDED vs PROPOSED is the distinction that matters most here. Every edge
// this module emits is RECORDED: read from an actual `showIf` in V2_SECTIONS
// or V2_QUESTIONS. Nothing is inferred.
//
// DIGGING is not derivable from current data. Depth within a branch is a
// design concept NI has not encoded — there is no parent-question field, no
// depth marker, nothing to read. Rather than guess which questions "feel"
// like follow-ups, the classifier reports UNRECORDED for it. That is the
// honest answer, and it is also the specification for what Intake needs to
// add later.

import { V2_QUESTIONS, V2_SECTIONS } from '../registry'
import type { V2QuestionDef, V2SectionDef, V2ShowIf } from '../types'

export type EdgeClass = 'foundational' | 'conditional' | 'triggered' | 'digging'

/** Whether an edge is read from data or merely believed. */
export type EdgeProvenance =
  /** Read from a real showIf in the registry. */
  | 'recorded'
  /** Believed to exist but not encoded. Never produced by this module from
   *  inference; the kind exists so humans can add proposals explicitly. */
  | 'proposed'

export interface GraphEdge {
  /** Question whose answer opens the target. */
  sourceQuestionId: string
  /** The condition, verbatim from the registry. */
  condition: { equals?: unknown; includesAny?: string[] }
  /** What opens: a question or a whole section. */
  targetKind: 'question' | 'section'
  targetId: string
  edgeClass: Extract<EdgeClass, 'conditional' | 'triggered'>
  provenance: EdgeProvenance
}

function conditionOf(showIf: V2ShowIf): GraphEdge['condition'] {
  return {
    ...(showIf.equals !== undefined ? { equals: showIf.equals } : {}),
    ...(showIf.includesAny ? { includesAny: [...showIf.includesAny] } : {}),
  }
}

/**
 * Every recorded edge in the current registry.
 *
 * Section-level edges are CONDITIONAL: a whole domain becomes relevant.
 * Question-level edges are TRIGGERED: one specific earlier answer.
 */
export function recordedEdges(): GraphEdge[] {
  const edges: GraphEdge[] = []

  for (const section of V2_SECTIONS as readonly V2SectionDef[]) {
    if (!section.showIf) continue
    edges.push({
      sourceQuestionId: section.showIf.questionId,
      condition: conditionOf(section.showIf),
      targetKind: 'section',
      targetId: section.id,
      edgeClass: 'conditional',
      provenance: 'recorded',
    })
  }

  for (const question of V2_QUESTIONS as readonly V2QuestionDef[]) {
    if (!question.showIf) continue
    edges.push({
      sourceQuestionId: question.showIf.questionId,
      condition: conditionOf(question.showIf),
      targetKind: 'question',
      targetId: question.id,
      edgeClass: 'triggered',
      provenance: 'recorded',
    })
  }

  return edges
}

export type QuestionClassification =
  | { questionId: string; edgeClass: 'foundational'; basis: 'no gate, and its section is ungated' }
  | { questionId: string; edgeClass: 'conditional'; basis: string; openedBy: GraphEdge }
  | { questionId: string; edgeClass: 'triggered'; basis: string; openedBy: GraphEdge }

/**
 * Classify every question by how it comes to be shown.
 *
 * DIGGING never appears: see the header. `diggingStatus()` reports why.
 */
export function classifyQuestions(): QuestionClassification[] {
  const edges = recordedEdges()
  const sectionEdge = new Map(edges.filter((e) => e.targetKind === 'section').map((e) => [e.targetId, e]))
  const questionEdge = new Map(edges.filter((e) => e.targetKind === 'question').map((e) => [e.targetId, e]))

  return (V2_QUESTIONS as readonly V2QuestionDef[]).map((q): QuestionClassification => {
    const triggered = questionEdge.get(q.id)
    if (triggered) {
      return {
        questionId: q.id, edgeClass: 'triggered', openedBy: triggered,
        basis: `showIf on ${triggered.sourceQuestionId}`,
      }
    }
    const conditional = sectionEdge.get(q.section)
    if (conditional) {
      return {
        questionId: q.id, edgeClass: 'conditional', openedBy: conditional,
        basis: `section '${q.section}' opens on ${conditional.sourceQuestionId}`,
      }
    }
    return { questionId: q.id, edgeClass: 'foundational', basis: 'no gate, and its section is ungated' }
  })
}

export interface DiggingStatus {
  supported: false
  reason: string
  requiredToSupport: string[]
}

/** Why DIGGING cannot currently be derived, and what would make it possible. */
export function diggingStatus(): DiggingStatus {
  return {
    supported: false,
    reason:
      'Depth within an open branch is not encoded anywhere. V2QuestionDef has no parent ' +
      'question, no depth and no follow-up relation, and showIf expresses only "this answer ' +
      'opens that question" — which is TRIGGERED, not DIGGING. Classifying any question as ' +
      'DIGGING today would mean inferring a clinical follow-up relationship from wording.',
    requiredToSupport: [
      'an explicit parent/follow-up relation on V2QuestionDef, or',
      'a branch-depth marker set when a question is authored as a deeper probe within a branch',
    ],
  }
}

export interface GraphSummary {
  questions: number
  sections: number
  recordedEdges: number
  sectionEdges: number
  questionEdges: number
  foundational: number
  conditional: number
  triggered: number
  /** Always 0 while depth is unencoded — see diggingStatus(). */
  digging: number
  diggingStatus: DiggingStatus
  proposedEdges: number
  /** Questions that gate anything at all. A small number here means the
   *  branching model rests on very few questions. */
  branchingSourceQuestions: string[]
}

export function summariseGraph(): GraphSummary {
  const edges = recordedEdges()
  const classes = classifyQuestions()
  const count = (c: EdgeClass) => classes.filter((x) => x.edgeClass === c).length

  return {
    questions: V2_QUESTIONS.length,
    sections: V2_SECTIONS.length,
    recordedEdges: edges.length,
    sectionEdges: edges.filter((e) => e.targetKind === 'section').length,
    questionEdges: edges.filter((e) => e.targetKind === 'question').length,
    foundational: count('foundational'),
    conditional: count('conditional'),
    triggered: count('triggered'),
    digging: 0,
    diggingStatus: diggingStatus(),
    proposedEdges: edges.filter((e) => e.provenance === 'proposed').length,
    branchingSourceQuestions: [...new Set(edges.map((e) => e.sourceQuestionId))].sort(),
  }
}
