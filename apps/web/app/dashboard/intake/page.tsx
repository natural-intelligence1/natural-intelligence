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

  // Decision 4 — read biological_sex from user_personalisation (PS.1 substrate).
  // Sprint B Phase 1 — also read religion + religious_content_preference so the
  // intake can pre-fill the new Chapter 1 questions if the user already answered
  // them (e.g. resume case). Cast trick: piggy-back on 'profiles' table name to
  // bypass generated DB types not knowing about user_personalisation.
  const personalisationQuery = await supabase
    .from('user_personalisation' as 'profiles')
    .select('biological_sex, religion, religious_content_preference')
    .eq('id' as 'id', user.id)
    .maybeSingle()
  const personalisation = personalisationQuery.data as unknown as {
    biological_sex:                'male' | 'female' | null
    religion:                      string | null
    religious_content_preference:  'show' | 'hide' | null
  } | null
  const biologicalSex             = personalisation?.biological_sex ?? null
  const religion                  = (personalisation?.religion ?? 'prefer_not_to_say') as
    'muslim' | 'christian' | 'jewish' | 'hindu' | 'buddhist' | 'sikh' | 'secular' | 'prefer_not_to_say' | 'other'
  const religiousContentPreference = (personalisation?.religious_content_preference ?? 'hide') as 'show' | 'hide'

  return (
    <IntakeForm
      existing={existing as Record<string, unknown> | null}
      memberId={user.id}
      initialBiologicalSex={biologicalSex}
      initialReligion={religion}
      initialReligiousContentPreference={religiousContentPreference}
    />
  )
}
