import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import { endClientPractitionerLink } from './endClientPractitionerLink'
import { createTestUser, deleteTestUser } from './__test-helpers__/createTestUser'

const HAVE_DB = !!process.env.NEXT_PUBLIC_SUPABASE_URL

function mkAdmin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

describe.skipIf(!HAVE_DB)('endClientPractitionerLink', () => {
  let admin: ReturnType<typeof mkAdmin>
  let practitioner: Awaited<ReturnType<typeof createTestUser>>
  let memberUser:   Awaited<ReturnType<typeof createTestUser>>
  let linkId:       string

  beforeAll(async () => {
    admin        = mkAdmin()
    practitioner = await createTestUser(admin, 'g13b-ecpl-pract')
    memberUser   = await createTestUser(admin, 'g13b-ecpl-member')
    await admin.from('practitioners').insert({ id: practitioner.id, display_name: `Test ${practitioner.email}`, status: 'active' })

    const { data } = await admin.from('client_practitioner_links').insert({
      client_id:       memberUser.id,
      practitioner_id: practitioner.id,
      connection_type: 'assigned_by_admin',
      role:            'lead',
      control_level:   'keep',
      creation_actor:  'admin',
    }).select('id').single()
    linkId = data!.id
  })

  afterAll(async () => {
    await admin.from('client_practitioner_links').delete().eq('id', linkId)
    await admin.from('practitioners').delete().eq('id', practitioner.id)
    await deleteTestUser(admin, practitioner.id)
    await deleteTestUser(admin, memberUser.id)
  })

  it('sets ended_at and end_reason on the link', async () => {
    await endClientPractitionerLink(admin, linkId, 'client_request')

    const { data } = await admin.from('client_practitioner_links')
      .select('ended_at, end_reason')
      .eq('id', linkId)
      .single()

    expect(data?.ended_at).not.toBeNull()
    expect(data?.end_reason).toBe('client_request')
  })

  it('ended link is no longer visible as active', async () => {
    const { data } = await admin.from('client_practitioner_links')
      .select('id')
      .eq('practitioner_id', practitioner.id)
      .is('ended_at', null)

    expect((data ?? []).some((r) => r.id === linkId)).toBe(false)
  })
})
