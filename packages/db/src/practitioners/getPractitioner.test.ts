import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import { getPractitioner } from './getPractitioner'
import { createTestUser, deleteTestUser } from './__test-helpers__/createTestUser'
import { signInAs, anonClient } from './__test-helpers__/signInAs'

const HAVE_DB = !!process.env.NEXT_PUBLIC_SUPABASE_URL

function mkAdmin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ─── Unit tests (always run — no DB) ─────────────────────────────────────────

describe('getPractitioner — unit', () => {
  it('throws on query error', async () => {
    const fakeClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: { code: '42501', message: 'RLS' } }),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof createClient<Database>>

    await expect(getPractitioner(fakeClient, 'any-id')).rejects.toThrow('getPractitioner failed [42501]')
  })

  it('returns null when not found', async () => {
    const fakeClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof createClient<Database>>

    const result = await getPractitioner(fakeClient, 'missing-id')
    expect(result).toBeNull()
  })
})

// ─── Integration / RLS tests (skipped if no DB credentials) ──────────────────

describe.skipIf(!HAVE_DB)('getPractitioner — RLS', () => {
  let admin: ReturnType<typeof mkAdmin>
  let practitionerA: Awaited<ReturnType<typeof createTestUser>>
  let practitionerB: Awaited<ReturnType<typeof createTestUser>>

  beforeAll(async () => {
    admin = mkAdmin()
    practitionerA = await createTestUser(admin, 'g13b-pract-get-a')
    practitionerB = await createTestUser(admin, 'g13b-pract-get-b')

    for (const u of [practitionerA, practitionerB]) {
      await admin.from('practitioners').insert({
        id: u.id, display_name: `Test ${u.email}`, status: 'active',
      })
    }
  })

  afterAll(async () => {
    await admin.from('practitioners').delete().in('id', [practitionerA.id, practitionerB.id])
    await deleteTestUser(admin, practitionerA.id)
    await deleteTestUser(admin, practitionerB.id)
  })

  it('admin client retrieves practitioner by id', async () => {
    const result = await getPractitioner(admin, practitionerA.id)
    expect(result?.id).toBe(practitionerA.id)
    expect(result?.display_name).toBe(`Test ${practitionerA.email}`)
  })

  it('admin client returns null for unknown id', async () => {
    const result = await getPractitioner(admin, '00000000-0000-0000-0000-000000000000')
    expect(result).toBeNull()
  })

  it('practitioner can read own row', async () => {
    const client = await signInAs(practitionerA)
    const { data } = await client.from('practitioners').select('id').eq('id', practitionerA.id).maybeSingle()
    expect(data?.id).toBe(practitionerA.id)
  })

  it('practitioner cannot read another practitioner row', async () => {
    const client = await signInAs(practitionerA)
    const { data } = await client.from('practitioners').select('id').eq('id', practitionerB.id).maybeSingle()
    expect(data).toBeNull()
  })

  it('anon query against practitioners returns zero rows', async () => {
    const anon = anonClient()
    const { data } = await anon.from('practitioners').select('id').limit(10)
    expect(data).toHaveLength(0)
  })

  it('anon can query practitioners_directory (view)', async () => {
    const anon = anonClient()
    const { data, error } = await anon.from('practitioners_directory').select('id, display_name').limit(1)
    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
  })
})
