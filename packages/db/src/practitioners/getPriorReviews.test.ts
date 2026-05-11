import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import { getPriorReviews } from './getPriorReviews'
import { createTestUser, deleteTestUser } from './__test-helpers__/createTestUser'
import { assignWork } from './assignWork'

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
          eq: () => ({
            neq: () => ({
              order: () => ({
                limit: () => Promise.resolve(result),
              }),
            }),
          }),
        }),
      }),
    }),
  } as unknown as ReturnType<typeof createClient<Database>>
}

describe('getPriorReviews — unit', () => {
  it('throws when query errors', async () => {
    const client = mockClient({ data: null, error: { code: '42501', message: 'denied' } })
    await expect(getPriorReviews(client, 'case-1', 'current-id')).rejects.toThrow('getPriorReviews failed')
  })

  it('returns empty array when no prior reviews', async () => {
    const client = mockClient({ data: [], error: null })
    expect(await getPriorReviews(client, 'case-1', 'current-id')).toEqual([])
  })

  it('maps a row to PriorReview shape', async () => {
    const row = {
      id:           'work-1',
      work_type:    'case_review',
      status:       'completed',
      completed_at: '2026-04-01T12:00:00Z',
      notes:        'Approved — looks good',
      practitioners: { display_name: 'Dr. Alice' },
    }
    const client = mockClient({ data: [row], error: null })
    const [result] = await getPriorReviews(client, 'case-1', 'current-id')
    expect(result.workItemId).toBe('work-1')
    expect(result.workType).toBe('case_review')
    expect(result.status).toBe('completed')
    expect(result.completedAt).toBe('2026-04-01T12:00:00Z')
    expect(result.notes).toBe('Approved — looks good')
    expect(result.practitionerName).toBe('Dr. Alice')
  })

  it('returns null practitionerName when practitioners is null', async () => {
    const row = {
      id: 'work-2', work_type: 'safety_review', status: 'completed',
      completed_at: '2026-04-02T09:00:00Z', notes: null,
      practitioners: null,
    }
    const client = mockClient({ data: [row], error: null })
    const [result] = await getPriorReviews(client, 'case-1', 'current-id')
    expect(result.practitionerName).toBeNull()
  })
})

// ─── Integration tests ────────────────────────────────────────────────────────

describe.skipIf(!HAVE_DB)('getPriorReviews — integration', () => {
  let admin:         ReturnType<typeof mkAdmin>
  let practitioner:  Awaited<ReturnType<typeof createTestUser>>
  let memberUser:    Awaited<ReturnType<typeof createTestUser>>
  let caseId:        string
  const workIds: string[] = []

  beforeAll(async () => {
    admin        = mkAdmin()
    practitioner = await createTestUser(admin, 'b2-gpr-pract')
    memberUser   = await createTestUser(admin, 'b2-gpr-member')

    await admin.from('practitioners').insert({
      id:           practitioner.id,
      display_name: 'Test Practitioner GPR',
      status:       'active',
    })

    const { data: c } = await admin
      .from('client_cases')
      .insert({ client_id: memberUser.id, primary_concern: 'Sleep issues' })
      .select('id')
      .single()
    caseId = c!.id
  })

  afterAll(async () => {
    if (workIds.length) {
      await admin.from('case_practitioner_work').delete().in('id', workIds)
    }
    await admin.from('client_cases').delete().eq('id', caseId)
    await admin.from('practitioners').delete().eq('id', practitioner.id)
    for (const u of [practitioner, memberUser]) {
      await deleteTestUser(admin, u.id)
    }
  })

  it('returns empty array when no prior completed reviews', async () => {
    const result = await getPriorReviews(admin, caseId, 'non-existent-id')
    expect(result).toEqual([])
  })

  it('returns completed reviews excluding the current work item', async () => {
    const wId1 = await assignWork(admin, {
      caseId, practitionerId: practitioner.id,
      workType: 'case_review', assignedBy: practitioner.id,
    })
    const wId2 = await assignWork(admin, {
      caseId, practitionerId: practitioner.id,
      workType: 'safety_review', assignedBy: practitioner.id,
    })
    workIds.push(wId1, wId2)

    // Complete both
    await admin.from('case_practitioner_work')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', wId1)
    await admin.from('case_practitioner_work')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', wId2)

    // getPriorReviews with wId2 as current — should only return wId1
    const result = await getPriorReviews(admin, caseId, wId2)
    expect(result.some(r => r.workItemId === wId1)).toBe(true)
    expect(result.some(r => r.workItemId === wId2)).toBe(false)
  })

  it('does not return non-completed work items', async () => {
    const wId = await assignWork(admin, {
      caseId, practitionerId: practitioner.id,
      workType: 'follow_up_review', assignedBy: practitioner.id,
    })
    workIds.push(wId)
    // Leave as assigned — should NOT appear in prior reviews
    const result = await getPriorReviews(admin, caseId, 'some-other-id')
    expect(result.some(r => r.workItemId === wId)).toBe(false)
  })
})
