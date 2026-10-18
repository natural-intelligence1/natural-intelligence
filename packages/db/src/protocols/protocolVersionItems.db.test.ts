/*
 * Database behaviour of migration 0061, proven against a real Postgres.
 *
 * Runs PGlite (Postgres compiled to WASM) in-process: no Docker, no network,
 * no Supabase project, and Production is never touched. The migration file
 * itself is read from disk and executed, so these tests fail if the SQL
 * changes behaviour — they are not a paraphrase of it.
 *
 * What is real here: every trigger and constraint under test, verbatim.
 * What is stubbed: auth.uid() and practitioner_assignment_eligibility(),
 * over GUCs, so a test can act as a given practitioner or as a context with
 * no JWT at all. The scaffold reproduces only the live structures these
 * triggers actually read, including 0059's three triggers copied from the
 * production catalogue.
 *
 * Not covered here, deliberately: RLS. PGlite has no Supabase auth roles and
 * the table owner bypasses RLS, so policy behaviour needs the real project.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const MIGRATION = join(HERE, '../../../../supabase/migrations/0061_protocol_version_items.sql')
const SCAFFOLD = join(HERE, '__fixtures__/liveSchemaScaffold.sql')

const MEMBER_A = '11111111-1111-1111-1111-111111111111'
const MEMBER_B = '22222222-2222-2222-2222-222222222222'
const ADMIN = '33333333-3333-3333-3333-333333333333'
const LEAD = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const STUDENT = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const CASE_A = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
const CASE_B = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
const TEMPLATE = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
const TPL_ITEM = 'f1111111-1111-1111-1111-111111111111'
const PROTO_A = '0a000000-0000-0000-0000-00000000000a'
const PROTO_B = '0b000000-0000-0000-0000-00000000000b'

let db: PGlite
const become = (uid: string | null) => db.exec(`set test.auth_uid = '${uid ?? ''}';`)
const one = async <T = Record<string, unknown>>(sql: string): Promise<T> =>
  (await db.query<T>(sql)).rows[0]
/** Run a statement that must be refused, and return the refusal message. */
async function refusal(sql: string): Promise<string> {
  try { await db.exec(sql) } catch (e) { return String((e as Error).message ?? e) }
  throw new Error('expected the database to refuse this statement, but it succeeded')
}

beforeAll(async () => {
  db = new PGlite()
  await db.exec(readFileSync(SCAFFOLD, 'utf8'))
  await db.exec('create role authenticated;')
  await db.exec(readFileSync(MIGRATION, 'utf8'))
  await db.exec(`
    insert into profiles (id, role) values ('${MEMBER_A}','member'),('${MEMBER_B}','member'),('${ADMIN}','admin');
    insert into practitioners (id, category) values ('${LEAD}','regulated_clinician'),('${STUDENT}','unregistered');
    insert into client_cases (id) values ('${CASE_A}'),('${CASE_B}');
    insert into case_team_roles (case_id, practitioner_id, team_role) values
      ('${CASE_A}','${LEAD}','lead'), ('${CASE_A}','${STUDENT}','student'), ('${CASE_B}','${LEAD}','lead');
    insert into protocol_templates (id, name) values ('${TEMPLATE}','Gut Reset');
    insert into protocol_items (id, template_id, name, item_type, dose, timing, duration_weeks, notes, display_order) values
      ('${TPL_ITEM}','${TEMPLATE}','L-glutamine','supplement','5g','morning',8,'In water, empty stomach.',0),
      ('f2222222-2222-2222-2222-222222222222','${TEMPLATE}','Remove alcohol','lifestyle',null,'daily',8,'For the duration.',1);
    insert into member_protocols (id, member_id, case_id, template_id, name) values
      ('${PROTO_A}','${MEMBER_A}','${CASE_A}','${TEMPLATE}','Client A Protocol'),
      ('${PROTO_B}','${MEMBER_B}','${CASE_B}','${TEMPLATE}','Client B Protocol');
    insert into protocol_version_items
      (protocol_id, name, item_type, dose, timing, duration_weeks, instructions, display_order, source_template_item_id, drafted_source)
    select p.id, t.name, t.item_type, t.dose, t.timing, t.duration_weeks, t.notes, t.display_order, t.id, 'template'
      from member_protocols p cross join protocol_items t where p.id in ('${PROTO_A}','${PROTO_B}');
  `)
})

afterAll(async () => { await db?.close() })

describe('a draft belongs to one client, not to a shared template', () => {
  it('the practitioner can edit every clinically substantive field', async () => {
    await db.exec(`update protocol_version_items
                      set dose='10g', timing='morning and night', duration_weeks=12,
                          instructions='Two scoops, split across the day.',
                          rationale='Higher load for barrier repair.',
                          display_order=5, last_edited_by='${ADMIN}'
                    where protocol_id='${PROTO_A}' and name='L-glutamine';`)
    const i = await one(`select dose, timing, duration_weeks, instructions, rationale, display_order, last_edited_by
                           from protocol_version_items where protocol_id='${PROTO_A}' and name='L-glutamine'`)
    expect(i).toMatchObject({
      dose: '10g', timing: 'morning and night', duration_weeks: 12,
      instructions: 'Two scoops, split across the day.',
      rationale: 'Higher load for barrier repair.', display_order: 5, last_edited_by: ADMIN,
    })
  })

  it('removing an item from the plan is recorded, not erased', async () => {
    await db.exec(`update protocol_version_items set is_active=false
                    where protocol_id='${PROTO_A}' and name='Remove alcohol';`)
    const r = await one<{ n: number }>(`select count(*)::int as n from protocol_version_items
                                         where protocol_id='${PROTO_A}' and is_active=false`)
    expect(r.n).toBe(1)
  })

  it('the shared template is untouched by any of it', async () => {
    const t = await one(`select dose, timing, notes from protocol_items where id='${TPL_ITEM}'`)
    expect(t).toMatchObject({ dose: '5g', timing: 'morning', notes: 'In water, empty stomach.' })
  })

  it('Client B is untouched by edits to Client A', async () => {
    const b = await one(`select dose, instructions, is_active from protocol_version_items
                          where protocol_id='${PROTO_B}' and name='L-glutamine'`)
    expect(b).toMatchObject({ dose: '5g', instructions: 'In water, empty stomach.', is_active: true })
  })
})

describe('only an authenticated, eligible Lead can sign', () => {
  it('a context with no JWT cannot manufacture a signature', async () => {
    await become(null)
    const msg = await refusal(`update member_protocols set signed_at=now(), signed_by='${LEAD}' where id='${PROTO_A}';`)
    expect(msg).toMatch(/authenticated practitioner session/i)
  })

  it('a student on the case cannot sign', async () => {
    await become(STUDENT)
    const msg = await refusal(`update member_protocols set signed_at=now(), signed_by='${STUDENT}' where id='${PROTO_A}';`)
    expect(msg).toMatch(/active Lead Responsible Practitioner/i)
  })

  it('nobody can sign in another practitioner\'s name', async () => {
    await become(STUDENT)
    const msg = await refusal(`update member_protocols set signed_at=now(), signed_by='${LEAD}' where id='${PROTO_A}';`)
    expect(msg).toMatch(/only be signed by the practitioner performing the action/i)
  })

  it('an ineligible Lead cannot sign', async () => {
    await become(LEAD)
    await db.exec(`set test.eligible = 'false';`)
    const msg = await refusal(`update member_protocols set signed_at=now(), signed_by='${LEAD}' where id='${PROTO_A}';`)
    expect(msg).toMatch(/assignment eligibility/i)
    await db.exec(`set test.eligible = 'true';`)
  })

  it('the eligible Lead can sign, and the signature is attributable', async () => {
    await become(LEAD)
    await db.exec(`update member_protocols set signed_at=now(), signed_by='${LEAD}' where id='${PROTO_A}';`)
    const p = await one<{ signed_by: string; signed: boolean; version: number }>(
      `select signed_by, signed_at is not null as signed, version from member_protocols where id='${PROTO_A}'`)
    expect(p).toMatchObject({ signed_by: LEAD, signed: true, version: 1 })
  })

  it('exceptional maintenance is possible only by naming it explicitly', async () => {
    await become(null)
    await db.exec(`set ni.maintenance_signature_override = 'on';`)
    await db.exec(`update member_protocols set signed_at=now(), signed_by='${LEAD}' where id='${PROTO_B}';`)
    await db.exec(`set ni.maintenance_signature_override = 'off';`)
    const b = await one<{ signed: boolean }>(`select signed_at is not null as signed from member_protocols where id='${PROTO_B}'`)
    expect(b.signed).toBe(true)
  })
})

describe('a signed version is frozen, in the database', () => {
  it('its items cannot be updated', async () => {
    expect(await refusal(`update protocol_version_items set dose='999g' where protocol_id='${PROTO_A}';`))
      .toMatch(/is signed .*cannot be changed/i)
  })

  it('its items cannot be deleted', async () => {
    expect(await refusal(`delete from protocol_version_items where protocol_id='${PROTO_A}';`))
      .toMatch(/is signed .*cannot be changed/i)
  })

  it('new items cannot be smuggled into it', async () => {
    expect(await refusal(`insert into protocol_version_items (protocol_id, name, item_type)
                          values ('${PROTO_A}','Smuggled','supplement');`))
      .toMatch(/is signed .*cannot be changed/i)
  })

  it('an item cannot be moved between versions', async () => {
    expect(await refusal(`update protocol_version_items set protocol_id='${PROTO_B}' where protocol_id='${PROTO_A}';`))
      .toMatch(/is signed|moved between Protocol versions/i)
  })

  it('the Protocol header is still immutable too (0059 holds)', async () => {
    expect(await refusal(`update member_protocols set name='Renamed' where id='${PROTO_A}';`))
      .toMatch(/signed .*cannot be edited in place/i)
  })
})

describe('template churn can never rewrite history', () => {
  it('editing the template does not alter signed content', async () => {
    await db.exec(`update protocol_items set dose='1g', notes='Rewritten later.' where id='${TPL_ITEM}';`)
    const i = await one(`select dose, instructions from protocol_version_items
                          where protocol_id='${PROTO_A}' and name='L-glutamine'`)
    expect(i).toMatchObject({ dose: '10g', instructions: 'Two scoops, split across the day.' })
  })

  it('deleting the template item nulls the provenance pointer and keeps the content', async () => {
    await db.exec(`delete from protocol_items where id='${TPL_ITEM}';`)
    const i = await one(`select dose, instructions, rationale, source_template_item_id
                           from protocol_version_items where protocol_id='${PROTO_A}' and name='L-glutamine'`)
    expect(i).toMatchObject({
      dose: '10g', instructions: 'Two scoops, split across the day.',
      rationale: 'Higher load for barrier repair.', source_template_item_id: null,
    })
  })

  it('and does not cascade away the signed items', async () => {
    const r = await one<{ n: number }>(`select count(*)::int as n from protocol_version_items where protocol_id='${PROTO_A}'`)
    expect(r.n).toBe(2)
  })

  it('a template still in use cannot be deleted at all (pre-existing FK)', async () => {
    expect(await refusal(`delete from protocol_templates where id='${TEMPLATE}';`)).toMatch(/foreign key|violates/i)
  })
})

describe('revision is the only way to change a signed Protocol', () => {
  let draftId: string

  it('creates the next version as an unsigned draft with items copied forward', async () => {
    const d = await one<{ id: string; signed_at: string | null }>(
      `insert into member_protocols (member_id, case_id, name, version, supersedes)
       values ('${MEMBER_A}','${CASE_A}','Client A Protocol',2,'${PROTO_A}')
       returning id, signed_at`)
    draftId = d.id
    expect(d.signed_at).toBeNull()

    await db.exec(`insert into protocol_version_items
        (protocol_id, name, item_type, dose, timing, duration_weeks, instructions, rationale, display_order, source_template_item_id, drafted_source, drafted_by, last_edited_by)
      select '${draftId}', name, item_type, dose, timing, duration_weeks, instructions, rationale, display_order, source_template_item_id, drafted_source, drafted_by, '${ADMIN}'
        from protocol_version_items where protocol_id='${PROTO_A}' and is_active;`)

    const n = await one<{ n: number }>(`select count(*)::int as n from protocol_version_items where protocol_id='${draftId}'`)
    expect(n.n).toBe(1) // the de-activated item is not carried forward
  })

  it('the new draft is freely editable again', async () => {
    await db.exec(`update protocol_version_items set dose='7g' where protocol_id='${draftId}';`)
    const i = await one(`select dose from protocol_version_items where protocol_id='${draftId}'`)
    expect(i).toMatchObject({ dose: '7g' })
  })

  it('the signed predecessor is completely unchanged', async () => {
    const p = await one(`select dose from protocol_version_items where protocol_id='${PROTO_A}' and name='L-glutamine'`)
    expect(p).toMatchObject({ dose: '10g' })
  })

  it('two drafts cannot both supersede the same signed version', async () => {
    expect(await refusal(`insert into member_protocols (member_id, case_id, name, version, supersedes)
                          values ('${MEMBER_A}','${CASE_A}','Rival',3,'${PROTO_A}');`))
      .toMatch(/unique|duplicate/i)
  })

  it('the draft carries no signature, so it has no clinical status', async () => {
    const d = await one(`select signed_at, signed_by from member_protocols where id='${draftId}'`)
    expect(d).toMatchObject({ signed_at: null, signed_by: null })
  })
})

describe('DailyPath lineage', () => {
  it('an action can name the exact signed item it derives from', async () => {
    const src = await one<{ id: string }>(
      `select id from protocol_version_items where protocol_id='${PROTO_A}' and name='L-glutamine'`)
    await db.exec(`insert into daily_adherence (member_id, protocol_id, item_name, item_type, dose, timing, protocol_version_item_id)
                   values ('${MEMBER_A}','${PROTO_A}','L-glutamine','supplement','10g','morning and night','${src.id}');`)
    const l = await one(`select i.name as item_name, i.dose, mp.version, mp.signed_by
                           from daily_adherence d
                           join protocol_version_items i on i.id = d.protocol_version_item_id
                           join member_protocols mp on mp.id = i.protocol_id
                          where d.member_id='${MEMBER_A}'`)
    expect(l).toMatchObject({ item_name: 'L-glutamine', dose: '10g', version: 1, signed_by: LEAD })
  })

  it('the existing uniqueness key and free-text item_name still behave as before', async () => {
    expect(await refusal(`insert into daily_adherence (member_id, protocol_id, item_name, log_date)
                          values ('${MEMBER_A}','${PROTO_A}','L-glutamine',current_date);`))
      .toMatch(/unique|duplicate/i)
  })
})
