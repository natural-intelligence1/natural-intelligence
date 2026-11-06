// ─── packages/db/src/consent/signupPayload.ts ─────────────────────────────────
// Mission 19 — the cross-device carrier for the consent decision made at
// signup.
//
// WHY THIS EXISTS
// supabase.auth.signUp() returns a user and NO session while email
// confirmation is required, so the consent INSERT that used to run straight
// afterwards executed as `anon` and was correctly refused by RLS. Across the
// whole live database there has never been a consent_records row with
// source='signup_form'.
//
// A short-lived signed cookie was assessed and rejected: it is bound to the
// browser that submitted the form, so confirming the email on a phone — the
// common case — silently reproduces the same defect. The carrier here is the
// USER RECORD (auth.users.raw_user_meta_data), which is why it survives a
// different device, a different browser and a reinstalled app.
//
// WHY IT IS SIGNED
// raw_user_meta_data is writable by the user themselves via updateUser() once
// they hold a session, so the payload cannot be trusted on its face. Every
// field that carries meaning is covered by a server-side HMAC. A member can
// still refuse consent, and can still withdraw it afterwards — what they
// cannot do is manufacture or back-date a grant.
//
// NODE RUNTIME ONLY. This imports node:crypto; never import it from Edge
// middleware.

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import {
  CONSENT_TEXT_VERSION, isKnownConsentVersion, isConsentPurpose,
  type ConsentPurpose,
} from './purposes'

/** Bumped only when the payload SHAPE changes. Old versions stay verifiable. */
export const SIGNUP_CONSENT_PAYLOAD_VERSION = 1

/** The metadata key the payload travels under. */
export const SIGNUP_CONSENT_METADATA_KEY = 'signup_consent'

/** The metadata key stamped once the payload has been consumed. */
export const SIGNUP_CONSENT_PERSISTED_KEY = 'signup_consent_persisted_at'

/** Domain separator, so the derived key can never collide with another use. */
const HMAC_DOMAIN = 'ni:signup-consent:v1'

export interface SignupConsentPayload {
  /** Payload shape version. */
  pv: number
  /**
   * The subject, as the email address shown on the signup form, lowercased
   * and trimmed.
   *
   * Deliberately NOT the profile uuid: the payload has to be handed to
   * signUp() as options.data, which is BEFORE the user row exists, so there
   * is no uuid to sign yet. Verification therefore binds the payload to the
   * authenticated session's own email, and the row that gets written takes
   * its profile_id from the session — never from the payload.
   */
  sub_email: string
  /** The purposes the member actively accepted, sorted. */
  purposes: ConsentPurpose[]
  /** The consent text version ACTUALLY DISPLAYED to them. */
  version: string
  /** When the member made the decision (ISO 8601). Becomes consented_at. */
  decided_at: string
  /** Single-use marker, so two signups cannot produce an identical payload. */
  nonce: string
  /** Hex HMAC-SHA256 over the canonical form of everything above. */
  sig: string
}

export type SignupConsentVerification =
  | { ok: true;  payload: SignupConsentPayload }
  | { ok: false; reason:
        | 'absent'            // nothing to verify
        | 'malformed'         // not the expected shape
        | 'unsupported_version' // payload shape from a newer build
        | 'bad_signature'     // tampered, or signed with a rotated key
        | 'unknown_consent_version' // version is not in the archive → re-ask
        | 'subject_mismatch'  // payload belongs to a different email
        | 'no_secret'         // server cannot verify at all
    }

// ─── Key derivation ───────────────────────────────────────────────────────────
// Prefers an explicit SIGNUP_CONSENT_SECRET. Falls back to deriving a key from
// SUPABASE_SERVICE_ROLE_KEY, which is already required for the app to run — so
// the fix needs no new environment variable and no deploy coordination.
//
// There is deliberately NO hardcoded development default. If neither secret is
// present the payload is not produced at all, and the member is asked to
// re-affirm on first authenticated entry. Silence is never treated as consent.
//
// Key rotation is safe: payloads signed with the old key fail verification,
// which routes those members to the same re-affirmation gate.
function signingKey(): Buffer | null {
  const explicit = process.env.SIGNUP_CONSENT_SECRET
  if (explicit && explicit.length >= 16) {
    return createHmac('sha256', explicit).update(HMAC_DOMAIN).digest()
  }
  const derived = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (derived && derived.length >= 16) {
    return createHmac('sha256', derived).update(HMAC_DOMAIN).digest()
  }
  return null
}

/** True when this server is able to sign and verify payloads at all. */
export function canSignSignupConsent(): boolean {
  return signingKey() !== null
}

// ─── Canonical form ───────────────────────────────────────────────────────────
// Field order is fixed here rather than taken from object key order, so the
// signature cannot be changed by a JSON round-trip or a reordered literal.
function canonicalise(p: Omit<SignupConsentPayload, 'sig'>): string {
  return JSON.stringify([
    p.pv,
    p.sub_email,
    p.purposes.slice().sort(),
    p.version,
    p.decided_at,
    p.nonce,
  ])
}

function sign(p: Omit<SignupConsentPayload, 'sig'>, key: Buffer): string {
  return createHmac('sha256', key).update(canonicalise(p)).digest('hex')
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase()
}

// ─── Build (signup side) ──────────────────────────────────────────────────────

/**
 * Builds the signed payload to hand to signUp() as options.data.
 *
 * Returns null when the server holds no signing secret. Callers must treat
 * null as "no evidence captured" and let the re-affirmation gate ask again —
 * never as "consent given".
 */
export function buildSignupConsentPayload(input: {
  email:     string
  purposes:  ConsentPurpose[]
  /** Defaults to now. Pass the moment the form was actually submitted. */
  decidedAt?: Date
  /** Defaults to the current version. Pass the version actually rendered. */
  version?:   string
}): SignupConsentPayload | null {
  const key = signingKey()
  if (!key) return null

  const unsigned: Omit<SignupConsentPayload, 'sig'> = {
    pv:         SIGNUP_CONSENT_PAYLOAD_VERSION,
    sub_email:  normaliseEmail(input.email),
    purposes:   input.purposes.slice().sort(),
    version:    input.version ?? CONSENT_TEXT_VERSION,
    decided_at: (input.decidedAt ?? new Date()).toISOString(),
    nonce:      randomBytes(16).toString('hex'),
  }

  return { ...unsigned, sig: sign(unsigned, key) }
}

// ─── Verify (callback side) ───────────────────────────────────────────────────

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string')
}

/**
 * Verifies a payload read from raw_user_meta_data against the authenticated
 * session's email.
 *
 * Fails closed on every uncertainty, including an archived-version miss: a
 * version that is no longer in CONSENT_TEXT_ARCHIVE must NOT be resolved to
 * current wording, so the member is asked to re-affirm instead.
 */
export function verifySignupConsentPayload(
  raw: unknown,
  expected: { email: string },
): SignupConsentVerification {
  if (raw === null || raw === undefined) return { ok: false, reason: 'absent' }
  if (typeof raw !== 'object')           return { ok: false, reason: 'malformed' }

  const key = signingKey()
  if (!key) return { ok: false, reason: 'no_secret' }

  const r = raw as Record<string, unknown>

  if (typeof r.pv !== 'number')          return { ok: false, reason: 'malformed' }
  if (r.pv > SIGNUP_CONSENT_PAYLOAD_VERSION) return { ok: false, reason: 'unsupported_version' }
  if (typeof r.sub_email  !== 'string')  return { ok: false, reason: 'malformed' }
  if (typeof r.version    !== 'string')  return { ok: false, reason: 'malformed' }
  if (typeof r.decided_at !== 'string')  return { ok: false, reason: 'malformed' }
  if (typeof r.nonce      !== 'string')  return { ok: false, reason: 'malformed' }
  if (typeof r.sig        !== 'string')  return { ok: false, reason: 'malformed' }
  if (!isStringArray(r.purposes) || r.purposes.length === 0) {
    return { ok: false, reason: 'malformed' }
  }
  if (!r.purposes.every(isConsentPurpose)) return { ok: false, reason: 'malformed' }
  if (Number.isNaN(Date.parse(r.decided_at))) return { ok: false, reason: 'malformed' }

  const unsigned: Omit<SignupConsentPayload, 'sig'> = {
    pv:         r.pv,
    sub_email:  r.sub_email,
    purposes:   r.purposes as ConsentPurpose[],
    version:    r.version,
    decided_at: r.decided_at,
    nonce:      r.nonce,
  }

  const actual   = Buffer.from(sign(unsigned, key), 'utf8')
  const supplied = Buffer.from(r.sig, 'utf8')
  if (actual.length !== supplied.length || !timingSafeEqual(actual, supplied)) {
    return { ok: false, reason: 'bad_signature' }
  }

  // Signature is good — now the two meaning checks.
  if (!isKnownConsentVersion(unsigned.version)) {
    return { ok: false, reason: 'unknown_consent_version' }
  }
  if (unsigned.sub_email !== normaliseEmail(expected.email)) {
    return { ok: false, reason: 'subject_mismatch' }
  }

  return { ok: true, payload: { ...unsigned, sig: r.sig } }
}
