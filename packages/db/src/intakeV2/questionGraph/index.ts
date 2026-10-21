// ─── Question Graph ──────────────────────────────────────────────────────────
// Architecture for the future adaptive Intake: question → concept → field,
// plus the branch edges between questions.
//
// Three layers, each honest about what it does and does not know:
//
//   concepts.ts    the genuinely distinct things beneath the 387 fields,
//                  DERIVED from the registry so it cannot drift from it
//   bridge.ts      question ↔ concept ↔ field. Deliberately empty: no
//                  mapping has been authored, so none is asserted. Name
//                  similarities are reported separately as suggestions.
//   edges.ts       recorded branch edges read from showIf. DIGGING is
//                  reported as unsupported rather than guessed.
//   governance.ts  what legal metadata is missing. Fills in nothing.
//
// No UI, no persistence, no migration, no clinical inference. This is the
// shape the Intake UI will read, whatever that UI turns out to look like.

export {
  CONCEPT_LAYER, conceptById, conceptForField, questionBearingConcepts,
  summariseConceptLayer,
} from './concepts'
export type { ConceptDef, ConceptRelation, ConceptLayerSummary } from './concepts'

export {
  BRIDGE_ENTRIES, suggestedByName, bridgeCoverage,
  orphanQuestionIds, orphanFieldIds, orphanConcepts,
} from './bridge'
export type { BridgeEntry, BridgeConfidence, BridgeSuggestion, BridgeCoverage } from './bridge'

export {
  recordedEdges, classifyQuestions, diggingStatus, summariseGraph,
} from './edges'
export type { GraphEdge, EdgeClass, EdgeProvenance, QuestionClassification, GraphSummary, DiggingStatus } from './edges'

export {
  GOVERNANCE_REQUIREMENTS, fieldGovernanceGaps, questionGovernanceGaps, summariseGovernance,
} from './governance'
export type { GovernanceRequirement, FieldGovernanceGap, QuestionGovernanceGap, GovernanceSummary } from './governance'
