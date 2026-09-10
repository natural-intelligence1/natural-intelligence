// Sprint 3 — NEGATIVE RLS tests: prove cross-member and unauthorised
// practitioner access is denied by the EXISTING policies. SYNTHETIC DATA ONLY
// (createTestUser fixtures, is_test_data, self-cleaning). Skip when no DB env.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import { createTestUser, deleteTestUser } from '../practitioners/__test-helpers__/createTestUser'
import { signInAs } from '../practitioners/__test-helpers__/signInAs'

const HAVE_DB = !!process.env.NEXT_PUBLIC_SUPABASE_URL
function mkAdmin() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

describe.skipIf(!HAVE_DB)('negative RLS — cross-member and unauthorised practitioner access', () => {
  let admin: ReturnType<typeof mkAdmin>
  let memberA: Awaited<ReturnType<typeof createTestUser>>
  let memberB: Awaited<ReturnType<typeof createTestUser>>
  let strangerPract: Awaited<ReturnType<typeof createTestUser>>

  beforeAll(async () => {
    admin = mkAdmin()
    memberA = await createTestUser(admin, 's3-rls-member-a')
    memberB = await createTestUser(admin, 's3-rls-member-b')
    strangerPract = await createTestUser(admin, 's3-rls-stranger-pract')
    // stranger is a real practitioner row but has NO work item for member A
    await admin.from('practitioners').insert({
      id: strangerPract.id, display_name: `Test ${strangerPract.email}`, status: 'active',
    })
    // seed synthetic rows AS member A (member insert path is the by-design own-row write)
    const a = await signInAs(memberA)
    await a.from('intake_responses').insert({ member_id: memberA.id, completed_sections: 1 })
    await a.from('lifetracker_goals').insert({ member_id: memberA.id, description: 'synthetic goal', status: 'active' } as never)
  })

  afterAll(async () => {
    await admin.from('intake_responses').delete().eq('member_id', memberA.id)
    await admin.from('lifetracker_goals').delete().eq('member_id', memberA.id)
    await admin.from('practitioners').delete().eq('id', strangerPract.id)
    await deleteTestUser(admin, memberA.id)
    await deleteTestUser(admin, memberB.id)
    await deleteTestUser(admin, strangerPract.id)
  })

  it('member B cannot read member A intake_responses', async () => {
    const b = await signInAs(memberB)
    const { data } = await b.from('intake_responses').select('id').eq('member_id', memberA.id)
    expect(data ?? []).toHaveLength(0)
  })

  it('member B cannot update member A intake_responses', async () => {
    const b = await signInAs(memberB)
    const { data } = await b.from('intake_responses')
      .update({ completed_sections: 9 }).eq('member_id', memberA.id).select('id')
    expect(data ?? []).toHaveLength(0)
    const { data: check } = await admin.from('intake_responses')
      .select('completed_sections').eq('member_id', memberA.id).single()
    expect(check?.completed_sections).toBe(1)
  })

  it('member B cannot read member A lifetracker_goals (single-policy table)', async () => {
    const b = await signInAs(memberB)
    const { data } = await b.from('lifetracker_goals').select('id').eq('member_id', memberA.id)
    expect(data ?? []).toHaveLength(0)
  })

  it('member B cannot insert rows AS member A (spoofed member_id)', async () => {
    const b = await signInAs(memberB)
    const { error } = await b.from('lifetracker_goals')
      .insert({ member_id: memberA.id, description: 'spoofed', status: 'active' } as never)
    expect(error).not.toBeNull()
  })

  it('a practitioner with NO work item for member A cannot read their intake', async () => {
    const p = await signInAs(strangerPract)
    const { data } = await p.from('intake_responses').select('id').eq('member_id', memberA.id)
    expect(data ?? []).toHaveLength(0)
  })

  it('a practitioner with NO work item cannot read member A lab_reports', async () => {
    const p = await signInAs(strangerPract)
    const { data } = await p.from('lab_reports').select('id').eq('member_id', memberA.id)
    expect(data ?? []).toHaveLength(0)
  })

  it('an anonymous client reads nothing from intake_responses', async () => {
    const anon = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { data } = await anon.from('intake_responses').select('id').limit(5)
    expect(data ?? []).toHaveLength(0)
  })
})

// ─── Review-pack access vs work-item status (review amendment 7) ─────────────
// These tests exercise the 0051 policy "Practitioners read packs for their
// work" (active statuses only). They SELF-SKIP until migration 0051 is applied
// (the table probe fails pre-migration), then run as live negative tests.
describe.skipIf(!HAVE_DB)('negative RLS — review packs require an ACTIVE work item', () => {
  let admin: ReturnType<typeof mkAdmin>
  let member: Awaited<ReturnType<typeof createTestUser>>
  let pract: Awaited<ReturnType<typeof createTestUser>>
  let caseId: string | null = null
  let packId: string | null = null
  let workId: string | null = null
  let tableExists = false

  beforeAll(async () => {
    admin = mkAdmin()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const probe = await (admin as any).from('practitioner_review_packs').select('id').limit(1)
    tableExists = !probe.error
    if (!tableExists) return

    member = await createTestUser(admin, 's3-pack-member')
    pract  = await createTestUser(admin, 's3-pack-pract')
    await admin.from('practitioners').insert({ id: pract.id, display_name: `Test ${pract.email}`, status: 'active' })
    const { data: c } = await admin.from('client_cases')
      .insert({ client_id: member.id, status: 'active' } as never).select('id').single()
    caseId = (c as { id: string } | null)?.id ?? null
    if (!caseId) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: p } = await (admin as any).from('practitioner_review_packs')
      .insert({ case_id: caseId, pseudonym: 'NI-TEST01', pack: { synthetic: true } })
      .select('id').single()
    packId = p?.id ?? null
    // CANCELLED work item — must grant nothing
    const { data: w } = await admin.from('case_practitioner_work')
      .insert({ case_id: caseId, practitioner_id: pract.id, work_type: 'case_review', status: 'cancelled', assignment_source: 'admin' } as never)
      .select('id').single()
    workId = (w as { id: string } | null)?.id ?? null
  })

  afterAll(async () => {
    if (!tableExists) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (packId) await (admin as any).from('practitioner_review_packs').delete().eq('id', packId)
    if (workId) await admin.from('case_practitioner_work').delete().eq('id', workId)
    if (caseId) await admin.from('client_cases').delete().eq('id', caseId)
    if (pract)  { await admin.from('practitioners').delete().eq('id', pract.id); await deleteTestUser(admin, pract.id) }
    if (member) await deleteTestUser(admin, member.id)
  })

  it('a CANCELLED work item grants no pack access', async (ctx) => {
    if (!tableExists || !packId) return ctx.skip()
    const p = await signInAs(pract)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (p as any).from('practitioner_review_packs').select('id').eq('id', packId)
    expect(data ?? []).toHaveLength(0)
  })

  it('a DECLINED work item grants no pack access', async (ctx) => {
    if (!tableExists || !packId || !workId) return ctx.skip()
    await admin.from('case_practitioner_work').update({ status: 'declined' } as never).eq('id', workId)
    const p = await signInAs(pract)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (p as any).from('practitioner_review_packs').select('id').eq('id', packId)
    expect(data ?? []).toHaveLength(0)
  })

  it('an ASSIGNED work item DOES grant pack access (positive control)', async (ctx) => {
    if (!tableExists || !packId || !workId) return ctx.skip()
    await admin.from('case_practitioner_work').update({ status: 'assigned' } as never).eq('id', workId)
    const p = await signInAs(pract)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (p as any).from('practitioner_review_packs').select('id, pseudonym, pack').eq('id', packId)
    expect(data ?? []).toHaveLength(1)
  })

  it('practitioners can never read review_pack_audit', async (ctx) => {
    if (!tableExists) return ctx.skip()
    const p = await signInAs(pract)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (p as any).from('review_pack_audit').select('pack_id').limit(5)
    expect(data ?? []).toHaveLength(0)
  })
})
