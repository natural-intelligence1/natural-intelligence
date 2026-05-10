import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import { startWorkItem } from './startWorkItem'
import { assignWork } from './assignWork'
import { createTestUser, deleteTestUser } from './__test-helpers__/createTestUser'
import { signInAs } from './__test-helpers__/signInAs'

const HAVE_DB = !!process.env.NEXT_PUBLIC_SUPABASE_URL

function mkAdmin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ─── Unit tests (always-run, mocked client) ───────────────────────────────────

// Builds a minimal mock that records the update call and returns the given result.
function mockClient(result: { error: { code: string; message: string } | null }) {
  const calls: { update: unknown; filters: string[] }[] = []
  const builder = {
    _filters: [] as string[],
    update(data: unknown) {
      calls.push({ update: data, filters: [] })
      return this
    },
    eq(field: string, _value: unknown) {
      calls.at(-1)!.filters.push(field)
      return this
    },
    then(resolve: (v: unknown) => void) {
      resolve(result)
    },
  }
  const client = {
    from: () => builder,
    _calls: calls,
  } as unknown as ReturnType<typeof createClient<Database>> & { _calls: typeof calls }
  return { client, calls }
}

describe('startWorkItem — unit', () => {
  it('calls update with status in_review and a started_at timestamp', async () => {
    const { client, calls } = mockClient({ error: null })
    await startWorkItem(client, 'work-uuid-1')
    expect(calls).toHaveLength(1)
    const upd = calls[0].update as Record<string, unknown>
    expect(upd.status).toBe('in_review')
    expect(typeof upd.started_at).toBe('string')
  })

  it('filters on both id and status = assigned (idempotency guard)', async () => {
    const { client, calls } = mockClient({ error: null })
    await startWorkItem(client, 'work-uuid-2')
    expect(calls[0].filters).toContain('id')
    expect(calls[0].filters).toContain('status')
  })

  it('throws when the update returns an error', async () => {
    const { client } = mockClient({ error: { code: '42501', message: 'permission denied' } })
    await expect(startWorkItem(client, 'work-uuid-3')).rejects.toThrow('startWorkItem failed')
  })
})

// ─── Integration tests ────────────────────────────────────────────────────────

describe.skipIf(!HAVE_DB)('startWorkItem — integration', () => {
  let admin:        ReturnType<typeof mkAdmin>
  let practitioner: Awaited<ReturnType<typeof createTestUser>>
  let practitionerB:Awaited<ReturnType<typeof createTestUser>>
  let memberUser:   Awaited<ReturnType<typeof createTestUser>>
  let caseId:       string
  const createdWorkIds: string[] = []

  beforeAll(async () => {
    admin         = mkAdmin()
    practitioner  = await createTestUser(admin, 'b1-swi-pract')
    practitionerB = await createTestUser(admin, 'b1-swi-pract-b')
    memberUser    = await createTestUser(admin, 'b1-swi-member')

    for (const u of [practitioner, practitionerB]) {
      await admin.from('practitioners').insert({
        id: u.id, display_name: `Test ${u.email}`, status: 'active',
      })
    }

    const { data: c } = await admin
      .from('client_cases')
      .insert({ client_id: memberUser.id })
      .select('id')
      .single()
    caseId = c!.id
  })

  afterAll(async () => {
    if (createdWorkIds.length) {
      await admin.from('case_practitioner_work').delete().in('id', createdWorkIds)
    }
    await admin.from('client_cases').delete().eq('id', caseId)
    for (const u of [practitioner, practitionerB]) {
      await admin.from('practitioners').delete().eq('id', u.id)
    }
    for (const u of [practitioner, practitionerB, memberUser]) {
      await deleteTestUser(admin, u.id)
    }
  })

  it('transitions status from assigned to in_review and sets started_at', async () => {
    const workId = await assignWork(admin, {
      caseId, practitionerId: practitioner.id,
      workType: 'case_review', assignedBy: practitioner.id,
    })
    createdWorkIds.push(workId)

    const authClient = await signInAs(practitioner)
    await startWorkItem(authClient, workId)

    const { data } = await admin
      .from('case_practitioner_work')
      .select('status, started_at')
      .eq('id', workId)
      .single()
    expect(data?.status).toBe('in_review')
    expect(data?.started_at).not.toBeNull()
  })

  it('is idempotent — calling a second time does not throw and does not re-stamp started_at', async () => {
    const workId = await assignWork(admin, {
      caseId, practitionerId: practitioner.id,
      workType: 'safety_review', assignedBy: practitioner.id,
    })
    createdWorkIds.push(workId)

    const authClient = await signInAs(practitioner)
    await startWorkItem(authClient, workId)

    const { data: first } = await admin
      .from('case_practitioner_work')
      .select('started_at')
      .eq('id', workId)
      .single()

    // Second call — no-op because status is now 'in_review', not 'assigned'
    await expect(startWorkItem(authClient, workId)).resolves.toBeUndefined()

    const { data: second } = await admin
      .from('case_practitioner_work')
      .select('started_at')
      .eq('id', workId)
      .single()
    // started_at should not change on the second call
    expect(second?.started_at).toBe(first?.started_at)
  })

  it('practitioner B cannot start practitioner A work item (RLS no-op)', async () => {
    const workId = await assignWork(admin, {
      caseId, practitionerId: practitioner.id,
      workType: 'protocol_review', assignedBy: practitioner.id,
    })
    createdWorkIds.push(workId)

    const authClientB = await signInAs(practitionerB)
    // Does not throw — RLS silently matches 0 rows
    await expect(startWorkItem(authClientB, workId)).resolves.toBeUndefined()

    // Confirm the work item was not changed
    const { data } = await admin
      .from('case_practitioner_work')
      .select('status')
      .eq('id', workId)
      .single()
    expect(data?.status).toBe('assigned')
  })
})
