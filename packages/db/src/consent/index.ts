// Barrel — Sprint 3 consent module.
export {
  CONSENT_PURPOSES, REQUIRED_INTAKE_CONSENTS, OPTIONAL_INTAKE_CONSENTS,
  CONSENT_TEXT_VERSION, CONSENT_TEXTS, isConsentPurpose,
  CONSENT_TEXT_ARCHIVE, isKnownConsentVersion, resolveConsentTexts,
  resolveConsentText, canonicaliseConsentVersion,
} from './purposes'
export type { ConsentPurpose } from './purposes'

// Version policy — pure, browser-safe. Both released versions declare
// requires_reaffirmation: false, so a reword does not invalidate an archived
// grant; an unresolvable version fails closed.
export {
  CONSENT_VERSION_ORDER, CONSENT_VERSION_POLICY, LIVE_CONSENT_CATALOGUE,
  resolveConsentVersionPolicy, isConsentGrantStillCurrent,
} from './purposes'
export type { ConsentVersionPolicy, ConsentCatalogue } from './purposes'

export {
  recordConsent, recordSignupConsents, getMemberConsents, hasActiveConsent, hasAllConsents, withdrawConsent,
} from './records'
export type { ConsentRecordRow, RecordConsentInput, SignupConsentWriteResult } from './records'

// ── NOT EXPORTED HERE: signupPayload and foundational ────────────────────────
// They live behind '@natural-intelligence/db/consent/server' instead.
//
// THIS BARREL IS REACHED FROM A CLIENT COMPONENT. IntakeConsentGate.tsx
// imports CONSENT_TEXTS and the intake consent lists from it, precisely to
// avoid the db ROOT barrel (which pulls in next/headers). signupPayload.ts
// imports node:crypto, and foundational.ts imports signupPayload, so
// re-exporting either from here put node:crypto into a browser bundle and
// broke `next build` with:
//
//   UnhandledSchemeError: Reading from "node:crypto" is not handled by plugins
//   Import trace: node:crypto -> consent/signupPayload.ts -> consent/index.ts
//                 -> app/dashboard/intake/IntakeConsentGate.tsx
//
// A file header saying "NODE RUNTIME ONLY" cannot enforce that. The module
// boundary can. Server callers use the root barrel or the /consent/server
// subpath; a client component importing either will fail loudly, which is the
// intended behaviour. clientBundleBoundary.test.ts walks the real import graph
// and fails if this ever regresses.
