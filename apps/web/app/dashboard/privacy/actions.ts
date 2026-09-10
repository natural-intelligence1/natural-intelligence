'use server'

// Sprint 3 — member privacy & consent server actions.
// Manual-fulfilment model: requests land in client_rights_requests for the
// admin queue. No automated deletion/export. Wording notes on the page are
// DRAFT — requires solicitor review before real-client use.

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@natural-intelligence/db'
import {
  createRightsRequest, isRightsRequestType, isConsentPurpose, withdrawConsent,
} from '@natural-intelligence/db'

export async function submitRightsRequest(formData: FormData): Promise<void> {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  const requestType = String(formData.get('request_type') ?? '')
  const details = String(formData.get('details') ?? '').slice(0, 2000)
  if (!isRightsRequestType(requestType)) throw new Error('Unknown request type')

  // Review amendment 1 — granular withdrawal: a consent_withdrawal request
  // names the specific consent purpose being withdrawn ('' = deliberate
  // "withdraw all" which is treated as a global restriction by enforcement).
  let consentType: string | undefined
  if (requestType === 'consent_withdrawal') {
    const raw = String(formData.get('consent_type') ?? '')
    if (raw && !isConsentPurpose(raw)) throw new Error('Unknown consent purpose')
    consentType = raw || undefined
  }

  // RLS: member may only insert rows with their own member_id.
  await createRightsRequest(supabase, {
    memberId: user.id,
    requestType,
    details: details || undefined,
    consentType,
  })

  // Purpose-specific withdrawal also marks the consent grant itself withdrawn
  // immediately, via the narrow append-only RPC (consent evidence is never
  // member-updatable directly). Failure here is non-fatal pre-migration; the
  // request row remains the durable record either way.
  if (requestType === 'consent_withdrawal' && consentType && isConsentPurpose(consentType)) {
    try { await withdrawConsent(supabase, consentType) } catch { /* pre-0051: request row is the record */ }
  }

  revalidatePath('/dashboard/privacy')
}
