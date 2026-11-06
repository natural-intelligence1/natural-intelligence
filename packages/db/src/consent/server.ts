// ─── packages/db/src/consent/server.ts ───────────────────────────────────────
// SERVER / NODE RUNTIME ONLY.
//
// Everything re-exported here reaches node:crypto, directly
// (signupPayload.ts) or transitively (foundational.ts imports it). None of it
// may enter a browser bundle, and none of it may be imported from Edge
// middleware.
//
// This module exists because a comment is not a boundary. The signup consent
// work was originally re-exported from './index', which a client component
// imports for the consent wording — and that put node:crypto into the browser
// bundle and broke `next build`. The import graph now makes the rule
// structural: a client component that reaches any of this fails at build
// time, loudly, with a trace that names the offending import.
//
// Browser-safe consent exports (purposes, texts, the version archive and
// policy, the record helpers) stay on './index'.

export {
  SIGNUP_CONSENT_PAYLOAD_VERSION, SIGNUP_CONSENT_METADATA_KEY,
  SIGNUP_CONSENT_PERSISTED_KEY, SIGNUP_CONSENT_SECRET_ENV,
  SIGNUP_CONSENT_SECRET_MIN_LENGTH, canSignSignupConsent, normaliseEmail,
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
