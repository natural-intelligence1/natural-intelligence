// ─── SPRINT 6 (revised) — Care Team live wiring: BREAK-THE-RULE matrix A–U ────
// Authoritative server/database paths only; synthetic identities only;
// self-cleaning. SELF-SKIPS until migration 0057 is applied (probe on
// case_team_roles). Lead responsibility is PER CASE (N/O); the Active Care
// Health Profile is the ONE scoped Mode 2 surface (P–U) and Sprint 5's
// raw-table protections must hold for the SAME authorised practitioner (R).
// The full synthetic end-to-end pathway is test M.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import { createTestUser, deleteTestUser } from './__test-helpers__/createTestUser'
import { signInAs } from './__test-helpers__/signInAs'
import { makePractitionerAssignable } from './__test-helpers__/makeAssignable'
import {
  adminAssignCareTeamMember, assignCaseTeamRole, endCaseTeamRole,
  grantPractitionerAccess, withdrawPractitionerAccess,
  listActiveCareCases, getCareHealthProfile, CARE_HEALTH_PROFILE_FIELDS,
  addCaseContribution, writeAnalysisSection,
  recordLeadCoordinationReview, releaseCarePlan,
} from './careTeamLive'

const HAVE_DB = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY
function mkAdmin() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}
type TestUser = Awaited<ReturnType<typeof createTestUser>>

describe.skipIf(!HAVE_DB)('SPRINT 6 — care team live matrix A–U (armed on 0057)', () => {
  const admin = HAVE_DB ? mkAdmin() : (null as never)
  let armed = false
  let member: TestUser | null = null      // client of caseA + caseA2 + caseT
  let memberB: TestUser | null = null     // client of caseB (cross-client)
  let lead: TestUser | null = null        // Accredited — Lead of caseA
  let lead2: TestUser | null = null       // Accredited — second-lead attempts; Lead of caseA2
  let teamPract: TestUser | null = null   // NI Verified — care team on caseA
  let student: TestUser | null = null
  let cat3: TestUser | null = null
  let expired: TestUser | null = null
  let caseA: string | null = null
  let caseA2: string | null = null        // O: same client, separate case
  let caseT: string | null = null         // N: ended-lead-never-blocks proof
  let caseB: string | null = null
  let studentRoleId: string | null = null // T: ends this role
  const cleanups: (() => Promise<void>)[] = []

  async function mkPract(tag: string, category?: 'voluntary_registered' | 'unregistered') {
    const user = await createTestUser(admin, tag)
    await admin.from('practitioners').insert({ id: user.id, display_name: `Test ${user.email}`, status: 'active' } as never)
    cleanups.push(await makePractitionerAssignable(admin, user.id, category ? { category } : undefined))
    return user
  }

  async function mkCase(clientId: string, concern: string): Promise<string> {
    const { data, error } = await admin.from('client_cases')
      .insert({ client_id: clientId, status: 'active', primary_concern: concern } as never).select('id').single()
    if (error) throw new Error(`case fixture failed: ${error.message}`)
    return (data as { id: string }).id
  }

  beforeAll(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const probe = await (admin as any).from('case_team_roles').select('id').limit(1)
    armed = !probe.error
    if (!armed) return

    member = await createTestUser(admin, 's6-member-a')
    memberB = await createTestUser(admin, 's6-member-b')
    // Guarantee the identity the bundle exposes (view JOINs profiles).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('profiles').upsert({ id: member.id, full_name: 'Synthetic Member A', is_test_data: true })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('profiles').upsert({ id: memberB.id, full_name: 'Synthetic Member B', is_test_data: true })
    // A COMPLETED synthetic intake record — the factual content of the bundle.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: intakeErr } = await (admin as any).from('intake_responses').insert({
      member_id: member.id,
      is_complete: true,
      primary_concerns: ['synthetic fatigue concern'],
      diagnosed_conditions: ['synthetic-condition'],
      stress_level: 4,
      sleep_quality: 3,
      energy_level: 2,
      current_medications: 'synthetic medication list',
      current_supplements: 'synthetic supplement list',
      diet_description: 'synthetic diet description',
      most_want_to_understand: 'synthetic understanding goal',
    })
    if (intakeErr) throw new Error(`intake fixture failed: ${intakeErr.message}`)

    lead = await mkPract('s6-lead', 'voluntary_registered')
    lead2 = await mkPract('s6-lead2', 'voluntary_registered')
    teamPract = await mkPract('s6-team')                          // NI Verified — care team
    student = await mkPract('s6-student')
    cat3 = await mkPract('s6-cat3')                               // NI Verified — F
    expired = await mkPract('s6-expired')                         // D: expire the indemnity
    await admin.from('practitioners').update({ insurance_expiry: '2020-01-01' } as never).eq('id', expired.id)

    caseA = await mkCase(member.id, 'synthetic concern A')
    caseA2 = await mkCase(member.id, 'synthetic concern A2')
    caseT = await mkCase(member.id, 'synthetic throwaway case')
    caseB = await mkCase(memberB.id, 'synthetic concern B')
  }, 180_000)

  afterAll(async () => {
    if (!armed) return
    const cases = [caseA, caseA2, caseT, caseB].filter(Boolean) as string[]
    for (const caseId of cases) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any).from('care_plan_coordination').delete().eq('case_id', caseId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any).from('case_analysis_plan').delete().eq('case_id', caseId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any).from('case_contributions').delete().eq('case_id', caseId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any).from('case_team_roles').delete().eq('case_id', caseId)
    }
    for (const m of [member, memberB]) if (m) {
      await admin.from('client_practitioner_links').delete().eq('client_id', m.id)
      await admin.from('consent_records').delete().eq('profile_id', m.id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any).from('intake_responses').delete().eq('member_id', m.id)
    }
    for (const caseId of cases) await admin.from('client_cases').delete().eq('id', caseId)
    for (const cleanup of cleanups) await cleanup()
    for (const p of [lead, lead2, teamPract, student, cat3, expired]) if (p) {
      await admin.from('practitioners').delete().eq('id', p.id)
      await deleteTestUser(admin, p.id)
    }
    for (const m of [member, memberB]) if (m) await deleteTestUser(admin, m.id)
  }, 180_000)

  it('A: unassigned practitioner sees NO cases and reads nothing', async (ctx) => {
    if (!armed) return ctx.skip()
    const p = await signInAs(teamPract!)
    expect(await listActiveCareCases(p)).toHaveLength(0)
    expect(await getCareHealthProfile(p, caseA!)).toBeNull()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (p as any).from('case_contributions').select('id').eq('case_id', caseA!)
    expect(data ?? []).toHaveLength(0)
  })

  it('D: expired required indemnity refuses the case-role assignment (Sprint 4 gate reused)', async (ctx) => {
    if (!armed) return ctx.skip()
    await expect(assignCaseTeamRole(admin, {
      caseId: caseA!, practitionerId: expired!.id, teamRole: 'care_team', assignedBy: lead!.id,
    })).rejects.toThrow(/indemnity_expired|not assignable/)
  })

  it('F: Category 3 (NI Verified) as sole Lead is refused by the trigger', async (ctx) => {
    if (!armed) return ctx.skip()
    await expect(assignCaseTeamRole(admin, {
      caseId: caseB!, practitionerId: cat3!.id, teamRole: 'lead', assignedBy: cat3!.id,
    })).rejects.toThrow(/Category 3|cannot be the sole Lead/i)
  })

  it('E/N: one active Lead PER CASE — a second active Lead on the SAME case is refused on every path', async (ctx) => {
    if (!armed) return ctx.skip()
    // Client-level relationship + case-level Lead for the real Lead of caseA.
    await adminAssignCareTeamMember(admin, {
      clientId: member!.id, practitionerId: lead!.id, role: 'lead', createdBy: lead!.id,
    })
    await assignCaseTeamRole(admin, { caseId: caseA!, practitionerId: lead!.id, teamRole: 'lead', assignedBy: lead!.id })
    // N: an eligible, registered second Lead on the SAME case — helper path…
    await expect(assignCaseTeamRole(admin, {
      caseId: caseA!, practitionerId: lead2!.id, teamRole: 'lead', assignedBy: lead!.id,
    })).rejects.toThrow(/duplicate key|uniq_active_lead_per_case/i)
    // …and the raw service-role INSERT is refused by the same index.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rawErr } = await (admin as any).from('case_team_roles').insert({
      case_id: caseA!, practitioner_id: lead2!.id, team_role: 'lead', assigned_by: lead!.id,
    })
    expect(rawErr?.message ?? '').toMatch(/duplicate key|uniq_active_lead_per_case/i)
  })

  it('N: an ENDED historical Lead never blocks a later Lead on that case', async (ctx) => {
    if (!armed) return ctx.skip()
    const firstLead = await assignCaseTeamRole(admin, {
      caseId: caseT!, practitionerId: lead2!.id, teamRole: 'lead', assignedBy: lead!.id,
    })
    await endCaseTeamRole(admin, firstLead, 'admin_action')
    const successor = await assignCaseTeamRole(admin, {
      caseId: caseT!, practitionerId: lead!.id, teamRole: 'lead', assignedBy: lead!.id,
    })
    expect(successor).toBeTruthy()
    await endCaseTeamRole(admin, successor, 'admin_action')
  })

  it('O: a DIFFERENT eligible Lead on a SEPARATE case for the SAME client is allowed', async (ctx) => {
    if (!armed) return ctx.skip()
    const id = await assignCaseTeamRole(admin, {
      caseId: caseA2!, practitionerId: lead2!.id, teamRole: 'lead', assignedBy: lead!.id,
    })
    expect(id).toBeTruthy() // lead holds caseA, lead2 holds caseA2 — same client, no conflict
  })

  it('G: student without a supervisor actively on the SAME case is refused', async (ctx) => {
    if (!armed) return ctx.skip()
    // No supervisor at all → CHECK refuses.
    await expect(assignCaseTeamRole(admin, {
      caseId: caseB!, practitionerId: student!.id, teamRole: 'student', assignedBy: lead!.id,
    })).rejects.toThrow(/supervisor/i)
    // Supervisor named but holds NO active role on that case → trigger refuses.
    await expect(assignCaseTeamRole(admin, {
      caseId: caseB!, practitionerId: student!.id, teamRole: 'student',
      supervisorId: lead!.id, assignedBy: lead!.id,
    })).rejects.toThrow(/supervisor/i)
  })

  it('B/P: assigned at BOTH levels but WITHOUT client approval → invisible, no Health Profile, no writes', async (ctx) => {
    if (!armed) return ctx.skip()
    await adminAssignCareTeamMember(admin, {
      clientId: member!.id, practitionerId: teamPract!.id, role: 'specialist', createdBy: lead!.id,
    })
    await assignCaseTeamRole(admin, {
      caseId: caseA!, practitionerId: teamPract!.id, teamRole: 'care_team', assignedBy: lead!.id,
    })
    const p = await signInAs(teamPract!)
    expect(await listActiveCareCases(p)).toHaveLength(0)          // B
    expect(await getCareHealthProfile(p, caseA!)).toBeNull()    // P: no consent → no bundle
    await expect(addCaseContribution(p, {
      caseId: caseA!, authorId: teamPract!.id, teamRole: 'care_team',
      kind: 'addition', content: 'attempt before approval',
    })).rejects.toThrow()
  })

  it('Q: CLIENT APPROVES through the existing consent machinery → the ONE scoped bundle opens, nothing more', async (ctx) => {
    if (!armed) return ctx.skip()
    const m = await signInAs(member!)
    await grantPractitionerAccess(m, { memberId: member!.id, memberEmail: member!.email, practitionerId: lead!.id })
    await grantPractitionerAccess(m, { memberId: member!.id, memberEmail: member!.email, practitionerId: teamPract!.id })

    const p = await signInAs(teamPract!)
    const rows = await listActiveCareCases(p)
    expect(rows).toHaveLength(1)
    expect(rows[0].case_id).toBe(caseA)

    const bundle = await getCareHealthProfile(p, caseA!)
    expect(bundle).not.toBeNull()
    const record = bundle as Record<string, unknown>
    // Care identity: name only — enough to know whom you are caring for.
    expect(record.client_full_name).toBe('Synthetic Member A')
    expect(record.presenting_concern).toBe('synthetic concern A')
    // Factual intake record surfaces.
    expect(record.stress_level).toBe(4)
    expect(record.diet_description).toBe('synthetic diet description')
    expect(record.most_want_to_understand).toBe('synthetic understanding goal')
    // The surface is EXACTLY the documented bundle: no email, phone,
    // address, religion, clinical notes or any undocumented column.
    const allowed = new Set<string>(CARE_HEALTH_PROFILE_FIELDS)
    for (const key of Object.keys(record)) expect(allowed.has(key), `unexpected field: ${key}`).toBe(true)
    for (const banned of ['email', 'phone', 'address', 'religion', 'clinical_notes_on_sex', 'client_id']) {
      expect(banned in record).toBe(false)
    }
  })

  it('R: the SAME fully-authorised active practitioner still cannot SELECT raw source tables (Sprint 5 intact)', async (ctx) => {
    if (!armed) return ctx.skip()
    const p = await signInAs(teamPract!)
    for (const table of ['intake_responses', 'intake_answers', 'lab_reports', 'biomarker_results']) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (p as any).from(table).select('*').limit(5)
      expect(data ?? [], `raw ${table} must stay closed`).toHaveLength(0)
    }
    // Raw client_cases and profiles rows for the client stay closed too.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rawCase } = await (p as any).from('client_cases').select('*').eq('id', caseA!)
    expect(rawCase ?? []).toHaveLength(0)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rawProfile } = await (p as any).from('profiles').select('*').eq('id', member!.id)
    expect(rawProfile ?? []).toHaveLength(0)
  })

  it('K/U: active practitioner on case A gets NOTHING of case B — list, contributions, Health Profile', async (ctx) => {
    if (!armed) return ctx.skip()
    const p = await signInAs(teamPract!)
    const rows = await listActiveCareCases(p)
    expect(rows.every((row) => row.case_id !== caseB)).toBe(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (p as any).from('case_contributions').select('id').eq('case_id', caseB!)
    expect(data ?? []).toHaveLength(0)
    expect(await getCareHealthProfile(p, caseB!)).toBeNull()    // U
    // The view itself yields zero rows for the foreign case.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: viewRows } = await (p as any).from('care_team_health_profile').select('case_id').eq('case_id', caseB!)
    expect(viewRows ?? []).toHaveLength(0)
  })

  it('CONTRIBUTE, NEVER OVERWRITE: attributed contribution inserts; rewriting is refused for everyone', async (ctx) => {
    if (!armed) return ctx.skip()
    const p = await signInAs(teamPract!)
    const contributionId = await addCaseContribution(p, {
      caseId: caseA!, authorId: teamPract!.id, teamRole: 'care_team', profession: 'Herbalist',
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

  it('H/I/J: Analysis & Plan writes refused for admin/service/AI (NULL auth), students, and uninvolved practitioners', async (ctx) => {
    if (!armed) return ctx.skip()
    // I/J: service-role path (admin server actions, AI pipelines, automated
    // jobs, intake, synopsis generation) — auth.uid() is NULL → trigger refuses.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: svcErr } = await (admin as any).from('case_analysis_plan')
      .insert({ case_id: caseA!, section: 'therapeutic_aims', content: 'machine text', author_id: lead!.id })
    expect(svcErr?.message ?? '').toMatch(/only the authenticated authoring practitioner/)

    // H: a student — supervised on caseA (lead is active there), linked and consented.
    await adminAssignCareTeamMember(admin, {
      clientId: member!.id, practitionerId: student!.id, role: 'temporary', createdBy: lead!.id,
    })
    studentRoleId = await assignCaseTeamRole(admin, {
      caseId: caseA!, practitionerId: student!.id, teamRole: 'student',
      supervisorId: lead!.id, assignedBy: lead!.id,
    })
    const m = await signInAs(member!)
    await grantPractitionerAccess(m, { memberId: member!.id, memberEmail: member!.email, practitionerId: student!.id })
    const s = await signInAs(student!)
    await expect(writeAnalysisSection(s, {
      caseId: caseA!, section: 'therapeutic_aims', content: 'student attempt', authorId: student!.id,
    })).rejects.toThrow(/non-student|only the authenticated/)

    // J: practitioner with NO role on case B:
    const p = await signInAs(teamPract!)
    await expect(writeAnalysisSection(p, {
      caseId: caseB!, section: 'therapeutic_aims', content: 'no involvement', authorId: teamPract!.id,
    })).rejects.toThrow(/no active authorised/)
  })

  it('STUDENT scope: contributes under supervision and sees the factual bundle, but NEVER inherits analysis access', async (ctx) => {
    if (!armed) return ctx.skip()
    const s = await signInAs(student!)
    const id = await addCaseContribution(s, {
      caseId: caseA!, authorId: student!.id, teamRole: 'student',
      kind: 'addition', content: 'Information gathered from the client, entered by the student (synthetic).',
      source: 'client_call',
    })
    expect(id).toBeTruthy()
    expect(await getCareHealthProfile(s, caseA!)).not.toBeNull()  // factual record: yes
    // Narrower than the supervisor: analysis rows are not readable by students.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: analysisRows } = await (s as any).from('case_analysis_plan').select('id').eq('case_id', caseA!)
    expect(analysisRows ?? []).toHaveLength(0)
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

  it('M: FULL VALID PATHWAY — the per-CASE Lead records coordination, then releases', async (ctx) => {
    if (!armed) return ctx.skip()
    const l = await signInAs(lead!)
    await recordLeadCoordinationReview(l, caseA!, 'Coordinated across the team (synthetic).')
    const releaseId = await releaseCarePlan(l, caseA!)
    expect(releaseId).toBeTruthy()
    // lead2 leads caseA2 but NOT caseA — the per-case check refuses them here.
    const l2 = await signInAs(lead2!)
    await expect(recordLeadCoordinationReview(l2, caseA!, 'wrong case lead')).rejects.toThrow(/not the active Lead/)
  })

  it('C/S: consent withdrawal immediately removes ALL future access — list, Health Profile, writes; audit remains', async (ctx) => {
    if (!armed) return ctx.skip()
    const m = await signInAs(member!)
    const withdrawn = await withdrawPractitionerAccess(m, teamPract!.id)
    expect(withdrawn).toBeGreaterThan(0)
    const p = await signInAs(teamPract!)
    expect(await listActiveCareCases(p)).toHaveLength(0)
    expect(await getCareHealthProfile(p, caseA!)).toBeNull()    // S
    await expect(addCaseContribution(p, {
      caseId: caseA!, authorId: teamPract!.id, teamRole: 'care_team',
      kind: 'addition', content: 'attempt after withdrawal',
    })).rejects.toThrow()
    // Audit/provenance remains: the earlier contribution still exists (service read).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: kept } = await (admin as any).from('case_contributions')
      .select('id').eq('case_id', caseA!).eq('author_id', teamPract!.id)
    expect((kept ?? []).length).toBeGreaterThan(0)
  })

  it('T: ENDING the case assignment immediately removes the Health Profile', async (ctx) => {
    if (!armed) return ctx.skip()
    // The student is still fully authorised (role + supervision + consent)…
    const s = await signInAs(student!)
    expect(await getCareHealthProfile(s, caseA!)).not.toBeNull()
    // …until the assignment ends.
    await endCaseTeamRole(admin, studentRoleId!, 'admin_action')
    expect(await getCareHealthProfile(s, caseA!)).toBeNull()
    expect(await listActiveCareCases(s)).toHaveLength(0)
  })
})
