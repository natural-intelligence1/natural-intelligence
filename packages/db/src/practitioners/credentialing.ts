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

// ─── The three writes the readiness audit found missing ─────────────────────
// Each is a plain recorded fact, not a judgement. Eligibility is still decided
// solely by practitioner_assignment_eligibility(); nothing below re-derives it.

/**
 * Set the practitioner class. This is the field that gates two further
 * eligibility conditions: with the class unset, the agreement-acceptance and
 * registration checks are not evaluated at all, so setting it may reveal
 * failures rather than clear them — that is correct behaviour, not a bug.
 *
 * The database refuses a change to 'unregistered' while the practitioner holds
 * an active Lead role (0060). That error is surfaced, not swallowed.
 */
export async function setPractitionerClass(
  adminClient: AnyClient,
  input: { practitionerId: string; category: PractitionerCategory | null },
): Promise<void> {
  const { error } = await (adminClient as AnyClient)
    .from('practitioners')
    .update({ category: input.category })
    .eq('id', input.practitionerId)
  if (error) {
    throw new Error(`setPractitionerClass failed [${error.code}]: ${error.message}`)
  }
}

/**
 * Record indemnity evidence. `expiry` is the date on the certificate the admin
 * has seen. Setting `required = false` is the documented route for a
 * practitioner whose cover is carried elsewhere; it is recorded explicitly
 * rather than inferred from a missing expiry.
 */
export async function setIndemnityEvidence(
  adminClient: AnyClient,
  input: { practitionerId: string; required: boolean; expiry: string | null },
): Promise<void> {
  const { error } = await (adminClient as AnyClient)
    .from('practitioners')
    .update({ indemnity_required: input.required, insurance_expiry: input.expiry })
    .eq('id', input.practitionerId)
  if (error) {
    throw new Error(`setIndemnityEvidence failed [${error.code}]: ${error.message}`)
  }
}

/**
 * Record statutory/accredited registration. Required by
 * practitioner_assignment_eligibility() for the two registered classes; for
 * 'unregistered' it is simply not consulted.
 */
export async function setRegistrationDetails(
  adminClient: AnyClient,
  input: {
    practitionerId: string
    registrationBody: string | null
    registrationNumber: string | null
    registrationStatus: 'registered' | 'lapsed' | 'suspended' | 'not_applicable' | null
  },
): Promise<void> {
  const { error } = await (adminClient as AnyClient)
    .from('practitioners')
    .update({
      registration_body: input.registrationBody,
      registration_number: input.registrationNumber,
      registration_status: input.registrationStatus,
    })
    .eq('id', input.practitionerId)
  if (error) {
    throw new Error(`setRegistrationDetails failed [${error.code}]: ${error.message}`)
  }
}

// ─── Read-only readiness view, for the admin panel ──────────────────────────

export type FieldState =
  | 'missing'            // nothing recorded
  | 'supplied_unverified' // recorded but not admin-verified
  | 'verified'           // verified / current
  | 'expired'            // recorded and out of date
  | 'not_applicable'     // the class does not require it

export interface ReadinessField {
  field: string
  label: string
  state: FieldState
  value: string | null
  /** True when this field appears in the authoritative eligibility reasons. */
  blocking: boolean
}

/** Classify the readiness fields for display. Presentation only — `blocking`
 *  is taken from the eligibility function's own reasons, never recomputed. */
export function describeReadiness(
  p: {
    category: string | null
    credentials_verification_status: string | null
    indemnity_required: boolean | null
    insurance_expiry: string | null
    registration_body: string | null
    registration_number: string | null
    registration_status: string | null
    dbs_status: string | null
    scope_status: string | null
  },
  reasons: string[],
  today: string = new Date().toISOString().slice(0, 10),
): ReadinessField[] {
  const has = (r: string) => reasons.includes(r)
  const registered = p.category === 'regulated_clinician' || p.category === 'voluntary_registered'

  const indemnityState: FieldState =
    p.indemnity_required === false ? 'not_applicable'
      : !p.insurance_expiry ? 'missing'
        : p.insurance_expiry < today ? 'expired' : 'verified'

  const registrationState: FieldState =
    !p.category ? 'missing'
      : !registered ? 'not_applicable'
        : (!p.registration_number || !p.registration_body) ? 'missing'
          : p.registration_status === 'registered' ? 'verified' : 'supplied_unverified'

  return [
    { field: 'category', label: 'Practitioner class', value: p.category,
      state: p.category ? 'verified' : 'missing',
      blocking: has('practitioner_class_not_set') },
    { field: 'agreement', label: 'Current agreement accepted', value: null,
      state: has('no_current_agreement_acceptance') ? 'missing'
        : p.category ? 'verified' : 'not_applicable',
      blocking: has('no_current_agreement_acceptance') },
    { field: 'credentials', label: 'Credentials verified',
      value: p.credentials_verification_status,
      state: p.credentials_verification_status === 'verified' ? 'verified'
        : p.credentials_verification_status ? 'supplied_unverified' : 'missing',
      blocking: has('credentials_not_verified') },
    { field: 'indemnity', label: 'Professional indemnity',
      value: p.insurance_expiry, state: indemnityState,
      blocking: has('indemnity_missing') || has('indemnity_expired') },
    { field: 'registration', label: 'Registration',
      value: p.registration_number ? `${p.registration_body ?? '?'} · ${p.registration_number}` : null,
      state: registrationState, blocking: has('registration_not_current') },
    { field: 'dbs', label: 'DBS', value: p.dbs_status,
      state: !p.dbs_status ? 'not_applicable'
        : ['required', 'pending', 'flagged'].includes(p.dbs_status) ? 'supplied_unverified' : 'verified',
      blocking: has('dbs_outstanding') },
    { field: 'scope', label: 'Scope of practice', value: p.scope_status,
      state: p.scope_status === 'approved' ? 'verified'
        : p.scope_status && p.scope_status !== 'none' ? 'supplied_unverified' : 'missing',
      blocking: has('scope_not_approved') },
  ]
}
