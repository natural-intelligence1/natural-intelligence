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

// Practitioner-scoped consent. Deliberately NOT part of CONSENT_PURPOSES —
// see practitionerAccess.ts for why the member-wide helpers must not be asked
// about a purpose that names a practitioner.
export {
  PRACTITIONER_SCOPED_CONSENTS, PRACTITIONER_ACCESS_CONSENT_TEXT_PENDING,
  CONSENT_SEMANTICS, isPractitionerScopedConsent, hasActivePractitionerAccessConsent,
  listPractitionerAccessConsents, withdrawPractitionerAccess,
} from './practitionerAccess'
export type { PractitionerScopedConsent, PractitionerAccessConsent } from './practitionerAccess'
