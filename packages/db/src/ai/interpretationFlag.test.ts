// ─── interpretationFlag.test.ts ───────────────────────────────────────────────
// The hold must fail closed. These tests pin the exact-string semantics, which
// are what make a typo, a missing variable or a brand-new environment safe.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  isAiInterpretationEnabled, HELD_INTERPRETATION_OUTPUTS,
} from './interpretationFlag'

const KEY = 'AI_INTERPRETATION_ENABLED'
let original: string | undefined

beforeEach(() => { original = process.env[KEY] })
afterEach(() => {
  if (original === undefined) delete process.env[KEY]
  else process.env[KEY] = original
})

describe('isAiInterpretationEnabled — default off', () => {
  it('is HELD when the variable is unset', () => {
    delete process.env[KEY]
    expect(isAiInterpretationEnabled()).toBe(false)
  })

  it('is HELD in a brand-new environment that has never heard of the flag', () => {
    // Merging the guard activates the hold everywhere, including Preview, with
    // no environment variable set anywhere.
    delete process.env[KEY]
    expect(isAiInterpretationEnabled()).toBe(false)
  })
})

describe('isAiInterpretationEnabled — only the exact string enables', () => {
  it('enables on "true"', () => {
    process.env[KEY] = 'true'
    expect(isAiInterpretationEnabled()).toBe(true)
  })

  it.each(['1', 'TRUE', 'True', 'yes', 'on', 'enabled', ' true', 'true ', '', 'false', '0'])(
    'is HELD on %o',
    (value) => {
      process.env[KEY] = value
      expect(isAiInterpretationEnabled()).toBe(false)
    },
  )
})

describe('isAiInterpretationEnabled — matches the existing kill-switch convention', () => {
  it('uses the same exact-string rule as the intake switches', () => {
    // INTAKE_COLLECTION_ENABLED and INTAKE_ASSIGNMENT_ENABLED both compare
    // === 'true'. A different rule here would be a trap for whoever sets it.
    process.env[KEY] = 'true'
    expect(isAiInterpretationEnabled()).toBe(true)
    process.env[KEY] = 'TRUE'
    expect(isAiInterpretationEnabled()).toBe(false)
  })
})

describe('the held output set', () => {
  it('holds exactly the two Intake-derived pipelines named in the ruling', () => {
    expect([...HELD_INTERPRETATION_OUTPUTS]).toEqual(['health_synopsis', 'body_story'])
  })

  it('does not hold biohub lab parsing', () => {
    // Separate pipeline, not Intake-derived, not named in the ruling.
    expect([...HELD_INTERPRETATION_OUTPUTS]).not.toContain('biohub')
    expect([...HELD_INTERPRETATION_OUTPUTS]).not.toContain('lab_report')
  })
})
