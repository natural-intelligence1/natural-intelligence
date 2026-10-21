/*
 * Database behaviour of migration 0062, proven against a real Postgres.
 *
 * Runs PGlite (Postgres compiled to WASM) in-process: no Docker, no network,
 * no Supabase project, and Production is never touched. The migration file is
 * read from disk and executed, so these tests fail if its SQL changes
 * behaviour — they are not a paraphrase of it.
 *
 * RLS IS UNDER TEST HERE. Every policy assertion runs after `set role
 * authenticated`, a role that owns nothing, so the policies actually apply.
 * (The earlier 0061 suite could not do this and said so; it is worth doing
 * here because the whole point of 0062 is that a client cannot forge.)
 *
 * What is stubbed: auth.uid() and auth.role() over GUCs, so a test can be a
 * particular signed-in person or the service role. Everything else — the
 * policy, both triggers, every CHECK — is the real thing.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const MIGRATION = join(HERE, '../../../../supabase/migrations/0062_case_events_client_authorship.sql')
const SCAFFOLD = join(HERE, '__fixtures__/caseEventsScaffold.sql')

const CLIENT_A = '11111111-1111-1111-1111-111111111111'
const CLIENT_B = '22222222-2222-2222-2222-222222222222'
const ADMIN = '33333333-3333-3333-3333-333333333333'
const PRAC = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const OUTSIDER = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const CASE_A = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
const CASE_B = 'dddddddd-dddd-dddd-dddd-dddddddddddd'

let db: PGlite

/** Act as a signed-in person under RLS. */
async function become(uid: string | null, role = 'authenticated') {
  await db.exec(`reset role;
                 set test.auth_uid = '${uid ?? ''}';
                 set test.auth_role = '${role}';
                 set role authenticated;`)
}
/** Act as the owner, bypassing RLS — for arranging fixtures only. */
const asOwner = () => db.exec('reset role;')

const rows = async <T = Record<string, unknown>>(sql: string): Promise<T[]> =>
  (await db.query<T>(sql)).rows

/** Run a statement that must be refused, and return the refusal message. */
async function refusal(sql: string): Promise<string> {
  try { await db.exec(sql) } catch (e) { return String((e as Error).message ?? e) }
  throw new Error('expected the database to refuse this statement, but it succeeded')
}

const clientInsert = (opts: {
  caseId?: string; actor?: string | null; capacity?: string | null; type?: string
  occurredAt?: string | null; statement?: string
} = {}) => `
  insert into case_events (case_id, event_type, event_payload, actor_user_id, actor_capacity, occurred_at)
  values (
    '${opts.caseId ?? CASE_A}',
    '${opts.type ?? 'follow_up_answer'}',
    jsonb_build_object('statement', '${opts.statement ?? 'Slept through on five of seven nights.'}'),
    ${opts.actor === null ? 'null' : `'${opts.actor ?? CLIENT_A}'`},
    ${opts.capacity === null ? 'null' : `'${opts.capacity ?? 'client'}'`},
    ${opts.occurredAt === null ? 'null' : `'${opts.occurredAt ?? '2026-10-02T07:15:00Z'}'`}
  );`

beforeAll(async () => {
  db = new PGlite()
  await db.exec(readFileSync(SCAFFOLD, 'utf8'))
  await db.exec(readFileSync(MIGRATION, 'utf8'))
  await db.exec(`
    insert into profiles (id, role) values
      ('${CLIENT_A}','member'), ('${CLIENT_B}','member'),
      ('${ADMIN}','admin'), ('${PRAC}','member'), ('${OUTSIDER}','member');
    insert into practitioners (id) values ('${PRAC}');
    insert into client_cases (id, client_id) values ('${CASE_A}','${CLIENT_A}'), ('${CASE_B}','${CLIENT_B}');
    insert into case_practitioner_work (case_id, practitioner_id, status) values ('${CASE_A}','${PRAC}','assigned');
  `)
})

afterAll(async () => { await db?.close() })

// Clearing the table between tests has to disable the append-only trigger,
// because the trigger refuses even the owner — which is the whole point of it.
// This is the explicit, scoped escape the migration describes for reviewed
// maintenance, used here by the harness and nowhere in application code.
beforeEach(async () => {
  await asOwner()
  await db.exec(`alter table case_events disable trigger trg_block_case_event_rewrite;
                 delete from case_events;
                 alter table case_events enable trigger trg_block_case_event_rewrite;`)
})

// ── A client writing to their own case ──────────────────────────────────────

describe('a client records an update on their own case', () => {
  it('is allowed, attributed, and dated when it happened', async () => {
    await become(CLIENT_A)
    await db.exec(clientInsert())

    const [e] = await rows(`select event_type, actor_user_id, actor_capacity,
                                   occurred_at, created_at, event_payload->>'statement' as statement
                              from case_events`)
    expect(e).toMatchObject({
      event_type: 'follow_up_answer',
      actor_user_id: CLIENT_A,
      actor_capacity: 'client',
      statement: 'Slept through on five of seven nights.',
    })
    // occurred_at is what the client stated; created_at is NI's receipt.
    expect(new Date(e.occurred_at as string).toISOString()).toBe('2026-10-02T07:15:00.000Z')
    expect(new Date(e.created_at as string).getTime())
      .toBeGreaterThan(new Date(e.occurred_at as string).getTime())
  })

  it('cannot backdate NI\'s record of receipt', async () => {
    // Otherwise a client could place their own report before a review that
    // had already happened. occurred_at is theirs to state; created_at is not.
    await become(CLIENT_A)
    await db.exec(`
      insert into case_events (case_id, event_type, event_payload, actor_user_id,
                               actor_capacity, occurred_at, created_at)
      values ('${CASE_A}','follow_up_answer', jsonb_build_object('statement','Backdated.'),
              '${CLIENT_A}','client','2026-10-02T07:15:00Z','2020-01-01T00:00:00Z');`)

    const [e] = await rows<{ created_at: string }>('select created_at from case_events')
    expect(new Date(e.created_at).getFullYear()).toBeGreaterThan(2020)
  })

  it('must say when it happened', async () => {
    await become(CLIENT_A)
    expect(await refusal(clientInsert({ occurredAt: null }))).toMatch(/row-level security/i)
  })

  it('cannot claim something happened in the future', async () => {
    await become(CLIENT_A)
    expect(await refusal(clientInsert({ occurredAt: '2099-01-01T00:00:00Z' })))
      .toMatch(/row-level security/i)
  })
})

// ── Everything a client must not be able to do ──────────────────────────────

describe('a client cannot forge', () => {
  it('an update on another client\'s case', async () => {
    await become(CLIENT_A)
    expect(await refusal(clientInsert({ caseId: CASE_B }))).toMatch(/row-level security/i)
  })

  it('a practitioner note', async () => {
    await become(CLIENT_A)
    expect(await refusal(clientInsert({ type: 'practitioner_note' }))).toMatch(/row-level security/i)
  })

  it('a practitioner decision', async () => {
    await become(CLIENT_A)
    expect(await refusal(clientInsert({ type: 'practitioner_decision' }))).toMatch(/row-level security/i)
  })

  it('a protocol update', async () => {
    await become(CLIENT_A)
    expect(await refusal(clientInsert({ type: 'protocol_update' }))).toMatch(/row-level security/i)
  })

  it('a system event', async () => {
    await become(CLIENT_A)
    expect(await refusal(clientInsert({ capacity: 'system', actor: null })))
      .toMatch(/row-level security/i)
  })

  it('another actor\'s identity', async () => {
    // The forgery the policy exists for. The id is checked against the JWT,
    // never against what the insert claims.
    await become(CLIENT_A)
    expect(await refusal(clientInsert({ actor: CLIENT_B }))).toMatch(/row-level security/i)
    expect(await refusal(clientInsert({ actor: PRAC }))).toMatch(/row-level security/i)
  })

  it('an unattributed client event', async () => {
    // Refused by the insert trigger rather than the policy — a BEFORE INSERT
    // trigger runs before the RLS check, so it answers first. Either way the
    // row does not exist.
    await become(CLIENT_A)
    expect(await refusal(clientInsert({ actor: null }))).toMatch(/must name its actor/i)
  })

  it('a client event claiming practitioner capacity', async () => {
    await become(CLIENT_A)
    expect(await refusal(clientInsert({ capacity: 'practitioner' }))).toMatch(/row-level security/i)
  })

  it('anything at all while signed out', async () => {
    await become(null)
    expect(await refusal(clientInsert())).toMatch(/row-level security/i)
  })

  it('an update on a case that is not theirs even when signed in as nobody\'s client', async () => {
    await become(OUTSIDER)
    expect(await refusal(clientInsert({ actor: OUTSIDER }))).toMatch(/row-level security/i)
  })
})

// ── Append-only ─────────────────────────────────────────────────────────────

describe('history is append-only', () => {
  const seed = async () => {
    await become(CLIENT_A)
    await db.exec(clientInsert())
    return (await rows<{ id: string }>('select id from case_events'))[0].id
  }

  it('a client cannot edit their own event', async () => {
    // There is no client UPDATE policy, so RLS matches no row and the update
    // is a silent no-op rather than an error — the append-only trigger is
    // never even reached. What matters is that the statement is unchanged,
    // so that is what this asserts.
    const id = await seed()
    await db.exec(`update case_events set event_payload = jsonb_build_object('statement','Rewritten.')
                     where id = '${id}';`)

    await asOwner()
    const [e] = await rows<{ statement: string }>(
      `select event_payload->>'statement' as statement from case_events where id = '${id}'`)
    expect(e.statement).toBe('Slept through on five of seven nights.')
  })

  it('a client cannot delete their own event', async () => {
    const id = await seed()
    // No client DELETE policy, so RLS matches no row and the delete is a
    // silent no-op rather than an error. The row must still be there.
    await db.exec(`delete from case_events where id = '${id}';`)
    await asOwner()
    expect((await rows('select id from case_events')).length).toBe(1)
  })

  it('not even the service role can rewrite an event', async () => {
    // The trigger fires for every role. No ambient bypass.
    const id = await seed()
    await become(ADMIN, 'service_role')
    expect(await refusal(`update case_events set event_payload = jsonb_build_object('statement','Tidied.')
                            where id = '${id}';`))
      .toMatch(/append-only/i)
  })

  it('not even the service role can delete an event while its case exists', async () => {
    const id = await seed()
    await become(ADMIN, 'service_role')
    expect(await refusal(`delete from case_events where id = '${id}';`))
      .toMatch(/append-only|cannot be deleted while its case exists/i)
  })

  it('not even the table owner can rewrite an event', async () => {
    const id = await seed()
    await asOwner()
    expect(await refusal(`update case_events set case_id = '${CASE_B}' where id = '${id}';`))
      .toMatch(/append-only/i)
  })

  it('a correction is a new event, and the original survives', async () => {
    await seed()
    await become(CLIENT_A)
    await db.exec(clientInsert({ statement: 'Correction: four of seven nights, not five.' }))

    await asOwner()
    const all = await rows<{ statement: string }>(
      `select event_payload->>'statement' as statement from case_events order by created_at`)
    expect(all).toHaveLength(2)
    expect(all[0].statement).toMatch(/five of seven/)
    expect(all[1].statement).toMatch(/Correction/)
  })

  it('erasing the whole case still removes its events', async () => {
    // A right-to-erasure request must not be blocked by the append-only
    // guard. The cascade is what distinguishes erasure from tidying history.
    await seed()
    await asOwner()
    await db.exec(`delete from client_cases where id = '${CASE_A}';`)
    expect((await rows('select id from case_events')).length).toBe(0)

    await db.exec(`insert into client_cases (id, client_id) values ('${CASE_A}','${CLIENT_A}');
                   insert into case_practitioner_work (case_id, practitioner_id, status)
                     values ('${CASE_A}','${PRAC}','assigned');`)
  })
})

// ── Nothing that already worked stops working ───────────────────────────────

describe('existing writers and readers are unaffected', () => {
  it('the service role still creates practitioner and system events', async () => {
    await become(ADMIN, 'service_role')
    await db.exec(`
      insert into case_events (case_id, event_type, event_payload)
      values ('${CASE_A}','practitioner_note', jsonb_build_object('note','Reviewed intake.'));
      insert into case_events (case_id, event_type, event_payload, actor_capacity)
      values ('${CASE_A}','protocol_update', jsonb_build_object('statement','v2 signed.'),'system');`)
    await asOwner()
    expect((await rows('select id from case_events')).length).toBe(2)
  })

  it('an event with no actor recorded is still valid, as the existing rows are', async () => {
    // The additive promise. Five rows predate 0062 with no actor at all.
    await asOwner()
    await db.exec(`insert into case_events (case_id, event_type, event_payload)
                   values ('${CASE_A}','intake_answer', jsonb_build_object('question_id','q-1'));`)
    const [e] = await rows('select actor_user_id, actor_capacity, occurred_at from case_events')
    expect(e).toEqual({ actor_user_id: null, actor_capacity: null, occurred_at: null })
  })

  it('a client still reads their own case, and only their own', async () => {
    await asOwner()
    await db.exec(`
      insert into case_events (case_id, event_type, event_payload)
        values ('${CASE_A}','practitioner_note', jsonb_build_object('note','A.'));
      insert into case_events (case_id, event_type, event_payload)
        values ('${CASE_B}','practitioner_note', jsonb_build_object('note','B.'));`)

    await become(CLIENT_A)
    const seen = await rows<{ case_id: string }>('select case_id from case_events')
    expect(seen.map((r) => r.case_id)).toEqual([CASE_A])
  })

  it('a practitioner with work on the case still reads it', async () => {
    await asOwner()
    await db.exec(`insert into case_events (case_id, event_type, event_payload)
                   values ('${CASE_A}','practitioner_note', jsonb_build_object('note','A.'));`)
    await become(PRAC)
    expect((await rows('select id from case_events')).length).toBe(1)
  })

  it('a practitioner with no work on the case reads nothing', async () => {
    await asOwner()
    await db.exec(`insert into case_events (case_id, event_type, event_payload)
                   values ('${CASE_B}','practitioner_note', jsonb_build_object('note','B.'));`)
    await become(PRAC)
    expect((await rows('select id from case_events')).length).toBe(0)
  })
})

// ── The attribution constraints themselves ──────────────────────────────────

describe('actor attribution is coherent by constraint', () => {
  it('rejects a capacity outside the vocabulary', async () => {
    await asOwner()
    expect(await refusal(`insert into case_events (case_id, event_type, event_payload, actor_capacity)
                          values ('${CASE_A}','intake_answer','{}'::jsonb,'superuser');`))
      .toMatch(/actor_capacity_check/i)
  })

  it('requires a human for a human capacity', async () => {
    await asOwner()
    for (const cap of ['client', 'practitioner', 'admin_support']) {
      expect(await refusal(`insert into case_events (case_id, event_type, event_payload, actor_capacity)
                            values ('${CASE_A}','intake_answer','{}'::jsonb,'${cap}');`), cap)
        .toMatch(/must name its actor/i)
    }
  })

  it('forbids a human actor on a system event', async () => {
    await asOwner()
    expect(await refusal(`insert into case_events (case_id, event_type, event_payload, actor_capacity, actor_user_id)
                          values ('${CASE_A}','protocol_update','{}'::jsonb,'system','${ADMIN}');`))
      .toMatch(/system_has_no_actor/i)
  })

  it('keeps a case\'s history when the person is erased', async () => {
    // ON DELETE SET NULL, not CASCADE. Erasing a person must not silently
    // delete the clinical record of what happened on a case.
    await asOwner()
    await db.exec(`
      insert into profiles (id, role) values ('${OUTSIDER}','member') on conflict do nothing;
      insert into case_events (case_id, event_type, event_payload, actor_capacity, actor_user_id)
        values ('${CASE_A}','practitioner_note', jsonb_build_object('note','Seen.'),'practitioner','${PRAC}');
      delete from practitioners where id = '${PRAC}';
      delete from profiles where id = '${PRAC}';`)

    const [e] = await rows('select actor_user_id, event_payload->>\'note\' as note from case_events')
    expect(e).toEqual({ actor_user_id: null, note: 'Seen.' })

    // Put the practitioner back for any later test.
    await db.exec(`insert into profiles (id, role) values ('${PRAC}','member');
                   insert into practitioners (id) values ('${PRAC}');
                   insert into case_practitioner_work (case_id, practitioner_id, status)
                     values ('${CASE_A}','${PRAC}','assigned');`)
  })
})
