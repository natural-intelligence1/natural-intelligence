// ─── clientBundleBoundary.test.ts ─────────────────────────────────────────────
// Node-only code must not be reachable from a subpath that a client component
// imports.
//
// WHY THIS EXISTS. The Mission 19 signup-consent work re-exported
// signupPayload.ts — which imports node:crypto — from consent/index.ts. That
// barrel is imported by IntakeConsentGate.tsx, a client component, so webpack
// tried to bundle node:crypto for the browser and `next build` failed:
//
//   UnhandledSchemeError: Reading from "node:crypto" is not handled by plugins
//   Import trace: node:crypto → consent/signupPayload.ts → consent/index.ts
//                 → app/dashboard/intake/IntakeConsentGate.tsx
//
// Neither `tsc --noEmit` nor the dev server caught it: types resolve fine and
// dev compiles lazily per route. Only a production build did. This test walks
// the real import graph so the next person finds out in milliseconds instead.
//
// It is NOT a substitute for `next build`, which remains the authority. It is
// the fast guard for the one mistake that has actually been made here.

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = dirname(fileURLToPath(import.meta.url))

/**
 * Entry modules that a client component imports, as `@natural-intelligence/db/<x>`.
 * Enumerated from a grep of every "use client" file in apps/.
 */
const CLIENT_REACHABLE_ENTRIES = [
  'client.ts',
  'consent/index.ts',
  'cockpit/index.ts',
  'intake/index.ts',
  'intakeV2/index.ts',
  'personalisation/index.ts',
]

/** Node built-ins that cannot be bundled for a browser. */
const NODE_ONLY = /from\s+['"](node:[a-z_/]+|fs|path|crypto|os|child_process|net|tls|dns|http|https|stream|zlib|worker_threads)['"]/

/** Server-only Next APIs that also cannot enter a client bundle. */
const SERVER_ONLY_NEXT = /from\s+['"]next\/(headers|cache|server)['"]/

/**
 * A file's code with comments stripped.
 *
 * Required, not cosmetic: consent/index.ts documents this very outage and its
 * comment contains the webpack message `Reading from "node:crypto"`, which the
 * NODE_ONLY pattern matches. Scanning raw text makes the guard fire on its own
 * documentation.
 */
function codeOf(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/\s\/\/[^\n]*/g, ' ')
}

function resolveImport(fromFile: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null
  const base = resolve(dirname(fromFile), spec)
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    if (existsSync(candidate) && !candidate.endsWith('/')) {
      try {
        if (readFileSync(candidate, 'utf8')) return candidate
      } catch { /* a directory — fall through */ }
    }
  }
  return null
}

/** Every module reachable from `entry` by relative import, plus `entry`. */
function reachableFrom(entry: string): string[] {
  const seen = new Set<string>()
  const queue = [entry]
  while (queue.length) {
    const file = queue.shift()!
    if (seen.has(file)) continue
    seen.add(file)
    const src = readFileSync(file, 'utf8')
    for (const m of src.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
      const next = resolveImport(file, m[1])
      if (next && !seen.has(next)) queue.push(next)
    }
  }
  return [...seen]
}

describe('client-reachable db entry points stay bundle-safe', () => {
  for (const entry of CLIENT_REACHABLE_ENTRIES) {
    const path = join(SRC, entry)

    it(`${entry} exists`, () => {
      // Guards the list above from going stale on a rename, which would make
      // every assertion below vacuously true.
      expect(existsSync(path)).toBe(true)
    })

    it(`${entry} reaches no Node built-in`, () => {
      const offenders = reachableFrom(path)
        .filter((f) => NODE_ONLY.test(codeOf(f)))
        .map((f) => f.slice(SRC.length + 1).replace(/\\/g, '/'))
      expect(offenders).toEqual([])
    })

    it(`${entry} reaches no server-only Next API`, () => {
      const offenders = reachableFrom(path)
        .filter((f) => SERVER_ONLY_NEXT.test(codeOf(f)))
        .map((f) => f.slice(SRC.length + 1).replace(/\\/g, '/'))
      expect(offenders).toEqual([])
    })
  }
})

describe('the walker actually works', () => {
  // A guard that finds nothing is indistinguishable from a guard that is
  // broken, so prove it detects the exact module that caused the outage.
  it('finds node:crypto in signupPayload.ts', () => {
    const payload = join(SRC, 'consent/signupPayload.ts')
    expect(existsSync(payload)).toBe(true)
    expect(NODE_ONLY.test(codeOf(payload))).toBe(true)
  })

  it('would flag the consent barrel if signupPayload were re-exported from it', () => {
    const serverBarrel = join(SRC, 'consent/server.ts')
    const offenders = reachableFrom(serverBarrel)
      .filter((f) => NODE_ONLY.test(codeOf(f)))
    // consent/server.ts is the SERVER barrel, so it must reach node:crypto.
    expect(offenders.length).toBeGreaterThan(0)
  })

  it('follows imports transitively, not just one level', () => {
    // foundational.ts imports signupPayload.ts, which imports node:crypto.
    const reached = reachableFrom(join(SRC, 'consent/foundational.ts'))
      .map((f) => f.slice(SRC.length + 1).replace(/\\/g, '/'))
    expect(reached).toContain('consent/signupPayload.ts')
  })
})

describe('the consent barrel split is intact', () => {
  const barrel = () => readFileSync(join(SRC, 'consent/index.ts'), 'utf8')

  it('the client-reachable barrel exports neither Node-only module', () => {
    expect(barrel()).not.toMatch(/from\s+['"]\.\/signupPayload['"]/)
    expect(barrel()).not.toMatch(/from\s+['"]\.\/foundational['"]/)
  })

  it('still exports what the client component needs', () => {
    for (const name of [
      'CONSENT_TEXTS', 'REQUIRED_INTAKE_CONSENTS', 'OPTIONAL_INTAKE_CONSENTS',
      'CONSENT_TEXT_VERSION', 'CONSENT_TEXT_ARCHIVE', 'resolveConsentText',
      'isConsentGrantStillCurrent',
    ]) {
      expect(barrel()).toContain(name)
    }
  })

  it('the server barrel exports everything the server callers import', () => {
    const server = readFileSync(join(SRC, 'consent/server.ts'), 'utf8')
    for (const name of [
      'buildSignupConsentPayload', 'verifySignupConsentPayload',
      'persistSignupConsentFromMetadata', 'ensureFoundationalConsents',
      'getFoundationalConsentState', 'recordFoundationalReaffirmation',
      'canSignSignupConsent', 'SIGNUP_CONSENT_METADATA_KEY',
    ]) {
      expect(server).toContain(name)
    }
  })

  it('the root barrel still re-exports the server consent module', () => {
    // The four server callers import these from the root barrel, which is
    // already server-only because it re-exports next/headers.
    expect(readFileSync(join(SRC, 'index.ts'), 'utf8')).toContain("'./consent/server'")
  })
})
