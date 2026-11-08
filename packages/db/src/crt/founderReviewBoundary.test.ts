// ─── founderReviewBoundary.test.ts ───────────────────────────────────────────
// Structural guard on the Founder Review route itself, following the existing
// cross-app pattern (see pricing/previewPageBoundary.test.ts): the admin app
// has no test runner, so the db package reads its source from disk.
//
// "It is read only" is the whole claim of Stage 2, and visual disabling does
// not establish it. These tests assert there is no mutation path to disable:
//
//   1. NO SERVER ACTION, no form, no submit control anywhere under the route.
//   2. NO MUTATION CALL — insert / update / upsert / delete / rpc.
//   3. NO FIXTURE, directly or transitively. The route may not import the
//      preview modules that carry synthetic cases, because a fallback that
//      only fires when the database is empty is exactly the failure this
//      surface exists to rule out.
//   4. THE REGISTRY IS LABELS ONLY. fields.ts may describe questions; it may
//      not carry answers.
//   5. THE ROUTE STAYS BEHIND THE ADMIN GUARD — inside (protected), and never
//      added to the admin middleware's public list.

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '../../../..')
const ROUTE_DIR = join(REPO, 'apps/admin/app/(protected)/review-packs/founder-review')

function walk(dir: string): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...walk(full))
      continue
    }
    if (/\.(ts|tsx)$/.test(entry)) out.push(full)
  }
  return out
}

const FILES = walk(ROUTE_DIR)
// Forward slashes always: relative() yields backslashes on Windows, and a
// find() on 'founder-review/page.tsx' would then match nothing and assert
// against undefined rather than failing honestly.
const SOURCES = FILES.map((f) => ({
  path: relative(REPO, f).replace(/\\/g, '/'),
  text: readFileSync(f, 'utf8'),
}))

/** The route as a whole. The guard, the read and the rendering sit in
 *  different files, so a claim about what the Founder sees is a claim about
 *  the directory, not about any one of them. */
const ALL = SOURCES.map((s) => s.text).join('\n')

describe('Founder Review route — exists where it was meant to', () => {
  it('lives under the existing admin review-packs area', () => {
    expect(existsSync(ROUTE_DIR)).toBe(true)
    expect(ROUTE_DIR.replace(/\\/g, '/')).toContain('app/(protected)/review-packs/founder-review')
  })

  it('has a case picker and a per-case page', () => {
    const rel = FILES.map((f) => relative(REPO, f).replace(/\\/g, '/'))
    expect(rel.some((p) => p.endsWith('founder-review/page.tsx'))).toBe(true)
    expect(rel.some((p) => p.includes('founder-review/[caseId]/page.tsx'))).toBe(true)
  })
})

describe('Founder Review route — no write pathway', () => {
  it('declares no server action', () => {
    for (const { path, text } of SOURCES) {
      expect(text.includes("'use server'"), `${path} declares a server action`).toBe(false)
      expect(text.includes('"use server"'), `${path} declares a server action`).toBe(false)
    }
  })

  it('calls no mutation verb', () => {
    for (const { path, text } of SOURCES) {
      for (const verb of ['insert', 'update', 'upsert', 'delete', 'rpc']) {
        expect(text.includes(`.${verb}(`), `${path} calls .${verb}(`).toBe(false)
      }
    }
  })

  it('renders no form, no submit control and no action handler', () => {
    for (const { path, text } of SOURCES) {
      expect(text, `${path} renders a form`).not.toMatch(/<form[\s>]/i)
      expect(text, `${path} renders a button`).not.toMatch(/<button[\s>]/i)
      expect(text, `${path} renders an input`).not.toMatch(/<(input|textarea|select)[\s>]/i)
      expect(text, `${path} wires an action`).not.toMatch(/\baction=\{/)
      expect(text, `${path} wires a click handler`).not.toMatch(/\bonClick=/)
      expect(text, `${path} wires a submit handler`).not.toMatch(/\bonSubmit=/)
    }
  })

  it('does not revalidate or redirect as a write side effect', () => {
    for (const { path, text } of SOURCES) {
      expect(text.includes('revalidatePath'), `${path} revalidates`).toBe(false)
      expect(text.includes('revalidateTag'), `${path} revalidates`).toBe(false)
    }
  })

  it('names the practitioner actions only as unavailable, never as controls', () => {
    expect(ALL).toContain('Not available in Founder Review Mode')
    // The words appear in prose. What must not appear is a control bearing
    // them, which the no-button / no-form assertions above already forbid.
    expect(ALL).toMatch(/Sign off/)
  })
})

describe('Founder Review route — no fixture, no second source', () => {
  it('imports no fixture or preview module', () => {
    for (const { path, text } of SOURCES) {
      expect(text, `${path} imports a fixture`).not.toMatch(/from\s+['"][^'"]*fixture/i)
      expect(text, `${path} imports a preview module`).not.toMatch(/from\s+['"][^'"]*\/preview\//)
      expect(text, `${path} imports the connected preview case`).not.toMatch(/_connected/)
      expect(text, `${path} references a fixture symbol`).not.toMatch(
        /\b(caseFixture|clientFixture|CASE_FIXTURE|demoCase|sampleCase)\b/,
      )
    }
  })

  it('reads the canonical case through the db package, not its own query', () => {
    expect(ALL).toMatch(/getFounderReviewCase/)
    expect(ALL).toMatch(/@natural-intelligence\/db\/crt/)
    expect(ALL).toMatch(/listFounderReviewCases/)
  })

  it('refuses rather than substituting content when a row is absent', () => {
    expect(ALL).toContain('No consultation recorded yet')
    expect(ALL).toContain('No Intake response')
    expect(ALL).toContain('No released plan')
    expect(ALL).toContain('Review refused')
  })

  it('never labels the Founder as a practitioner, Lead or LRP', () => {
    for (const { path, text } of SOURCES) {
      expect(text, `${path} claims a clinical role`).not.toMatch(
        /(you are|your role)[^\n]{0,24}(practitioner|lead|lrp)/i,
      )
      // The page SHOULD say it confers no LRP authority, so banning the word
      // outright would forbid the disclaimer. What must be absent is language
      // attributing a clinical role to whoever is looking.
      expect(text, `${path} attributes a clinical role to the viewer`).not.toMatch(
        /(yourRole|acting as|signed in as|logged in as)/i,
      )
      expect(text, `${path} gives the viewer a clinical job title`).not.toMatch(
        /Lead Responsible Practitioner/i,
      )
    }
    expect(ALL).toMatch(/Read only/)
    expect(ALL).toMatch(/does not confer practitioner, Lead or LRP authority/)
  })
})

describe('Founder Review registry — labels, not answers', () => {
  const fields = SOURCES.find((s) => s.path.endsWith('fields.ts'))!

  it('carries no answer, value or default alongside its labels', () => {
    expect(fields.text).not.toMatch(/^\s*(value|answer|example|default|sample)\s*:/m)
  })

  it('declares every field with a key, a label and a source only', () => {
    const keys = new Set(
      [...fields.text.matchAll(/^\s*(?:readonly\s+)?([a-zA-Z]+)\??:/gm)].map((m) => m[1]),
    )
    for (const k of keys) {
      expect(['key', 'label', 'source', 'conditional', 'id', 'title', 'fields']).toContain(k)
    }
  })
})

describe('Founder Review route — stays behind the admin guard', () => {
  it('sits inside the (protected) group', () => {
    for (const { path } of SOURCES) {
      expect(path.replace(/\\/g, '/')).toContain('app/(protected)/')
    }
  })

  it('performs its own admin role check as well as inheriting the layout guard', () => {
    for (const { path, text } of SOURCES.filter((s) => s.path.endsWith('page.tsx'))) {
      // [\s\S] rather than the `s` flag: the db package targets ES2017.
      expect(text, `${path} does not check the admin role`).toMatch(/role[\s\S]*!==\s*'admin'/)
      expect(text, `${path} does not redirect a non-admin`).toMatch(/redirect\(/)
    }
  })

  it('is not exempted by the admin middleware', () => {
    const mw = readFileSync(join(REPO, 'apps/admin/middleware.ts'), 'utf8')
    expect(mw).not.toContain('founder-review')
    expect(mw).not.toContain('review-packs')
  })
})
