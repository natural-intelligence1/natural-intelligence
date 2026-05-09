import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import { getOrCreateClientCase } from './getOrCreateClientCase'
import { createTestUser, deleteTestUser } from '../practitioners/__test-helpers__/createTestUser'

const HAVE_DB = !!process.env.NEXT_PUBLIC_SUPABASE_URL

function mkAdmin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ─── Unit tests ───────────────────────────────────────────────────────────────

describe('getOrCreateClientCase — unit', () => {
  it('throws when the fetch query errors', async () => {
    const fakeClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: null, error: { message: 'RLS denied', code: '42501' } }),
                }),
              }),
            }),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof createClient<Database>>

    await expect(getOrCreateClientCase(fakeClient, 'any-id')).rejects.toMatchObject({ message: 'RLS denied' })
  })

  it('returns existing id without inserting when a row is found', async () => {
    let insertCalled = false
    const fakeClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: { id: 'existing-uuid' }, error: null }),
                }),
              }),
            }),
          }),
        }),
        insert: () => { insertCalled = true; return { select: () => ({ single: async () => ({ data: null, error: null }) }) } },
      }),
    } as unknown as ReturnType<typeof createClient<Database>>

    const result = await getOrCreateClientCase(fakeClient, 'member-id')
    expect(result).toBe('existing-uuid')
    expect(insertCalled).toBe(false)
  })

  it('throws when the insert errors', async () => {
    const fakeClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
            }),
          }),
        }),
        insert: () => ({
          select: () => ({
            single: async () => ({ data: null, error: { message: 'constraint violation', code: '23505' } }),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof createClient<Database>>

    await expect(getOrCreateClientCase(fakeClient, 'member-id')).rejects.toMatchObject({ code: '23505' })
  })
})

// ─── Integration tests ────────────────────────────────────────────────────────

describe.skipIf(!HAVE_DB)('getOrCreateClientCase — integration', () => {
  let admin: ReturnType<typeof mkAdmin>
  let member: Awaited<ReturnType<typeof createTestUser>>

  beforeAll(async () => {
    admin = mkAdmin()
    member = await createTestUser(admin, 'crt-gocc')
  })

  afterAll(async () => {
    await admin.from('client_cases').delete().eq('client_id', member.id)
    await deleteTestUser(admin, member.id)
  })

  it('creates a new case and returns a uuid', async () => {
    const id = await getOrCreateClientCase(admin, member.id)
    expect(typeof id).toBe('string')
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('is idempotent — second call returns the same case id', async () => {
    const id1 = await getOrCreateClientCase(admin, member.id)
    const id2 = await getOrCreateClientCase(admin, member.id)
    expect(id1).toBe(id2)
  })

  it('stores primary_concern when provided on first creation', async () => {
    const newMember = await createTestUser(admin, 'crt-gocc-concern')
    const id = await getOrCreateClientCase(admin, newMember.id, { primaryConcern: 'fatigue' })
    const { data } = await admin.from('client_cases').select('primary_concern').eq('id', id).single()
    expect(data?.primary_concern).toBe('fatigue')
    await admin.from('client_cases').delete().eq('client_id', newMember.id)
    await deleteTestUser(admin, newMember.id)
  })
})
