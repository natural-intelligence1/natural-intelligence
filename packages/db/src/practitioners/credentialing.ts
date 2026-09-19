// ─── packages/db/src/practitioners/credentialing.ts ───────────────────────────
// SPRINT 4 — practitioner classes, modality separation, credential
// verification states and the assignment-eligibility path.
//
// REUSES the existing architecture: practitioners.category (0051) carries
// the class; the 0051 agreement machinery (immutable versions, RPC-only
// acceptance, id+version+hash gate) is consumed unchanged; lifecycle is the
// 0034 status enum. The AUTHORITATIVE enforcement is in the database
// (migration 0056: practitioner_assignment_eligibility + BEFORE INSERT
// triggers on both assignment surfaces). The pure evaluator here MIRRORS
// that logic for admin display and app-side pre-checks — it never replaces
// the DB gate, and every server assignment path calls the RPC first for a
// clear error while the trigger remains the backstop.
//
// CAPTURE != VERIFICATION: nothing a practitioner submits makes them
// assignable; only admin verification plus every hard condition passing.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { PractitionerCategory } from './agreements'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any>

// ─── Practitioner class (canonical Sprint 4 names ↔ existing 0051 values) ────
// No student class: student/trainee is a supervised training status
// (governanceControls in intakeV2), never a fourth class. Class follows
// registration + professional activity — never modality alone.

export const PRACTITIONER_CLASS_LABELS: Record<PractitionerCategory, string> = {
  regulated_clinician: 'Regulated Healthcare Professional',
  voluntary_registered: 'Accredited Practitioner',
  unregistered: 'NI Verified Practitioner',
}

// ─── Modality / profession (display set — SEPARATE from class) ───────────────
// Maps onto the existing practitioners.primary_professions values; some of
// these professions may be statutorily regulated — class is still never
// inferred from modality.

export const SPRINT4_MODALITIES = [
  'Psychotherapist',
  'Dentist',
  'Acupuncturist',
  'Hijama Practitioner',
  'Herbalist',
  'Naturopath',
  'Nutritional Therapist',
  'Health Coach',
  'Chiropractor',
  'Osteopath',
  'Kinesiologist',
  'Prophetic Medicine Practitioner',
  'Traditional Chinese Medicine Practitioner',
  'Ayurvedic Practitioner',
  'Reflexologist',
  'Hypnotherapist',
] as const

// ─── Eligibility snapshot + pure evaluator (mirror of the 0056 SQL) ──────────

export type DbsStatus = 'required' | 'not_required' | 'pending' | 'clear' | 'flagged'

export interface PractitionerEligibilitySnapshot {
  exists: boolean
  status: string            // 0034 lifecycle: pending_review|approved|active|suspended|archived
  isActive: boolean
  category: PractitionerCategory | null
  hasCurrentAgreementAcceptance: boolean // id + version + exact-text hash
  credentialsVerificationStatus: 'unverified' | 'verified' | 'rejected'
  indemnityRequired: boolean
  insuranceExpiry: string | null // ISO date
  registrationBody: string | null
  registrationNumber: string | null
  registrationStatus: 'registered' | 'lapsed' | 'suspended' | 'not_applicable' | null
  dbsStatus: DbsStatus | null
  scopeStatus: 'none' | 'submitted' | 'approved' | 'revoked'
}

export type EligibilityReason =
  | 'practitioner_not_found'
  | 'practitioner_not_active'
  | 'practitioner_class_not_set'
  | 'no_current_agreement_acceptance'
  | 'credentials_not_verified'
  | 'indemnity_missing'
  | 'indemnity_expired'
  | 'registration_not_current'
  | 'dbs_outstanding'
  | 'scope_not_approved'

/** Pure mirror of practitioner_assignment_eligibility (0056). `today` is
 *  injectable for tests. Fail-closed on every condition. */
export function evaluatePractitionerEligibility(
  snapshot: PractitionerEligibilitySnapshot,
  today: string = new Date().toISOString().slice(0, 10),
): { eligible: boolean; reasons: EligibilityReason[] } {
  if (!snapshot.exists) return { eligible: false, reasons: ['practitioner_not_found'] }
  const reasons: EligibilityReason[] = []

  if (snapshot.status !== 'active' || !snapshot.isActive) reasons.push('practitioner_not_active')
  if (snapshot.category === null) reasons.push('practitioner_class_not_set')
  if (snapshot.category !== null && !snapshot.hasCurrentAgreementAcceptance) {
    reasons.push('no_current_agreement_acceptance')
  }
  if (snapshot.credentialsVerificationStatus !== 'verified') reasons.push('credentials_not_verified')

  if (snapshot.indemnityRequired) {
    if (!snapshot.insuranceExpiry) reasons.push('indemnity_missing')
    else if (snapshot.insuranceExpiry < today) reasons.push('indemnity_expired')
  }

  if (snapshot.category === 'regulated_clinician' || snapshot.category === 'voluntary_registered') {
    if (!snapshot.registrationNumber || !snapshot.registrationBody || snapshot.registrationStatus !== 'registered') {
      reasons.push('registration_not_current')
    }
  }

  if (snapshot.dbsStatus === 'required' || snapshot.dbsStatus === 'pending' || snapshot.dbsStatus === 'flagged') {
    reasons.push('dbs_outstanding')
  }

  if (snapshot.scopeStatus !== 'approved') reasons.push('scope_not_approved')

  return { eligible: reasons.length === 0, reasons }
}

// ─── The RPC path (authoritative below the UI) ────────────────────────────────

/** Calls the 0056 RPC. `gateInstalled: false` means the RPC does not exist
 *  yet (0056 not applied); every OTHER error is fail-closed NOT eligible. */
export async function checkAssignmentEligibility(
  client: AnyClient, practitionerId: string,
): Promise<{ gateInstalled: boolean; eligible: boolean; reasons: string[] }> {
  const { data, error } = await (client as AnyClient)
    .rpc('practitioner_assignment_eligibility', { p_practitioner_id: practitionerId })
  if (error) {
    const missing = error.code === 'PGRST202' || error.code === '42883' ||
      /could not find the function|does not exist/i.test(error.message ?? '')
    if (missing) return { gateInstalled: false, eligible: false, reasons: ['eligibility_rpc_not_installed'] }
    return { gateInstalled: true, eligible: false, reasons: [`eligibility_check_failed:${error.code ?? 'unknown'}`] }
  }
  const row = Array.isArray(data) ? data[0] : data
  if (!row || row.eligible !== true) {
    return { gateInstalled: true, eligible: false, reasons: (row?.reasons as string[] | undefined) ?? ['eligibility_not_confirmed'] }
  }
  return { gateInstalled: true, eligible: true, reasons: [] }
}

/** Shared pre-check used by the server assignment helpers: once 0056 is
 *  applied it throws the named reasons for an ineligible practitioner.
 *  Before 0056 exists it is a no-op so today's (assignment-flag-off)
 *  behaviour and existing suites are unchanged — the AUTHORITATIVE gate is
 *  the 0056 BEFORE INSERT trigger itself, which no caller can bypass; this
 *  helper only surfaces one clear error above it. */
export async function assertPractitionerAssignable(
  client: AnyClient, practitionerId: string,
): Promise<void> {
  const { gateInstalled, eligible, reasons } = await checkAssignmentEligibility(client, practitionerId)
  if (!gateInstalled) return
  if (!eligible) {
    throw new Error(`practitioner not assignable: ${reasons.join(', ')}`)
  }
}

// ─── Admin verification workflow (capture ≠ verification) ────────────────────
// Admin-only server paths; RLS on practitioners already restricts writes.
// Each records the acting admin and timestamp. Pre-0056 these fail with a
// clear message (columns absent) — nothing silently succeeds.

export async function setCredentialsVerification(
  adminClient: AnyClient,
  input: { practitionerId: string; status: 'verified' | 'rejected' | 'unverified'; actorId: string },
): Promise<void> {
  const { error } = await (adminClient as AnyClient)
    .from('practitioners')
    .update({
      credentials_verification_status: input.status,
      credentials_verified_by: input.status === 'unverified' ? null : input.actorId,
      credentials_verified_at: input.status === 'unverified' ? null : new Date().toISOString(),
    })
    .eq('id', input.practitionerId)
  if (error) throw new Error(`setCredentialsVerification failed [${error.code}]: ${error.message} (0056 not applied?)`)
}

export async function setScopeApproval(
  adminClient: AnyClient,
  input: { practitionerId: string; status: 'approved' | 'revoked' | 'submitted'; actorId: string },
): Promise<void> {
  const { error } = await (adminClient as AnyClient)
    .from('practitioners')
    .update({
      scope_status: input.status,
      scope_approved_by: input.status === 'approved' ? input.actorId : null,
      scope_approved_at: input.status === 'approved' ? new Date().toISOString() : null,
    })
    .eq('id', input.practitionerId)
  if (error) throw new Error(`setScopeApproval failed [${error.code}]: ${error.message} (0056 not applied?)`)
}
