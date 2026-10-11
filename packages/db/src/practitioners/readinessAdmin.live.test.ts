// Minimum practitioner-readiness admin — LIVE database writes.
//
// SYNTHETIC DATA ONLY, tagged RA60-TEST, self-cleaning. The five real
// practitioners are never read or written. Skips without DB env.
//
// What this proves: the three previously-missing admin writes (class,
// indemnity, registration) plus the two promoted ones (credential
// verification, scope approval) move a practitioner through the EXISTING
// eligibility engine, and the verdict always comes from
// practitioner_assignment_eligibility() rather than any second calculation.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import { createTestUser, deleteTestUser } from './__test-helpers__/createTestUser'
import {
  setPractitionerClass, setIndemnityEvidence, setRegistrationDetails,
  setCredentialsVerification, setScopeApproval, describeReadiness,
} from './credentialing'

const HAVE_DB = !!process.env.NEXT_PUBLIC_SUPABASE_URL
function mkAdmin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}
const TAG = 'RA60-TEST'
const FIELDS = 'category, credentials_verification_status, indemnity_required, insurance_expiry, registration_body, registration_number, registration_status, dbs_status, scope_status'

describe.skipIf(!HAVE_DB)('practitioner readiness admin — live writes', () => {
  let admin: ReturnType<typeof mkAdmin>
  let pracId = ''
  let actorId = ''
  const users: string[] = []
  let agreementId: string | null = null

  /** The authoritative verdict. Never recomputed in a test. */
  const eligibility = async () => {
    const { data } = await admin.rpc(
      'practitioner_assignment_eligibility', { p_practitioner_id: pracId } as never)
    const row = (Array.isArray(data) ? data[0] : data) as { eligible: boolean; reasons: string[] }
    return row ?? { eligible: false, reasons: ['no verdict'] }
  }

  const readFields = async () => {
    const { data } = await admin.from('practitioners').select(FIELDS).eq('id', pracId).single()
    return data as unknown as Parameters<typeof describeReadiness>[0]
  }

  beforeAll(async () => {
    admin = mkAdmin()
    const p = await createTestUser(admin, 'ra60-prac'); users.push(p.id); pracId = p.id
    const a = await createTestUser(admin, 'ra60-actor'); users.push(a.id); actorId = a.id
    const { error } = await admin.from('practitioners').insert({
      id: pracId, display_name: `${TAG} Practitioner`, status: 'active', is_active: true,
      specialisations: [], credentials: [], primary_professions: [], area_tags: [],
      client_types: [], collaboration_types: [],
      accepts_referrals: false, open_to_collaboration: false,
      practitioner_tier: 'standard', display_order: 0, profile_completeness_pct: 0,
      is_directory_ready: false, is_test_data: true, trust_level: 'vetted',
      credentials_verification_status: 'unverified', indemnity_required: true,
      scope_status: 'none',
    } as never)
    if (error) throw error
  })

  afterAll(async () => {
    if (!admin) return
    await admin.from('practitioner_agreement_acceptances').delete().eq('practitioner_id', pracId)
    if (agreementId) await admin.from('practitioner_agreements').delete().eq('id', agreementId)
    await admin.from('practitioners').delete().in('id', users)
    for (const id of users) await deleteTestUser(admin, id)
  })

  it('A. starts ineligible, and the reasons come from the DB function', async () => {
    const v = await eligibility()
    expect(v.eligible).toBe(false)
    expect(v.reasons).toContain('practitioner_class_not_set')
    expect(v.reasons).toContain('credentials_not_verified')
    expect(v.reasons).toContain('indemnity_missing')
    expect(v.reasons).toContain('scope_not_approved')
  })

  it('B. class saves correctly — and REVEALS two previously masked conditions', async () => {
    const before = await eligibility()
    expect(before.reasons).not.toContain('no_current_agreement_acceptance')
    expect(before.reasons).not.toContain('registration_not_current')

    await setPractitionerClass(admin, { practitionerId: pracId, category: 'voluntary_registered' })

    const { data } = await admin.from('practitioners').select('category').eq('id', pracId).single()
    expect(data!.category).toBe('voluntary_registered')

    const after = await eligibility()
    // Setting the class does not clear a blocker; it uncovers two.
    expect(after.reasons).not.toContain('practitioner_class_not_set')
    expect(after.reasons).toContain('no_current_agreement_acceptance')
    expect(after.reasons).toContain('registration_not_current')
  })

  it('C. indemnity evidence and expiry save correctly', async () => {
    const future = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10)
    await setIndemnityEvidence(admin, { practitionerId: pracId, required: true, expiry: future })

    const { data } = await admin.from('practitioners')
      .select('indemnity_required, insurance_expiry').eq('id', pracId).single()
    expect(data!.insurance_expiry).toBe(future)

    expect((await eligibility()).reasons).not.toContain('indemnity_missing')
  })

  it('D. an expired indemnity is reported as expired, not missing', async () => {
    const past = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    await setIndemnityEvidence(admin, { practitionerId: pracId, required: true, expiry: past })

    const v = await eligibility()
    expect(v.reasons).toContain('indemnity_expired')
    expect(v.reasons).not.toContain('indemnity_missing')

    const fields = describeReadiness(await readFields(), v.reasons)
    const ind = fields.find((f) => f.field === 'indemnity')!
    expect(ind.state).toBe('expired')
    expect(ind.blocking).toBe(true)

    const future = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10)
    await setIndemnityEvidence(admin, { practitionerId: pracId, required: true, expiry: future })
  })

  it('E. registration saves correctly', async () => {
    await setRegistrationDetails(admin, {
      practitionerId: pracId, registrationBody: `${TAG} Register`,
      registrationNumber: `${TAG}-12345`, registrationStatus: 'registered',
    })
    const { data } = await admin.from('practitioners')
      .select('registration_body, registration_number, registration_status')
      .eq('id', pracId).single()
    expect(data!.registration_number).toBe(`${TAG}-12345`)
    expect(data!.registration_status).toBe('registered')

    expect((await eligibility()).reasons).not.toContain('registration_not_current')
  })

  it('F. credential verification works and records the actor', async () => {
    await setCredentialsVerification(admin,
      { practitionerId: pracId, status: 'verified', actorId })
    const { data } = await admin.from('practitioners')
      .select('credentials_verification_status, credentials_verified_by, credentials_verified_at')
      .eq('id', pracId).single()
    expect(data!.credentials_verification_status).toBe('verified')
    expect(data!.credentials_verified_by).toBe(actorId)
    expect(data!.credentials_verified_at).not.toBeNull()

    expect((await eligibility()).reasons).not.toContain('credentials_not_verified')
  })

  it('G. scope approval works and records the actor', async () => {
    await setScopeApproval(admin, { practitionerId: pracId, status: 'approved', actorId })
    const { data } = await admin.from('practitioners')
      .select('scope_status, scope_approved_by, scope_approved_at').eq('id', pracId).single()
    expect(data!.scope_status).toBe('approved')
    expect(data!.scope_approved_by).toBe(actorId)

    expect((await eligibility()).reasons).not.toContain('scope_not_approved')
  })

  it('H. agreement acceptance is the LAST remaining blocker, and is visible', async () => {
    const v = await eligibility()
    expect(v.eligible).toBe(false)
    expect(v.reasons).toEqual(['no_current_agreement_acceptance'])

    const fields = describeReadiness(await readFields(), v.reasons)
    const agreement = fields.find((f) => f.field === 'agreement')!
    expect(agreement.state).toBe('missing')
    expect(agreement.blocking).toBe(true)
    // Everything else now reads clear.
    expect(fields.filter((f) => f.blocking).map((f) => f.field)).toEqual(['agreement'])
  })

  it('I. accepting a current agreement makes the practitioner eligible', async () => {
    const body = `${TAG} synthetic agreement — NOT A REAL AGREEMENT`
    const { data: agr } = await admin.from('practitioner_agreements').insert({
      category: 'voluntary_registered', version: `${TAG}-1`,
      title: `${TAG} SYNTHETIC — NOT A REAL AGREEMENT`, body, is_current: true,
    } as never).select('id').single()
    agreementId = (agr as { id: string }).id

    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body))
    const hex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0')).join('')
    await admin.from('practitioner_agreement_acceptances').insert({
      practitioner_id: pracId, agreement_id: agreementId,
      agreement_version: `${TAG}-1`, accepted_text_hash: hex,
    } as never)

    const v = await eligibility()
    expect(v.reasons).toEqual([])
    expect(v.eligible).toBe(true)

    const fields = describeReadiness(await readFields(), v.reasons)
    expect(fields.filter((f) => f.blocking)).toHaveLength(0)
  })

  it('J. eligibility refreshes from the DB — the UI holds no cached verdict', async () => {
    expect((await eligibility()).eligible).toBe(true)

    // Revoke scope out-of-band; the next read must reflect it immediately.
    await setScopeApproval(admin, { practitionerId: pracId, status: 'revoked', actorId })
    const after = await eligibility()
    expect(after.eligible).toBe(false)
    expect(after.reasons).toContain('scope_not_approved')

    await setScopeApproval(admin, { practitionerId: pracId, status: 'approved', actorId })
    expect((await eligibility()).eligible).toBe(true)
  })

  it('K. describeReadiness reports class-dependent fields as not applicable', async () => {
    await setPractitionerClass(admin, { practitionerId: pracId, category: 'unregistered' })
    const v = await eligibility()
    const fields = describeReadiness(await readFields(), v.reasons)
    expect(fields.find((f) => f.field === 'registration')!.state).toBe('not_applicable')

    await setPractitionerClass(admin, { practitionerId: pracId, category: 'voluntary_registered' })
  })

  it('L. the five real practitioners were not touched', async () => {
    const { data } = await admin.from('practitioners')
      .select('id, category, credentials_verification_status, scope_status')
      .not('id', 'in', `(${users.join(',')})`)
    for (const p of data ?? []) {
      expect(p.category).toBeNull()
      expect(p.credentials_verification_status).toBe('unverified')
      expect(p.scope_status).toBe('none')
    }
  })
})
