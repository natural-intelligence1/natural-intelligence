'use server'

// Sprint 3 — practitioner agreement acceptance (post-approval gate).
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@natural-intelligence/db'
import { acceptAgreement } from '@natural-intelligence/db/practitioners'

export async function acceptCurrentAgreement(formData: FormData): Promise<void> {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  const agreementId = String(formData.get('agreement_id') ?? '')
  const agreementVersion = String(formData.get('agreement_version') ?? '')
  if (!agreementId || !agreementVersion) throw new Error('Missing agreement reference')

  // RLS: a practitioner may only insert their own acceptance row.
  await acceptAgreement(supabase, {
    practitionerId: user.id,
    agreementId,
    agreementVersion,
  })
  redirect('/cases')
}
