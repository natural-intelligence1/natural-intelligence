// ─── packages/db/src/consent/practitionerAccess.ts ──────────────────────────
// Consent for ONE named practitioner to access a client's record.
//
// NO NEW TABLE, NO SCHEMA CHANGE. consent_records already holds this:
// consent_type = 'practitioner_access' is in its CHECK, context_practitioner_id
// references practitioners(id), members may INSERT their own rows, and
// withdraw_own_consent already accepts a p_context_practitioner_id.
//
// WHY THIS FILE EXISTS
//
// Practitioner-scoped consent cannot go through the member-wide helpers, and
// the failure if it does is severe and silent:
//
//   · hasActiveConsent filters on profile_id + consent_type ALONE. Asked
//     about 'practitioner_access' it returns the client's most recent grant
//     for ANY practitioner — so a client who approved Practitioner A would
//     read as having approved Practitioner B.
//
//   · withdrawConsent called the RPC without p_context_practitioner_id, and
//     the RPC treats a null id as "every row for this purpose". Withdrawing
//     access from one practitioner would have withdrawn it from all of them.
//
// Both are now refused by construction: 'practitioner_access' is deliberately
// kept OUT of CONSENT_PURPOSES so the member-wide functions cannot be asked
// about it by a well-typed caller, and both guard against it at runtime for
// callers that cast.
//
// WHAT THIS DOES NOT DO
//
// It does not manufacture consent. Case-team membership, a
// client_practitioner_links row, an assignment and case ownership are NOT
// consent and none of them is consulted here. Explicit consent stays explicit:
// absent a matching row, the answer is no.

import type { SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any>

/**
 * Consent purposes that are meaningless without a named practitioner.
 *
 * Kept separate from CONSENT_PURPOSES on purpose. Adding 'practitioner_access'
 * there would make the practitioner-blind hasActiveConsent accept it, which is
 * exactly the bug this module exists to prevent.
 */
export const PRACTITIONER_SCOPED_CONSENTS = ['practitioner_access'] as const
export type PractitionerScopedConsent = (typeof PRACTITIONER_SCOPED_CONSENTS)[number]

export function isPractitionerScopedConsent(value: string): value is PractitionerScopedConsent {
  return (PRACTITIONER_SCOPED_CONSENTS as readonly string[]).includes(value)
}

/**
 * The consent text for practitioner_access has not been drafted or reviewed.
 *
 * Reading consent is safe; RECORDING it is not, because every consent row must
 * carry the exact wording the client agreed to. No writer is exported from
 * this module for that reason.
 */
export const PRACTITIONER_ACCESS_CONSENT_TEXT_PENDING = true as const

export interface PractitionerAccessConsent {
  practitionerId: string
  consentedAt: string | null
  withdrawnAt: string | null
  active: boolean
  consentVersion: string | null
}

interface Row {
  context_practitioner_id: string | null
  consented: boolean | null
  consented_at: string | null
  withdrawn_at: string | null
  consent_version: string | null
}

const isActive = (r: Row) => r.consented === true && !r.withdrawn_at

/**
 * THE DATABASE ALREADY HAS THIS CHECK, AND IT DIFFERS SLIGHTLY.
 *
 * `has_practitioner_access_consent(member, practitioner)` exists live and is
 * part of `can_access_case_care_profile`, the full authority chain used by
 * case_contributions and case_analysis_plan. It reads the same three columns.
 *
 * The difference is which row decides:
 *
 *   · the function asks whether ANY active row exists;
 *   · this module asks whether the LATEST row for the pairing is active,
 *     matching the member-wide hasActiveConsent in records.ts.
 *
 * They diverge only when a grant is followed by a recorded REFUSAL rather than
 * a withdrawal: the function still says yes, this module says no. This module
 * deliberately takes the stricter reading — a later "no" from the client
 * should not be overridden by an earlier "yes" — and that direction is safe,
 * because anything this module authorises the database would authorise too,
 * never the reverse.
 *
 * WHICH IS CANONICAL IS A FOUNDER DECISION, not one to settle silently here.
 * Until it is settled, the database remains the permission boundary and this
 * module is the stricter application-side reading.
 */
export const CONSENT_SEMANTICS = {
  thisModule: 'latest_row_for_pairing' as const,
  databaseFunction: 'any_active_row' as const,
  divergesWhen: 'a grant is followed by a recorded refusal rather than a withdrawal',
  thisModuleIsStricter: true,
  needsFounderDecision: true,
} as const

/**
 * Has this client given THIS practitioner access to their record?
 *
 * Fail-closed in every uncertain case: a read error, a missing row, a row for
 * a different practitioner, or a row with no practitioner recorded at all all
 * answer false. A consent question answered optimistically is a disclosure.
 *
 * The latest row for this exact pairing decides, so a withdrawal followed by a
 * fresh grant reads as granted, and a grant followed by a withdrawal does not.
 */
export async function hasActivePractitionerAccessConsent(
  client: AnyClient, memberId: string, practitionerId: string,
): Promise<boolean> {
  if (!memberId || !practitionerId) return false

  const { data, error } = await (client as AnyClient)
    .from('consent_records')
    .select('context_practitioner_id, consented, consented_at, withdrawn_at, consent_version')
    .eq('profile_id', memberId)
    .eq('consent_type', 'practitioner_access')
    .eq('context_practitioner_id', practitionerId)
    .order('consented_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return false
  // Belt and braces: the filter above should make this impossible, but a
  // consent check is the wrong place to trust that.
  if ((data as Row).context_practitioner_id !== practitionerId) return false
  return isActive(data as Row)
}

/**
 * Every practitioner this client has ever granted access to, latest state per
 * practitioner, newest first. Rows with no practitioner recorded are dropped:
 * an unscoped practitioner_access row cannot be attributed to anyone, so it
 * authorises nobody.
 */
export async function listPractitionerAccessConsents(
  client: AnyClient, memberId: string,
): Promise<PractitionerAccessConsent[]> {
  const { data, error } = await (client as AnyClient)
    .from('consent_records')
    .select('context_practitioner_id, consented, consented_at, withdrawn_at, consent_version')
    .eq('profile_id', memberId)
    .eq('consent_type', 'practitioner_access')
    .order('consented_at', { ascending: false })

  if (error) return []

  const latest = new Map<string, PractitionerAccessConsent>()
  for (const r of (data ?? []) as Row[]) {
    const id = r.context_practitioner_id
    if (!id || latest.has(id)) continue   // ordered newest first, so the first wins
    latest.set(id, {
      practitionerId: id,
      consentedAt: r.consented_at,
      withdrawnAt: r.withdrawn_at,
      active: isActive(r),
      consentVersion: r.consent_version,
    })
  }
  return [...latest.values()]
}

/**
 * Withdraw access from ONE named practitioner.
 *
 * Goes through the same withdraw_own_consent RPC as every other withdrawal —
 * it already accepts p_context_practitioner_id and already permits this
 * purpose — but always passes the practitioner, because the RPC treats a null
 * id as "every practitioner". Returns the number of rows withdrawn.
 */
export async function withdrawPractitionerAccess(
  client: AnyClient, practitionerId: string,
): Promise<number> {
  if (!practitionerId) {
    throw new Error(
      'withdrawPractitionerAccess requires a practitioner: withdrawing without one would ' +
      'withdraw access from every practitioner at once',
    )
  }
  const { data, error } = await (client as AnyClient).rpc('withdraw_own_consent', {
    p_consent_type: 'practitioner_access',
    p_context_practitioner_id: practitionerId,
  })
  if (error) throw new Error(`withdrawPractitionerAccess failed [${error.code}]: ${error.message}`)
  return typeof data === 'number' ? data : 0
}
