import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import { assignWork } from './assignWork'
import { createTestUser, deleteTestUser } from './__test-helpers__/createTestUser'

const HAVE_DB = !!process.env.NEXT_PUBLIC_SUPABASE_URL

function mkAdmin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// TypeScript compile-time check (always runs — no DB)
describe('assignWork — type safety', () => {
  it('TypeScript prevents invalid work_type at compile time', () => {
    // @ts-expect-error — 'invalid_type' is not assignable to WorkType
    const _: Parameters<typeof assignWork>[1] = { workType: 'invalid_type' }
    void _
  })
})

describe.skipIf(!HAVE_DB)('assignWork — integration', () => {
  let admin: ReturnType<typeof mkAdmin>
  let practitioner: Awaited<ReturnType<typeof createTestUser>>
  let memberUser:   Awaited<ReturnType<typeof createTestUser>>
  let caseId:       string
  const createdWorkIds: string[] = []

  beforeAll(async () => {
    admin        = mkAdmin()
    practitioner = await createTestUser(admin, 'g13b-aw-pract')
    memberUser   = await createTestUser(admin, 'g13b-aw-member')

    await admin.from('practitioners').insert({ id: practitioner.id, display_name: `Test ${practitioner.email}`, status: 'active' })
    const { data: c } = await admin.from('client_cases').insert({ client_id: memberUser.id }).select('id').single()
    caseId = c!.id
  })

  afterAll(async () => {
    if (createdWorkIds.length) {
      await admin.from('case_practitioner_work').delete().in('id', createdWorkIds)
    }
    await admin.from('client_cases').delete().eq('id', caseId)
    await admin.from('practitioners').delete().eq('id', practitioner.id)
    await deleteTestUser(admin, practitioner.id)
    await deleteTestUser(admin, memberUser.id)
  })

  it('creates a work item and returns its id', async () => {
    const id = await assignWork(admin, {
      caseId:          caseId,
      practitionerId:  practitioner.id,
      workType:        'case_review',
      assignedBy:      practitioner.id,
    })
    createdWorkIds.push(id)
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('partial unique index blocks duplicate active work (same practitioner + work_type)', async () => {
    const id1 = await assignWork(admin, {
      caseId:         caseId,
      practitionerId: practitioner.id,
      workType:       'protocol_review',
      assignedBy:     practitioner.id,
    })
    createdWorkIds.push(id1)

    await expect(
      assignWork(admin, {
        caseId:         caseId,
        practitionerId: practitioner.id,
        workType:       'protocol_review',
        assignedBy:     practitioner.id,
      })
    ).rejects.toThrow()
  })
})
