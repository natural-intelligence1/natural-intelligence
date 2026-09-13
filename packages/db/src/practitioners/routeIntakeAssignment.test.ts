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
  // Sprint 3: routing now fail-closes without deidentified_synopsis_sharing
  // consent. hasActiveConsent reads withdrawn_at, which arrives with 0051 —
  // so consent can only be VISIBLE post-migration. Pre-0051 the assigned-path
  // tests self-skip and the blocked path is asserted instead.
  let consentVisible = false

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
    // Probe for the 0051 consent columns, then grant synopsis-sharing consent
    // to both members so the pre-existing routing paths stay testable.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const probe = await (admin as any).from('consent_records').select('withdrawn_at').limit(1)
    consentVisible = !probe.error
    for (const m of [linkedMember, unlinkedMember]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any).from('consent_records').insert({
        profile_id: m.id, email: m.email, consent_type: 'deidentified_synopsis_sharing',
        consented: true, consented_at: new Date().toISOString(),
      })
    }
  })

  afterAll(async () => {
    setFlag(origFlag)
    const { data: cases } = await admin.from('client_cases').select('id').in('client_id', [linkedMember.id, unlinkedMember.id])
    const ids = (cases ?? []).map((c) => c.id)
    if (ids.length) {
      await admin.from('case_practitioner_work').delete().in('case_id', ids)
      await admin.from('client_cases').delete().in('id', ids)
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('consent_records').delete().in('profile_id', [linkedMember.id, unlinkedMember.id])
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

  it('flag "true" + consent NOT visible → blocked_by_consent, no work item (pre-0051 fail-closed)', async (ctx) => {
    if (consentVisible) return ctx.skip() // post-migration: consent is granted and visible
    setFlag('true')
    const res = await routeIntakeAssignment(admin, linkedMember.id)
    expect(res.status).toBe('blocked_by_consent')
    expect(await workCountFor(linkedMember.id)).toBe(0)
  })

  it('flag "true" + active link + consent → assigns and surfaces in the practitioner inbox', async (ctx) => {
    if (!consentVisible) return ctx.skip() // pre-0051: gate correctly blocks instead
    setFlag('true')
    const res = await routeIntakeAssignment(admin, linkedMember.id)
    expect(res.status).toBe('assigned')
    if (res.status === 'assigned') { caseId = res.caseId; expect(res.alreadyAssigned).toBe(false) }
    const client = await signInAs(practitioner)
    const inbox = await listWorkForInbox(client, practitioner.id)
    expect(inbox.some((i) => i.caseId === caseId)).toBe(true)
  })

  it('flag "true", repeated → idempotent (no duplicate work item)', async (ctx) => {
    if (!consentVisible) return ctx.skip()
    setFlag('true')
    const res = await routeIntakeAssignment(admin, linkedMember.id)
    expect(res.status).toBe('assigned')
    if (res.status === 'assigned') expect(res.alreadyAssigned).toBe(true)
    expect(await workCountFor(linkedMember.id)).toBe(1)
  })

  it('flag "true" + no active link → skips (no work item)', async (ctx) => {
    if (!consentVisible) return ctx.skip() // pre-0051 the consent gate fires first
    setFlag('true')
    const res = await routeIntakeAssignment(admin, unlinkedMember.id)
    expect(res.status).toBe('no_linked_practitioner')
    expect(await workCountFor(unlinkedMember.id)).toBe(0)
  })
})
