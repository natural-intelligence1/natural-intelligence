'use server'

// Sprint 3 — practitioner agreement acceptance (post-approval gate).
// Second-review model: practitioners have NO insert access to the acceptance
// table at all. This action simply invokes the SECURITY DEFINER RPC
// accept_current_agreement (migration 0051), which — entirely server-side in
// SQL — resolves the caller's category, finds the current agreement, rejects
// a stale displayed agreement, and records the DB-derived version plus a
// sha256 hash of the exact text accepted. No client input is authority.
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@natural-intelligence/db'
import { acceptCurrentAgreementViaRpc } from '@natural-intelligence/db/practitioners'

export async function acceptCurrentAgreement(formData: FormData): Promise<void> {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  // Display cross-check only: the RPC rejects it if it is no longer current.
  const displayedId = String(formData.get('agreement_id') ?? '') || undefined

  await acceptCurrentAgreementViaRpc(supabase, displayedId)
  redirect('/cases')
}
