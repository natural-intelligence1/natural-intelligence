// Kill-switch test for the Sprint 2 assignment bridge. Proves the bridge is
// DISABLED BY DEFAULT and only routes when INTAKE_ASSIGNMENT_ENABLED === "true".
// SYNTHETIC DATA ONLY (createTestUser fixtures; no real client data).
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import { routeIntakeAssignment, isIntakeAssignmentEnabled } from './routeIntakeAssignment'
import { listWorkForInbox } from './listWorkForInbox'
import { createClientPractitionerLink } from './createClientPractitionerLink'
import { createTestUser, deleteTestUser } from './__test-helpers__/createTestUser'
import { signInAs } from './__test-helpers__/signInAs'

const HAVE_DB = !!process.env.NEXT_PUBLIC_SUPABASE_URL
const FLAG = 'INTAKE_ASSIGNMENT_ENABLED'
function setFlag(v?: string) { if (v === undefined) delete process.env[FLAG]; else process.env[FLAG] = v }
function mkAdmin() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// ─── Unit (always runs) — the kill-switch default ────────────────────────────
describe('isIntakeAssignmentEnabled — kill-switch default', () => {
  const orig = process.env[FLAG]
  afterAll(() => setFlag(orig))
  it('is disabled by default (flag unset)', () => { setFlag(undefined); expect(isIntakeAssignmentEnabled()).toBe(false) })
  it('is disabled when flag is not exactly "true"', () => {
    setFlag('false'); expect(isIntakeAssignmentEnabled()).toBe(false)
    setFlag('1');     expect(isIntakeAssignmentEnabled()).toBe(false)
    setFlag('TRUE');  expect(isIntakeAssignmentEnabled()).toBe(false)
  })
  it('is enabled only when flag === "true"', () => { setFlag('true'); expect(isIntakeAssignmentEnabled()).toBe(true) })
})

// ─── Integration (skip-if-no-DB) ─────────────────────────────────────────────
describe.skipIf(!HAVE_DB)('routeIntakeAssignment — kill-switch + routing (synthetic)', () => {
  let admin:          ReturnType<typeof mkAdmin>
  let practitioner:   Awaited<ReturnType<typeof createTestUser>>
  let linkedMember:   Awaited<ReturnType<typeof createTestUser>>
  let unlinkedMember: Awaited<ReturnType<typeof createTestUser>>
  let linkId: string
  let caseId: string | undefined
  const origFlag = process.env[FLAG]

  beforeAll(async () => {
    admin          = mkAdmin()
    practitioner   = await createTestUser(admin, 's2-ks-pract')
    linkedMember   = await createTestUser(admin, 's2-ks-linked')
    unlinkedMember = await createTestUser(admin, 's2-ks-unlinked')
    await admin.from('practitioners').insert({ id: practitioner.id, display_name: `Test ${practitioner.email}`, status: 'active' })
    linkId = await createClientPractitionerLink(admin, {
      clientId: linkedMember.id, practitionerId: practitioner.id,
      connectionType: 'assigned_by_admin', role: 'lead', controlLevel: 'keep', creationActor: 'admin',
    })
  })

  afterAll(async () => {
    setFlag(origFlag)
    const { data: cases } = await admin.from('client_cases').select('id').in('client_id', [linkedMember.id, unlinkedMember.id])
    const ids = (cases ?? []).map((c) => c.id)
    if (ids.length) {
      await admin.from('case_practitioner_work').delete().in('case_id', ids)
      await admin.from('client_cases').delete().in('id', ids)
    }
    await admin.from('client_practitioner_links').delete().eq('id', linkId)
    await admin.from('practitioners').delete().eq('id', practitioner.id)
    await deleteTestUser(admin, practitioner.id)
    await deleteTestUser(admin, linkedMember.id)
    await deleteTestUser(admin, unlinkedMember.id)
  })

  async function workCountFor(memberId: string): Promise<number> {
    const { data: cases } = await admin.from('client_cases').select('id').eq('client_id', memberId)
    const ids = (cases ?? []).map((c) => c.id)
    if (!ids.length) return 0
    const { count } = await admin.from('case_practitioner_work').select('id', { count: 'exact', head: true }).in('case_id', ids)
    return count ?? 0
  }

  it('flag OFF (default) → disabled; creates no case/work item', async () => {
    setFlag(undefined)
    const res = await routeIntakeAssignment(admin, linkedMember.id)
    expect(res.status).toBe('disabled')
    expect(await workCountFor(linkedMember.id)).toBe(0)
  })

  it('flag "true" + active link → assigns and surfaces in the practitioner inbox', async () => {
    setFlag('true')
    const res = await routeIntakeAssignment(admin, linkedMember.id)
    expect(res.status).toBe('assigned')
    if (res.status === 'assigned') { caseId = res.caseId; expect(res.alreadyAssigned).toBe(false) }
    const client = await signInAs(practitioner)
    const inbox = await listWorkForInbox(client, practitioner.id)
    expect(inbox.some((i) => i.caseId === caseId)).toBe(true)
  })

  it('flag "true", repeated → idempotent (no duplicate work item)', async () => {
    setFlag('true')
    const res = await routeIntakeAssignment(admin, linkedMember.id)
    expect(res.status).toBe('assigned')
    if (res.status === 'assigned') expect(res.alreadyAssigned).toBe(true)
    expect(await workCountFor(linkedMember.id)).toBe(1)
  })

  it('flag "true" + no active link → skips (no work item)', async () => {
    setFlag('true')
    const res = await routeIntakeAssignment(admin, unlinkedMember.id)
    expect(res.status).toBe('no_linked_practitioner')
    expect(await workCountFor(unlinkedMember.id)).toBe(0)
  })
})
