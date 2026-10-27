/*
 * Database behaviour of migration 0063, proven against a real Postgres.
 *
 * PGlite in-process: no Docker, no network, no Supabase project, Production
 * untouched. The scaffold reproduces the PRE-0063 constraints, functions and
 * triggers from the live catalogue; the migration file is then read from disk
 * and executed against it. So these tests exercise the real migration, and
 * they fail if its SQL changes behaviour.
 *
 * The central claim under test: this is a RENAME, and every eligibility rule
 * behaves afterwards exactly as it behaved before.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const MIGRATION = join(HERE, '../../../../supabase/migrations/0063_practitioner_taxonomy_reconciliation.sql')
const SCAFFOLD = join(HERE, '__fixtures__/taxonomyScaffold.sql')

const CASE_A = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

let db: PGlite

const rows = async <T = Record<string, unknown>>(sql: string): Promise<T[]> =>
  (await db.query<T>(sql)).rows

async function refusal(sql: string): Promise<string> {
  try { await db.exec(sql) } catch (e) { return String((e as Error).message ?? e) }
  throw new Error('expected the database to refuse this statement, but it succeeded')
}

/** A practitioner who passes every gate except whatever the test varies. */
async function mkPractitioner(name: string, category: string | null, opts: {
  registered?: boolean
} = {}): Promise<string> {
  const reg = opts.registered !== false
  const r = await rows<{ id: string }>(`
    insert into practitioners
      (display_name, category, status, is_active, credentials_verification_status,
       indemnity_required, insurance_expiry, registration_number, registration_body,
       registration_status, dbs_status, scope_status)
    values ('${name}', ${category === null ? 'null' : `'${category}'`}, 'active', true, 'verified',
            true, current_date + 365,
            ${reg ? `'${name}-REG'` : 'null'}, ${reg ? `'${name} Body'` : 'null'},
            ${reg ? `'registered'` : 'null'}, 'not_required', 'approved')
    returning id;`)
  return r[0].id
}

const eligibility = async (id: string) =>
  (await rows<{ eligible: boolean; reasons: string[] }>(
    `select eligible, reasons from practitioner_assignment_eligibility('${id}')`))[0]

beforeAll(async () => {
  db = new PGlite()
  await db.exec(readFileSync(SCAFFOLD, 'utf8'))
})
afterAll(async () => { await db?.close() })

// ── Before the migration: the old taxonomy is what the database enforces ────

describe('pre-0063 baseline', () => {
  it('accepts the old values and rejects the new ones', async () => {
    await mkPractitioner('Old1', 'regulated_clinician')
    expect(await refusal(`insert into practitioners (display_name, category) values ('X','regulated_healthcare_professional');`))
      .toMatch(/practitioners_category_check/)
  })
})

// ── The migration ───────────────────────────────────────────────────────────

describe('after 0063', () => {
  beforeAll(async () => {
    // Seed one row of each OLD value plus an agreement, so the translation
    // step has something to translate — Production has none, other
    // environments may.
    await db.exec('delete from case_team_roles; delete from practitioners; delete from practitioner_agreements;')
    await mkPractitioner('Cat1', 'regulated_clinician')
    await mkPractitioner('Cat2', 'voluntary_registered')
    await mkPractitioner('Cat3', 'unregistered', { registered: false })
    await db.exec(`insert into practitioner_agreements (category, version) values
      ('regulated_clinician','v1'), ('voluntary_registered','v1'), ('unregistered','v1');`)
    await db.exec(`insert into client_cases (id) values ('${CASE_A}');`)

    await db.exec(readFileSync(MIGRATION, 'utf8'))
  })

  it('translated every existing value', async () => {
    const p = await rows<{ display_name: string; category: string }>(
      'select display_name, category from practitioners order by display_name')
    expect(p).toEqual([
      { display_name: 'Cat1', category: 'regulated_healthcare_professional' },
      { display_name: 'Cat2', category: 'accredited_practitioner' },
      { display_name: 'Cat3', category: 'ni_verified_practitioner' },
    ])
    const a = await rows<{ category: string }>('select category from practitioner_agreements order by category')
    expect(a.map((x) => x.category).sort()).toEqual([
      'accredited_practitioner', 'ni_verified_practitioner', 'regulated_healthcare_professional',
    ])
  })

  it('REJECTS every old value, on both tables', async () => {
    for (const old of ['regulated_clinician', 'voluntary_registered', 'unregistered']) {
      expect(await refusal(`insert into practitioners (display_name, category) values ('X','${old}');`), old)
        .toMatch(/practitioners_category_check/)
      expect(await refusal(`insert into practitioner_agreements (category, version) values ('${old}','v9');`), old)
        .toMatch(/practitioner_agreements_category_check/)
    }
  })

  it('accepts every new value, on both tables', async () => {
    for (const v of ['regulated_healthcare_professional', 'accredited_practitioner', 'ni_verified_practitioner']) {
      await db.exec(`insert into practitioners (display_name, category) values ('ok-${v}','${v}');`)
      await db.exec(`insert into practitioner_agreements (category, version) values ('${v}','v-${v}');`)
    }
    expect((await rows(`select 1 from practitioners where display_name like 'ok-%'`)).length).toBe(3)
    await db.exec(`delete from practitioners where display_name like 'ok-%';
                   delete from practitioner_agreements where version like 'v-%';`)
  })

  it('leaves no old taxonomy literal in any function body', async () => {
    // The assertion that catches a half-finished rename.
    const bad = await rows<{ proname: string }>(`
      select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and p.prosrc ~ '(regulated_clinician|voluntary_registered|''unregistered'')'`)
    expect(bad.map((b) => b.proname)).toEqual([])
  })
})

// ── Semantics preserved, category by category ───────────────────────────────

describe('eligibility semantics are unchanged', () => {
  beforeEach(async () => {
    await db.exec('delete from case_team_roles; delete from practitioners;')
  })

  it('Category 1 still requires a current registration', async () => {
    const withReg = await mkPractitioner('C1ok', 'regulated_healthcare_professional')
    expect((await eligibility(withReg)).eligible).toBe(true)

    const without = await mkPractitioner('C1no', 'regulated_healthcare_professional', { registered: false })
    const e = await eligibility(without)
    expect(e.eligible).toBe(false)
    expect(e.reasons).toContain('registration_not_current')
  })

  it('Category 2 still requires a current registration', async () => {
    const withReg = await mkPractitioner('C2ok', 'accredited_practitioner')
    expect((await eligibility(withReg)).eligible).toBe(true)

    const without = await mkPractitioner('C2no', 'accredited_practitioner', { registered: false })
    const e = await eligibility(without)
    expect(e.eligible).toBe(false)
    expect(e.reasons).toContain('registration_not_current')
  })

  it('Category 3 still does NOT require a registration', async () => {
    // The line most at risk from a careless rename: the requirement must not
    // migrate onto Category 3.
    const c3 = await mkPractitioner('C3', 'ni_verified_practitioner', { registered: false })
    const e = await eligibility(c3)
    expect(e.reasons).not.toContain('registration_not_current')
    expect(e.eligible).toBe(true)
  })

  it('still refuses a practitioner with no class set', async () => {
    const none = await mkPractitioner('NoClass', null)
    const e = await eligibility(none)
    expect(e.eligible).toBe(false)
    expect(e.reasons).toContain('practitioner_class_not_set')
  })
})

describe('the Category 3 Lead restriction is preserved', () => {
  beforeEach(async () => {
    await db.exec('delete from case_team_roles; delete from practitioners;')
  })

  it('Category 3 cannot be made Lead', async () => {
    const c3 = await mkPractitioner('C3', 'ni_verified_practitioner', { registered: false })
    const msg = await refusal(
      `insert into case_team_roles (case_id, practitioner_id, team_role) values ('${CASE_A}','${c3}','lead');`)
    expect(msg).toMatch(/NI Verified Practitioner \(Category 3\) cannot be the sole Lead/)
  })

  it('Categories 1 and 2 can be made Lead', async () => {
    const c1 = await mkPractitioner('C1', 'regulated_healthcare_professional')
    const c2 = await mkPractitioner('C2', 'accredited_practitioner')
    await db.exec(`insert into case_team_roles (case_id, practitioner_id, team_role) values ('${CASE_A}','${c1}','lead');`)
    await db.exec(`insert into case_team_roles (case_id, practitioner_id, team_role) values ('${CASE_A}','${c2}','care_team');`)
    expect((await rows(`select 1 from case_team_roles`)).length).toBe(2)
  })

  it('a practitioner cannot be demoted to Category 3 while holding an active Lead role', async () => {
    const c1 = await mkPractitioner('C1', 'regulated_healthcare_professional')
    await db.exec(`insert into case_team_roles (case_id, practitioner_id, team_role) values ('${CASE_A}','${c1}','lead');`)
    const msg = await refusal(`update practitioners set category = 'ni_verified_practitioner' where id = '${c1}';`)
    expect(msg).toMatch(/cannot set class to NI Verified Practitioner \(Category 3\)/)

    const after = await rows<{ category: string }>(`select category from practitioners where id = '${c1}'`)
    expect(after[0].category).toBe('regulated_healthcare_professional')
  })
})

describe('students are untouched', () => {
  beforeEach(async () => {
    await db.exec('delete from case_team_roles; delete from practitioners;')
  })

  it('student is a case-team role, never a practitioner category', async () => {
    expect(await refusal(`insert into practitioners (display_name, category) values ('S','student');`))
      .toMatch(/practitioners_category_check/)
    const teamRoles = await rows<{ def: string }>(`
      select pg_get_constraintdef(c.oid) as def from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      where t.relname = 'case_team_roles' and c.contype = 'c'`)
    expect(teamRoles.some((t) => /student/.test(t.def))).toBe(true)
  })

  it('a student still requires a named, active, non-student supervisor', async () => {
    const sup = await mkPractitioner('Sup', 'regulated_healthcare_professional')
    const stu = await mkPractitioner('Stu', 'ni_verified_practitioner', { registered: false })

    // No supervisor named.
    expect(await refusal(
      `insert into case_team_roles (case_id, practitioner_id, team_role) values ('${CASE_A}','${stu}','student');`))
      .toMatch(/Student Practitioner requires a named supervisor/)

    // Supervisor not on the case yet.
    expect(await refusal(
      `insert into case_team_roles (case_id, practitioner_id, team_role, supervisor_id)
       values ('${CASE_A}','${stu}','student','${sup}');`))
      .toMatch(/Student Practitioner requires a named supervisor/)

    // Supervisor active on the case: allowed.
    await db.exec(`insert into case_team_roles (case_id, practitioner_id, team_role) values ('${CASE_A}','${sup}','lead');`)
    await db.exec(`insert into case_team_roles (case_id, practitioner_id, team_role, supervisor_id)
                   values ('${CASE_A}','${stu}','student','${sup}');`)
    expect((await rows(`select 1 from case_team_roles where team_role = 'student'`)).length).toBe(1)
  })
})

// ── The migration refuses to guess ──────────────────────────────────────────

describe('unexpected values are refused, not discarded', () => {
  it('stops and names an unrecognised category rather than nulling it', async () => {
    const fresh = new PGlite()
    try {
      await fresh.exec(readFileSync(SCAFFOLD, 'utf8'))
      // Slip a value past the old CHECK the way a bad fixture might.
      await fresh.exec(`alter table practitioners drop constraint practitioners_category_check;`)
      await fresh.exec(`insert into practitioners (display_name, category) values ('Odd','sports_therapist');`)

      let msg = ''
      try { await fresh.exec(readFileSync(MIGRATION, 'utf8')) } catch (e) { msg = String((e as Error).message ?? e) }
      // The raise aborts the migration's own transaction; clear it, so that the
      // read-back below reports the data rather than the aborted state.
      await fresh.exec('rollback;').catch(() => {})
      expect(msg).toMatch(/unrecognised value\(s\): sports_therapist/)

      // And the row is still there, untouched — nothing was silently dropped.
      const r = await fresh.query<{ category: string }>(`select category from practitioners where display_name = 'Odd'`)
      expect(r.rows[0].category).toBe('sports_therapist')
    } finally {
      await fresh.close()
    }
  })
})

// ── The claim that matters most: this is a rename, not a rule change ─────────

describe('is a pure rename of the live function bodies', () => {
  /*
   * Recorded from Production (yftxzvdrxnhwpcnsrktn) on 2026-10-27, before 0063
   * was applied, with:
   *
   *   select p.proname,
   *          md5(replace(replace(replace(p.prosrc,
   *            'regulated_clinician','regulated_healthcare_professional'),
   *            'voluntary_registered','accredited_practitioner'),
   *            '''unregistered''','''ni_verified_practitioner''')) as md5,
   *          length(...) as len
   *     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   *    where n.nspname = 'public' and p.proname in (...);
   *
   * So each hash is the LIVE body with the three taxonomy literals substituted
   * and nothing else touched. If what 0063 installs hashes the same, the three
   * literals are provably the only thing that changed — no reordering, no
   * reworded error message, no dropped branch, no comment drift.
   *
   * These are a fingerprint of a specific historical state, which is why they
   * are recorded rather than derived from the scaffold. Once 0063 is applied,
   * Production's own hashes become these values.
   *
   * If these three fail on a Windows checkout, do NOT "fix" it by normalising
   * line endings when the migration is read here. The failure is a TRUE
   * POSITIVE: a CRLF working tree installs function bodies containing carriage
   * returns, so Production would not receive the bodies these hashes describe.
   * .gitattributes pins *.sql to eol=lf precisely so the file on disk is the
   * one that produces these hashes. Re-materialise the file (rm it, then
   * git checkout -- <path>) rather than weakening the test.
   */
  const LIVE_TRANSLATED = {
    practitioner_assignment_eligibility: { md5: '4fd356e50abe3f5f985fc8f52b6e477d', len: 2112 },
    enforce_case_team_role_rules: { md5: '1b2c04c9993a361764dadda9ed079096', len: 1358 },
    enforce_practitioner_class_vs_lead_role: { md5: '5ea04c00dffc5be004f79bc52624095c', len: 818 },
  } as const

  it.each(Object.entries(LIVE_TRANSLATED))(
    '%s is the live body with only the literals changed',
    async (proname, expected) => {
      const r = await rows<{ md5: string; len: number }>(
        `select md5(prosrc) as md5, length(prosrc) as len
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = '${proname}'`)
      expect(r).toHaveLength(1)
      expect({ md5: r[0].md5, len: Number(r[0].len) }).toEqual(expected)
    })
})

// ── The trigger 0063 has to step around, and must put back ──────────────────

describe('agreement immutability survives the migration', () => {
  /*
   * enforce_agreement_immutability refuses ANY change to
   * practitioner_agreements.category for every role, so 0063's translation
   * aborts unless it suspends the trigger. The first version of this scaffold
   * omitted that trigger and the suite passed anyway — which is precisely how
   * the defect stayed hidden. These tests exist so it cannot hide again.
   */
  it('left the immutability trigger ENABLED, not suspended', async () => {
    // The dangerous failure is not the abort — it is a migration that disables
    // a governance control and forgets to re-arm it.
    const t = await rows<{ tgenabled: string }>(`
      select tgenabled from pg_trigger
       where tgname = 'trg_practitioner_agreements_immutable' and not tgisinternal`)
    expect(t).toHaveLength(1)
    expect(t[0].tgenabled).toBe('O')   // 'O' = enabled, 'D' = disabled
  })

  it('still refuses an in-place wording change after the migration', async () => {
    await db.exec(`insert into practitioner_agreements (category, version, title, body)
                   values ('ni_verified_practitioner','imm-1','T','B');`)
    const msg = await refusal(
      `update practitioner_agreements set body = 'edited' where version = 'imm-1';`)
    expect(msg).toMatch(/practitioner_agreements rows are immutable/)

    // and the controlled field still moves
    await db.exec(`update practitioner_agreements set is_current = false where version = 'imm-1';`)
    const r = await rows<{ is_current: boolean }>(
      `select is_current from practitioner_agreements where version = 'imm-1'`)
    expect(r[0].is_current).toBe(false)
    await db.exec(`delete from practitioner_agreements where version = 'imm-1';`)
  })
})
