// ─── Test helper: make a synthetic practitioner 0056-eligible ─────────────────
// Sprint 4's BEFORE INSERT triggers refuse work-item/link rows for ineligible
// practitioners, so every fixture that inserts assignment rows must first make
// its synthetic practitioner pass the authoritative gate. Seeds a clearly
// SYNTHETIC current agreement for 'unregistered' only when none exists, and
// returns a cleanup function that removes everything it created.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any>

export async function makePractitionerAssignable(
  admin: AnyClient, practitionerId: string,
): Promise<() => Promise<void>> {
  let syntheticAgreementId: string | null = null

  const { data: existing } = await (admin as AnyClient)
    .from('practitioner_agreements')
    .select('id, version, body')
    .eq('category', 'unregistered')
    .eq('is_current', true)
    .maybeSingle()

  let agreement = existing as { id: string; version: string; body: string } | null
  if (!agreement) {
    const { data: created, error } = await (admin as AnyClient)
      .from('practitioner_agreements')
      .insert({
        category: 'unregistered', version: `synthetic-test-${Date.now()}`,
        title: 'SYNTHETIC TEST AGREEMENT — test fixtures only (not a real agreement)',
        body: 'SYNTHETIC TEST BODY — exists only while a test suite runs; never shown to any practitioner.',
        is_current: true,
      })
      .select('id, version, body')
      .single()
    if (error) throw new Error(`makePractitionerAssignable: agreement seed failed [${error.message}]`)
    agreement = created as { id: string; version: string; body: string }
    syntheticAgreementId = agreement.id
  }

  const { error: updErr } = await (admin as AnyClient)
    .from('practitioners')
    .update({
      status: 'active', is_active: true, category: 'unregistered',
      credentials_verification_status: 'verified',
      credentials_verified_by: practitionerId,
      credentials_verified_at: new Date().toISOString(),
      dbs_status: 'not_required', registration_status: 'not_applicable',
      insurance_expiry: '2030-01-01', indemnity_required: true,
      scope_of_practice: 'Synthetic test scope', scope_status: 'approved',
      scope_approved_by: practitionerId, scope_approved_at: new Date().toISOString(),
    })
    .eq('id', practitionerId)
  if (updErr) throw new Error(`makePractitionerAssignable: practitioner update failed [${updErr.message}]`)

  const { error: accErr } = await (admin as AnyClient)
    .from('practitioner_agreement_acceptances')
    .upsert({
      practitioner_id: practitionerId,
      agreement_id: agreement.id,
      agreement_version: agreement.version,
      accepted_text_hash: createHash('sha256').update(agreement.body).digest('hex'),
    }, { onConflict: 'practitioner_id,agreement_id' })
  if (accErr) throw new Error(`makePractitionerAssignable: acceptance seed failed [${accErr.message}]`)

  return async () => {
    await (admin as AnyClient).from('practitioner_agreement_acceptances')
      .delete().eq('practitioner_id', practitionerId)
    if (syntheticAgreementId) {
      await (admin as AnyClient).from('practitioner_agreements')
        .delete().eq('id', syntheticAgreementId)
    }
  }
}
