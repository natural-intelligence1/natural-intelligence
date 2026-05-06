import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import { getClientTeam, assertNoForbiddenFields } from './getClientTeam'
import type { ClientTeamMember } from './types'
import { createTestUser, deleteTestUser } from './__test-helpers__/createTestUser'

const HAVE_DB = !!process.env.NEXT_PUBLIC_SUPABASE_URL

const FORBIDDEN_FIELDS = [
  'connection_type', 'control_level', 'created_by',
  'creation_actor', 'end_reason', 'notes', 'ended_at',
] as const

function mkAdmin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ─── Unit tests (always run) ──────────────────────────────────────────────────

describe('ClientTeamMember — projection contract', () => {
  it('assertNoForbiddenFields throws when a forbidden field is present', () => {
    const bad = { practitionerId: 'x', connection_type: 'assigned_by_admin' }
    expect(() => assertNoForbiddenFields(bad)).toThrow('connection_type')
  })

  it('assertNoForbiddenFields passes for a valid projection', () => {
    const good: ClientTeamMember = {
      practitionerId:     'uuid',
      displayName:        'Dr Test',
      bio:                null,
      credentialsSummary: null,
      specialisations:    null,
      modalities:         null,
      role:               'lead',
      linkedAt:           new Date().toISOString(),
    }
    expect(() => assertNoForbiddenFields(good as unknown as Record<string, unknown>)).not.toThrow()
  })
})

// ─── Integration tests ────────────────────────────────────────────────────────

describe.skipIf(!HAVE_DB)('getClientTeam', () => {
  let admin: ReturnType<typeof mkAdmin>
  let practitionerA: Awaited<ReturnType<typeof createTestUser>>
  let practitionerB: Awaited<ReturnType<typeof createTestUser>>
  let memberUser:    Awaited<ReturnType<typeof createTestUser>>
  let linkIdA:       string
  let linkIdB:       string

  beforeAll(async () => {
    admin         = mkAdmin()
    practitionerA = await createTestUser(admin, 'g13b-gct-pract-a')
    practitionerB = await createTestUser(admin, 'g13b-gct-pract-b')
    memberUser    = await createTestUser(admin, 'g13b-gct-member')

    for (const u of [practitionerA, practitionerB]) {
      await admin.from('practitioners').insert({ id: u.id, display_name: `Test ${u.email}`, status: 'active' })
    }

    const { data: lA } = await admin.from('client_practitioner_links').insert({
      client_id: memberUser.id, practitioner_id: practitionerA.id,
      connection_type: 'assigned_by_admin', role: 'lead', control_level: 'keep', creation_actor: 'admin',
    }).select('id').single()
    linkIdA = lA!.id

    const { data: lB } = await admin.from('client_practitioner_links').insert({
      client_id: memberUser.id, practitioner_id: practitionerB.id,
      connection_type: 'assigned_by_admin', role: 'specialist', control_level: 'flexible', creation_actor: 'admin',
    }).select('id').single()
    linkIdB = lB!.id
  })

  afterAll(async () => {
    await admin.from('client_practitioner_links').delete().in('id', [linkIdA, linkIdB])
    await admin.from('practitioners').delete().in('id', [practitionerA.id, practitionerB.id])
    for (const u of [practitionerA, practitionerB, memberUser]) await deleteTestUser(admin, u.id)
  })

  it('returns team members for client', async () => {
    const team = await getClientTeam(admin, memberUser.id)
    const ids = team.map((m) => m.practitionerId)
    expect(ids).toContain(practitionerA.id)
    expect(ids).toContain(practitionerB.id)
  })

  it('returned objects contain no forbidden fields', async () => {
    const team = await getClientTeam(admin, memberUser.id)
    for (const member of team) {
      assertNoForbiddenFields(member as unknown as Record<string, unknown>)
      for (const field of FORBIDDEN_FIELDS) {
        expect(field in member).toBe(false)
      }
    }
  })

  it('ClientTeamMember has the required safe fields', async () => {
    const team = await getClientTeam(admin, memberUser.id)
    const member = team.find((m) => m.practitionerId === practitionerA.id)!
    expect(member).toBeDefined()
    expect(member.displayName).toContain('Test')
    expect(member.role).toBe('lead')
    expect(typeof member.linkedAt).toBe('string')
    expect('practitionerId' in member).toBe(true)
    expect('bio' in member).toBe(true)
    expect('credentialsSummary' in member).toBe(true)
    expect('specialisations' in member).toBe(true)
    expect('modalities' in member).toBe(true)
  })
})
