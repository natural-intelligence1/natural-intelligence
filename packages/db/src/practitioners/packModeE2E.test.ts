// ─── SPRINT 5 — pack-mode end-to-end + adversarial de-identification ─────────
// Runs the REAL generation path (generateAndStoreReviewPack) over a RICH
// synthetic intake deliberately salted with quasi-identifiers, then attacks
// the stored practitioner-readable pack. SYNTHETIC DATA ONLY; self-cleaning;
// self-skips without DB env or pre-0051.
//
// Proves (Sprint 5 §2 and §4):
//   • generation reads the identified intake server-side (service role);
//   • the de-identifier is default-deny;
//   • the STORED pack carries no quasi-identifier from the salted source;
//   • an audit row exists on the admin-only table;
//   • regeneration creates a NEW version, never overwriting;
//   • consent withdrawal blocks further generation;
//   • the practitioner retrieves the pack ONLY through RLS with active work.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import { generateAndStoreReviewPack, getReviewPackForCase } from './reviewPackAccess'
import { createTestUser, deleteTestUser } from './__test-helpers__/createTestUser'
import { signInAs } from './__test-helpers__/signInAs'
import { makePractitionerAssignable } from './__test-helpers__/makeAssignable'

const HAVE_DB = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY
function mkAdmin() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// Quasi-identifier salt — every string here must be ABSENT from the pack.
const SALT = {
  name: 'Zebedee Quasitest',
  email: 'zebedee.quasitest@example.test',
  phone: '07123 456789',
  occupation: 'lighthouse keeper on Flat Holm island',
  household: 'lives with triplet daughters and an elderly aunt above the bakery on Example Lane',
  location: 'Exampleton-upon-Sea, EX1 2QT',
  rareEvent: 'struck by lightning twice at the 2019 cheese-rolling festival',
  clinician: 'Dr Featherstonehaugh at The Example Lane Surgery',
  date: '14 March 1985',
  upload: 'zebedee_bloods_march.pdf',
}

describe.skipIf(!HAVE_DB)('SPRINT 5 — pack generation e2e + adversarial review (armed)', () => {
  const admin = HAVE_DB ? mkAdmin() : (null as never)
  let armed = false
  let member: Awaited<ReturnType<typeof createTestUser>> | null = null
  let pract: Awaited<ReturnType<typeof createTestUser>> | null = null
  let caseId: string | null = null
  let cleanupAssignable: (() => Promise<void>) | null = null
  let firstPackId: string | null = null

  beforeAll(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const probe = await (admin as any).from('practitioner_review_packs').select('id').limit(1)
    armed = !probe.error
    if (!armed) return

    member = await createTestUser(admin, 's5-e2e-member')
    pract = await createTestUser(admin, 's5-e2e-pract')
    await admin.from('practitioners').insert({ id: pract.id, display_name: `Test ${pract.email}`, status: 'active' } as never)
    cleanupAssignable = await makePractitionerAssignable(admin, pract.id)

    // Consent required for synopsis sharing (fail-closed gate).
    await admin.from('consent_records').insert({
      profile_id: member.id, email: member.email, consent_type: 'deidentified_synopsis_sharing',
      consented: true, consented_at: new Date().toISOString(), consent_version: 's3-draft-2',
      source: 's5-e2e', actor: 'member',
    } as never)

    // RICH identified intake, salted with quasi-identifiers in every field class.
    const { error: intakeErr } = await admin.from('intake_responses').insert({
      member_id: member.id, is_complete: true, completed_sections: 9,
      arrival_emotion: 'hopeful',
      primary_concerns: ['fatigue', `bloating since moving to ${SALT.location}`],
      primary_system: 'digestive',
      stress_level: 4, sleep_quality: 4, energy_level: 3, // 1–5 CHECK ranges
      diet_description: `As a ${SALT.occupation} I eat at odd hours; my aunt (${SALT.household}) cooks. Contact me on ${SALT.email} or ${SALT.phone}.`,
      current_medications: `omeprazole 20mg prescribed by ${SALT.clinician}; cetirizine`,
      current_supplements: `vitamin D; magnesium recommended after I was ${SALT.rareEvent}`,
      symptom_onset: 'about two years ago',
      timeline_last_well: `I last felt well before ${SALT.date}, when I was ${SALT.rareEvent}`,
      timeline_trigger: `house move to ${SALT.location} and ${SALT.name} losing the bakery`,
      diagnosed_conditions: [`IBS diagnosed by ${SALT.clinician} in 2025`, 'hay fever'],
      most_want_to_understand: `Why me, ${SALT.name} of ${SALT.location}? See ${SALT.upload}.`,
    } as never)
    if (intakeErr) throw new Error(`fixture intake insert failed: ${intakeErr.message}`)

    const { data: c } = await admin.from('client_cases')
      .insert({ client_id: member.id, status: 'active', primary_concern: `bloating — full story in ${SALT.upload}, ask for ${SALT.name}` } as never)
      .select('id').single()
    caseId = (c as { id: string } | null)?.id ?? null

    // ACTIVE work item for the practitioner (0056-eligible fixture).
    await admin.from('case_practitioner_work').insert({
      case_id: caseId!, practitioner_id: pract.id, work_type: 'case_review',
      status: 'assigned', assignment_source: 'admin', assigned_by: pract.id,
    } as never)
  }, 90_000)

  afterAll(async () => {
    if (!armed || !member || !pract) return
    if (caseId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: packs } = await (admin as any).from('practitioner_review_packs').select('id').eq('case_id', caseId)
      for (const p of (packs ?? []) as { id: string }[]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin as any).from('review_pack_audit').delete().eq('pack_id', p.id)
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any).from('practitioner_review_packs').delete().eq('case_id', caseId)
      await admin.from('case_practitioner_work').delete().eq('case_id', caseId)
      await admin.from('client_cases').delete().eq('id', caseId)
    }
    await admin.from('intake_responses').delete().eq('member_id', member.id)
    await admin.from('consent_records').delete().eq('profile_id', member.id)
    if (cleanupAssignable) await cleanupAssignable()
    await admin.from('practitioners').delete().eq('id', pract.id)
    await deleteTestUser(admin, pract.id)
    await deleteTestUser(admin, member.id)
  }, 90_000)

  it('generates a pack through the REAL path: stored de-identified, audit row written', async (ctx) => {
    if (!armed) return ctx.skip()
    const result = await generateAndStoreReviewPack(admin, caseId!, pract!.id)
    firstPackId = result.packId
    expect(result.packVersion).toBe(1)
    expect(result.pseudonym).toMatch(/^NI-[0-9A-F]{6}$/)
    expect(result.suppressedCount).toBeGreaterThan(0) // default-deny visibly at work

    // Audit row exists on the admin-only table, holding the source linkage.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: audit } = await (admin as any).from('review_pack_audit')
      .select('pack_id, source_intake_id, suppressed_fields, generated_by').eq('pack_id', result.packId).single()
    expect(audit?.pack_id).toBe(result.packId)
    expect(audit?.generated_by).toBe(pract!.id)
    expect(Array.isArray(audit?.suppressed_fields)).toBe(true)
  }, 60_000)

  it('ADVERSARIAL: no quasi-identifier from the salted source survives into the stored pack', async (ctx) => {
    if (!armed || !firstPackId) return ctx.skip()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: packRow } = await (admin as any).from('practitioner_review_packs')
      .select('pack, pseudonym').eq('id', firstPackId).single()
    const packText = JSON.stringify(packRow).toLowerCase()

    for (const [kind, value] of Object.entries(SALT)) {
      expect(packText.includes(String(value).toLowerCase()), `quasi-identifier leaked (${kind})`).toBe(false)
    }
    // Distinctive fragments too, not just whole strings:
    for (const fragment of ['quasitest', 'zebedee', 'flat holm', 'lighthouse', 'triplet', 'bakery',
      'example lane', 'exampleton', 'ex1 2qt', 'lightning', 'cheese-rolling',
      'featherstonehaugh', 'surgery', '.pdf', 'march 1985', '@', '07123']) {
      expect(packText.includes(fragment), `fragment leaked: ${fragment}`).toBe(false)
    }
    // Narrative fields are suppressed outright — never present as keys.
    for (const banned of ['dietdescription', 'mostwanttounderstand', 'timelinelastwell', 'timelinetrigger',
      'bestselfdescription']) {
      expect(packText.includes(banned), `narrative field present: ${banned}`).toBe(false)
    }
  })

  it('the practitioner retrieves the pack ONLY via RLS with active work; a stranger gets nothing', async (ctx) => {
    if (!armed || !firstPackId) return ctx.skip()
    const p = await signInAs(pract!)
    const viaRls = await getReviewPackForCase(p, caseId!)
    expect(viaRls?.id).toBe(firstPackId)
    expect(viaRls?.pseudonym).toMatch(/^NI-/)

    const stranger = await createTestUser(admin, 's5-e2e-stranger')
    await admin.from('practitioners').insert({ id: stranger.id, display_name: `Test ${stranger.email}`, status: 'active' } as never)
    const s = await signInAs(stranger)
    const strangerView = await getReviewPackForCase(s, caseId!)
    expect(strangerView).toBeNull()
    await admin.from('practitioners').delete().eq('id', stranger.id)
    await deleteTestUser(admin, stranger.id)
  }, 60_000)

  it('regeneration creates a NEW immutable version; version 1 is untouched', async (ctx) => {
    if (!armed || !firstPackId) return ctx.skip()
    const second = await generateAndStoreReviewPack(admin, caseId!, pract!.id)
    expect(second.packVersion).toBe(2)
    expect(second.packId).not.toBe(firstPackId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: v1 } = await (admin as any).from('practitioner_review_packs')
      .select('id, pack_version').eq('id', firstPackId).single()
    expect(v1?.pack_version).toBe(1) // never edited in place
  }, 60_000)

  it('consent WITHDRAWAL blocks further generation (fail-closed)', async (ctx) => {
    if (!armed) return ctx.skip()
    const m = await signInAs(member!)
    const { error: rpcErr } = await m.rpc('withdraw_own_consent' as never,
      { p_consent_type: 'deidentified_synopsis_sharing' } as never)
    expect(rpcErr).toBeNull()
    await expect(generateAndStoreReviewPack(admin, caseId!, pract!.id))
      .rejects.toThrow(/Blocked/)
  }, 60_000)
})
