/*
 * The release timeline, proven as three distinct database states.
 *
 * The release rule is: a transient DENIAL is acceptable, a transient GRANT is
 * not. These tests exist to prove the sequence contains no grant at any point:
 *
 *   STATE 1  PRE-0064              work item alone  -> ALLOWED  (the defect)
 *   STATE 2  POST-0064 / PRE-0065  everything       -> DENIED   (fail-closed)
 *   STATE 3  POST-0065             canonical chain  -> ALLOWED
 *
 * Each state is a SEPARATE PGlite database built to exactly that point, so
 * the assertions describe the real intermediate schema rather than a
 * simulation of it. Client and service-role access is checked in all three.
 *
 * RLS is real: reads run under `set role authenticated`, a role that owns
 * nothing. Purpose-built synthetic fixtures only; payloads are the literal
 * string 'synthetic'. No real health data.
 */
import { describe, it, expect } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCAFFOLD = readFileSync(join(HERE, '__fixtures__/eligibilityScaffold.sql'), 'utf8')
const M0064 = readFileSync(join(HERE, '../../../../supabase/migrations/0064_practitioner_eligibility_spine.sql'), 'utf8')
const M0065 = readFileSync(join(HERE, '../../../../supabase/migrations/0065_case_events_access_alignment.sql'), 'utf8')

type Stage = 'pre0064' | 'post0064' | 'post0065'

interface World {
  db: PGlite
  practitioner: string
  student: string
  supervisor: string
  client: string
  caseId: string
}

/** Build a database at the given point in the release, fully populated. */
async function build(stage: Stage): Promise<World> {
  const db = new PGlite()
  await db.exec(SCAFFOLD)

  const one = async (sql: string): Promise<string> =>
    (await db.query<{ id: string }>(sql)).rows[0].id

  const verifier = await one(
    `insert into profiles (full_name, role, is_test_data) values ('TEST — Admin','admin',true) returning id`)
  const client = await one(
    `insert into profiles (full_name, role, is_test_data) values ('TEST — Client','user',true) returning id`)
  const caseId = await one(
    `insert into client_cases (client_id) values ('${client}') returning id`)
  await db.exec(
    `insert into case_events (case_id, event_type, payload)
     values ('${caseId}','practitioner_note','"synthetic"'::jsonb)`)

  const mkPract = async (category: string | null) => one(
    `insert into practitioners (display_name, category, status, is_active, dbs_status, is_test_data)
     values ('TEST — Practitioner', ${category === null ? 'null' : `'${category}'`},
             'active', true, 'not_required', true) returning id`)

  const practitioner = await mkPract('accredited_practitioner')
  const supervisor = await mkPract('accredited_practitioner')
  const student = await mkPract(null)

  // Relationship rows first, while the scaffold's permissive trigger stubs
  // are still in place, so fixture construction is never gated by the write
  // rules 0064 installs. These exist identically in all three states.
  for (const p of [practitioner, supervisor, student]) {
    await db.exec(`insert into client_practitioner_links (client_id, practitioner_id)
                   values ('${client}','${p}')`)
    await db.exec(`insert into consent_records (profile_id, consent_type, context_practitioner_id)
                   values ('${client}','practitioner_access','${p}')`)
    await db.exec(`insert into case_practitioner_work (case_id, practitioner_id, work_type, status)
                   values ('${caseId}','${p}','case_review','assigned')`)
  }
  await db.exec(`insert into case_team_roles (case_id, practitioner_id, team_role)
                 values ('${caseId}','${supervisor}','care_team')`)
  await db.exec(`insert into case_team_roles (case_id, practitioner_id, team_role)
                 values ('${caseId}','${practitioner}','lead')`)
  await db.exec(`insert into case_team_roles (case_id, practitioner_id, team_role, supervisor_id)
                 values ('${caseId}','${student}','student','${supervisor}')`)

  // 0064 CREATES the evidence tables, so it must run before they are filled.
  if (stage !== 'pre0064') await db.exec(M0064)

  // Evidence is identical in states 2 and 3, so the only thing differing
  // between those databases is the migration level, never the fixture data.
  if (stage !== 'pre0064') {
    for (const p of [practitioner, supervisor]) {
      await db.exec(`insert into practitioner_credentials
          (practitioner_id, credential_type, issuing_body, issuing_body_key, evidence_reference,
           verification_status, verified_by, verified_at, standing_status, is_test_data)
        values ('${p}','accredited_register','TEST Body','reg_test','storage://e',
                'verified','${verifier}', now(), 'current', true)`)
      await db.exec(`insert into practitioner_indemnity
          (practitioner_id, insurer, cover_amount, currency, expiry_date, evidence_reference,
           verification_status, verified_by, verified_at, is_test_data)
        values ('${p}','TEST Insurer',6000000,'GBP','2099-12-31','storage://p',
                'verified','${verifier}', now(), true)`)
      await db.exec(`insert into practitioner_scope
          (practitioner_id, approved_scope, permitted_roles, status, approver, approval_date, is_test_data)
        values ('${p}','TEST scope', array['lead','care_team']::text[],'approved','${verifier}', now(), true)`)
    }
    const agr = await one(
      `insert into practitioner_agreements (category, version, body, is_current)
       values ('accredited_practitioner','v1','AGREEMENT BODY', true) returning id`)
    for (const p of [practitioner, supervisor]) {
      await db.exec(`insert into practitioner_agreement_acceptances
          (practitioner_id, agreement_id, agreement_version, accepted_text_hash)
        values ('${p}','${agr}','v1', encode(extensions.digest('AGREEMENT BODY','sha256'),'hex'))`)
    }
    await db.exec(`insert into practitioner_credentials
        (practitioner_id, credential_type, issuing_body, issuing_body_key, evidence_reference,
         verification_status, verified_by, verified_at, standing_status, is_test_data)
      values ('${student}','student_enrolment','TEST School','school','storage://e',
              'verified','${verifier}', now(), 'not_applicable', true)`)
    await db.exec(`insert into practitioner_indemnity
        (practitioner_id, insurer, cover_amount, currency, expiry_date, evidence_reference,
         verification_status, verified_by, verified_at, is_test_data)
      values ('${student}','TEST Insurer',4000000,'GBP','2099-12-31','storage://p',
              'verified','${verifier}', now(), true)`)
    await db.exec(`insert into practitioner_scope
        (practitioner_id, approved_scope, permitted_roles, status, approver, approval_date, is_test_data)
      values ('${student}','TEST scope', array['student']::text[],'approved','${verifier}', now(), true)`)
  }

  // Indemnity floor for the external body the credentials above name.
  // Without it the practitioners are indemnity_requirement_unknown.
  if (stage !== 'pre0064') {
    await db.exec(`insert into indemnity_requirements
        (requirement_source, source_key, minimum_cover, source_reference)
      values ('accredited_register','reg_test',1,'test fixture') on conflict do nothing`)
  }

  if (stage === 'post0065') await db.exec(M0065)

  return { db, practitioner, student, supervisor, client, caseId }
}

/** Read case_events as the given identity, under real RLS. */
async function readAs(db: PGlite, uid: string, role: 'authenticated' | 'service' = 'authenticated') {
  await db.exec(`select set_config('test.auth_uid', '${uid}', false);`)
  if (role === 'service') await db.exec(`select set_config('test.auth_role', 'service_role', false);`)
  await db.exec(`set role authenticated;`)
  try {
    return (await db.query<{ n: number }>(`select count(*)::int as n from case_events`)).rows[0].n
  } finally {
    await db.exec(`reset role;`)
    await db.exec(`select set_config('test.auth_uid', '', false);`)
    await db.exec(`select set_config('test.auth_role', '', false);`)
  }
}

const policyExpr = async (db: PGlite, name: string): Promise<string> =>
  (await db.query<{ q: string }>(`
    select coalesce(pg_get_expr(polqual, polrelid),'') as q
      from pg_policy pol join pg_class c on c.oid = pol.polrelid
     where c.relname='case_events' and pol.polname='${name}'`)).rows[0]?.q ?? '(absent)'

// ── STATE 1 — PRE-0064: the historical defect ─────────────────────────────

describe('STATE 1 — PRE-0064', () => {
  it('a work item alone grants practitioner read (the defect)', async () => {
    const w = await build('pre0064')
    try {
      expect(await policyExpr(w.db, 'case_events_practitioner_select')).toContain('case_practitioner_work')
      expect(await readAs(w.db, w.practitioner)).toBe(1)
      expect(await readAs(w.db, w.student)).toBe(1)
      expect(await readAs(w.db, w.client)).toBe(1)
    } finally { await w.db.close() }
  })
})

// ── STATE 2 — POST-0064 / PRE-0065: fail-closed ───────────────────────────

describe('STATE 2 — POST-0064 / PRE-0065 is fail-closed', () => {
  it('the practitioner policy is the temporary deny, not the stale work-item rule', async () => {
    const w = await build('post0064')
    try {
      const q = await policyExpr(w.db, 'case_events_practitioner_select')
      expect(q).toBe('false')
      expect(q).not.toContain('case_practitioner_work')
    } finally { await w.db.close() }
  })

  it('work item alone: DENIED', async () => {
    const w = await build('post0064')
    try { expect(await readAs(w.db, w.student)).toBe(0) } finally { await w.db.close() }
  })

  it('valid team role + eligibility + consent: ALSO DENIED, temporarily', async () => {
    const w = await build('post0064')
    try {
      // This practitioner would pass the full canonical chain under 0065.
      const v = (await w.db.query<{ eligible: boolean }>(
        `select eligible from practitioner_eligibility('${w.practitioner}'::uuid,'lead')`)).rows[0]
      expect(v.eligible).toBe(true)          // genuinely eligible …
      expect(await readAs(w.db, w.practitioner)).toBe(0)   // … and still denied
    } finally { await w.db.close() }
  })

  it('client own-case read: ALLOWED', async () => {
    const w = await build('post0064')
    try { expect(await readAs(w.db, w.client)).toBe(1) } finally { await w.db.close() }
  })

  it('service role: ALLOWED', async () => {
    const w = await build('post0064')
    try { expect(await readAs(w.db, w.practitioner, 'service')).toBe(1) } finally { await w.db.close() }
  })
})

// ── STATE 3 — POST-0065: the canonical chain ──────────────────────────────

describe('STATE 3 — POST-0065 is the canonical chain', () => {
  it('the practitioner policy delegates to can_access_case_care_profile', async () => {
    const w = await build('post0065')
    try {
      const q = await policyExpr(w.db, 'case_events_practitioner_select')
      expect(q).toContain('can_access_case_care_profile')
      expect(q).not.toBe('false')
    } finally { await w.db.close() }
  })

  it('full canonical chain: ALLOWED', async () => {
    const w = await build('post0065')
    try { expect(await readAs(w.db, w.practitioner)).toBe(1) } finally { await w.db.close() }
  })

  it('work item only, no team role: DENIED', async () => {
    const w = await build('post0065')
    try {
      await w.db.exec(`delete from case_team_roles where practitioner_id='${w.practitioner}'`)
      expect(await readAs(w.db, w.practitioner)).toBe(0)
    } finally { await w.db.close() }
  })

  it('role mismatch — recorded as lead, scoped only for care_team: DENIED', async () => {
    const w = await build('post0065')
    try {
      await w.db.exec(`update practitioner_scope set permitted_roles = array['care_team']::text[]
                        where practitioner_id='${w.practitioner}'`)
      expect(await readAs(w.db, w.practitioner)).toBe(0)
    } finally { await w.db.close() }
  })

  it('no consent: DENIED', async () => {
    const w = await build('post0065')
    try {
      await w.db.exec(`delete from consent_records where context_practitioner_id='${w.practitioner}'`)
      expect(await readAs(w.db, w.practitioner)).toBe(0)
    } finally { await w.db.close() }
  })

  it('student with a valid supervisor: ALLOWED', async () => {
    const w = await build('post0065')
    try { expect(await readAs(w.db, w.student)).toBe(1) } finally { await w.db.close() }
  })

  it('student whose supervisor role has ended: DENIED', async () => {
    const w = await build('post0065')
    try {
      await w.db.exec(`update case_team_roles set ended_at = now()
                        where practitioner_id='${w.supervisor}'`)
      expect(await readAs(w.db, w.student)).toBe(0)
    } finally { await w.db.close() }
  })

  it('client own-case read: still ALLOWED', async () => {
    const w = await build('post0065')
    try { expect(await readAs(w.db, w.client)).toBe(1) } finally { await w.db.close() }
  })

  it('service role: still ALLOWED', async () => {
    const w = await build('post0065')
    try { expect(await readAs(w.db, w.practitioner, 'service')).toBe(1) } finally { await w.db.close() }
  })
})

// ── The whole point: no transient grant anywhere in the sequence ──────────

describe('the release sequence contains no transient grant', () => {
  it('client and service policies are byte-identical across all three states', async () => {
    const states = await Promise.all(
      (['pre0064', 'post0064', 'post0065'] as Stage[]).map(async (s) => {
        const w = await build(s)
        const out = {
          member: await policyExpr(w.db, 'case_events_member_select'),
          service: await policyExpr(w.db, 'case_events_service_all'),
        }
        await w.db.close()
        return out
      }),
    )
    expect(states[0].member).toBe(states[1].member)
    expect(states[1].member).toBe(states[2].member)
    expect(states[0].service).toBe(states[1].service)
    expect(states[1].service).toBe(states[2].service)
    expect(states[0].member).toContain('client_cases')
    expect(states[0].service).toContain('service_role')
  })

  it('practitioner access goes ALLOWED -> DENIED -> ALLOWED, never grant-to-grant', async () => {
    const seen: number[] = []
    for (const s of ['pre0064', 'post0064', 'post0065'] as Stage[]) {
      const w = await build(s)
      // A practitioner holding ONLY a work item — the weakest claim there is.
      await w.db.exec(`delete from case_team_roles where practitioner_id='${w.practitioner}'`)
      seen.push(await readAs(w.db, w.practitioner))
      await w.db.close()
    }
    // Stale grant, then denied, then still denied: the weak claim never
    // regains access, and the middle state is not the old rule.
    expect(seen).toEqual([1, 0, 0])
  })
})
