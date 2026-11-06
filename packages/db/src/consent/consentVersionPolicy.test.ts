// ─── consentVersionPolicy.test.ts ─────────────────────────────────────────────
// Mission 20 — the per-version requires_reaffirmation declaration.
//
// The approved rule has two halves and they pull in opposite directions, so
// both need pinning:
//
//   KEEP VALID  a grant at an older archived version stays valid when NI
//               merely rewords. No forced re-affirmation on every bump.
//   FAIL CLOSED a grant whose version cannot be resolved to the wording
//               actually shown is not evidence of anything.

import { describe, it, expect } from 'vitest'
import {
  CONSENT_TEXT_ARCHIVE, CONSENT_TEXT_VERSION, CONSENT_VERSION_ORDER,
  CONSENT_VERSION_POLICY, LIVE_CONSENT_CATALOGUE, isConsentGrantStillCurrent,
  resolveConsentVersionPolicy, type ConsentCatalogue, type ConsentVersionPolicy,
} from './purposes'

describe('the catalogue and the archive cannot diverge', () => {
  it('every released version is both archived and ordered', () => {
    expect([...CONSENT_VERSION_ORDER].slice().sort())
      .toEqual(Object.keys(CONSENT_TEXT_ARCHIVE).slice().sort())
  })

  it('every ordered version has a policy', () => {
    for (const version of CONSENT_VERSION_ORDER) {
      expect(resolveConsentVersionPolicy(version)).not.toBeNull()
    }
  })

  it('every policy records a rationale, because it is audit evidence', () => {
    for (const version of CONSENT_VERSION_ORDER) {
      const policy = resolveConsentVersionPolicy(version)!
      expect(typeof policy.requires_reaffirmation).toBe('boolean')
      expect(policy.rationale.length).toBeGreaterThan(20)
    }
  })

  it('the current version is the newest in the release order', () => {
    expect(CONSENT_VERSION_ORDER[CONSENT_VERSION_ORDER.length - 1]).toBe(CONSENT_TEXT_VERSION)
  })

  it('is frozen at runtime', () => {
    expect(Object.isFrozen(CONSENT_VERSION_POLICY)).toBe(true)
    expect(Object.isFrozen(CONSENT_VERSION_POLICY[CONSENT_TEXT_VERSION])).toBe(true)
  })

  it('does not resolve a policy through the prototype chain', () => {
    expect(resolveConsentVersionPolicy('toString')).toBeNull()
    expect(resolveConsentVersionPolicy('__proto__')).toBeNull()
    expect(resolveConsentVersionPolicy('constructor')).toBeNull()
  })
})

describe('today: no version forces re-affirmation', () => {
  it('neither released version requires re-affirmation', () => {
    for (const version of CONSENT_VERSION_ORDER) {
      expect(resolveConsentVersionPolicy(version)!.requires_reaffirmation).toBe(false)
    }
  })

  it('an s3-draft-1 grant is STILL CURRENT despite s3-draft-2 existing', () => {
    // The approved behaviour, stated directly: republished wording does not
    // invalidate an archived grant.
    expect(isConsentGrantStillCurrent('s3-draft-1')).toBe(true)
  })

  it('an s3-draft-2 grant is still current', () => {
    expect(isConsentGrantStillCurrent('s3-draft-2')).toBe(true)
  })

  it('adding this policy changed nothing for any archived version', () => {
    for (const version of CONSENT_VERSION_ORDER) {
      expect(isConsentGrantStillCurrent(version)).toBe(true)
    }
  })
})

describe('FAIL CLOSED on a version that cannot be resolved', () => {
  it('a NULL version is not evidence of consent', () => {
    // Not hypothetical. The two live April 2026 foundational rows carry
    // consent_version = NULL and consent_text = NULL, so there is no record
    // of what was on screen. Those rows stay untouched; the member re-affirms.
    expect(isConsentGrantStillCurrent(null)).toBe(false)
  })

  it('an undefined or empty version is not evidence of consent', () => {
    expect(isConsentGrantStillCurrent(undefined)).toBe(false)
    expect(isConsentGrantStillCurrent('')).toBe(false)
  })

  it('an unarchived version label is not evidence of consent', () => {
    // The s3-draft-1 recovery proved a label can reference wording that
    // exists nowhere. Resolving such a label to current text would silently
    // restate what the member agreed to.
    expect(isConsentGrantStillCurrent('s9-never-existed')).toBe(false)
    expect(isConsentGrantStillCurrent('s3-draft-3')).toBe(false)
  })

  it('does not treat a prototype property as an archived version', () => {
    expect(isConsentGrantStillCurrent('toString')).toBe(false)
    expect(isConsentGrantStillCurrent('__proto__')).toBe(false)
  })
})

// ─── The rule itself, against hypothetical future releases ───────────────────
// The live policy is frozen and both entries are false, so the "a later
// version invalidates earlier grants" half of the rule cannot be exercised
// against it. The catalogue is injectable for exactly this reason.

const archived = (versions: string[]) => (v: string) => versions.includes(v)

function catalogue(
  entries: [string, boolean][],
): ConsentCatalogue {
  const order = entries.map(([v]) => v)
  const policy: Record<string, ConsentVersionPolicy> = {}
  for (const [v, requires] of entries) {
    policy[v] = { requires_reaffirmation: requires, rationale: 'test fixture rationale value' }
  }
  return { order, policy, isArchived: archived(order) }
}

describe('a version marked requires_reaffirmation invalidates earlier grants', () => {
  const withBreak = catalogue([['v1', false], ['v2', false], ['v3', true], ['v4', false]])

  it('stales every grant made before the breaking version', () => {
    expect(isConsentGrantStillCurrent('v1', withBreak)).toBe(false)
    expect(isConsentGrantStillCurrent('v2', withBreak)).toBe(false)
  })

  it('leaves the breaking version itself valid', () => {
    // Someone who accepted v3 accepted the new terms.
    expect(isConsentGrantStillCurrent('v3', withBreak)).toBe(true)
  })

  it('leaves versions after the breaking version valid', () => {
    expect(isConsentGrantStillCurrent('v4', withBreak)).toBe(true)
  })

  it('a non-breaking bump keeps everything valid', () => {
    const noBreak = catalogue([['v1', false], ['v2', false], ['v3', false]])
    for (const v of ['v1', 'v2', 'v3']) {
      expect(isConsentGrantStillCurrent(v, noBreak)).toBe(true)
    }
  })

  it('two breaking versions still only invalidate what precedes them', () => {
    const twoBreaks = catalogue([['v1', false], ['v2', true], ['v3', false], ['v4', true]])
    expect(isConsentGrantStillCurrent('v1', twoBreaks)).toBe(false)
    expect(isConsentGrantStillCurrent('v2', twoBreaks)).toBe(false)
    expect(isConsentGrantStillCurrent('v3', twoBreaks)).toBe(false)
    expect(isConsentGrantStillCurrent('v4', twoBreaks)).toBe(true)
  })
})

describe('an archived version missing from the release order fails closed', () => {
  it('cannot be placed relative to later versions, so is not current', () => {
    // Archived but unordered: nothing can establish whether a breaking
    // version came after it. Guessing would be the wrong kind of convenient.
    const inconsistent: ConsentCatalogue = {
      order: ['v1', 'v2'],
      policy: { v1: { requires_reaffirmation: false, rationale: 'test fixture rationale value' },
                v2: { requires_reaffirmation: false, rationale: 'test fixture rationale value' } },
      isArchived: archived(['v1', 'v2', 'orphan']),
    }
    expect(isConsentGrantStillCurrent('orphan', inconsistent)).toBe(false)
    expect(isConsentGrantStillCurrent('v1', inconsistent)).toBe(true)
  })
})

describe('the live catalogue is wired to the live constants', () => {
  it('uses the real order and policy, not a copy that could drift', () => {
    expect(LIVE_CONSENT_CATALOGUE.order).toBe(CONSENT_VERSION_ORDER)
    expect(LIVE_CONSENT_CATALOGUE.policy).toBe(CONSENT_VERSION_POLICY)
  })

  it('is the default, so callers cannot accidentally use a test catalogue', () => {
    expect(isConsentGrantStillCurrent('s3-draft-2'))
      .toBe(isConsentGrantStillCurrent('s3-draft-2', LIVE_CONSENT_CATALOGUE))
  })
})
