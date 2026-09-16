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
} from './synopsisMapping'
export type { V2SynopsisSectionDef, V2SafetyReviewItem } from './synopsisMapping'
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
