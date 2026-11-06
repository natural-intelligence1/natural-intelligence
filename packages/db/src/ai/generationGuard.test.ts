// ─── generationGuard.test.ts ──────────────────────────────────────────────────
// Mission 20 — the concurrency guard that the 13 September burst would have
// stopped: four full Opus generations for one member inside 44 seconds.
//
// The guard is deliberately NOT a distributed mutex, so these tests pin what
// it does guarantee and, just as importantly, what it does not.

import { describe, it, expect, beforeEach } from 'vitest'
import {
  claimGeneration, __resetGenerationClaims,
  GENERATION_COOLDOWN_MS, IN_FLIGHT_TTL_MS,
} from './generationGuard'

const MEMBER = '11111111-1111-1111-1111-111111111111'
const OTHER = '22222222-2222-2222-2222-222222222222'
const CASE = '33333333-3333-3333-3333-333333333333'

type TableResult = { data: unknown; error: unknown }

/**
 * Minimal thenable stand-in for the query builder. Every chain method returns
 * `this`; awaiting resolves the result configured for the table. Deliberately
 * not a mock framework — the point is to control exactly one thing (what the
 * database says was generated last) and leave the guard's own logic real.
 */
function fakeClient(tables: Record<string, TableResult>, onCall?: (t: string) => void) {
  const builder = (table: string) => {
    const result = tables[table] ?? { data: [], error: null }
    const chain: Record<string, unknown> = {
      select: () => chain, eq: () => chain, in: () => chain,
      order: () => chain, limit: () => chain,
      then: (resolve: (v: TableResult) => unknown) => Promise.resolve(result).then(resolve),
    }
    return chain
  }
  return {
    from: (table: string) => {
      onCall?.(table)
      return builder(table)
    },
  } as never
}

/** No prior output of any kind. */
const emptyDb = () => fakeClient({
  ai_summaries: { data: [], error: null },
  client_cases: { data: [], error: null },
  reasoning_traces: { data: [], error: null },
})

beforeEach(() => { __resetGenerationClaims() })

describe('claimGeneration — first call', () => {
  it('allows generation when nothing has been generated before', async () => {
    const claim = await claimGeneration(emptyDb(), MEMBER, 'health_synopsis')
    expect(claim.allowed).toBe(true)
  })

  it('allows body story when the member has no case at all', async () => {
    // No case means nothing was ever generated — and the guard must NOT
    // create one to find out. getOrCreateClientCase is deliberately not used.
    const seen: string[] = []
    const client = fakeClient({ client_cases: { data: [], error: null } }, (t) => seen.push(t))
    const claim = await claimGeneration(client, MEMBER, 'body_story')
    expect(claim.allowed).toBe(true)
    expect(seen).toEqual(['client_cases'])
    expect(seen).not.toContain('reasoning_traces')
  })
})

describe('claimGeneration — the 44-second burst', () => {
  it('refuses a second synopsis generated seconds ago', async () => {
    const now = Date.now()
    const client = fakeClient({
      ai_summaries: { data: [{ created_at: new Date(now - 14_000).toISOString() }], error: null },
    })
    const claim = await claimGeneration(client, MEMBER, 'health_synopsis', now)
    expect(claim.allowed).toBe(false)
    if (claim.allowed) throw new Error('unreachable')
    expect(claim.reason).toBe('recently_generated')
    expect(claim.retryAfterMs).toBe(GENERATION_COOLDOWN_MS - 14_000)
  })

  it('collapses the whole observed burst to one generation', async () => {
    // The real sequence: 23:38:02, :16, :31, :46. Only the first may run.
    const t0 = Date.now()
    const offsets = [0, 14_000, 29_000, 44_000]
    const allowed: boolean[] = []
    for (const offset of offsets) {
      __resetGenerationClaims()
      const client = offset === 0
        ? emptyDb()
        : fakeClient({ ai_summaries: { data: [{ created_at: new Date(t0).toISOString() }], error: null } })
      const claim = await claimGeneration(client, MEMBER, 'health_synopsis', t0 + offset)
      allowed.push(claim.allowed)
    }
    expect(allowed).toEqual([true, false, false, false])
  })

  it('refuses a second body story generated seconds ago', async () => {
    const now = Date.now()
    const client = fakeClient({
      client_cases: { data: [{ id: CASE }], error: null },
      reasoning_traces: { data: [{ created_at: new Date(now - 5_000).toISOString() }], error: null },
    })
    const claim = await claimGeneration(client, MEMBER, 'body_story', now)
    expect(claim.allowed).toBe(false)
  })
})

describe('claimGeneration — a legitimate later regeneration is never discarded', () => {
  it('allows regeneration once the cooldown has passed', async () => {
    const now = Date.now()
    const client = fakeClient({
      ai_summaries: {
        data: [{ created_at: new Date(now - GENERATION_COOLDOWN_MS - 1).toISOString() }],
        error: null,
      },
    })
    const claim = await claimGeneration(client, MEMBER, 'health_synopsis', now)
    expect(claim.allowed).toBe(true)
  })

  it('allows regeneration of a synopsis generated an hour ago', async () => {
    const now = Date.now()
    const client = fakeClient({
      ai_summaries: { data: [{ created_at: new Date(now - 3_600_000).toISOString() }], error: null },
    })
    expect((await claimGeneration(client, MEMBER, 'health_synopsis', now)).allowed).toBe(true)
  })

  it('tolerates a future timestamp rather than locking the member out', async () => {
    // Clock skew between instances must not become a permanent refusal.
    const now = Date.now()
    const client = fakeClient({
      ai_summaries: { data: [{ created_at: new Date(now + 30_000).toISOString() }], error: null },
    })
    expect((await claimGeneration(client, MEMBER, 'health_synopsis', now)).allowed).toBe(true)
  })
})

describe('claimGeneration — in-flight claim', () => {
  it('refuses a second concurrent call for the same member and output', async () => {
    const first = await claimGeneration(emptyDb(), MEMBER, 'health_synopsis')
    expect(first.allowed).toBe(true)
    const second = await claimGeneration(emptyDb(), MEMBER, 'health_synopsis')
    expect(second.allowed).toBe(false)
    if (second.allowed) throw new Error('unreachable')
    expect(second.reason).toBe('in_flight')
  })

  it('refuses BOTH of two truly simultaneous calls but the first', async () => {
    // The claim is taken synchronously before the first await, so starting
    // both without awaiting still admits exactly one.
    const results = await Promise.all([
      claimGeneration(emptyDb(), MEMBER, 'health_synopsis'),
      claimGeneration(emptyDb(), MEMBER, 'health_synopsis'),
      claimGeneration(emptyDb(), MEMBER, 'health_synopsis'),
    ])
    expect(results.filter((r) => r.allowed)).toHaveLength(1)
  })

  it('releases on completion so the next generation may proceed', async () => {
    const first = await claimGeneration(emptyDb(), MEMBER, 'health_synopsis')
    if (!first.allowed) throw new Error('expected the first claim to be allowed')
    first.release()
    expect((await claimGeneration(emptyDb(), MEMBER, 'health_synopsis')).allowed).toBe(true)
  })

  it('is idempotent on release — a double release cannot free another claim', async () => {
    const a = await claimGeneration(emptyDb(), MEMBER, 'health_synopsis')
    if (!a.allowed) throw new Error('unreachable')
    a.release()
    const b = await claimGeneration(emptyDb(), MEMBER, 'health_synopsis')
    if (!b.allowed) throw new Error('unreachable')
    a.release()   // stale handle — must not release b's claim
    expect((await claimGeneration(emptyDb(), MEMBER, 'health_synopsis')).allowed).toBe(false)
  })

  it('expires an unreleased claim, so a frozen invocation cannot lock a member out', async () => {
    // The intake path is fire-and-forget and Vercel may freeze it mid-call.
    const now = Date.now()
    const first = await claimGeneration(emptyDb(), MEMBER, 'health_synopsis', now)
    expect(first.allowed).toBe(true)
    // Never released.
    const during = await claimGeneration(emptyDb(), MEMBER, 'health_synopsis', now + IN_FLIGHT_TTL_MS - 1)
    expect(during.allowed).toBe(false)
    const after = await claimGeneration(emptyDb(), MEMBER, 'health_synopsis', now + IN_FLIGHT_TTL_MS + 1)
    expect(after.allowed).toBe(true)
  })
})

describe('claimGeneration — the key is member AND output type', () => {
  it('does not let one member block another', async () => {
    const mine = await claimGeneration(emptyDb(), MEMBER, 'health_synopsis')
    expect(mine.allowed).toBe(true)
    expect((await claimGeneration(emptyDb(), OTHER, 'health_synopsis')).allowed).toBe(true)
  })

  it('does not let the synopsis block the body story for the same member', async () => {
    const synopsis = await claimGeneration(emptyDb(), MEMBER, 'health_synopsis')
    expect(synopsis.allowed).toBe(true)
    expect((await claimGeneration(emptyDb(), MEMBER, 'body_story')).allowed).toBe(true)
  })

  it('reads the right table and filter for each output type', async () => {
    const seenSynopsis: string[] = []
    await claimGeneration(fakeClient({}, (t) => seenSynopsis.push(t)), MEMBER, 'health_synopsis')
    expect(seenSynopsis).toEqual(['ai_summaries'])

    __resetGenerationClaims()
    const seenStory: string[] = []
    await claimGeneration(
      fakeClient({ client_cases: { data: [{ id: CASE }], error: null } }, (t) => seenStory.push(t)),
      MEMBER, 'body_story',
    )
    expect(seenStory).toEqual(['client_cases', 'reasoning_traces'])
  })
})

describe('claimGeneration — guard read failure', () => {
  it('refuses rather than generating blind when the recency read fails', async () => {
    const client = fakeClient({
      ai_summaries: { data: null, error: { code: '42501', message: 'permission denied' } },
    })
    const claim = await claimGeneration(client, MEMBER, 'health_synopsis')
    expect(claim.allowed).toBe(false)
    if (claim.allowed) throw new Error('unreachable')
    expect(claim.reason).toBe('guard_unavailable')
  })

  it('refuses when the case read fails for a body story', async () => {
    const client = fakeClient({
      client_cases: { data: null, error: { code: '42501', message: 'permission denied' } },
    })
    const claim = await claimGeneration(client, MEMBER, 'body_story')
    expect(claim.allowed).toBe(false)
  })

  it('releases the claim on a read failure, so the retry is not held for the TTL', async () => {
    const failing = fakeClient({
      ai_summaries: { data: null, error: { code: '42501', message: 'permission denied' } },
    })
    expect((await claimGeneration(failing, MEMBER, 'health_synopsis')).allowed).toBe(false)
    // The very next attempt must be free to try again immediately.
    expect((await claimGeneration(emptyDb(), MEMBER, 'health_synopsis')).allowed).toBe(true)
  })
})

describe('claimGeneration — window size is deliberate', () => {
  it('the cooldown is long enough to collapse the observed burst', () => {
    // The real burst spanned 44 seconds end to end.
    expect(GENERATION_COOLDOWN_MS).toBeGreaterThan(44_000)
  })

  it('the cooldown is short enough not to be a lockout', () => {
    expect(GENERATION_COOLDOWN_MS).toBeLessThanOrEqual(120_000)
  })

  it('an in-flight claim can never outlive the UI timeout it models', () => {
    expect(IN_FLIGHT_TTL_MS).toBeLessThanOrEqual(5 * 60_000)
  })
})
