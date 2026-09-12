// ─── packages/db/src/consent/records.ts ───────────────────────────────────────
// Sprint 3 — versioned consent grant/read/withdraw helpers.
//
// Writes extend the EXISTING consent_records table (signup consent keeps
// working unchanged). The new columns (consent_version, consent_text, source,
// actor, withdrawn_at) arrive with migration 0051; until it is applied these
// helpers degrade gracefully (see notes per function). consent_records is not
// in the generated Database types' new-column shape yet, so access goes through
// a loose client — the established repo pattern for pre-typegen tables.

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  CONSENT_TEXTS, CONSENT_TEXT_VERSION,
  isConsentPurpose, type ConsentPurpose,
} from './purposes'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any>

export interface ConsentRecordRow {
  id: string
  profile_id: string
  consent_type: string
  consented: boolean
  consented_at: string | null
  consent_version: string | null
  consent_text: string | null
  source: string | null
  withdrawn_at: string | null
}

export interface RecordConsentInput {
  memberId: string
  email: string
  purpose: ConsentPurpose
  consented: boolean
  source: string          // 'signup' | 'intake_start' | 'privacy_page' | …
  actor?: string          // default 'member'
  organisationContext?: string
}

/**
 * Writes one versioned consent row carrying the exact text shown.
 * Throws on invalid purpose or DB failure — callers decide whether a failed
 * consent write must block (it must, wherever collection depends on it).
 */
export async function recordConsent(client: AnyClient, input: RecordConsentInput): Promise<void> {
  if (!isConsentPurpose(input.purpose)) throw new Error(`Unknown consent purpose: ${input.purpose}`)
  const { error } = await (client as AnyClient)
    .from('consent_records')
    .insert({
      profile_id:      input.memberId,
      email:           input.email,
      consent_type:    input.purpose,
      consented:       input.consented,
      consented_at:    new Date().toISOString(),
      consent_version: CONSENT_TEXT_VERSION,
      consent_text:    CONSENT_TEXTS[input.purpose],
      source:          input.source,
      actor:           input.actor ?? 'member',
      organisation_context: input.organisationContext ?? null,
    })
  if (error) throw new Error(`recordConsent failed [${error.code}]: ${error.message}`)
}

/** Outcome of the signup consent write — the caller decides how to log it. */
export interface SignupConsentWriteResult {
  ok: boolean
  /** True when the versioned write failed on missing columns (pre-0051) and
   *  the legacy base-column write was attempted instead. */
  downgraded: boolean
  error: { code?: string; message: string } | null
}

/** PostgREST/Postgres codes meaning "a column in the payload does not exist". */
const MISSING_COLUMN_CODES = ['PGRST204', '42703']

/**
 * Writes the two signup consents (platform_terms + data_processing) as FULLY
 * VERSIONED rows: consent_version, exact consent_text shown, source and actor.
 *
 * Pre-migration compatibility: before 0051 is applied the versioned columns do
 * not exist, so a missing-column failure — and ONLY that failure — retries
 * with the legacy base columns (the pre-Sprint-3 row shape). Every other
 * error is returned unswallowed for the caller to surface loudly.
 */
export async function recordSignupConsents(
  client: AnyClient, memberId: string, email: string,
): Promise<SignupConsentWriteResult> {
  const now = new Date().toISOString()
  const purposes: ConsentPurpose[] = ['platform_terms', 'data_processing']

  const base = purposes.map((p) => ({
    profile_id: memberId, email, consent_type: p, consented: true, consented_at: now,
  }))
  const versioned = purposes.map((p, i) => ({
    ...base[i],
    consent_version: CONSENT_TEXT_VERSION,
    consent_text:    CONSENT_TEXTS[p],
    source:          'signup_form',
    actor:           'member',
  }))

  const { error } = await (client as AnyClient).from('consent_records').insert(versioned)
  if (!error) return { ok: true, downgraded: false, error: null }

  if (!MISSING_COLUMN_CODES.includes(error.code ?? '')) {
    return { ok: false, downgraded: false, error }
  }

  // Pre-0051 schema: fall back to the legacy row shape only.
  const { error: legacyError } = await (client as AnyClient).from('consent_records').insert(base)
  if (legacyError) return { ok: false, downgraded: true, error: legacyError }
  return { ok: true, downgraded: true, error: null }
}

/** All consent rows for a member, newest first. Returns [] if the table/read fails. */
export async function getMemberConsents(client: AnyClient, memberId: string): Promise<ConsentRecordRow[]> {
  const { data, error } = await (client as AnyClient)
    .from('consent_records')
    .select('*')
    .eq('profile_id', memberId)
    .order('consented_at', { ascending: false })
  if (error) return []
  return (data ?? []) as ConsentRecordRow[]
}

/**
 * True when the member's LATEST row for the purpose is a grant (consented,
 * not withdrawn). Fail-closed: any read error, missing table or missing row
 * counts as NOT consented — collection must never proceed on uncertainty.
 */
export async function hasActiveConsent(
  client: AnyClient, memberId: string, purpose: ConsentPurpose,
): Promise<boolean> {
  const { data, error } = await (client as AnyClient)
    .from('consent_records')
    .select('consented, withdrawn_at, consented_at')
    .eq('profile_id', memberId)
    .eq('consent_type', purpose)
    .order('consented_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data) return false
  return data.consented === true && !data.withdrawn_at
}

/** True only when EVERY listed purpose has an active grant (fail-closed). */
export async function hasAllConsents(
  client: AnyClient, memberId: string, purposes: ConsentPurpose[],
): Promise<boolean> {
  for (const p of purposes) {
    if (!(await hasActiveConsent(client, memberId, p))) return false
  }
  return true
}

/**
 * Marks the CALLER'S rows for a purpose withdrawn (rows are never deleted).
 * Consent evidence is append-only to members: there is no member UPDATE policy
 * on consent_records. This goes through the narrow SECURITY DEFINER RPC
 * `withdraw_own_consent` (migration 0051), which can only set withdrawn_at on
 * auth.uid()'s own rows. Returns the number of rows withdrawn.
 */
export async function withdrawConsent(
  client: AnyClient, purpose: ConsentPurpose,
): Promise<number> {
  const { data, error } = await (client as AnyClient)
    .rpc('withdraw_own_consent', { p_consent_type: purpose })
  if (error) throw new Error(`withdrawConsent failed [${error.code}]: ${error.message}`)
  return typeof data === 'number' ? data : 0
}
