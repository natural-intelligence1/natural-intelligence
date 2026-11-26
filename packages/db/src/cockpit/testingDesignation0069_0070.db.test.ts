/*
 * Database behaviour of migrations 0069 and 0070, proven against a real
 * Postgres.
 *
 * PGlite (Postgres compiled to WASM) in-process: no Docker, no network, no
 * Supabase project, and PRODUCTION IS NEVER TOUCHED. Both migration files are
 * read from disk and executed, so these tests exercise the real SQL and fail
 * if it changes behaviour — they are not a paraphrase of it.
 *
 * WHY THIS SUITE EXISTS
 *
 * 0069 and 0070 were applied to Production, where the designation and grant
 * changes can be verified by inspection. What inspection CANNOT verify is
 * behaviour, because proving it on Production would mean creating cases and
 * signatures there — which WP1 forbids. So the behaviour is proven here:
 *
 *   - the new-case test default is applied by trigger, so it covers every
 *     case-creation path rather than the one that remembered to ask;
 *   - a switch change must name the admin making it, and is audited;
 *   - provenance is NULL on a draft and complete on a signature, never
 *     half-written;
 *   - provenance is derived by the database at signing time, so the writing
 *     code cannot claim anything about it;
 *   - an override-assisted signature can never be recorded as clinical output;
 *   - a signature with no honest role to record is refused rather than guessed.
 *
 * The scaffold is the one the 0066 suite uses, because 0070 extends the table
 * 0066 creates. Three further stand-ins are added here for what 0069 reads and
 * 0066's scaffold has no reason to provide: the Supabase roles, audit_logs,
 * and the thin assignment wrapper whose grants 0069 also narrows.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const M0066 = join(HERE, '../../../../supabase/migrations/0066_case_taking_persistence.sql')
const M0069 = join(HERE, '../../../../supabase/migrations/0069_testing_designation_and_disclosure.sql')
const M0070 = join(HERE, '../../../../supabase/migrations/0070_signature_provenance.sql')
const SCAFFOLD = join(HERE, '../intakeV2/__fixtures__/caseTakingScaffold.sql')

const CLIENT = '11111111-1111-1111-1111-111111111111'
const ADMIN = '99999999-9999-9999-9999-999999999999'
const LEAD = '22222222-2222-2222-2222-222222222222'
const OUTSIDER = '55555555-5555-5555-5555-555555555555'
const CASE_TEST = '66666666-6666-6666-6666-666666666666'
const CASE_REAL = '77777777-7777-7777-7777-777777777777'

let db: PGlite

/** Strip comment lines, as the 0066 suite does: a migration's prose
 *  legitimately names things it does not do, and scope assertions must read
 *  the executable SQL rather than the file's explanation of itself. */
function sql(path: string): string {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n')
    .replace(/\s--[^\n]*/g, '')
}

const rows = async <T = Record<string, unknown>>(q: string): Promise<T[]> =>
  (await db.query<T>(q)).rows

const one = async <T = Record<string, unknown>>(q: string): Promise<T> => {
  const r = await rows<T>(q)
  if (r.length !== 1) throw new Error(`expected exactly one row, got ${r.length}`)
  return r[0]
}

/** Returns the refusal message, or throws if the statement succeeded. A test
 *  that merely expects "an error" would pass on a typo, so every caller
 *  asserts on the message. */
async function refusal(q: string): Promise<string> {
  try {
    await db.exec(q)
  } catch (e) {
    return String((e as Error).message ?? e)
  }
  throw new Error('expected the database to refuse this statement, but it succeeded')
}

/** What 0069 reads and the 0066 scaffold has no reason to provide. */
const PREREQS = `
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
end $$;

-- The live shape, from the long-standing add_is_test_data_flag migration. The
-- 0066 scaffold has no reason to carry it; 0069's profile designation does.
alter table public.profiles
  add column if not exists is_test_data boolean not null default false;

create table if not exists public.audit_logs (
  id            uuid primary key default gen_random_uuid(),
  actor_id      uuid,
  actor_role    text,
  action        text not null,
  resource_type text not null,
  resource_id   uuid,
  metadata      jsonb,
  ip_address    text,
  created_at    timestamptz default now()
);

create or replace function public.practitioner_assignment_eligibility(p_practitioner_id uuid)
returns table (eligible boolean) language sql stable as $fn$
  select e.eligible from public.practitioner_eligibility(p_practitioner_id, 'lead') e;
$fn$;
`

/** A draft consultation on the given case, started by the given practitioner. */
const insertDraft = (id: string, caseId: string, by: string, seq = 1) => `
  insert into case_taking_sessions (id, case_id, consultation_seq, consultation_kind, started_by, state)
  values ('${id}', '${caseId}', ${seq}, 'initial', '${by}', 'in_progress');`

const sign = (id: string, by: string) => `
  update case_taking_sessions
     set state = 'signed_off', signed_off_by = '${by}', signed_off_at = now()
   where id = '${id}';`

beforeAll(async () => {
  db = new PGlite()
  await db.exec(readFileSync(SCAFFOLD, 'utf8'))
  await db.exec(PREREQS)
  await db.exec(sql(M0066))
  await db.exec(sql(M0069))
  await db.exec(sql(M0070))

  // auth.uid() NULL throughout: that is the service-role shape, under which
  // enforce_case_taking_authority() returns early. Signatures created below
  // therefore bypass the database's authority check exactly as the live
  // service-role path does — and provenance is still recorded truthfully,
  // which is the whole point of recording it in the database.
  await db.exec(`select set_config('test.auth_uid', '', false);`)

  await db.exec(`
    insert into profiles (id, role) values ('${CLIENT}', 'user'), ('${ADMIN}', 'admin');
    insert into practitioners (id) values ('${LEAD}'), ('${OUTSIDER}');
    insert into client_cases (id, client_id, status, is_test_data)
      values ('${CASE_TEST}', '${CLIENT}', 'active', true),
             ('${CASE_REAL}', '${CLIENT}', 'active', false);
    insert into case_team_roles (case_id, practitioner_id, team_role, assigned_by)
      values ('${CASE_TEST}', '${LEAD}', 'lead', '${ADMIN}'),
             ('${CASE_REAL}', '${LEAD}', 'lead', '${ADMIN}');
  `)
})

afterAll(async () => { await db?.close() })

beforeEach(async () => {
  // Order matters. The switch is reset FIRST, because resetting it fires the
  // audit trigger, and that row must not be counted among a test's own
  // observations.
  //
  // TRUNCATE, not DELETE: freeze_signed_case_taking() refuses to delete a
  // signed session, which is the guarantee under test. TRUNCATE does not fire
  // row-level triggers, so the fixture can be cleared without weakening the
  // freeze to do it. CASCADE reaches case_taking_answers and the
  // case_contributions rows 0066 linked to sessions.
  await db.exec(`
    update testing_mode set enabled = false, new_cases_default_test = true, changed_by = '${ADMIN}';
    truncate case_taking_sessions cascade;
    delete from audit_logs;
  `)
})

describe('0069 — the master testing switch', () => {
  it('exists, is OFF, and defaults new cases to test', async () => {
    const r = await one<{ enabled: boolean; new_cases_default_test: boolean }>(
      'select enabled, new_cases_default_test from testing_mode')
    expect(r.enabled).toBe(false)
    expect(r.new_cases_default_test).toBe(true)
  })

  it('is a singleton — a second row is refused', async () => {
    const msg = await refusal(`insert into testing_mode (id, enabled) values (false, true);`)
    // Either the primary key or the singleton CHECK stops it; both are the
    // same guarantee, and a settings table that can hold two rows is one that
    // will eventually disagree with itself.
    expect(msg).toMatch(/testing_mode_singleton|duplicate key|primary key/i)
  })

  it('refuses a change that does not name the admin making it', async () => {
    const msg = await refusal(`update testing_mode set enabled = true, changed_by = null;`)
    expect(msg).toMatch(/must name the admin/i)
  })

  it('records who changed it and when, and audits the change with an outcome', async () => {
    await db.exec(`update testing_mode set enabled = true, changed_by = '${ADMIN}';`)

    const t = await one<{ enabled: boolean; changed_by: string; changed_at: string }>(
      'select enabled, changed_by, changed_at from testing_mode')
    expect(t.enabled).toBe(true)
    expect(t.changed_by).toBe(ADMIN)
    expect(t.changed_at).toBeTruthy()

    const a = await one<{ actor_id: string; action: string; metadata: Record<string, unknown> }>(
      `select actor_id, action, metadata from audit_logs where action = 'testing_mode.changed'`)
    // The actor comes from changed_by, NOT from auth.uid() — which is NULL
    // here. WP0 found five audit rows with a NULL actor for exactly that
    // reason, and this is the event where that would matter most.
    expect(a.actor_id).toBe(ADMIN)
    expect(a.metadata.outcome).toBe('applied')
    expect(a.metadata.enabled_before).toBe(false)
    expect(a.metadata.enabled_after).toBe(true)
  })
})

describe('0069 — explicit case designation', () => {
  it('has no column default, so the setting is the single authoritative source', async () => {
    const r = await one<{ column_default: string | null; is_nullable: string }>(`
      select column_default, is_nullable from information_schema.columns
       where table_schema = 'public' and table_name = 'client_cases'
         and column_name = 'is_test_data'`)
    expect(r.column_default).toBeNull()
    expect(r.is_nullable).toBe('NO')
  })

  it('applies the default by trigger, so every creation path is covered', async () => {
    // No is_test_data in the column list — the shape of both live creation
    // paths, including complete_intake_with_case().
    await db.exec(`insert into client_cases (id, client_id) values
      ('88888888-0000-4000-8000-000000000001', '${CLIENT}');`)
    const r = await one<{ is_test_data: boolean }>(
      `select is_test_data from client_cases where id = '88888888-0000-4000-8000-000000000001'`)
    expect(r.is_test_data).toBe(true)
  })

  it('follows the setting when it changes, without a migration', async () => {
    await db.exec(`update testing_mode set new_cases_default_test = false, changed_by = '${ADMIN}';`)
    await db.exec(`insert into client_cases (id, client_id) values
      ('88888888-0000-4000-8000-000000000002', '${CLIENT}');`)
    const r = await one<{ is_test_data: boolean }>(
      `select is_test_data from client_cases where id = '88888888-0000-4000-8000-000000000002'`)
    expect(r.is_test_data).toBe(false)
  })

  it('lets an explicit designation win over the default', async () => {
    await db.exec(`insert into client_cases (id, client_id, is_test_data) values
      ('88888888-0000-4000-8000-000000000003', '${CLIENT}', false);`)
    const r = await one<{ is_test_data: boolean }>(
      `select is_test_data from client_cases where id = '88888888-0000-4000-8000-000000000003'`)
    expect(r.is_test_data).toBe(false)
  })
})

describe('0070 — provenance on a draft', () => {
  it('leaves all four columns NULL while the session is unsigned', async () => {
    await db.exec(insertDraft('aaaaaaaa-0000-4000-8000-000000000001', CASE_TEST, LEAD))
    const r = await one(`select override_active_at_signing, override_used_at_signing,
                                is_test_output, effective_role
                           from case_taking_sessions`)
    expect(r.override_active_at_signing).toBeNull()
    expect(r.override_used_at_signing).toBeNull()
    expect(r.is_test_output).toBeNull()
    expect(r.effective_role).toBeNull()
  })

  it('refuses provenance on an unsigned session', async () => {
    await db.exec(insertDraft('aaaaaaaa-0000-4000-8000-000000000002', CASE_TEST, LEAD))
    const msg = await refusal(`update case_taking_sessions set is_test_output = false
                                where id = 'aaaaaaaa-0000-4000-8000-000000000002';`)
    expect(msg).toMatch(/case_taking_provenance_complete/i)
  })
})

describe('0070 — provenance at signing', () => {
  it('records all four truthfully, derived by the database', async () => {
    const id = 'bbbbbbbb-0000-4000-8000-000000000001'
    await db.exec(insertDraft(id, CASE_TEST, LEAD))
    // The signing UPDATE mentions only what the live path mentions: state,
    // signed_off_by, signed_off_at. It says nothing about provenance.
    await db.exec(sign(id, LEAD))

    const r = await one(`select override_active_at_signing, override_used_at_signing,
                                is_test_output, effective_role
                           from case_taking_sessions where id = '${id}'`)
    expect(r.override_active_at_signing).toBe(false)   // switch is OFF
    expect(r.override_used_at_signing).toBe(false)     // no override exists in WP1
    expect(r.is_test_output).toBe(true)                // the case is designated test
    expect(r.effective_role).toBe('lead')              // the role actually held
  })

  it('records the switch state as it was at the instant of signing', async () => {
    const id = 'bbbbbbbb-0000-4000-8000-000000000002'
    await db.exec(`update testing_mode set enabled = true, changed_by = '${ADMIN}';`)
    await db.exec(insertDraft(id, CASE_TEST, LEAD))
    await db.exec(sign(id, LEAD))
    const r = await one(`select override_active_at_signing, override_used_at_signing
                           from case_taking_sessions where id = '${id}'`)
    // Active but not used: the switch being on does not taint a signature by
    // a practitioner who did not need it. Conflating the two would.
    expect(r.override_active_at_signing).toBe(true)
    expect(r.override_used_at_signing).toBe(false)
  })

  it('marks output from an undesignated case as not test output', async () => {
    const id = 'bbbbbbbb-0000-4000-8000-000000000003'
    await db.exec(insertDraft(id, CASE_REAL, LEAD))
    await db.exec(sign(id, LEAD))
    const r = await one(`select is_test_output from case_taking_sessions where id = '${id}'`)
    expect(r.is_test_output).toBe(false)
  })

  it('refuses to invent a role when the signer holds none', async () => {
    const id = 'bbbbbbbb-0000-4000-8000-000000000004'
    await db.exec(insertDraft(id, CASE_TEST, OUTSIDER))
    const msg = await refusal(sign(id, OUTSIDER))
    expect(msg).toMatch(/no active case-team role/i)
    // And nothing was written: a refusal is not a partial signature.
    const r = await one<{ signed_off_at: string | null }>(
      `select signed_off_at from case_taking_sessions where id = '${id}'`)
    expect(r.signed_off_at).toBeNull()
  })

  it('refuses an already-signed row inserted directly with fabricated provenance', async () => {
    // The service-role path can insert whatever it likes today; WP2 closes
    // that. What it cannot do, from 0070 onward, is choose its own provenance.
    const msg = await refusal(`
      insert into case_taking_sessions
        (id, case_id, consultation_seq, consultation_kind, started_by, state,
         signed_off_by, signed_off_at, override_active_at_signing,
         override_used_at_signing, is_test_output, effective_role)
      values ('cccccccc-0000-4000-8000-000000000009', '${CASE_TEST}', 1, 'initial',
              '${OUTSIDER}', 'signed_off', '${OUTSIDER}', now(), false, false, false, 'lead');`)
    expect(msg).toMatch(/no active case-team role/i)
  })
})

describe('0070 — the invariants that cannot be argued with', () => {
  it('ignores provenance the caller tries to choose for itself', async () => {
    // The caller claims the signature was override-assisted, non-test output,
    // and taken under a role that does not exist. Every claim is replaced by
    // what the database can see for itself.
    const id = 'dddddddd-0000-4000-8000-000000000002'
    await db.exec(`
      insert into case_taking_sessions
        (id, case_id, consultation_seq, consultation_kind, started_by, state,
         signed_off_by, signed_off_at, override_active_at_signing,
         override_used_at_signing, is_test_output, effective_role)
      values ('${id}', '${CASE_TEST}', 2, 'initial',
              '${LEAD}', 'signed_off', '${LEAD}', now(), true, true, false, 'coach');`)

    const r = await one(`select override_active_at_signing, override_used_at_signing,
                                is_test_output, effective_role
                           from case_taking_sessions where id = '${id}'`)
    expect(r.override_active_at_signing).toBe(false)  // the switch is off, whatever was claimed
    expect(r.override_used_at_signing).toBe(false)    // no override exists to have been used
    expect(r.is_test_output).toBe(true)               // the case IS designated test
    expect(r.effective_role).toBe('lead')             // the role actually held, not 'coach'
  })

  it('carries the two backstop constraints, which the trigger means are never reached', async () => {
    // Worth stating plainly: because the trigger derives all four values on
    // every insert and update, these CHECKs are unreachable in practice. They
    // exist so that a future writer that bypassed the trigger — a bulk load, a
    // migration, a mistake — still could not store the forbidden combination.
    const names = (await rows<{ conname: string }>(`
      select conname from pg_constraint
       where conrelid = 'public.case_taking_sessions'::regclass and contype = 'c'`))
      .map((r) => r.conname)
    expect(names).toContain('case_taking_override_implies_test')
    expect(names).toContain('case_taking_override_used_requires_active')
    expect(names).toContain('case_taking_effective_role_valid')
    expect(names).toContain('case_taking_provenance_complete')
  })

  it('keeps recorded provenance immutable, because the signed row is frozen', async () => {
    const id = 'ffffffff-0000-4000-8000-000000000001'
    await db.exec(insertDraft(id, CASE_TEST, LEAD))
    await db.exec(sign(id, LEAD))
    const msg = await refusal(
      `update case_taking_sessions set is_test_output = false where id = '${id}';`)
    expect(msg).toMatch(/signed and cannot be changed/i)
    const r = await one(`select is_test_output from case_taking_sessions where id = '${id}'`)
    expect(r.is_test_output).toBe(true)
  })

  it('leaves the existing signed-state and revision guarantees intact', async () => {
    const id = 'ffffffff-0000-4000-8000-000000000002'
    await db.exec(insertDraft(id, CASE_TEST, LEAD))
    const before = await one<{ revision: number }>(
      `select revision from case_taking_sessions where id = '${id}'`)
    await db.exec(sign(id, LEAD))
    const after = await one<{ revision: number; state: string }>(
      `select revision, state from case_taking_sessions where id = '${id}'`)
    // The revision token still advances on the signing UPDATE, which is what
    // signOffCaseTakingSession()'s compare-and-set depends on.
    expect(after.revision).toBe(before.revision + 1)
    expect(after.state).toBe('signed_off')
  })
})
