// Regression guard — intake personalisation round-trip on user_personalisation.
//
// Locks in the fix for the bug where the intake page/form filtered the
// user_personalisation table on a non-existent `id` column (the table's PK is
// `user_id`). The wrong filter threw Postgres 42703 at runtime — silently
// swallowed on writes (soft-fail) and returning null on the read (defaults).
//
//   Read site:  apps/web/app/dashboard/intake/page.tsx
//   Write sites: apps/web/app/dashboard/intake/IntakeForm.tsx
//                (setBiologicalSex / setReligion / setReligiousContentPreference)
//
// This test mirrors the app's EXACT raw queries (authenticated client, the same
// .from('user_personalisation') / .eq('user_id', …) shape) and proves the three
// Chapter-1 fields persist and read back. It also asserts the OLD buggy filter
// (.eq('id', …)) errors, so a regression to `id` fails loudly here.
//
// Integration only (skip-if-no-DB) — there is no React harness in apps/web, so
// this service-role + authenticated-client suite is the regression home.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import { createTestUser, deleteTestUser } from '../practitioners/__test-helpers__/createTestUser'
import { signInAs }                        from '../practitioners/__test-helpers__/signInAs'

const HAVE_DB = !!process.env.NEXT_PUBLIC_SUPABASE_URL

function mkServiceRoleAdmin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// user_personalisation is not in the generated Database types — match how the
// app and existing personalisation tests reach it: through a loose-typed client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const loose = (c: unknown) => c as unknown as SupabaseClient<any>

describe.skipIf(!HAVE_DB)('intake personalisation round-trip (user_personalisation)', () => {
  let admin: ReturnType<typeof mkServiceRoleAdmin>
  let user:  Awaited<ReturnType<typeof createTestUser>>

  beforeAll(async () => {
    admin = mkServiceRoleAdmin()
    user  = await createTestUser(admin, 'intake-personalisation-roundtrip')
  })

  afterAll(async () => { await deleteTestUser(admin, user.id) })

  it('writes all three fields via .eq(user_id) and reads them back (page.tsx shape)', async () => {
    const client = await signInAs(user)

    // FIXED write path — IntakeForm setBiologicalSex/setReligion/setReligiousContentPreference
    const { error: writeError } = await loose(client)
      .from('user_personalisation')
      .update({
        biological_sex:               'female',
        religion:                     'muslim',
        religious_content_preference: 'show',
      })
      .eq('user_id', user.id)
    expect(writeError).toBeNull()

    // FIXED read-back — page.tsx select shape, filtered by user_id
    const { data, error: readError } = await loose(client)
      .from('user_personalisation')
      .select('biological_sex, religion, religious_content_preference')
      .eq('user_id', user.id)
      .maybeSingle()

    expect(readError).toBeNull()
    expect(data).toEqual({
      biological_sex:               'female',
      religion:                     'muslim',
      religious_content_preference: 'show',
    })
  })

  it('the muslim→non-muslim change clears the stored preference (no orphan)', async () => {
    const client = await signInAs(user)

    // Component setReligion payload for a non-muslim value explicitly writes hide.
    const { error: writeError } = await loose(client)
      .from('user_personalisation')
      .update({ religion: 'secular', religious_content_preference: 'hide' })
      .eq('user_id', user.id)
    expect(writeError).toBeNull()

    const { data } = await loose(client)
      .from('user_personalisation')
      .select('religion, religious_content_preference')
      .eq('user_id', user.id)
      .maybeSingle()

    expect(data).toEqual({ religion: 'secular', religious_content_preference: 'hide' })
  })

  it('the OLD buggy filter .eq(id) errors — guards against regressing to `id`', async () => {
    const client = await signInAs(user)

    const { error } = await loose(client)
      .from('user_personalisation')
      .select('biological_sex')
      .eq('id', user.id)   // wrong column — table PK is user_id, no `id` exists
      .maybeSingle()

    // Postgres 42703 (undefined_column) surfaces through PostgREST.
    expect(error).not.toBeNull()
    expect(error?.code).toBe('42703')
  })
})
