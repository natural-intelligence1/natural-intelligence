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

  return <IntakeForm existing={existing as any} memberId={user.id} />
}
