// 0059 — Protocol signing/versioning: LIVE database protections.
//
// SYNTHETIC DATA ONLY, self-cleaning. Skips when no DB env is present.
//
// These prove the DATABASE half of the signing boundary. The APPLICATION half
// — actor role, practitioner class, content/case state, explicit attribution —
// is proven by intakeV2/protocolSigning.test.ts (39 tests). The two are
// complementary, not competing:
//
//   DB layer    structural integrity that must hold no matter who is calling:
//               signature completeness, Lead-only signing for end-user
//               sessions, immutability, delete protection, one successor per
//               version.
//   App guard   everything the database cannot see: whether the caller is a
//               practitioner at all rather than an AI or a job, the
//               practitioner's class for the sole-LRP rule, whether the
//               content is already signed or superseded, and whether the
//               version and author were stated explicitly.
//
// The trust boundary is deliberate: when auth.uid() IS NULL the caller is
// trusted service-role server code, and the DB trigger stands aside. That is
// precisely why the application guard exists and must be called first.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import { createTestUser, deleteTestUser } from '../practitioners/__test-helpers__/createTestUser'
import { signInAs } from '../practitioners/__test-helpers__/signInAs'

// ── WHY THIS SUITE IS OPT-IN ────────────────────────────────────────────────
//
// It cannot fully clean up after itself, and that is not a defect in the test
// — it is the protection working. 0059 makes a signed protocol undeletable and
// its signature unchangeable, so once this suite signs a synthetic protocol,
// no ordinary client (service role included) can remove that row. Clearing it
// needs DDL: disable trg_forbid_signed_protocol_delete and
// trg_signed_protocol_immutability, delete rows scoped to the PS59-TEST tag,
// re-enable both in the same transaction.
//
// It was run once against production on 2026-10-10 to prove the migration, and
// the residue was removed that way. Running it again without that follow-up
// leaves signed synthetic rows behind, so it is gated behind an explicit flag:
//
//   NI_ALLOW_SIGNING_LIVE_TEST=1 pnpm vitest run src/protocols
//
// Do not remove the gate to make CI "cover more".
const HAVE_DB = !!process.env.NEXT_PUBLIC_SUPABASE_URL
const OPTED_IN = process.env.NI_ALLOW_SIGNING_LIVE_TEST === '1'

function mkAdmin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

const TAG = 'PS59-TEST'

describe.skipIf(!HAVE_DB || !OPTED_IN)('0059 — live protocol signing protections', () => {
  let admin: ReturnType<typeof mkAdmin>
  let member: Awaited<ReturnType<typeof createTestUser>>
  let lead: Awaited<ReturnType<typeof createTestUser>>
  let contributor: Awaited<ReturnType<typeof createTestUser>>
  let caseId: string
  let agreementId: string | null = null

  // A practitioners row that satisfies practitioner_assignment_eligibility().
  const practitionerRow = (id: string, name: string) => ({
    id, display_name: `${TAG} ${name}`, status: 'active', is_active: true,
    category: 'unregistered',
    credentials_verification_status: 'verified',
    indemnity_required: false,
    specialisations: [], credentials: [], primary_professions: [], area_tags: [],
    client_types: [], collaboration_types: [],
    accepts_referrals: false, open_to_collaboration: false,
    practitioner_tier: 'standard', display_order: 0, profile_completeness_pct: 0,
    is_directory_ready: false, is_test_data: true, trust_level: 'vetted' as const,
    // practitioner_assignment_eligibility() additionally requires an approved
    // scope and no outstanding DBS. dbs_status null counts as not outstanding.
    scope_status: 'approved',
  })

  const mkProtocol = async (over: Record<string, unknown> = {}) => {
    const { data, error } = await admin.from('member_protocols').insert({
      member_id: member.id, name: `${TAG} Protocol`, status: 'active',
      started_at: new Date().toISOString().slice(0, 10), case_id: caseId, ...over,
    } as never).select('id, version, signed_at, signed_by, supersedes').single()
    if (error) throw error
    return data as { id: string; version: number; signed_at: string | null; signed_by: string | null; supersedes: string | null }
  }

  beforeAll(async () => {
    admin = mkAdmin()
    member = await createTestUser(admin, 'ps59-member')
    lead = await createTestUser(admin, 'ps59-lead')
    contributor = await createTestUser(admin, 'ps59-contrib')

    await admin.from('practitioners').insert([
      practitionerRow(lead.id, 'Lead'), practitionerRow(contributor.id, 'Contributor'),
    ] as never)

    // Eligibility needs a CURRENT agreement for the class plus a matching
    // acceptance. practitioner_agreements is empty in production, so one is
    // created here, clearly marked, and removed in cleanup.
    const body = `${TAG} synthetic agreement body — NOT A REAL AGREEMENT`
    const { data: agr } = await admin.from('practitioner_agreements').insert({
      category: 'unregistered', version: 999,
      title: `${TAG} SYNTHETIC — NOT A REAL AGREEMENT`, body, is_current: true,
    } as never).select('id').single()
    agreementId = (agr as { id: string } | null)?.id ?? null

    if (agreementId) {
      // The acceptance hash must equal encode(digest(body,'sha256'),'hex').
      const enc = new TextEncoder().encode(body)
      const digest = await crypto.subtle.digest('SHA-256', enc)
      const hex = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0')).join('')
      await admin.from('practitioner_agreement_acceptances').insert([
        { practitioner_id: lead.id, agreement_id: agreementId, agreement_version: 999,
          accepted_text_hash: hex },
        { practitioner_id: contributor.id, agreement_id: agreementId, agreement_version: 999,
          accepted_text_hash: hex },
      ] as never)
    }

    const { data: kase, error: caseErr } = await admin.from('client_cases').insert({
      client_id: member.id, status: 'active', case_complexity_score: 0,
      escalation_required: false,
    } as never).select('id').single()
    if (caseErr) throw caseErr
    caseId = (kase as { id: string }).id

    await admin.from('case_team_roles').insert([
      { case_id: caseId, practitioner_id: lead.id, team_role: 'lead' },
      { case_id: caseId, practitioner_id: contributor.id, team_role: 'care_team' },
    ] as never)
  })

  afterAll(async () => {
    if (!admin) return

    // Drafts can be removed normally; children before parents so the
    // supersedes FK is satisfied.
    await admin.from('member_protocols').delete()
      .eq('member_id', member.id).is('signed_at', null).not('supersedes', 'is', null)
    await admin.from('member_protocols').delete()
      .eq('member_id', member.id).is('signed_at', null)

    // SIGNED rows cannot be removed here — that is 0059 doing its job. Report
    // them loudly with the exact scoped SQL needed, rather than leaving silent
    // residue in production.
    const { data: stuck } = await admin.from('member_protocols')
      .select('id, name').eq('member_id', member.id).not('signed_at', 'is', null)
    if (stuck && stuck.length > 0) {
      console.warn(
        `\n[${TAG}] ${stuck.length} SIGNED synthetic protocol(s) remain and are ` +
        `undeletable by design. Remove with:\n` +
        `  alter table public.member_protocols disable trigger trg_forbid_signed_protocol_delete;\n` +
        `  alter table public.member_protocols disable trigger trg_signed_protocol_immutability;\n` +
        `  delete from public.member_protocols where name like '${TAG}%' and supersedes is not null;\n` +
        `  delete from public.member_protocols where name like '${TAG}%';\n` +
        `  alter table public.member_protocols enable trigger trg_forbid_signed_protocol_delete;\n` +
        `  alter table public.member_protocols enable trigger trg_signed_protocol_immutability;\n` +
        `  -- then delete the PS59-TEST practitioners, agreements, cases and auth users.\n`)
    }
    if (caseId) {
      await admin.from('case_team_roles').delete().eq('case_id', caseId)
      await admin.from('client_cases').delete().eq('id', caseId)
    }
    await admin.from('practitioner_agreement_acceptances').delete()
      .in('practitioner_id', [lead.id, contributor.id])
    if (agreementId) await admin.from('practitioner_agreements').delete().eq('id', agreementId)
    await admin.from('practitioners').delete().in('id', [lead.id, contributor.id])
    for (const u of [member, lead, contributor]) if (u) await deleteTestUser(admin, u.id)
  })

  // ─── Signature integrity ──────────────────────────────────────────────────

  it('A. signed_at without signed_by is rejected', async () => {
    const p = await mkProtocol()
    const { error } = await admin.from('member_protocols')
      .update({ signed_at: new Date().toISOString() } as never).eq('id', p.id)
    expect(error).not.toBeNull()
    expect(`${error?.message}`).toMatch(/signature_complete|violates check/i)
  })

  it('B. signed_by without signed_at is rejected', async () => {
    const p = await mkProtocol()
    const { error } = await admin.from('member_protocols')
      .update({ signed_by: lead.id } as never).eq('id', p.id)
    expect(error).not.toBeNull()
    expect(`${error?.message}`).toMatch(/signature_complete|violates check/i)
  })

  it('C. every new protocol starts as an unsigned v1 draft', async () => {
    const p = await mkProtocol()
    expect(p.version).toBe(1)
    expect(p.signed_at).toBeNull()
    expect(p.signed_by).toBeNull()
  })

  // ─── The blocker fix: a client cannot sign their own protocol ─────────────

  it('D. a CLIENT cannot sign their own protocol, though RLS lets them write the row', async () => {
    const p = await mkProtocol()
    const asMember = await signInAs(member)

    // The member CAN update their own row generally — proving RLS is not what
    // stops them, the signing trigger is.
    const { error: benign } = await asMember.from('member_protocols')
      .update({ notes: `${TAG} client edit` } as never).eq('id', p.id)
    expect(benign).toBeNull()

    const { error } = await asMember.from('member_protocols')
      .update({ signed_at: new Date().toISOString(), signed_by: member.id } as never)
      .eq('id', p.id)
    expect(error).not.toBeNull()
    expect(`${error?.message}`).toMatch(/protocol signing|not the active Lead|only be signed by/i)

    const { data: after } = await admin.from('member_protocols')
      .select('signed_at, signed_by').eq('id', p.id).single()
    expect(after!.signed_at).toBeNull()
    expect(after!.signed_by).toBeNull()
  })

  it('E. a practitioner has no RLS write path at all — signing is server-side only', async () => {
    const p = await mkProtocol()
    const asLead = await signInAs(lead)
    const { data, error } = await asLead.from('member_protocols')
      .update({ notes: `${TAG} lead edit` } as never).eq('id', p.id).select('id')
    // No UPDATE policy grants practitioners access: zero rows affected, no error.
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })

  // ─── Service-role signing (the documented trust boundary) ────────────────

  it('F. an eligible Lead signature applied server-side succeeds', async () => {
    const { data: elig } = await admin
      .rpc('practitioner_assignment_eligibility', { p_practitioner_id: lead.id } as never)
    const verdict = (Array.isArray(elig) ? elig[0] : elig) as
      { eligible: boolean; reasons: string[] }
    // Surface the authority's own reasons if this ever regresses.
    expect(verdict?.reasons ?? ['no verdict']).toEqual([])
    expect(verdict.eligible).toBe(true)

    const p = await mkProtocol({ name: `${TAG} v1` })
    const { error } = await admin.from('member_protocols')
      .update({ signed_at: new Date().toISOString(), signed_by: lead.id } as never)
      .eq('id', p.id)
    expect(error).toBeNull()

    const { data: signed } = await admin.from('member_protocols')
      .select('signed_at, signed_by, version').eq('id', p.id).single()
    expect(signed!.signed_at).not.toBeNull()
    expect(signed!.signed_by).toBe(lead.id)
  })

  // ─── Immutability and delete protection ──────────────────────────────────

  it('G. a signed version cannot be edited in place', async () => {
    const p = await mkProtocol({ name: `${TAG} immutable` })
    await admin.from('member_protocols')
      .update({ signed_at: new Date().toISOString(), signed_by: lead.id } as never).eq('id', p.id)

    for (const change of [{ name: `${TAG} renamed` }, { notes: 'changed' }, { version: 7 }]) {
      const { error } = await admin.from('member_protocols')
        .update(change as never).eq('id', p.id)
      expect(error).not.toBeNull()
      expect(`${error?.message}`).toMatch(/signed .*cannot be edited in place|create a revision/i)
    }
  })

  it('H. a signed version cannot be deleted', async () => {
    const p = await mkProtocol({ name: `${TAG} undeletable` })
    await admin.from('member_protocols')
      .update({ signed_at: new Date().toISOString(), signed_by: lead.id } as never).eq('id', p.id)

    const { error } = await admin.from('member_protocols').delete().eq('id', p.id)
    expect(error).not.toBeNull()
    expect(`${error?.message}`).toMatch(/cannot be deleted|supersede it instead/i)

    const { data: still } = await admin.from('member_protocols')
      .select('id').eq('id', p.id).maybeSingle()
    expect(still).not.toBeNull()
  })

  it('I. a DRAFT remains freely editable and deletable', async () => {
    const p = await mkProtocol({ name: `${TAG} draft` })
    const { error: upd } = await admin.from('member_protocols')
      .update({ name: `${TAG} draft renamed` } as never).eq('id', p.id)
    expect(upd).toBeNull()
    const { error: del } = await admin.from('member_protocols').delete().eq('id', p.id)
    expect(del).toBeNull()
  })

  // ─── Version chain ───────────────────────────────────────────────────────

  it('J. v1 -> v2 supersession: v1 stays readable, immutable and distinct', async () => {
    const t1 = new Date(Date.now() - 86400000).toISOString()
    const v1 = await mkProtocol({ name: `${TAG} chain v1`, version: 1 })
    await admin.from('member_protocols')
      .update({ signed_at: t1, signed_by: lead.id } as never).eq('id', v1.id)

    const v2 = await mkProtocol({ name: `${TAG} chain v2`, version: 2, supersedes: v1.id })
    expect(v2.supersedes).toBe(v1.id)
    expect(v2.signed_at).toBeNull()          // a revision starts as a draft

    const t2 = new Date().toISOString()
    const { error: signErr } = await admin.from('member_protocols')
      .update({ signed_at: t2, signed_by: contributor.id } as never).eq('id', v2.id)
    expect(signErr).toBeNull()

    // v1 untouched: not edited into v2, signatory and date still distinct.
    const { data: after1 } = await admin.from('member_protocols')
      .select('name, version, signed_at, signed_by').eq('id', v1.id).single()
    expect(after1!.name).toBe(`${TAG} chain v1`)
    expect(after1!.version).toBe(1)
    expect(after1!.signed_by).toBe(lead.id)
    expect(new Date(after1!.signed_at as string).getTime())
      .toBeLessThan(new Date(t2).getTime())

    const { data: after2 } = await admin.from('member_protocols')
      .select('name, version, signed_by').eq('id', v2.id).single()
    expect(after2!.version).toBe(2)
    expect(after2!.signed_by).toBe(contributor.id)   // distinct signatory

    // Current version derived WITHOUT a protocol_state column: the signed row
    // that nothing supersedes.
    const { data: all } = await admin.from('member_protocols')
      .select('id, version, signed_at, supersedes')
      .eq('member_id', member.id).not('signed_at', 'is', null)
    const supersededIds = new Set((all ?? []).map((r) => r.supersedes).filter(Boolean))
    const current = (all ?? []).filter((r) => !supersededIds.has(r.id))
    expect(current.map((r) => r.id)).toContain(v2.id)
    expect(current.map((r) => r.id)).not.toContain(v1.id)
  })

  it('K. one version cannot be superseded by two competing revisions', async () => {
    const v1 = await mkProtocol({ name: `${TAG} fork v1` })
    await mkProtocol({ name: `${TAG} fork v2a`, version: 2, supersedes: v1.id })

    let threw = false
    try {
      await mkProtocol({ name: `${TAG} fork v2b`, version: 2, supersedes: v1.id })
    } catch (e) {
      threw = true
      expect(`${(e as { message?: string }).message}`).toMatch(/supersedes_key|duplicate key/i)
    }
    expect(threw).toBe(true)
  })

  // ─── Nothing leaked ──────────────────────────────────────────────────────

  it('L. the suite touched no pre-existing protocol', async () => {
    const { count } = await admin.from('member_protocols')
      .select('id', { count: 'exact', head: true })
      .not('member_id', 'eq', member.id)
    expect(count ?? 0).toBe(0)   // production had zero member_protocols rows
  })
})
