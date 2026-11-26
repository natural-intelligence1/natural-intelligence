/*
 * Database behaviour of migration 0071 — effective test authority — proven
 * against a real Postgres.
 *
 * PGlite (Postgres compiled to WASM) in-process: no Docker, no network, no
 * Supabase project, and PRODUCTION IS NEVER TOUCHED. The scaffold reproduces
 * the pre-0071 structures the migration depends on, including the real
 * case_team_roles indexes and the 0066/0070 case-taking constraints; the
 * migration file is then read from disk and executed against it. So these
 * tests exercise the real migration SQL and fail if it changes behaviour.
 *
 * WHAT IS UNDER TEST, in the brief's own terms:
 *   - testing mode OFF refuses a professionally ineligible practitioner;
 *   - testing mode ON permits an authorised test assignment WITHOUT requiring
 *     the assignee already to hold the role (the circularity WP0 proved);
 *   - the override reaches ABSENT evidence only, never an adverse finding;
 *   - membership, consent, role-specific authority and case isolation are
 *     never overridden;
 *   - unknown actions and roles fail closed;
 *   - ending a role, or switching testing mode off, removes authority;
 *   - signing is one authenticated transaction that records truthful
 *     provenance, and the service-role bypass is closed.
 *
 * CONCURRENCY IS NOT PROVEN HERE. PGlite is a single in-process connection, so
 * a genuine interleaving cannot be produced. These tests prove the lock calls
 * are present and that authority is re-read inside the signing transaction;
 * they do NOT prove the race is closed. That needs two connections to a real
 * Postgres and is reported as an open item, not claimed.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const M0071 = join(HERE, '../../../../supabase/migrations/0071_effective_test_authority.sql')
const SCAFFOLD = join(HERE, '__fixtures__/effectiveAuthorityScaffold.sql')

const ADMIN = '00000000-0000-4000-8000-00000000000a'
const CLIENT_T = '00000000-0000-4000-8000-00000000000c'
const CLIENT_R = '00000000-0000-4000-8000-00000000000d'
/** Genuinely eligible practitioner. */
const PE = '00000000-0000-4000-8000-0000000000e1'
/** Test identity, ineligible, ABSENT evidence only. */
const PT = '00000000-0000-4000-8000-0000000000e2'
/** Test identity, ineligible, with an ADVERSE finding. */
const PA = '00000000-0000-4000-8000-0000000000e3'
/** NOT a test identity, ineligible. */
const PN = '00000000-0000-4000-8000-0000000000e4'
/** Test identity used as a student. */
const PS = '00000000-0000-4000-8000-0000000000e5'

const CASE_T = '00000000-0000-4000-8000-0000000000c1' // designated test
const CASE_R = '00000000-0000-4000-8000-0000000000c2' // NOT designated

let db: PGlite

function sql(path: string): string {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('--'))
    .join('\n')
    .replace(/\s--[^\n]*/g, '')
}

const rows = async <T = Record<string, unknown>>(q: string): Promise<T[]> =>
  (await db.query<T>(q)).rows
const one = async <T = Record<string, unknown>>(q: string): Promise<T> => {
  const r = await rows<T>(q)
  if (r.length !== 1) throw new Error(`expected one row, got ${r.length}`)
  return r[0]
}
async function refusal(q: string): Promise<string> {
  try { await db.exec(q) } catch (e) { return String((e as Error).message ?? e) }
  throw new Error('expected the database to refuse this statement, but it succeeded')
}
/** Act as a particular signed-in person; '' is the service role (no uid). */
const as = (uid: string) => db.exec(`select set_config('test.auth_uid', '${uid}', false);`)

/** The authority verdict for the current actor. */
const authority = (caseId: string, action: string) =>
  one<{
    authorised: boolean; refusal: string | null; case_role: string | null
    actual_eligible: boolean; effective_eligible: boolean
    override_used: boolean; override_active: boolean; actual_blockers: string[]
  }>(`select * from effective_case_authority('${caseId}', '${action}')`)

const setSwitch = async (on: boolean) => {
  await as(ADMIN)
  await db.exec(`update testing_mode set enabled = ${on}, changed_by = '${ADMIN}';`)
}

beforeAll(async () => {
  db = new PGlite()
  await db.exec(readFileSync(SCAFFOLD, 'utf8'))
  await db.exec(sql(M0071))

  // Identities are created ONCE. They are deliberately not torn down between
  // tests: profiles.id is the target of testing_mode.changed_by ON DELETE SET
  // NULL, and that cascade is itself an UPDATE on testing_mode — which 0071's
  // attribution guard correctly refuses. Deleting an admin between tests would
  // therefore fail for a reason that has nothing to do with what is under test.
  await as('')
  await db.exec(`
    insert into profiles (id, role, is_test_data) values
      ('${ADMIN}',    'admin',        true),
      ('${CLIENT_T}', 'user',         true),
      ('${CLIENT_R}', 'user',         false),
      ('${PE}',       'practitioner', false),
      ('${PT}',       'practitioner', true),
      ('${PA}',       'practitioner', true),
      ('${PN}',       'practitioner', false),
      ('${PS}',       'practitioner', true);

    insert into practitioners (id, is_test_data) values
      ('${PE}', false), ('${PT}', true), ('${PA}', true), ('${PN}', false), ('${PS}', true);

    insert into client_cases (id, client_id, is_test_data) values
      ('${CASE_T}', '${CLIENT_T}', true),
      ('${CASE_R}', '${CLIENT_R}', false);
  `)
})

afterAll(async () => { await db?.close() })

beforeEach(async () => {
  await as('')
  await db.exec(`
    -- TRUNCATE, not DELETE: freeze_signed_case_taking() refuses to delete a
    -- signed session, which is a guarantee under test. TRUNCATE does not fire
    -- row triggers, so the fixture clears without weakening the freeze.
    truncate case_taking_sessions cascade;
    delete from case_team_roles;
    delete from client_practitioner_links;
    delete from care_plan_coordination;
    delete from audit_logs;
    delete from test_eligibility;
    delete from test_access_consent;

    -- Reset the switch with an attributed change, because 0071 refuses an
    -- unattributed one. That refusal is a feature, so the fixture obeys it
    -- rather than working around it.
    update testing_mode set enabled = false, changed_by = '${ADMIN}';
    update profiles    set is_test_data = true  where id in ('${ADMIN}','${CLIENT_T}','${PT}','${PA}','${PS}');
    update profiles    set is_test_data = false where id in ('${CLIENT_R}','${PE}','${PN}');
    update client_cases set is_test_data = true  where id = '${CASE_T}';
    update client_cases set is_test_data = false where id = '${CASE_R}';
    delete from audit_logs;

    -- Eligibility fixtures. PE passes; the rest fail, and HOW they fail is the
    -- point: PT and PS lack evidence, PA has an adverse finding.
    insert into test_eligibility (practitioner_id, case_role, eligible, blockers) values
      ('${PE}','lead',    true,  '{}'),
      ('${PE}','care_team',true, '{}'),
      ('${PT}','lead',    false, '{practitioner_class_not_set,scope_missing,indemnity_missing}'),
      ('${PT}','care_team',false,'{practitioner_class_not_set,scope_missing,indemnity_missing}'),
      ('${PT}','student', false, '{credential_missing,scope_missing,indemnity_missing}'),
      ('${PS}','student', false, '{credential_missing,scope_missing,indemnity_missing}'),
      -- PS is also overridable AS A LEAD, so the two-Leads test reaches the
      -- unique index rather than stopping at eligibility first.
      ('${PS}','lead',    false, '{practitioner_class_not_set,scope_missing,indemnity_missing}'),
      ('${PA}','lead',    false, '{scope_missing,dbs_outstanding}'),
      ('${PN}','lead',    false, '{practitioner_class_not_set,scope_missing,indemnity_missing}');

    insert into test_access_consent (client_id, practitioner_id, granted) values
      ('${CLIENT_T}','${PE}',true), ('${CLIENT_T}','${PT}',true),
      ('${CLIENT_T}','${PA}',true), ('${CLIENT_T}','${PN}',true),
      ('${CLIENT_T}','${PS}',true), ('${CLIENT_R}','${PT}',true), ('${CLIENT_R}','${PE}',true);
  `)
})

/** Create a care link + case role as the Founder would, under testing mode. */
async function assignUnderTestingMode(
  practitioner: string, caseId: string, role: string, clientId: string, supervisor?: string,
) {
  await setSwitch(true)
  await as(ADMIN)
  await db.exec(`
    insert into client_practitioner_links (client_id, practitioner_id)
    values ('${clientId}', '${practitioner}');
    insert into case_team_roles (case_id, practitioner_id, team_role, assigned_by${supervisor ? ', supervisor_id' : ''})
    values ('${caseId}', '${practitioner}', '${role}', '${ADMIN}'${supervisor ? `, '${supervisor}'` : ''});
  `)
}

describe('0071 — normal operation, testing mode OFF', () => {
  it('refuses a professionally ineligible practitioner outright', async () => {
    await setSwitch(false)
    await as(ADMIN)
    const msg = await refusal(`
      insert into case_team_roles (case_id, practitioner_id, team_role, assigned_by)
      values ('${CASE_T}', '${PT}', 'lead', '${ADMIN}');`)
    expect(msg).toMatch(/not assignable as lead/i)
  })

  it('leaves a genuinely eligible practitioner with their existing authority', async () => {
    await as(ADMIN)
    await db.exec(`
      insert into client_practitioner_links (client_id, practitioner_id) values ('${CLIENT_T}','${PE}');
      insert into case_team_roles (case_id, practitioner_id, team_role, assigned_by)
      values ('${CASE_T}', '${PE}', 'lead', '${ADMIN}');`)
    await as(PE)
    const a = await authority(CASE_T, 'case_taking_sign')
    expect(a.authorised).toBe(true)
    expect(a.actual_eligible).toBe(true)
    expect(a.override_used).toBe(false)   // never consulted
    expect(a.override_active).toBe(false)
  })

  it('keeps the actual blockers truthful even when the override carries the action', async () => {
    await assignUnderTestingMode(PT, CASE_T, 'lead', CLIENT_T)
    await as(PT)
    const a = await authority(CASE_T, 'case_taking_sign')
    expect(a.authorised).toBe(true)
    expect(a.actual_eligible).toBe(false)                    // still ineligible
    expect(a.actual_blockers).toContain('practitioner_class_not_set')
    expect(a.effective_eligible).toBe(true)
    expect(a.override_used).toBe(true)
  })
})

describe('0071 — the assignment circularity is broken', () => {
  it('assigns an ineligible test identity WITHOUT requiring an existing role', async () => {
    // This is the exact deadlock WP0 proved: the row could not be created
    // because creating it demanded the eligibility the override supplies.
    await setSwitch(true)
    await as(ADMIN)
    await db.exec(`
      insert into client_practitioner_links (client_id, practitioner_id) values ('${CLIENT_T}','${PT}');
      insert into case_team_roles (case_id, practitioner_id, team_role, assigned_by)
      values ('${CASE_T}', '${PT}', 'lead', '${ADMIN}');`)
    const r = await one<{ n: string }>(
      `select count(*)::text n from case_team_roles where case_id='${CASE_T}' and practitioner_id='${PT}'`)
    expect(r.n).toBe('1')
  })

  it('refuses the same assignment when the actor is not an admin', async () => {
    await setSwitch(true)
    await as(PT)                                    // a practitioner, not an admin
    const msg = await refusal(`
      insert into case_team_roles (case_id, practitioner_id, team_role, assigned_by)
      values ('${CASE_T}', '${PT}', 'lead', '${PT}');`)
    expect(msg).toMatch(/not assignable as lead/i)
  })

  it('refuses the same assignment on the service-role path (no authenticated admin)', async () => {
    // There is deliberately no unrestricted administrative bypass.
    await setSwitch(true)
    await as('')
    const msg = await refusal(`
      insert into case_team_roles (case_id, practitioner_id, team_role, assigned_by)
      values ('${CASE_T}', '${PT}', 'lead', '${ADMIN}');`)
    expect(msg).toMatch(/not assignable as lead/i)
  })

  it('refuses a NON-test identity even under testing mode', async () => {
    await setSwitch(true)
    await as(ADMIN)
    const msg = await refusal(`
      insert into case_team_roles (case_id, practitioner_id, team_role, assigned_by)
      values ('${CASE_T}', '${PN}', 'lead', '${ADMIN}');`)
    expect(msg).toMatch(/not assignable as lead/i)
  })

  it('refuses a NON-designated case even under testing mode', async () => {
    await setSwitch(true)
    await as(ADMIN)
    const msg = await refusal(`
      insert into case_team_roles (case_id, practitioner_id, team_role, assigned_by)
      values ('${CASE_R}', '${PT}', 'lead', '${ADMIN}');`)
    expect(msg).toMatch(/not assignable as lead/i)
  })

  it('refuses an ADVERSE finding — an override sets aside absent evidence, not a judgement', async () => {
    await setSwitch(true)
    await as(ADMIN)
    const msg = await refusal(`
      insert into case_team_roles (case_id, practitioner_id, team_role, assigned_by)
      values ('${CASE_T}', '${PA}', 'lead', '${ADMIN}');`)
    expect(msg).toMatch(/not assignable as lead/i)
    // dbs_outstanding is outside the approved scope and always will be.
    const scope = await one<{ b: string }>(
      `select array_to_string(overridable_eligibility_blockers(), ',') b`)
    expect(scope.b).not.toContain('dbs_outstanding')
    expect(scope.b).not.toContain('credential_revoked')
    expect(scope.b).not.toContain('scope_suspended')
    expect(scope.b).not.toContain('practitioner_not_active')
  })

  it('still refuses two active Leads on one case', async () => {
    await assignUnderTestingMode(PT, CASE_T, 'lead', CLIENT_T)
    await as(ADMIN)
    await db.exec(`insert into client_practitioner_links (client_id, practitioner_id) values ('${CLIENT_T}','${PS}');`)
    const msg = await refusal(`
      insert into case_team_roles (case_id, practitioner_id, team_role, assigned_by)
      values ('${CASE_T}', '${PS}', 'lead', '${ADMIN}');`)
    expect(msg).toMatch(/uniq_active_lead_per_case|duplicate key/i)
  })

  it('still requires a student to name a supervisor holding an active role', async () => {
    await setSwitch(true)
    await as(ADMIN)
    await db.exec(`insert into client_practitioner_links (client_id, practitioner_id) values ('${CLIENT_T}','${PS}');`)
    const msg = await refusal(`
      insert into case_team_roles (case_id, practitioner_id, team_role, assigned_by, supervisor_id)
      values ('${CASE_T}', '${PS}', 'student', '${ADMIN}', '${PT}');`)
    expect(msg).toMatch(/supervisor|check/i)
  })
})

describe('0071 — what the override never reaches', () => {
  it('refuses an unassigned test practitioner: classification alone grants nothing', async () => {
    await setSwitch(true)
    await as(PT)
    const a = await authority(CASE_T, 'case_read')
    expect(a.authorised).toBe(false)
    expect(a.refusal).toBe('no_active_case_role')
  })

  it('refuses a practitioner assigned to a DIFFERENT case', async () => {
    await assignUnderTestingMode(PT, CASE_T, 'lead', CLIENT_T)
    await as(PT)
    const a = await authority(CASE_R, 'case_read')
    expect(a.authorised).toBe(false)
    expect(a.refusal).toBe('no_active_case_role')
  })

  it('refuses without consent, override or not', async () => {
    await assignUnderTestingMode(PT, CASE_T, 'lead', CLIENT_T)
    await db.exec(`update test_access_consent set granted = false where practitioner_id = '${PT}';`)
    await as(PT)
    const a = await authority(CASE_T, 'case_read')
    expect(a.authorised).toBe(false)
    expect(a.refusal).toBe('no_consent')
  })

  it('fails closed on an unknown action', async () => {
    await assignUnderTestingMode(PT, CASE_T, 'lead', CLIENT_T)
    await as(PT)
    const a = await authority(CASE_T, 'delete_everything')
    expect(a.authorised).toBe(false)
    expect(a.refusal).toBe('action_unknown')
  })

  it('refuses an unauthenticated caller', async () => {
    await assignUnderTestingMode(PT, CASE_T, 'lead', CLIENT_T)
    await as('')
    const a = await authority(CASE_T, 'case_read')
    expect(a.authorised).toBe(false)
    expect(a.refusal).toBe('no_authenticated_actor')
  })
})

describe('0071 — role separation', () => {
  it('a student cannot sign: signing is a Lead action', async () => {
    await assignUnderTestingMode(PT, CASE_T, 'lead', CLIENT_T)
    await as(ADMIN)
    await db.exec(`insert into client_practitioner_links (client_id, practitioner_id) values ('${CLIENT_T}','${PS}');
      insert into case_team_roles (case_id, practitioner_id, team_role, assigned_by, supervisor_id)
      values ('${CASE_T}', '${PS}', 'student', '${ADMIN}', '${PT}');`)
    await as(PS)
    const read = await authority(CASE_T, 'case_read')
    expect(read.authorised).toBe(true)                 // may read
    const sign = await authority(CASE_T, 'case_taking_sign')
    expect(sign.authorised).toBe(false)
    expect(sign.refusal).toBe('role_not_permitted_for_action')
  })

  it('a care_team member cannot sign either', async () => {
    await assignUnderTestingMode(PT, CASE_T, 'care_team', CLIENT_T)
    await as(PT)
    const a = await authority(CASE_T, 'case_taking_sign')
    expect(a.authorised).toBe(false)
    expect(a.refusal).toBe('role_not_permitted_for_action')
  })
})

describe('0071 — withdrawing authority', () => {
  it('ending the role removes authority, and the history survives', async () => {
    await assignUnderTestingMode(PT, CASE_T, 'lead', CLIENT_T)
    await as(PT)
    expect((await authority(CASE_T, 'case_read')).authorised).toBe(true)

    await as(ADMIN)
    await db.exec(`update case_team_roles set ended_at = now(), end_reason = 'cast cleared'
                    where case_id='${CASE_T}' and practitioner_id='${PT}';`)
    await as(PT)
    const a = await authority(CASE_T, 'case_read')
    expect(a.authorised).toBe(false)
    expect(a.refusal).toBe('no_active_case_role')

    const kept = await one<{ n: string }>(
      `select count(*)::text n from case_team_roles where case_id='${CASE_T}' and practitioner_id='${PT}'`)
    expect(kept.n).toBe('1')   // ended, not deleted
  })

  it('switching testing mode OFF removes override authority immediately', async () => {
    await assignUnderTestingMode(PT, CASE_T, 'lead', CLIENT_T)
    await as(PT)
    expect((await authority(CASE_T, 'case_read')).authorised).toBe(true)

    await setSwitch(false)
    await as(PT)
    const a = await authority(CASE_T, 'case_read')
    expect(a.authorised).toBe(false)
    expect(a.refusal).toBe('not_eligible')
    expect(a.override_active).toBe(false)
  })

  it('removing the case designation removes override authority', async () => {
    await assignUnderTestingMode(PT, CASE_T, 'lead', CLIENT_T)
    await as(ADMIN)
    await db.exec(`update client_cases set is_test_data = false where id = '${CASE_T}';`)
    await as(PT)
    expect((await authority(CASE_T, 'case_read')).authorised).toBe(false)
  })
})

describe('0071 — case access delegates to effective eligibility', () => {
  it('grants an overridden test practitioner access, and only to their own case', async () => {
    await assignUnderTestingMode(PT, CASE_T, 'lead', CLIENT_T)
    await as(PT)
    const r = await one<{ own: boolean; other: boolean }>(
      `select can_access_case_care_profile('${CASE_T}') own,
              can_access_case_care_profile('${CASE_R}') other`)
    expect(r.own).toBe(true)
    expect(r.other).toBe(false)
  })

  it('denies access once testing mode is off', async () => {
    await assignUnderTestingMode(PT, CASE_T, 'lead', CLIENT_T)
    await setSwitch(false)
    await as(PT)
    const r = await one<{ own: boolean }>(`select can_access_case_care_profile('${CASE_T}') own`)
    expect(r.own).toBe(false)
  })
})

describe('0071 — signing', () => {
  const session = '00000000-0000-4000-8000-0000000000f1'

  const draft = async (caseId: string, by: string) => {
    await as('')
    await db.exec(`insert into case_taking_sessions
      (id, case_id, consultation_seq, consultation_kind, started_by, state)
      values ('${session}', '${caseId}', 1, 'initial', '${by}', 'ready_for_sign_off');`)
  }

  it('refuses a signature with no authenticated actor — the service-role bypass is closed', async () => {
    await assignUnderTestingMode(PT, CASE_T, 'lead', CLIENT_T)
    await draft(CASE_T, PT)
    await as('')
    const r = await one<{ signed: boolean; refusal: string }>(
      `select signed, refusal from sign_case_taking_session('${session}', null)`)
    expect(r.signed).toBe(false)
    expect(r.refusal).toBe('no_authenticated_actor')
  })

  it('signs atomically and records truthful provenance, including override_used', async () => {
    await assignUnderTestingMode(PT, CASE_T, 'lead', CLIENT_T)
    await draft(CASE_T, PT)
    await as(PT)
    const r = await one<{ signed: boolean; override_used: boolean }>(
      `select signed, override_used from sign_case_taking_session('${session}', null)`)
    expect(r.signed).toBe(true)
    expect(r.override_used).toBe(true)

    const s = await one(`select state, signed_off_by, override_active_at_signing,
                                override_used_at_signing, is_test_output, effective_role
                           from case_taking_sessions where id='${session}'`)
    expect(s.state).toBe('signed_off')
    expect(s.signed_off_by).toBe(PT)
    expect(s.override_active_at_signing).toBe(true)
    expect(s.override_used_at_signing).toBe(true)   // 0070 hardcoded false; 0071 derives it
    expect(s.is_test_output).toBe(true)
    expect(s.effective_role).toBe('lead')
  })

  it('records override_used false when the signer is genuinely eligible', async () => {
    await as(ADMIN)
    await db.exec(`insert into client_practitioner_links (client_id, practitioner_id) values ('${CLIENT_T}','${PE}');
      insert into case_team_roles (case_id, practitioner_id, team_role, assigned_by)
      values ('${CASE_T}','${PE}','lead','${ADMIN}');`)
    await draft(CASE_T, PE)
    await as(PE)
    await db.exec(`select sign_case_taking_session('${session}', null);`)
    const s = await one(`select override_used_at_signing, is_test_output from case_taking_sessions where id='${session}'`)
    expect(s.override_used_at_signing).toBe(false)
    expect(s.is_test_output).toBe(true)   // the CASE is designated test
  })

  it('refuses a stale revision', async () => {
    await assignUnderTestingMode(PT, CASE_T, 'lead', CLIENT_T)
    await draft(CASE_T, PT)
    await as(PT)
    const r = await one<{ signed: boolean; refusal: string }>(
      `select signed, refusal from sign_case_taking_session('${session}', 99)`)
    expect(r.signed).toBe(false)
    expect(r.refusal).toBe('revision_changed')
  })

  it('refuses a second signature', async () => {
    await assignUnderTestingMode(PT, CASE_T, 'lead', CLIENT_T)
    await draft(CASE_T, PT)
    await as(PT)
    await db.exec(`select sign_case_taking_session('${session}', null);`)
    const r = await one<{ signed: boolean; refusal: string }>(
      `select signed, refusal from sign_case_taking_session('${session}', null)`)
    expect(r.signed).toBe(false)
    expect(r.refusal).toBe('already_signed')
  })

  it('refuses a signer who is not the Lead', async () => {
    await assignUnderTestingMode(PT, CASE_T, 'care_team', CLIENT_T)
    await draft(CASE_T, PT)
    await as(PT)
    const r = await one<{ signed: boolean; refusal: string }>(
      `select signed, refusal from sign_case_taking_session('${session}', null)`)
    expect(r.signed).toBe(false)
    expect(r.refusal).toBe('role_not_permitted_for_action')
  })

  it('keeps the signed record immutable', async () => {
    await assignUnderTestingMode(PT, CASE_T, 'lead', CLIENT_T)
    await draft(CASE_T, PT)
    await as(PT)
    await db.exec(`select sign_case_taking_session('${session}', null);`)
    const msg = await refusal(`update case_taking_sessions set is_test_output = false where id='${session}';`)
    expect(msg).toMatch(/signed and cannot be changed/i)
  })

  it('leaves unsigned drafts untouched', async () => {
    await assignUnderTestingMode(PT, CASE_T, 'lead', CLIENT_T)
    await draft(CASE_T, PT)
    const s = await one(`select override_used_at_signing, effective_role from case_taking_sessions where id='${session}'`)
    expect(s.override_used_at_signing).toBeNull()
    expect(s.effective_role).toBeNull()
  })
})

describe('0071 — audit and disclosure', () => {
  it('audits a signature with a named actor and the override flag', async () => {
    await assignUnderTestingMode(PT, CASE_T, 'lead', CLIENT_T)
    await as('')
    await db.exec(`insert into case_taking_sessions
      (id, case_id, consultation_seq, consultation_kind, started_by, state)
      values ('00000000-0000-4000-8000-0000000000f2', '${CASE_T}', 1, 'initial', '${PT}', 'ready_for_sign_off');`)
    await as(PT)
    await db.exec(`select sign_case_taking_session('00000000-0000-4000-8000-0000000000f2', null);`)

    const a = await one<{ actor_id: string; actor_role: string; metadata: Record<string, unknown> }>(
      `select actor_id, actor_role, metadata from audit_logs where action='case_taking.signed'`)
    expect(a.actor_id).toBe(PT)          // named, not NULL as the legacy rows are
    expect(a.actor_role).toBe('lead')
    expect(a.metadata.override_used).toBe(true)
    expect(a.metadata.outcome).toBe('applied')
  })

  it('audits role assignment and ending', async () => {
    await assignUnderTestingMode(PT, CASE_T, 'lead', CLIENT_T)
    const assigned = await one<{ n: string }>(
      `select count(*)::text n from audit_logs where action='case_team_role.assigned'`)
    expect(assigned.n).toBe('1')

    await as(ADMIN)
    await db.exec(`update case_team_roles set ended_at = now() where case_id='${CASE_T}' and practitioner_id='${PT}';`)
    const ended = await one<{ n: string }>(
      `select count(*)::text n from audit_logs where action='case_team_role.ended'`)
    expect(ended.n).toBe('1')
  })

  it('refuses a non-admin changing a test designation, and audits an admin who does', async () => {
    await as(PT)
    const msg = await refusal(`update profiles set is_test_data = true where id = '${PN}';`)
    expect(msg).toMatch(/only an administrator/i)

    await as(ADMIN)
    await db.exec(`update profiles set is_test_data = true where id = '${PN}';`)
    const a = await one<{ actor_id: string }>(
      `select actor_id from audit_logs where action='profile.test_designation_changed'`)
    expect(a.actor_id).toBe(ADMIN)
  })

  it('separates self-inspection from administrative inspection of someone else', async () => {
    await as(PT)
    const mine = await rows(`select * from my_practitioner_eligibility('lead')`)
    expect(mine.length).toBe(1)
    const msg = await refusal(`select * from admin_practitioner_eligibility('${PE}', 'lead');`)
    expect(msg).toMatch(/administrator access required/i)

    await as(ADMIN)
    const theirs = await rows(`select * from admin_practitioner_eligibility('${PE}', 'lead')`)
    expect(theirs.length).toBe(1)
  })
})

describe('0071 — the lock calls exist (NOT a concurrency proof)', () => {
  it('names both locks in the signing path and in every authority change', async () => {
    // PGlite is one connection, so a genuine interleaving cannot be produced
    // here. What IS provable is that the ordering exists in the code: global
    // lock first, then the case. The race itself is reported as unproven.
    const src = readFileSync(M0071, 'utf8')
    for (const fn of [
      'sign_case_taking_session',
      'guard_case_test_designation',
      'guard_profile_test_designation',
      'enforce_testing_mode_attribution',
    ]) {
      const body = src.slice(src.indexOf(`function public.${fn}`))
      expect(body.slice(0, 3000), fn).toContain('lock_testing_authority')
    }
  })
})
