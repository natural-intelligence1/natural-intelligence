// ─── consentCopyDrift.test.ts ─────────────────────────────────────────────────
// Mission 19 — the signup form's consent wording is held in TWO places: the
// copy deck it renders from (lib/copy.ts) and the archived catalogue the
// consent row is written from (packages/db consent/purposes.ts).
//
// That duplication is a real hazard: if someone edits the copy deck, the
// member reads one wording and consent_records stores another, and the stored
// "exact text shown" is quietly a lie. This test makes that drift a build
// failure instead of an audit finding.
//
// If it fails, the fix is to decide which wording is correct and then add a
// NEW archive version for it — never to edit a released version's text.

import { describe, it, expect } from 'vitest'
import { CONSENT_TEXT_VERSION, resolveConsentText } from '@natural-intelligence/db'
import { copy } from './copy'

describe('signup consent copy matches the archived catalogue', () => {
  it('platform_terms', () => {
    expect(copy.auth.signup.consentTerms).toBe(
      resolveConsentText(CONSENT_TEXT_VERSION, 'platform_terms'),
    )
  })

  it('data_processing', () => {
    expect(copy.auth.signup.consentData).toBe(
      resolveConsentText(CONSENT_TEXT_VERSION, 'data_processing'),
    )
  })
})
