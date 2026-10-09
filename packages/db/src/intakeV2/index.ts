// Barrel — NI Pre-Consultation Health Intake (V2) + Connected Care (V4).
//
// RECONSTRUCTED for release/connected-care-integration. This is deliberately
// NOT the barrel from care-journey-v4-connected: that one re-exported the
// whole Sprint 4–6 domain layer, which would have made importing Connected
// Care equivalent to promoting Sprint 4–6.
//
// This barrel is main's barrel plus exactly the modules Connected Care needs:
//   provenance, caseSnapshot, fieldRegistry, synopsisMapping   (production deps)
//   governanceControls, careTeam                               (governance rules)
//   journey, influences, concerns, branchLifecycle, updates,
//   synopsis, callSheetBuilder, nutrition, safetyWorkflow      (Connected Care)
//
// Deliberately NOT exported here, because Connected Care does not use them:
//   fieldGovernance   — GDPR lawful-basis / retention resolution
//   legalProfiles     — Article 6/9 and retention profiles
//   wordingReview     — question-wording audit tooling
// Those stay on care-journey-v4-connected for their own promotion decision.
export type {
  V2SectionId, V2AnswerType, V2SamdClass, V2QuestionDef, V2SectionDef,
  V2ShowIf, V2RepeatableField, V2SafetyCapture,
} from './types'
export {
  V2_SECTIONS, V2_QUESTIONS, FREQUENCY_OPTIONS, BODY_SYSTEMS,
  v2QuestionsForSection, v2QuestionById, v2SafetyCaptureIds,
} from './registry'
export {
  isIntakeV2Enabled, visibleSections, visibleQuestions, missingRequired,
  hasSafetyCaptureAnswers, saveV2Answer, loadV2Answers,
  getOrCreateV2Session, completeV2Session,
} from './flow'
export type { V2Answers } from './flow'
export {
  V2_FIELD_REGISTRY, v2FieldById, v2IntakeWritableFields, v2ConfirmOnlyFields, v2FieldsForDomain,
  V2_FAMILY_RELATIVES, V2_FAMILY_CATEGORIES, V2_SYSTEM_KEYS,
} from './fieldRegistry'
export type { V2FieldDef, V2FieldSource, V2FieldDomain, V2SynopsisSectionId } from './fieldRegistry'
export {
  V2_SYNOPSIS_SECTIONS, V2_INTAKE_SCREEN_SEQUENCE, v2FieldsForSynopsisSection,
  deriveV2SafetyReviewItems, V2_SAFETY_BLOCK_TITLE, V2_SAFETY_BOUNDARY_TEXT, V2_SAFETY_EMPTY_STATE,
  V2_NON_MONITORING_WORDING, V2_INTAKE_SCHEMA_VERSION, V2_SYNOPSIS_WORKFLOW_VERSION,
  buildV2SynopsisAuditMetadata,
} from './synopsisMapping'
export type { V2SynopsisSectionDef, V2SafetyReviewItem, V2SynopsisAuditMetadata } from './synopsisMapping'
export {
  V2_STUDENT_ACCESS_REQUIREMENTS, canStudentAccessCase, canVerifyClinicalFacts,
  canSignClinicalConclusions, studentEntryRequiresClientConfirmation, canWriteAnalysisField,
  LEGAL_MHRA_GATE_LABEL, LEGAL_MHRA_GATED_CAPABILITIES, LEGAL_MHRA_GATE_STATEMENT,
} from './governanceControls'
export type { V2Actor, V2StudentAccessContext } from './governanceControls'
export { V2_SYNOPSIS_DEFAULT_VIEW } from './synopsisMapping'
export {
  CARE_TEAM_ROLES, CARE_TEAM_ROLE_LABELS, PROFESSION_MODALITIES,
  CARE_TEAM_APPROVAL_TEXT, CARE_TEAM_APPROVAL_EXPLANATION, CARE_TEAM_APPROVAL_TEXT_VERSION,
  canCreateAssignment, isMembershipVisible, canAccessHealthProfile,
  validateLeadAssignment, validateRoleForMembership,
  approveMembership, withdrawMembership, endAssignment,
  healthProfileAccessBundle, addContribution,
} from './careTeam'
export type { CareTeamMembership, CareTeamRole, CareTeamContribution, AssignmentStatus, ClientApprovalStatus } from './careTeam'
export {
  V2_PROVENANCE_STATES, SYSTEM_SETTABLE_PROVENANCE, PRACTITIONER_ONLY_PROVENANCE,
  clientReported, missingFact, verifyFact, correctFact,
  notAsked, declined, documentedRecord, systemOrganised,
  systemStructuredFromClientLanguage, interpretFact,
  isPractitionerOnlyProvenance, isAffirmativeClientAnswer,
} from './provenance'
export type { V2Provenance, V2SourcedFact, V2Correction, V2Interpretation } from './provenance'

// ── V4 connected-care layer (additive over the existing V2 engine) ──────────
export {
  JOURNEY_CHAPTERS, JOURNEY, chapterById, chapterForSection,
  unmappedSections, journeyProgress,
} from './journey'
export type { JourneyChapterId, JourneyChapterDef, ChapterProgress } from './journey'

export {
  INFLUENCE_KINDS, INFLUENCE_KIND_LABELS, detectClientExpressedLink,
  buildInfluenceFromClientStatement, practitionerAddedInfluence,
  influenceAsSourcedFact, reviewInfluence,
} from './influences'
export type {
  InfluenceKind, InfluenceOrigin, InfluenceReviewState, InfluenceRecord,
  CueDetection, BuildInfluenceInput, BuildInfluenceResult,
} from './influences'

export {
  CLARIFICATION_REASONS, CLARIFICATION_REASON_LABELS,
  concernsInClientOrder, influencesForConcern, allClarificationItems,
  deriveClarificationItems,
} from './concerns'
export type { ConcernCard, ClarificationItem, ClarificationReason } from './concerns'

export {
  BRANCH_STATES, newBranch, activateBranch, expandBranch, isFactuallySufficient,
  recordAnswer, summariseBranch, reopenBranch, openBranches, wasNeverAsked,
} from './branchLifecycle'
export type { BranchState, BranchStatus, BranchTransition } from './branchLifecycle'

export {
  UPDATE_KINDS, UPDATE_KIND_LABELS, recordUpdate, buildSinceLastReview, describeSequence,
} from './updates'
export type {
  UpdateKind, UpdateAuthorRole, DatedUpdate, SinceLastReview, SinceLastReviewSection,
} from './updates'

export {
  SYNOPSIS_SECTION_IDS, SYNOPSIS_SECTION_TITLES, SYNOPSIS_BUILDER_VERSION,
  buildFactualSynopsis, provenanceLabel,
  containsOnlyFactualProvenance, everyItemHasProvenance,
} from './synopsis'
export type {
  SynopsisSectionId, SynopsisItem, SynopsisSection, FactualSynopsis, SynopsisInput,
} from './synopsis'
export { buildCaseSnapshot } from './caseSnapshot'
export type { V2AccountProfile, V2CareProfile, V2CaseSnapshot } from './caseSnapshot'
export { createV2AutosaveQueue } from './autosaveQueue'
export type { V2AutosaveQueue, V2SaveState } from './autosaveQueue'
export {
  CALL_SHEET_TREES, callSheetTreesForAnswers,
} from './callSheet'
export type { CallSheetTree, CallSheetPrompt, CallSheetEntry } from './callSheet'

export {
  CALL_SHEET_BUILDER_VERSION, CALL_SHEET_SECTION_IDS, CALL_SHEET_SECTION_TITLES,
  CALL_SHEET_ITEM_ORIGINS, SAFETY_PROMPT,
  buildCallSheet, recordCallSheetEntry, allCallSheetItems,
} from './callSheetBuilder'
export type {
  CallSheetSectionId, CallSheetItemOrigin, CallSheetItem, CallSheetSection,
  CallSheet, CallSheetInput, CallSheetEntryRefusal, RecordEntryResult,
} from './callSheetBuilder'

export {
  NUTRITION_LAYERS, NUTRITION_LAYER_LABELS, MEASURE_SOURCES,
  currentIntake, clientBelief, practitionerAdvice, groupNutrition,
  therapeuticAim, describeChange, readingsForMeasure,
} from './nutrition'
export type {
  NutritionLayer, CurrentIntakeEntry, ClientBeliefEntry, PractitionerAdviceEntry,
  NutritionEntry, NutritionRecord, AdviceRefusal, AdviceResult,
  TherapeuticAim, AimRefusal, AimResult,
  MeasureSource, OutcomeMeasure, MeasureReading,
} from './nutrition'

export {
  PROTOCOL_SIGNING_GUARD_VERSION, PRACTITIONER_CLASSES,
  SIGNING_REFUSAL_CODES, SIGNING_REFUSAL_MESSAGES,
  authoriseProtocolSigning, assertProtocolSigningAuthorised,
  ProtocolSigningRefused, rpcEligibilityResolver,
} from './protocolSigning'
export type {
  PractitionerClass, SigningRefusalCode, SigningRefusal, SigningAttribution,
  SigningAuthorisation, EligibilityVerdict, EligibilityResolver,
  CaseSigningState, ProtocolUnderSignature, ProtocolSigningRequest,
} from './protocolSigning'

export {
  SAFETY_WORKFLOW_VERSION, SAFETY_STATES, SAFETY_STATE_LABELS, SAFETY_OPEN_STATES,
  SAFETY_EVENT_KINDS, isOpen, raiseSafetyItem, assignReviewer,
  acknowledgeSafetyItem, recordSafetyDecision, recordSafetyAction,
  resolveSafetyItem, reopenSafetyItem, openSafetyItems,
} from './safetyWorkflow'
export type {
  SafetyState, SafetyEventKind, SafetyAuditEvent, SafetyDecision, SafetyAction,
  SafetyReviewRecord, SafetyRefusal, SafetyResult,
} from './safetyWorkflow'
