'use server'

// Sprint 3 — member privacy & consent server actions.
// Manual-fulfilment model: requests land in client_rights_requests for the
// admin queue. No automated deletion/export. Wording notes on the page are
// DRAFT — requires solicitor review before real-client use.

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@natural-intelligence/db'
import { createRightsRequest, isRightsRequestType } from '@natural-intelligence/db'

export async function submitRightsRequest(formData: FormData): Promise<void> {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  const requestType = String(formData.get('request_type') ?? '')
  const details = String(formData.get('details') ?? '').slice(0, 2000)
  if (!isRightsRequestType(requestType)) throw new Error('Unknown request type')

  // RLS: member may only insert rows with their own member_id.
  await createRightsRequest(supabase, {
    memberId: user.id,
    requestType,
    details: details || undefined,
  })
  revalidatePath('/dashboard/privacy')
}
