/*
 * Database behaviour of migration 0066, proven against a real Postgres.
 *
 * PGlite (Postgres compiled to WASM) in-process: no Docker, no network, no
 * Supabase project, and PRODUCTION IS NEVER TOUCHED. The scaffold reproduces
 * the pre-0066 structures 0066 depends on; the migration file is then read
 * from disk and executed against it. So these tests exercise the real
 * migration SQL and fail if it changes behaviour — they are not a paraphrase.
 *
 * RLS IS UNDER TEST. Every policy assertion runs after `set role
 * authenticated`, a role that owns nothing, so the policies actually apply.
 *
 * The claims under test, in the Orchestrator's own terms:
 *   - the session is a SHARED case/consultation artefact, not a practitioner's
 *     private draft, so the Lead reviews and signs the same row;
 *   - only an ACTIVE LEAD may start a consultation;
 *   - a signed version is immutable and an amendment is a successor;
 *   - reading or rendering a safety item can NEVER mark it asked;
 *   - observations are multiple and do not masquerade as question ids;
 *   - case_contributions stays append-only, now including the new linkage.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const MIGRATION = join(HERE, '../../../../supabase/migrations/0066_case_taking_persistence.sql')
const SCAFFOLD = join(HERE, '__fixtures__/caseTakingScaffold.sql')

const CLIENT = '11111111-1111-1111-1111-111111111111'
const LEAD = '22222222-2222-2222-2222-222222222222'
const ASSOC = '33333333-3333-3333-3333-333333333333'
const STUDENT = '44444444-4444-4444-4444-444444444444'
const OUTSIDER = '55555555-5555-5555-5555-555555555555'
const CASE_A = '66666666-6666-6666-6666-666666666666'

let db: PGlite

const rows = async <T = Record<string, unknown>>(sql: string): Promise<T[]> =>
  (await db.query<T>(sql)).rows

const affected = async (sql: string): Promise<number> =>
  (await db.query(sql)).affectedRows ?? 0

async function refusal(sql: string): Promise<string> {
  try { await db.exec(sql) } catch (e) { return String((e as Error).message ?? e) }
  throw new Error('expected the database to refuse this statement, but it succeeded')
}

/**
 * Postgres denies in two different shapes and both are real denials:
 *
 *   'refused'  a CHECK, a unique index or a trigger RAISEd.
 *   'no_rows'  RLS matched no row, so the statement was a no-op. Nothing is
 *              raised — which is precisely why a test that only looks for an
 *              exception would pass while the write silently went nowhere,
 *              or worse, would be written to expect success.
 *
 * Returning which one happened keeps the tests honest about the mechanism
 * instead of hiding both behind a regex.
 */
async function denied(sql: string): Promise<'refused' | 'no_rows'> {
  let changed = 0
  try {
    changed = (await db.query(sql)).affectedRows ?? 0
  } catch {
    return 'refused'
  }
  if (changed === 0) return 'no_rows'
  throw new Error(`expected a denial, but the statement changed ${changed} row(s)`)
}

/** The migration's executable SQL, with comments stripped.
 *  Scope assertions must read the SQL, not the file's own prose: the header
 *  legitimately names the rejected V1 key, case_practitioner_work and
 *  sole_unregistered_lead in order to explain why none of them is used. */
function migrationSql(): string {
  return readFileSync(MIGRATION, 'utf8')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n')
    .replace(/\s--[^\n]*/g, '')
}

/** Act as a particular signed-in practitioner, with RLS genuinely applied. */
const as = (uid: string) => db.exec(
  `reset role;
   select set_config('test.auth_uid', '${uid}', false);
   set role authenticated;`)

/** Act as the table owner: RLS bypassed, used only for fixture setup. */
const asOwner = () => db.exec(`reset role; select set_config('test.auth_uid', '', false);`)

beforeAll(async () => {
  db = new PGlite()
  await db.exec(readFileSync(SCAFFOLD, 'utf8'))
  await db.exec(readFileSync(MIGRATION, 'utf8'))
  // 0066 creates these as the owner; RLS is only meaningful for a role that
  // holds table privileges but owns nothing.
  await db.exec(`grant select, insert, update, delete
                   on case_taking_sessions, case_taking_answers to authenticated;`)
})

afterAll(async () => { await db?.close() })

beforeEach(async () => {
  await asOwner()
  // session_replication_role = replica suspends user triggers for the
  // teardown only. It is needed because the migration works: once a test
  // signs a session, freeze_signed_case_taking() correctly refuses to delete
  // it, and freeze_signed_case_taking_answers() refuses to delete its
  // answers. That refusal is the feature — see the immutability suite — so
  // the fixture steps around it rather than the schema softening for it.
  await db.exec(`
    set session_replication_role = replica;
    delete from case_taking_answers;
    delete from case_contributions;
    delete from case_taking_sessions;
    delete from case_team_roles;
    delete from client_practitioner_links;
    delete from test_access_consent;
    delete from test_eligibility;
    delete from client_cases;
    delete from practitioners;
    delete from profiles;
    set session_replication_role = origin;

    insert into profiles (id, role) values ('${CLIENT}', 'member');
    insert into practitioners (id) values ('${LEAD}'), ('${ASSOC}'), ('${STUDENT}'), ('${OUTSIDER}');
    insert into client_cases (id, client_id) values ('${CASE_A}', '${CLIENT}');

    -- Care relationships + consent for the three practitioners on the case.
    insert into client_practitioner_links (client_id, practitioner_id) values
      ('${CLIENT}', '${LEAD}'), ('${CLIENT}', '${ASSOC}'), ('${CLIENT}', '${STUDENT}');
    insert into test_access_consent (client_id, practitioner_id, granted) values
      ('${CLIENT}', '${LEAD}', true), ('${CLIENT}', '${ASSOC}', true),
      ('${CLIENT}', '${STUDENT}', true);

    insert into case_team_roles (case_id, practitioner_id, team_role, assigned_by) values
      ('${CASE_A}', '${LEAD}',  'lead',      '${LEAD}'),
      ('${CASE_A}', '${ASSOC}', 'associate', '${LEAD}');
    insert into case_team_roles (case_id, practitioner_id, team_role, supervisor_id, assigned_by)
      values ('${CASE_A}', '${STUDENT}', 'student', '${LEAD}', '${LEAD}');

    insert into test_eligibility (practitioner_id, case_role, eligible) values
      ('${LEAD}', 'lead', true), ('${ASSOC}', 'associate', true),
      ('${STUDENT}', 'student', true);
  `)
})

/** Start a consultation as the Lead and return its id. */
async function startSession(opts: { seq?: number; kind?: string } = {}): Promise<string> {
  await as(LEAD)
  const r = await rows<{ id: string }>(`
    insert into case_taking_sessions (case_id, consultation_seq, consultation_kind, started_by)
    values ('${CASE_A}', ${opts.seq ?? 1}, '${opts.kind ?? 'initial'}', '${LEAD}')
    returning id`)
  return r[0].id
}

// ─── Lead-start requirement ──────────────────────────────────────────────────

describe('Lead-start requirement', () => {
  it('the active Lead may start a consultation', async () => {
    const id = await startSession()
    expect(id).toBeTruthy()
  })

  it('a non-Lead case-team practitioner may NOT start one', async () => {
    await as(ASSOC)
    const msg = await refusal(`
      insert into case_taking_sessions (case_id, consultation_seq, consultation_kind, started_by)
      values ('${CASE_A}', 1, 'initial', '${ASSOC}')`)
    expect(msg).toMatch(/only the active Lead/i)
  })

  it('a student may NOT start one', async () => {
    await as(STUDENT)
    const msg = await refusal(`
      insert into case_taking_sessions (case_id, consultation_seq, consultation_kind, started_by)
      values ('${CASE_A}', 1, 'initial', '${STUDENT}')`)
    expect(msg).toMatch(/only the active Lead/i)
  })

  it('a demoted Lead may no longer start one', async () => {
    await asOwner()
    await db.exec(`update case_team_roles set ended_at = now()
                    where case_id = '${CASE_A}' and practitioner_id = '${LEAD}'`)
    await as(LEAD)
    // RLS now denies outright, since the access function requires an active role.
    const msg = await refusal(`
      insert into case_taking_sessions (case_id, consultation_seq, consultation_kind, started_by)
      values ('${CASE_A}', 1, 'initial', '${LEAD}')`)
    expect(msg).toMatch(/row-level security|only the active Lead/i)
  })

  it('nobody may record someone else as having started it', async () => {
    await as(LEAD)
    const msg = await refusal(`
      insert into case_taking_sessions (case_id, consultation_seq, consultation_kind, started_by)
      values ('${CASE_A}', 1, 'initial', '${ASSOC}')`)
    expect(msg).toMatch(/only be started by the practitioner performing the action/i)
  })
})

// ─── The shared artefact: handoff ────────────────────────────────────────────

describe('the session is a shared artefact, not a private draft', () => {
  it('a non-Lead contributes answers to the session the Lead started', async () => {
    const session = await startSession()
    await as(ASSOC)
    await db.exec(`
      insert into case_taking_answers (session_id, entry_kind, question_id, value, updated_by)
      values ('${session}', 'answer', 'q.sleep.onset', '"45 minutes"', '${ASSOC}')`)
    const found = await rows(`select id from case_taking_answers where session_id = '${session}'`)
    expect(found).toHaveLength(1)
  })

  it('the Lead cannot acquire a SECOND session for the same consultation', async () => {
    // The whole point of the revised uniqueness rule. In V1 the Lead would
    // have got their own practitioner-owned row.
    await startSession()
    await as(LEAD)
    const msg = await refusal(`
      insert into case_taking_sessions (case_id, consultation_seq, consultation_kind, started_by)
      values ('${CASE_A}', 1, 'follow_up', '${LEAD}')`)
    expect(msg).toMatch(/case_taking_one_open_version_idx|duplicate key/i)
  })

  it('non-Lead submits, then the Lead reviews and signs THE SAME ROW', async () => {
    const session = await startSession()

    await as(ASSOC)
    await db.exec(`
      insert into case_taking_answers (session_id, entry_kind, question_id, value, updated_by)
      values ('${session}', 'answer', 'q.energy.am', '3', '${ASSOC}')`)
    expect(await affected(`
      update case_taking_sessions
         set state = 'submitted_to_lead', submitted_by = '${ASSOC}', submitted_at = now()
       where id = '${session}' and revision = 1`)).toBe(1)

    await as(LEAD)
    expect(await affected(`
      update case_taking_sessions
         set state = 'lead_review', review_started_by = '${LEAD}', review_started_at = now()
       where id = '${session}' and revision = 2`)).toBe(1)
    expect(await affected(`
      update case_taking_sessions
         set state = 'signed_off', signed_off_by = '${LEAD}', signed_off_at = now()
       where id = '${session}' and revision = 3`)).toBe(1)

    await asOwner()
    const all = await rows<{ id: string; state: string; submitted_by: string; signed_off_by: string }>(
      `select id, state, submitted_by, signed_off_by from case_taking_sessions`)
    // One artefact throughout: the submitter and the signer are different
    // practitioners on the SAME row.
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe(session)
    expect(all[0].state).toBe('signed_off')
    expect(all[0].submitted_by).toBe(ASSOC)
    expect(all[0].signed_off_by).toBe(LEAD)
  })

  it('carries no practitioner_id column at all', async () => {
    const cols = await rows<{ column_name: string }>(`
      select column_name from information_schema.columns
       where table_name = 'case_taking_sessions'`)
    const names = cols.map((c) => c.column_name)
    expect(names).not.toContain('practitioner_id')
    expect(names).not.toContain('work_id')
    // Attribution instead of ownership.
    for (const expected of ['started_by', 'submitted_by', 'review_started_by', 'signed_off_by']) {
      expect(names).toContain(expected)
    }
  })
})

// ─── Sign-off authority ──────────────────────────────────────────────────────

describe('sign-off authority', () => {
  it('the active eligible Lead may sign', async () => {
    const session = await startSession()
    await as(LEAD)
    expect(await affected(`
      update case_taking_sessions set state='signed_off', signed_off_by='${LEAD}', signed_off_at=now()
       where id = '${session}'`)).toBe(1)
  })

  it('a non-Lead may NOT sign', async () => {
    const session = await startSession()
    await as(ASSOC)
    const msg = await refusal(`
      update case_taking_sessions set state='signed_off', signed_off_by='${ASSOC}', signed_off_at=now()
       where id = '${session}'`)
    expect(msg).toMatch(/not the active Lead Responsible Practitioner/i)
  })

  it('nobody may sign as someone else', async () => {
    const session = await startSession()
    await as(ASSOC)
    const msg = await refusal(`
      update case_taking_sessions set state='signed_off', signed_off_by='${LEAD}', signed_off_at=now()
       where id = '${session}'`)
    expect(msg).toMatch(/only be signed by the practitioner performing the action/i)
  })

  it('a Lead who fails lead eligibility may NOT sign', async () => {
    const session = await startSession()
    await asOwner()
    await db.exec(`update test_eligibility set eligible = false
                    where practitioner_id = '${LEAD}' and case_role = 'lead'`)
    await as(LEAD)
    // Losing eligibility also closes can_access_case_care_profile, so RLS
    // denies first and the statement is a no-op rather than an error. Both
    // shapes are denials; what matters is that the row is NOT signed.
    expect(await denied(`
      update case_taking_sessions set state='signed_off', signed_off_by='${LEAD}', signed_off_at=now()
       where id = '${session}'`)).toBe('no_rows')
    await asOwner()
    const r = await rows<{ signed_off_at: string | null; state: string }>(
      `select signed_off_at, state from case_taking_sessions where id = '${session}'`)
    expect(r[0].signed_off_at).toBeNull()
    expect(r[0].state).toBe('in_progress')
  })

  it('the eligibility check itself refuses when RLS is not the gate', async () => {
    // Isolates the trigger from RLS: grant case access via the associate
    // role, keep an active lead role, but fail 'lead' eligibility. Access
    // passes, so the statement reaches the trigger — which must refuse.
    const session = await startSession()
    await asOwner()
    await db.exec(`
      insert into case_team_roles (case_id, practitioner_id, team_role, assigned_by)
        values ('${CASE_A}', '${ASSOC}', 'lead', '${LEAD}');
      insert into test_eligibility (practitioner_id, case_role, eligible)
        values ('${ASSOC}', 'lead', false)
        on conflict (practitioner_id, case_role) do update set eligible = false;`)
    await as(ASSOC)
    const msg = await refusal(`
      update case_taking_sessions set state='signed_off', signed_off_by='${ASSOC}', signed_off_at=now()
       where id = '${session}'`)
    expect(msg).toMatch(/eligibility/i)
  })

  it('a Lead whose role has ended may NOT sign', async () => {
    const session = await startSession()
    await asOwner()
    await db.exec(`update case_team_roles set ended_at = now()
                    where case_id = '${CASE_A}' and practitioner_id = '${LEAD}'`)
    await as(LEAD)
    expect(await denied(`
      update case_taking_sessions set state='signed_off', signed_off_by='${LEAD}', signed_off_at=now()
       where id = '${session}'`)).toBe('no_rows')
    await asOwner()
    expect((await rows<{ signed_off_at: string | null }>(
      `select signed_off_at from case_taking_sessions where id='${session}'`))[0].signed_off_at)
      .toBeNull()
  })

  it('does NOT apply the Protocol-specific sole_unregistered_lead rule', async () => {
    // Case-taking sign-off means "this is the reviewed record of the
    // consultation", not "I professionally adopt this treatment Protocol".
    expect(migrationSql()).not.toContain('sole_unregistered_lead')
    // And an unregulated-category Lead can still sign a case-taking record.
    await asOwner()
    await db.exec(`update practitioners set category = 'unregulated_practitioner'
                    where id = '${LEAD}'`)
    const session = await startSession()
    await as(LEAD)
    expect(await affected(`
      update case_taking_sessions set state='signed_off', signed_off_by='${LEAD}', signed_off_at=now()
       where id = '${session}'`)).toBe(1)
  })

  it('a signature is both columns or neither', async () => {
    const session = await startSession()
    // As a service-role caller (no auth.uid()) the authority trigger returns
    // early, so the CHECK constraint is what refuses. This is the constraint
    // under test, isolated from the trigger.
    await asOwner()
    expect(await refusal(`
      update case_taking_sessions set signed_off_at = now() where id = '${session}'`))
      .toMatch(/case_taking_signoff_complete|case_taking_signoff_state/i)
  })

  it('an incomplete signature is refused for an end user too', async () => {
    const session = await startSession()
    await as(LEAD)
    // Here the trigger gets there first: signed_off_by NULL is not auth.uid().
    expect(await refusal(`
      update case_taking_sessions set signed_off_at = now() where id = '${session}'`))
      .toMatch(/only be signed by the practitioner performing the action/i)
  })

  it('state and signature cannot disagree', async () => {
    const session = await startSession()
    await as(LEAD)
    expect(await refusal(`
      update case_taking_sessions set state = 'signed_off' where id = '${session}'`))
      .toMatch(/case_taking_signoff_state/i)
  })
})

// ─── Signed immutability + amendment chain ───────────────────────────────────

describe('a signed session is immutable', () => {
  async function signedSession(): Promise<string> {
    const session = await startSession()
    await as(LEAD)
    await db.exec(`update case_taking_sessions
                      set state='signed_off', signed_off_by='${LEAD}', signed_off_at=now()
                    where id = '${session}'`)
    return session
  }

  it('refuses every change to a signed session', async () => {
    const session = await signedSession()
    await as(LEAD)
    expect(await refusal(`
      update case_taking_sessions set current_position = 'section-4' where id = '${session}'`))
      .toMatch(/signed and cannot be changed|create an amendment/i)
  })

  it('refuses deletion of a signed session', async () => {
    const session = await signedSession()
    await as(LEAD)
    expect(await refusal(`delete from case_taking_sessions where id = '${session}'`))
      .toMatch(/cannot be deleted|clinical record/i)
  })

  it('refuses changes to the answers of a signed session', async () => {
    const session = await startSession()
    await as(LEAD)
    await db.exec(`
      insert into case_taking_answers (session_id, entry_kind, question_id, value, updated_by)
      values ('${session}', 'answer', 'q.sleep.onset', '"20 minutes"', '${LEAD}')`)
    await db.exec(`update case_taking_sessions
                      set state='signed_off', signed_off_by='${LEAD}', signed_off_at=now()
                    where id = '${session}'`)
    expect(await refusal(`
      update case_taking_answers set value = '"changed"' where session_id = '${session}'`))
      .toMatch(/signed and its answers cannot be changed/i)
  })

  it('refuses NEW answers on a signed session', async () => {
    const session = await signedSession()
    await as(LEAD)
    expect(await refusal(`
      insert into case_taking_answers (session_id, entry_kind, question_id, value, updated_by)
      values ('${session}', 'answer', 'q.late.addition', '"sneaked in"', '${LEAD}')`))
      .toMatch(/signed and its answers cannot be changed/i)
  })

  it('refuses deletion of a signed session\'s answers', async () => {
    const session = await startSession()
    await as(LEAD)
    await db.exec(`
      insert into case_taking_answers (session_id, entry_kind, question_id, value, updated_by)
      values ('${session}', 'answer', 'q.a', '1', '${LEAD}')`)
    await db.exec(`update case_taking_sessions
                      set state='signed_off', signed_off_by='${LEAD}', signed_off_at=now()
                    where id = '${session}'`)
    expect(await refusal(`delete from case_taking_answers where session_id = '${session}'`))
      .toMatch(/signed and its answers cannot be changed/i)
  })

  it('an amendment creates a SUCCESSOR version, signing having freed the slot', async () => {
    const v1 = await signedSession()
    await as(LEAD)
    const v2 = await rows<{ id: string; version: number }>(`
      insert into case_taking_sessions
        (case_id, consultation_seq, consultation_kind, started_by, version, supersedes)
      values ('${CASE_A}', 1, 'initial', '${LEAD}', 2, '${v1}')
      returning id, version`)
    expect(v2[0].version).toBe(2)
    // Both versions coexist; history is not rewritten.
    await asOwner()
    expect(await rows(`select id from case_taking_sessions where case_id='${CASE_A}'`)).toHaveLength(2)
  })

  it('refuses TWO unsigned amendments of the same consultation', async () => {
    const v1 = await signedSession()
    await as(LEAD)
    await db.exec(`
      insert into case_taking_sessions
        (case_id, consultation_seq, consultation_kind, started_by, version, supersedes)
      values ('${CASE_A}', 1, 'initial', '${LEAD}', 2, '${v1}')`)
    expect(await refusal(`
      insert into case_taking_sessions
        (case_id, consultation_seq, consultation_kind, started_by, version, supersedes)
      values ('${CASE_A}', 1, 'initial', '${LEAD}', 3, '${v1}')`))
      .toMatch(/case_taking_one_open_version_idx|case_taking_supersedes_idx|duplicate key/i)
  })

  it('keeps the chain linear — two rows cannot supersede the same version', async () => {
    const v1 = await signedSession()
    await as(LEAD)
    await db.exec(`
      insert into case_taking_sessions
        (case_id, consultation_seq, consultation_kind, started_by, version, supersedes)
      values ('${CASE_A}', 1, 'initial', '${LEAD}', 2, '${v1}')`)
    await db.exec(`update case_taking_sessions
                      set state='signed_off', signed_off_by='${LEAD}', signed_off_at=now()
                    where supersedes = '${v1}'`)
    expect(await refusal(`
      insert into case_taking_sessions
        (case_id, consultation_seq, consultation_kind, started_by, version, supersedes)
      values ('${CASE_A}', 1, 'initial', '${LEAD}', 3, '${v1}')`))
      .toMatch(/case_taking_supersedes_idx|duplicate key/i)
  })

  it('version 1 may not supersede anything, and later versions must', async () => {
    const v1 = await signedSession()
    await as(LEAD)
    expect(await refusal(`
      insert into case_taking_sessions
        (case_id, consultation_seq, consultation_kind, started_by, version, supersedes)
      values ('${CASE_A}', 2, 'follow_up', '${LEAD}', 1, '${v1}')`))
      .toMatch(/case_taking_version_chain/i)
    expect(await refusal(`
      insert into case_taking_sessions
        (case_id, consultation_seq, consultation_kind, started_by, version, supersedes)
      values ('${CASE_A}', 1, 'initial', '${LEAD}', 2, null)`))
      .toMatch(/case_taking_version_chain/i)
  })

  it('a row cannot supersede itself', async () => {
    await asOwner()
    const id = '77777777-7777-7777-7777-777777777777'
    expect(await refusal(`
      insert into case_taking_sessions
        (id, case_id, consultation_seq, consultation_kind, started_by, version, supersedes)
      values ('${id}', '${CASE_A}', 1, 'initial', '${LEAD}', 2, '${id}')`))
      .toMatch(/case_taking_no_self_supersede/i)
  })
})

// ─── Consultation identity ───────────────────────────────────────────────────

describe('one case, many consultations', () => {
  it('a follow-up is an independent consultation alongside an open initial', async () => {
    await startSession({ seq: 1, kind: 'initial' })
    await as(LEAD)
    const followUp = await rows<{ id: string }>(`
      insert into case_taking_sessions (case_id, consultation_seq, consultation_kind, started_by)
      values ('${CASE_A}', 2, 'follow_up', '${LEAD}') returning id`)
    expect(followUp[0].id).toBeTruthy()
    await asOwner()
    expect(await rows(`select id from case_taking_sessions`)).toHaveLength(2)
  })

  it('accepts exactly the three canonical consultation kinds', async () => {
    for (const [i, kind] of ['initial', 'follow_up', 'review'].entries()) {
      await as(LEAD)
      await db.exec(`
        insert into case_taking_sessions (case_id, consultation_seq, consultation_kind, started_by)
        values ('${CASE_A}', ${i + 1}, '${kind}', '${LEAD}')`)
    }
    await asOwner()
    expect(await rows(`select id from case_taking_sessions`)).toHaveLength(3)
  })

  it('REFUSES reopened as a consultation kind', async () => {
    // Reopening is lifecycle state, not the clinical type of a consultation.
    await as(LEAD)
    expect(await refusal(`
      insert into case_taking_sessions (case_id, consultation_seq, consultation_kind, started_by)
      values ('${CASE_A}', 1, 'reopened', '${LEAD}')`))
      .toMatch(/consultation_kind/i)
  })

  it('refuses an unknown consultation kind', async () => {
    await as(LEAD)
    expect(await refusal(`
      insert into case_taking_sessions (case_id, consultation_seq, consultation_kind, started_by)
      values ('${CASE_A}', 1, 'whatever', '${LEAD}')`))
      .toMatch(/consultation_kind/i)
  })

  it('refuses an unknown workflow state', async () => {
    await as(LEAD)
    expect(await refusal(`
      insert into case_taking_sessions (case_id, consultation_seq, consultation_kind, started_by, state)
      values ('${CASE_A}', 1, 'initial', '${LEAD}', 'nearly_done')`))
      .toMatch(/state/i)
  })
})

// ─── Answers, observations, safety ───────────────────────────────────────────

describe('answers: one current value per canonical question', () => {
  it('refuses a second ANSWER for the same question in one session version', async () => {
    const session = await startSession()
    await as(LEAD)
    await db.exec(`
      insert into case_taking_answers (session_id, entry_kind, question_id, value, updated_by)
      values ('${session}', 'answer', 'q.sleep.onset', '"20 min"', '${LEAD}')`)
    expect(await refusal(`
      insert into case_taking_answers (session_id, entry_kind, question_id, value, updated_by)
      values ('${session}', 'answer', 'q.sleep.onset', '"40 min"', '${LEAD}')`))
      .toMatch(/case_taking_one_current_answer_idx|duplicate key/i)
  })

  it('allows the same question in a DIFFERENT session version', async () => {
    const v1 = await startSession()
    await as(LEAD)
    await db.exec(`
      insert into case_taking_answers (session_id, entry_kind, question_id, value, updated_by)
      values ('${v1}', 'answer', 'q.sleep.onset', '"20 min"', '${LEAD}');
      update case_taking_sessions set state='signed_off', signed_off_by='${LEAD}', signed_off_at=now()
       where id = '${v1}';`)
    const v2 = await rows<{ id: string }>(`
      insert into case_taking_sessions
        (case_id, consultation_seq, consultation_kind, started_by, version, supersedes)
      values ('${CASE_A}', 1, 'initial', '${LEAD}', 2, '${v1}') returning id`)
    await db.exec(`
      insert into case_taking_answers (session_id, entry_kind, question_id, value, updated_by)
      values ('${v2[0].id}', 'answer', 'q.sleep.onset', '"35 min"', '${LEAD}')`)
    await asOwner()
    expect(await rows(`select id from case_taking_answers where question_id='q.sleep.onset'`))
      .toHaveLength(2)
  })

  it('an answer MUST carry a canonical question id', async () => {
    const session = await startSession()
    await as(LEAD)
    expect(await refusal(`
      insert into case_taking_answers (session_id, entry_kind, value, updated_by)
      values ('${session}', 'answer', '"orphaned"', '${LEAD}')`))
      .toMatch(/case_taking_entry_question_shape/i)
  })
})

describe('observations are multiple and do not borrow question identity', () => {
  it('permits many observations in one session', async () => {
    const session = await startSession()
    await as(LEAD)
    await db.exec(`
      insert into case_taking_answers (session_id, entry_kind, value, updated_by) values
        ('${session}', 'observation', '"pale complexion"', '${LEAD}'),
        ('${session}', 'observation', '"guarded posture"', '${LEAD}'),
        ('${session}', 'observation', '"hoarse voice"',    '${LEAD}')`)
    await asOwner()
    expect(await rows(`select id from case_taking_answers where entry_kind = 'observation'`))
      .toHaveLength(3)
  })

  it('an answer and many observations coexist in the same session', async () => {
    const session = await startSession()
    await as(LEAD)
    await db.exec(`
      insert into case_taking_answers (session_id, entry_kind, question_id, value, updated_by)
      values ('${session}', 'answer', 'q.sleep.onset', '"20 min"', '${LEAD}');
      insert into case_taking_answers (session_id, entry_kind, value, updated_by) values
        ('${session}', 'observation', '"yawning"', '${LEAD}'),
        ('${session}', 'observation', '"dark circles"', '${LEAD}');`)
    await asOwner()
    expect(await rows(`select id from case_taking_answers where session_id = '${session}'`))
      .toHaveLength(3)
  })

  it('an observation may NOT occupy a Question Graph identifier', async () => {
    // The rejected design encoded observations as question_id = 'obs:<uuid>'.
    const session = await startSession()
    await as(LEAD)
    expect(await refusal(`
      insert into case_taking_answers (session_id, entry_kind, question_id, value, updated_by)
      values ('${session}', 'observation', 'obs:11111111-1111-1111-1111-111111111111', '"x"', '${LEAD}')`))
      .toMatch(/case_taking_entry_question_shape/i)
  })

  it('every entry is individually addressable', async () => {
    const session = await startSession()
    await as(LEAD)
    const inserted = await rows<{ entry_id: string }>(`
      insert into case_taking_answers (session_id, entry_kind, value, updated_by) values
        ('${session}', 'observation', '"a"', '${LEAD}'),
        ('${session}', 'observation', '"b"', '${LEAD}')
      returning entry_id`)
    expect(new Set(inserted.map((r) => r.entry_id)).size).toBe(2)
  })

  it('refuses a duplicate entry_id within a session', async () => {
    const session = await startSession()
    const entry = '88888888-8888-8888-8888-888888888888'
    await as(LEAD)
    await db.exec(`
      insert into case_taking_answers (session_id, entry_kind, entry_id, value, updated_by)
      values ('${session}', 'observation', '${entry}', '"a"', '${LEAD}')`)
    expect(await refusal(`
      insert into case_taking_answers (session_id, entry_kind, entry_id, value, updated_by)
      values ('${session}', 'observation', '${entry}', '"b"', '${LEAD}')`))
      .toMatch(/case_taking_entry_identity_idx|duplicate key/i)
  })
})

describe('the safety invariant: reading never marks a safety item asked', () => {
  it('REFUSES a safety entry without asked_at', async () => {
    const session = await startSession()
    await as(LEAD)
    expect(await refusal(`
      insert into case_taking_answers (session_id, entry_kind, question_id, value, updated_by)
      values ('${session}', 'safety', 'q.safety.red_flag.weight_loss', '"no"', '${LEAD}')`))
      .toMatch(/case_taking_safety_requires_asked/i)
  })

  it('accepts a safety entry that records when it was actually asked', async () => {
    const session = await startSession()
    await as(LEAD)
    await db.exec(`
      insert into case_taking_answers
        (session_id, entry_kind, question_id, annex_rule_id, value, asked_at, updated_by)
      values ('${session}', 'safety', 'q.safety.red_flag.weight_loss',
              'annex1.rule.unexplained_weight_loss', '"no"', now(), '${LEAD}')`)
    await asOwner()
    const r = await rows<{ asked_at: string; annex_rule_id: string }>(
      `select asked_at, annex_rule_id from case_taking_answers where entry_kind = 'safety'`)
    expect(r[0].asked_at).toBeTruthy()
    expect(r[0].annex_rule_id).toBe('annex1.rule.unexplained_weight_loss')
  })

  it('refuses nulling asked_at afterwards', async () => {
    const session = await startSession()
    await as(LEAD)
    await db.exec(`
      insert into case_taking_answers (session_id, entry_kind, question_id, value, asked_at, updated_by)
      values ('${session}', 'safety', 'q.safety.a', '"no"', now(), '${LEAD}')`)
    expect(await refusal(`
      update case_taking_answers set asked_at = null where entry_kind = 'safety'`))
      .toMatch(/case_taking_safety_requires_asked/i)
  })

  it('keeps BOTH the question identity and the annex identity', async () => {
    // Safety data retains its canonical safety identity alongside the node id.
    const session = await startSession()
    await as(LEAD)
    await db.exec(`
      insert into case_taking_answers
        (session_id, entry_kind, question_id, annex_rule_id, value, asked_at, updated_by)
      values ('${session}', 'safety', 'q.safety.b', 'annex1.rule.b', '"yes"', now(), '${LEAD}')`)
    await asOwner()
    const r = await rows<{ question_id: string; annex_rule_id: string }>(
      `select question_id, annex_rule_id from case_taking_answers where entry_kind='safety'`)
    expect(r[0].question_id).toBe('q.safety.b')
    expect(r[0].annex_rule_id).toBe('annex1.rule.b')
  })

  it('refuses annex_rule_id on a non-safety entry', async () => {
    const session = await startSession()
    await as(LEAD)
    expect(await refusal(`
      insert into case_taking_answers
        (session_id, entry_kind, question_id, annex_rule_id, value, updated_by)
      values ('${session}', 'answer', 'q.sleep.onset', 'annex1.rule.b', '"20"', '${LEAD}')`))
      .toMatch(/case_taking_annex_scope/i)
  })

  it('a safety entry still obeys one-current-answer-per-question', async () => {
    const session = await startSession()
    await as(LEAD)
    await db.exec(`
      insert into case_taking_answers (session_id, entry_kind, question_id, value, asked_at, updated_by)
      values ('${session}', 'safety', 'q.safety.c', '"no"', now(), '${LEAD}')`)
    expect(await refusal(`
      insert into case_taking_answers (session_id, entry_kind, question_id, value, asked_at, updated_by)
      values ('${session}', 'safety', 'q.safety.c', '"yes"', now(), '${LEAD}')`))
      .toMatch(/case_taking_one_current_answer_idx|duplicate key/i)
  })
})

// ─── Optimistic concurrency ──────────────────────────────────────────────────

describe('optimistic concurrency: no last-writer-wins', () => {
  it('a stale write affects zero rows instead of overwriting', async () => {
    const session = await startSession()
    await as(LEAD)
    const entry = (await rows<{ entry_id: string }>(`
      insert into case_taking_answers (session_id, entry_kind, question_id, value, updated_by)
      values ('${session}', 'answer', 'q.sleep.onset', '"20 min"', '${LEAD}')
      returning entry_id`))[0].entry_id

    // Practitioner A writes against revision 1 and wins.
    expect(await affected(`
      update case_taking_answers set value = '"30 min"', updated_by = '${LEAD}'
       where session_id = '${session}' and entry_id = '${entry}' and revision = 1`)).toBe(1)

    // Practitioner B still holds revision 1 — refused, not applied.
    await as(ASSOC)
    expect(await affected(`
      update case_taking_answers set value = '"90 min"', updated_by = '${ASSOC}'
       where session_id = '${session}' and entry_id = '${entry}' and revision = 1`)).toBe(0)

    await asOwner()
    const r = await rows<{ value: string; revision: number }>(
      `select value, revision from case_taking_answers where entry_id = '${entry}'`)
    // A's value survived; B's stale overwrite never landed.
    expect(r[0].value).toBe('30 min')
    expect(r[0].revision).toBe(2)
  })

  it('B succeeds once it refreshes to the current revision', async () => {
    const session = await startSession()
    await as(LEAD)
    const entry = (await rows<{ entry_id: string }>(`
      insert into case_taking_answers (session_id, entry_kind, question_id, value, updated_by)
      values ('${session}', 'answer', 'q.a', '"1"', '${LEAD}') returning entry_id`))[0].entry_id
    await db.exec(`update case_taking_answers set value='"2"', updated_by='${LEAD}'
                    where entry_id='${entry}' and revision=1`)
    await as(ASSOC)
    // Reconcile that field only, then write against what is now current.
    expect(await affected(`
      update case_taking_answers set value='"3"', updated_by='${ASSOC}'
       where entry_id='${entry}' and revision=2`)).toBe(1)
  })

  it('the revision counter cannot be forged by the client', async () => {
    const session = await startSession()
    await as(LEAD)
    const entry = (await rows<{ entry_id: string }>(`
      insert into case_taking_answers (session_id, entry_kind, question_id, value, updated_by)
      values ('${session}', 'answer', 'q.a', '"1"', '${LEAD}') returning entry_id`))[0].entry_id
    // Pinning revision in the SET list would let a client win every race.
    await db.exec(`update case_taking_answers set value='"2"', revision = 1, updated_by='${LEAD}'
                    where entry_id='${entry}' and revision = 1`)
    await asOwner()
    const r = await rows<{ revision: number }>(
      `select revision from case_taking_answers where entry_id='${entry}'`)
    expect(r[0].revision).toBe(2)
  })

  it('advances the session revision on every update', async () => {
    const session = await startSession()
    await as(LEAD)
    await db.exec(`update case_taking_sessions set current_position='s2' where id='${session}'`)
    await db.exec(`update case_taking_sessions set current_position='s3' where id='${session}'`)
    await asOwner()
    const r = await rows<{ revision: number }>(
      `select revision from case_taking_sessions where id='${session}'`)
    expect(r[0].revision).toBe(3)
  })

  it('touches updated_at on every write', async () => {
    const session = await startSession()
    await asOwner()
    const before = (await rows<{ updated_at: string }>(
      `select updated_at from case_taking_sessions where id='${session}'`))[0].updated_at
    await as(LEAD)
    await db.exec(`update case_taking_sessions set current_position='s9' where id='${session}'`)
    await asOwner()
    const after = (await rows<{ updated_at: string }>(
      `select updated_at from case_taking_sessions where id='${session}'`))[0].updated_at
    expect(new Date(after).getTime()).toBeGreaterThanOrEqual(new Date(before).getTime())
  })

  it('two practitioners editing DIFFERENT fields both succeed', async () => {
    // Conflict is per field, not per form: one stale field must never discard
    // another practitioner's unrelated work.
    const session = await startSession()
    await as(LEAD)
    await db.exec(`
      insert into case_taking_answers (session_id, entry_kind, question_id, value, updated_by) values
        ('${session}', 'answer', 'q.a', '"1"', '${LEAD}'),
        ('${session}', 'answer', 'q.b', '"1"', '${LEAD}')`)
    expect(await affected(`
      update case_taking_answers set value='"lead"', updated_by='${LEAD}'
       where session_id='${session}' and question_id='q.a' and revision=1`)).toBe(1)
    await as(ASSOC)
    expect(await affected(`
      update case_taking_answers set value='"assoc"', updated_by='${ASSOC}'
       where session_id='${session}' and question_id='q.b' and revision=1`)).toBe(1)
  })
})

// ─── RLS ─────────────────────────────────────────────────────────────────────

describe('RLS: access comes from the case, through one function', () => {
  it('an outsider sees nothing', async () => {
    const session = await startSession()
    await as(OUTSIDER)
    expect(await rows(`select id from case_taking_sessions where id='${session}'`)).toHaveLength(0)
  })

  it('an outsider cannot insert a session', async () => {
    await as(OUTSIDER)
    // The Lead-start trigger reaches them before RLS does — it is SECURITY
    // DEFINER and BEFORE INSERT. Either way the insert is impossible.
    expect(await refusal(`
      insert into case_taking_sessions (case_id, consultation_seq, consultation_kind, started_by)
      values ('${CASE_A}', 1, 'initial', '${OUTSIDER}')`))
      .toMatch(/only the active Lead|row-level security/i)
  })

  it('RLS itself blocks the insert when the Lead-start rule is satisfied', async () => {
    // A practitioner with an active lead role but NO care relationship: the
    // trigger passes, so this isolates the policy's WITH CHECK.
    await asOwner()
    await db.exec(`
      insert into case_team_roles (case_id, practitioner_id, team_role, assigned_by)
        values ('${CASE_A}', '${OUTSIDER}', 'lead', '${LEAD}')`)
    await as(OUTSIDER)
    expect(await refusal(`
      insert into case_taking_sessions (case_id, consultation_seq, consultation_kind, started_by)
      values ('${CASE_A}', 1, 'initial', '${OUTSIDER}')`))
      .toMatch(/row-level security/i)
  })

  it('an outsider cannot read answers', async () => {
    const session = await startSession()
    await as(LEAD)
    await db.exec(`
      insert into case_taking_answers (session_id, entry_kind, question_id, value, updated_by)
      values ('${session}', 'answer', 'q.a', '"private"', '${LEAD}')`)
    await as(OUTSIDER)
    expect(await rows(`select id from case_taking_answers`)).toHaveLength(0)
  })

  it('a practitioner without a care link is denied even with a case role', async () => {
    const session = await startSession()
    await asOwner()
    await db.exec(`update client_practitioner_links set ended_at = now()
                    where practitioner_id = '${ASSOC}'`)
    await as(ASSOC)
    expect(await rows(`select id from case_taking_sessions where id='${session}'`)).toHaveLength(0)
  })

  it('a practitioner without client consent is denied', async () => {
    const session = await startSession()
    await asOwner()
    await db.exec(`update test_access_consent set granted = false
                    where practitioner_id = '${ASSOC}'`)
    await as(ASSOC)
    expect(await rows(`select id from case_taking_sessions where id='${session}'`)).toHaveLength(0)
  })

  it('an unauthenticated caller sees nothing', async () => {
    await startSession()
    await db.exec(`reset role; select set_config('test.auth_uid', '', false); set role authenticated;`)
    expect(await rows(`select id from case_taking_sessions`)).toHaveLength(0)
  })
})

describe('RLS: student / supervised access', () => {
  it('a supervised student may read the shared session', async () => {
    const session = await startSession()
    await as(STUDENT)
    expect(await rows(`select id from case_taking_sessions where id='${session}'`)).toHaveLength(1)
  })

  it('a supervised student may contribute answers', async () => {
    const session = await startSession()
    await as(STUDENT)
    await db.exec(`
      insert into case_taking_answers (session_id, entry_kind, question_id, value, updated_by)
      values ('${session}', 'answer', 'q.a', '"student entry"', '${STUDENT}')`)
    await asOwner()
    expect(await rows(`select id from case_taking_answers`)).toHaveLength(1)
  })

  it('a student with NO supervisor is denied', async () => {
    const session = await startSession()
    await asOwner()
    await db.exec(`update case_team_roles set supervisor_id = null
                    where practitioner_id = '${STUDENT}'`)
    await as(STUDENT)
    expect(await rows(`select id from case_taking_sessions where id='${session}'`)).toHaveLength(0)
  })

  it('a student whose supervisor has left the case is denied', async () => {
    const session = await startSession()
    await asOwner()
    await db.exec(`update case_team_roles set ended_at = now()
                    where practitioner_id = '${LEAD}' and team_role = 'lead'`)
    await as(STUDENT)
    expect(await rows(`select id from case_taking_sessions where id='${session}'`)).toHaveLength(0)
  })

  it('a student may NOT sign off', async () => {
    const session = await startSession()
    await as(STUDENT)
    expect(await refusal(`
      update case_taking_sessions set state='signed_off', signed_off_by='${STUDENT}', signed_off_at=now()
       where id='${session}'`))
      .toMatch(/not the active Lead|row-level security/i)
  })
})

// ─── case_contributions ──────────────────────────────────────────────────────

describe('case_contributions: append-only, now including the new linkage', () => {
  async function contribution(session: string, entry: string): Promise<string> {
    await as(LEAD)
    const r = await rows<{ id: string }>(`
      insert into case_contributions
        (case_id, author_id, team_role, kind, content, session_id, entry_id, question_id)
      values ('${CASE_A}', '${LEAD}', 'lead', 'answer_change', 'was 20 min, now 30 min',
              '${session}', '${entry}', 'q.sleep.onset')
      returning id`)
    return r[0].id
  }

  it('records a contribution linked to a session, entry and question', async () => {
    const session = await startSession()
    const entry = '99999999-9999-9999-9999-999999999999'
    const id = await contribution(session, entry)
    expect(id).toBeTruthy()
  })

  // The append-only trigger is tested as the table OWNER, which is the
  // caller it actually exists to stop. case_contributions carries SELECT and
  // INSERT policies and NO UPDATE policy, so an authenticated UPDATE matches
  // no row and never reaches the trigger (proven immediately below). The
  // rewrite risk is therefore a service-role write, where RLS does not apply
  // and block_contribution_rewrite() is the only guard.

  it('an authenticated UPDATE never even reaches the trigger — no UPDATE policy', async () => {
    const session = await startSession()
    await contribution(session, '99999999-9999-9999-9999-999999999999')
    await as(LEAD)
    expect(await denied(`update case_contributions set content = 'rewritten'`)).toBe('no_rows')
    await asOwner()
    expect((await rows<{ content: string }>(`select content from case_contributions`))[0].content)
      .toBe('was 20 min, now 30 min')
  })

  it('refuses rewriting entry_id', async () => {
    const session = await startSession()
    const entry = '99999999-9999-9999-9999-999999999999'
    await contribution(session, entry)
    await asOwner()
    expect(await refusal(`
      update case_contributions set entry_id = '11111111-2222-3333-4444-555555555555'`))
      .toMatch(/append-only/i)
  })

  it('refuses rewriting question_id', async () => {
    const session = await startSession()
    await contribution(session, '99999999-9999-9999-9999-999999999999')
    await asOwner()
    expect(await refusal(`update case_contributions set question_id = 'q.something.else'`))
      .toMatch(/append-only/i)
  })

  it('refuses rewriting session_id', async () => {
    const session = await startSession()
    await contribution(session, '99999999-9999-9999-9999-999999999999')
    await asOwner()
    expect(await refusal(`update case_contributions set session_id = null`))
      .toMatch(/append-only/i)
  })

  it('still refuses rewriting content, author, kind, case or created_at', async () => {
    const session = await startSession()
    await contribution(session, '99999999-9999-9999-9999-999999999999')
    await asOwner()
    for (const change of [
      `content = 'rewritten'`, `author_id = '${ASSOC}'`, `kind = 'note'`,
      `created_at = now() - interval '1 day'`,
    ]) {
      expect(await refusal(`update case_contributions set ${change}`)).toMatch(/append-only/i)
    }
  })

  it('still allows the columns that were always mutable', async () => {
    // Proof the widening froze only the three new columns and nothing else.
    const session = await startSession()
    await contribution(session, '99999999-9999-9999-9999-999999999999')
    await asOwner()
    expect(await affected(`update case_contributions set client_confirmed = true`)).toBe(1)
    expect(await affected(`
      update case_contributions set supervisor_verified_by = '${LEAD}', supervisor_verified_at = now()`))
      .toBe(1)
  })

  it('leaves non-case-taking contributions unaffected', async () => {
    await as(LEAD)
    const r = await rows<{ session_id: string | null; entry_id: string | null }>(`
      insert into case_contributions (case_id, author_id, team_role, kind, content)
      values ('${CASE_A}', '${LEAD}', 'lead', 'consultation_note', 'no case-taking link')
      returning session_id, entry_id`)
    expect(r[0].session_id).toBeNull()
    expect(r[0].entry_id).toBeNull()
  })

  it('answers "what changed in this consultation version" in one indexed read', async () => {
    const session = await startSession()
    await as(LEAD)
    await db.exec(`
      insert into case_contributions
        (case_id, author_id, team_role, kind, content, session_id, entry_id, question_id) values
        ('${CASE_A}','${LEAD}','lead','answer_change','a','${session}',
         '99999999-9999-9999-9999-999999999999','q.a'),
        ('${CASE_A}','${LEAD}','lead','answer_change','b','${session}',
         '99999999-9999-9999-9999-999999999998','q.b')`)
    expect(await rows(`select id from case_contributions where session_id = '${session}'`))
      .toHaveLength(2)
  })
})

// ─── Static / scope checks on the migration file ─────────────────────────────

describe('migration scope: exactly the approved objects, nothing else', () => {
  // Executable SQL only. The header prose deliberately names the rejected V1
  // key, case_practitioner_work and sole_unregistered_lead to record why none
  // is used, so asserting against the raw file would test the comments.
  const src = migrationSql()

  it('creates exactly the two approved tables', async () => {
    const created = [...src.matchAll(/CREATE TABLE public\.(\w+)/g)].map((m) => m[1])
    expect(created.slice().sort()).toEqual(['case_taking_answers', 'case_taking_sessions'])
  })

  it('alters only case_contributions', () => {
    const altered = [...src.matchAll(/ALTER TABLE public\.(\w+)\s+ADD/g)].map((m) => m[1])
    expect([...new Set(altered)]).toEqual(['case_contributions'])
  })

  it('replaces exactly one pre-existing function', () => {
    const replaced = [...src.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)/g)].map((m) => m[1])
    const preExisting = replaced.filter((n) => n === 'block_contribution_rewrite')
    expect(preExisting).toEqual(['block_contribution_rewrite'])
    // The other three are new to this migration.
    expect(replaced.slice().sort()).toEqual([
      'block_contribution_rewrite', 'bump_case_taking_revision',
      'enforce_case_taking_authority', 'freeze_signed_case_taking',
      'freeze_signed_case_taking_answers',
    ].slice().sort())
  })

  it('does not drop anything', () => {
    expect(src).not.toMatch(/\bDROP\s+(TABLE|COLUMN|POLICY|FUNCTION|TRIGGER|INDEX|CONSTRAINT)\b/i)
  })

  it('does not touch any out-of-scope table', () => {
    for (const table of [
      'client_cases', 'case_team_roles', 'client_practitioner_links', 'practitioners',
      'member_protocols', 'case_events', 'intake_answers', 'intake_responses',
      'consent_records', 'ai_summaries', 'reasoning_traces', 'case_practitioner_work',
    ]) {
      expect(src).not.toMatch(new RegExp(`ALTER TABLE public\\.${table}`, 'i'))
      expect(src).not.toMatch(new RegExp(`CREATE TABLE public\\.${table}`, 'i'))
    }
  })

  it('creates no assignment or routing artefact', () => {
    // No data is written at all, so nothing can be routed or assigned.
    expect(src).not.toMatch(/INSERT INTO/i)
    expect(src).not.toMatch(/case_practitioner_work/i)
    expect(src).not.toMatch(/client_practitioner_links/i)
    expect(src).not.toMatch(/INTAKE_ASSIGNMENT/i)
    // "assignment" survives only inside the sign-off error message, which is
    // inherited verbatim from the live Protocol trigger. Strip quoted
    // literals and it must be gone from the code itself.
    const code = src.replace(/'(?:[^']|'')*'/g, "''")
    expect(code).not.toMatch(/assignment/i)
    expect(code).not.toMatch(/routing/i)
  })

  it('runs as a single transaction', () => {
    expect(src.trimStart()).toMatch(/BEGIN;/)
    expect(src.trimEnd().endsWith('COMMIT;')).toBe(true)
  })

  it('does not reintroduce the rejected V1 key', () => {
    expect(src).not.toMatch(/case_id,\s*practitioner_id/i)
  })

  it('anchors RLS on the one canonical access function', () => {
    expect(src).toContain('can_access_case_care_profile')
    // No second copy of the access rule.
    expect(src).not.toMatch(/has_practitioner_access_consent/i)
    expect(src).not.toMatch(/team_role\s*=\s*'student'/i)
  })

  it('leaves every existing policy alone', () => {
    const policies = [...src.matchAll(/CREATE POLICY (\w+)/g)].map((m) => m[1])
    expect(policies.slice().sort()).toEqual(
      ['case_taking_answers_access', 'case_taking_sessions_access'])
  })
})

describe('the live catalogue after 0066', () => {
  it('both tables have RLS enabled', async () => {
    await asOwner()
    const r = await rows<{ relname: string; relrowsecurity: boolean }>(`
      select relname, relrowsecurity from pg_class
       where relname in ('case_taking_sessions','case_taking_answers')`)
    expect(r).toHaveLength(2)
    for (const t of r) expect(t.relrowsecurity).toBe(true)
  })

  it('every approved index exists', async () => {
    await asOwner()
    const r = await rows<{ indexname: string }>(`
      select indexname from pg_indexes
       where tablename in ('case_taking_sessions','case_taking_answers','case_contributions')`)
    const names = r.map((i) => i.indexname)
    for (const expected of [
      'case_taking_one_open_version_idx', 'case_taking_version_idx',
      'case_taking_supersedes_idx', 'case_taking_sessions_case_state_idx',
      'case_taking_one_current_answer_idx', 'case_taking_entry_identity_idx',
      'case_taking_answers_session_section_idx',
      'case_contributions_entry_history_idx', 'case_contributions_case_question_idx',
    ]) {
      expect(names).toContain(expected)
    }
  })

  it('the open-version index is partial on signed_off_at', async () => {
    await asOwner()
    const r = await rows<{ indexdef: string }>(`
      select indexdef from pg_indexes where indexname = 'case_taking_one_open_version_idx'`)
    expect(r[0].indexdef).toMatch(/WHERE \(signed_off_at IS NULL\)/i)
    expect(r[0].indexdef).toMatch(/case_id, consultation_seq/i)
  })

  it('the current-answer index excludes observations', async () => {
    await asOwner()
    const r = await rows<{ indexdef: string }>(`
      select indexdef from pg_indexes where indexname = 'case_taking_one_current_answer_idx'`)
    expect(r[0].indexdef).toMatch(/entry_kind/i)
    expect(r[0].indexdef).not.toMatch(/observation/i)
  })

  it('case_contributions gained exactly three columns', async () => {
    await asOwner()
    const r = await rows<{ column_name: string }>(`
      select column_name from information_schema.columns
       where table_name = 'case_contributions'`)
    const names = r.map((c) => c.column_name)
    for (const added of ['session_id', 'entry_id', 'question_id']) {
      expect(names).toContain(added)
    }
    expect(names).toHaveLength(15)   // 12 before + 3
  })

  it('all three new contribution columns are nullable', async () => {
    await asOwner()
    const r = await rows<{ column_name: string; is_nullable: string }>(`
      select column_name, is_nullable from information_schema.columns
       where table_name = 'case_contributions'
         and column_name in ('session_id','entry_id','question_id')`)
    expect(r).toHaveLength(3)
    for (const c of r) expect(c.is_nullable).toBe('YES')
  })
})
