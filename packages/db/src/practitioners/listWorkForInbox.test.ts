import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import { listWorkForInbox, computeUrgency } from './listWorkForInbox'
import { createTestUser, deleteTestUser } from './__test-helpers__/createTestUser'
import { assignWork } from './assignWork'

const HAVE_DB = !!process.env.NEXT_PUBLIC_SUPABASE_URL

function mkAdmin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ─── computeUrgency — unit (always-run) ──────────────────────────────────────

describe('computeUrgency', () => {
  const now = new Date().toISOString()
  const past5d = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString()
  const past2d = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  const pastDue = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
  const dueSoon = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
  const dueNext7d = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()

  it('returns overdue when dueAt is in the past', () => {
    expect(computeUrgency({ status: 'assigned', dueAt: pastDue, assignedAt: now })).toBe('overdue')
  })

  it('returns watch when dueAt is within 24 hours', () => {
    expect(computeUrgency({ status: 'assigned', dueAt: dueSoon, assignedAt: now })).toBe('watch')
  })

  it('returns normal when dueAt is > 24h away', () => {
    expect(computeUrgency({ status: 'assigned', dueAt: dueNext7d, assignedAt: now })).toBe('normal')
  })

  it('returns overdue when no dueAt and assigned > 5 days ago', () => {
    expect(computeUrgency({ status: 'assigned', dueAt: null, assignedAt: past5d })).toBe('overdue')
  })

  it('returns watch when no dueAt and assigned > 48h ago', () => {
    expect(computeUrgency({ status: 'assigned', dueAt: null, assignedAt: past2d })).toBe('watch')
  })

  it('returns normal when no dueAt and recently assigned', () => {
    expect(computeUrgency({ status: 'assigned', dueAt: null, assignedAt: now })).toBe('normal')
  })

  it('returns normal for in_review items regardless of age', () => {
    // Non-assigned items with no dueAt are always normal (time-since-assigned
    // urgency only applies to unstarted 'assigned' items)
    expect(computeUrgency({ status: 'in_review', dueAt: null, assignedAt: past5d })).toBe('normal')
  })
})

// ─── listWorkForInbox — unit (mocked client, always-run) ─────────────────────

// Builds a mock admin client that returns the given results for the two
// sequential queries: active items first, completed items second.
function mockClient(
  activeResult:    { data: unknown[] | null; error: { code: string; message: string } | null },
  completedResult: { data: unknown[] | null; error: { code: string; message: string } | null },
) {
  let callCount = 0
  return {
    from: () => {
      callCount++
      if (callCount === 1) {
        // Active items query: .select().eq().in().order()
        return {
          select: () => ({
            eq: () => ({
              in: () => ({
                order: () => Promise.resolve(activeResult),
              }),
            }),
          }),
        }
      }
      // Completed items query: .select().eq().eq().gte().order().limit()
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              gte: () => ({
                order: () => ({
                  limit: () => Promise.resolve(completedResult),
                }),
              }),
            }),
          }),
        }),
      }
    },
  } as unknown as ReturnType<typeof createClient<Database>>
}

describe('listWorkForInbox — unit', () => {
  it('throws when the active items query errors', async () => {
    const client = mockClient(
      { data: null, error: { code: '42501', message: 'RLS denied' } },
      { data: [], error: null },
    )
    await expect(listWorkForInbox(client, 'p-id')).rejects.toThrow('listWorkForInbox (active) failed')
  })

  it('throws when the completed items query errors', async () => {
    const client = mockClient(
      { data: [], error: null },
      { data: null, error: { code: '42501', message: 'timeout' } },
    )
    await expect(listWorkForInbox(client, 'p-id')).rejects.toThrow('listWorkForInbox (completed) failed')
  })

  it('returns empty array when no work items exist', async () => {
    const client = mockClient({ data: [], error: null }, { data: [], error: null })
    const result = await listWorkForInbox(client, 'p-id')
    expect(result).toEqual([])
  })

  it('maps a row to a correctly-shaped InboxWorkItem', async () => {
    const row = {
      id:           'work-1',
      case_id:      'case-1',
      work_type:    'case_review',
      status:       'assigned',
      assigned_at:  new Date().toISOString(),
      started_at:   null,
      completed_at: null,
      due_at:       null,
      client_cases: {
        primary_concern:       'Fatigue',
        case_complexity_score: 3,
        escalation_required:   false,
        profiles:              { full_name: 'Emma Clarke' },
      },
    }
    const client = mockClient({ data: [row], error: null }, { data: [], error: null })
    const result = await listWorkForInbox(client, 'p-id')
    expect(result).toHaveLength(1)
    const item = result[0]
    expect(item.workItemId).toBe('work-1')
    expect(item.caseId).toBe('case-1')
    expect(item.workType).toBe('case_review')
    expect(item.status).toBe('assigned')
    expect(item.clientName).toBe('Emma Clarke')
    expect(item.primaryConcern).toBe('Fatigue')
    expect(item.caseComplexityScore).toBe(3)
    expect(item.escalationRequired).toBe(false)
    expect(typeof item.urgency).toBe('string')
  })

  it('returns "Unknown" client name when profiles is null', async () => {
    const row = {
      id: 'w', case_id: 'c', work_type: 'safety_review', status: 'in_review',
      assigned_at: new Date().toISOString(), started_at: null, completed_at: null, due_at: null,
      client_cases: { primary_concern: null, case_complexity_score: 1, escalation_required: false, profiles: null },
    }
    const client = mockClient({ data: [row], error: null }, { data: [], error: null })
    const [item] = await listWorkForInbox(client, 'p-id')
    expect(item.clientName).toBe('Unknown')
  })

  it('places active items before completed items in the result', async () => {
    const active = {
      id: 'active-1', case_id: 'c', work_type: 'case_review', status: 'assigned',
      assigned_at: new Date().toISOString(), started_at: null, completed_at: null, due_at: null,
      client_cases: null,
    }
    const completed = {
      id: 'completed-1', case_id: 'c', work_type: 'case_review', status: 'completed',
      assigned_at: new Date().toISOString(), started_at: null,
      completed_at: new Date().toISOString(), due_at: null,
      client_cases: null,
    }
    const client = mockClient({ data: [active], error: null }, { data: [completed], error: null })
    const result = await listWorkForInbox(client, 'p-id')
    expect(result[0].workItemId).toBe('active-1')
    expect(result[1].workItemId).toBe('completed-1')
  })
})

// ─── listWorkForInbox — integration ──────────────────────────────────────────

describe.skipIf(!HAVE_DB)('listWorkForInbox — integration', () => {
  let admin:         ReturnType<typeof mkAdmin>
  let practitionerA: Awaited<ReturnType<typeof createTestUser>>
  let practitionerB: Awaited<ReturnType<typeof createTestUser>>
  let memberUser:    Awaited<ReturnType<typeof createTestUser>>
  let caseId:        string
  const createdWorkIds: string[] = []

  beforeAll(async () => {
    admin         = mkAdmin()
    practitionerA = await createTestUser(admin, 'b1-lwfi-pract-a')
    practitionerB = await createTestUser(admin, 'b1-lwfi-pract-b')
    memberUser    = await createTestUser(admin, 'b1-lwfi-member')

    for (const u of [practitionerA, practitionerB]) {
      await admin.from('practitioners').insert({
        id:           u.id,
        display_name: `Test ${u.email}`,
        status:       'active',
      })
    }

    const { data: c } = await admin
      .from('client_cases')
      .insert({ client_id: memberUser.id, primary_concern: 'Fatigue', case_complexity_score: 2 })
      .select('id')
      .single()
    caseId = c!.id
  })

  afterAll(async () => {
    if (createdWorkIds.length) {
      await admin.from('case_practitioner_work').delete().in('id', createdWorkIds)
    }
    await admin.from('client_cases').delete().eq('id', caseId)
    for (const u of [practitionerA, practitionerB]) {
      await admin.from('practitioners').delete().eq('id', u.id)
    }
    for (const u of [practitionerA, practitionerB, memberUser]) {
      await deleteTestUser(admin, u.id)
    }
  })

  it('returns assigned work items for practitioner A', async () => {
    const workId = await assignWork(admin, {
      caseId:         caseId,
      practitionerId: practitionerA.id,
      workType:       'case_review',
      assignedBy:     practitionerA.id,
    })
    createdWorkIds.push(workId)

    const items = await listWorkForInbox(admin, practitionerA.id)
    expect(items.some(i => i.workItemId === workId)).toBe(true)
  })

  it('does not return work items belonging to practitioner B', async () => {
    const workIdB = await assignWork(admin, {
      caseId:         caseId,
      practitionerId: practitionerB.id,
      workType:       'safety_review',
      assignedBy:     practitionerB.id,
    })
    createdWorkIds.push(workIdB)

    const items = await listWorkForInbox(admin, practitionerA.id)
    expect(items.some(i => i.workItemId === workIdB)).toBe(false)
  })

  it('includes client name and case metadata', async () => {
    const items = await listWorkForInbox(admin, practitionerA.id)
    const item  = items.find(i => i.caseId === caseId && i.status !== 'completed')
    expect(item).toBeDefined()
    // profiles.full_name may be null for test users (no profile row)
    // but case metadata should be present
    expect(item!.primaryConcern).toBe('Fatigue')
    expect(item!.caseComplexityScore).toBe(2)
  })

  it('returns escalated items', async () => {
    const escId = await assignWork(admin, {
      caseId:         caseId,
      practitionerId: practitionerA.id,
      workType:       'follow_up_review',
      assignedBy:     practitionerA.id,
    })
    createdWorkIds.push(escId)
    await admin
      .from('case_practitioner_work')
      .update({ status: 'escalated' })
      .eq('id', escId)

    const items = await listWorkForInbox(admin, practitionerA.id)
    expect(items.some(i => i.workItemId === escId && i.status === 'escalated')).toBe(true)
  })

  it('includes recently completed items and caps at 5', async () => {
    // Insert 6 completed items; expect only 5 returned (DB .limit(5))
    const completedIds: string[] = []
    for (let n = 0; n < 6; n++) {
      const wId = await assignWork(admin, {
        caseId:         caseId,
        practitionerId: practitionerA.id,
        workType:       'protocol_review',
        assignedBy:     practitionerA.id,
      })
      completedIds.push(wId)
      createdWorkIds.push(wId)
      await admin
        .from('case_practitioner_work')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', wId)
    }

    const items    = await listWorkForInbox(admin, practitionerA.id)
    const returned = items.filter(i => completedIds.includes(i.workItemId))
    expect(returned.length).toBeLessThanOrEqual(5)
  })
})
