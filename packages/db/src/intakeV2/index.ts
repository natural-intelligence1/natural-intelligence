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
  CALL_SHEET_TREES, callSheetTreesForAnswers,
} from './callSheet'
export type { CallSheetTree, CallSheetPrompt, CallSheetEntry } from './callSheet'
