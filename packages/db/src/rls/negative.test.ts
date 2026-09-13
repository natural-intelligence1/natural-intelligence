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
      .insert({ case_id: caseId, practitioner_id: pract.id, work_type: 'case_review', status: 'cancelled', assignment_source: 'admin', assigned_by: pract.id } as never)
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

// ─── Agreement acceptance is RPC-only (overnight hardening) ──────────────────
// SELF-SKIP until migration 0051 is applied (table probe fails pre-migration).
// Proves: practitioners cannot INSERT acceptance rows directly, the gate
// function fails closed before acceptance, and the acceptance RPC rejects a
// stale displayed agreement id (version/text mismatch protection).
describe.skipIf(!HAVE_DB)('negative RLS — agreement acceptance is RPC-only', () => {
  let admin: ReturnType<typeof mkAdmin>
  let pract: Awaited<ReturnType<typeof createTestUser>>
  let tableExists = false

  beforeAll(async () => {
    admin = mkAdmin()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const probe = await (admin as any).from('practitioner_agreement_acceptances').select('id').limit(1)
    tableExists = !probe.error
    if (!tableExists) return
    pract = await createTestUser(admin, 's3-agr-pract')
    await admin.from('practitioners').insert({
      id: pract.id, display_name: `Test ${pract.email}`, status: 'active',
    } as never)
  })

  afterAll(async () => {
    if (!tableExists) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('practitioner_agreement_acceptances').delete().eq('practitioner_id', pract.id)
    await admin.from('practitioners').delete().eq('id', pract.id)
    await deleteTestUser(admin, pract.id)
  })

  it('a practitioner cannot INSERT an acceptance row directly', async (ctx) => {
    if (!tableExists) return ctx.skip()
    const p = await signInAs(pract)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (p as any).from('practitioner_agreement_acceptances').insert({
      practitioner_id: pract.id,
      agreement_id: '00000000-0000-0000-0000-000000000000',
      agreement_version: 'forged', accepted_text_hash: 'forged',
    })
    expect(error).not.toBeNull()
  })

  it('the gate reports NOT accepted before any acceptance', async (ctx) => {
    if (!tableExists) return ctx.skip()
    const p = await signInAs(pract)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (p as any).rpc('has_accepted_current_agreement')
    expect(error).toBeNull()
    expect(data).toBe(false)
  })

  it('the acceptance RPC rejects a stale/unknown displayed agreement id', async (ctx) => {
    if (!tableExists) return ctx.skip()
    const p = await signInAs(pract)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (p as any).rpc('accept_current_agreement', {
      p_expected_agreement_id: '00000000-0000-0000-0000-000000000000',
    })
    expect(error).not.toBeNull()
  })

  it('agreement text/version is IMMUTABLE at the DB level; is_current is not (PA-pass polish, item 2)', async (ctx) => {
    if (!tableExists) return ctx.skip()
    // Throwaway non-current synthetic agreement row (never promoted, so the
    // one-current-per-category index is untouched); removed at the end.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row, error: insErr } = await (admin as any).from('practitioner_agreements')
      .insert({
        category: 'unregistered', version: `immut-test-${Date.now()}`,
        title: 'Synthetic immutability probe', body: 'synthetic body — is_test_data',
        is_current: false,
      })
      .select('id').single()
    expect(insErr).toBeNull()
    try {
      // Changing body in place must be refused by the trigger — even for the
      // service-role client.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: bodyErr } = await (admin as any).from('practitioner_agreements')
        .update({ body: 'tampered wording' }).eq('id', row.id)
      expect(bodyErr).not.toBeNull()
      expect(bodyErr!.message).toMatch(/immutable/)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: verErr } = await (admin as any).from('practitioner_agreements')
        .update({ version: 'tampered-version' }).eq('id', row.id)
      expect(verErr).not.toBeNull()
      // is_current alone (promotion/demotion path) passes the trigger.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: curErr } = await (admin as any).from('practitioner_agreements')
        .update({ is_current: false }).eq('id', row.id)
      expect(curErr).toBeNull()
      // And the text is untouched.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: check } = await (admin as any).from('practitioner_agreements')
        .select('body').eq('id', row.id).single()
      expect(check?.body).toBe('synthetic body — is_test_data')
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any).from('practitioner_agreements').delete().eq('id', row.id)
    }
  })
})

// ─── client_cases exposure closed (final review, item 3) ─────────────────────
// SELF-SKIP until migration 0052 is applied (probe: practitioner_case_index
// view exists). Once applied, proves: practitioners cannot SELECT client_cases
// directly at all; the index view exposes no client_id/primary_concern; and
// cancelled work grants nothing through the view.
describe.skipIf(!HAVE_DB)('negative RLS — client_cases closed to practitioners (0052)', () => {
  let admin: ReturnType<typeof mkAdmin>
  let member: Awaited<ReturnType<typeof createTestUser>>
  let pract: Awaited<ReturnType<typeof createTestUser>>
  let caseId: string | null = null
  let workId: string | null = null
  let viewExists = false

  beforeAll(async () => {
    admin = mkAdmin()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const probe = await (admin as any).from('practitioner_case_index').select('id').limit(1)
    viewExists = !probe.error
    if (!viewExists) return
    member = await createTestUser(admin, 's3-cc-member')
    pract  = await createTestUser(admin, 's3-cc-pract')
    await admin.from('practitioners').insert({
      id: pract.id, display_name: `Test ${pract.email}`, status: 'active',
    } as never)
    const { data: c } = await admin.from('client_cases')
      .insert({ client_id: member.id, status: 'active', primary_concern: 'synthetic concern text' } as never)
      .select('id').single()
    caseId = (c as { id: string } | null)?.id ?? null
    if (!caseId) return
    const { data: w } = await admin.from('case_practitioner_work')
      .insert({ case_id: caseId, practitioner_id: pract.id, work_type: 'case_review', status: 'assigned', assignment_source: 'admin', assigned_by: pract.id } as never)
      .select('id').single()
    workId = (w as { id: string } | null)?.id ?? null
  })

  afterAll(async () => {
    if (!viewExists) return
    if (workId) await admin.from('case_practitioner_work').delete().eq('id', workId)
    if (caseId) await admin.from('client_cases').delete().eq('id', caseId)
    if (pract)  { await admin.from('practitioners').delete().eq('id', pract.id); await deleteTestUser(admin, pract.id) }
    if (member) await deleteTestUser(admin, member.id)
  })

  it('a practitioner with ACTIVE work still cannot SELECT client_cases directly', async (ctx) => {
    if (!viewExists || !caseId) return ctx.skip()
    const p = await signInAs(pract)
    const { data } = await p.from('client_cases').select('id, primary_concern').eq('id', caseId)
    expect(data ?? []).toHaveLength(0)
  })

  it('the case index view serves operational fields for active work', async (ctx) => {
    if (!viewExists || !caseId) return ctx.skip()
    const p = await signInAs(pract)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (p as any).from('practitioner_case_index').select('id, status').eq('id', caseId)
    expect((data ?? []).length).toBe(1)
  })

  it('the view refuses client_id and primary_concern (columns absent)', async (ctx) => {
    if (!viewExists || !caseId) return ctx.skip()
    const p = await signInAs(pract)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: e1 } = await (p as any).from('practitioner_case_index').select('client_id').eq('id', caseId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: e2 } = await (p as any).from('practitioner_case_index').select('primary_concern').eq('id', caseId)
    expect(e1).not.toBeNull()
    expect(e2).not.toBeNull()
  })

  it('an ACTIVE work item grants NO identity via practitioner_client_identity (PA-pass polish, item 1)', async (ctx) => {
    if (!viewExists || !caseId) return ctx.skip() // 0052 also narrows the identity view
    const p = await signInAs(pract)
    const { data } = await p
      .from('practitioner_client_identity' as 'profiles')
      .select('id, full_name')
      .eq('id', member.id)
    expect(data ?? []).toHaveLength(0)
  })

  it('COMPLETED work grants nothing through the view (final hardening, item 4)', async (ctx) => {
    if (!viewExists || !caseId || !workId) return ctx.skip()
    await admin.from('case_practitioner_work')
      .update({ status: 'completed', completed_at: new Date().toISOString() } as never)
      .eq('id', workId)
    const p = await signInAs(pract)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (p as any).from('practitioner_case_index').select('id').eq('id', caseId)
    expect(data ?? []).toHaveLength(0)
  })

  it('CANCELLED work grants nothing through the view', async (ctx) => {
    if (!viewExists || !caseId || !workId) return ctx.skip()
    await admin.from('case_practitioner_work').update({ status: 'cancelled' } as never).eq('id', workId)
    const p = await signInAs(pract)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (p as any).from('practitioner_case_index').select('id').eq('id', caseId)
    expect(data ?? []).toHaveLength(0)
  })
})
