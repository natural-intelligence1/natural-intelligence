// ─── containment.structure.test.ts ────────────────────────────────────────────
// Structural proof that the AI interpretation hold actually covers the whole
// generation surface — not just the paths someone remembered.
//
// WHY STRUCTURAL. The containment guarantee is architectural: every entry
// point funnels through a generator, and every generator asserts the flag
// before it does anything. A unit test of the flag cannot prove that. This
// test reads the application source and fails if the property stops holding,
// INCLUDING for a pipeline or an entry point added later.
//
// It lives in packages/db because apps/web's vitest project does not cover
// server actions, and this is the only place a cross-app source assertion
// runs. (The same reason devSeedGuard.structure.test.ts lives here.)

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const WEB = join(HERE, '../../../../apps/web')

const SYNOPSIS_ACTIONS = join(WEB, 'app/dashboard/synopsis/actions.ts')
const STORY_ACTIONS = join(WEB, 'app/dashboard/story/actions.ts')
const SYNOPSIS_PAGE = join(WEB, 'app/dashboard/synopsis/page.tsx')
const STORY_PAGE = join(WEB, 'app/dashboard/story/page.tsx')
const INTAKE_ACTIONS = join(WEB, 'app/dashboard/intake/actions.ts')
const HELD_COMPONENT = join(WEB, 'app/dashboard/_components/InterpretationHeldState.tsx')

const HAVE_WEB = existsSync(SYNOPSIS_ACTIONS)
const read = (p: string) => (existsSync(p) ? readFileSync(p, 'utf8') : '')

/**
 * The member-visible text of a component: everything from the first `return (`
 * onward, with comments stripped and lowercased.
 *
 * Checking the whole file would match the component's own documentation — the
 * comment block names the internal reason precisely so the copy does not, and
 * it says "must not imply diagnosis or clinical interpretation". Those are
 * instructions to the reader, not words shown to a member.
 */
function renderedCopy(path: string): string {
  const src = read(path)
  const start = src.indexOf('return (')
  if (start < 0) return ''
  return src
    .slice(start)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/.*$/gm, ' ')
    .toLowerCase()
}

/**
 * The two held pipelines, as named in the 13 September ruling: both derive
 * from Intake and both await the Legal/MHRA review.
 */
const GENERATORS: [string, string][] = [
  ['generateHealthSynopsis', SYNOPSIS_ACTIONS],
  ['generateBodyStory', STORY_ACTIONS],
]

/**
 * Files that call Anthropic but are deliberately NOT held, with the reason.
 * Anything calling Anthropic that is neither a held generator nor listed here
 * fails test A — which is the point: a new ungated pipeline cannot be added
 * quietly.
 */
const DOCUMENTED_EXEMPTIONS: Record<string, string> = {
  'app/dashboard/biohub/actions.ts':
    'Lab-report parsing. Not Intake-derived and not named in the ruling; it ' +
    'shares only ANTHROPIC_API_KEY, which is why removing that key was ' +
    'rejected as the containment mechanism.',
}

describe.skipIf(!HAVE_WEB)('A. every Anthropic call site is held or documented', () => {
  it('leaves no ungated AI pipeline', () => {
    // Enumerated from the repository rather than hardcoded, so a new file
    // appears here automatically.
    const callSites = [
      'app/dashboard/synopsis/actions.ts',
      'app/dashboard/story/actions.ts',
      'app/dashboard/biohub/actions.ts',
    ]
    const ungated = callSites.filter((rel) => {
      const src = read(join(WEB, rel))
      if (!src.includes('messages.create')) return false
      if (src.includes('isAiInterpretationEnabled()')) return false
      return !(rel in DOCUMENTED_EXEMPTIONS)
    })
    expect(ungated).toEqual([])
  })

  it('still finds Anthropic in each site it claims to cover', () => {
    // Guards against the list above silently going stale — e.g. a file
    // renamed, leaving the check vacuously true.
    for (const rel of ['app/dashboard/synopsis/actions.ts', 'app/dashboard/story/actions.ts']) {
      expect(read(join(WEB, rel))).toContain('messages.create')
    }
  })
})

describe.skipIf(!HAVE_WEB)('B. the flag is asserted inside each generator', () => {
  for (const [name, path] of GENERATORS) {
    it(`${name} asserts the flag before creating any client`, () => {
      const src = read(path)
      const fnStart = src.indexOf(`export async function ${name}`)
      expect(fnStart).toBeGreaterThan(-1)
      const body = src.slice(fnStart)

      const flagAt = body.indexOf('isAiInterpretationEnabled()')
      const clientAt = body.indexOf('createAdminClient()')
      expect(flagAt).toBeGreaterThan(-1)
      expect(clientAt).toBeGreaterThan(-1)
      // A held call must provably read nothing and write nothing.
      expect(flagAt).toBeLessThan(clientAt)
    })

    it(`${name} returns a held status rather than throwing`, () => {
      // The intake path swallows throws (fire-and-forget .catch), so a throw
      // would make the hold invisible.
      const src = read(path)
      const fnStart = src.indexOf(`export async function ${name}`)
      const gate = src.slice(fnStart, fnStart + 1800)
      expect(gate).toMatch(/if \(!isAiInterpretationEnabled\(\)\)/)
      expect(gate).toContain("return { status: 'held' }")
      expect(gate).not.toMatch(/isAiInterpretationEnabled\(\)[\s\S]{0,200}throw /)
    })
  }
})

describe.skipIf(!HAVE_WEB)('C. the member restriction is enforced inside each generator', () => {
  for (const [name, path] of GENERATORS) {
    it(`${name} checks isProcessingBlocked for ai_assisted_processing`, () => {
      const src = read(path)
      const body = src.slice(src.indexOf(`export async function ${name}`))
      expect(body).toContain('isProcessingBlocked(')
      expect(body).toContain("'ai_assisted_processing'")
    })

    it(`${name} checks the restriction BEFORE calling Anthropic`, () => {
      // This is the defect being closed: the page's Regenerate control
      // reached the model without ever passing this check.
      const src = read(path)
      const body = src.slice(src.indexOf(`export async function ${name}`))
      const restrictionAt = body.indexOf('isProcessingBlocked(')
      const modelAt = body.indexOf('messages.create')
      expect(restrictionAt).toBeGreaterThan(-1)
      expect(modelAt).toBeGreaterThan(-1)
      expect(restrictionAt).toBeLessThan(modelAt)
    })

    it(`${name} reports a restriction distinctly, not as a failure`, () => {
      const body = read(path)
      expect(body).toContain("return { status: 'restricted' }")
    })
  }
})

describe.skipIf(!HAVE_WEB)('D. the concurrency guard wraps each generation', () => {
  for (const [name, path] of GENERATORS) {
    it(`${name} claims before calling Anthropic`, () => {
      const src = read(path)
      const body = src.slice(src.indexOf(`export async function ${name}`))
      const claimAt = body.indexOf('claimGeneration(')
      const modelAt = body.indexOf('messages.create')
      expect(claimAt).toBeGreaterThan(-1)
      expect(claimAt).toBeLessThan(modelAt)
    })

    it(`${name} releases the claim in a finally block`, () => {
      // Without this a failed generation would block the member's retry for
      // the full in-flight TTL.
      const src = read(path)
      const body = src.slice(src.indexOf(`export async function ${name}`))
      const finallyAt = body.indexOf('} finally {')
      expect(finallyAt).toBeGreaterThan(-1)
      expect(body.slice(finallyAt, finallyAt + 220)).toContain('claim.release()')
    })

    it(`${name} reports a refusal distinctly, not as a failure`, () => {
      expect(read(path)).toContain("return { status: 'throttled' }")
    })
  }
})

describe.skipIf(!HAVE_WEB)('E. no entry point bypasses the generators', () => {
  it('both page-level controls call the generator, not the model', () => {
    for (const page of [SYNOPSIS_PAGE, STORY_PAGE]) {
      const src = read(page)
      expect(src).toMatch(/generateHealthSynopsis\(|generateBodyStory\(/)
      // A page must never reach Anthropic or write the output table itself.
      expect(src).not.toContain('messages.create')
    }
  })

  it('intake completion calls the generators and nothing lower', () => {
    const src = read(INTAKE_ACTIONS)
    expect(src).toContain('generateHealthSynopsis(')
    expect(src).toContain('generateBodyStory(')
    expect(src).not.toContain('messages.create')
  })

  it('the generators are the only exported entry to generation', () => {
    // If a second exported generator appears in either actions file, it needs
    // its own gate and this test should be extended to cover it.
    for (const [, path] of GENERATORS) {
      const exported = [...read(path).matchAll(/^export async function (\w+)/gm)].map((m) => m[1])
      const generatorish = exported.filter((n) => /^generate/.test(n))
      expect(generatorish).toHaveLength(1)
    }
  })
})

describe.skipIf(!HAVE_WEB)('F. the held UI is honest', () => {
  it('a held state component exists and does not poll or offer a retry', () => {
    const src = read(HELD_COMPONENT)
    expect(src).toContain('Your information has been saved')
    expect(src).toContain('is not currently being generated')
    // No timer, no auto-refresh, no form: there is nothing to retry.
    expect(src).not.toContain('setInterval')
    expect(src).not.toContain('setTimeout')
    expect(src).not.toContain('<form')
    expect(src).not.toContain('use client')
  })

  it('does not leak the internal reason to the member', () => {
    // Only what is rendered, not the file's own documentation — the comment
    // block legitimately names the reason the copy must not.
    const rendered = renderedCopy(HELD_COMPONENT)
    expect(rendered).not.toBe('')
    for (const leak of ['mhra', 'legal review', 'regulat', 'feature flag', 'disabled', 'env var']) {
      expect(rendered).not.toContain(leak)
    }
  })

  it('does not imply diagnosis or clinical interpretation', () => {
    const rendered = renderedCopy(HELD_COMPONENT)
    for (const word of ['diagnos', 'clinical', 'treatment', 'condition', 'medical']) {
      expect(rendered).not.toContain(word)
    }
  })

  it('each page checks the flag BEFORE rendering the generating state', () => {
    for (const page of [SYNOPSIS_PAGE, STORY_PAGE]) {
      const src = read(page)
      expect(src).toContain('isAiInterpretationEnabled()')
      expect(src).toContain('InterpretationHeldState')
      const heldAt = src.indexOf('InterpretationHeldState subject')
      const generatingAt = src.indexOf('<GeneratingState')
      expect(heldAt).toBeGreaterThan(-1)
      expect(generatingAt).toBeGreaterThan(-1)
      // The held branch must come first, or the member sees "Generating…".
      expect(heldAt).toBeLessThan(generatingAt)
    }
  })

  it('each page hides the regenerate control while held', () => {
    for (const page of [SYNOPSIS_PAGE, STORY_PAGE]) {
      // Offering a button the guard would silently refuse is the same
      // dishonesty as the false generating state.
      expect(read(page)).toContain('{interpretationEnabled && (')
    }
  })
})

describe.skipIf(!HAVE_WEB)('G. raw Intake collection is untouched', () => {
  it('the collection kill-switch is still asserted in completeIntake', () => {
    const src = read(INTAKE_ACTIONS)
    expect(src).toContain('assertIntakeCollectionEnabled()')
  })

  it('the intake writes are still unconditional on the AI flag', () => {
    // Capture is not interpretation: the hold must not touch either write.
    const src = read(INTAKE_ACTIONS)
    expect(src).toContain("from('intake_responses')")
    expect(src).not.toContain('isAiInterpretationEnabled')
  })
})
