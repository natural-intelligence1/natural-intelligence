// Lead Responsible Practitioner governance — LIVE database enforcement.
//
// SYNTHETIC DATA ONLY, tagged LG60-TEST, self-cleaning. No real practitioner
// is read or written. Skips when no DB env is present.
//
// Covers two complementary database guards:
//
//   0057  enforce_case_team_role_rules()           on case_team_roles
//         validates the practitioner's class WHEN A ROLE IS WRITTEN.
//   0060  enforce_practitioner_class_vs_lead_role() on practitioners
//         validates active roles WHEN THE CLASS IS WRITTEN.
//
// Neither alone is sufficient: 0057 cannot see a later class change, and 0060
// cannot see a role being created. Together "Category 3 + active Lead" is
// unreachable from either direction, which is what these tests assert.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import { createTestUser, deleteTestUser } from './__test-helpers__/createTestUser'

const HAVE_DB = !!process.env.NEXT_PUBLIC_SUPABASE_URL
function mkAdmin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

const TAG = 'LG60-TEST'
type Cat = 'regulated_healthcare_professional' | 'accredited_practitioner' | 'ni_verified_practitioner'

describe.skipIf(!HAVE_DB)('Lead governance — live DB enforcement', () => {
  let admin: ReturnType<typeof mkAdmin>
  const users: { id: string }[] = []
  let caseId = ''
  let agreementIds: string[] = []

  /** A practitioner row that passes practitioner_assignment_eligibility(). */
  const row = (id: string, name: string, category: Cat) => ({
    id, display_name: `${TAG} ${name}`, status: 'active', is_active: true,
    category,
    credentials_verification_status: 'verified',
    indemnity_required: false,
    scope_status: 'approved',
    registration_number: category === 'ni_verified_practitioner' ? null : `${TAG}-REG`,
    registration_body: category === 'ni_verified_practitioner' ? null : `${TAG} Body`,
    registration_status: category === 'ni_verified_practitioner' ? null : 'registered',
    specialisations: [], credentials: [], primary_professions: [], area_tags: [],
    client_types: [], collaboration_types: [],
    accepts_referrals: false, open_to_collaboration: false,
    practitioner_tier: 'standard', display_order: 0, profile_completeness_pct: 0,
    is_directory_ready: false, is_test_data: true, trust_level: 'vetted' as const,
  })

  const mkPractitioner = async (name: string, category: Cat) => {
    const u = await createTestUser(admin, `lg60-${name.toLowerCase()}`)
    users.push(u)
    const { error } = await admin.from('practitioners').insert(row(u.id, name, category) as never)
    if (error) throw error
    // Eligibility also needs a current agreement for the class, accepted with
    // a matching body hash. Synthetic, tagged, removed in cleanup.
    const body = `${TAG} synthetic agreement for ${category} — NOT A REAL AGREEMENT`
    const { data: agr } = await admin.from('practitioner_agreements')
      .upsert({ category, version: `${TAG}-999`,
                title: `${TAG} SYNTHETIC — NOT A REAL AGREEMENT`, body, is_current: true } as never,
              { onConflict: 'category,version' })
      .select('id').single()
    const agreementId = (agr as { id: string } | null)?.id
    if (agreementId) {
      if (!agreementIds.includes(agreementId)) agreementIds.push(agreementId)
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body))
      const hex = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0')).join('')
      await admin.from('practitioner_agreement_acceptances').insert({
        practitioner_id: u.id, agreement_id: agreementId,
        agreement_version: `${TAG}-999`, accepted_text_hash: hex,
      } as never)
    }
    return u.id
  }

  // assigned_by is NOT NULL and references auth.users — in production only an
  // admin creates assignments, so the synthetic admin user stands in here.
  let assignedBy = ''

  const assignRole = (practitionerId: string, team_role: string, supervisor_id?: string) =>
    admin.from('case_team_roles')
      .insert({ case_id: caseId, practitioner_id: practitionerId, team_role,
                assigned_by: assignedBy,
                ...(supervisor_id ? { supervisor_id } : {}) } as never)
      .select('id').maybeSingle()

  let cat1 = '', cat2 = '', cat3 = ''

  beforeAll(async () => {
    admin = mkAdmin()
    const client = await createTestUser(admin, 'lg60-client')
    users.push(client)
    const assigner = await createTestUser(admin, 'lg60-assigner')
    users.push(assigner)
    assignedBy = assigner.id
    const { data: kase, error } = await admin.from('client_cases').insert({
      client_id: client.id, status: 'active', case_complexity_score: 0,
      escalation_required: false,
    } as never).select('id').single()
    if (error) throw error
    caseId = (kase as { id: string }).id

    cat1 = await mkPractitioner('Cat1', 'regulated_healthcare_professional')
    cat2 = await mkPractitioner('Cat2', 'accredited_practitioner')
    cat3 = await mkPractitioner('Cat3', 'ni_verified_practitioner')
  })

  afterAll(async () => {
    if (!admin) return
    if (caseId) {
      await admin.from('case_team_roles').delete().eq('case_id', caseId)
      await admin.from('client_cases').delete().eq('id', caseId)
    }
    const ids = users.map((u) => u.id)
    await admin.from('practitioner_agreement_acceptances').delete().in('practitioner_id', ids)
    await admin.from('practitioners').delete().in('id', ids)
    for (const id of agreementIds) {
      await admin.from('practitioner_agreements').delete().eq('id', id)
    }
    for (const u of users) await deleteTestUser(admin, u.id)
  })

  // ─── 0057: class validated when the role is written ──────────────────────

  it('A. an eligible Category 1 practitioner CAN be assigned Lead', async () => {
    const { data, error } = await assignRole(cat1, 'lead')
    expect(error).toBeNull()
    expect(data).not.toBeNull()
    await admin.from('case_team_roles').delete().eq('practitioner_id', cat1)
  })

  it('B. an eligible Category 2 practitioner CAN be assigned Lead', async () => {
    const { data, error } = await assignRole(cat2, 'lead')
    expect(error).toBeNull()
    expect(data).not.toBeNull()
    await admin.from('case_team_roles').delete().eq('practitioner_id', cat2)
  })

  it('C. a Category 3 practitioner CANNOT be assigned Lead (insert)', async () => {
    const { error } = await assignRole(cat3, 'lead')
    expect(error).not.toBeNull()
    expect(`${error?.message}`).toMatch(/Category 3|NI Verified/i)
  })

  it('D. a Category 3 practitioner CAN hold an ordinary care_team role', async () => {
    const { data, error } = await assignRole(cat3, 'care_team')
    expect(error).toBeNull()
    expect(data).not.toBeNull()
  })

  it('E. promoting an existing Category 3 care_team row to lead is also refused (UPDATE)', async () => {
    const { data: existing } = await admin.from('case_team_roles')
      .select('id').eq('practitioner_id', cat3).eq('team_role', 'care_team').maybeSingle()
    expect(existing).not.toBeNull()

    const { error } = await admin.from('case_team_roles')
      .update({ team_role: 'lead' } as never).eq('id', (existing as { id: string }).id)
    expect(error).not.toBeNull()
    expect(`${error?.message}`).toMatch(/Category 3|NI Verified/i)
  })

  it('F. only one active Lead per case', async () => {
    const { error: first } = await assignRole(cat1, 'lead')
    expect(first).toBeNull()

    const { error: second } = await assignRole(cat2, 'lead')
    expect(second).not.toBeNull()
    expect(`${second?.message}`).toMatch(/uniq_active_lead_per_case|duplicate key/i)
  })

  it('G. a student cannot be a lead — the roles are mutually exclusive values', async () => {
    // 'student' and 'lead' are two values of one column, so a row can never be
    // both. A student row additionally requires an active non-student
    // supervisor on the same case.
    const { error: noSupervisor } = await assignRole(cat2, 'student')
    expect(noSupervisor).not.toBeNull()
    expect(`${noSupervisor?.message}`).toMatch(/supervisor/i)
  })

  // ─── 0060: active roles validated when the class is written ──────────────

  it('H. a practitioner holding an active Lead CANNOT be demoted to Category 3', async () => {
    // cat1 is the active Lead from test F.
    const { error } = await admin.from('practitioners')
      .update({ category: 'ni_verified_practitioner' } as never).eq('id', cat1)
    expect(error).not.toBeNull()
    expect(`${error?.message}`).toMatch(/active Lead Responsible Practitioner|End or reassign/i)

    const { data: after } = await admin.from('practitioners')
      .select('category').eq('id', cat1).single()
    expect(after!.category).toBe('regulated_healthcare_professional')   // unchanged
  })

  it('I. an unrelated practitioner update is unaffected by the guard', async () => {
    const { error } = await admin.from('practitioners')
      .update({ display_name: `${TAG} Cat1 renamed` } as never).eq('id', cat1)
    expect(error).toBeNull()
  })

  it('J. demotion to Category 3 is allowed once the Lead role has ended', async () => {
    const { error: end } = await admin.from('case_team_roles')
      .update({ ended_at: new Date().toISOString() } as never)
      .eq('practitioner_id', cat1).eq('team_role', 'lead')
    expect(end).toBeNull()

    const { error } = await admin.from('practitioners')
      .update({ category: 'ni_verified_practitioner' } as never).eq('id', cat1)
    expect(error).toBeNull()

    // Restore so the forward guard is exercised consistently.
    await admin.from('practitioners')
      .update({ category: 'regulated_healthcare_professional' } as never).eq('id', cat1)
  })

  it('K. demotion is allowed for a care_team member who is not a Lead', async () => {
    const { error } = await admin.from('practitioners')
      .update({ category: 'ni_verified_practitioner' } as never).eq('id', cat2)
    expect(error).toBeNull()
    await admin.from('practitioners')
      .update({ category: 'accredited_practitioner' } as never).eq('id', cat2)
  })

  it('L. the invalid state does not exist anywhere after all of the above', async () => {
    const { data } = await admin.from('case_team_roles')
      .select('id, practitioner_id, team_role, ended_at')
      .eq('case_id', caseId).eq('team_role', 'lead').is('ended_at', null)

    for (const r of data ?? []) {
      const { data: p } = await admin.from('practitioners')
        .select('category').eq('id', r.practitioner_id).single()
      expect(p!.category).not.toBe('ni_verified_practitioner')
    }
  })
})
