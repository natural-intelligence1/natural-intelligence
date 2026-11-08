// ─── intakeCaseSpine.test.ts ─────────────────────────────────────────────────
// The Stage 1 contract, after atomicity closure.
//
// The DECISION logic now lives in PostgreSQL (migration 0068,
// complete_intake_with_case), because it has to be atomic and serialised per
// client to be worth anything. These tests therefore cover what is still
// TypeScript's job:
//
//   · the wrapper calls the one database primitive, with the right arguments
//   · it refuses to report success on an empty or case-less result
//   · completion is a single round trip — no sequence of writes to interleave
//   · the completion path still runs it synchronously, before optional work
//
// The transactional and concurrency behaviour is proved against the live
// database, not here: a scripted fake cannot demonstrate a rollback.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  completeIntakeWithCase,
  linkIntakeCompletionToCase,
  OPEN_CASE_STATUSES,
  INTAKE_COMPLETION_CASE_STATUS,
  INTAKE_COMPLETION_RPC,
} from './intakeCaseSpine'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '../../../..')

function codeOf(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/\s\/\/[^\n]*/g, ' ')
}

/** A double that records every rpc call and returns a scripted result. */
function makeClient(result: { data: unknown; error: unknown }) {
  const calls: { fn: string; args: Record<string, unknown> }[] = []
  const client = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args })
      return result
    },
    from() {
      throw new Error('completion must go through the rpc, not a table write')
    },
  }
  return { client: client as never, calls }
}

const ONE_ROW = [{
  case_id: 'case-1', outcome: 'created',
  case_status: 'intake_complete', already_linked: false,
}]

describe('the wrapper calls the one database primitive', () => {
  it('invokes complete_intake_with_case with the member and consent', async () => {
    const { client, calls } = makeClient({ data: ONE_ROW, error: null })
    const r = await completeIntakeWithCase(client, 'member-1', {
      consentToAi: true, consentGivenAt: '2026-11-08T00:00:00.000Z',
    })

    expect(calls).toHaveLength(1)
    expect(calls[0].fn).toBe('complete_intake_with_case')
    expect(calls[0].args).toEqual({
      p_member_id: 'member-1',
      p_consent_to_ai: true,
      p_consent_given_at: '2026-11-08T00:00:00.000Z',
      p_completed_sections: 6,
    })
    expect(r).toEqual({
      caseId: 'case-1', outcome: 'created',
      caseStatus: 'intake_complete', alreadyLinked: false,
    })
  })

  it('is ONE round trip — there is nothing to interleave', async () => {
    // The previous implementation made five separate requests. A sequence of
    // requests cannot be rolled back; a single function call can.
    const { client, calls } = makeClient({ data: ONE_ROW, error: null })
    await completeIntakeWithCase(client, 'member-1')
    expect(calls).toHaveLength(1)
  })

  it('never writes to a table directly', async () => {
    // The double throws from from(); reaching it would fail the test.
    const { client } = makeClient({ data: ONE_ROW, error: null })
    await expect(completeIntakeWithCase(client, 'member-1')).resolves.toBeTruthy()
  })

  it('passes nulls rather than inventing consent', async () => {
    const { client, calls } = makeClient({ data: ONE_ROW, error: null })
    await completeIntakeWithCase(client, 'member-1')
    expect(calls[0].args.p_consent_to_ai).toBeNull()
    expect(calls[0].args.p_consent_given_at).toBeNull()
  })

  it('maps an already-linked repeat completion', async () => {
    const { client } = makeClient({
      data: [{ case_id: 'case-1', outcome: 'resumed', case_status: 'active', already_linked: true }],
      error: null,
    })
    const r = await completeIntakeWithCase(client, 'member-1')
    expect(r).toMatchObject({ caseId: 'case-1', outcome: 'resumed', alreadyLinked: true })
  })

  it('keeps the previous export name working', () => {
    expect(linkIntakeCompletionToCase).toBe(completeIntakeWithCase)
  })
})

describe('it refuses to report a completion it cannot name a case for', () => {
  it('throws on a database error', async () => {
    const { client } = makeClient({ data: null, error: { message: 'deadlock', code: '40P01' } })
    await expect(completeIntakeWithCase(client, 'member-1'))
      .rejects.toMatchObject({ code: '40P01' })
  })

  it('throws when the function returns no row', async () => {
    const { client } = makeClient({ data: [], error: null })
    await expect(completeIntakeWithCase(client, 'member-1'))
      .rejects.toThrow(/no row returned/)
  })

  it('throws when the row carries no case id', async () => {
    const { client } = makeClient({
      data: [{ case_id: null, outcome: 'created', case_status: 'intake_complete' }],
      error: null,
    })
    await expect(completeIntakeWithCase(client, 'member-1'))
      .rejects.toThrow(/no case id/)
  })
})

describe('identity does not depend on any optional feature', () => {
  it('the module reads no environment flag at all', () => {
    const src = codeOf(join(HERE, 'intakeCaseSpine.ts'))
    expect(src).not.toMatch(/process\.env/)
    expect(src).not.toContain('AI_INTERPRETATION_ENABLED')
    expect(src).not.toContain('INTAKE_ASSIGNMENT_ENABLED')
  })

  it('resolves with every flag unset, and with them false', async () => {
    const prev = { ...process.env }
    try {
      delete process.env.AI_INTERPRETATION_ENABLED
      delete process.env.INTAKE_ASSIGNMENT_ENABLED
      const a = makeClient({ data: ONE_ROW, error: null })
      expect((await completeIntakeWithCase(a.client, 'm')).caseId).toBe('case-1')

      process.env.AI_INTERPRETATION_ENABLED = 'false'
      process.env.INTAKE_ASSIGNMENT_ENABLED = 'false'
      const b = makeClient({ data: ONE_ROW, error: null })
      expect((await completeIntakeWithCase(b.client, 'm')).caseId).toBe('case-1')
    } finally {
      process.env = prev
    }
  })
})

describe('the completion path runs it synchronously, before optional work', () => {
  const actions = readFileSync(
    join(REPO, 'apps/web/app/dashboard/intake/actions.ts'), 'utf8',
  )

  it('awaits it directly and does not swallow failures', () => {
    const call = actions.indexOf('linkIntakeCompletionToCase(')
    expect(call).toBeGreaterThan(-1)
    const line = actions.slice(actions.lastIndexOf('\n', call), actions.indexOf('\n', call))
    expect(line).toMatch(/await\s+linkIntakeCompletionToCase/)
    expect(line).not.toMatch(/\.catch\(/)
  })

  it('runs before the generators, the assignment bridge and the restriction return', () => {
    const call = actions.indexOf('linkIntakeCompletionToCase(')
    for (const marker of [
      'generateHealthSynopsis(user.id)',
      'generateBodyStory(user.id)',
      'routeCompletedCaseToPractitioner(user.id)',
      'isProcessingBlocked(createAdminClient()',
    ]) {
      const at = actions.indexOf(marker)
      expect(at, marker).toBeGreaterThan(-1)
      expect(call, marker).toBeLessThan(at)
    }
  })

  it('no longer writes the completion as a separate request', () => {
    // That separate write was the remaining atomicity hole: it committed
    // is_complete = true before the case existed.
    const code = codeOf(join(REPO, 'apps/web/app/dashboard/intake/actions.ts'))
    const completeFn = code.slice(code.indexOf('export async function completeIntake'))
    expect(completeFn).not.toMatch(/is_complete:\s*true/)
    expect(completeFn).not.toMatch(/from\('intake_responses'\)[\s\S]{0,120}\.insert\(/)
  })
})

describe('the migration carries the invariants', () => {
  const sql = readFileSync(
    join(REPO, 'supabase/migrations/0068_complete_intake_with_case.sql'), 'utf8',
  )

  it('serialises per client with a transaction-scoped advisory lock', () => {
    expect(sql).toMatch(/pg_advisory_xact_lock\(hashtextextended\(p_member_id/)
    // Never a global lock.
    expect(sql).not.toMatch(/pg_advisory_xact_lock\(\s*\d+\s*\)/)
  })

  it('takes the lock BEFORE the first read — otherwise the loser reads stale', () => {
    const lock = sql.indexOf('pg_advisory_xact_lock')
    const firstRead = sql.indexOf('FROM public.intake_responses')
    expect(lock).toBeGreaterThan(-1)
    expect(lock).toBeLessThan(firstRead)
  })

  it('is SECURITY INVOKER and not a privilege grant', () => {
    expect(sql).toMatch(/SECURITY INVOKER/)
    expect(sql).not.toMatch(/SECURITY DEFINER/)
    expect(sql).toMatch(/SET search_path = public, pg_temp/)
  })

  it('refuses a non-service caller completing someone else’s Intake', () => {
    expect(sql).toMatch(/v_role <> 'service_role'/)
    expect(sql).toMatch(/42501/)
  })

  it('creates at intake_complete and never at active', () => {
    expect(sql).toMatch(/VALUES \(p_member_id, 'intake_complete'\)/)
    expect(sql).not.toMatch(/VALUES \(p_member_id, 'active'\)/)
  })

  it('advances only draft, and never demotes active or paused', () => {
    expect(sql).toMatch(/IF v_status = 'draft' THEN/)
    expect(sql).toMatch(/WHERE id = v_case_id AND status = 'draft'/)
  })

  it('resumes any non-closed case', () => {
    expect(sql).toMatch(/IN \('draft', 'intake_complete', 'active', 'paused'\)/)
    expect(sql).not.toMatch(/'closed'/)
  })

  it('never reassigns a set link', () => {
    // Qualified with the table alias: an unqualified `case_id` here is
    // ambiguous against the RETURNS TABLE output parameter, which is exactly
    // the defect the concurrency test caught.
    expect(sql).toMatch(/case_id\s*=\s*coalesce\(r\.case_id, v_case_id\)/)
  })

  it('qualifies every column that shares a name with an output parameter', () => {
    const body = sql.slice(sql.indexOf('UPDATE public.intake_responses AS r'))
    const setBlock = body.slice(0, body.indexOf('WHERE'))
    // No bare right-hand `case_id` — it must be r.case_id.
    expect(setBlock).not.toMatch(/coalesce\(case_id/)
    expect(sql).toMatch(/UPDATE public\.intake_responses AS r/)
  })

  it('marks only in_progress sessions completed', () => {
    expect(sql).toMatch(/AND status\s*=\s*'in_progress'/)
  })

  it('adds no uniqueness constraint — duplicates are a separate mission', () => {
    expect(sql).not.toMatch(/CREATE UNIQUE INDEX/i)
    expect(sql).not.toMatch(/ADD CONSTRAINT.*UNIQUE/i)
  })

  it('is not executable anonymously', () => {
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC, anon/)
  })

  it('touches no practitioner authority', () => {
    for (const banned of [
      'case_team_roles', 'practitioner_assignment_eligibility',
      'case_practitioner_work', 'signed_off', 'practitioners',
    ]) {
      expect(sql, banned).not.toContain(banned)
    }
  })
})

describe('shared constants', () => {
  it('open statuses exclude closed', () => {
    expect([...OPEN_CASE_STATUSES]).toEqual(['draft', 'intake_complete', 'active', 'paused'])
    expect(OPEN_CASE_STATUSES).not.toContain('closed')
  })

  it('completion status is intake_complete', () => {
    expect(INTAKE_COMPLETION_CASE_STATUS).toBe('intake_complete')
  })

  it('names the one primitive', () => {
    expect(INTAKE_COMPLETION_RPC).toBe('complete_intake_with_case')
  })
})

describe('getOrCreateClientCase still cannot duplicate', () => {
  it('resumes any open case rather than only active ones', () => {
    const src = codeOf(join(HERE, 'getOrCreateClientCase.ts'))
    expect(src).toContain("in('status', OPEN_CASE_STATUSES")
    expect(src).not.toMatch(/\.eq\('status',\s*'active'\)/)
  })
})
