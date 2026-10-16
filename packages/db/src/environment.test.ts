// The single environment authority that keeps destructive and data-fabricating
// capability out of production. Pure functions, no DB, always runs.

import { describe, it, expect } from 'vitest'
import {
  isDevOnlyEnvironment, assertDevOnlyEnvironment, devOnlyBlockedMessage,
} from './environment'

const CAP = 'Development seed and test-data tooling'

describe('isDevOnlyEnvironment — fails closed', () => {
  const REFUSED: [string, NodeJS.ProcessEnv][] = [
    ['production build',               { NODE_ENV: 'production' }],
    ['Vercel production',              { NODE_ENV: 'production', VERCEL_ENV: 'production' }],
    ['Vercel preview',                 { NODE_ENV: 'production', VERCEL_ENV: 'preview' }],
    ['VERCEL_ENV production wins',     { NODE_ENV: 'development', VERCEL_ENV: 'production' }],
    ['empty env',                      {}],
    ['NODE_ENV undefined',             { NODE_ENV: undefined }],
    ['NODE_ENV empty string',          { NODE_ENV: '' }],
    ['unrecognised NODE_ENV',          { NODE_ENV: 'staging' }],
    ['typo in NODE_ENV',               { NODE_ENV: 'developement' }],
    ['uppercase does not count',       { NODE_ENV: 'DEVELOPMENT' }],
  ]

  for (const [name, env] of REFUSED) {
    it(`refuses: ${name}`, () => {
      expect(isDevOnlyEnvironment(env)).toBe(false)
      expect(() => assertDevOnlyEnvironment(CAP, env)).toThrow(/development and test only/i)
    })
  }

  const ALLOWED: [string, NodeJS.ProcessEnv][] = [
    ['local development',       { NODE_ENV: 'development' }],
    ['test runner',             { NODE_ENV: 'test' }],
    ['dev with preview marker', { NODE_ENV: 'development', VERCEL_ENV: 'development' }],
  ]

  for (const [name, env] of ALLOWED) {
    it(`allows: ${name}`, () => {
      expect(isDevOnlyEnvironment(env)).toBe(true)
      expect(() => assertDevOnlyEnvironment(CAP, env)).not.toThrow()
    })
  }

  it('the refusal names the capability and says it is environment-based', () => {
    const msg = devOnlyBlockedMessage('resetTestData()')
    expect(msg).toContain('resetTestData()')
    expect(msg).toMatch(/production/i)
    expect(msg).toMatch(/regardless of\s+who is signed in/i)
  })

  it('a preview deployment is refused even though it is not "production"', () => {
    // The trap: Vercel builds previews with NODE_ENV=production. If the guard
    // only tested VERCEL_ENV==='production', previews would be allowed.
    expect(isDevOnlyEnvironment({ NODE_ENV: 'production', VERCEL_ENV: 'preview' })).toBe(false)
  })
})
