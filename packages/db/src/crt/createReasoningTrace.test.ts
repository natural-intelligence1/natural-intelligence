import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import { createReasoningTrace } from './createReasoningTrace'
import { getOrCreateClientCase } from './getOrCreateClientCase'
import { createTestUser, deleteTestUser } from '../practitioners/__test-helpers__/createTestUser'
import type { TraceEntry } from './types'

const HAVE_DB = !!process.env.NEXT_PUBLIC_SUPABASE_URL

function mkAdmin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const SAMPLE_ENTRY: TraceEntry = {
  agent_name: 'root_cause',
  entry_type: 'observation',
  content:    'Test observation',
  visibility: 'practitioner',
}

// ─── Unit tests ───────────────────────────────────────────────────────────────

// Helper — a builder that satisfies the .update().eq().eq().eq() chain used
// to demote any previously-client_visible trace before insert. Returns a
// no-op success by default.
function demoteOk() {
  const chain: { eq: () => typeof chain; then: (r: (v: { error: null }) => unknown) => unknown } = {
    eq: () => chain,
    then: (r) => r({ error: null }),
  }
  return { update: () => chain }
}

describe('createReasoningTrace — unit', () => {
  it('throws when the trace insert errors', async () => {
    let callCount = 0
    const fakeClient = {
      from: () => {
        callCount++
        if (callCount === 1) return demoteOk()
        return {
          insert: () => ({
            select: () => ({
              single: async () => ({ data: null, error: { message: 'FK violation', code: '23503' } }),
            }),
          }),
        }
      },
    } as unknown as ReturnType<typeof createClient<Database>>

    await expect(
      createReasoningTrace(fakeClient, {
        caseId:      'bad-case-id',
        traceType:   'intake_analysis',
        generatedBy: 'ai',
        entries:     [],
      })
    ).rejects.toMatchObject({ code: '23503' })
  })

  it('skips the entries insert when entries array is empty', async () => {
    let entriesInsertCalled = false
    let callCount = 0
    const fakeClient = {
      from: () => {
        callCount++
        if (callCount === 1) return demoteOk()
        if (callCount === 2) {
          return {
            insert: () => ({
              select: () => ({
                single: async () => ({ data: { id: 'trace-uuid' }, error: null }),
              }),
            }),
          }
        }
        entriesInsertCalled = true
        return { insert: () => ({ then: async () => ({ error: null }) }) }
      },
    } as unknown as ReturnType<typeof createClient<Database>>

    const result = await createReasoningTrace(fakeClient, {
      caseId:      'case-uuid',
      traceType:   'intake_analysis',
      generatedBy: 'ai',
      entries:     [],
    })
    expect(result).toBe('trace-uuid')
    expect(entriesInsertCalled).toBe(false)
  })

  it('throws when the entries bulk insert errors', async () => {
    let callCount = 0
    const fakeClient = {
      from: () => {
        callCount++
        if (callCount === 1) return demoteOk()
        if (callCount === 2) {
          return {
            insert: () => ({
              select: () => ({
                single: async () => ({ data: { id: 'trace-uuid' }, error: null }),
              }),
            }),
          }
        }
        return {
          insert: async () => ({ error: { message: 'entries failed', code: '23502' } }),
        }
      },
    } as unknown as ReturnType<typeof createClient<Database>>

    await expect(
      createReasoningTrace(fakeClient, {
        caseId:      'case-uuid',
        traceType:   'intake_analysis',
        generatedBy: 'ai',
        entries:     [SAMPLE_ENTRY],
      })
    ).rejects.toMatchObject({ message: 'entries failed' })
  })
})

// ─── Integration tests ────────────────────────────────────────────────────────

describe.skipIf(!HAVE_DB)('createReasoningTrace — integration', () => {
  let admin: ReturnType<typeof mkAdmin>
  let member: Awaited<ReturnType<typeof createTestUser>>
  let caseId: string

  beforeAll(async () => {
    admin = mkAdmin()
    member = await createTestUser(admin, 'crt-crt')
    caseId = await getOrCreateClientCase(admin, member.id)
  })

  afterAll(async () => {
    await admin.from('reasoning_trace_entries').delete().eq('case_id', caseId)
    await admin.from('reasoning_traces').delete().eq('case_id', caseId)
    await admin.from('client_cases').delete().eq('client_id', member.id)
    await deleteTestUser(admin, member.id)
  })

  it('creates a trace and returns a uuid', async () => {
    const traceId = await createReasoningTrace(admin, {
      caseId,
      traceType:   'intake_analysis',
      generatedBy: 'ai',
      summary:     'Test trace summary',
      entries:     [SAMPLE_ENTRY],
    })
    expect(typeof traceId).toBe('string')
    expect(traceId).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('writes trace entries with correct fields', async () => {
    const entry: TraceEntry = {
      agent_name:     'protocol_builder',
      entry_type:     'client_explanation',
      content:        'Your body story text',
      system_area:    'body_story',
      visibility:     'client',
      confidence:     0.85,
    }

    const traceId = await createReasoningTrace(admin, {
      caseId,
      traceType:   'food_analysis',   // distinct from beforeAll's intake_analysis — avoids M2 unique constraint
      generatedBy: 'ai',
      entries:     [entry],
    })

    const { data } = await admin
      .from('reasoning_trace_entries')
      .select('agent_name, entry_type, content, system_area, visibility, confidence')
      .eq('trace_id', traceId)

    expect(data).toHaveLength(1)
    expect(data![0].agent_name).toBe('protocol_builder')
    expect(data![0].entry_type).toBe('client_explanation')
    expect(data![0].system_area).toBe('body_story')
    expect(data![0].visibility).toBe('client')
    expect(Number(data![0].confidence)).toBeCloseTo(0.85)
  })

  it('creates a trace with no entries when entries array is empty', async () => {
    const traceId = await createReasoningTrace(admin, {
      caseId,
      traceType:   'weekly_review',
      generatedBy: 'practitioner',
      entries:     [],
    })

    const { data } = await admin
      .from('reasoning_trace_entries')
      .select('id')
      .eq('trace_id', traceId)

    expect(data).toHaveLength(0)
  })

  it('sets status to client_visible', async () => {
    const traceId = await createReasoningTrace(admin, {
      caseId,
      traceType:   'lab_analysis',   // distinct from intake_analysis, food_analysis, weekly_review — avoids M2
      generatedBy: 'ai',
      entries:     [],
    })

    const { data } = await admin
      .from('reasoning_traces')
      .select('status')
      .eq('id', traceId)
      .single()

    expect(data?.status).toBe('client_visible')
  })
})
