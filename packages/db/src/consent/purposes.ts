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

/** The exact wording shown for each purpose under version 's3-draft-2'.
 *  FROZEN. Once a version has been shown to a user its text must never be
 *  edited — see CONSENT_TEXT_ARCHIVE below and the digest test that pins it. */
const S3_DRAFT_2_TEXTS: Record<ConsentPurpose, string> = {
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

// ─── Immutable version → text archive ────────────────────────────────────────
// Mission 19 (Founder direction): "The exact text shown for every consent
// version must remain retrievable. Do not let version = X later resolve to
// whatever wording happens to be current."
//
// Rules for whoever edits this next:
//   1. NEVER edit the texts of a version that has already been shown to a
//      user. consent_records rows point at these versions by string, and a
//      reworded version silently rewrites what someone agreed to.
//   2. To change wording, ADD a new key here and move CONSENT_TEXT_VERSION to
//      it. The old key stays forever.
//   3. consentTextDigest() is pinned by a unit test for every released
//      version, so an accidental edit fails the build rather than the audit.
//
// A version is only resolvable if it is a key here. An unknown version
// FAILS CLOSED (resolveConsentTexts returns null) and the caller must ask the
// member to re-affirm the current version rather than guess.

/**
 * s3-draft-1 — the FIRST granular consent wording, shown on 13 September 2026.
 *
 * RECOVERED from the five live consent_records rows that reference it; this
 * version predates the archive, so its text existed nowhere in code and
 * `version = 's3-draft-1'` could not be resolved at all.
 *
 * Written out in full rather than composed from DRAFT_PREFIX or aliased to the
 * s3-draft-2 values, deliberately: an archived version must not be able to
 * change because something it shares a constant with was edited. Two of these
 * five happen to be identical to s3-draft-2 today; three are materially
 * different, which is exactly why a version must never resolve to current
 * wording.
 *
 * Partial by nature: platform_terms and data_processing were not versioned at
 * this point (their two April rows carry a NULL consent_version).
 */
const S3_DRAFT_1_TEXTS: Partial<Record<ConsentPurpose, string>> = {
  record_holding:
    'DRAFT — requires solicitor/clinician review before real-client use. ' +
    'I consent to Natural Intelligence holding a health record about me, ' +
    'containing the information I choose to provide, for the purpose of ' +
    'supporting my care.',
  deidentified_synopsis_sharing:
    'DRAFT — requires solicitor/clinician review before real-client use. ' +
    'I consent to a de-identified (pseudonymous) synopsis of my health record ' +
    'being shared with a reviewing practitioner. My name and direct ' +
    'identifiers are not included; Natural Intelligence retains the link ' +
    'internally.',
  ai_assisted_processing:
    'DRAFT — requires solicitor/clinician review before real-client use. ' +
    'I consent to AI-assisted processing of my record to organise and summarise ' +
    'the information I provide. Technology organises and assists — it makes no ' +
    'clinical decision; qualified practitioners decide.',
  retention_beyond_episode:
    'DRAFT — requires solicitor/clinician review before real-client use. ' +
    'I consent to my record being retained after my care episode ends, so that ' +
    'my history is available if I return. I may withdraw this at any time.',
  anonymised_research:
    'DRAFT — requires solicitor/clinician review before real-client use. ' +
    'I consent to fully anonymised information derived from my record being ' +
    'used for research to improve natural-health care. Anonymised means I ' +
    'cannot be identified from it.',
}

// Values are PARTIAL per version: a version only carries the purposes that
// existed when it was published, and resolveConsentText returns null for the
// rest rather than borrowing a newer version's wording.
export const CONSENT_TEXT_ARCHIVE: Readonly<
  Record<string, Readonly<Partial<Record<ConsentPurpose, string>>>>
> = Object.freeze({
  's3-draft-1': Object.freeze({ ...S3_DRAFT_1_TEXTS }),
  's3-draft-2': Object.freeze({ ...S3_DRAFT_2_TEXTS }),
})

/** The wording for the CURRENT version. Unchanged export for existing callers. */
export const CONSENT_TEXTS: Readonly<Record<ConsentPurpose, string>> = S3_DRAFT_2_TEXTS

export function isKnownConsentVersion(version: string): boolean {
  return Object.prototype.hasOwnProperty.call(CONSENT_TEXT_ARCHIVE, version)
}

/**
 * The exact texts shown under `version`, or null when the version is not
 * archived. Null means FAIL CLOSED: the caller must not substitute current
 * wording, and must re-ask instead.
 */
export function resolveConsentTexts(
  version: string,
): Readonly<Partial<Record<ConsentPurpose, string>>> | null {
  return isKnownConsentVersion(version) ? CONSENT_TEXT_ARCHIVE[version] : null
}

/**
 * The exact text shown for one purpose under `version`, or null when either
 * the version is not archived or that version did not carry the purpose.
 */
export function resolveConsentText(version: string, purpose: ConsentPurpose): string | null {
  const texts = resolveConsentTexts(version)
  if (!texts) return null
  if (!Object.prototype.hasOwnProperty.call(texts, purpose)) return null
  return texts[purpose] ?? null
}

/**
 * Canonical serialisation of one archived version — the input to the pinned
 * digest test. Purposes are sorted so key order can never change the digest.
 */
export function canonicaliseConsentVersion(version: string): string | null {
  const texts = resolveConsentTexts(version)
  if (!texts) return null
  const keys = (Object.keys(texts) as ConsentPurpose[]).slice().sort()
  return JSON.stringify(keys.map((k) => [k, texts[k] ?? null]))
}

// ─── Version policy ──────────────────────────────────────────────────────────
// Orchestrator decision, Mission 20:
//
//   "a previously valid archived consent does NOT automatically become invalid
//    merely because NI publishes revised wording. Do not force re-affirmation
//    on every version bump. Future catalogue design should support an explicit
//    policy such as requires_reaffirmation: true | false. Fresh consent is
//    required only when NI/legal/regulatory policy says the change requires
//    it."
//
// So this is a per-version declaration, not an engine. The only question it
// answers is: does publishing THIS version invalidate grants recorded at
// EARLIER versions? Both versions released so far answer no, which is why
// today's behaviour is unchanged by adding this.
//
// DELIBERATELY SEPARATE from CONSENT_TEXT_ARCHIVE. The archive's canonical
// form feeds a pinned digest test, so folding policy into it would make the
// digests move whenever policy was annotated — and the digests exist to prove
// that released wording never moves.

/**
 * Release order, oldest first. A version must appear BOTH here and in
 * CONSENT_TEXT_ARCHIVE; a unit test enforces that the two never diverge.
 */
export const CONSENT_VERSION_ORDER = ['s3-draft-1', 's3-draft-2'] as const

export interface ConsentVersionPolicy {
  /**
   * True when publishing this version requires holders of EARLIER versions to
   * consent again. Set this only on legal/regulatory advice: a clarification
   * does not invalidate a grant, a material change to what is being agreed
   * to does.
   */
  requires_reaffirmation: boolean
  /** Why it is set the way it is — this is audit evidence, not a comment. */
  rationale: string
}

export const CONSENT_VERSION_POLICY: Readonly<
  Record<string, Readonly<ConsentVersionPolicy>>
> = Object.freeze({
  's3-draft-1': Object.freeze({
    requires_reaffirmation: false,
    rationale: 'First granular wording. Nothing precedes it, so nothing to invalidate.',
  }),
  's3-draft-2': Object.freeze({
    requires_reaffirmation: false,
    rationale:
      'PA/legal Screen 1 amendments: pathway separation, withdrawal scope, ' +
      'pseudonymous-not-anonymous, reasonably-identifiable research wording, ' +
      'retention rule. Assessed as clarifying and narrowing what NI claims, ' +
      'not as widening what the member agreed to, so s3-draft-1 grants stand. ' +
      'Confirm with legal before relying on this for real-client use.',
  }),
})

export function resolveConsentVersionPolicy(
  version: string,
): Readonly<ConsentVersionPolicy> | null {
  return Object.prototype.hasOwnProperty.call(CONSENT_VERSION_POLICY, version)
    ? CONSENT_VERSION_POLICY[version]
    : null
}

/**
 * Is a consent grant recorded at `grantedVersion` still current?
 *
 * Two ways to answer no:
 *
 *   1. UNRESOLVABLE VERSION — null, or a label not in the archive. There is
 *      then no way to establish what the member was actually shown, so this
 *      FAILS CLOSED and the member is asked again. This is not hypothetical:
 *      the two April 2026 foundational rows in the live database carry
 *      consent_version = NULL **and** consent_text = NULL, so nothing records
 *      what was on screen. Treating that as proof of consent would be the
 *      exact failure the archive was built to prevent. Those rows are left
 *      untouched — re-affirmation appends, it does not rewrite.
 *
 *   2. A LATER VERSION DEMANDS IT — some version published after this one
 *      carries requires_reaffirmation. A plain version bump does not.
 */
export interface ConsentCatalogue {
  order: readonly string[]
  policy: Readonly<Record<string, Readonly<ConsentVersionPolicy>>>
  isArchived: (version: string) => boolean
}

/** The live catalogue. The `catalogue` parameter exists so the rule itself is
 *  testable against hypothetical future releases without mutating it. */
export const LIVE_CONSENT_CATALOGUE: ConsentCatalogue = {
  order: CONSENT_VERSION_ORDER,
  policy: CONSENT_VERSION_POLICY,
  isArchived: isKnownConsentVersion,
}

export function isConsentGrantStillCurrent(
  grantedVersion: string | null | undefined,
  catalogue: ConsentCatalogue = LIVE_CONSENT_CATALOGUE,
): boolean {
  if (!grantedVersion) return false
  if (!catalogue.isArchived(grantedVersion)) return false

  const grantedAt = catalogue.order.indexOf(grantedVersion)
  // Archived but absent from the release order: unorderable, so it cannot be
  // shown to be current. Fail closed rather than guess.
  if (grantedAt < 0) return false

  return !catalogue.order
    .slice(grantedAt + 1)
    .some((later) =>
      Object.prototype.hasOwnProperty.call(catalogue.policy, later) &&
      catalogue.policy[later].requires_reaffirmation === true)
}
