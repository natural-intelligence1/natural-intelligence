// ─── previewPageBoundary.test.ts ─────────────────────────────────────────────
// The §5 verification greps, turned into a regression guard.
//
// Running them once by hand proves the state of one commit. Running them here
// proves it of every commit after, including the one where someone pastes a
// price back into the markup because the config felt like a detour.
//
// Three rules:
//
//   1. NO £ LITERAL in the pricing preview's own source. Prices come from the
//      catalogue, so a figure in markup is a figure that will go stale.
//   2. NO INTERNAL ALLOWANCE VALUE anywhere under apps/. 120/60/30 minutes of
//      professional time is commercial information, not page copy.
//   3. NO RETIRED TIER NAME survives — the deployed preview carried "Your
//      Health, Tracked" and "Fully Supported" for two months after they were
//      withdrawn, which is exactly the failure this guards.

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '../../../..')

/** The preview surface this guard is about. */
const PREVIEW_DIR = join(REPO, 'apps/admin/app/(protected)/route-map/preview/pricing')

/** Source roots swept for rules 2 and 3. Build output and tests excluded. */
const APP_ROOTS = ['apps']

function* walk(dir: string): Generator<string> {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry === 'dist') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) { yield* walk(full); continue }
    if (!/\.(ts|tsx)$/.test(entry)) continue
    if (/\.test\.tsx?$/.test(entry)) continue
    if (full.includes('__fixtures__')) continue
    yield full
  }
}

function appFiles(): string[] {
  const out: string[] = []
  for (const root of APP_ROOTS) out.push(...walk(join(REPO, root)))
  return out
}

function previewFiles(): string[] {
  return [...walk(PREVIEW_DIR)]
}

/** Source with comments stripped — prose that explains a rule must not trip it. */
function codeOf(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/\s\/\/[^\n]*/g, ' ')
}

const rel = (f: string) => relative(REPO, f).replace(/\\/g, '/')

/**
 * Just the RENDERED COPY of a source file: its string and template literals,
 * plus JSX text nodes.
 *
 * A price reaches a reader as text. Numbers in other positions are not
 * prices — the care-team illustration legitimately contains a 225° angle and
 * a 110px pill width, and flagging those would have taught the next person
 * that this guard cries wolf. So the bare-figure rule reads copy only, while
 * the £ rule below still scans the whole file, where a currency symbol is
 * wrong wherever it appears.
 */
function copyOf(file: string): string {
  const code = codeOf(file)
  const strings = code.match(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g) ?? []
  const jsxText = [...code.matchAll(/>([^<>{}]+)</g)].map((m) => m[1])
  return [...strings, ...jsxText].join('\n')
}

describe('the pricing preview holds no price of its own', () => {
  it('finds the preview source to sweep', () => {
    // A sweep that finds nothing would make every claim below vacuously true.
    const files = previewFiles()
    expect(files.length).toBeGreaterThan(0)
    expect(files.map(rel)).toContain(
      'apps/admin/app/(protected)/route-map/preview/pricing/page.tsx',
    )
  })

  it('contains no £ literal', () => {
    const offenders = previewFiles()
      .filter((f) => codeOf(f).includes('£'))
      .map(rel)
    expect(offenders).toEqual([])
  })

  it('renders no bare price figure typed as copy', () => {
    // Catches "249" written into text without a symbol — the £ rule above
    // would miss it. Scans rendered copy only (see copyOf), as whole tokens
    // so a date or an id inside a string does not trip it.
    const figures = [199, 179, 249, 225, 125, 110, 95, 85, 190, 38]
    const offenders: string[] = []
    for (const f of previewFiles()) {
      const copy = copyOf(f)
      for (const n of figures) {
        if (new RegExp(`(?<![\\w.$#-])${n}(?![\\w.%-])`).test(copy)) {
          offenders.push(`${rel(f)}: ${n}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('the copy scanner actually reads copy — it would catch a planted price', () => {
    // An over-narrowed scanner would make the rule above vacuous. This pins
    // that copyOf still sees string literals and JSX text.
    const page = copyOf(join(PREVIEW_DIR, 'page.tsx'))
    expect(page).toContain('Free to begin')
    expect(page).toContain('Membership is not required for professional care')
    expect(page.length).toBeGreaterThan(2000)
  })

  it('imports its prices from the catalogue', () => {
    const page = codeOf(join(PREVIEW_DIR, 'page.tsx'))
    expect(page).toMatch(/@natural-intelligence\/db\/pricing/)
  })
})

describe('internal professional-time allowances never reach a render path', () => {
  it('no file under apps/ names PRACTITIONER_TIME_ALLOWANCES', () => {
    const offenders = appFiles()
      .filter((f) => codeOf(f).includes('PRACTITIONER_TIME_ALLOWANCES'))
      .map(rel)
    expect(offenders).toEqual([])
  })

  it('no file under apps/ deep-imports the catalogue module', () => {
    // Apps take '@natural-intelligence/db/pricing', the public barrel. A deep
    // path would reach past it to the internal namespace.
    const offenders = appFiles()
      .filter((f) => /db\/pricing\/catalogue|pricing\/catalogue['"]/.test(codeOf(f)))
      .map(rel)
    expect(offenders).toEqual([])
  })

  it('the preview source carries no allowance value', () => {
    const offenders: string[] = []
    for (const f of previewFiles()) {
      const code = codeOf(f)
      for (const banned of ['120 min', '60 min', '30 min', '30–60 min', '30-60 min']) {
        if (code.includes(banned)) offenders.push(`${rel(f)}: ${banned}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('no file under apps/ carries an allowance value', () => {
    const offenders: string[] = []
    for (const f of appFiles()) {
      const code = codeOf(f)
      for (const banned of ['120 min', '30–60 min']) {
        if (code.includes(banned)) offenders.push(`${rel(f)}: ${banned}`)
      }
    }
    expect(offenders).toEqual([])
  })
})

describe('no retired tier or programme survives on the preview', () => {
  const BANNED = [
    '12-Week', '12-week', '12 week',
    'Fully Supported',
    'Your Health, Tracked', 'Your Health Tracked',
    'Seed', 'Growth', 'Flourish',
  ]

  it('the preview source names none of them', () => {
    const offenders: string[] = []
    for (const f of previewFiles()) {
      const code = codeOf(f)
      for (const banned of BANNED) {
        if (code.includes(banned)) offenders.push(`${rel(f)}: ${banned}`)
      }
    }
    expect(offenders).toEqual([])
  })
})

describe('the preview stays a preview', () => {
  const page = readFileSync(join(PREVIEW_DIR, 'page.tsx'), 'utf8')

  it('is noindexed', () => {
    expect(page).toMatch(/robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/)
  })

  it('keeps the admin-only guard', () => {
    const code = codeOf(join(PREVIEW_DIR, 'page.tsx'))
    expect(code).toContain("profile?.role !== 'admin'")
    expect(code).toContain('createAdminClient')
    expect(code).toMatch(/redirect\('\/login'\)/)
  })

  it('has no payment, checkout or subscription path', () => {
    const offenders: string[] = []
    for (const f of previewFiles()) {
      const code = codeOf(f)
      for (const banned of ['stripe', 'Stripe', 'checkout', 'Checkout', 'createSubscription']) {
        if (code.includes(banned)) offenders.push(`${rel(f)}: ${banned}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('every call to action is inert', () => {
    // The Founder ruled: presentational controls work, CTAs do not. So no
    // form, no submit and no server action anywhere on the surface.
    const offenders: string[] = []
    for (const f of previewFiles()) {
      const code = codeOf(f)
      if (/<form[\s>]/.test(code)) offenders.push(`${rel(f)}: <form>`)
      if (code.includes("'use server'")) offenders.push(`${rel(f)}: 'use server'`)
      if (/type="submit"/.test(code)) offenders.push(`${rel(f)}: submit`)
    }
    expect(offenders).toEqual([])
  })

  it('no Monthly/Yearly selector state survives from the design', () => {
    // The design file still carried setMonthly/annual after the label was
    // removed. Dead logic that toggles a price is worse than none.
    const offenders: string[] = []
    for (const f of previewFiles()) {
      const code = codeOf(f)
      for (const banned of ['setMonthly', 'setAnnual', 'annualPressed', 'monthlyBtn']) {
        if (code.includes(banned)) offenders.push(`${rel(f)}: ${banned}`)
      }
    }
    expect(offenders).toEqual([])
  })
})
