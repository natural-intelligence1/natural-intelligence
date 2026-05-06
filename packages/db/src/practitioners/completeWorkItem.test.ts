import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import { completeWorkItem } from './completeWorkItem'
import type { CompleteWorkItemInput, WorkDecision } from './types'
import { createTestUser, deleteTestUser } from './__test-helpers__/createTestUser'
import { signInAs } from './__test-helpers__/signInAs'

const HAVE_DB = !!process.env.NEXT_PUBLIC_SUPABASE_URL

function mkAdmin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ─── TypeScript compile-time checks (always run) ──────────────────────────────

describe('completeWorkItem — type safety', () => {
  it('WorkDecision union excludes invalid values at compile time', () => {
    const validDecision: WorkDecision = 'approved'
    expect(['approved', 'needs_revision', 'escalated']).toContain(validDecision)

    // @ts-expect-error — 'rejected' is not a valid WorkDecision
    const _invalid: WorkDecision = 'rejected'
    void _invalid
  })

  it('CompleteWorkItemInput requires decision to be WorkDecision', () => {
    const valid: CompleteWorkItemInput = {
      workId:         'some-uuid',
      decision:       'needs_revision',
      notes:          'Some notes',
      recommendation: 'Some recommendation',
    }
    expect(valid.decision).toBe('needs_revision')
  })
})

// ─── Integration: RPC validation and atomicity ────────────────────────────────

describe.skipIf(!HAVE_DB)('completeWorkItem — RPC integration', () => {
  let admin: ReturnType<typeof mkAdmin>
  let practitioner: Awaited<ReturnType<typeof createTestUser>>
  let memberUser:   Awaited<ReturnType<typeof createTestUser>>
  let caseId:       string
  let workId:       string

  beforeAll(async () => {
    admin        = mkAdmin()
    practitioner = await createTestUser(admin, 'g13b-cwi-pract')
    memberUser   = await createTestUser(admin, 'g13b-cwi-member')

    await admin.from('practitioners').insert({ id: practitioner.id, display_name: `Test ${practitioner.email}`, status: 'active' })

    const { data: c } = await admin.from('client_cases').insert({ client_id: memberUser.id }).select('id').single()
    caseId = c!.id

    const { data: w } = await admin.from('case_practitioner_work').insert({
      case_id:         caseId,
      practitioner_id: practitioner.id,
      work_type:       'case_review',
      assigned_by:     practitioner.id,
      status:          'in_review',
    }).select('id').single()
    workId = w!.id
  })

  afterAll(async () => {
    await admin.from('case_practitioner_work').delete().eq('id', workId)
    await admin.from('client_cases').delete().eq('id', caseId)
    await admin.from('practitioners').delete().eq('id', practitioner.id)
    await deleteTestUser(admin, practitioner.id)
    await deleteTestUser(admin, memberUser.id)
  })

  it('authenticated practitioner can complete own work item', async () => {
    const client = await signInAs(practitioner)
    const eventId = await completeWorkItem(client, {
      workId,
      decision:       'approved',
      notes:          'All clear',
      recommendation: 'Continue as planned',
    })
    expect(typeof eventId).toBe('string')
    expect(eventId.length).toBeGreaterThan(0)

    const { data: w } = await admin.from('case_practitioner_work').select('status, completed_at').eq('id', workId).single()
    expect(w?.status).toBe('completed')
    expect(w?.completed_at).not.toBeNull()
  })

  it('RPC rejects invalid decision value at the DB layer', async () => {
    const client = await signInAs(practitioner)
    const { error } = await client.rpc('complete_practitioner_work', {
      p_work_id:        workId,
      p_decision:       'rejected',   // not in ('approved','needs_revision','escalated')
      p_notes:          '',
      p_recommendation: '',
    })
    expect(error).not.toBeNull()
    expect(error?.message).toContain('Invalid decision')
  })
})
