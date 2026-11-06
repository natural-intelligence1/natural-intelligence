// ─── signupPayload.test.ts ────────────────────────────────────────────────────
// Mission 19 — the signed cross-device consent carrier.
//
// What these tests are actually defending: raw_user_meta_data is writable by
// the member via updateUser() once they hold a session, so the payload is only
// worth anything if forging and back-dating are detectable.

import { beforeEach, afterEach, describe, it, expect } from 'vitest'
import {
  SIGNUP_CONSENT_PAYLOAD_VERSION,
  buildSignupConsentPayload, canSignSignupConsent, normaliseEmail,
  verifySignupConsentPayload,
} from './signupPayload'
import { CONSENT_TEXT_VERSION } from './purposes'

const SECRET = 'test-signing-secret-at-least-16-chars'
const EMAIL  = 'member@example.com'

let savedSecret: string | undefined
let savedServiceKey: string | undefined

beforeEach(() => {
  savedSecret     = process.env.SIGNUP_CONSENT_SECRET
  savedServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  process.env.SIGNUP_CONSENT_SECRET = SECRET
})

afterEach(() => {
  if (savedSecret === undefined) delete process.env.SIGNUP_CONSENT_SECRET
  else process.env.SIGNUP_CONSENT_SECRET = savedSecret
  if (savedServiceKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
  else process.env.SUPABASE_SERVICE_ROLE_KEY = savedServiceKey
})

function build(overrides: Partial<Parameters<typeof buildSignupConsentPayload>[0]> = {}) {
  const p = buildSignupConsentPayload({
    email:    EMAIL,
    purposes: ['platform_terms', 'data_processing'],
    ...overrides,
  })
  if (!p) throw new Error('expected a payload')
  return p
}

describe('buildSignupConsentPayload', () => {
  it('carries the subject, purposes, version, decision time and a nonce', () => {
    const decidedAt = new Date('2026-11-06T10:00:00.000Z')
    const p = build({ decidedAt })

    expect(p.pv).toBe(SIGNUP_CONSENT_PAYLOAD_VERSION)
    expect(p.sub_email).toBe(EMAIL)
    expect(p.purposes).toEqual(['data_processing', 'platform_terms']) // sorted
    expect(p.version).toBe(CONSENT_TEXT_VERSION)
    expect(p.decided_at).toBe('2026-11-06T10:00:00.000Z')
    expect(p.nonce).toMatch(/^[0-9a-f]{32}$/)
    expect(p.sig).toMatch(/^[0-9a-f]{64}$/)
  })

  it('normalises the subject email', () => {
    expect(build({ email: '  Member@Example.COM ' }).sub_email).toBe(EMAIL)
    expect(normaliseEmail(' A@B.COM ')).toBe('a@b.com')
  })

  it('gives every signup a distinct nonce', () => {
    expect(build().nonce).not.toBe(build().nonce)
  })

  it('returns null — never an unsigned payload — when no secret is available', () => {
    delete process.env.SIGNUP_CONSENT_SECRET
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    expect(canSignSignupConsent()).toBe(false)
    expect(buildSignupConsentPayload({ email: EMAIL, purposes: ['platform_terms'] })).toBeNull()
  })

  it('derives a key from the service role key when no explicit secret is set', () => {
    delete process.env.SIGNUP_CONSENT_SECRET
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key-at-least-16-chars'
    expect(canSignSignupConsent()).toBe(true)
    const p = build()
    expect(verifySignupConsentPayload(p, { email: EMAIL }).ok).toBe(true)
  })
})

describe('verifySignupConsentPayload', () => {
  it('accepts a payload it signed', () => {
    const result = verifySignupConsentPayload(build(), { email: EMAIL })
    expect(result.ok).toBe(true)
  })

  it('accepts a payload that survived a JSON round-trip', () => {
    // This is the real path: the payload goes through Supabase as JSON and
    // comes back with whatever key order the database feels like.
    const raw = JSON.parse(JSON.stringify(build()))
    expect(verifySignupConsentPayload(raw, { email: EMAIL }).ok).toBe(true)
  })

  it('is not fooled by reordered keys', () => {
    const p = build()
    const reordered = {
      sig: p.sig, nonce: p.nonce, decided_at: p.decided_at,
      version: p.version, purposes: p.purposes, sub_email: p.sub_email, pv: p.pv,
    }
    expect(verifySignupConsentPayload(reordered, { email: EMAIL }).ok).toBe(true)
  })

  it('rejects an added purpose', () => {
    const p = build({ purposes: ['platform_terms'] })
    const forged = { ...p, purposes: ['platform_terms', 'ai_assisted_processing'] }
    const r = verifySignupConsentPayload(forged, { email: EMAIL })
    expect(r).toEqual({ ok: false, reason: 'bad_signature' })
  })

  it('rejects a back-dated decision', () => {
    const p = build()
    const forged = { ...p, decided_at: '2020-01-01T00:00:00.000Z' }
    expect(verifySignupConsentPayload(forged, { email: EMAIL })).toEqual({
      ok: false, reason: 'bad_signature',
    })
  })

  it('rejects a swapped consent version', () => {
    const p = build()
    const forged = { ...p, version: 'some-other-version' }
    expect(verifySignupConsentPayload(forged, { email: EMAIL })).toEqual({
      ok: false, reason: 'bad_signature',
    })
  })

  it('rejects a payload signed with a different key', () => {
    const p = build()
    process.env.SIGNUP_CONSENT_SECRET = 'a-completely-different-secret-key'
    expect(verifySignupConsentPayload(p, { email: EMAIL })).toEqual({
      ok: false, reason: 'bad_signature',
    })
  })

  it('rejects a payload lifted onto another account', () => {
    const p = build()
    expect(verifySignupConsentPayload(p, { email: 'someone.else@example.com' })).toEqual({
      ok: false, reason: 'subject_mismatch',
    })
  })

  it('matches the subject case-insensitively', () => {
    const p = build()
    expect(verifySignupConsentPayload(p, { email: ' MEMBER@EXAMPLE.com ' }).ok).toBe(true)
  })

  it('FAILS CLOSED on a correctly signed but unarchived consent version', () => {
    // The signature is genuine; the archived wording is gone. The decision
    // cannot be evidenced, so it must be re-asked rather than resolved to
    // whatever the current text happens to say.
    const p = build({ version: 'retired-version-9' })
    const r = verifySignupConsentPayload(p, { email: EMAIL })
    expect(r).toEqual({ ok: false, reason: 'unknown_consent_version' })
  })

  it('reports absent vs malformed distinctly', () => {
    expect(verifySignupConsentPayload(undefined, { email: EMAIL })).toEqual({ ok: false, reason: 'absent' })
    expect(verifySignupConsentPayload(null, { email: EMAIL })).toEqual({ ok: false, reason: 'absent' })
    expect(verifySignupConsentPayload('a string', { email: EMAIL })).toEqual({ ok: false, reason: 'malformed' })
  })

  it('rejects structurally broken payloads without throwing', () => {
    const p = build()
    const cases: unknown[] = [
      {},
      { ...p, pv: 'one' },
      { ...p, purposes: [] },
      { ...p, purposes: 'platform_terms' },
      { ...p, purposes: ['not_a_real_purpose'] },
      { ...p, decided_at: 'not-a-date' },
      { ...p, sig: undefined },
      { ...p, sub_email: 42 },
    ]
    for (const c of cases) {
      const r = verifySignupConsentPayload(c, { email: EMAIL })
      expect(r.ok).toBe(false)
    }
  })

  it('rejects a payload from a newer build it cannot understand', () => {
    const p = build()
    const future = { ...p, pv: SIGNUP_CONSENT_PAYLOAD_VERSION + 1 }
    expect(verifySignupConsentPayload(future, { email: EMAIL })).toEqual({
      ok: false, reason: 'unsupported_version',
    })
  })

  it('cannot verify anything when the server holds no secret', () => {
    const p = build()
    delete process.env.SIGNUP_CONSENT_SECRET
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    expect(verifySignupConsentPayload(p, { email: EMAIL })).toEqual({
      ok: false, reason: 'no_secret',
    })
  })

  it('rejects a short signature without throwing on length mismatch', () => {
    const p = build()
    expect(verifySignupConsentPayload({ ...p, sig: 'abc' }, { email: EMAIL })).toEqual({
      ok: false, reason: 'bad_signature',
    })
  })
})
