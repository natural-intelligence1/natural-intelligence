// PS.2 — getClientPersonalisation tests.
// Unit: mocked client returning view rows.
// Integration: assigned vs unassigned practitioner (skip-if-no-DB).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import { getClientPersonalisation } from './getClientPersonalisation'
import { createTestUser, deleteTestUser } from '../practitioners/__test-helpers__/createTestUser'
import { signInAs }                        from '../practitioners/__test-helpers__/signInAs'
import { assignWork }                       from '../practitioners/assignWork'

const HAVE_DB = !!process.env.NEXT_PUBLIC_SUPABASE_URL

function mkServiceRoleAdmin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ─── Unit ──────────────────────────────────────────────────────────────────

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

describe('getClientPersonalisation — unit', () => {
  it('returns null when view yields zero rows (unassigned practitioner)', async () => {
    const out = await getClientPersonalisation(mockClient(null), 'm')
    expect(out).toBeNull()
  })

  it('maps a row to the typed shape', async () => {
    const out = await getClientPersonalisation(mockClient({
      biological_sex:        'female',
      clinical_notes_on_sex: 'note',
      updated_at:            '2026-05-19T12:00:00Z',
    }), 'm')
    expect(out).toEqual({
      biologicalSex:      'female',
      clinicalNotesOnSex: 'note',
      updatedAt:          '2026-05-19T12:00:00Z',
    })
  })

  it('throws when the view query errors', async () => {
    await expect(getClientPersonalisation(
      mockClient(null, { code: '42501', message: 'RLS denied' }),
      'm',
    )).rejects.toThrow(/getClientPersonalisation failed/)
  })
})

// ─── Integration ───────────────────────────────────────────────────────────

describe.skipIf(!HAVE_DB)('getClientPersonalisation — integration', () => {
  let admin:         ReturnType<typeof mkServiceRoleAdmin>
  let assignedPract: Awaited<ReturnType<typeof createTestUser>>
  let otherPract:    Awaited<ReturnType<typeof createTestUser>>
  let member:        Awaited<ReturnType<typeof createTestUser>>
  let caseId:        string
  let workId:        string

  beforeAll(async () => {
    admin         = mkServiceRoleAdmin()
    assignedPract = await createTestUser(admin, 'ps2-gcp-pract')
    otherPract    = await createTestUser(admin, 'ps2-gcp-other')
    member        = await createTestUser(admin, 'ps2-gcp-member')

    for (const u of [assignedPract, otherPract]) {
      await admin.from('practitioners').insert({ id: u.id, display_name: `Test ${u.email}`, status: 'active' })
    }

    const { data: c } = await admin.from('client_cases').insert({ client_id: member.id }).select('id').single()
    caseId = c!.id

    workId = await assignWork(admin, {
      caseId, practitionerId: assignedPract.id, workType: 'case_review', assignedBy: assignedPract.id,
    })

    // Seed biological_sex via admin so we can assert the helper returns it
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as unknown as SupabaseClient<any>)
      .from('user_personalisation')
      .update({ biological_sex: 'female' })
      .eq('user_id', member.id)
  })

  afterAll(async () => {
    await admin.from('case_practitioner_work').delete().eq('id', workId)
    await admin.from('client_cases').delete().eq('id', caseId)
    for (const u of [assignedPract, otherPract]) {
      await admin.from('practitioners').delete().eq('id', u.id)
    }
    for (const u of [assignedPract, otherPract, member]) {
      await deleteTestUser(admin, u.id)
    }
  })

  it('assigned practitioner reads biological_sex via view', async () => {
    const client = await signInAs(assignedPract)
    const out = await getClientPersonalisation(client, member.id)
    expect(out?.biologicalSex).toBe('female')
  })

  it('unassigned practitioner gets null (view yields zero rows)', async () => {
    const client = await signInAs(otherPract)
    const out = await getClientPersonalisation(client, member.id)
    expect(out).toBeNull()
  })
})
