// Barrel — Sprint 3 consent module.
export {
  CONSENT_PURPOSES, REQUIRED_INTAKE_CONSENTS, OPTIONAL_INTAKE_CONSENTS,
  CONSENT_TEXT_VERSION, CONSENT_TEXTS, isConsentPurpose,
} from './purposes'
export type { ConsentPurpose } from './purposes'
export {
  recordConsent, recordSignupConsents, getMemberConsents, hasActiveConsent, hasAllConsents, withdrawConsent,
} from './records'
export type { ConsentRecordRow, RecordConsentInput, SignupConsentWriteResult } from './records'
