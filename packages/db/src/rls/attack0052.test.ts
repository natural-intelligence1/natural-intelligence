// ─── SPRINT 5 — post-0052 DATABASE ATTACK MATRIX (A–J) ────────────────────────
// Real DB identities (synthetic auth users), no UI, no mocks. ARMED on the
// existence of practitioner_case_index (0052); self-skips before that.
// Practitioner P holds ACTIVE work on member M's case and STILL must fail
// every identified read — the approved pack + minimal case index are the
// ONLY surfaces that answer.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import { createTestUser, deleteTestUser } from '../practitioners/__test-helpers__/createTestUser'
import { signInAs } from '../practitioners/__test-helpers__/signInAs'
import { makePractitionerAssignable } from '../practitioners/__test-helpers__/makeAssignable'
import { generateAndStoreReviewPack } from '../practitioners/reviewPackAccess'

const HAVE_DB = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY
function mkAdmin() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

describe.skipIf(!HAVE_DB)('SPRINT 5 — post-0052 attack matrix (armed)', () => {
  const admin = HAVE_DB ? mkAdmin() : (null as never)
  let armed = false
  let memberA: Awaited<ReturnType<typeof createTestUser>> | null = null
  let memberB: Awaited<ReturnType<typeof createTestUser>> | null = null
  let practP: Awaited<ReturnType<typeof createTestUser>> | null = null
  let caseA: string | null = null
  let caseB: string | null = null
  let packAId: string | null = null
  let packBId: string | null = null
  let workAId: string | null = null
  let cleanupAssignable: (() => Promise<void>) | null = null

  beforeAll(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const probe = await (admin as any).from('practitioner_case_index').select('id').limit(1)
    armed = !probe.error
    if (!armed) return

    memberA = await createTestUser(admin, 's5-atk-member-a')
    memberB = await createTestUser(admin, 's5-atk-member-b')
    practP = await createTestUser(admin, 's5-atk-pract')
    await admin.from('practitioners').insert({ id: practP.id, display_name: `Test ${practP.email}`, status: 'active' } as never)
    cleanupAssignable = await makePractitionerAssignable(admin, practP.id)

    for (const m of [memberA, memberB]) {
      await admin.from('consent_records').insert({
        profile_id: m.id, email: m.email, consent_type: 'deidentified_synopsis_sharing',
        consented: true, consented_at: new Date().toISOString(), consent_version: 's3-draft-2',
        source: 's5-attack', actor: 'member',
      } as never)
      await admin.from('intake_responses').insert({
        member_id: m.id, is_complete: true, completed_sections: 9,
        arrival_emotion: 'hopeful', primary_concerns: ['fatigue'], primary_system: 'digestive',
        stress_level: 3, sleep_quality: 3, energy_level: 3,
        current_medications: 'synthetic med', current_supplements: 'synthetic supp',
        symptom_onset: 'about a year ago', diagnosed_conditions: ['synthetic condition'],
      } as never)
    }

    const { data: cA } = await admin.from('client_cases')
      .insert({ client_id: memberA.id, status: 'active', primary_concern: 'synthetic concern A' } as never).select('id').single()
    caseA = (cA as { id: string } | null)?.id ?? null
    const { data: cB } = await admin.from('client_cases')
      .insert({ client_id: memberB.id, status: 'active', primary_concern: 'synthetic concern B' } as never).select('id').single()
    caseB = (cB as { id: string } | null)?.id ?? null

    // P holds ACTIVE work on case A only.
    const { data: w } = await admin.from('case_practitioner_work').insert({
      case_id: caseA!, practitioner_id: practP.id, work_type: 'case_review',
      status: 'assigned', assignment_source: 'admin', assigned_by: practP.id,
    } as never).select('id').single()
    workAId = (w as { id: string } | null)?.id ?? null

    packAId = (await generateAndStoreReviewPack(admin, caseA!, practP.id)).packId
    packBId = (await generateAndStoreReviewPack(admin, caseB!, practP.id)).packId
  }, 120_000)

  afterAll(async () => {
    if (!armed) return
    for (const packId of [packAId, packBId]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (packId) await (admin as any).from('review_pack_audit').delete().eq('pack_id', packId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (packId) await (admin as any).from('practitioner_review_packs').delete().eq('id', packId)
    }
    if (workAId) await admin.from('case_practitioner_work').delete().eq('id', workAId)
    for (const caseId of [caseA, caseB]) if (caseId) await admin.from('client_cases').delete().eq('id', caseId)
    for (const m of [memberA, memberB]) if (m) {
      await admin.from('intake_responses').delete().eq('member_id', m.id)
      await admin.from('consent_records').delete().eq('profile_id', m.id)
    }
    if (cleanupAssignable) await cleanupAssignable()
    if (practP) { await admin.from('practitioners').delete().eq('id', practP.id); await deleteTestUser(admin, practP.id) }
    for (const m of [memberA, memberB]) if (m) await deleteTestUser(admin, m.id)
  }, 120_000)

  it('A/G: practitioner with ACTIVE work gets ZERO rows from every raw source table (direct query bypass)', async (ctx) => {
    if (!armed) return ctx.skip()
    const p = await signInAs(practP!)
    for (const table of ['intake_responses', 'intake_answers', 'lab_reports', 'biomarker_results', 'biomarker_trajectory'] as const) {
      const { data } = await p.from(table).select('id').eq('member_id', memberA!.id)
      expect(data ?? [], `raw read leaked: ${table}`).toHaveLength(0)
    }
  })

  it('B: identified profile/personalisation reads outside the approved path return nothing', async (ctx) => {
    if (!armed) return ctx.skip()
    const p = await signInAs(practP!)
    const { data: profile } = await p.from('profiles').select('full_name').eq('id', memberA!.id)
    expect(profile ?? []).toHaveLength(0)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: identity } = await (p as any).from('practitioner_client_identity').select('full_name').eq('id', memberA!.id)
    expect(identity ?? []).toHaveLength(0)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: personalisation } = await (p as any).from('practitioner_client_personalisation').select('biological_sex').eq('user_id', memberA!.id)
    expect(personalisation ?? []).toHaveLength(0)
  })

  it('C: practitioner direct client_cases SELECT returns ZERO rows even for their own active case', async (ctx) => {
    if (!armed) return ctx.skip()
    const p = await signInAs(practP!)
    const { data } = await p.from('client_cases').select('id, client_id, primary_concern').eq('id', caseA!)
    expect(data ?? []).toHaveLength(0)
  })

  it('D: another member’s review pack (case B, no work) is unreadable', async (ctx) => {
    if (!armed) return ctx.skip()
    const p = await signInAs(practP!)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (p as any).from('practitioner_review_packs').select('id').eq('id', packBId!)
    expect(data ?? []).toHaveLength(0)
  })

  it('E: cancelling the work item removes pack AND case-index access', async (ctx) => {
    if (!armed) return ctx.skip()
    await admin.from('case_practitioner_work').update({ status: 'cancelled' } as never).eq('id', workAId!)
    const p = await signInAs(practP!)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pack } = await (p as any).from('practitioner_review_packs').select('id').eq('id', packAId!)
    expect(pack ?? []).toHaveLength(0)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: index } = await (p as any).from('practitioner_case_index').select('id').eq('id', caseA!)
    expect(index ?? []).toHaveLength(0)
    await admin.from('case_practitioner_work').update({ status: 'assigned' } as never).eq('id', workAId!) // restore for J
  })

  it('F: consent withdrawal blocks regeneration (fail-closed)', async (ctx) => {
    if (!armed) return ctx.skip()
    const mB = await signInAs(memberB!)
    const { error: rpcErr } = await mB.rpc('withdraw_own_consent' as never,
      { p_consent_type: 'deidentified_synopsis_sharing' } as never)
    expect(rpcErr).toBeNull()
    await expect(generateAndStoreReviewPack(admin, caseB!, practP!.id)).rejects.toThrow(/Blocked/)
  })

  it('H: anonymous client reads nothing from any surface', async (ctx) => {
    if (!armed) return ctx.skip()
    const anon = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    for (const table of ['intake_responses', 'client_cases'] as const) {
      const { data } = await anon.from(table).select('id').limit(3)
      expect(data ?? [], table).toHaveLength(0)
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: packs } = await (anon as any).from('practitioner_review_packs').select('id').limit(3)
    expect(packs ?? []).toHaveLength(0)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: index } = await (anon as any).from('practitioner_case_index').select('id').limit(3)
    expect(index ?? []).toHaveLength(0)
  })

  it('I: admin/service operations still work (service reads; member self-access intact)', async (ctx) => {
    if (!armed) return ctx.skip()
    const { data: svcCase } = await admin.from('client_cases').select('id').eq('id', caseA!)
    expect(svcCase ?? []).toHaveLength(1)
    const { data: svcIntake } = await admin.from('intake_responses').select('id').eq('member_id', memberA!.id)
    expect((svcIntake ?? []).length).toBeGreaterThan(0)
    const mA = await signInAs(memberA!)
    const { data: own } = await mA.from('intake_responses').select('id').eq('member_id', memberA!.id)
    expect((own ?? []).length).toBeGreaterThan(0) // member self-access untouched
  })

  it('J: POSITIVE CONTROL — active work grants ONLY the pack + minimal case index', async (ctx) => {
    if (!armed) return ctx.skip()
    const p = await signInAs(practP!)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pack } = await (p as any).from('practitioner_review_packs')
      .select('id, pseudonym, pack, pack_version').eq('id', packAId!)
    expect(pack ?? []).toHaveLength(1)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: index } = await (p as any).from('practitioner_case_index').select('*').eq('id', caseA!)
    expect(index ?? []).toHaveLength(1)
    const row = (index as Record<string, unknown>[])[0]
    expect(Object.keys(row).sort()).toEqual(['created_at', 'escalation_required', 'id', 'status']) // 0057 removed case_complexity_score
    expect('client_id' in row).toBe(false)
    expect('primary_concern' in row).toBe(false)
  })
})
