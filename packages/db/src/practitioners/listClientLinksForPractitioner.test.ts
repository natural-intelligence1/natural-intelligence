import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import { listClientLinksForPractitioner } from './listClientLinksForPractitioner'
import { createTestUser, deleteTestUser } from './__test-helpers__/createTestUser'
import { signInAs } from './__test-helpers__/signInAs'

const HAVE_DB = !!process.env.NEXT_PUBLIC_SUPABASE_URL

function mkAdmin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

describe.skipIf(!HAVE_DB)('listClientLinksForPractitioner — RLS', () => {
  let admin: ReturnType<typeof mkAdmin>
  let practitioner: Awaited<ReturnType<typeof createTestUser>>
  let memberUser:   Awaited<ReturnType<typeof createTestUser>>
  let activeLinkId: string
  let endedLinkId:  string

  beforeAll(async () => {
    admin        = mkAdmin()
    practitioner = await createTestUser(admin, 'g13b-lclfp-pract')
    memberUser   = await createTestUser(admin, 'g13b-lclfp-member')
    await admin.from('practitioners').insert({ id: practitioner.id, display_name: `Test ${practitioner.email}`, status: 'active' })

    const { data: aLink } = await admin.from('client_practitioner_links').insert({
      client_id: memberUser.id, practitioner_id: practitioner.id,
      connection_type: 'assigned_by_admin', role: 'lead',
      control_level: 'keep', creation_actor: 'admin',
    }).select('id').single()
    activeLinkId = aLink!.id

    const { data: eLink } = await admin.from('client_practitioner_links').insert({
      client_id: memberUser.id, practitioner_id: practitioner.id,
      connection_type: 'assigned_by_admin', role: 'specialist',
      control_level: 'flexible', creation_actor: 'admin',
      ended_at: new Date().toISOString(), end_reason: 'admin_action',
    }).select('id').single()
    endedLinkId = eLink!.id
  })

  afterAll(async () => {
    await admin.from('client_practitioner_links').delete().in('id', [activeLinkId, endedLinkId])
    await admin.from('practitioners').delete().eq('id', practitioner.id)
    await deleteTestUser(admin, practitioner.id)
    await deleteTestUser(admin, memberUser.id)
  })

  it('admin helper returns only active links', async () => {
    const links = await listClientLinksForPractitioner(admin, practitioner.id)
    const ids = links.map((l) => l.id)
    expect(ids).toContain(activeLinkId)
    expect(ids).not.toContain(endedLinkId)
  })

  it('practitioner sees own active links via RLS', async () => {
    const client = await signInAs(practitioner)
    const { data } = await client.from('client_practitioner_links')
      .select('id')
      .eq('practitioner_id', practitioner.id)
    const ids = (data ?? []).map((r) => r.id)
    expect(ids).toContain(activeLinkId)
  })

  it('practitioner does NOT see own ended links via RLS', async () => {
    const client = await signInAs(practitioner)
    const { data } = await client.from('client_practitioner_links')
      .select('id')
      .eq('practitioner_id', practitioner.id)
    const ids = (data ?? []).map((r) => r.id)
    expect(ids).not.toContain(endedLinkId)
  })

  it('member cannot read client_practitioner_links directly via RLS', async () => {
    const client = await signInAs(memberUser)
    const { data } = await client.from('client_practitioner_links').select('id').limit(10)
    expect(data ?? []).toHaveLength(0)
  })
})
