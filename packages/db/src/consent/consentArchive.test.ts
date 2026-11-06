// ─── consentArchive.test.ts ───────────────────────────────────────────────────
// Mission 19 — proves the version → text archive is actually immutable.
//
// The point of the archive is that consent_records rows reference a version by
// string, so a reworded version silently rewrites what someone agreed to. A
// code comment cannot prevent that. The digest below can: editing the text of
// a released version fails this test.

import { createHash } from 'node:crypto'
import { describe, it, expect } from 'vitest'
import {
  CONSENT_PURPOSES, CONSENT_TEXTS, CONSENT_TEXT_ARCHIVE, CONSENT_TEXT_VERSION,
  canonicaliseConsentVersion, isKnownConsentVersion, resolveConsentText,
  resolveConsentTexts,
} from './purposes'

/**
 * sha256 of canonicaliseConsentVersion(version), for every version that has
 * been shown to a real user.
 *
 * To add a NEW version: add its key to CONSENT_TEXT_ARCHIVE, run this test,
 * and paste the digest it reports. Never update an existing entry — if a
 * digest here no longer matches, released wording has been edited and the
 * edit must be reverted, not re-pinned.
 */
const PINNED_DIGESTS: Record<string, string> = {
  // Recovered from the five live consent_records rows that reference it.
  's3-draft-1': 'f99d928fdaa7390e73906267f00de6ba535a6a578bf4dc8e397d96934831c4be',
  's3-draft-2': '44d1d62ba3a8d389f76aae2b5c567130d214479f15032e777bbec9dd3c8a2c30',
}

function digest(version: string): string {
  const canonical = canonicaliseConsentVersion(version)
  if (canonical === null) throw new Error(`not archived: ${version}`)
  return createHash('sha256').update(canonical, 'utf8').digest('hex')
}

describe('consent text archive', () => {
  it('pins the exact text of every released version', () => {
    for (const [version, expected] of Object.entries(PINNED_DIGESTS)) {
      expect(isKnownConsentVersion(version)).toBe(true)
      expect(digest(version)).toBe(expected)
    }
  })

  it('archives every version that has been pinned', () => {
    // Guards the other direction: a released version must never be dropped
    // from the archive, or rows pointing at it become unresolvable.
    for (const version of Object.keys(PINNED_DIGESTS)) {
      expect(Object.keys(CONSENT_TEXT_ARCHIVE)).toContain(version)
    }
  })

  it('has the current version archived', () => {
    expect(isKnownConsentVersion(CONSENT_TEXT_VERSION)).toBe(true)
  })

  it('covers every purpose in the current version', () => {
    for (const purpose of CONSENT_PURPOSES) {
      expect(typeof resolveConsentText(CONSENT_TEXT_VERSION, purpose)).toBe('string')
    }
  })

  it('exposes the current version as CONSENT_TEXTS', () => {
    expect(CONSENT_TEXTS).toEqual(CONSENT_TEXT_ARCHIVE[CONSENT_TEXT_VERSION])
  })

  it('keeps each version independent — an older version is NOT an alias of the current one', () => {
    // The whole reason the archive exists. These three were reworded between
    // s3-draft-1 and s3-draft-2 and must still read as they did when shown.
    for (const purpose of [
      'anonymised_research', 'retention_beyond_episode', 'deidentified_synopsis_sharing',
    ] as const) {
      const old = resolveConsentText('s3-draft-1', purpose)
      const now = resolveConsentText('s3-draft-2', purpose)
      expect(old).toBeTruthy()
      expect(now).toBeTruthy()
      expect(old).not.toBe(now)
    }
    // s3-draft-1's anonymised_research made the stronger claim.
    expect(resolveConsentText('s3-draft-1', 'anonymised_research'))
      .toContain('cannot be identified from it')
    expect(resolveConsentText('s3-draft-2', 'anonymised_research'))
      .toContain('not reasonably identifiable')
  })

  it('returns null for a purpose a version did not carry', () => {
    // platform_terms / data_processing were not versioned at s3-draft-1, so
    // they must resolve to nothing rather than borrowing current wording.
    expect(resolveConsentText('s3-draft-1', 'platform_terms')).toBeNull()
    expect(resolveConsentText('s3-draft-1', 'data_processing')).toBeNull()
  })

  it('FAILS CLOSED on an unknown version rather than returning current text', () => {
    expect(isKnownConsentVersion('s9-not-a-version')).toBe(false)
    expect(resolveConsentTexts('s9-not-a-version')).toBeNull()
    expect(resolveConsentText('s9-not-a-version', 'platform_terms')).toBeNull()
    expect(canonicaliseConsentVersion('s9-not-a-version')).toBeNull()
  })

  it('does not resolve a version through the prototype chain', () => {
    // hasOwnProperty, not `in` — otherwise 'toString' or 'constructor' would
    // look like archived versions.
    expect(isKnownConsentVersion('toString')).toBe(false)
    expect(isKnownConsentVersion('constructor')).toBe(false)
    expect(resolveConsentTexts('__proto__')).toBeNull()
  })

  it('is frozen at runtime', () => {
    expect(Object.isFrozen(CONSENT_TEXT_ARCHIVE)).toBe(true)
    expect(Object.isFrozen(CONSENT_TEXT_ARCHIVE[CONSENT_TEXT_VERSION])).toBe(true)
  })

  it('canonical form is stable under key reordering', () => {
    const a = canonicaliseConsentVersion(CONSENT_TEXT_VERSION)
    const b = canonicaliseConsentVersion(CONSENT_TEXT_VERSION)
    expect(a).toBe(b)
    expect(a).toContain('platform_terms')
  })
})

// ─── Fidelity to what was actually shown ──────────────────────────────────────
// The digests above prove the archive cannot change. These prove it is FAITHFUL
// — that s3-draft-1 says what the member actually read, not an approximation of
// it. s3-draft-1 predates the archive, so its text was recovered from the five
// live consent_records rows that reference it; md5 and length were taken from
// the database on 6 Nov 2026 and are reproduced here so the recovery can never
// drift from the evidence.
describe('s3-draft-1 is faithful to the live consent_records rows', () => {
  const LIVE: Record<string, { md5: string; len: number }> = {
    ai_assisted_processing:        { md5: 'dc5a85662f4b5e0ff132bc5044f3ac80', len: 267 },
    anonymised_research:           { md5: 'a77045adc09171a9cb72c886c5396043', len: 237 },
    deidentified_synopsis_sharing: { md5: '32392d4e413212f38e438540de526be4', len: 283 },
    record_holding:                { md5: 'f966f5ac8b3a1221be77da34a7802e93', len: 222 },
    retention_beyond_episode:      { md5: 'a9c5bfba0db748950299298a64471862', len: 211 },
  }

  for (const [purpose, expected] of Object.entries(LIVE)) {
    it(`${purpose} matches the stored row byte for byte`, () => {
      const text = resolveConsentText('s3-draft-1', purpose as never)
      expect(text).toBeTruthy()
      expect(text!.length).toBe(expected.len)
      expect(createHash('md5').update(text!, 'utf8').digest('hex')).toBe(expected.md5)
    })
  }
})
