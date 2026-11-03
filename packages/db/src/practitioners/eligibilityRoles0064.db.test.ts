/*
 * 0064 hardening: role-specific authority must not be lost.
 *
 * The compatibility wrapper answers "eligible for ANY role". That is not the
 * same question as "eligible for THIS role", and the floors, permitted_roles
 * and the Category 3 Lead rule are all role-dependent. These tests prove that
 * no role-specific decision rests on the wrapper: a practitioner scoped only
 * to care_team is refused a real Lead assignment by the real trigger, not
 * merely by a function return value.
 *
 * Purpose-built fixtures only, all is_test_data. No real data.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const MIGRATION = join(HERE, '../../../../supabase/migrations/0064_practitioner_eligibility_spine.sql')
const SCAFFOLD = join(HERE, '__fixtures__/eligibilityScaffold.sql')

let db: PGlite
let VERIFIER: string

const rows = async <T = Record<string, unknown>>(sql: string): Promise<T[]> =>
  (await db.query<T>(sql)).rows

async function refusal(sql: string): Promise<string> {
  try { await db.exec(sql) } catch (e) { return String((e as Error).message ?? e) }
  throw new Error('expected the database to refuse this statement, but it succeeded')
}

interface Verdict { eligible: boolean; blockers: string[]; eligible_roles: string[] }
const verdict = async (id: string, role?: string): Promise<Verdict> =>
  (await rows<Verdict>(
    `select eligible, blockers, eligible_roles
       from practitioner_eligibility('${id}'::uuid, ${role ? `'${role}'` : 'null'})`))[0]

async function mkPractitioner(category: string | null): Promise<string> {
  const r = await rows<{ id: string }>(`
    insert into practitioners (display_name, category, status, is_active, dbs_status, is_test_data)
    values ('TEST — Practitioner', ${category === null ? 'null' : `'${category}'`},
            'active', true, 'not_required', true) returning id;`)
  return r[0].id
}

async function addCredential(pid: string, type: string, bodyKey: string, standing = 'current') {
  await db.exec(`
    insert into practitioner_credentials
      (practitioner_id, credential_type, issuing_body, issuing_body_key, evidence_reference,
       verification_status, verified_by, verified_at, standing_status, is_test_data)
    values ('${pid}','${type}','TEST Body','${bodyKey}','storage://test/evidence',
            'verified','${VERIFIER}', now(), '${standing}', true);`)
}

async function addIndemnity(pid: string, cover: number) {
  await db.exec(`
    insert into practitioner_indemnity
      (practitioner_id, insurer, policy_number, cover_amount, currency, expiry_date,
       evidence_reference, verification_status, verified_by, verified_at, is_test_data)
    values ('${pid}','TEST Insurer','POL-1',${cover},'GBP','2099-12-31',
            'storage://test/policy','verified','${VERIFIER}', now(), true);`)
}

async function addScope(pid: string, roles: string[]) {
  await db.exec(`
    insert into practitioner_scope
      (practitioner_id, approved_scope, permitted_roles, status, approver, approval_date, is_test_data)
    values ('${pid}','TEST scope', array[${roles.map((r) => `'${r}'`).join(',')}]::text[],
            'approved','${VERIFIER}', now(), true);`)
}

async function acceptAgreement(pid: string, category: string) {
  const a = await rows<{ id: string }>(`
    insert into practitioner_agreements (category, version, body, is_current)
    values ('${category}','v1','AGREEMENT BODY', true) returning id;`)
  await db.exec(`
    insert into practitioner_agreement_acceptances
      (practitioner_id, agreement_id, agreement_version, accepted_text_hash)
    values ('${pid}','${a[0].id}','v1', encode(extensions.digest('AGREEMENT BODY','sha256'),'hex'));`)
}

async function configureBody(source: string, key: string) {
  await db.exec(`insert into indemnity_requirements
      (requirement_source, source_key, minimum_cover, source_reference)
    values ('${source}','${key}', 1, 'test fixture') on conflict do nothing;`)
}

/** Category 1, every gate open, scope limited to the given roles. */
async function mkCategory1(roles: string[]): Promise<string> {
  const p = await mkPractitioner('regulated_healthcare_professional')
  await addCredential(p, 'statutory_registration', 'gmc_test')
  await addIndemnity(p, 6000000)
  await addScope(p, roles)
  await acceptAgreement(p, 'regulated_healthcare_professional')
  await configureBody('regulator', 'gmc_test')
  return p
}

async function mkCase(): Promise<{ caseId: string; clientId: string }> {
  const c = await rows<{ id: string }>(
    `insert into profiles (full_name, role, is_test_data) values ('TEST — Client','user',true) returning id;`)
  const k = await rows<{ id: string }>(
    `insert into client_cases (client_id) values ('${c[0].id}') returning id;`)
  return { caseId: k[0].id, clientId: c[0].id }
}

beforeAll(async () => {
  db = new PGlite()
  await db.exec(readFileSync(SCAFFOLD, 'utf8'))
  await db.exec(readFileSync(MIGRATION, 'utf8'))
})
afterAll(async () => { await db?.close() })

beforeEach(async () => {
  // Dependency order: the evidence tables are ON DELETE RESTRICT by design,
  // so this helper deletes children before parents rather than relying on
  // cascade. The broad dev/test cleanup architecture is untouched.
  await db.exec(`
    select set_config('test.auth_uid', '', false);
    delete from case_team_roles;
    delete from case_practitioner_work;
    delete from client_practitioner_links;
    delete from consent_records;
    delete from care_plan_coordination;
    delete from case_analysis_plan;
    delete from client_cases;
    delete from practitioner_credentials;
    delete from practitioner_indemnity;
    delete from practitioner_scope;
    delete from practitioner_agreement_acceptances;
    delete from practitioner_agreements;
    delete from practitioners;
    delete from profiles;
    delete from indemnity_requirements where requirement_source <> 'ni_role_floor';`)
  const v = await rows<{ id: string }>(
    `insert into profiles (full_name, role, is_test_data) values ('TEST — Admin','admin',true) returning id;`)
  VERIFIER = v[0].id
})

describe('role-specific authority is enforced end to end', () => {
  it('care_team-only scope: eligible for care_team, refused for lead', async () => {
    const p = await mkCategory1(['care_team'])
    const asTeam = await verdict(p, 'care_team')
    const asLead = await verdict(p, 'lead')

    expect(asTeam.eligible).toBe(true)
    expect(asTeam.blockers).toEqual([])
    expect(asLead.eligible).toBe(false)
    expect(asLead.blockers).toContain('scope_role_not_permitted')
  })

  it('RELEASE BLOCKER CHECK — a real Lead insert for that practitioner is REJECTED', async () => {
    const p = await mkCategory1(['care_team'])
    const { caseId } = await mkCase()

    const msg = await refusal(
      `insert into case_team_roles (case_id, practitioner_id, team_role)
       values ('${caseId}','${p}','lead');`)
    expect(msg).toMatch(/not assignable as lead/)
    expect(msg).toMatch(/scope_role_not_permitted/)

    expect((await rows(`select 1 from case_team_roles where case_id='${caseId}'`)).length).toBe(0)
  })

  it('the same practitioner IS accepted as care_team on a real insert', async () => {
    const p = await mkCategory1(['care_team'])
    const { caseId } = await mkCase()
    await db.exec(`insert into case_team_roles (case_id, practitioner_id, team_role)
                   values ('${caseId}','${p}','care_team');`)
    expect((await rows(`select 1 from case_team_roles where case_id='${caseId}'`)).length).toBe(1)
  })

  it('inverse — lead-only scope: a real care_team insert is REJECTED', async () => {
    const p = await mkCategory1(['lead'])
    const { caseId } = await mkCase()
    const msg = await refusal(
      `insert into case_team_roles (case_id, practitioner_id, team_role)
       values ('${caseId}','${p}','care_team');`)
    expect(msg).toMatch(/not assignable as care_team/)
    expect(msg).toMatch(/scope_role_not_permitted/)
  })

  it('the wrapper alone would have let the Lead through — which is why callers no longer use it', async () => {
    const p = await mkCategory1(['care_team'])
    const legacy = (await rows<{ eligible: boolean }>(
      `select * from practitioner_assignment_eligibility('${p}'::uuid)`))[0]
    expect(legacy.eligible).toBe(true)                      // "eligible for SOME role"
    expect((await verdict(p, 'lead')).eligible).toBe(false) // but not for lead
  })
})

describe('student role-specific regression', () => {
  async function mkStudentEvid(): Promise<string> {
    const p = await mkPractitioner(null)
    await addCredential(p, 'student_enrolment', 'school', 'not_applicable')
    await addIndemnity(p, 4000000)
    await addScope(p, ['student'])
    return p
  }

  it('is evidence-eligible for student, and refused for both qualified roles', async () => {
    const p = await mkStudentEvid()
    expect((await verdict(p, 'student')).eligible).toBe(true)
    expect((await verdict(p, 'lead')).eligible).toBe(false)
    expect((await verdict(p, 'care_team')).eligible).toBe(false)
  })

  it('a real student case-team insert still requires a valid supervisor', async () => {
    const p = await mkStudentEvid()
    const { caseId } = await mkCase()

    // No supervisor named. The BEFORE INSERT trigger fires ahead of the table
    // CHECK, so its clearer message is what the caller sees; the CHECK remains
    // as a second line of defence if the trigger is ever disabled.
    expect(await refusal(
      `insert into case_team_roles (case_id, practitioner_id, team_role)
       values ('${caseId}','${p}','student');`))
      .toMatch(/requires a named supervisor holding an active role/)

    // Supervisor named but holding no active role on this case — refused by
    // the case-specific trigger. The eligibility function never claimed to
    // answer this, and still does not.
    const other = await mkPractitioner('accredited_practitioner')
    expect(await refusal(
      `insert into case_team_roles (case_id, practitioner_id, team_role, supervisor_id)
       values ('${caseId}','${p}','student','${other}');`))
      .toMatch(/requires a named supervisor holding an active role/)
  })
})

describe('can_access_case_care_profile evaluates the role actually held', () => {
  it('refuses when the held role is one the practitioner is not scoped for', async () => {
    // Defence in depth: a stale or corrupt 'lead' row must not borrow the
    // authority of a care_team-only scope.
    const p = await mkCategory1(['care_team'])
    const { caseId, clientId } = await mkCase()

    await db.exec(`insert into client_practitioner_links (client_id, practitioner_id)
                   values ('${clientId}','${p}');`)
    await db.exec(`insert into consent_records (profile_id, consent_type, context_practitioner_id)
                   values ('${clientId}','practitioner_access','${p}');`)
    await db.exec(`insert into case_team_roles (case_id, practitioner_id, team_role)
                   values ('${caseId}','${p}','care_team');`)

    await db.exec(`select set_config('test.auth_uid', '${p}', false);`)

    // Honest role: access granted.
    expect((await rows<{ ok: boolean }>(
      `select can_access_case_care_profile('${caseId}'::uuid) as ok`))[0].ok).toBe(true)

    // Corrupt the role row to 'lead' behind the trigger's back.
    await db.exec(`alter table case_team_roles disable trigger trg_case_team_role_rules;`)
    await db.exec(`update case_team_roles set team_role='lead' where case_id='${caseId}';`)
    await db.exec(`alter table case_team_roles enable trigger trg_case_team_role_rules;`)

    // Access is now refused: eligibility is judged against 'lead', which this
    // practitioner is not scoped for. "Eligible for some other role" is not
    // accepted as sufficient.
    expect((await rows<{ ok: boolean }>(
      `select can_access_case_care_profile('${caseId}'::uuid) as ok`))[0].ok).toBe(false)
  })
})

describe('genuinely role-neutral callers stay role-neutral', () => {
  it('case_practitioner_work carries work_type, not a case role, so it asks the neutral question', async () => {
    const p = await mkCategory1(['care_team'])
    const { caseId } = await mkCase()
    // Eligible for care_team but not lead; a work item is not a role grant,
    // so it is accepted.
    await db.exec(`insert into case_practitioner_work (case_id, practitioner_id, work_type)
                   values ('${caseId}','${p}','case_review');`)
    expect((await rows(`select 1 from case_practitioner_work where case_id='${caseId}'`)).length).toBe(1)
  })

  it('a practitioner eligible for NO role is refused a work item', async () => {
    const p = await mkPractitioner('accredited_practitioner')   // no evidence at all
    const { caseId } = await mkCase()
    expect(await refusal(`insert into case_practitioner_work (case_id, practitioner_id, work_type)
                          values ('${caseId}','${p}','case_review');`))
      .toMatch(/practitioner not assignable/)
  })

  it('client_practitioner_links role=lead is evaluated strictly as lead', async () => {
    const p = await mkCategory1(['care_team'])          // not scoped for lead
    const { clientId } = await mkCase()
    expect(await refusal(`insert into client_practitioner_links (client_id, practitioner_id, role)
                          values ('${clientId}','${p}','lead');`))
      .toMatch(/scope_role_not_permitted/)
  })

  it('client_practitioner_links non-lead roles are NOT silently mapped onto care_team', async () => {
    // 'specialist' belongs to a different vocabulary (lead|specialist|
    // reviewer|temporary) with no canonical counterpart. It falls back to the
    // neutral question rather than inventing a mapping.
    const p = await mkCategory1(['care_team'])
    const { clientId } = await mkCase()
    await db.exec(`insert into client_practitioner_links (client_id, practitioner_id, role)
                   values ('${clientId}','${p}','specialist');`)
    expect((await rows(`select 1 from client_practitioner_links where client_id='${clientId}'`)).length).toBe(1)
  })
})
