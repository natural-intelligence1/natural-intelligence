// ─── packages/db/src/consent/purposes.ts ──────────────────────────────────────
// Sprint 3 — granular consent purposes for the platform safety floor.
//
// Every consent grant records the EXACT text shown and its version. The texts
// below are DRAFT — requires solicitor/clinician review before real-client use.

export const CONSENT_PURPOSES = [
  'platform_terms',                 // existing signup consent — unchanged
  'data_processing',                // existing signup consent — unchanged
  'record_holding',                 // NI holding the client record
  'deidentified_synopsis_sharing',  // sharing a de-identified/pseudonymous synopsis with a reviewing practitioner
  'ai_assisted_processing',         // AI-assisted processing of the record
  'retention_beyond_episode',       // retention beyond the care episode
  'anonymised_research',            // future anonymised research use
] as const

export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number]

/** Consents that MUST be granted before any intake health data may be saved. */
export const REQUIRED_INTAKE_CONSENTS: ConsentPurpose[] = [
  'record_holding',
  'ai_assisted_processing',
]

/** Optional consents offered at intake start (recorded either way). */
export const OPTIONAL_INTAKE_CONSENTS: ConsentPurpose[] = [
  'deidentified_synopsis_sharing',
  'retention_beyond_episode',
  'anonymised_research',
]

/** Version identifier stamped on every consent row written by this build.
 *  s3-draft-2 — PA/legal Screen 1 amendments (pathway separation, withdrawal
 *  scope, pseudonymous-not-anonymous, reasonably-identifiable research
 *  wording, retention rule). */
export const CONSENT_TEXT_VERSION = 's3-draft-2'

const DRAFT_PREFIX =
  'DRAFT — requires solicitor/clinician review before real-client use. '

/** The exact wording shown for each purpose (stored verbatim on grant). */
export const CONSENT_TEXTS: Record<ConsentPurpose, string> = {
  platform_terms:
    'I agree to the Natural Intelligence terms of use and privacy policy.',
  data_processing:
    'I consent to my data being processed to provide the platform service.',
  record_holding:
    DRAFT_PREFIX +
    'I consent to Natural Intelligence holding a health record about me, ' +
    'containing the information I choose to provide, for the purpose of ' +
    'supporting my care.',
  deidentified_synopsis_sharing:
    DRAFT_PREFIX +
    'If I use only Natural Intelligence’s self-serve tools, sharing with a ' +
    'practitioner is my choice, and I consent to it here. If I choose ' +
    'practitioner-led care, Natural Intelligence needs to process and share ' +
    'relevant information with my practitioner so that the service can be ' +
    'provided. Any synopsis or review pack shared is pseudonymous — my name ' +
    'and direct identifiers are not included — not anonymous; Natural ' +
    'Intelligence retains the link internally.',
  ai_assisted_processing:
    DRAFT_PREFIX +
    'I consent to AI-assisted processing of my record to organise and summarise ' +
    'the information I provide. Technology organises and assists — it makes no ' +
    'clinical decision; qualified practitioners decide.',
  retention_beyond_episode:
    DRAFT_PREFIX +
    'I consent to my record being retained after my care episode ends, so that ' +
    'my history is available if I return. Natural Intelligence may retain data ' +
    'while my account or the service remains active where still necessary for ' +
    'the stated purpose, subject to the retention schedule. I may withdraw ' +
    'this consent at any time: withdrawal stops future processing that relies ' +
    'on it, but does not automatically erase information Natural Intelligence ' +
    'or a practitioner must retain for legal, professional, complaints, ' +
    'insurance or claims purposes.',
  anonymised_research:
    DRAFT_PREFIX +
    'I consent to anonymised information derived from my record being used ' +
    'for research to improve natural-health care — anonymised so that I am ' +
    'not reasonably identifiable from the research data.',
}

export function isConsentPurpose(v: string): v is ConsentPurpose {
  return (CONSENT_PURPOSES as readonly string[]).includes(v)
}
