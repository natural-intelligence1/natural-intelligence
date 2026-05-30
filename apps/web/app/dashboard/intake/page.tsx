import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@natural-intelligence/db'
import { IntakeForm } from './IntakeForm'

export const metadata: Metadata = {
  title: 'Health intake',
  description: 'Complete your health intake to receive a personalised health synopsis.',
}

export default async function IntakePage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: existing } = await supabase
    .from('intake_responses')
    .select('*')
    .eq('member_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Decision 4 — read biological_sex from user_personalisation (PS.1 substrate)
  // so the intake can pre-fill the answer if it's already known and gate the
  // menstrual section correctly. user_personalisation is not in the generated
  // Database types; piggy-back on the 'profiles' table name (same trick the
  // F2 view uses elsewhere) and cast the row shape on extraction.
  const personalisationQuery = await supabase
    .from('user_personalisation' as 'profiles')
    .select('biological_sex')
    .eq('id' as 'id', user.id)
    .maybeSingle()
  const personalisation = personalisationQuery.data as unknown as
    { biological_sex: 'male' | 'female' | null } | null
  const biologicalSex = personalisation?.biological_sex ?? null

  return (
    <IntakeForm
      existing={existing as Record<string, unknown> | null}
      memberId={user.id}
      initialBiologicalSex={biologicalSex}
    />
  )
}
