// ─── founderReview.test.ts ───────────────────────────────────────────────────
// Stage 2. Two properties matter more than the rest and are asserted directly
// rather than inferred from reading order:
//
//   1. THE GUARD RUNS FIRST. A client whose profile is not marked test data is
//      refused before any clinical table is queried. The double records every
//      `from(table)` call, so "no health row was read" is a provable claim
//      about the call log, not a claim about where the `if` happens to sit.
//
//   2. NOTHING IS WRITTEN. The module is scanned for mutation verbs. A test
//      that only exercises the happy path would not notice an `.update()`
//      added to a branch it never reaches.
//
// The rest guards honesty of the empty states: absent rows must come back as
// null and empty arrays, never as zeroes or placeholders a page could mistake
// for data.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import {
  getFounderReviewCase,
  listFounderReviewCases,
  FOUNDER_REVIEW_TABLES,
} from './founderReview'

const HERE = dirname(fileURLToPath(import.meta.url))
const SOURCE = readFileSync(join(HERE, 'founderReview.ts'), 'utf8')

type AdminClient = SupabaseClient<Database>
type Canned = { data: unknown; error: unknown }

interface Call {
  table: string
  method: string
  args: unknown[]
}

/** A Supabase double that records which tables were touched, in order, and
 *  with which filter arguments. Every builder method returns the same thenable
 *  chain, so it does not care what order the real code calls them in. */
function mkDouble(tables: Record<string, Partial<Canned>>) {
  const order: string[] = []
  const calls: Call[] = []

  function chainFor(table: string) {
    const canned: Canned = { data: null, error: null, ...(tables[table] ?? {}) }
    const chain: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'is', 'neq', 'order', 'limit', 'range']) {
      chain[m] = (...args: unknown[]) => {
        calls.push({ table, method: m, args })
        return chain
      }
    }
    chain.maybeSingle = async () => canned
    chain.single = async () => canned
    chain.then = (res: (v: Canned) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(canned).then(res, rej)
    return chain
  }

  const client = {
    from: (table: string) => {
      order.push(table)
      return chainFor(table)
    },
  } as unknown as AdminClient

  return { client, order, calls }
}

const CASE_ID = 'case-1'
const MEMBER_ID = 'member-1'

const CASE_ROW = {
  id: CASE_ID,
  client_id: MEMBER_ID,
  status: 'intake_complete',
  primary_concern: null,
  created_at: '2026-11-08T02:44:06.000Z',
  updated_at: '2026-11-08T02:44:06.000Z',
}

const TEST_PROFILE = { id: MEMBER_ID, full_name: 'Test Client', is_test_data: true }

/** The tables that hold health content. None of these may be read by a
 *  refused request. profiles and client_cases are the guard's own inputs. */
const CLINICAL_TABLES = [
  'intake_responses',
  'intake_sessions',
  'intake_answers',
  'case_taking_sessions',
  'case_taking_answers',
]

describe('getFounderReviewCase — the test-data guard', () => {
  it('refuses an unknown case and reads nothing else', async () => {
    const d = mkDouble({ client_cases: { data: null } })
    const result = await getFounderReviewCase(d.client, CASE_ID)

    expect(result).toEqual({ ok: false, refusal: 'case_not_found' })
    expect(d.order).toEqual(['client_cases'])
  })

  it('refuses when the client profile is missing, before any clinical read', async () => {
    const d = mkDouble({ client_cases: { data: CASE_ROW }, profiles: { data: null } })
    const result = await getFounderReviewCase(d.client, CASE_ID)

    expect(result).toEqual({ ok: false, refusal: 'client_profile_missing' })
    expect(d.order).toEqual(['client_cases', 'profiles'])
    for (const t of CLINICAL_TABLES) expect(d.order).not.toContain(t)
  })

  it('refuses a non-test client and reads NO health row', async () => {
    const d = mkDouble({
      client_cases: { data: CASE_ROW },
      profiles: { data: { ...TEST_PROFILE, is_test_data: false } },
    })
    const result = await getFounderReviewCase(d.client, CASE_ID)

    expect(result).toEqual({ ok: false, refusal: 'not_test_data' })
    for (const t of CLINICAL_TABLES) expect(d.order).not.toContain(t)
  })

  it('treats a NULL is_test_data flag as not test data', async () => {
    const d = mkDouble({
      client_cases: { data: CASE_ROW },
      profiles: { data: { ...TEST_PROFILE, is_test_data: null } },
    })
    const result = await getFounderReviewCase(d.client, CASE_ID)

    expect(result).toEqual({ ok: false, refusal: 'not_test_data' })
    for (const t of CLINICAL_TABLES) expect(d.order).not.toContain(t)
  })

  it('reads the guard inputs BEFORE every clinical table on the happy path', async () => {
    const d = mkDouble({ client_cases: { data: CASE_ROW }, profiles: { data: TEST_PROFILE } })
    const result = await getFounderReviewCase(d.client, CASE_ID)

    expect(result.ok).toBe(true)
    const guardEnd = Math.max(d.order.indexOf('client_cases'), d.order.indexOf('profiles'))
    for (const t of d.order.slice(guardEnd + 1)) {
      expect(CLINICAL_TABLES).toContain(t)
    }
    expect(d.order.indexOf('client_cases')).toBe(0)
    expect(d.order.indexOf('profiles')).toBe(1)
  })

  it('propagates a query error rather than rendering a partial case', async () => {
    const d = mkDouble({
      client_cases: { data: CASE_ROW },
      profiles: { data: TEST_PROFILE },
      intake_responses: { error: { message: 'boom' } },
    })
    await expect(getFounderReviewCase(d.client, CASE_ID)).rejects.toBeTruthy()
  })
})

describe('getFounderReviewCase — the Intake is delegated, not re-resolved', () => {
  it('hands back a canonical Intake rather than its own answer shape', async () => {
    const d = mkDouble({ client_cases: { data: CASE_ROW }, profiles: { data: TEST_PROFILE } })
    const result = await getFounderReviewCase(d.client, CASE_ID)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    // The shape of the shared projection, not a bespoke one.
    expect(result.data.intake).toBeDefined()
    expect(Array.isArray(result.data.intake.sections)).toBe(true)
    expect(Array.isArray(result.data.intake.sessions)).toBe(true)
    expect(result.data.intake.memberId).toBe(MEMBER_ID)
  })

  it('reads the Intake tables through the projection, not itself', () => {
    // The bespoke "column empty, intake_answers has a value" fallback used to
    // live here. If it comes back, these queries come back with it.
    expect(SOURCE).toContain('getCanonicalIntake')
    for (const table of ['intake_responses', 'intake_answers', 'intake_sessions']) {
      expect(SOURCE, `still queries ${table} itself`).not.toContain(`from('${table}')`)
    }
  })

  it('resolves no answer of its own', () => {
    // No precedence logic, no shape coercion, no emptiness judgement.
    expect(SOURCE).not.toMatch(/most_want_to_understand|current_supplements|psychosocial_supported/)
    expect(SOURCE).not.toMatch(/fromAnswerRowOnly|answerByKey/)
  })

  it('returns empty consultations rather than a placeholder', async () => {
    const d = mkDouble({ client_cases: { data: CASE_ROW }, profiles: { data: TEST_PROFILE } })
    const result = await getFounderReviewCase(d.client, CASE_ID)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.consultations).toEqual([])
  })

  it('does not query case_taking_answers when no consultation exists', async () => {
    const d = mkDouble({
      client_cases: { data: CASE_ROW },
      profiles: { data: TEST_PROFILE },
      case_taking_sessions: { data: [] },
    })
    await getFounderReviewCase(d.client, CASE_ID)

    expect(d.order).toContain('case_taking_sessions')
    expect(d.order).not.toContain('case_taking_answers')
  })

  it('counts case-taking answers per consultation when consultations exist', async () => {
    const d = mkDouble({
      client_cases: { data: CASE_ROW },
      profiles: { data: TEST_PROFILE },
      case_taking_sessions: {
        data: [
          { id: 's1', consultation_seq: 1, consultation_kind: 'initial', state: 'draft', signed_off_at: null, created_at: null },
          { id: 's2', consultation_seq: 2, consultation_kind: 'follow_up', state: 'signed_off', signed_off_at: '2026-11-08T00:00:00.000Z', created_at: null },
        ],
      },
      case_taking_answers: {
        data: [{ session_id: 's1' }, { session_id: 's1' }, { session_id: 's2' }],
      },
    })
    const result = await getFounderReviewCase(d.client, CASE_ID)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.consultations.map((c) => [c.id, c.answerCount])).toEqual([
      ['s1', 2],
      ['s2', 1],
    ])
  })
})

describe('listFounderReviewCases — test clients only', () => {
  it('returns nothing, and never queries cases, when no test profile exists', async () => {
    const d = mkDouble({ profiles: { data: [] } })
    const rows = await listFounderReviewCases(d.client)

    expect(rows).toEqual([])
    expect(d.order).toEqual(['profiles'])
    expect(d.order).not.toContain('client_cases')
  })

  it('filters profiles on is_test_data and restricts cases to those clients', async () => {
    const d = mkDouble({
      profiles: { data: [{ id: MEMBER_ID, full_name: 'Test Client' }] },
      client_cases: {
        data: [{ id: CASE_ID, client_id: MEMBER_ID, status: 'intake_complete', created_at: null }],
      },
    })
    const rows = await listFounderReviewCases(d.client)

    expect(rows).toEqual([
      {
        caseId: CASE_ID,
        status: 'intake_complete',
        createdAt: null,
        clientId: MEMBER_ID,
        clientName: 'Test Client',
      },
    ])

    const profileFilter = d.calls.find((c) => c.table === 'profiles' && c.method === 'eq')
    expect(profileFilter?.args).toEqual(['is_test_data', true])

    const caseFilter = d.calls.find((c) => c.table === 'client_cases' && c.method === 'in')
    expect(caseFilter?.args).toEqual(['client_id', [MEMBER_ID]])
  })
})

describe('founderReview.ts — read-only by construction', () => {
  for (const verb of ['insert', 'update', 'upsert', 'delete', 'rpc']) {
    it(`never calls .${verb}(`, () => {
      expect(SOURCE).not.toContain(`.${verb}(`)
    })
  }

  it('declares only the canonical tables, and queries only those', () => {
    const queried = [...SOURCE.matchAll(/\.from\('([a-z_]+)'\)/g)].map((m) => m[1])
    expect(queried.length).toBeGreaterThan(0)
    for (const t of new Set(queried)) {
      expect(FOUNDER_REVIEW_TABLES as readonly string[]).toContain(t)
    }
  })

  it('touches no practitioner authority table', () => {
    for (const t of [
      'case_team_roles',
      'client_practitioner_links',
      'case_practitioner_work',
      'practitioners',
      'practitioner_applications',
    ]) {
      expect(SOURCE).not.toContain(`'${t}'`)
    }
  })

  it('reads no second source — no snapshot, preview or fixture table', () => {
    for (const t of ['review_case', 'preview_case', 'founder_case', 'snapshot']) {
      expect(SOURCE.toLowerCase()).not.toContain(`from('${t}`)
    }
    expect(SOURCE).not.toMatch(/import .*fixture/i)
  })
})
