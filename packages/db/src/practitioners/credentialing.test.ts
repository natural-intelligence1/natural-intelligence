// ─── Sprint 4 — eligibility matrix (pure mirror) + ARMED live DB gate tests ───
// The pure suite proves the A–F matrix at the model layer (always runs).
// The live suite proves the SAME matrix at the AUTHORITATIVE database layer
// (0056 RPC + BEFORE INSERT trigger): it SELF-SKIPS until migration 0056 is
// applied, then must pass before Sprint 4 closes. Synthetic practitioners
// only; no real client data.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import {
  evaluatePractitionerEligibility, PRACTITIONER_CLASS_LABELS, SPRINT4_MODALITIES,
  checkAssignmentEligibility,
  type PractitionerEligibilitySnapshot,
} from './credentialing'
import { createTestUser, deleteTestUser } from './__test-helpers__/createTestUser'

const TODAY = '2026-09-19'

/** A synthetic practitioner that passes EVERY condition. */
const fullyEligible: PractitionerEligibilitySnapshot = {
  exists: true,
  status: 'active',
  isActive: true,
  category: 'voluntary_registered',
  hasCurrentAgreementAcceptance: true,
  credentialsVerificationStatus: 'verified',
  indemnityRequired: true,
  insuranceExpiry: '2027-01-01',
  registrationBody: 'Example Register',
  registrationNumber: 'REG-123',
  registrationStatus: 'registered',
  dbsStatus: 'clear',
  scopeStatus: 'approved',
}

describe('Sprint 4 — class and modality models', () => {
  it('three canonical classes map onto the existing 0051 categories; no student class', () => {
    expect(PRACTITIONER_CLASS_LABELS.regulated_clinician).toBe('Regulated Healthcare Professional')
    expect(PRACTITIONER_CLASS_LABELS.voluntary_registered).toBe('Accredited Practitioner')
    expect(PRACTITIONER_CLASS_LABELS.unregistered).toBe('NI Verified Practitioner')
    expect(Object.keys(PRACTITIONER_CLASS_LABELS)).toHaveLength(3)
    expect(JSON.stringify(PRACTITIONER_CLASS_LABELS)).not.toMatch(/student/i)
  })

  it('the 16 modalities are a display set, separate from class', () => {
    expect(SPRINT4_MODALITIES).toHaveLength(16)
    expect(SPRINT4_MODALITIES).toContain('Hijama Practitioner')
    expect(SPRINT4_MODALITIES).toContain('Prophetic Medicine Practitioner')
  })
})

describe('Sprint 4 — eligibility matrix (pure mirror of the 0056 SQL)', () => {
  it('F: a fully eligible practitioner is assignable', () => {
    expect(evaluatePractitionerEligibility(fullyEligible, TODAY)).toEqual({ eligible: true, reasons: [] })
  })

  it('A: no accepted agreement → refused', () => {
    const result = evaluatePractitionerEligibility({ ...fullyEligible, hasCurrentAgreementAcceptance: false }, TODAY)
    expect(result.eligible).toBe(false)
    expect(result.reasons).toContain('no_current_agreement_acceptance')
  })

  it('B/C: superseded version or hash mismatch collapse to no-current-acceptance (id+version+hash checked together) → refused', () => {
    // The 0051/0056 SQL verifies id AND version AND sha256(current body) in
    // one EXISTS — an obsolete version or a hash mismatch both make
    // hasCurrentAgreementAcceptance false. The live suite exercises the two
    // states separately against the database.
    const result = evaluatePractitionerEligibility({ ...fullyEligible, hasCurrentAgreementAcceptance: false }, TODAY)
    expect(result.eligible).toBe(false)
  })

  it('D: unverified practitioner (capture without verification) → refused', () => {
    const result = evaluatePractitionerEligibility({ ...fullyEligible, credentialsVerificationStatus: 'unverified' }, TODAY)
    expect(result.eligible).toBe(false)
    expect(result.reasons).toContain('credentials_not_verified')
  })

  it('E: EXPIRED required indemnity → refused (hard control, not a warning)', () => {
    const expired = evaluatePractitionerEligibility({ ...fullyEligible, insuranceExpiry: '2026-09-18' }, TODAY)
    expect(expired.eligible).toBe(false)
    expect(expired.reasons).toEqual(['indemnity_expired'])
    const missing = evaluatePractitionerEligibility({ ...fullyEligible, insuranceExpiry: null }, TODAY)
    expect(missing.reasons).toEqual(['indemnity_missing'])
    // Not required (admin-recorded exemption) passes without indemnity.
    expect(evaluatePractitionerEligibility({ ...fullyEligible, indemnityRequired: false, insuranceExpiry: null }, TODAY).eligible).toBe(true)
  })

  it('lifecycle, class, registration, DBS and scope each refuse independently', () => {
    expect(evaluatePractitionerEligibility({ ...fullyEligible, status: 'approved' }, TODAY).reasons).toContain('practitioner_not_active')
    expect(evaluatePractitionerEligibility({ ...fullyEligible, status: 'suspended' }, TODAY).reasons).toContain('practitioner_not_active')
    expect(evaluatePractitionerEligibility({ ...fullyEligible, category: null }, TODAY).reasons).toContain('practitioner_class_not_set')
    expect(evaluatePractitionerEligibility({ ...fullyEligible, registrationStatus: 'lapsed' }, TODAY).reasons).toContain('registration_not_current')
    expect(evaluatePractitionerEligibility({ ...fullyEligible, dbsStatus: 'pending' }, TODAY).reasons).toContain('dbs_outstanding')
    expect(evaluatePractitionerEligibility({ ...fullyEligible, dbsStatus: 'flagged' }, TODAY).reasons).toContain('dbs_outstanding')
    expect(evaluatePractitionerEligibility({ ...fullyEligible, scopeStatus: 'submitted' }, TODAY).reasons).toContain('scope_not_approved')
    // NI Verified Practitioner (unregistered) is not failed for registration:
    const niVerified = evaluatePractitionerEligibility({ ...fullyEligible, category: 'unregistered', registrationNumber: null, registrationBody: null, registrationStatus: 'not_applicable' }, TODAY)
    expect(niVerified.eligible).toBe(true)
    expect(evaluatePractitionerEligibility({ ...fullyEligible, exists: false }, TODAY).reasons).toEqual(['practitioner_not_found'])
  })
})

// ═══ ARMED LIVE SUITE — the authoritative DB gate (self-skips pre-0056) ═══════

const HAVE_DB = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY

describe.skipIf(!HAVE_DB)('Sprint 4 — AUTHORITATIVE DB gate (armed once 0056 is applied)', () => {
  const admin = HAVE_DB
    ? createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    : (null as never)
  let gateInstalled = false
  let pract: Awaited<ReturnType<typeof createTestUser>> | null = null
  let member: Awaited<ReturnType<typeof createTestUser>> | null = null
  let caseId: string | null = null
  const cleanup: { table: string; id: string }[] = []

  beforeAll(async () => {
    if (!HAVE_DB) return
    const probe = await checkAssignmentEligibility(admin, '00000000-0000-0000-0000-000000000000')
    gateInstalled = probe.gateInstalled
    if (!gateInstalled) return // 0056 not applied yet — every test below self-skips

    pract = await createTestUser(admin, 's4-elig-pract')
    member = await createTestUser(admin, 's4-elig-member')
    await admin.from('practitioners').insert({
      id: pract.id, display_name: `S4 Synthetic ${pract.email}`, status: 'active', is_test_data: true,
    } as never)
    const { data: c } = await admin.from('client_cases').insert({ client_id: member.id } as never).select('id').single()
    caseId = (c as { id: string } | null)?.id ?? null
    if (caseId) cleanup.push({ table: 'client_cases', id: caseId })
  }, 60_000)

  afterAll(async () => {
    if (!HAVE_DB || !gateInstalled) return
    await admin.from('case_practitioner_work').delete().eq('practitioner_id', pract!.id)
    for (const row of cleanup.reverse()) await admin.from(row.table as never).delete().eq('id', row.id)
    await admin.from('practitioner_agreement_acceptances').delete().eq('practitioner_id', pract!.id)
    await admin.from('practitioners').delete().eq('id', pract!.id)
    if (pract) await deleteTestUser(admin, pract.id)
    if (member) await deleteTestUser(admin, member.id)
  }, 60_000)

  async function tryAssign(): Promise<{ ok: boolean; message: string }> {
    const { error } = await admin.from('case_practitioner_work').insert({
      case_id: caseId!, practitioner_id: pract!.id, work_type: 'case_review', assigned_by: pract!.id,
    } as never)
    return { ok: !error, message: error?.message ?? '' }
  }

  it('A/D: fresh synthetic practitioner (no agreement, unverified) → INSERT REFUSED by the trigger', async (ctx) => {
    if (!gateInstalled) return ctx.skip()
    const result = await tryAssign()
    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/practitioner not assignable/)
    expect(result.message).toMatch(/no_current_agreement_acceptance|credentials_not_verified/)
  })

  it('E: EXPIRED indemnity refused even when everything else passes (closure-gate proof)', async (ctx) => {
    if (!gateInstalled) return ctx.skip()
    // Make the synthetic practitioner eligible on every axis EXCEPT indemnity.
    await admin.from('practitioners').update({
      category: 'unregistered', credentials_verification_status: 'verified',
      credentials_verified_by: pract!.id, credentials_verified_at: new Date().toISOString(),
      dbs_status: 'not_required', scope_of_practice: 'Synthetic test scope', scope_status: 'approved',
      scope_approved_by: pract!.id, scope_approved_at: new Date().toISOString(),
      registration_status: 'not_applicable',
      insurance_expiry: '2020-01-01', // EXPIRED
    } as never).eq('id', pract!.id)
    // Synthetic test agreement acceptance for the current 'unregistered' agreement.
    const { data: agreement } = await admin.from('practitioner_agreements')
      .select('id, version, body').eq('category', 'unregistered').eq('is_current', true).maybeSingle()
    if (agreement) {
      const { createHash } = await import('node:crypto')
      await admin.from('practitioner_agreement_acceptances').upsert({
        practitioner_id: pract!.id, agreement_id: (agreement as { id: string }).id,
        agreement_version: (agreement as { version: string }).version,
        accepted_text_hash: createHash('sha256').update((agreement as { body: string }).body).digest('hex'),
      } as never, { onConflict: 'practitioner_id,agreement_id' } as never)
    }
    const result = await tryAssign()
    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/indemnity_expired/)
  })

  it('B: acceptance of a SUPERSEDED version refused', async (ctx) => {
    if (!gateInstalled) return ctx.skip()
    await admin.from('practitioners').update({ insurance_expiry: '2030-01-01' } as never).eq('id', pract!.id)
    // Corrupt the recorded acceptance version → id matches, version does not.
    await admin.from('practitioner_agreement_acceptances')
      .update({ agreement_version: 'obsolete-version-0' } as never).eq('practitioner_id', pract!.id)
    const result = await tryAssign()
    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/no_current_agreement_acceptance/)
  })

  it('C: acceptance with a WRONG TEXT HASH refused', async (ctx) => {
    if (!gateInstalled) return ctx.skip()
    const { data: agreement } = await admin.from('practitioner_agreements')
      .select('version').eq('category', 'unregistered').eq('is_current', true).maybeSingle()
    await admin.from('practitioner_agreement_acceptances').update({
      agreement_version: (agreement as { version: string } | null)?.version ?? 'v',
      accepted_text_hash: 'not-the-real-hash',
    } as never).eq('practitioner_id', pract!.id)
    const result = await tryAssign()
    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/no_current_agreement_acceptance/)
  })

  it('F: fully eligible synthetic practitioner → assignment SUCCEEDS (then cleaned up)', async (ctx) => {
    if (!gateInstalled) return ctx.skip()
    const { data: agreement } = await admin.from('practitioner_agreements')
      .select('id, version, body').eq('category', 'unregistered').eq('is_current', true).maybeSingle()
    if (!agreement) return ctx.skip() // no seeded agreement to accept — cannot construct F
    const { createHash } = await import('node:crypto')
    await admin.from('practitioner_agreement_acceptances').update({
      agreement_version: (agreement as { version: string }).version,
      accepted_text_hash: createHash('sha256').update((agreement as { body: string }).body).digest('hex'),
    } as never).eq('practitioner_id', pract!.id)
    const eligibility = await checkAssignmentEligibility(admin, pract!.id)
    expect(eligibility.eligible).toBe(true)
    const result = await tryAssign()
    expect(result.ok).toBe(true)
  })
})
