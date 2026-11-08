// ─── intakeCaseSpine.test.ts ─────────────────────────────────────────────────
// The Stage 1 contract: a completed Intake resolves to exactly one canonical
// case, and that fact survives every optional feature being switched off.
//
// These are unit tests over a scripted fake client. They prove the DECISION
// logic — what gets looked up, what gets written, what is refused. The
// database half of the contract (the FK, the same-owner rule and the
// immutability of a set link) is enforced by migration 0067's trigger and
// proved separately against the live catalogue.

import { describe, it, expect, vi } from 'vitest'
import {
  resolveCaseForIntakeCompletion,
  linkIntakeCompletionToCase,
  markIntakeSessionCompleted,
  OPEN_CASE_STATUSES,
  INTAKE_COMPLETION_CASE_STATUS,
} from './intakeCaseSpine'

// ─── A scripted Supabase double ──────────────────────────────────────────────
// Records every call so the tests can assert on what was asked for, not only
// on what came back.

interface Call { table: string; op: string; args: unknown[] }

function makeClient(script: {
  cases?: { data: unknown; error?: unknown }
  caseInsert?: { data: unknown; error?: unknown }
  caseUpdate?: { error?: unknown }
  response?: { data: unknown; error?: unknown }
  responseUpdate?: { data: unknown; error?: unknown }
  responseReRead?: { data: unknown; error?: unknown }
  caseStatus?: { data: unknown; error?: unknown }
  sessionUpdate?: { data: unknown; error?: unknown }
}) {
  const calls: Call[] = []
  let responseSelects = 0

  function builder(table: string, op: string) {
    const node: Record<string, unknown> = {}
    const chain = (name: string) => (...args: unknown[]) => {
      calls.push({ table, op: name, args })
      return node
    }
    for (const m of ['select', 'eq', 'in', 'is', 'order', 'limit', 'update', 'insert']) {
      node[m] = chain(m)
    }
    node.maybeSingle = async () => {
      if (table === 'client_cases') return script.cases ?? { data: null, error: null }
      if (table === 'intake_responses' && op === 'update') {
        return script.responseUpdate ?? { data: { case_id: 'case-new' }, error: null }
      }
      return script.response ?? { data: null, error: null }
    }
    node.single = async () => {
      if (table === 'client_cases' && op === 'insert') {
        return script.caseInsert ?? { data: { id: 'case-new', status: INTAKE_COMPLETION_CASE_STATUS }, error: null }
      }
      if (table === 'client_cases') return script.caseStatus ?? { data: { status: 'active' }, error: null }
      return script.responseReRead ?? { data: { case_id: 'case-new' }, error: null }
    }
    node.then = (resolve: (v: unknown) => unknown) => {
      if (table === 'client_cases' && op === 'update') return resolve(script.caseUpdate ?? { error: null })
      if (table === 'intake_sessions') return resolve(script.sessionUpdate ?? { data: [{ id: 's1' }], error: null })
      return resolve({ data: null, error: null })
    }
    return node
  }

  const client = {
    from(table: string) {
      const node: Record<string, unknown> = {}
      node.select = (...args: unknown[]) => {
        calls.push({ table, op: 'select', args })
        if (table === 'intake_responses') responseSelects++
        return builder(table, 'select')
      }
      node.insert = (...args: unknown[]) => {
        calls.push({ table, op: 'insert', args })
        return builder(table, 'insert')
      }
      node.update = (...args: unknown[]) => {
        calls.push({ table, op: 'update', args })
        return builder(table, 'update')
      }
      return node
    },
  }

  return { client: client as never, calls, responseSelects: () => responseSelects }
}

const find = (calls: Call[], table: string, op: string) =>
  calls.filter((c) => c.table === table && c.op === op)

// ─── 1. successful completion creates or resolves a case ─────────────────────

describe('1. a completed Intake resolves to a canonical case', () => {
  it('creates one at intake_complete when the client has none', async () => {
    const { client, calls } = makeClient({ cases: { data: null, error: null } })
    const r = await resolveCaseForIntakeCompletion(client, 'member-1')

    expect(r.outcome).toBe('created')
    expect(r.caseStatus).toBe('intake_complete')

    const insert = find(calls, 'client_cases', 'insert')[0]
    expect(insert).toBeDefined()
    expect(insert.args[0]).toMatchObject({
      client_id: 'member-1',
      status: 'intake_complete',
    })
  })

  it('resumes an existing open case rather than manufacturing a second', async () => {
    const { client, calls } = makeClient({
      cases: { data: { id: 'case-existing', status: 'active' }, error: null },
    })
    const r = await resolveCaseForIntakeCompletion(client, 'member-1')

    expect(r).toEqual({ caseId: 'case-existing', outcome: 'resumed', caseStatus: 'active' })
    expect(find(calls, 'client_cases', 'insert')).toHaveLength(0)
  })

  it('looks for ANY non-closed case, not only active ones', async () => {
    // The whole duplication risk lives here: an 'active'-only lookup would
    // miss a case sitting at intake_complete and insert a duplicate.
    const { client, calls } = makeClient({ cases: { data: null, error: null } })
    await resolveCaseForIntakeCompletion(client, 'member-1')

    const inCall = find(calls, 'client_cases', 'in')[0]
    expect(inCall).toBeDefined()
    expect(inCall.args[0]).toBe('status')
    expect(inCall.args[1]).toEqual(['draft', 'intake_complete', 'active', 'paused'])
    expect(OPEN_CASE_STATUSES).not.toContain('closed')
  })
})

// ─── 3. correct case status, and no demotion of live care ────────────────────

describe('3. case status follows the lifecycle', () => {
  it('advances a draft case to intake_complete', async () => {
    const { client, calls } = makeClient({
      cases: { data: { id: 'case-draft', status: 'draft' }, error: null },
    })
    const r = await resolveCaseForIntakeCompletion(client, 'member-1')

    expect(r.caseStatus).toBe('intake_complete')
    const update = find(calls, 'client_cases', 'update')[0]
    expect(update.args[0]).toEqual({ status: 'intake_complete' })
  })

  it('does NOT demote an active case back to intake_complete', async () => {
    // Re-submitting an Intake must never misreport a client in live care.
    const { client, calls } = makeClient({
      cases: { data: { id: 'case-active', status: 'active' }, error: null },
    })
    const r = await resolveCaseForIntakeCompletion(client, 'member-1')

    expect(r.caseStatus).toBe('active')
    expect(find(calls, 'client_cases', 'update')).toHaveLength(0)
  })

  it('does not demote a paused case either', async () => {
    const { client, calls } = makeClient({
      cases: { data: { id: 'case-paused', status: 'paused' }, error: null },
    })
    const r = await resolveCaseForIntakeCompletion(client, 'member-1')
    expect(r.caseStatus).toBe('paused')
    expect(find(calls, 'client_cases', 'update')).toHaveLength(0)
  })

  it('never creates a case at active — that is a later transition', () => {
    expect(INTAKE_COMPLETION_CASE_STATUS).toBe('intake_complete')
  })
})

// ─── 2. the Intake response links to it ──────────────────────────────────────

describe('2. the Intake response carries the case id', () => {
  it('writes case_id onto the response row', async () => {
    const { client, calls } = makeClient({
      response: { data: { id: 'resp-1', case_id: null }, error: null },
      cases: { data: null, error: null },
    })
    const r = await linkIntakeCompletionToCase(client, 'member-1')

    expect(r.caseId).toBe('case-new')
    expect(r.alreadyLinked).toBe(false)

    const update = find(calls, 'intake_responses', 'update')[0]
    expect(update.args[0]).toEqual({ case_id: 'case-new' })
  })

  it('claims the link only while case_id is still NULL', async () => {
    const { client, calls } = makeClient({
      response: { data: { id: 'resp-1', case_id: null }, error: null },
      cases: { data: null, error: null },
    })
    await linkIntakeCompletionToCase(client, 'member-1')

    // .is('case_id', null) is what makes two concurrent completions safe.
    const guard = find(calls, 'intake_responses', 'is')
      .find((c) => c.args[0] === 'case_id' && c.args[1] === null)
    expect(guard).toBeDefined()
  })
})

// ─── 4. repeat completion is idempotent ──────────────────────────────────────

describe('4. repeat completion is idempotent', () => {
  it('returns the existing link and touches no case', async () => {
    const { client, calls } = makeClient({
      response: { data: { id: 'resp-1', case_id: 'case-already' }, error: null },
      caseStatus: { data: { status: 'intake_complete' }, error: null },
    })
    const r = await linkIntakeCompletionToCase(client, 'member-1')

    expect(r).toMatchObject({ caseId: 'case-already', alreadyLinked: true })
    expect(find(calls, 'client_cases', 'insert')).toHaveLength(0)
    expect(find(calls, 'intake_responses', 'update')).toHaveLength(0)
  })

  it('a lost concurrent race returns the winner’s case, never a second one', async () => {
    // The conditional update matched zero rows because another request got
    // there first. We re-read and adopt its answer.
    const { client, calls } = makeClient({
      response: { data: { id: 'resp-1', case_id: null }, error: null },
      cases: { data: null, error: null },
      responseUpdate: { data: null, error: null },          // lost the race
      responseReRead: { data: { case_id: 'case-winner' }, error: null },
    })
    const r = await linkIntakeCompletionToCase(client, 'member-1')

    expect(r.caseId).toBe('case-winner')
    expect(find(calls, 'intake_responses', 'update')).toHaveLength(1)
  })

  it('refuses to report success if the link is still unresolved after a lost race', async () => {
    const { client } = makeClient({
      response: { data: { id: 'resp-1', case_id: null }, error: null },
      cases: { data: null, error: null },
      responseUpdate: { data: null, error: null },
      responseReRead: { data: { case_id: null }, error: null },
    })
    await expect(linkIntakeCompletionToCase(client, 'member-1'))
      .rejects.toThrow(/unresolved/)
  })
})

// ─── 5 & 6. identity does not depend on optional features ────────────────────

describe('5 & 6. identity survives every optional feature being off', () => {
  const FLAGS = [
    'AI_INTERPRETATION_ENABLED',
    'INTAKE_ASSIGNMENT_ENABLED',
  ] as const

  it('the spine module reads no feature flag at all', async () => {
    const { readFileSync } = await import('node:fs')
    const { dirname, join } = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const here = dirname(fileURLToPath(import.meta.url))
    const src = readFileSync(join(here, 'intakeCaseSpine.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/^\s*\/\/.*$/gm, ' ')

    expect(src).not.toMatch(/process\.env/)
    for (const flag of FLAGS) expect(src).not.toContain(flag)
  })

  it('resolves a case with every flag unset', async () => {
    const prev = { ...process.env }
    delete process.env.AI_INTERPRETATION_ENABLED
    delete process.env.INTAKE_ASSIGNMENT_ENABLED
    try {
      const { client } = makeClient({ cases: { data: null, error: null } })
      const r = await resolveCaseForIntakeCompletion(client, 'member-1')
      expect(r.outcome).toBe('created')
      expect(r.caseStatus).toBe('intake_complete')
    } finally {
      process.env = prev
    }
  })

  it('also resolves with the flags explicitly false', async () => {
    const prev = { ...process.env }
    process.env.AI_INTERPRETATION_ENABLED = 'false'
    process.env.INTAKE_ASSIGNMENT_ENABLED = 'false'
    try {
      const { client } = makeClient({ cases: { data: null, error: null } })
      const r = await resolveCaseForIntakeCompletion(client, 'member-1')
      expect(r.caseId).toBe('case-new')
    } finally {
      process.env = prev
    }
  })
})

// ─── 7. failure must not report a successful completion ──────────────────────

describe('7. a failure to establish identity is never swallowed', () => {
  it('throws when the case lookup fails', async () => {
    const { client } = makeClient({
      cases: { data: null, error: { message: 'RLS denied', code: '42501' } },
    })
    await expect(resolveCaseForIntakeCompletion(client, 'member-1'))
      .rejects.toMatchObject({ message: 'RLS denied' })
  })

  it('does NOT fall through to an insert when the lookup fails', async () => {
    // Otherwise an unreadable existing case silently becomes a second case.
    const { client, calls } = makeClient({
      cases: { data: null, error: { message: 'timeout' } },
    })
    await expect(resolveCaseForIntakeCompletion(client, 'member-1')).rejects.toBeTruthy()
    expect(find(calls, 'client_cases', 'insert')).toHaveLength(0)
  })

  it('throws when the case insert fails', async () => {
    const { client } = makeClient({
      cases: { data: null, error: null },
      caseInsert: { data: null, error: { message: 'constraint', code: '23514' } },
    })
    await expect(resolveCaseForIntakeCompletion(client, 'member-1'))
      .rejects.toMatchObject({ code: '23514' })
  })

  it('throws when there is no intake_responses row to link', async () => {
    const { client } = makeClient({ response: { data: null, error: null } })
    await expect(linkIntakeCompletionToCase(client, 'member-1'))
      .rejects.toThrow(/no intake_responses row/)
  })

  it('completeIntake does not wrap the spine call in a catch', async () => {
    const { readFileSync } = await import('node:fs')
    const { dirname, join } = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const here = dirname(fileURLToPath(import.meta.url))
    const actions = readFileSync(
      join(here, '../../../../apps/web/app/dashboard/intake/actions.ts'), 'utf8',
    )

    const call = actions.indexOf('linkIntakeCompletionToCase(')
    expect(call).toBeGreaterThan(-1)

    // It must be awaited directly, not attached to a .catch() like the
    // optional generators below it.
    const line = actions.slice(actions.lastIndexOf('\n', call), actions.indexOf('\n', call))
    expect(line).toMatch(/await\s+linkIntakeCompletionToCase/)
    expect(line).not.toMatch(/\.catch\(/)

    // And it must run BEFORE the optional work. Match the CALL SITES, not the
    // imports at the top of the file — those naturally come first.
    const story = actions.indexOf('generateBodyStory(user.id)')
    const assign = actions.indexOf('routeCompletedCaseToPractitioner(user.id)')
    const restriction = actions.indexOf('isProcessingBlocked(createAdminClient()')
    expect(story).toBeGreaterThan(-1)
    expect(assign).toBeGreaterThan(-1)
    expect(call).toBeLessThan(story)
    expect(call).toBeLessThan(assign)

    // It must also precede the AI-restriction early return: a member who has
    // withdrawn AI consent has still completed an Intake and still needs a case.
    expect(restriction).toBeGreaterThan(-1)
    expect(call).toBeLessThan(restriction)
  })
})

// ─── 8. a member cannot be linked to another member's case ───────────────────

describe('8. cross-member linking', () => {
  it('is refused by the database, and the spine never names another member', async () => {
    // The spine only ever resolves cases filtered by the member's own id, so
    // it cannot construct a cross-member link; the 0067 trigger is the
    // enforcement if anything else tries.
    const { client, calls } = makeClient({ cases: { data: null, error: null } })
    await resolveCaseForIntakeCompletion(client, 'member-1')

    const scoped = find(calls, 'client_cases', 'eq')
      .find((c) => c.args[0] === 'client_id')
    expect(scoped?.args[1]).toBe('member-1')

    const insert = find(calls, 'client_cases', 'insert')[0]
    expect((insert.args[0] as { client_id: string }).client_id).toBe('member-1')
  })
})

// ─── Session consistency ─────────────────────────────────────────────────────

describe('intake_sessions is brought into agreement', () => {
  it('marks only in_progress sessions completed, with a timestamp', async () => {
    const { client, calls } = makeClient({})
    const n = await markIntakeSessionCompleted(client, 'member-1')
    expect(n).toBe(1)

    const update = find(calls, 'intake_sessions', 'update')[0]
    const patch = update.args[0] as { status: string; completed_at: string }
    expect(patch.status).toBe('completed')
    expect(Date.parse(patch.completed_at)).not.toBeNaN()

    const guard = find(calls, 'intake_sessions', 'eq')
      .find((c) => c.args[0] === 'status')
    expect(guard?.args[1]).toBe('in_progress')
  })

  it('is idempotent — a second call matches no rows', async () => {
    const { client } = makeClient({ sessionUpdate: { data: [], error: null } })
    expect(await markIntakeSessionCompleted(client, 'member-1')).toBe(0)
  })

  it('throws rather than silently leaving the two tables disagreeing', async () => {
    const { client } = makeClient({ sessionUpdate: { data: null, error: { message: 'nope' } } })
    await expect(markIntakeSessionCompleted(client, 'member-1')).rejects.toBeTruthy()
  })
})

// ─── The helper that is NOT the intake path ──────────────────────────────────

describe('getOrCreateClientCase no longer duplicates', () => {
  it('resumes any open case, so it cannot miss an intake_complete one', async () => {
    const { readFileSync } = await import('node:fs')
    const { dirname, join } = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const here = dirname(fileURLToPath(import.meta.url))
    const src = readFileSync(join(here, 'getOrCreateClientCase.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/^\s*\/\/.*$/gm, ' ')

    expect(src).toContain("in('status', OPEN_CASE_STATUSES")
    expect(src).not.toMatch(/\.eq\('status',\s*'active'\)/)
  })
})
