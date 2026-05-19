// PS.1 — user_personalisation: 12-scenario verification suite.
//
// The new table + view are not yet in the generated Database types (the
// generated types file is too large to regenerate via MCP in this workflow;
// production code uses the same `as 'profiles'` cast trick on the F2 view).
// For tests we wrap table access via small typed helpers that cast through
// `unknown`, isolating the cast in one place.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import type {
  BiologicalSex,
  Religion,
  ReligiousContentPreference,
  UserPersonalisation,
  PractitionerClientPersonalisation,
} from './types'
import { setClinicalNotesOnSex } from './setClinicalNotesOnSex'
import { createTestUser, deleteTestUser } from '../practitioners/__test-helpers__/createTestUser'
import { signInAs, anonClient }            from '../practitioners/__test-helpers__/signInAs'
import { assignWork }                       from '../practitioners/assignWork'

const HAVE_DB = !!process.env.NEXT_PUBLIC_SUPABASE_URL

function mkAdmin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    // service role passed via env in the real call below
  )
}

// Service-role admin for setup/verification (bypasses RLS).
function mkServiceRoleAdmin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ─── Untyped table accessors (one place for the type cast) ────────────────────
//
// The user_personalisation table and practitioner_client_personalisation view
// are not in the generated Database types. We expose them via a small set of
// helpers that take any SupabaseClient and return loosely-typed rows.

type UpRow = {
  user_id:                       string
  biological_sex:                'male' | 'female' | null
  religion:                      Religion
  religious_content_preference:  ReligiousContentPreference
  clinical_notes_on_sex:         string | null
  created_at:                    string
  updated_at:                    string
}

function up(c: SupabaseClient<Database>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (c as unknown as SupabaseClient<any>).from('user_personalisation')
}

function viewPcp(c: SupabaseClient<Database>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (c as unknown as SupabaseClient<any>).from('practitioner_client_personalisation')
}

// ─── Unit (always-run) ────────────────────────────────────────────────────────

describe('user_personalisation — type safety', () => {
  it('BiologicalSex union excludes invalid values at compile time', () => {
    const ok: BiologicalSex = 'female'
    expect(['male','female']).toContain(ok)
    // @ts-expect-error — 'other' is not a valid BiologicalSex
    const _bad: BiologicalSex = 'other'
    void _bad
  })

  it('Religion union accepts all 9 v1 values and rejects others', () => {
    const ok: Religion[] = [
      'muslim','christian','jewish','hindu','buddhist','sikh',
      'secular','prefer_not_to_say','other',
    ]
    expect(ok).toHaveLength(9)
    // @ts-expect-error — 'jedi' is not a valid Religion
    const _bad: Religion = 'jedi'
    void _bad
  })

  it('ReligiousContentPreference is show|hide', () => {
    const ok: ReligiousContentPreference = 'show'
    expect(['show','hide']).toContain(ok)
  })

  it('PractitionerClientPersonalisation excludes religion fields by type', () => {
    const row: PractitionerClientPersonalisation = {
      userId: 'u', biologicalSex: null, clinicalNotesOnSex: null, updatedAt: 't',
    }
    expect(row).toBeDefined()
    // @ts-expect-error — religion is not part of the practitioner view shape
    const _bad: PractitionerClientPersonalisation = { ...row, religion: 'muslim' }
    void _bad
  })

  it('UserPersonalisation requires religion and religious_content_preference (non-null)', () => {
    const row: UserPersonalisation = {
      userId: 'u',
      biologicalSex: null,
      religion: 'prefer_not_to_say',
      religiousContentPreference: 'hide',
      clinicalNotesOnSex: null,
      createdAt: 't', updatedAt: 't',
    }
    expect(row.religion).toBe('prefer_not_to_say')
  })
})

// suppress unused warning on mkAdmin (helper retained for parity with sibling tests)
void mkAdmin

// ─── Integration ──────────────────────────────────────────────────────────────

describe.skipIf(!HAVE_DB)('user_personalisation — integration', () => {
  let admin:          ReturnType<typeof mkServiceRoleAdmin>
  let assignedPract:  Awaited<ReturnType<typeof createTestUser>>
  let otherPract:     Awaited<ReturnType<typeof createTestUser>>
  let memberA:        Awaited<ReturnType<typeof createTestUser>>
  let memberB:        Awaited<ReturnType<typeof createTestUser>>
  let caseId:         string
  let workId:         string

  beforeAll(async () => {
    admin         = mkServiceRoleAdmin()
    assignedPract = await createTestUser(admin, 'ps1-pract-assigned')
    otherPract    = await createTestUser(admin, 'ps1-pract-other')
    memberA       = await createTestUser(admin, 'ps1-member-a')
    memberB       = await createTestUser(admin, 'ps1-member-b')

    for (const u of [assignedPract, otherPract]) {
      await admin.from('practitioners').insert({
        id: u.id, display_name: `Test ${u.email}`, status: 'active',
      })
    }

    const { data: c } = await admin
      .from('client_cases')
      .insert({ client_id: memberA.id, primary_concern: 'Test concern' })
      .select('id')
      .single()
    caseId = c!.id

    workId = await assignWork(admin, {
      caseId,
      practitionerId: assignedPract.id,
      workType:       'case_review',
      assignedBy:     assignedPract.id,
    })
  })

  afterAll(async () => {
    await admin.from('case_practitioner_work').delete().eq('id', workId)
    await admin.from('client_cases').delete().eq('id', caseId)
    for (const u of [assignedPract, otherPract]) {
      await admin.from('practitioners').delete().eq('id', u.id)
    }
    for (const u of [assignedPract, otherPract, memberA, memberB]) {
      await deleteTestUser(admin, u.id)
    }
    // user_personalisation rows cascade via FK from profiles deletion in deleteTestUser
  })

  // SMOKE-1: handle_new_user trigger created personalisation row for each new auth user
  it('handle_new_user() created a personalisation row for new auth users', async () => {
    const { data } = await up(admin)
      .select('user_id, religion, religious_content_preference, biological_sex')
      .in('user_id', [memberA.id, memberB.id, assignedPract.id, otherPract.id])
    const rows = (data ?? []) as Array<Pick<UpRow,'user_id'|'religion'|'religious_content_preference'|'biological_sex'>>
    expect(rows.length).toBe(4)
    for (const row of rows) {
      expect(row.religion).toBe('prefer_not_to_say')
      expect(row.religious_content_preference).toBe('hide')
      expect(row.biological_sex).toBeNull()
    }
  })

  // SMOKE-2: RLS positive — client reads own row
  it('RLS positive: member can SELECT own row', async () => {
    const client = await signInAs(memberA)
    const { data, error } = await up(client)
      .select('user_id, religion')
      .eq('user_id', memberA.id)
      .maybeSingle()
    expect(error).toBeNull()
    expect((data as Pick<UpRow,'user_id'> | null)?.user_id).toBe(memberA.id)
  })

  // SMOKE-3: RLS negative — client cannot read another user's row
  it('RLS negative: member cannot SELECT another user\'s row', async () => {
    const client = await signInAs(memberA)
    const { data } = await up(client)
      .select('user_id')
      .eq('user_id', memberB.id)
    expect(data).toEqual([])
  })

  // SMOKE-4: RLS negative — anonymous cannot read the table
  it('RLS negative: anonymous client sees zero rows', async () => {
    const anon = anonClient()
    const { data } = await up(anon).select('user_id')
    expect(data).toEqual([])
  })

  // SMOKE-5: RLS positive — client UPDATEs own row
  it('RLS positive: member can UPDATE own row (religion + preference)', async () => {
    const client = await signInAs(memberA)
    const { error } = await up(client)
      .update({ religion: 'muslim', religious_content_preference: 'show' })
      .eq('user_id', memberA.id)
    expect(error).toBeNull()

    const { data } = await up(admin)
      .select('religion, religious_content_preference')
      .eq('user_id', memberA.id)
      .maybeSingle()
    const row = data as Pick<UpRow,'religion'|'religious_content_preference'> | null
    expect(row?.religion).toBe('muslim')
    expect(row?.religious_content_preference).toBe('show')
  })

  // SMOKE-6: View positive — assigned practitioner reads view row for assigned client
  it('View positive: assigned practitioner can SELECT from practitioner_client_personalisation', async () => {
    const client = await signInAs(assignedPract)
    const { data, error } = await viewPcp(client)
      .select('user_id, biological_sex, clinical_notes_on_sex, updated_at')
      .eq('user_id', memberA.id)
    expect(error).toBeNull()
    const rows = (data ?? []) as Array<{ user_id: string }>
    expect(rows.length).toBe(1)
    expect(rows[0]?.user_id).toBe(memberA.id)
  })

  // SMOKE-7: View negative — unassigned practitioner sees zero rows
  it('View negative: unassigned practitioner sees zero rows', async () => {
    const client = await signInAs(otherPract)
    const { data } = await viewPcp(client).select('user_id')
    const rows = (data ?? []) as Array<{ user_id: string }>
    const found = rows.filter(r => [memberA.id, memberB.id].includes(r.user_id))
    expect(found).toEqual([])
  })

  // SMOKE-8: View column scope — religion + preference NOT visible (hard assertion)
  it('View column scope: religion and religious_content_preference are absent', async () => {
    // information_schema check via the loose-typed admin client
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const loose = (admin as unknown as SupabaseClient<any>)
    const { data } = await loose
      .schema('information_schema')
      .from('columns')
      .select('column_name')
      .eq('table_schema', 'public')
      .eq('table_name',   'practitioner_client_personalisation')
    const cols = ((data ?? []) as Array<{ column_name: string }>).map(r => r.column_name).sort()
    expect(cols).toEqual(['biological_sex','clinical_notes_on_sex','updated_at','user_id'])
    expect(cols).not.toContain('religion')
    expect(cols).not.toContain('religious_content_preference')
  })

  // SMOKE-9: RPC positive — assigned practitioner updates clinical_notes_on_sex
  // SMOKE-11 (folded in): RPC did NOT modify religion or religious_content_preference
  it('RPC positive: assigned practitioner can set clinical_notes_on_sex; religion + preference untouched', async () => {
    const client = await signInAs(assignedPract)
    await setClinicalNotesOnSex(client, memberA.id, 'Trans female, on estradiol 4y.')
    const { data } = await up(admin)
      .select('clinical_notes_on_sex, religion, religious_content_preference')
      .eq('user_id', memberA.id)
      .maybeSingle()
    const row = data as Pick<UpRow,'clinical_notes_on_sex'|'religion'|'religious_content_preference'> | null
    expect(row?.clinical_notes_on_sex).toBe('Trans female, on estradiol 4y.')
    expect(row?.religion).toBe('muslim')               // from SMOKE-5 — RPC must not touch this
    expect(row?.religious_content_preference).toBe('show')
  })

  // SMOKE-10: RPC negative — unassigned practitioner gets exception
  it('RPC negative: unassigned practitioner is rejected with auth error', async () => {
    const client = await signInAs(otherPract)
    await expect(setClinicalNotesOnSex(client, memberA.id, 'attack'))
      .rejects.toThrow(/Not authorised/)
  })

  // SMOKE-12: RPC negative — anonymous caller rejected
  it('RPC negative: anonymous caller is rejected with Authentication required', async () => {
    const anon = anonClient()
    await expect(setClinicalNotesOnSex(anon, memberA.id, 'attack'))
      .rejects.toThrow(/Authentication required/)
  })

  // SMOKE-13: RPC creates row on first call if none exists (ON CONFLICT pathway)
  it('RPC handles missing row via ON CONFLICT (upsert path)', async () => {
    // Delete memberB's row to simulate the missing-row case
    await up(admin).delete().eq('user_id', memberB.id)

    // Give assignedPract work on a case for memberB so authorisation passes
    const { data: cB } = await admin
      .from('client_cases')
      .insert({ client_id: memberB.id, primary_concern: 'B' })
      .select('id').single()
    const wB = await assignWork(admin, {
      caseId: cB!.id, practitionerId: assignedPract.id, workType: 'case_review', assignedBy: assignedPract.id,
    })

    const client = await signInAs(assignedPract)
    await setClinicalNotesOnSex(client, memberB.id, 'New row note')

    const { data } = await up(admin)
      .select('user_id, religion, religious_content_preference, clinical_notes_on_sex')
      .eq('user_id', memberB.id)
      .maybeSingle()
    const row = data as Pick<UpRow,'user_id'|'religion'|'religious_content_preference'|'clinical_notes_on_sex'> | null
    expect(row?.user_id).toBe(memberB.id)
    expect(row?.clinical_notes_on_sex).toBe('New row note')
    expect(row?.religion).toBe('prefer_not_to_say')               // defaults from CREATE TABLE
    expect(row?.religious_content_preference).toBe('hide')

    // Cleanup the extra case+work
    await admin.from('case_practitioner_work').delete().eq('id', wB)
    await admin.from('client_cases').delete().eq('id', cB!.id)
  })

  // SMOKE-14: updated_at trigger bumps on UPDATE
  it('Trigger: UPDATE bumps updated_at', async () => {
    const { data: beforeData } = await up(admin)
      .select('updated_at')
      .eq('user_id', memberA.id)
      .maybeSingle()
    const beforeRow = beforeData as { updated_at: string } | null
    expect(beforeRow?.updated_at).toBeTruthy()
    const beforeT = new Date(beforeRow!.updated_at).getTime()

    await new Promise(r => setTimeout(r, 50))

    await up(admin)
      .update({ religion: 'jewish' })
      .eq('user_id', memberA.id)

    const { data: afterData } = await up(admin)
      .select('updated_at')
      .eq('user_id', memberA.id)
      .maybeSingle()
    const afterRow = afterData as { updated_at: string } | null
    const afterT = new Date(afterRow!.updated_at).getTime()
    expect(afterT).toBeGreaterThan(beforeT)
  })
})
