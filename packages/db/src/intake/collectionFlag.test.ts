// Containment-patch tests: intake COLLECTION is disabled by default and only
// enabled by the exact string "true"; the flag is fully independent of the
// assignment kill-switch (INTAKE_ASSIGNMENT_ENABLED). Pure unit tests — no DB.
import { describe, it, expect, afterEach } from 'vitest'
import { isIntakeCollectionEnabled, assertIntakeCollectionEnabled } from './collectionFlag'
import { isIntakeAssignmentEnabled } from '../practitioners/routeIntakeAssignment'

const COLLECT = 'INTAKE_COLLECTION_ENABLED'
const ASSIGN  = 'INTAKE_ASSIGNMENT_ENABLED'

const origCollect = process.env[COLLECT]
const origAssign  = process.env[ASSIGN]

function set(name: string, v?: string) {
  if (v === undefined) delete process.env[name]
  else process.env[name] = v
}

afterEach(() => {
  set(COLLECT, origCollect)
  set(ASSIGN, origAssign)
})

describe('isIntakeCollectionEnabled — collection kill-switch default', () => {
  it('is disabled by default (flag unset)', () => {
    set(COLLECT, undefined)
    expect(isIntakeCollectionEnabled()).toBe(false)
  })

  it('is disabled when flag is not exactly "true"', () => {
    set(COLLECT, 'false'); expect(isIntakeCollectionEnabled()).toBe(false)
    set(COLLECT, '1');     expect(isIntakeCollectionEnabled()).toBe(false)
    set(COLLECT, 'TRUE');  expect(isIntakeCollectionEnabled()).toBe(false)
    set(COLLECT, ' true'); expect(isIntakeCollectionEnabled()).toBe(false)
    set(COLLECT, '');      expect(isIntakeCollectionEnabled()).toBe(false)
  })

  it('is enabled only when flag === "true"', () => {
    set(COLLECT, 'true')
    expect(isIntakeCollectionEnabled()).toBe(true)
  })
})

describe('assertIntakeCollectionEnabled — server-action guard', () => {
  it('throws when disabled (unset), so a guarded action exits before any DB client exists', () => {
    set(COLLECT, undefined)
    expect(() => assertIntakeCollectionEnabled()).toThrow(/disabled/)
  })

  it('throws on non-exact values', () => {
    set(COLLECT, 'TRUE')
    expect(() => assertIntakeCollectionEnabled()).toThrow(/disabled/)
  })

  it('does not throw when enabled', () => {
    set(COLLECT, 'true')
    expect(() => assertIntakeCollectionEnabled()).not.toThrow()
  })
})

describe('collection and assignment flags are independent', () => {
  it('enabling collection does NOT enable assignment routing', () => {
    set(COLLECT, 'true')
    set(ASSIGN, undefined)
    expect(isIntakeCollectionEnabled()).toBe(true)
    expect(isIntakeAssignmentEnabled()).toBe(false)
  })

  it('enabling assignment does NOT enable collection', () => {
    set(ASSIGN, 'true')
    set(COLLECT, undefined)
    expect(isIntakeAssignmentEnabled()).toBe(true)
    expect(isIntakeCollectionEnabled()).toBe(false)
  })

  it('both default off when neither is set', () => {
    set(COLLECT, undefined)
    set(ASSIGN, undefined)
    expect(isIntakeCollectionEnabled()).toBe(false)
    expect(isIntakeAssignmentEnabled()).toBe(false)
  })
})
