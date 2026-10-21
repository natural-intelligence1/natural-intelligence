// ─── Consultation Cockpit V2 — PILOT ────────────────────────────────────────
//
// Three domains: Digestion, Energy & metabolism, Sleep.
//
//   pilot.ts                 the pilot slice of the approved registry, and the
//                            section-id ↔ system-key translation
//   mappingPack.ts           Question → Concept → Field review pack, and THE
//                            GATE. Zero approved mappings; every canonical
//                            write is blocked
//   diggingEdges.ts          explicit DIGGING edges — not derived from showIf
//   capture.ts               the right pane's state. Changed answers keep
//                            their history; unanswered is never "No"
//   safetyLinks.ts           red flag → human review, over the approved
//                            safetyOptions metadata. Annex 1 is NOT in the
//                            repo and nothing substitutes for it
//   guidance.ts              the left pane. Advisory only, structurally
//                            incapable of entering the record
//   sectionStatus.ts         THIS SECTION vs CASE-WIDE SAFETY, and a finish
//                            gate that cannot close a review
//   studentMode.ts           the student capability boundary
//   worklog.ts               timer and operational log. No clinical content,
//                            and no influence over what is asked
//   synopsisContribution.ts  the last link in the acceptance chain
//
// NOTHING HERE PERSISTS ANYTHING. The pilot runs on session state because no
// mapping is approved; `canPersistCanonically` returns false for every pilot
// question and there is no override.

export {
  PILOT_SECTION_IDS, SYSTEM_KEY_BY_SECTION, isPilotSection, pilotStreamTitle,
  pilotQuestions, pilotQuestionById, pilotRedFlagQuestions, isRedFlagValue,
  summarisePilot,
} from './pilot'
export type { PilotSectionId, PilotRedFlagQuestion, PilotScope, V2QuestionDef, V2SectionId } from './pilot'

export {
  MAPPING_STATUSES, PERSISTABLE_STATUSES, CAPTURE_OWNERS, PILOT_MAPPING_PACK,
  PRODUCT_TO_CANONICAL, canonicalKeyFor, mappingFor, canPersistCanonically,
  persistenceBlockReason, proposeCandidate, summariseMappingPack,
  unmappedPilotQuestions, mappingPackRows,
} from './mappingPack'
export type { MappingStatus, CaptureOwner, MappingEntry, MappingPackSummary } from './mappingPack'

export {
  ANNEX_1_SOURCE, ANNEX_1_PILOT_RULES, ANNEX_ANSWERS, annexRuleById,
  annexRulesLinkedToQuestion, linkFromSelection, answerTriggersReview,
  rule26Threshold, summariseAnnex,
} from './annex1'
export type { SystemAnswerLink, SystemAnswerLinkKind, AnnexFollowUp, AnnexSummary } from './annex1'

export {
  isParameterised, conceptReference, conceptReferenceForField, conceptRefKey,
  sameConcept, groupByConceptReference, describeConceptReference,
} from './conceptReference'
export type { ConceptReference, ConceptReferenceResult } from './conceptReference'

export {
  DIGGING_REVIEW_STATUSES, DIGGING_EDGE_VERSION, PILOT_DIGGING_EDGES,
  edgeById, edgesForQuestion, edgesTriggeredBy, requiredTargets,
  sufficiencyTargets, targetKey, orderedTargets, summariseDiggingGraph,
  validateDiggingEdges,
} from './diggingEdges'
export type {
  DiggingReviewStatus, DiggingTarget, DiggingEdge, DiggingGraphSummary,
} from './diggingEdges'

export {
  BRANCH_LIFECYCLE, CAPTURE_ACTOR_ROLES, newCaptureState, recordAnswer,
  recordBranchDetail, isBranchSufficient, outstandingTargets, summariseBranch,
  reopenBranch, markBranchNoLongerRelevant, answersForSection,
  branchesForSection, unfinishedBranches, branchesNeedingReconciliation,
  studentDrafts, amendedAnswers, edgeFor,
} from './capture'
export type {
  BranchLifecycleState, CaptureActorRole, CaptureActor, AnswerRevision,
  CapturedAnswer, BranchCapture, CaptureState,
} from './capture'

export {
  ANNEX_1_STATUS, UNCERTAIN_VALUES, DECLINED_VALUES, ANNEX_FOLLOW_UPS,
  buildSafetyNodes, unaskedRelevantNodes, nodesForSection,
  deriveCockpitSafetyItems, raiseForFollowUpDetail, consolidateSafety,
  openItemsElsewhere, openItemsInSection, annexNodeInventory,
  unsuppliedSafetyValues, annexRulesForSection, isSafetyItemOpen,
} from './safetyLinks'
export type {
  RedFlagTriggerReason, CockpitSafetyItem, CockpitAnswerInput, SafetyConsolidation,
  SafetyNode, SafetyNodeAnswer, SafetyNodeState, AnnexRule, AnnexAnswer,
  AnnexNotice, WeightLossDetail, ThresholdState,
} from './safetyLinks'

export {
  GUIDANCE_BLOCKS, GUIDANCE_BLOCK_TITLES, buildGuidancePanel, orient,
  nodeDetails, edgeTargetKeys,
} from './guidance'
export type {
  GuidanceBlockId, GuidanceLine, GuidanceBlock, GuidancePanel,
  PractitionerOrientation, NodeDetails,
} from './guidance'

export {
  FINISH_SECTION_LABEL, FINISH_SECTION_LABEL_CLEAR, sectionStatus,
  caseWideSafetyStatus, finishSectionGate, finishSection,
} from './sectionStatus'
export type { SectionStatus, CaseWideSafetyStatus, FinishSectionGate } from './sectionStatus'

export {
  COCKPIT_CAPABILITIES, STUDENT_CAPABILITIES, STUDENT_MAY_ASK_SAFETY_QUESTIONS,
  can, isStudent, attributionLine, submitForSupervision,
} from './studentMode'
export type {
  CockpitCapability, CapabilityDecision, SupervisionSubmission, SubmitResult,
} from './studentMode'

export {
  TIMER_STATES, OVERRUN_REASONS, OVERRUN_REASON_LABELS,
  TIMER_CANNOT_AFFECT_CONTENT, newTimer, startTimer, pauseTimer, resumeTimer,
  activeSeconds, isOverrunning, overrunSeconds, completeTimer,
  toWorkLogEntry, formatDuration,
} from './worklog'
export type {
  TimerState, OverrunReason, WorkLogEntry, TimerSession, CompleteTimerResult,
} from './worklog'

export {
  contributionFor, contributions, resolveChain, summariseContributions,
} from './synopsisContribution'
export type {
  ContributionState, SynopsisContribution, ChainLink, ContributionSummary,
} from './synopsisContribution'
