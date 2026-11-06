'use server'

import {
  createServerSupabaseClient,
  getFoundationalConsentState, recordFoundationalReaffirmation,
  CONSENT_TEXT_VERSION,
} from '@natural-intelligence/db'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

/**
 * Records the member actively accepting the CURRENT foundational consent
 * version, now.
 *
 * No historical acceptance is manufactured anywhere in this path: the row's
 * consented_at is this moment, not the account's creation date. An account
 * that was created before the signup-consent repair simply has a consent
 * record dated when they actually affirmed, and the gap is visible.
 */
export async function affirmFoundationalConsents(formData: FormData) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  if (formData.get('accept') !== '1') {
    redirect('/dashboard?consent=incomplete')
  }

  // Re-read rather than trusting the rendered state, and only ever write the
  // purposes that are genuinely missing.
  const state = await getFoundationalConsentState(supabase, user.id)

  if (state.unreadable) {
    console.error(JSON.stringify({
      event: 'consent.reaffirmation.state_unreadable', profile_id: user.id,
    }))
    redirect('/dashboard?consent=failed')
  }

  if (state.satisfied) {
    revalidatePath('/dashboard')
    redirect('/dashboard')
  }

  const result = await recordFoundationalReaffirmation(supabase, user, state.missing)

  console.log(JSON.stringify({
    event:           'consent.reaffirmation',
    profile_id:      user.id,
    purposes:        state.missing,
    consent_version: CONSENT_TEXT_VERSION,
    ok:              result.ok,
    written:         result.written,
    detail:          result.detail,
  }))

  if (!result.ok) redirect('/dashboard?consent=failed')

  revalidatePath('/dashboard')
  redirect('/dashboard')
}
