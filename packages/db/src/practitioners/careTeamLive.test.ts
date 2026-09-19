// ─── SPRINT 6 — Care Team live wiring: BREAK-THE-RULE matrix A–M (armed) ─────
// Authoritative server/database paths only; synthetic identities only;
// self-cleaning. SELF-SKIPS until migration 0057 is applied (probe on
// practitioner_assigned_clients). The full synthetic end-to-end case (§15)
// is test M.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import { createTestUser, deleteTestUser } from './__test-helpers__/createTestUser'
import { signInAs } from './__test-helpers__/signInAs'
import { makePractitionerAssignable } from './__test-helpers__/makeAssignable'
import {
  adminAssignCareTeamMember, grantPractitionerAccess, withdrawPractitionerAccess,
  listAssignedClients, addCaseContribution, writeAnalysisSection,
  recordLeadCoordinationReview, releaseCarePlan,
} from './careTeamLive'

const HAVE_DB = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY
function mkAdmin() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}
type TestUser = Awaited<ReturnType<typeof createTestUser>>

describe.skipIf(!HAVE_DB)('SPRINT 6 — care team live matrix A–M (armed on 0057)', () => {
  const admin = HAVE_DB ? mkAdmin() : (null as never)
  let armed = false
  let member: TestUser | null = null
  let memberB: TestUser | null = null
  let lead: TestUser | null = null
  let teamPract: TestUser | null = null
  let student: TestUser | null = null
  let cat3: TestUser | null = null
  let expired: TestUser | null = null
  let caseA: string | null = null
  let caseB: string | null = null
  const cleanups: (() => Promise<void>)[] = []
  const linkIds: string[] = []

  async function mkPract(tag: string, category?: 'voluntary_registered' | 'unregistered') {
    const user = await createTestUser(admin, tag)
    await admin.from('practitioners').insert({ id: user.id, display_name: `Test ${user.email}`, status: 'active' } as never)
    cleanups.push(await makePractitionerAssignable(admin, user.id, category ? { category } : undefined))
    return user
  }

  beforeAll(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const probe = await (admin as any).from('practitioner_assigned_clients').select('link_id').limit(1)
    armed = !probe.error
    if (!armed) return

    member = await createTestUser(admin, 's6-member-a')
    memberB = await createTestUser(admin, 's6-member-b')
    lead = await mkPract('s6-lead', 'voluntary_registered')      // Accredited — may lead
    teamPract = await mkPract('s6-team')                          // NI Verified — care team
    student = await mkPract('s6-student')                         // training status
    cat3 = await mkPract('s6-cat3')                               // NI Verified — F
    expired = await mkPract('s6-expired')                         // D: expire the indemnity
    await admin.from('practitioners').update({ insurance_expiry: '2020-01-01' } as never).eq('id', expired.id)

    const { data: cA } = await admin.from('client_cases')
      .insert({ client_id: member.id, status: 'active', primary_concern: 'synthetic concern' } as never).select('id').single()
    caseA = (cA as { id: string } | null)?.id ?? null
    const { data: cB } = await admin.from('client_cases')
      .insert({ client_id: memberB.id, status: 'active', primary_concern: 'synthetic concern B' } as never).select('id').single()
    caseB = (cB as { id: string } | null)?.id ?? null
  }, 180_000)

  afterAll(async () => {
    if (!armed) return
    for (const caseId of [caseA, caseB]) if (caseId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any).from('care_plan_coordination').delete().eq('case_id', caseId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any).from('case_analysis_plan').delete().eq('case_id', caseId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any).from('case_contributions').delete().eq('case_id', caseId)
    }
    for (const m of [member, memberB]) if (m) {
      await admin.from('client_practitioner_links').delete().eq('client_id', m.id)
      await admin.from('consent_records').delete().eq('profile_id', m.id)
    }
    for (const caseId of [caseA, caseB]) if (caseId) await admin.from('client_cases').delete().eq('id', caseId)
    for (const cleanup of cleanups) await cleanup()
    for (const p of [lead, teamPract, student, cat3, expired]) if (p) {
      await admin.from('practitioners').delete().eq('id', p.id)
      await deleteTestUser(admin, p.id)
    }
    for (const m of [member, memberB]) if (m) await deleteTestUser(admin, m.id)
  }, 180_000)

  it('A: unassigned practitioner sees NO clients and reads nothing', async (ctx) => {
    if (!armed) return ctx.skip()
    const p = await signInAs(teamPract!)
    expect(await listAssignedClients(p)).toHaveLength(0)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (p as any).from('case_contributions').select('id').eq('case_id', caseA!)
    expect(data ?? []).toHaveLength(0)
  })

  it('E-then-lead: admin assigns the eligible Lead; a SECOND active lead is refused by the unique index', async (ctx) => {
    if (!armed) return ctx.skip()
    linkIds.push(await adminAssignCareTeamMember(admin, {
      clientId: member!.id, practitionerId: lead!.id, role: 'lead', createdBy: lead!.id,
    }))
    await expect(adminAssignCareTeamMember(admin, {
      clientId: member!.id, practitionerId: teamPract!.id, role: 'lead', createdBy: lead!.id,
    })).rejects.toThrow(/duplicate key|uniq_active_lead/i)
  })

  it('F: Category 3 (NI Verified) as sole Lead is refused by the trigger', async (ctx) => {
    if (!armed) return ctx.skip()
    await expect(adminAssignCareTeamMember(admin, {
      clientId: memberB!.id, practitionerId: cat3!.id, role: 'lead', createdBy: cat3!.id,
    })).rejects.toThrow(/Category 3|cannot be the sole Lead/i)
  })

  it('D: expired required indemnity refuses Care Team assignment (Sprint 4 gate reused)', async (ctx) => {
    if (!armed) return ctx.skip()
    await expect(adminAssignCareTeamMember(admin, {
      clientId: member!.id, practitionerId: expired!.id, role: 'specialist', createdBy: lead!.id,
    })).rejects.toThrow(/indemnity_expired|not assignable/)
  })

  it('B: assigned WITHOUT client approval → invisible and cannot contribute', async (ctx) => {
    if (!armed) return ctx.skip()
    linkIds.push(await adminAssignCareTeamMember(admin, {
      clientId: member!.id, practitionerId: teamPract!.id, role: 'specialist', createdBy: lead!.id,
    }))
    const p = await signInAs(teamPract!)
    expect(await listAssignedClients(p)).toHaveLength(0) // no consent yet
    await expect(addCaseContribution(p, {
      caseId: caseA!, authorId: teamPract!.id, teamRole: 'specialist',
      kind: 'addition', content: 'attempt before approval',
    })).rejects.toThrow()
  })

  it('G: student without an actively-linked supervisor is refused', async (ctx) => {
    if (!armed) return ctx.skip()
    // No supervisor at all → CHECK refuses.
    await expect(adminAssignCareTeamMember(admin, {
      clientId: memberB!.id, practitionerId: student!.id, role: 'student', createdBy: lead!.id,
    })).rejects.toThrow(/supervisor/i)
    // Supervisor named but has NO active link on that client → trigger refuses.
    await expect(adminAssignCareTeamMember(admin, {
      clientId: memberB!.id, practitionerId: student!.id, role: 'student',
      supervisorId: lead!.id, createdBy: lead!.id,
    })).rejects.toThrow(/supervisor/i)
  })

  it('CLIENT APPROVES: consent recorded through the existing machinery makes the practitioner visible', async (ctx) => {
    if (!armed) return ctx.skip()
    const m = await signInAs(member!)
    await grantPractitionerAccess(m, { memberId: member!.id, memberEmail: member!.email, practitionerId: lead!.id })
    await grantPractitionerAccess(m, { memberId: member!.id, memberEmail: member!.email, practitionerId: teamPract!.id })
    const p = await signInAs(teamPract!)
    const rows = await listAssignedClients(p)
    expect(rows).toHaveLength(1)
    expect(rows[0].case_id).toBe(caseA)
    // Pseudonymous: the view exposes no client identity columns.
    expect('client_id' in (rows[0] as unknown as Record<string, unknown>)).toBe(false)
  })

  it('K: cross-client — active practitioner on case A reads nothing of case B', async (ctx) => {
    if (!armed) return ctx.skip()
    const p = await signInAs(teamPract!)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (p as any).from('case_contributions').select('id').eq('case_id', caseB!)
    expect(data ?? []).toHaveLength(0)
    const rows = await listAssignedClients(p)
    expect(rows.every((row) => row.case_id !== caseB)).toBe(true)
  })

  it('CONTRIBUTE, NEVER OVERWRITE: attributed contribution inserts; rewriting is refused for everyone', async (ctx) => {
    if (!armed) return ctx.skip()
    const p = await signInAs(teamPract!)
    const contributionId = await addCaseContribution(p, {
      caseId: caseA!, authorId: teamPract!.id, teamRole: 'specialist', profession: 'Herbalist',
      kind: 'addition', content: 'Attributed factual contribution (synthetic).',
    })
    // Another practitioner (the lead) cannot rewrite it — no UPDATE policy…
    const l = await signInAs(lead!)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rewritten } = await (l as any).from('case_contributions')
      .update({ content: 'silently rewritten' }).eq('id', contributionId).select('id')
    expect(rewritten ?? []).toHaveLength(0)
    // …and even service-role content edits are refused by the trigger.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: svcErr } = await (admin as any).from('case_contributions')
      .update({ content: 'service rewrite' }).eq('id', contributionId)
    expect(svcErr?.message ?? '').toMatch(/append-only/)
  })

  it('H/I/J: Analysis & Plan writes refused for student, admin/service, AI/system; unauthorised practitioner refused', async (ctx) => {
    if (!armed) return ctx.skip()
    // I/J: service-role path (admin server actions, AI pipelines, automated
    // jobs, intake, synopsis generation) — auth.uid() is NULL → trigger refuses.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: svcErr } = await (admin as any).from('case_analysis_plan')
      .insert({ case_id: caseA!, section: 'therapeutic_aims', content: 'machine text', author_id: lead!.id })
    expect(svcErr?.message ?? '').toMatch(/only the authenticated authoring practitioner/)

    // H: a student (assign under supervision on case A first — lead is active there).
    linkIds.push(await adminAssignCareTeamMember(admin, {
      clientId: member!.id, practitionerId: student!.id, role: 'student',
      supervisorId: lead!.id, createdBy: lead!.id,
    }))
    const m = await signInAs(member!)
    await grantPractitionerAccess(m, { memberId: member!.id, memberEmail: member!.email, practitionerId: student!.id })
    const s = await signInAs(student!)
    await expect(writeAnalysisSection(s, {
      caseId: caseA!, section: 'therapeutic_aims', content: 'student attempt', authorId: student!.id,
    })).rejects.toThrow(/non-student|only the authenticated/)

    // Unauthorised practitioner (no link on case B's client):
    const p = await signInAs(teamPract!)
    await expect(writeAnalysisSection(p, {
      caseId: caseB!, section: 'therapeutic_aims', content: 'no involvement', authorId: teamPract!.id,
    })).rejects.toThrow(/no active authorised/)
  })

  it('STUDENT CONTRIBUTES under supervision (minimum necessary, attributed)', async (ctx) => {
    if (!armed) return ctx.skip()
    const s = await signInAs(student!)
    const id = await addCaseContribution(s, {
      caseId: caseA!, authorId: student!.id, teamRole: 'student',
      kind: 'addition', content: 'Information gathered from the client, entered by the student (synthetic).',
      source: 'client_call',
    })
    expect(id).toBeTruthy()
  })

  it('L: plan release WITHOUT recorded Lead coordination review is refused', async (ctx) => {
    if (!armed) return ctx.skip()
    const l = await signInAs(lead!)
    await writeAnalysisSection(l, {
      caseId: caseA!, section: 'therapeutic_aims',
      content: 'Practitioner-authored aims (synthetic).', authorId: lead!.id,
    })
    await expect(releaseCarePlan(l, caseA!)).rejects.toThrow(/no recorded Lead coordination review/)
  })

  it('M: FULL VALID PATHWAY — coordination review then release succeeds; withdrawal then ends future access (C)', async (ctx) => {
    if (!armed) return ctx.skip()
    const l = await signInAs(lead!)
    await recordLeadCoordinationReview(l, caseA!, 'Coordinated across the team (synthetic).')
    const releaseId = await releaseCarePlan(l, caseA!)
    expect(releaseId).toBeTruthy()

    // C: the client withdraws teamPract's access — future visibility/writes stop.
    const m = await signInAs(member!)
    const withdrawn = await withdrawPractitionerAccess(m, teamPract!.id)
    expect(withdrawn).toBeGreaterThan(0)
    const p = await signInAs(teamPract!)
    expect(await listAssignedClients(p)).toHaveLength(0)
    await expect(addCaseContribution(p, {
      caseId: caseA!, authorId: teamPract!.id, teamRole: 'specialist',
      kind: 'addition', content: 'attempt after withdrawal',
    })).rejects.toThrow()
    // Audit/provenance remains: the earlier contribution still exists (service read).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: kept } = await (admin as any).from('case_contributions')
      .select('id').eq('case_id', caseA!).eq('author_id', teamPract!.id)
    expect((kept ?? []).length).toBeGreaterThan(0)
  })
})
