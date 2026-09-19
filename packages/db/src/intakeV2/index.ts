// Barrel — NI Pre-Consultation Health Intake (V2).
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
  resolveV2FieldGovernance, resolveAllV2FieldGovernance,
  V2_CANDIDATE_LAWFUL_BASES, V2_REQUIRED_FIELD_IDS,
} from './fieldGovernance'
export type { V2FieldGovernance, V2DeletionEligibility, V2LegalBasisState } from './fieldGovernance'
export {
  V2_STUDENT_ACCESS_REQUIREMENTS, canStudentAccessCase, canVerifyClinicalFacts,
  canSignClinicalConclusions, studentEntryRequiresClientConfirmation, canWriteAnalysisField,
  LEGAL_MHRA_GATE_LABEL, LEGAL_MHRA_GATED_CAPABILITIES, LEGAL_MHRA_GATE_STATEMENT,
} from './governanceControls'
export type { V2Actor, V2StudentAccessContext } from './governanceControls'
export { buildV2QuestionWordingReview } from './wordingReview'
export { V2_SYNOPSIS_DEFAULT_VIEW } from './synopsisMapping'
export {
  LAWFUL_BASIS_PROFILES, RETENTION_PROFILES, resolvePractitionerCareArticle9,
  resolveRetention, MINOR_RETENTION_GATE,
} from './legalProfiles'
export type {
  LawfulBasisProfileId, RetentionProfileId, LawfulBasisProfile, RetentionProfile,
  Article6Basis, Article9Condition,
} from './legalProfiles'
export {
  CARE_TEAM_ROLES, CARE_TEAM_ROLE_LABELS, PROFESSION_MODALITIES,
  CARE_TEAM_APPROVAL_TEXT, CARE_TEAM_APPROVAL_EXPLANATION, CARE_TEAM_APPROVAL_TEXT_VERSION,
  canCreateAssignment, isMembershipVisible, canAccessHealthProfile,
  validateLeadAssignment, validateRoleForMembership,
  approveMembership, withdrawMembership, endAssignment,
  healthProfileAccessBundle, addContribution,
} from './careTeam'
export type { CareTeamMembership, CareTeamRole, CareTeamContribution, AssignmentStatus, ClientApprovalStatus } from './careTeam'
export { V2_PROVENANCE_STATES, clientReported, missingFact, verifyFact, correctFact } from './provenance'
export type { V2Provenance, V2SourcedFact, V2Correction } from './provenance'
export { buildCaseSnapshot } from './caseSnapshot'
export type { V2AccountProfile, V2CareProfile, V2CaseSnapshot } from './caseSnapshot'
export { createV2AutosaveQueue } from './autosaveQueue'
export type { V2AutosaveQueue, V2SaveState } from './autosaveQueue'
export {
  CALL_SHEET_TREES, callSheetTreesForAnswers,
} from './callSheet'
export type { CallSheetTree, CallSheetPrompt, CallSheetEntry } from './callSheet'
