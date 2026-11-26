/*
 * Database behaviour of migration 0072 — the non-clinical Contributor (Coach)
 * — proven against a real Postgres.
 *
 * Both migrations run from disk, 0071 then 0072, against the same scaffold the
 * 0071 suite uses. RLS IS GENUINELY ENFORCED here: every boundary assertion
 * runs after `set role authenticated`, a role that owns nothing, so the
 * policies actually apply rather than being bypassed by ownership.
 *
 * THE CLAIM UNDER TEST
 *
 * A Coach may be assigned to a case, may read what their work needs, and may
 * record a bounded non-clinical contribution. A Coach may NOT edit clinical
 * case-taking answers, start a consultation, sign anything, verify clinical
 * information, or be recorded as the role a signature was taken under.
 *
 * The last one is structural rather than enforced: 0072 deliberately does NOT
 * widen case_taking_effective_role_valid, so 'contributor' cannot be stored in
 * effective_role at all.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const M0071 = join(HERE, '../../../../supabase/migrations/0071_effective_test_authority.sql')
const M0072 = join(HERE, '../../../../supabase/migrations/0072_non_clinical_contributor.sql')
const SCAFFOLD = join(HERE, '__fixtures__/effectiveAuthorityScaffold.sql')

const ADMIN = '00000000-0000-4000-8000-00000000000a'
const CLIENT = '00000000-0000-4000-8000-00000000000c'
const LEAD = '00000000-0000-4000-8000-0000000000b1'   // clinical, eligible
const COACH = '00000000-0000-4000-8000-0000000000b2'  // non-clinical, scoped
const COACH_NS = '00000000-0000-4000-8000-0000000000b3' // non-clinical, no scope
const COACH_DBS = '00000000-0000-4000-8000-0000000000b4' // safeguarding outstanding
const CASE = '00000000-0000-4000-8000-0000000000c1'
const SESSION = '00000000-0000-4000-8000-0000000000f1'

let db: PGlite

function sql(p: string): string {
  return readFileSync(p, 'utf8')
    .split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n')
    .replace(/\s--[^\n]*/g, '')
}
const rows = async <T = Record<string, unknown>>(q: string): Promise<T[]> => (await db.query<T>(q)).rows
const one = async <T = Record<string, unknown>>(q: string): Promise<T> => {
  const r = await rows<T>(q)
  if (r.length !== 1) throw new Error(`expected one row, got ${r.length}`)
  return r[0]
}
async function refusal(q: string): Promise<string> {
  try { await db.exec(q) } catch (e) { return String((e as Error).message ?? e) }
  throw new Error('expected a refusal, but the statement succeeded')
}
/**
 * Postgres denies in two shapes and both are real denials: a WITH CHECK
 * violation RAISEs, while a USING miss simply matches no row. A test that only
 * looked for an exception would pass while the write silently went nowhere.
 */
async function denied(q: string): Promise<'refused' | 'no_rows'> {
  let changed = 0
  try { changed = (await db.query(q)).affectedRows ?? 0 } catch { return 'refused' }
  if (changed === 0) return 'no_rows'
  throw new Error(`expected a denial, but the statement changed ${changed} row(s)`)
}

/** Act as owner (RLS bypassed) — for fixtures only. */
const asOwner = (uid: string) => db.exec(`reset role; select set_config('test.auth_uid','${uid}',false);`)
/** Act as a signed-in client with RLS genuinely applied. */
const asUser = (uid: string) =>
  db.exec(`reset role; select set_config('test.auth_uid','${uid}',false); set role authenticated;`)

beforeAll(async () => {
  db = new PGlite()
  await db.exec(readFileSync(SCAFFOLD, 'utf8'))
  await db.exec(sql(M0071))
  await db.exec(sql(M0072))

  await asOwner('')
  await db.exec(`
    insert into profiles (id, role, is_test_data) values
      ('${ADMIN}','admin',true), ('${CLIENT}','user',true),
      ('${LEAD}','practitioner',true), ('${COACH}','practitioner',true),
      ('${COACH_NS}','practitioner',true), ('${COACH_DBS}','practitioner',true);
    insert into practitioners (id, is_test_data, dbs_status) values
      ('${LEAD}',true,'clear'), ('${COACH}',true,'clear'),
      ('${COACH_NS}',true,'clear'), ('${COACH_DBS}',true,'pending');
    insert into client_cases (id, client_id, is_test_data) values ('${CASE}','${CLIENT}',true);

    -- The Coach's non-clinical credential: an approved scope naming the role.
    insert into practitioner_scope (practitioner_id, permitted_roles, status) values
      ('${COACH}', '{contributor}', 'approved'),
      ('${COACH_DBS}', '{contributor}', 'approved');

    insert into test_eligibility (practitioner_id, case_role, eligible, blockers) values
      ('${LEAD}','lead',true,'{}');
    insert into test_access_consent (client_id, practitioner_id, granted) values
      ('${CLIENT}','${LEAD}',true), ('${CLIENT}','${COACH}',true),
      ('${CLIENT}','${COACH_NS}',true), ('${CLIENT}','${COACH_DBS}',true);
  `)
})

afterAll(async () => { await db?.close() })

beforeEach(async () => {
  await asOwner('')
  await db.exec(`
    truncate case_taking_sessions cascade;
    delete from case_contributions;
    delete from case_team_roles;
    delete from client_practitioner_links;
    delete from audit_logs;
    update testing_mode set enabled = false, changed_by = '${ADMIN}';
    delete from audit_logs;
    insert into client_practitioner_links (client_id, practitioner_id) values
      ('${CLIENT}','${LEAD}');
    insert into case_team_roles (case_id, practitioner_id, team_role, assigned_by)
      values ('${CASE}','${LEAD}','lead','${ADMIN}');
  `)
})

/** Put the Coach on the case. Their scope makes them genuinely eligible, so
 *  this needs no testing mode at all. */
async function seatTheCoach(who = COACH) {
  await asOwner(ADMIN)
  await db.exec(`
    insert into client_practitioner_links (client_id, practitioner_id) values ('${CLIENT}','${who}');
    insert into case_team_roles (case_id, practitioner_id, team_role, assigned_by)
      values ('${CASE}','${who}','contributor','${ADMIN}');`)
}

describe('0072 — the role exists and is genuinely non-clinical', () => {
  it('accepts contributor as a case-team role', async () => {
    await seatTheCoach()
    const r = await one<{ n: string }>(
      `select count(*)::text n from case_team_roles where team_role='contributor'`)
    expect(r.n).toBe('1')
  })

  it('needs no clinical category, credential or indemnity', async () => {
    // The Coach has none of those and is still eligible, because
    // contributor_eligibility never consults the clinical spine.
    const e = await one<{ eligible: boolean; blockers: string[] }>(
      `select eligible, blockers from contributor_eligibility('${COACH}')`)
    expect(e.eligible).toBe(true)
    expect(e.blockers).toEqual([])
  })

  it('still requires an approved scope naming the role', async () => {
    const e = await one<{ eligible: boolean; blockers: string[] }>(
      `select eligible, blockers from contributor_eligibility('${COACH_NS}')`)
    expect(e.eligible).toBe(false)
    expect(e.blockers).toContain('scope_missing')
  })

  it('never waives safeguarding, even under testing mode', async () => {
    await asOwner(ADMIN)
    await db.exec(`update testing_mode set enabled = true, changed_by = '${ADMIN}';
      insert into client_practitioner_links (client_id, practitioner_id) values ('${CLIENT}','${COACH_DBS}');`)
    const msg = await refusal(`
      insert into case_team_roles (case_id, practitioner_id, team_role, assigned_by)
      values ('${CASE}','${COACH_DBS}','contributor','${ADMIN}');`)
    expect(msg).toMatch(/not assignable as contributor/i)
    const e = await one<{ blockers: string[] }>(`select blockers from contributor_eligibility('${COACH_DBS}')`)
    expect(e.blockers).toContain('dbs_outstanding')
  })

  it('needs no supervisor, unlike a student', async () => {
    await seatTheCoach()
    const r = await one<{ supervisor_id: string | null }>(
      `select supervisor_id from case_team_roles where practitioner_id='${COACH}'`)
    expect(r.supervisor_id).toBeNull()
  })
})

describe('0072 — what a Coach may do', () => {
  it('may read the case they are assigned to', async () => {
    await seatTheCoach()
    await asUser(COACH)
    const r = await one<{ ok: boolean }>(`select can_access_case_care_profile('${CASE}') ok`)
    expect(r.ok).toBe(true)
    const a = await one<{ authorised: boolean }>(
      `select authorised from effective_case_authority('${CASE}','case_read')`)
    expect(a.authorised).toBe(true)
  })

  it('may record a non-clinical contribution', async () => {
    await seatTheCoach()
    await asUser(COACH)
    await db.exec(`insert into case_contributions (case_id, author_id, team_role, kind, content)
                   values ('${CASE}','${COACH}','contributor','note','Encouraged a daily walk.');`)
    const r = await one<{ n: string }>(`select count(*)::text n from case_contributions`)
    expect(r.n).toBe('1')
    const a = await one<{ authorised: boolean }>(
      `select authorised from effective_case_authority('${CASE}','contribute')`)
    expect(a.authorised).toBe(true)
  })
})

describe('0072 — what a Coach may NOT do', () => {
  it('cannot sign', async () => {
    await seatTheCoach()
    await asUser(COACH)
    const a = await one<{ authorised: boolean; refusal: string }>(
      `select authorised, refusal from effective_case_authority('${CASE}','case_taking_sign')`)
    expect(a.authorised).toBe(false)
    expect(a.refusal).toBe('role_not_permitted_for_action')
  })

  it('cannot be recorded as the role a signature was taken under', async () => {
    // Structural: 0072 deliberately leaves case_taking_effective_role_valid
    // alone, so the value cannot be stored at all.
    const def = await one<{ d: string }>(`
      select pg_get_constraintdef(oid) d from pg_constraint
       where conname = 'case_taking_effective_role_valid'`)
    expect(def.d).not.toContain('contributor')
  })

  it('cannot start a consultation', async () => {
    await seatTheCoach()
    await asUser(COACH)
    const outcome = await denied(`insert into case_taking_sessions
      (case_id, consultation_seq, consultation_kind, started_by, state)
      values ('${CASE}', 1, 'initial', '${COACH}', 'in_progress');`)
    expect(outcome).toBe('refused')
  })

  it('cannot edit clinical case-taking answers, where a clinical role can', async () => {
    await seatTheCoach()
    // A clinical colleague creates the session and an answer.
    await asOwner('')
    await db.exec(`insert into case_taking_sessions
      (id, case_id, consultation_seq, consultation_kind, started_by, state)
      values ('${SESSION}','${CASE}',1,'initial','${LEAD}','in_progress');
      insert into case_taking_answers (session_id, question_id, value)
      values ('${SESSION}','q1','original');`)

    // The Coach can SEE it...
    await asUser(COACH)
    const seen = await rows(`select id from case_taking_answers`)
    expect(seen.length).toBe(1)

    // ...and cannot change or add to it.
    expect(await denied(`update case_taking_answers set value = 'tampered' where question_id='q1';`))
      .toBe('no_rows')
    expect(await denied(`insert into case_taking_answers (session_id, question_id, value)
                          values ('${SESSION}','q2','coach wrote this');`)).toBe('refused')

    // The Lead can.
    await asUser(LEAD)
    const changed = (await db.query(`update case_taking_answers set value='clinician' where question_id='q1';`)).affectedRows
    expect(changed).toBe(1)
  })

  it('cannot verify clinical information', async () => {
    await seatTheCoach()
    await asOwner('')
    await db.exec(`insert into case_contributions (id, case_id, author_id, team_role, kind, content)
      values ('00000000-0000-4000-8000-0000000000d1','${CASE}','${COACH}','contributor','note','x');`)
    await asUser(COACH)
    const msg = await refusal(`update case_contributions
       set supervisor_verified_by = '${COACH}', supervisor_verified_at = now()
     where id = '00000000-0000-4000-8000-0000000000d1';`)
    expect(msg).toMatch(/cannot verify clinical information/i)
  })

  it('cannot run a coordination review', async () => {
    await seatTheCoach()
    await asUser(COACH)
    const a = await one<{ authorised: boolean; refusal: string }>(
      `select authorised, refusal from effective_case_authority('${CASE}','coordination_review')`)
    expect(a.authorised).toBe(false)
    expect(a.refusal).toBe('role_not_permitted_for_action')
  })
})

describe('0072 — the clinical rules are untouched', () => {
  it('leaves clinical roles routed through the clinical spine', async () => {
    // The Lead is eligible via test_eligibility, which stands in for 0064.
    // contributor_eligibility is never consulted for a clinical role.
    await asUser(LEAD)
    const a = await one<{ authorised: boolean; actual_eligible: boolean; override_used: boolean }>(
      `select authorised, actual_eligible, override_used
         from effective_case_authority('${CASE}','case_taking_sign')`)
    expect(a.authorised).toBe(true)
    expect(a.actual_eligible).toBe(true)
    expect(a.override_used).toBe(false)
  })

  it('still refuses a student without a supervisor', async () => {
    await asOwner(ADMIN)
    await db.exec(`update testing_mode set enabled = true, changed_by = '${ADMIN}';
      insert into client_practitioner_links (client_id, practitioner_id) values ('${CLIENT}','${COACH_NS}');`)
    const msg = await refusal(`
      insert into case_team_roles (case_id, practitioner_id, team_role, assigned_by)
      values ('${CASE}','${COACH_NS}','student','${ADMIN}');`)
    // The CHECK fires before the trigger's supervisor rule, and either is a
    // genuine refusal of an unsupervised student.
    expect(msg).toMatch(/supervisor|check|not assignable/i)
  })
})
