// ─── packages/db/src/intake/previewAllowlist.ts ───────────────────────────────
// SINGLE-ACCOUNT founder-preview allowlist for the intake flow.
//
// Purpose: let ONE named account walk the full intake journey for founder/KR
// preview while INTAKE_COLLECTION_ENABLED stays OFF for everyone else. This
// is a narrow exception on top of the kill-switch, never a replacement:
//
//   intake allowed  ⇔  INTAKE_COLLECTION_ENABLED === 'true'
//                      OR the authenticated email is EXACTLY allowlisted.
//
// Allowlist source: INTAKE_PREVIEW_ALLOWLIST_EMAILS — comma-separated full
// email addresses. Matching is exact on the lower-cased address. There are
// deliberately NO wildcards, NO domain matching and NO partial matching;
// entries that are not plain full addresses (contain '*' or lack '@') are
// ignored. Absent/empty env var means NOBODY is allowlisted (deny).
//
// This flag does NOT touch INTAKE_ASSIGNMENT_ENABLED: an allowlisted
// completion still does not route to any practitioner while assignment is
// off. Completing intake as the allowlisted account writes REAL production
// health data for that account (intake_responses / intake_answers, plus
// AI synopsis + body-story rows in ai_summaries).

import { isIntakeCollectionEnabled } from './collectionFlag'

/** Parse the allowlist env var into exact lower-cased addresses. */
function allowlistedEmails(): string[] {
  const raw = process.env.INTAKE_PREVIEW_ALLOWLIST_EMAILS ?? ''
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0 && e.includes('@') && !e.includes('*'))
}

/**
 * True only when the given authenticated email is EXACTLY on the allowlist.
 * Unset/empty allowlist, missing email, wildcards and partial matches all
 * deny.
 */
export function isIntakePreviewAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return allowlistedEmails().includes(email.trim().toLowerCase())
}

/**
 * The single availability rule for the intake flow:
 * the global collection flag (default OFF), OR the narrow per-account
 * preview allowlist. Callers must pass the AUTHENTICATED user's email —
 * never form input.
 */
export function isIntakeAllowedForUser(email: string | null | undefined): boolean {
  return isIntakeCollectionEnabled() || isIntakePreviewAllowedEmail(email)
}

/**
 * Throws unless intake is allowed for this authenticated email. Call in every
 * server action that stores intake health data, BEFORE any intake write —
 * a throw here proves nothing was written by that action.
 */
export function assertIntakeAllowedForUser(email: string | null | undefined): void {
  if (!isIntakeAllowedForUser(email)) {
    throw new Error(
      'Intake collection is currently disabled (INTAKE_COLLECTION_ENABLED is not "true" '
      + 'and this account is not on the preview allowlist).',
    )
  }
}
