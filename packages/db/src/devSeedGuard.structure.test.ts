// Structural proof that the production lockout covers the WHOLE dev/seed
// surface, not just the actions someone remembered.
//
// Those actions fabricate users, practitioners, applications and showcase
// content, and resetTestData() deletes. Admin authentication is not a
// sufficient control for that in production.
//
// The guarantee is architectural: every exported action calls requireAdmin()
// exactly once, and requireAdmin() asserts the environment before it does
// anything else. This test reads the admin source and fails if that stops
// being true — including for an action added later. It lives here because
// apps/admin has no test runner; packages/db is the only place vitest runs.

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const SEED_DIR = join(__dirname, '../../../apps/admin/app/(protected)/dev/seed')
const ACTIONS_PATH = join(SEED_DIR, 'actions.ts')
const PAGE_PATH = join(SEED_DIR, 'page.tsx')

const HAVE_ADMIN = existsSync(ACTIONS_PATH)
const ACTIONS = HAVE_ADMIN ? readFileSync(ACTIONS_PATH, 'utf8') : ''
const PAGE = HAVE_ADMIN ? readFileSync(PAGE_PATH, 'utf8') : ''

/** [name, bodyStart, bodyEnd] for each exported server action. */
function actionBodies(src: string): [string, string][] {
  const bounds = [...src.matchAll(/^export async function (\w+)/gm)]
  return bounds.map((m, i) => {
    const start = m.index!
    const end = i + 1 < bounds.length ? bounds[i + 1].index! : src.length
    return [m[1], src.slice(start, end)] as [string, string]
  })
}

describe.skipIf(!HAVE_ADMIN)('dev/seed production lockout — whole surface', () => {
  it('A. finds every exported server action', () => {
    const names = actionBodies(ACTIONS).map(([n]) => n)
    expect(names.length).toBeGreaterThanOrEqual(8)
    for (const expected of [
      'seedTestApplication', 'seedTestPractitioner', 'seedTestSupportRequest',
      'seedShowcaseData', 'seedShowcasePractitioners', 'fixEventTimes',
      'resetTestData', 'seedPractitionerAgreements',
    ]) {
      expect(names).toContain(expected)
    }
  })

  it('B. EVERY exported action routes through requireAdmin()', () => {
    const missing = actionBodies(ACTIONS)
      .filter(([, body]) => !body.includes('requireAdmin()'))
      .map(([name]) => name)
    expect(missing).toEqual([])
  })

  it('C. requireAdmin() asserts the environment BEFORE reading the session', () => {
    const fnStart = ACTIONS.indexOf('async function requireAdmin()')
    expect(fnStart).toBeGreaterThan(-1)
    const fn = ACTIONS.slice(fnStart, ACTIONS.indexOf('export async function'))

    const guardAt = fn.indexOf('assertDevOnlyEnvironment(')
    expect(guardAt).toBeGreaterThan(-1)
    expect(guardAt).toBeLessThan(fn.indexOf('createServerSupabaseClient()'))
    expect(guardAt).toBeLessThan(fn.indexOf("profile?.role !== 'admin'"))
  })

  it('D. the guard comes from the single environment authority, not a local copy', () => {
    expect(ACTIONS).toMatch(
      /import \{ assertDevOnlyEnvironment \} from '@natural-intelligence\/db\/environment'/)
    expect(ACTIONS).not.toMatch(/NODE_ENV\s*===\s*['"]production['"]/)
    expect(ACTIONS).not.toMatch(/VERCEL_ENV\s*===/)
  })

  it('E. the page is ABSENT in production (404), not merely forbidden', () => {
    expect(PAGE).toContain('isDevOnlyEnvironment()')
    expect(PAGE).toContain('notFound()')
    expect(PAGE.indexOf('isDevOnlyEnvironment()'))
      .toBeLessThan(PAGE.indexOf('createServerSupabaseClient()'))
  })

  it('F. no action bypasses requireAdmin by building its own admin client', () => {
    const bypassers = actionBodies(ACTIONS)
      .filter(([, b]) => b.includes('createAdminClient()') && !b.includes('requireAdmin()'))
      .map(([name]) => name)
    expect(bypassers).toEqual([])
  })

  it('G. draft agreement seeding keeps its own specific refusal as well', () => {
    const body = actionBodies(ACTIONS).find(([n]) => n === 'seedPractitionerAgreements')?.[1] ?? ''
    expect(body).toContain('assertDraftSeedingAllowed()')
  })

  it('H. destructive and fabricating actions are all inside the guarded set', () => {
    const guarded = actionBodies(ACTIONS)
      .filter(([, b]) => b.includes('requireAdmin()')).map(([n]) => n)
    for (const destructive of ['resetTestData', 'seedShowcasePractitioners']) {
      expect(guarded).toContain(destructive)
    }
  })
})
