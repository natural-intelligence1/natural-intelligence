/*
 * Database behaviour of migration 0064 — the practitioner eligibility spine.
 *
 * PGlite in-process: no Docker, no network, no Supabase project, Production
 * untouched. The scaffold reproduces the POST-0063 structures 0064 depends on;
 * the migration is then read from disk and executed against it, so these tests
 * exercise the real migration rather than a paraphrase of it.
 *
 * The central claim under test: eligibility is a COMPUTED FACT. Nothing is
 * eligible by default, absent evidence is a blocker rather than a pass, and
 * cover lapses because the date changed rather than because a job ran.
 *
 * Every fixture here is purpose-built and marked is_test_data. The five
 * existing synthetic practitioners in Production are never referenced and
 * their evidence is never modified. No real data of any kind.
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

const rows = async <T = Record<string, unknown>>(sql: string): Promise<T[]> =>
  (await db.query<T>(sql)).rows

async function refusal(sql: string): Promise<string> {
  try { await db.exec(sql) } catch (e) { return String((e as Error).message ?? e) }
  throw new Error('expected the database to refuse this statement, but it succeeded')
}

interface Verdict {
  eligible: boolean
  evaluated_role: string | null
  eligible_roles: string[]
  blockers: string[]
  category: string | null
  required_cover: string | null
  actual_cover: string | null
  indemnity_expiry: string | null
  credential_state: string
  scope_state: string
  agreement_state: string
}

const verdict = async (id: string, role?: string): Promise<Verdict> =>
  (await rows<Verdict>(
    `select * from practitioner_eligibility('${id}'::uuid, ${role ? `'${role}'` : 'null'})`))[0]

/** A practitioner with every gate open except whatever a test varies. */
async function mkPractitioner(opts: {
  category?: string | null
  status?: string
  dbs?: string
} = {}): Promise<string> {
  const cat = opts.category === undefined ? 'accredited_practitioner' : opts.category
  const r = await rows<{ id: string }>(`
    insert into practitioners (display_name, category, status, is_active, dbs_status, is_test_data)
    values ('TEST — Practitioner', ${cat === null ? 'null' : `'${cat}'`},
            '${opts.status ?? 'active'}', ${(opts.status ?? 'active') === 'active'},
            '${opts.dbs ?? 'not_required'}', true)
    returning id;`)
  return r[0].id
}

async function mkVerifier(): Promise<string> {
  const r = await rows<{ id: string }>(
    `insert into profiles (full_name, role, is_test_data) values ('TEST — Admin','admin',true) returning id;`)
  return r[0].id
}

let VERIFIER: string

async function addCredential(pid: string, o: {
  type?: string; bodyKey?: string; verified?: boolean; standing?: string
  expires?: string | null; revoked?: boolean; superseded?: boolean
} = {}) {
  const verified = o.verified !== false
  const revoked = o.revoked === true
  await db.exec(`
    insert into practitioner_credentials
      (practitioner_id, credential_type, issuing_body, issuing_body_key, reference_number,
       evidence_reference, verification_status, verified_by, verified_at,
       expires_at, standing_status, revoked_at, superseded_at, is_test_data)
    values ('${pid}', '${o.type ?? 'accredited_register'}', 'TEST Body', '${o.bodyKey ?? 'testbody'}', 'REF-1',
            ${verified ? `'storage://test/evidence'` : 'null'},
            '${verified ? 'verified' : 'unverified'}',
            ${verified ? `'${VERIFIER}'` : 'null'}, ${verified ? 'now()' : 'null'},
            ${o.expires === undefined ? 'null' : o.expires === null ? 'null' : `'${o.expires}'`},
            '${revoked ? 'revoked' : (o.standing ?? 'current')}',
            ${revoked ? 'now()' : 'null'},
            ${o.superseded ? 'now()' : 'null'}, true);`)
}

async function addIndemnity(pid: string, o: {
  cover?: number; expiry?: string; verified?: boolean
} = {}) {
  const verified = o.verified !== false
  await db.exec(`
    insert into practitioner_indemnity
      (practitioner_id, insurer, policy_number, cover_amount, currency, expiry_date,
       evidence_reference, verification_status, verified_by, verified_at, is_test_data)
    values ('${pid}', 'TEST Insurer', 'POL-1', ${o.cover ?? 6000000}, 'GBP',
            '${o.expiry ?? '2099-12-31'}',
            ${verified ? `'storage://test/policy'` : 'null'},
            '${verified ? 'verified' : 'unverified'}',
            ${verified ? `'${VERIFIER}'` : 'null'}, ${verified ? 'now()' : 'null'}, true);`)
}

async function addScope(pid: string, o: { roles?: string[]; status?: string } = {}) {
  const status = o.status ?? 'approved'
  const roles = o.roles ?? ['lead', 'care_team', 'student']
  await db.exec(`
    insert into practitioner_scope
      (practitioner_id, approved_scope, permitted_roles, status, approver, approval_date, is_test_data)
    values ('${pid}', 'TEST scope', array[${roles.map((r) => `'${r}'`).join(',')}]::text[],
            '${status}',
            ${status === 'approved' ? `'${VERIFIER}'` : 'null'},
            ${status === 'approved' ? 'now()' : 'null'}, true);`)
}

/** Publish the current agreement for a category and accept it. */
async function acceptAgreement(pid: string, category: string) {
  const a = await rows<{ id: string }>(`
    insert into practitioner_agreements (category, version, body, is_current)
    values ('${category}', 'v1', 'AGREEMENT BODY', true) returning id;`)
  await db.exec(`
    insert into practitioner_agreement_acceptances
      (practitioner_id, agreement_id, agreement_version, accepted_text_hash)
    values ('${pid}', '${a[0].id}', 'v1', encode(extensions.digest('AGREEMENT BODY','sha256'),'hex'));`)
}

/** The happy path: every gate satisfied for a qualified Category 2 lead. */
async function mkFullyEligible(cover = 6000000): Promise<string> {
  const p = await mkPractitioner({ category: 'accredited_practitioner' })
  await addCredential(p, { type: 'accredited_register', bodyKey: 'unconfigured_ok' })
  await addIndemnity(p, { cover })
  await addScope(p)
  await acceptAgreement(p, 'accredited_practitioner')
  // The body this credential names has no configured minimum, which would be
  // indemnity_requirement_unknown. Configure it so this fixture isolates cover.
  await db.exec(`insert into indemnity_requirements
      (requirement_source, source_key, minimum_cover, source_reference)
    values ('accredited_register','unconfigured_ok', 1, 'test fixture')
    on conflict do nothing;`)
  return p
}

beforeAll(async () => {
  db = new PGlite()
  await db.exec(readFileSync(SCAFFOLD, 'utf8'))
  await db.exec(readFileSync(MIGRATION, 'utf8'))
})
afterAll(async () => { await db?.close() })

beforeEach(async () => {
  await db.exec(`
    delete from practitioner_credentials;
    delete from practitioner_indemnity;
    delete from practitioner_scope;
    delete from practitioner_agreement_acceptances;
    delete from practitioner_agreements;
    delete from practitioners;
    delete from profiles;
    delete from indemnity_requirements where requirement_source <> 'ni_role_floor';`)
  VERIFIER = await mkVerifier()
})

// ── The locked floors ───────────────────────────────────────────────────────

describe('indemnity floors', () => {
  it('seeds exactly the three Founder-locked NI role floors', async () => {
    const r = await rows<{ source_key: string; minimum_cover: string }>(
      `select source_key, minimum_cover from indemnity_requirements
        where requirement_source = 'ni_role_floor' order by source_key`)
    expect(r).toEqual([
      { source_key: 'care_team', minimum_cover: '6000000.00' },
      { source_key: 'lead',      minimum_cover: '6000000.00' },
      { source_key: 'student',   minimum_cover: '4000000.00' },
    ])
  })

  it('a qualified practitioner at exactly £6,000,000 is eligible for lead', async () => {
    const p = await mkFullyEligible(6000000)
    const v = await verdict(p, 'lead')
    expect(v.blockers).toEqual([])
    expect(v.eligible).toBe(true)
    expect(v.required_cover).toBe('6000000.00')
    expect(v.actual_cover).toBe('6000000.00')
  })

  it('£5,999,999 is NOT eligible', async () => {
    const p = await mkFullyEligible(5999999)
    const v = await verdict(p, 'lead')
    expect(v.eligible).toBe(false)
    expect(v.blockers).toContain('indemnity_insufficient')
  })

  it('a higher external requirement overrides the NI floor', async () => {
    const p = await mkFullyEligible(6000000)
    await db.exec(`update indemnity_requirements set minimum_cover = 10000000
                    where source_key = 'unconfigured_ok';`)
    const v = await verdict(p, 'lead')
    expect(v.required_cover).toBe('10000000.00')
    expect(v.eligible).toBe(false)
    expect(v.blockers).toContain('indemnity_insufficient')
  })

  it('an applicable external body with NO configured minimum is NOT eligible', async () => {
    // The amendment: the NI floor is never silently assumed sufficient.
    const p = await mkFullyEligible(6000000)
    await db.exec(`delete from indemnity_requirements where source_key = 'unconfigured_ok';`)
    const v = await verdict(p, 'lead')
    expect(v.eligible).toBe(false)
    expect(v.blockers).toContain('indemnity_requirement_unknown')
    expect(v.blockers).not.toContain('indemnity_insufficient')
  })
})

// ── Expiry bites because the date changed ───────────────────────────────────

describe('expiry semantics — valid THROUGH expiry_date', () => {
  it('a policy expiring TODAY is still valid', async () => {
    const p = await mkFullyEligible()
    await db.exec(`update practitioner_indemnity set expiry_date = current_date;`)
    const v = await verdict(p, 'lead')
    expect(v.blockers).toEqual([])
    expect(v.eligible).toBe(true)
  })

  it('a policy that expired yesterday is expired, with no job having run', async () => {
    const p = await mkFullyEligible()
    await db.exec(`update practitioner_indemnity set expiry_date = current_date - 1;`)
    const v = await verdict(p, 'lead')
    expect(v.eligible).toBe(false)
    expect(v.blockers).toContain('indemnity_expired')
  })

  it('a credential that expired yesterday blocks', async () => {
    const p = await mkFullyEligible()
    await db.exec(`update practitioner_credentials set expires_at = current_date - 1;`)
    const v = await verdict(p, 'lead')
    expect(v.eligible).toBe(false)
    expect(v.blockers).toContain('credential_expired')
  })
})

// ── Credential evidence ─────────────────────────────────────────────────────

describe('credential evidence', () => {
  it('missing credential blocks', async () => {
    const p = await mkFullyEligible()
    await db.exec(`delete from practitioner_credentials;`)
    expect((await verdict(p, 'lead')).blockers).toContain('credential_missing')
  })

  it('unverified credential blocks', async () => {
    const p = await mkFullyEligible()
    await db.exec(`update practitioner_credentials
                      set verification_status='unverified', verified_by=null,
                          verified_at=null, evidence_reference=null;`)
    expect((await verdict(p, 'lead')).blockers).toContain('credentials_not_verified')
  })

  it('revoked credential blocks', async () => {
    const p = await mkFullyEligible()
    await db.exec(`update practitioner_credentials set standing_status='revoked', revoked_at=now();`)
    expect((await verdict(p, 'lead')).blockers).toContain('credential_revoked')
  })

  it('a verified external registration that is not in good standing blocks', async () => {
    const p = await mkFullyEligible()
    await db.exec(`update practitioner_credentials set standing_status='lapsed';`)
    expect((await verdict(p, 'lead')).blockers).toContain('registration_not_current')
  })

  it('each category requires its own credential type', async () => {
    const p = await mkPractitioner({ category: 'regulated_healthcare_professional' })
    await addIndemnity(p); await addScope(p)
    await acceptAgreement(p, 'regulated_healthcare_professional')
    // Holding only an accredited_register credential does not satisfy Cat 1.
    await addCredential(p, { type: 'accredited_register', bodyKey: 'b1' })
    await db.exec(`insert into indemnity_requirements (requirement_source, source_key, minimum_cover)
                   values ('accredited_register','b1',1) on conflict do nothing;`)
    expect((await verdict(p, 'lead')).blockers).toContain('credential_missing')
  })
})

// ── Student: a case role, never a category ──────────────────────────────────

describe('student role', () => {
  /** Student evidence path: no category, student_enrolment credential, £4m. */
  async function mkStudent(cover = 4000000, roles = ['student']): Promise<string> {
    const p = await mkPractitioner({ category: null })
    await addCredential(p, { type: 'student_enrolment', bodyKey: 'school', standing: 'not_applicable' })
    await addIndemnity(p, { cover })
    await addScope(p, { roles })
    return p
  }

  it('is evidence-eligible with category NULL, valid enrolment, £4m and supervised scope', async () => {
    const p = await mkStudent()
    const v = await verdict(p, 'student')
    expect(v.category).toBeNull()
    expect(v.blockers).toEqual([])
    expect(v.eligible).toBe(true)
    expect(v.required_cover).toBe('4000000.00')
  })

  it('does NOT fail merely because practitioners.category is NULL', async () => {
    const p = await mkStudent()
    expect((await verdict(p, 'student')).blockers).not.toContain('practitioner_class_not_set')
  })

  it('below £4m is not eligible', async () => {
    const p = await mkStudent(3999999)
    const v = await verdict(p, 'student')
    expect(v.eligible).toBe(false)
    expect(v.blockers).toContain('indemnity_insufficient')
  })

  it('the same student requesting lead is refused', async () => {
    const p = await mkStudent(4000000, ['student', 'lead'])
    const v = await verdict(p, 'lead')
    expect(v.eligible).toBe(false)
    // No category, and £4m is under the £6m lead floor.
    expect(v.blockers).toContain('practitioner_class_not_set')
    expect(v.blockers).toContain('indemnity_insufficient')
  })

  it('needs no agreement acceptance — none is invented for students', async () => {
    const p = await mkStudent()
    const v = await verdict(p, 'student')
    expect(v.blockers).not.toContain('no_current_agreement_acceptance')
    expect(v.agreement_state).toBe('not_required')
  })

  it('student is never a practitioner category', async () => {
    expect(await refusal(
      `insert into practitioners (display_name, category) values ('S','student');`))
      .toMatch(/practitioners_category_check/)
  })
})

// ── Scope ───────────────────────────────────────────────────────────────────

describe('scope', () => {
  it('missing scope blocks', async () => {
    const p = await mkFullyEligible()
    await db.exec(`delete from practitioner_scope;`)
    expect((await verdict(p, 'lead')).blockers).toContain('scope_missing')
  })

  it('unapproved scope blocks', async () => {
    const p = await mkFullyEligible()
    await db.exec(`update practitioner_scope set status='pending', approver=null, approval_date=null;`)
    expect((await verdict(p, 'lead')).blockers).toContain('scope_not_approved')
  })

  it('approved scope that does not permit the requested role blocks', async () => {
    const p = await mkPractitioner({ category: 'accredited_practitioner' })
    await addCredential(p, { bodyKey: 'bk' }); await addIndemnity(p)
    await acceptAgreement(p, 'accredited_practitioner')
    await addScope(p, { roles: ['care_team'] })
    await db.exec(`insert into indemnity_requirements (requirement_source, source_key, minimum_cover)
                   values ('accredited_register','bk',1) on conflict do nothing;`)
    const v = await verdict(p, 'lead')
    expect(v.eligible).toBe(false)
    expect(v.blockers).toContain('scope_role_not_permitted')
  })

  it('keeps history: a superseded row remains after a new one is approved', async () => {
    const p = await mkFullyEligible()
    await db.exec(`update practitioner_scope set superseded_at = now();`)
    await addScope(p, { roles: ['care_team'] })
    const all = await rows(`select id from practitioner_scope where practitioner_id='${p}'`)
    expect(all.length).toBe(2)
    const current = await rows<{ permitted_roles: string[] }>(
      `select permitted_roles from practitioner_scope
        where practitioner_id='${p}' and superseded_at is null`)
    expect(current.length).toBe(1)
    expect(current[0].permitted_roles).toEqual(['care_team'])
  })

  it('refuses a second current scope row', async () => {
    const p = await mkFullyEligible()
    expect(await refusal(`insert into practitioner_scope
      (practitioner_id, approved_scope, status) values ('${p}','second','pending');`))
      .toMatch(/practitioner_scope_one_current_idx/)
  })
})

// ── Lifecycle, category and governance rules carried forward ────────────────

describe('lifecycle and governance', () => {
  it('an inactive practitioner is not eligible', async () => {
    const p = await mkFullyEligible()
    await db.exec(`update practitioners set status='suspended', is_active=false where id='${p}';`)
    const v = await verdict(p, 'lead')
    expect(v.eligible).toBe(false)
    expect(v.blockers).toContain('practitioner_not_active')
  })

  it('a qualified role with category NULL is not eligible', async () => {
    const p = await mkPractitioner({ category: null })
    await addIndemnity(p); await addScope(p)
    expect((await verdict(p, 'care_team')).blockers).toContain('practitioner_class_not_set')
  })

  it('Category 3 cannot be sole Lead — the 0060/0063 rule, not reopened', async () => {
    const p = await mkPractitioner({ category: 'ni_verified_practitioner' })
    await addCredential(p, { type: 'qualification', standing: 'not_applicable' })
    await addIndemnity(p); await addScope(p)
    await acceptAgreement(p, 'ni_verified_practitioner')
    expect((await verdict(p, 'lead')).blockers).toContain('role_not_permitted_for_category')
    // but is fine as care_team
    expect((await verdict(p, 'care_team')).eligible).toBe(true)
  })

  it('the DBS gate is carried forward unchanged', async () => {
    const p = await mkFullyEligible()
    await db.exec(`update practitioners set dbs_status='pending' where id='${p}';`)
    expect((await verdict(p, 'lead')).blockers).toContain('dbs_outstanding')
  })

  it('a missing current agreement blocks a qualified role', async () => {
    const p = await mkFullyEligible()
    await db.exec(`delete from practitioner_agreement_acceptances;`)
    const v = await verdict(p, 'lead')
    expect(v.eligible).toBe(false)
    expect(v.blockers).toContain('no_current_agreement_acceptance')
    expect(v.agreement_state).toBe('missing')
  })

  it('an unknown role is refused, never evaluated optimistically', async () => {
    const p = await mkFullyEligible()
    const v = await verdict(p, 'specialist')
    expect(v.eligible).toBe(false)
    expect(v.blockers).toEqual(['role_unknown'])
  })

  it('a missing practitioner is refused', async () => {
    const v = await verdict('00000000-0000-4000-8000-000000000000')
    expect(v.eligible).toBe(false)
    expect(v.blockers).toEqual(['practitioner_not_found'])
  })
})

// ── Constraints: "verified" cannot be a hollow label ────────────────────────

describe('evidence constraints', () => {
  it('refuses a verified credential with no verifier metadata', async () => {
    const p = await mkPractitioner()
    expect(await refusal(`insert into practitioner_credentials
      (practitioner_id, credential_type, issuing_body, issuing_body_key, verification_status)
      values ('${p}','qualification','B','b','verified');`))
      .toMatch(/practitioner_credentials_verified_is_evidenced/)
  })

  it('refuses a verified indemnity with no evidence or verifier', async () => {
    const p = await mkPractitioner()
    expect(await refusal(`insert into practitioner_indemnity
      (practitioner_id, insurer, cover_amount, expiry_date, verification_status)
      values ('${p}','I',6000000,'2099-01-01','verified');`))
      .toMatch(/practitioner_indemnity_verified_is_evidenced/)
  })

  it('refuses an approved scope with no approver or date', async () => {
    const p = await mkPractitioner()
    expect(await refusal(`insert into practitioner_scope
      (practitioner_id, approved_scope, status) values ('${p}','s','approved');`))
      .toMatch(/practitioner_scope_approved_is_evidenced/)
  })

  it('refuses a non-GBP policy outright', async () => {
    const p = await mkPractitioner()
    expect(await refusal(`insert into practitioner_indemnity
      (practitioner_id, insurer, cover_amount, currency, expiry_date)
      values ('${p}','I',6000000,'EUR','2099-01-01');`))
      .toMatch(/practitioner_indemnity_currency_gbp/)
  })

  it('refuses zero or negative cover', async () => {
    const p = await mkPractitioner()
    expect(await refusal(`insert into practitioner_indemnity
      (practitioner_id, insurer, cover_amount, expiry_date)
      values ('${p}','I',0,'2099-01-01');`))
      .toMatch(/practitioner_indemnity_cover_positive/)
  })

  it('refuses a role outside the canonical set in permitted_roles', async () => {
    const p = await mkPractitioner()
    expect(await refusal(`insert into practitioner_scope
      (practitioner_id, approved_scope, permitted_roles, status)
      values ('${p}','s',array['specialist']::text[],'pending');`))
      .toMatch(/practitioner_scope_roles_canonical/)
  })

  it('refuses revocation labelled inconsistently', async () => {
    const p = await mkPractitioner()
    expect(await refusal(`insert into practitioner_credentials
      (practitioner_id, credential_type, issuing_body, issuing_body_key, standing_status, revoked_at)
      values ('${p}','qualification','B','b','revoked', null);`))
      .toMatch(/practitioner_credentials_revocation_coherent/)
  })

  it('keeps governance evidence: practitioner delete is RESTRICTed, not cascaded', async () => {
    const p = await mkFullyEligible()
    // RESTRICT specifically, not merely NO ACTION — the evidence trail is not
    // collateral damage of deleting a practitioner.
    expect(await refusal(`delete from practitioners where id = '${p}';`))
      .toMatch(/violates RESTRICT setting of foreign key constraint "practitioner_credentials_practitioner_id_fkey"/)
    expect((await rows(`select 1 from practitioner_credentials where practitioner_id='${p}'`)).length)
      .toBe(1)
  })
})

// ── The compatibility wrapper ───────────────────────────────────────────────

describe('practitioner_assignment_eligibility is a wrapper, not an authority', () => {
  it('delegates: same verdict as the role-free canonical call', async () => {
    const p = await mkFullyEligible()
    const legacy = (await rows<{ eligible: boolean; reasons: string[] }>(
      `select * from practitioner_assignment_eligibility('${p}'::uuid)`))[0]
    const canonical = await verdict(p)
    expect(legacy.eligible).toBe(canonical.eligible)
    expect(legacy.reasons).toEqual(canonical.blockers)
  })

  it('keeps its exact signature so existing callers and 0061 still bind', async () => {
    const sig = await rows<{ args: string; result: string }>(`
      select pg_get_function_identity_arguments(p.oid) as args,
             pg_get_function_result(p.oid) as result
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname='public' and p.proname='practitioner_assignment_eligibility'`)
    expect(sig).toHaveLength(1)
    expect(sig[0].args).toBe('p_practitioner_id uuid')
    expect(sig[0].result).toBe('TABLE(eligible boolean, reasons text[])')
  })

  it('contains no eligibility rules of its own', async () => {
    const src = await rows<{ prosrc: string }>(`
      select prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='public' and p.proname='practitioner_assignment_eligibility'`)
    const body = src[0].prosrc
    expect(body).toContain('practitioner_eligibility')
    for (const rule of ['insurance_expiry', 'cover_amount', 'scope_status', 'dbs_status',
                        'credentials_verification_status', 'category']) {
      expect(body).not.toContain(rule)
    }
  })

  it('refuses a practitioner with no evidence — the current Production state', async () => {
    // Every existing synthetic practitioner looks like this: active, no
    // evidence rows. They must all come back ineligible, not eligible.
    const p = await mkPractitioner({ category: 'accredited_practitioner' })
    const legacy = (await rows<{ eligible: boolean; reasons: string[] }>(
      `select * from practitioner_assignment_eligibility('${p}'::uuid)`))[0]
    expect(legacy.eligible).toBe(false)
    expect(legacy.reasons.length).toBeGreaterThan(0)
  })
})

// ── Role-free evaluation ────────────────────────────────────────────────────

describe('role-free evaluation', () => {
  it('lists every role the practitioner may hold', async () => {
    const p = await mkFullyEligible()
    const v = await verdict(p)
    expect(v.evaluated_role).toBeNull()
    expect(v.eligible).toBe(true)
    // Category 2 with full scope: lead and care_team, but not student
    // (no student_enrolment credential).
    expect([...v.eligible_roles].sort()).toEqual(['care_team', 'lead'])
  })

  it('is not eligible when no role passes, and names the common blockers', async () => {
    const p = await mkPractitioner({ category: 'accredited_practitioner' })
    const v = await verdict(p)
    expect(v.eligible).toBe(false)
    expect(v.eligible_roles).toEqual([])
    expect(v.blockers).toContain('scope_missing')
    expect(v.blockers).toContain('indemnity_missing')
  })
})
