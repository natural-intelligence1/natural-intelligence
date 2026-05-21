// PS.3 — getPersonalisationContext + isIslamicContentEnabled tests.
//
// Unit (always-run):
//   • Type-level guarantee: clinical_notes_on_sex absent from
//     PersonalisationContext (won't compile if present — @ts-expect-error)
//   • Helper behaviour with mocked client (row, missing, error)
//   • Islamic gate boolean: 5-case matrix from PS.3 spec Part 6
//
// Integration (skip-if-no-DB):
//   • Authenticated user reads own row through RLS
//   • Runtime assertion that clinical_notes_on_sex is NOT in the returned shape

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import {
  getPersonalisationContext,
  isIslamicContentEnabled,
  DEFAULT_PERSONALISATION_CONTEXT,
  type PersonalisationContext,
} from './getPersonalisationContext'
import { createTestUser, deleteTestUser } from '../practitioners/__test-helpers__/createTestUser'
import { signInAs }                        from '../practitioners/__test-helpers__/signInAs'

const HAVE_DB = !!process.env.NEXT_PUBLIC_SUPABASE_URL

function mkServiceRoleAdmin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ─── Unit ──────────────────────────────────────────────────────────────────

describe('PersonalisationContext — type scope', () => {
  it('shape excludes clinical_notes_on_sex (type-level)', () => {
    const ctx: PersonalisationContext = DEFAULT_PERSONALISATION_CONTEXT
    expect(ctx.religion).toBe('prefer_not_to_say')
    expect(ctx.religiousContentPreference).toBe('hide')
    // @ts-expect-error — clinical_notes_on_sex must never appear in dashboard context
    const _bad: PersonalisationContext = { ...ctx, clinical_notes_on_sex: 'leak' }
    void _bad
  })
})

function mockClient(row: unknown, error: { code: string; message: string } | null = null) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: row, error }),
        }),
      }),
    }),
  } as unknown as ReturnType<typeof createClient<Database>>
}

describe('getPersonalisationContext — unit', () => {
  it('returns the row when present', async () => {
    const out = await getPersonalisationContext(mockClient({
      biological_sex:                'female',
      religion:                      'muslim',
      religious_content_preference:  'show',
    }), 'u')
    expect(out).toEqual({
      biologicalSex:              'female',
      religion:                   'muslim',
      religiousContentPreference: 'show',
    })
  })

  it('returns safe defaults when row is missing', async () => {
    const out = await getPersonalisationContext(mockClient(null), 'u')
    expect(out).toEqual(DEFAULT_PERSONALISATION_CONTEXT)
  })

  it('returns safe defaults when query errors (does not throw)', async () => {
    const out = await getPersonalisationContext(
      mockClient(null, { code: '42501', message: 'RLS denied' }),
      'u',
    )
    expect(out).toEqual(DEFAULT_PERSONALISATION_CONTEXT)
  })
})

// ─── Islamic gate logic (PS.3 Part 6 — 5-case matrix) ─────────────────────

describe('isIslamicContentEnabled — gate matrix', () => {
  const cases: Array<[string, PersonalisationContext, boolean]> = [
    ['muslim + show     → true',  { biologicalSex: null, religion: 'muslim',            religiousContentPreference: 'show' }, true ],
    ['muslim + hide     → false', { biologicalSex: null, religion: 'muslim',            religiousContentPreference: 'hide' }, false],
    ['christian + show  → false', { biologicalSex: null, religion: 'christian',         religiousContentPreference: 'show' }, false],
    ['prefer_not + show → false', { biologicalSex: null, religion: 'prefer_not_to_say', religiousContentPreference: 'show' }, false],
    ['prefer_not + hide → false', { biologicalSex: null, religion: 'prefer_not_to_say', religiousContentPreference: 'hide' }, false],
  ]

  for (const [label, ctx, expected] of cases) {
    it(label, () => {
      expect(isIslamicContentEnabled(ctx)).toBe(expected)
    })
  }
})

// ─── Integration ───────────────────────────────────────────────────────────

describe.skipIf(!HAVE_DB)('getPersonalisationContext — integration', () => {
  let admin:  ReturnType<typeof mkServiceRoleAdmin>
  let user:   Awaited<ReturnType<typeof createTestUser>>

  beforeAll(async () => {
    admin = mkServiceRoleAdmin()
    user  = await createTestUser(admin, 'ps3-gpc-member')

    // Seed personalisation values so we can assert the helper returns them
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as unknown as SupabaseClient<any>)
      .from('user_personalisation')
      .update({ biological_sex: 'female', religion: 'muslim', religious_content_preference: 'show' })
      .eq('user_id', user.id)
  })

  afterAll(async () => { await deleteTestUser(admin, user.id) })

  it('authenticated user reads own personalisation context', async () => {
    const client = await signInAs(user)
    const ctx = await getPersonalisationContext(client, user.id)
    expect(ctx).toEqual({
      biologicalSex:              'female',
      religion:                   'muslim',
      religiousContentPreference: 'show',
    })
  })

  it('returned shape does NOT include clinical_notes_on_sex (runtime guarantee)', async () => {
    const client = await signInAs(user)
    const ctx = await getPersonalisationContext(client, user.id)
    expect(Object.keys(ctx).sort()).toEqual([
      'biologicalSex',
      'religion',
      'religiousContentPreference',
    ])
    expect((ctx as unknown as Record<string, unknown>).clinical_notes_on_sex).toBeUndefined()
    expect((ctx as unknown as Record<string, unknown>).clinicalNotesOnSex).toBeUndefined()
  })
})
