import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import { listAssignedWork } from './listAssignedWork'
import { createTestUser, deleteTestUser } from './__test-helpers__/createTestUser'
import { signInAs } from './__test-helpers__/signInAs'

const HAVE_DB = !!process.env.NEXT_PUBLIC_SUPABASE_URL

function mkAdmin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

describe.skipIf(!HAVE_DB)('listAssignedWork — RLS', () => {
  let admin: ReturnType<typeof mkAdmin>
  let practitionerA: Awaited<ReturnType<typeof createTestUser>>
  let practitionerB: Awaited<ReturnType<typeof createTestUser>>
  let memberUser:    Awaited<ReturnType<typeof createTestUser>>
  let caseId:        string
  let workIdA:       string
  let workIdB:       string

  beforeAll(async () => {
    admin         = mkAdmin()
    practitionerA = await createTestUser(admin, 'g13b-law-pract-a')
    practitionerB = await createTestUser(admin, 'g13b-law-pract-b')
    memberUser    = await createTestUser(admin, 'g13b-law-member')

    for (const u of [practitionerA, practitionerB]) {
      await admin.from('practitioners').insert({ id: u.id, display_name: `Test ${u.email}`, status: 'active' })
    }

    const { data: c } = await admin.from('client_cases').insert({ client_id: memberUser.id }).select('id').single()
    caseId = c!.id

    const { data: wA } = await admin.from('case_practitioner_work').insert({
      case_id: caseId, practitioner_id: practitionerA.id,
      work_type: 'case_review', assigned_by: practitionerA.id,
    }).select('id').single()
    workIdA = wA!.id

    const { data: wB } = await admin.from('case_practitioner_work').insert({
      case_id: caseId, practitioner_id: practitionerB.id,
      work_type: 'safety_review', assigned_by: practitionerB.id, status: 'completed',
    }).select('id').single()
    workIdB = wB!.id
  })

  afterAll(async () => {
    await admin.from('case_practitioner_work').delete().in('id', [workIdA, workIdB])
    await admin.from('client_cases').delete().eq('id', caseId)
    await admin.from('practitioners').delete().in('id', [practitionerA.id, practitionerB.id])
    for (const u of [practitionerA, practitionerB, memberUser]) await deleteTestUser(admin, u.id)
  })

  it('returns all work for practitionerA', async () => {
    const result = await listAssignedWork(admin, practitionerA.id)
    expect(result.some((w) => w.id === workIdA)).toBe(true)
  })

  it('filters by status', async () => {
    const active = await listAssignedWork(admin, practitionerA.id, 'assigned')
    expect(active.every((w) => w.status === 'assigned')).toBe(true)

    const completed = await listAssignedWork(admin, practitionerB.id, 'completed')
    expect(completed.some((w) => w.id === workIdB)).toBe(true)
  })

  it('practitioner sees only own work via RLS', async () => {
    const client = await signInAs(practitionerA)
    const { data } = await client.from('case_practitioner_work').select('id').eq('case_id', caseId)
    const ids = (data ?? []).map((r) => r.id)
    expect(ids).toContain(workIdA)
    expect(ids).not.toContain(workIdB)
  })

  it('practitionerB sees only own work via RLS', async () => {
    const client = await signInAs(practitionerB)
    const { data } = await client.from('case_practitioner_work').select('id').eq('case_id', caseId)
    const ids = (data ?? []).map((r) => r.id)
    expect(ids).toContain(workIdB)
    expect(ids).not.toContain(workIdA)
  })
})
