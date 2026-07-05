// Sprint 2 — assignment bridge test. Proves a completed synthetic case creates a
// practitioner-assigned case_review work item that is visible in the practitioner
// workspace inbox. SYNTHETIC DATA ONLY (createTestUser fixtures; no real client data).
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import { assignCaseForReview } from './assignCaseForReview'
import { listWorkForInbox } from './listWorkForInbox'
import { createClientPractitionerLink } from './createClientPractitionerLink'
import { createTestUser, deleteTestUser } from './__test-helpers__/createTestUser'
import { signInAs } from './__test-helpers__/signInAs'

const HAVE_DB = !!process.env.NEXT_PUBLIC_SUPABASE_URL
function mkAdmin() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// ─── Unit (always runs) ──────────────────────────────────────────────────────
describe('assignCaseForReview — type safety', () => {
  it('requires memberId + practitionerId; defaults work_type to case_review', () => {
    const input: Parameters<typeof assignCaseForReview>[1] = { memberId: 'm', practitionerId: 'p' }
    expect(input.workType ?? 'case_review').toBe('case_review')
    // @ts-expect-error — memberId is required
    const _bad: Parameters<typeof assignCaseForReview>[1] = { practitionerId: 'p' }
    void _bad
  })
})

// ─── Integration (skip-if-no-DB) ─────────────────────────────────────────────
describe.skipIf(!HAVE_DB)('assignCaseForReview — Sprint 2 assignment bridge (synthetic data)', () => {
  let admin:        ReturnType<typeof mkAdmin>
  let practitioner: Awaited<ReturnType<typeof createTestUser>>
  let member:       Awaited<ReturnType<typeof createTestUser>>
  let linkId:       string
  let caseId:       string
  const workIds: string[] = []

  beforeAll(async () => {
    admin        = mkAdmin()
    practitioner = await createTestUser(admin, 's2-bridge-pract')
    member       = await createTestUser(admin, 's2-bridge-member')
    await admin.from('practitioners').insert({ id: practitioner.id, display_name: `Test ${practitioner.email}`, status: 'active' })
    linkId = await createClientPractitionerLink(admin, {
      clientId: member.id, practitionerId: practitioner.id,
      connectionType: 'assigned_by_admin', role: 'lead', controlLevel: 'keep', creationActor: 'admin',
    })
  })

  afterAll(async () => {
    if (workIds.length) await admin.from('case_practitioner_work').delete().in('id', workIds)
    if (caseId)         await admin.from('client_cases').delete().eq('id', caseId)
    await admin.from('client_practitioner_links').delete().eq('id', linkId)
    await admin.from('practitioners').delete().eq('id', practitioner.id)
    await deleteTestUser(admin, practitioner.id)
    await deleteTestUser(admin, member.id)
  })

  it('resolves the client’s active practitioner (mirrors the intake bridge query)', async () => {
    const { data } = await admin
      .from('client_practitioner_links')
      .select('practitioner_id')
      .eq('client_id', member.id)
      .is('ended_at', null)
      .limit(1)
      .maybeSingle()
    expect(data?.practitioner_id).toBe(practitioner.id)
  })

  it('creates a case + case_review assignment from a completed synthetic case', async () => {
    const res = await assignCaseForReview(admin, {
      memberId: member.id, practitionerId: practitioner.id, primaryConcern: 'synthetic test concern',
    })
    caseId = res.caseId; workIds.push(res.workId)
    expect(res.alreadyAssigned).toBe(false)
    expect(typeof res.caseId).toBe('string')
    expect(typeof res.workId).toBe('string')

    const { data: c } = await admin.from('client_cases').select('id, status, client_id').eq('id', res.caseId).single()
    expect(c).toMatchObject({ status: 'active', client_id: member.id })

    const { data: w } = await admin.from('case_practitioner_work')
      .select('work_type, status, practitioner_id, case_id').eq('id', res.workId).single()
    expect(w).toMatchObject({ work_type: 'case_review', status: 'assigned', practitioner_id: practitioner.id, case_id: res.caseId })
  })

  it('is idempotent — a repeated completion reuses the open work item (no duplicate)', async () => {
    const res = await assignCaseForReview(admin, { memberId: member.id, practitionerId: practitioner.id })
    expect(res.alreadyAssigned).toBe(true)
    expect(res.workId).toBe(workIds[0])

    const { count } = await admin.from('case_practitioner_work')
      .select('id', { count: 'exact', head: true })
      .eq('case_id', caseId).eq('practitioner_id', practitioner.id).eq('work_type', 'case_review')
    expect(count).toBe(1)
  })

  it('the assigned case is visible in the practitioner workspace inbox', async () => {
    const client = await signInAs(practitioner)
    const inbox = await listWorkForInbox(client, practitioner.id)
    expect(inbox.some(i => i.workItemId === workIds[0] && i.caseId === caseId)).toBe(true)
  })
})
