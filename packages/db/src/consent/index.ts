// Barrel — Sprint 3 consent module.
export {
  CONSENT_PURPOSES, REQUIRED_INTAKE_CONSENTS, OPTIONAL_INTAKE_CONSENTS,
  CONSENT_TEXT_VERSION, CONSENT_TEXTS, isConsentPurpose,
  CONSENT_TEXT_ARCHIVE, isKnownConsentVersion, resolveConsentTexts,
  resolveConsentText, canonicaliseConsentVersion,
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

// Mission 19 — signup consent carried on the user record (cross-device) and
// the authenticated-entry backstop.
export {
  SIGNUP_CONSENT_PAYLOAD_VERSION, SIGNUP_CONSENT_METADATA_KEY,
  SIGNUP_CONSENT_PERSISTED_KEY, canSignSignupConsent, normaliseEmail,
  buildSignupConsentPayload, verifySignupConsentPayload,
} from './signupPayload'
export type { SignupConsentPayload, SignupConsentVerification } from './signupPayload'
export {
  FOUNDATIONAL_CONSENTS, SIGNUP_CONSENT_SOURCE, REAFFIRMATION_CONSENT_SOURCE,
  persistSignupConsentFromMetadata, markSignupConsentConsumed,
  getFoundationalConsentState, ensureFoundationalConsents,
  recordFoundationalReaffirmation,
} from './foundational'
export type {
  FoundationalConsentState, PersistSignupConsentResult, PersistSignupConsentStatus,
} from './foundational'
