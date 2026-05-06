import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import { listAssignedCases } from './listAssignedCases'
import { createTestUser, deleteTestUser } from './__test-helpers__/createTestUser'
import { signInAs } from './__test-helpers__/signInAs'

const HAVE_DB = !!process.env.NEXT_PUBLIC_SUPABASE_URL

function mkAdmin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

describe.skipIf(!HAVE_DB)('listAssignedCases — RLS', () => {
  let admin: ReturnType<typeof mkAdmin>
  let practitionerA: Awaited<ReturnType<typeof createTestUser>>
  let practitionerB: Awaited<ReturnType<typeof createTestUser>>
  let memberUser:    Awaited<ReturnType<typeof createTestUser>>
  let caseId:        string
  let workIdActive:  string
  let workIdDone:    string

  beforeAll(async () => {
    admin         = mkAdmin()
    practitionerA = await createTestUser(admin, 'g13b-lac-pract-a')
    practitionerB = await createTestUser(admin, 'g13b-lac-pract-b')
    memberUser    = await createTestUser(admin, 'g13b-lac-member')

    for (const u of [practitionerA, practitionerB]) {
      await admin.from('practitioners').insert({ id: u.id, display_name: `Test ${u.email}`, status: 'active' })
    }

    const { data: c } = await admin.from('client_cases').insert({ client_id: memberUser.id }).select('id').single()
    caseId = c!.id

    const { data: wActive } = await admin.from('case_practitioner_work').insert({
      case_id: caseId, practitioner_id: practitionerA.id,
      work_type: 'case_review', assigned_by: practitionerA.id, status: 'in_review',
    }).select('id').single()
    workIdActive = wActive!.id

    const { data: wDone } = await admin.from('case_practitioner_work').insert({
      case_id: caseId, practitioner_id: practitionerA.id,
      work_type: 'safety_review', assigned_by: practitionerA.id, status: 'completed',
    }).select('id').single()
    workIdDone = wDone!.id
  })

  afterAll(async () => {
    await admin.from('case_practitioner_work').delete().in('id', [workIdActive, workIdDone])
    await admin.from('client_cases').delete().eq('id', caseId)
    await admin.from('practitioners').delete().in('id', [practitionerA.id, practitionerB.id])
    for (const u of [practitionerA, practitionerB, memberUser]) await deleteTestUser(admin, u.id)
  })

  it('returns cases with active work (assigned/in_review)', async () => {
    const cases = await listAssignedCases(admin, practitionerA.id)
    expect(cases.some((c) => c.id === caseId)).toBe(true)
  })

  it('practitioner with active work (in_review) can read case via RLS', async () => {
    const client = await signInAs(practitionerA)
    const { data } = await client.from('client_cases').select('id').eq('id', caseId)
    expect((data ?? []).some((r) => r.id === caseId)).toBe(true)
  })

  it('practitioner without active work cannot read case via RLS', async () => {
    const client = await signInAs(practitionerB)
    const { data } = await client.from('client_cases').select('id').eq('id', caseId)
    expect(data ?? []).toHaveLength(0)
  })

  it('practitioner cannot read case after work transitions to completed', async () => {
    await admin.from('case_practitioner_work').update({ status: 'completed' }).eq('id', workIdActive)

    const client = await signInAs(practitionerA)
    const { data } = await client.from('client_cases').select('id').eq('id', caseId)
    expect(data ?? []).toHaveLength(0)

    // Restore for cleanup consistency
    await admin.from('case_practitioner_work').update({ status: 'in_review' }).eq('id', workIdActive)
  })
})
