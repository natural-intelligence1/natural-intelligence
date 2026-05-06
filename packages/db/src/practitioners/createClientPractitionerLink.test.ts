import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import { createClientPractitionerLink } from './createClientPractitionerLink'
import { createTestUser, deleteTestUser } from './__test-helpers__/createTestUser'

const HAVE_DB = !!process.env.NEXT_PUBLIC_SUPABASE_URL

function mkAdmin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// TypeScript compile-time checks (always run)
describe('createClientPractitionerLink — type safety', () => {
  it('prevents invalid connection_type at compile time', () => {
    // @ts-expect-error — 'invalid' is not a valid ConnectionType
    const _: Parameters<typeof createClientPractitionerLink>[1] = { connectionType: 'invalid' }
    void _
  })

  it('prevents invalid role at compile time', () => {
    // @ts-expect-error — 'owner' is not a valid LinkRole
    const _: Parameters<typeof createClientPractitionerLink>[1] = { role: 'owner' }
    void _
  })
})

describe.skipIf(!HAVE_DB)('createClientPractitionerLink — integration', () => {
  let admin: ReturnType<typeof mkAdmin>
  let practitionerA: Awaited<ReturnType<typeof createTestUser>>
  let practitionerB: Awaited<ReturnType<typeof createTestUser>>
  let memberUser:    Awaited<ReturnType<typeof createTestUser>>
  const createdLinkIds: string[] = []

  beforeAll(async () => {
    admin         = mkAdmin()
    practitionerA = await createTestUser(admin, 'g13b-ccpl-pract-a')
    practitionerB = await createTestUser(admin, 'g13b-ccpl-pract-b')
    memberUser    = await createTestUser(admin, 'g13b-ccpl-member')

    for (const u of [practitionerA, practitionerB]) {
      await admin.from('practitioners').insert({ id: u.id, display_name: `Test ${u.email}`, status: 'active' })
    }
  })

  afterAll(async () => {
    if (createdLinkIds.length) {
      await admin.from('client_practitioner_links').delete().in('id', createdLinkIds)
    }
    await admin.from('practitioners').delete().in('id', [practitionerA.id, practitionerB.id])
    for (const u of [practitionerA, practitionerB, memberUser]) await deleteTestUser(admin, u.id)
  })

  it('creates a link and returns its id', async () => {
    const id = await createClientPractitionerLink(admin, {
      clientId:       memberUser.id,
      practitionerId: practitionerA.id,
      connectionType: 'assigned_by_admin',
      role:           'lead',
      controlLevel:   'keep',
      creationActor:  'admin',
    })
    createdLinkIds.push(id)
    expect(typeof id).toBe('string')
  })

  it('unique active lead per client — second lead is rejected', async () => {
    // practitionerA is already lead; practitionerB as lead should fail
    await expect(
      createClientPractitionerLink(admin, {
        clientId:       memberUser.id,
        practitionerId: practitionerB.id,
        connectionType: 'assigned_by_admin',
        role:           'lead',
        controlLevel:   'keep',
        creationActor:  'admin',
      })
    ).rejects.toThrow()
  })

  it('non-lead role can be added alongside existing lead', async () => {
    const id = await createClientPractitionerLink(admin, {
      clientId:       memberUser.id,
      practitionerId: practitionerB.id,
      connectionType: 'assigned_by_admin',
      role:           'specialist',
      controlLevel:   'flexible',
      creationActor:  'admin',
    })
    createdLinkIds.push(id)
    expect(typeof id).toBe('string')
  })
})
