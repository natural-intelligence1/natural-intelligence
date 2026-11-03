/*
 * Database behaviour of migration 0065 — case_events access alignment.
 *
 * The defect: case_events_practitioner_select grants a practitioner sight of
 * a client's case events on the strength of a WORK ITEM alone — no team role,
 * no eligibility for the role held, no practitioner-specific consent.
 *
 * RLS IS REAL HERE. The tables are owned by the PGlite superuser, who would
 * bypass RLS entirely, so every read runs under `set role authenticated` — a
 * plain role that owns nothing. Without that the denial tests would pass
 * while proving nothing.
 *
 * Purpose-built synthetic fixtures only, all is_test_data. No real health
 * data: payloads are the literal string 'synthetic'.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const M0064 = join(HERE, '../../../../supabase/migrations/0064_practitioner_eligibility_spine.sql')
const M0065 = join(HERE, '../../../../supabase/migrations/0065_case_events_access_alignment.sql')
const SCAFFOLD = join(HERE, '__fixtures__/eligibilityScaffold.sql')

let db: PGlite
let VERIFIER: string

const rows = async <T = Record<string, unknown>>(sql: string): Promise<T[]> =>
  (await db.query<T>(sql)).rows

/** Read case_events AS the given practitioner, under real RLS. */
async function readAs(uid: string): Promise<number> {
  await db.exec(`select set_config('test.auth_uid', '${uid}', false);`)
  await db.exec(`set role authenticated;`)
  try {
    const r = await db.query<{ n: number }>(`select count(*)::int as n from case_events`)
    return r.rows[0].n
  } finally {
    await db.exec(`reset role;`)
    await db.exec(`select set_config('test.auth_uid', '', false);`)
  }
}

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

/** Fully-evidenced Category 2 practitioner, scoped to the given roles. */
async function mkQualified(roles: string[]): Promise<string> {
  const p = await mkPractitioner('accredited_practitioner')
  await addCredential(p, 'accredited_register', 'reg_test')
  await addIndemnity(p, 6000000)
  await addScope(p, roles)
  await acceptAgreement(p, 'accredited_practitioner')
  await db.exec(`insert into indemnity_requirements (requirement_source, source_key, minimum_cover, source_reference)
                 values ('accredited_register','reg_test',1,'test fixture') on conflict do nothing;`)
  return p
}

/** Student evidence path: no category, enrolment, £4m, student scope. */
async function mkStudent(): Promise<string> {
  const p = await mkPractitioner(null)
  await addCredential(p, 'student_enrolment', 'school', 'not_applicable')
  await addIndemnity(p, 4000000)
  await addScope(p, ['student'])
  return p
}

async function mkCaseWithEvent(): Promise<{ caseId: string; clientId: string }> {
  const c = await rows<{ id: string }>(
    `insert into profiles (full_name, role, is_test_data) values ('TEST — Client','user',true) returning id;`)
  const k = await rows<{ id: string }>(
    `insert into client_cases (client_id) values ('${c[0].id}') returning id;`)
  await db.exec(`insert into case_events (case_id, event_type, payload)
                 values ('${k[0].id}','practitioner_note','"synthetic"'::jsonb);`)
  return { caseId: k[0].id, clientId: c[0].id }
}

const link = (clientId: string, pid: string) =>
  db.exec(`insert into client_practitioner_links (client_id, practitioner_id) values ('${clientId}','${pid}');`)
const consent = (clientId: string, pid: string) =>
  db.exec(`insert into consent_records (profile_id, consent_type, context_practitioner_id)
           values ('${clientId}','practitioner_access','${pid}');`)
const workItem = (caseId: string, pid: string) =>
  db.exec(`insert into case_practitioner_work (case_id, practitioner_id, work_type, status)
           values ('${caseId}','${pid}','case_review','assigned');`)
const teamRole = (caseId: string, pid: string, role: string, supervisor?: string) =>
  db.exec(`insert into case_team_roles (case_id, practitioner_id, team_role, supervisor_id)
           values ('${caseId}','${pid}','${role}', ${supervisor ? `'${supervisor}'` : 'null'});`)

beforeAll(async () => {
  db = new PGlite()
  await db.exec(readFileSync(SCAFFOLD, 'utf8'))
  await db.exec(readFileSync(M0064, 'utf8'))
  await db.exec(readFileSync(M0065, 'utf8'))
})
afterAll(async () => { await db?.close() })

beforeEach(async () => {
  await db.exec(`
    reset role;
    select set_config('test.auth_uid', '', false);
    delete from case_events;
    delete from case_team_roles;
    delete from case_practitioner_work;
    delete from client_practitioner_links;
    delete from consent_records;
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

// ── The defect, and that 0065 actually closes it ───────────────────────────

describe('a work item alone no longer grants sight of case events', () => {
    it('BETWEEN 0064 and 0065 the stale policy is gone and read is DENIED', async () => {
      // The intermediate state must not carry the old work-item rule. 0064
      // installs a temporary USING (false) precisely so this window is a
      // denial rather than a transient grant. The historical grant itself is
      // proven in caseEventsThreeState.db.test.ts, STATE 1.
      const old = new PGlite()
      try {
        await old.exec(readFileSync(SCAFFOLD, 'utf8'))
        await old.exec(readFileSync(M0064, 'utf8'))   // 0064 but NOT 0065

        const pol = (await old.query<{ q: string }>(`
          select coalesce(pg_get_expr(polqual, polrelid),'') as q
            from pg_policy pol join pg_class c on c.oid = pol.polrelid
           where c.relname='case_events' and pol.polname='case_events_practitioner_select'`)).rows[0].q
        expect(pol).toBe('false')
        expect(pol).not.toContain('case_practitioner_work')

        const c = (await old.query<{ id: string }>(
          `insert into profiles (full_name, role) values ('C','user') returning id`)).rows[0].id
        const k = (await old.query<{ id: string }>(
          `insert into client_cases (client_id) values ('${c}') returning id`)).rows[0].id
        await old.exec(`insert into case_events (case_id, event_type) values ('${k}','practitioner_note')`)
        const p = (await old.query<{ id: string }>(
          `insert into practitioners (display_name, status, is_active) values ('P','active',true) returning id`)).rows[0].id
        await old.exec(`alter table case_practitioner_work disable trigger trg_enforce_assignable_work;`)
        await old.exec(`insert into case_practitioner_work (case_id, practitioner_id, work_type, status)
                        values ('${k}','${p}','case_review','assigned')`)
        await old.exec(`alter table case_practitioner_work enable trigger trg_enforce_assignable_work;`)

        await old.exec(`select set_config('test.auth_uid', '${p}', false);`)
        await old.exec(`set role authenticated;`)
        const n = (await old.query<{ n: number }>(`select count(*)::int as n from case_events`)).rows[0].n
        await old.exec(`reset role;`)
        expect(n).toBe(0)   // fail-closed, not the old grant
      } finally {
        await old.close()
      }
    })

  it('E. AFTER 0065, a work item alone reads NOTHING', async () => {
    const p = await mkQualified(['care_team'])
    const { caseId } = await mkCaseWithEvent()
    await workItem(caseId, p)
    expect(await readAs(p)).toBe(0)
  })

  it('work item + team role but NO consent reads nothing', async () => {
    const p = await mkQualified(['care_team'])
    const { caseId, clientId } = await mkCaseWithEvent()
    await link(clientId, p); await workItem(caseId, p)
    await teamRole(caseId, p, 'care_team')
    expect(await readAs(p)).toBe(0)
  })

  it('work item + team role + consent but INELIGIBLE for the recorded role reads nothing', async () => {
    const p = await mkQualified(['care_team'])   // not scoped for lead
    const { caseId, clientId } = await mkCaseWithEvent()
    await link(clientId, p); await consent(clientId, p); await workItem(caseId, p)
    await teamRole(caseId, p, 'care_team')
    expect(await readAs(p)).toBe(1)              // honest role: allowed

    // Corrupt the role to 'lead', which they are not scoped for.
    await db.exec(`alter table case_team_roles disable trigger trg_case_team_role_rules;`)
    await db.exec(`update case_team_roles set team_role='lead' where case_id='${caseId}';`)
    await db.exec(`alter table case_team_roles enable trigger trg_case_team_role_rules;`)
    expect(await readAs(p)).toBe(0)              // role-aware eligibility refuses
  })
})

// ── The required access matrix ─────────────────────────────────────────────

describe('canonical chain — the full access matrix', () => {
  it('A. care_team practitioner with role, eligibility and consent: READ ALLOWED', async () => {
    const p = await mkQualified(['care_team'])
    const { caseId, clientId } = await mkCaseWithEvent()
    await link(clientId, p); await consent(clientId, p)
    await teamRole(caseId, p, 'care_team')
    expect(await readAs(p)).toBe(1)
  })

  it('B. same practitioner recorded as lead with only care_team scope: READ DENIED', async () => {
    const p = await mkQualified(['care_team'])
    const { caseId, clientId } = await mkCaseWithEvent()
    await link(clientId, p); await consent(clientId, p)
    await db.exec(`alter table case_team_roles disable trigger trg_case_team_role_rules;`)
    await teamRole(caseId, p, 'lead')
    await db.exec(`alter table case_team_roles enable trigger trg_case_team_role_rules;`)
    expect(await readAs(p)).toBe(0)
  })

  it('C. student with evidence, valid supervisor and consent: READ ALLOWED', async () => {
    const sup = await mkQualified(['care_team'])
    const stu = await mkStudent()
    const { caseId, clientId } = await mkCaseWithEvent()
    await link(clientId, sup); await link(clientId, stu)
    await consent(clientId, stu)
    await teamRole(caseId, sup, 'care_team')
    await teamRole(caseId, stu, 'student', sup)
    expect(await readAs(stu)).toBe(1)
  })

  it('D. same student whose supervisor role has ended: READ DENIED', async () => {
    const sup = await mkQualified(['care_team'])
    const stu = await mkStudent()
    const { caseId, clientId } = await mkCaseWithEvent()
    await link(clientId, sup); await link(clientId, stu)
    await consent(clientId, stu)
    await teamRole(caseId, sup, 'care_team')
    await teamRole(caseId, stu, 'student', sup)
    expect(await readAs(stu)).toBe(1)

    // The supervisor leaves the case. The student row survives — a stale row.
    await db.exec(`update case_team_roles set ended_at = now()
                    where case_id='${caseId}' and practitioner_id='${sup}';`)
    expect(await readAs(stu)).toBe(0)
  })

  it('F. team role + eligibility but no consent: READ DENIED', async () => {
    const p = await mkQualified(['care_team'])
    const { caseId, clientId } = await mkCaseWithEvent()
    await link(clientId, p)
    await teamRole(caseId, p, 'care_team')
    expect(await readAs(p)).toBe(0)
  })

  it('G. consent + team role but ineligible (expired indemnity): READ DENIED', async () => {
    const p = await mkQualified(['care_team'])
    const { caseId, clientId } = await mkCaseWithEvent()
    await link(clientId, p); await consent(clientId, p)
    await teamRole(caseId, p, 'care_team')
    expect(await readAs(p)).toBe(1)

    // Yesterday. No job runs; the date alone decides.
    await db.exec(`update practitioner_indemnity set expiry_date = current_date - 1
                    where practitioner_id='${p}';`)
    expect(await readAs(p)).toBe(0)
  })

  it('H. ended team role: READ DENIED', async () => {
    const p = await mkQualified(['care_team'])
    const { caseId, clientId } = await mkCaseWithEvent()
    await link(clientId, p); await consent(clientId, p)
    await teamRole(caseId, p, 'care_team')
    expect(await readAs(p)).toBe(1)
    await db.exec(`update case_team_roles set ended_at = now() where case_id='${caseId}';`)
    expect(await readAs(p)).toBe(0)
  })

  it('I. withdrawn consent: READ DENIED', async () => {
    const p = await mkQualified(['care_team'])
    const { caseId, clientId } = await mkCaseWithEvent()
    await link(clientId, p); await consent(clientId, p)
    await teamRole(caseId, p, 'care_team')
    expect(await readAs(p)).toBe(1)
    await db.exec(`update consent_records set withdrawn_at = now()
                    where profile_id='${clientId}' and context_practitioner_id='${p}';`)
    expect(await readAs(p)).toBe(0)
  })

  it('also denies when the client-practitioner link has ended', async () => {
    const p = await mkQualified(['care_team'])
    const { caseId, clientId } = await mkCaseWithEvent()
    await link(clientId, p); await consent(clientId, p)
    await teamRole(caseId, p, 'care_team')
    expect(await readAs(p)).toBe(1)
    await db.exec(`update client_practitioner_links set ended_at = now()
                    where client_id='${clientId}' and practitioner_id='${p}';`)
    expect(await readAs(p)).toBe(0)
  })
})

// ── Client access must survive the repair ──────────────────────────────────

describe('J. client access to their own case events is preserved', () => {
  it('a client still reads their own case events', async () => {
    const { clientId } = await mkCaseWithEvent()
    expect(await readAs(clientId)).toBe(1)
  })

  it('a client cannot read another client’s case events', async () => {
    const mine = await mkCaseWithEvent()
    await mkCaseWithEvent()                       // someone else's case + event
    expect(await readAs(mine.clientId)).toBe(1)   // exactly their own, not both
  })

  it('the member and service policies were not modified by 0065', async () => {
    const defs = await rows<{ policyname: string; qual: string }>(`
      select policyname, pg_get_expr(polqual, polrelid) as qual
        from pg_policy pol join pg_class c on c.oid = pol.polrelid
        join pg_policies pp on pp.policyname = pol.polname and pp.tablename = c.relname
       where c.relname = 'case_events' order by policyname`)
    const member = defs.find((d) => d.policyname === 'case_events_member_select')!
    const service = defs.find((d) => d.policyname === 'case_events_service_all')!
    expect(member.qual).toContain('client_cases')
    expect(member.qual).toContain('client_id')
    expect(service.qual).toContain('service_role')
  })
})

// ── The policy delegates rather than restating the chain ───────────────────

describe('the policy holds no duplicated rules', () => {
  it('calls the canonical function and nothing else', async () => {
    const r = await rows<{ qual: string }>(`
      select pg_get_expr(polqual, polrelid) as qual
        from pg_policy pol join pg_class c on c.oid = pol.polrelid
       where c.relname='case_events' and pol.polname='case_events_practitioner_select'`)
    expect(r[0].qual).toContain('can_access_case_care_profile')
    // No credential, indemnity, scope, agreement, DBS, category or work-item
    // logic restated inside the policy.
    for (const leak of ['case_practitioner_work', 'practitioner_credentials', 'practitioner_indemnity',
                        'practitioner_scope', 'dbs_status', 'category', 'cover_amount']) {
      expect(r[0].qual).not.toContain(leak)
    }
  })

  it('0065 refuses to apply without 0064', async () => {
    const bare = new PGlite()
    try {
      await bare.exec(readFileSync(SCAFFOLD, 'utf8'))
      let msg = ''
      try { await bare.exec(readFileSync(M0065, 'utf8')) }
      catch (e) { msg = String((e as Error).message ?? e) }
      await bare.exec('rollback;').catch(() => {})
      expect(msg).toMatch(/0065 requires 0064/)
    } finally {
      await bare.close()
    }
  })
})
