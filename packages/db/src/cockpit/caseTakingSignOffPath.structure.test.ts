// ─── caseTakingSignOffPath.structure.test.ts ──────────────────────────────────
// ONE CANONICAL SIGNING PATH. NO BYPASS HELPER.
//
// The architect's requirement: "All application code that signs a case-taking
// record must pass through authoriseCaseTakingSignOff() before the write …
// There must be one canonical signing path. No bypass helper."
//
// A unit test of the guard cannot prove that — it only proves the guard
// refuses when called. This test reads the repository and fails if a second
// path to signed_off_at / signed_off_by ever appears, including one added
// long after anyone remembers this rule.

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '../../../..')
const GUARD = join(HERE, 'caseTakingSignOff.ts')
const STATE_MACHINE = join(HERE, 'caseTaking.ts')

/** The one module permitted to write the signature columns. */
const CANONICAL_PATH = 'packages/db/src/cockpit/caseTakingSignOff.ts'

/** Source roots to sweep. Tests and fixtures are excluded deliberately: a
 *  test asserting a refusal legitimately mentions the columns. */
const ROOTS = ['apps', 'packages']

function* walk(dir: string): Generator<string> {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry === 'dist') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) { yield* walk(full) ; continue }
    if (!/\.(ts|tsx)$/.test(entry)) continue
    if (/\.test\.tsx?$/.test(entry)) continue
    if (full.includes('__fixtures__')) continue
    yield full
  }
}

function sourceFiles(): string[] {
  const out: string[] = []
  for (const root of ROOTS) out.push(...walk(join(REPO, root)))
  return out
}

/** Code with comments stripped — the guard's own prose names the columns in
 *  order to explain the rule, and must not be mistaken for a write. */
function codeOf(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/\s\/\/[^\n]*/g, ' ')
}

const rel = (f: string) => relative(REPO, f).replace(/\\/g, '/')

describe('only one module writes the signature columns', () => {
  it('finds the repository to sweep', () => {
    // A sweep that silently finds nothing would make every claim below
    // vacuously true.
    const files = sourceFiles()
    expect(files.length).toBeGreaterThan(200)
    expect(files.map(rel)).toContain(CANONICAL_PATH)
  })

  it('no other source file writes signed_off_at or signed_off_by', () => {
    // The snake_case form is a database column. It appears either as an
    // object property in an update, or as a filter on one.
    const offenders = sourceFiles()
      .filter((f) => rel(f) !== CANONICAL_PATH)
      .filter((f) => /signed_off_(at|by)/.test(codeOf(f)))
      .map(rel)
    expect(offenders).toEqual([])
  })

  it('no source file outside the canonical path updates case_taking_sessions', () => {
    const offenders = sourceFiles()
      .filter((f) => rel(f) !== CANONICAL_PATH)
      .filter((f) => /case_taking_sessions/.test(codeOf(f)))
      .map(rel)
    expect(offenders).toEqual([])
  })
})

describe('the canonical path cannot be bypassed', () => {
  const guard = codeOf(GUARD)

  it('the write is preceded by the guard, in the same function', () => {
    const fnStart = guard.indexOf('export async function signOffCaseTakingSession')
    expect(fnStart).toBeGreaterThan(-1)
    const body = guard.slice(fnStart)
    const authoriseAt = body.indexOf('authoriseCaseTakingSignOff(')
    const updateAt = body.indexOf('.update(')
    expect(authoriseAt).toBeGreaterThan(-1)
    expect(updateAt).toBeGreaterThan(-1)
    expect(authoriseAt).toBeLessThan(updateAt)
  })

  it('refuses and returns before the write when unauthorised', () => {
    const fnStart = guard.indexOf('export async function signOffCaseTakingSession')
    const body = guard.slice(fnStart)
    const returnAt = body.indexOf('if (!decision.authorised) return')
    const updateAt = body.indexOf('.update(')
    expect(returnAt).toBeGreaterThan(-1)
    expect(returnAt).toBeLessThan(updateAt)
  })

  it('exports no force / skip / unsafe / bypass variant', () => {
    const exported = [...guard.matchAll(/export (?:async )?function (\w+)/g)].map((m) => m[1])
    const suspicious = exported.filter((n) =>
      /force|skip|unsafe|bypass|without|raw|direct|admin/i.test(n))
    expect(suspicious).toEqual([])
  })

  it('exposes exactly the intended function surface', () => {
    const exported = [...guard.matchAll(/export (?:async )?function (\w+)/g)].map((m) => m[1])
    expect(exported.slice().sort()).toEqual([
      'assertCaseTakingSignOffAuthorised',
      'authoriseCaseTakingSignOff',
      'caseTeamRoleResolver',
      'leadEligibilityResolver',
      'signOffCaseTakingSession',
    ])
  })

  it('takes no pre-computed attribution that would let a caller skip the decision', () => {
    // An entry point accepting an attribution would be a bypass wearing a
    // type. The only way to obtain one is to pass the guard.
    const fnStart = guard.indexOf('export async function signOffCaseTakingSession')
    const signature = guard.slice(fnStart, guard.indexOf('{', fnStart))
    expect(signature).not.toMatch(/attribution/i)
  })

  it('the injectable deps cannot skip a check, only answer it', () => {
    // deps supply ANSWERS (role, eligibility). There is no dep that disables
    // a check, so a test double cannot be used in production to wave one
    // through — and the resolvers default to the real ones.
    const fnStart = guard.indexOf('export async function signOffCaseTakingSession')
    const body = guard.slice(fnStart, fnStart + 900)
    expect(body).toContain('caseTeamRoleResolver(client)')
    expect(body).toContain('leadEligibilityResolver(client)')
  })

  it('never consults client_practitioner_links for authority', () => {
    expect(guard).not.toMatch(/client_practitioner_links/)
  })

  it('carries no Protocol-specific rule', () => {
    expect(guard).not.toMatch(/sole_unregistered_lead/)
    expect(guard).not.toMatch(/practitionerClasses|PRACTITIONER_CLASSES/)
  })
})

describe('the in-memory state machine is not a persistence path', () => {
  const machine = codeOf(STATE_MACHINE)

  it('caseTaking.ts persists nothing', () => {
    // Its header states "NOTHING HERE PERSISTS ANYTHING". This makes that
    // testable: its signOff() sets signedOffBy/signedOffAt on an in-memory
    // record and performs NO eligibility check, so if it ever gained a
    // database write it would become an unguarded signing path.
    expect(machine).not.toMatch(/\.from\(/)
    expect(machine).not.toMatch(/\.update\(/)
    expect(machine).not.toMatch(/\.insert\(/)
    expect(machine).not.toMatch(/signed_off_(at|by)/)
  })

  it('points the reader at the authority guard', () => {
    // So the next person persisting a CaseTakingRecord finds the guard.
    expect(readFileSync(STATE_MACHINE, 'utf8')).toContain('caseTakingSignOff')
  })
})

describe('the guard is reachable from the package surface', () => {
  it('is exported from the cockpit barrel', () => {
    const barrel = readFileSync(join(HERE, 'index.ts'), 'utf8')
    for (const name of [
      'authoriseCaseTakingSignOff', 'assertCaseTakingSignOffAuthorised',
      'signOffCaseTakingSession', 'caseTeamRoleResolver', 'leadEligibilityResolver',
      'SIGNABLE_CASE_TAKING_STATES',
    ]) {
      expect(barrel).toContain(name)
    }
  })

  it('pulls no Node built-in into the client-reachable cockpit barrel', () => {
    // cockpit/index.ts is imported by 'use client' components. See
    // clientBundleBoundary.test.ts for the rule and why it exists.
    expect(codeOf(GUARD)).not.toMatch(/from\s+['"](node:|fs|crypto|path)['"]/)
    expect(codeOf(GUARD)).not.toMatch(/next\/(headers|cache|server)/)
  })
})
