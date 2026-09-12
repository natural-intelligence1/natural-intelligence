// Single-account founder-preview allowlist — exhaustive gate semantics.
// These tests prove the NEGATIVE cases at the decision layer used by both the
// intake page and the saveIntakeSection/completeIntake server actions (the
// actions call assertIntakeAllowedForUser with the AUTHENTICATED email before
// any intake write, so a throw here is a refused write).
import { describe, it, expect, afterEach } from 'vitest'
import {
  isIntakePreviewAllowedEmail, isIntakeAllowedForUser, assertIntakeAllowedForUser,
} from './previewAllowlist'
import { isIntakeCollectionEnabled } from './collectionFlag'

const ALLOW = 'INTAKE_PREVIEW_ALLOWLIST_EMAILS'
const COLLECT = 'INTAKE_COLLECTION_ENABLED'
const saved = { allow: process.env[ALLOW], collect: process.env[COLLECT] }
afterEach(() => {
  for (const [k, v] of [[ALLOW, saved.allow], [COLLECT, saved.collect]] as const) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
})

describe('isIntakePreviewAllowedEmail — exact allowlist semantics', () => {
  it('denies EVERYONE when the env var is absent or empty', () => {
    delete process.env[ALLOW]
    expect(isIntakePreviewAllowedEmail('saimakhalil@gmail.com')).toBe(false)
    process.env[ALLOW] = ''
    expect(isIntakePreviewAllowedEmail('saimakhalil@gmail.com')).toBe(false)
    process.env[ALLOW] = '   '
    expect(isIntakePreviewAllowedEmail('saimakhalil@gmail.com')).toBe(false)
  })

  it('allows only the exact allowlisted address (case-insensitive, trimmed)', () => {
    process.env[ALLOW] = 'saimakhalil@gmail.com'
    expect(isIntakePreviewAllowedEmail('saimakhalil@gmail.com')).toBe(true)
    expect(isIntakePreviewAllowedEmail('SaimaKhalil@Gmail.com')).toBe(true)
    expect(isIntakePreviewAllowedEmail('  saimakhalil@gmail.com  ')).toBe(true)
  })

  it('denies every other authenticated email', () => {
    process.env[ALLOW] = 'saimakhalil@gmail.com'
    for (const e of [
      'mrkhalil@gmail.com', 'someone@example.com', 'saimakhalil@gmail.co',
      'xsaimakhalil@gmail.com', 'saimakhalil@gmail.com.evil.com',
    ]) {
      expect(isIntakePreviewAllowedEmail(e)).toBe(false)
    }
  })

  it('denies missing/empty email (logged-out can never match)', () => {
    process.env[ALLOW] = 'saimakhalil@gmail.com'
    expect(isIntakePreviewAllowedEmail(undefined)).toBe(false)
    expect(isIntakePreviewAllowedEmail(null)).toBe(false)
    expect(isIntakePreviewAllowedEmail('')).toBe(false)
  })

  it('no partial matching: an allowlist entry never matches a superset or subset', () => {
    process.env[ALLOW] = 'saimakhalil@gmail.com'
    expect(isIntakePreviewAllowedEmail('saimakhalil')).toBe(false)
    expect(isIntakePreviewAllowedEmail('gmail.com')).toBe(false)
  })

  it('wildcard and domain-only entries are ignored, never honoured', () => {
    process.env[ALLOW] = '*@gmail.com, gmail.com, *, saimakhalil@gmail.com'
    expect(isIntakePreviewAllowedEmail('anyone@gmail.com')).toBe(false)
    expect(isIntakePreviewAllowedEmail('gmail.com')).toBe(false)
    // the one valid full address in the list still works
    expect(isIntakePreviewAllowedEmail('saimakhalil@gmail.com')).toBe(true)
  })
})

describe('isIntakeAllowedForUser — combined availability rule', () => {
  it('flag OFF + not allowlisted → denied (the default world, unchanged)', () => {
    delete process.env[COLLECT]
    delete process.env[ALLOW]
    expect(isIntakeCollectionEnabled()).toBe(false)
    expect(isIntakeAllowedForUser('anyone@example.com')).toBe(false)
  })

  it('flag OFF + exactly allowlisted → allowed (the single-account exception)', () => {
    delete process.env[COLLECT]
    process.env[ALLOW] = 'saimakhalil@gmail.com'
    expect(isIntakeCollectionEnabled()).toBe(false) // global flag untouched
    expect(isIntakeAllowedForUser('saimakhalil@gmail.com')).toBe(true)
    expect(isIntakeAllowedForUser('mrkhalil@gmail.com')).toBe(false)
  })

  it('flag ON → allowed regardless of allowlist (existing behaviour preserved)', () => {
    process.env[COLLECT] = 'true'
    delete process.env[ALLOW]
    expect(isIntakeAllowedForUser('anyone@example.com')).toBe(true)
  })

  it('the allowlist never turns the GLOBAL flag on', () => {
    delete process.env[COLLECT]
    process.env[ALLOW] = 'saimakhalil@gmail.com'
    expect(isIntakeCollectionEnabled()).toBe(false)
  })
})

describe('assertIntakeAllowedForUser — the server-action refusal', () => {
  it('throws for a non-allowlisted authenticated user while the flag is off (save/complete refused)', () => {
    delete process.env[COLLECT]
    process.env[ALLOW] = 'saimakhalil@gmail.com'
    expect(() => assertIntakeAllowedForUser('mrkhalil@gmail.com'))
      .toThrow(/disabled .* not on the preview allowlist/)
  })
  it('throws when no email is available', () => {
    delete process.env[COLLECT]
    process.env[ALLOW] = 'saimakhalil@gmail.com'
    expect(() => assertIntakeAllowedForUser(undefined)).toThrow()
  })
  it('passes for the allowlisted account', () => {
    delete process.env[COLLECT]
    process.env[ALLOW] = 'saimakhalil@gmail.com'
    expect(() => assertIntakeAllowedForUser('saimakhalil@gmail.com')).not.toThrow()
  })
})
