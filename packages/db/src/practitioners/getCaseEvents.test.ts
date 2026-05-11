import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import { getCaseEvents } from './getCaseEvents'
import { createTestUser, deleteTestUser } from './__test-helpers__/createTestUser'

const HAVE_DB = !!process.env.NEXT_PUBLIC_SUPABASE_URL

function mkAdmin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ─── Unit tests ───────────────────────────────────────────────────────────────

function mockClient(
  result: { data: unknown[] | null; error: { code: string; message: string } | null },
) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve(result),
        }),
      }),
    }),
  } as unknown as ReturnType<typeof createClient<Database>>
}

describe('getCaseEvents — unit', () => {
  it('throws when query errors', async () => {
    const client = mockClient({ data: null, error: { code: '42501', message: 'denied' } })
    await expect(getCaseEvents(client, 'case-1')).rejects.toThrow('getCaseEvents failed')
  })

  it('returns empty array when no events', async () => {
    const client = mockClient({ data: [], error: null })
    expect(await getCaseEvents(client, 'case-1')).toEqual([])
  })

  it('maps a row to CaseEvent shape', async () => {
    const row = {
      id:            'evt-1',
      event_type:    'intake_answer',
      event_payload: { key: 'val' },
      created_at:    '2026-05-01T10:00:00Z',
      source_id:     'src-1',
      source_table:  'intake_answers',
    }
    const client = mockClient({ data: [row], error: null })
    const [result] = await getCaseEvents(client, 'case-1')
    expect(result.id).toBe('evt-1')
    expect(result.eventType).toBe('intake_answer')
    expect(result.eventPayload).toEqual({ key: 'val' })
    expect(result.sourceTable).toBe('intake_answers')
  })

  it('defaults eventPayload to {} when null', async () => {
    const row = {
      id: 'evt-2', event_type: 'lab_upload', event_payload: null,
      created_at: '2026-05-01T11:00:00Z', source_id: null, source_table: null,
    }
    const client = mockClient({ data: [row], error: null })
    const [result] = await getCaseEvents(client, 'case-1')
    expect(result.eventPayload).toEqual({})
  })
})

// ─── Integration tests ────────────────────────────────────────────────────────

describe.skipIf(!HAVE_DB)('getCaseEvents — integration', () => {
  let admin:      ReturnType<typeof mkAdmin>
  let memberUser: Awaited<ReturnType<typeof createTestUser>>
  let caseId:     string
  const eventIds: string[] = []

  beforeAll(async () => {
    admin      = mkAdmin()
    memberUser = await createTestUser(admin, 'b2-gce-member')

    const { data: c } = await admin
      .from('client_cases')
      .insert({ client_id: memberUser.id, primary_concern: 'Fatigue' })
      .select('id')
      .single()
    caseId = c!.id
  })

  afterAll(async () => {
    if (eventIds.length) {
      await admin.from('case_events').delete().in('id', eventIds)
    }
    await admin.from('client_cases').delete().eq('id', caseId)
    await deleteTestUser(admin, memberUser.id)
  })

  it('returns empty array when no events', async () => {
    const result = await getCaseEvents(admin, caseId)
    expect(result).toEqual([])
  })

  it('returns events in ascending order', async () => {
    const now = new Date()
    const earlier = new Date(now.getTime() - 60_000).toISOString()
    const later   = now.toISOString()

    const { data: e1 } = await admin.from('case_events').insert({
      case_id: caseId, event_type: 'intake_answer', event_payload: { step: 1 },
      created_at: earlier,
    }).select('id').single()
    const { data: e2 } = await admin.from('case_events').insert({
      case_id: caseId, event_type: 'lab_upload', event_payload: { step: 2 },
      created_at: later,
    }).select('id').single()

    eventIds.push(e1!.id, e2!.id)

    const result = await getCaseEvents(admin, caseId)
    expect(result.length).toBeGreaterThanOrEqual(2)
    // Verify ascending order: first event came before second
    const first  = result.find(e => e.id === e1!.id)!
    const second = result.find(e => e.id === e2!.id)!
    expect(new Date(first.createdAt).getTime()).toBeLessThan(new Date(second.createdAt).getTime())
  })
})
