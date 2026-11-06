// ─── packages/db/src/consent/foundational.ts ──────────────────────────────────
// Mission 19 — persisting the signup consent decision, and the backstop for
// accounts that hold no evidence.
//
// Everything here writes through the AUTHENTICATED client, so the existing
// `Members create own consent records` policy
// (TO authenticated WITH CHECK (profile_id = auth.uid())) is what admits the
// row. No anon policy is added, no service-role write is used, and email
// confirmation is untouched.

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  CONSENT_TEXT_VERSION, resolveConsentText, type ConsentPurpose,
} from './purposes'
import {
  SIGNUP_CONSENT_METADATA_KEY, SIGNUP_CONSENT_PERSISTED_KEY,
  verifySignupConsentPayload, type SignupConsentPayload,
} from './signupPayload'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any>

/**
 * The consents every account must hold. Not withdrawable through the normal
 * member route — see withdrawConsent(), which refuses these and routes them to
 * the client_rights_requests channel instead.
 */
export const FOUNDATIONAL_CONSENTS: ConsentPurpose[] = ['platform_terms', 'data_processing']

/** The source string a signup-carried grant is written under. */
export const SIGNUP_CONSENT_SOURCE = 'signup_form'

/** The source string the re-affirmation gate writes under. */
export const REAFFIRMATION_CONSENT_SOURCE = 'reaffirmation'

export type PersistSignupConsentStatus =
  | 'persisted'          // rows written
  | 'already_recorded'   // this signup decision is already on file
  | 'no_payload'         // nothing carried — the gate will ask
  | 'rejected'           // payload present but not trustworthy
  | 'write_failed'       // RLS or transport refused the insert

export interface PersistSignupConsentResult {
  status:  PersistSignupConsentStatus
  written: number
  /** Verification reason / DB code, for logging. Never shown to the member. */
  detail?: string
}

/**
 * The REPLAY GUARD key.
 *
 * A signup payload records ONE historical decision. If a row for this
 * (profile, purpose, version) already exists from signup, that decision is
 * already on file and must not be written again — including when the member
 * has since withdrawn it, because replaying a stale payload would silently
 * re-grant something they revoked.
 *
 * `source` is part of the key on purpose: a later genuine re-consent to the
 * same version arrives through the re-affirmation gate under a different
 * source, and must still be free to append.
 */
async function signupGrantAlreadyRecorded(
  client: AnyClient, memberId: string, purpose: ConsentPurpose, version: string,
): Promise<{ exists: boolean; error?: string }> {
  const { data, error } = await (client as AnyClient)
    .from('consent_records')
    .select('id')
    .eq('profile_id', memberId)
    .eq('consent_type', purpose)
    .eq('consent_version', version)
    .eq('source', SIGNUP_CONSENT_SOURCE)
    .limit(1)
  // Fail CLOSED on a read error: refuse to write rather than risk a duplicate
  // we cannot see. The gate remains available either way.
  if (error) return { exists: true, error: `${error.code}: ${error.message}` }
  return { exists: (data?.length ?? 0) > 0 }
}

/**
 * Verifies the signup payload on the authenticated user and writes the consent
 * rows it attests to.
 *
 * Call this immediately after exchangeCodeForSession(), which is the first
 * moment a session exists. Safe to call again on any later authenticated
 * request — it is idempotent by the replay guard above.
 */
export async function persistSignupConsentFromMetadata(
  client: AnyClient,
  user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null },
): Promise<PersistSignupConsentResult> {
  const email = user.email ?? ''
  const raw   = user.user_metadata?.[SIGNUP_CONSENT_METADATA_KEY]

  if (raw === null || raw === undefined) return { status: 'no_payload', written: 0 }
  if (!email) return { status: 'rejected', written: 0, detail: 'session carries no email' }

  const verified = verifySignupConsentPayload(raw, { email })
  if (!verified.ok) {
    // 'absent' cannot occur here (raw is present), so every miss is a genuine
    // rejection. An unknown_consent_version lands here too: the archived text
    // is gone, so the decision cannot be evidenced and must be re-asked.
    return { status: 'rejected', written: 0, detail: verified.reason }
  }

  const payload: SignupConsentPayload = verified.payload
  const rows: Record<string, unknown>[] = []

  for (const purpose of payload.purposes) {
    const text = resolveConsentText(payload.version, purpose)
    // Fail closed: never substitute current wording for an archived version.
    if (text === null) {
      return {
        status: 'rejected', written: 0,
        detail: `no archived text for ${purpose}@${payload.version}`,
      }
    }

    const seen = await signupGrantAlreadyRecorded(client, user.id, purpose, payload.version)
    if (seen.error) return { status: 'write_failed', written: 0, detail: seen.error }
    if (seen.exists) continue

    rows.push({
      profile_id:      user.id,          // from the SESSION, never the payload
      email,
      consent_type:    purpose,
      consented:       true,
      // The decision moment, carried across the confirmation gap.
      consented_at:    payload.decided_at,
      // created_at is left to its now() default — the persistence moment. The
      // gap between the two is legitimate audit evidence and is not hidden.
      consent_version: payload.version,
      consent_text:    text,
      source:          SIGNUP_CONSENT_SOURCE,
      actor:           'member',
    })
  }

  if (rows.length === 0) {
    await markSignupConsentConsumed(client)
    return { status: 'already_recorded', written: 0 }
  }

  const { error } = await (client as AnyClient).from('consent_records').insert(rows)
  if (error) {
    return { status: 'write_failed', written: 0, detail: `${error.code}: ${error.message}` }
  }

  await markSignupConsentConsumed(client)
  return { status: 'persisted', written: rows.length }
}

/**
 * Clears the payload and stamps when it was consumed.
 *
 * Best effort by design. The replay guard — not this marker — is what makes a
 * repeated callback safe, so a failure here cannot produce a duplicate row. It
 * only means the payload is re-verified needlessly on the next request.
 */
export async function markSignupConsentConsumed(client: AnyClient): Promise<void> {
  try {
    await client.auth.updateUser({
      data: {
        [SIGNUP_CONSENT_METADATA_KEY]:  null,
        [SIGNUP_CONSENT_PERSISTED_KEY]: new Date().toISOString(),
      },
    })
  } catch {
    // Non-fatal — see above.
  }
}

export interface FoundationalConsentState {
  /** True when every foundational purpose has an active, un-withdrawn grant. */
  satisfied: boolean
  missing:   ConsentPurpose[]
  /** True when the read itself failed, so `missing` is not authoritative. */
  unreadable: boolean
}

/**
 * Which foundational consents the member is missing.
 *
 * Accepts a grant at ANY archived version, not just the current one: a member
 * who genuinely accepted version X has consented, and forcing re-affirmation
 * on every wording change is a product decision, not a safety one. Whether a
 * version bump should re-prompt is left to the Founder.
 *
 * Fail-closed on a read error: `satisfied` is false, so the gate shows rather
 * than being skipped on uncertainty.
 */
export async function getFoundationalConsentState(
  client: AnyClient, memberId: string,
): Promise<FoundationalConsentState> {
  const { data, error } = await (client as AnyClient)
    .from('consent_records')
    .select('consent_type, consented, withdrawn_at, consented_at')
    .eq('profile_id', memberId)
    .in('consent_type', FOUNDATIONAL_CONSENTS)
    .order('consented_at', { ascending: false })

  if (error) {
    return { satisfied: false, missing: [...FOUNDATIONAL_CONSENTS], unreadable: true }
  }

  const rows = (data ?? []) as {
    consent_type: string; consented: boolean; withdrawn_at: string | null
  }[]

  const missing = FOUNDATIONAL_CONSENTS.filter((purpose) => {
    // Newest row for the purpose decides — a withdrawal after a grant means
    // not consented, and a re-grant after a withdrawal means consented.
    const latest = rows.find((r) => r.consent_type === purpose)
    return !latest || latest.consented !== true || latest.withdrawn_at !== null
  })

  return { satisfied: missing.length === 0, missing, unreadable: false }
}

/**
 * The authenticated-entry backstop: persist anything the signup carried, then
 * report whether the member still needs to be asked.
 *
 * Deliberately does NOT redirect or throw — the caller decides where the gate
 * belongs, so that Privacy and Data Rights routes can stay reachable while a
 * member is otherwise gated.
 */
export async function ensureFoundationalConsents(
  client: AnyClient,
  user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null },
): Promise<{ state: FoundationalConsentState; persist: PersistSignupConsentResult }> {
  const persist = await persistSignupConsentFromMetadata(client, user)
  const state   = await getFoundationalConsentState(client, user.id)
  return { state, persist }
}

/**
 * Records a re-affirmation: the member actively accepting the CURRENT version
 * now. Used only by the gate.
 *
 * No historical acceptance is ever manufactured — consented_at is the real
 * moment of this decision, not the account's creation date.
 */
export async function recordFoundationalReaffirmation(
  client: AnyClient,
  user: { id: string; email?: string | null },
  purposes: ConsentPurpose[],
): Promise<{ ok: boolean; written: number; detail?: string }> {
  const now  = new Date().toISOString()
  const rows = purposes.map((purpose) => {
    const text = resolveConsentText(CONSENT_TEXT_VERSION, purpose)
    if (text === null) throw new Error(`No archived consent text for ${purpose}@${CONSENT_TEXT_VERSION}`)
    return {
      profile_id:      user.id,
      email:           user.email ?? '',
      consent_type:    purpose,
      consented:       true,
      consented_at:    now,   // the real decision moment — never back-dated
      consent_version: CONSENT_TEXT_VERSION,
      consent_text:    text,
      source:          REAFFIRMATION_CONSENT_SOURCE,
      actor:           'member',
    }
  })

  if (rows.length === 0) return { ok: true, written: 0 }

  const { error } = await (client as AnyClient).from('consent_records').insert(rows)
  if (error) return { ok: false, written: 0, detail: `${error.code}: ${error.message}` }
  return { ok: true, written: rows.length }
}
