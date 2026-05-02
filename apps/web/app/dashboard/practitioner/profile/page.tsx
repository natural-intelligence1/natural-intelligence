import { redirect } from 'next/navigation'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'
import ProfileEditClient from './ProfileEditClient'

export default async function PractitionerProfileEditPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, bio')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'practitioner') redirect('/dashboard')

  // Fetch practitioner row via admin client to avoid RLS edge cases
  const adminClient = createAdminClient()
  const { data: practitioner } = await adminClient
    .from('practitioners')
    .select('id, tagline, delivery_mode, primary_professions, area_tags, accepts_referrals, profile_completeness_pct, bio')
    .eq('profile_id', user.id)
    .maybeSingle()

  if (!practitioner) redirect('/dashboard')

  return (
    <ProfileEditClient
      practitioner={{
        id:                       practitioner.id,
        tagline:                  practitioner.tagline               ?? null,
        // bio lives on both tables — prefer practitioners.bio if set, fall back to profiles.bio
        bio:                      practitioner.bio ?? profile?.bio   ?? null,
        delivery_mode:            practitioner.delivery_mode         ?? null,
        primary_professions:      practitioner.primary_professions   ?? [],
        area_tags:                practitioner.area_tags             ?? [],
        accepts_referrals:        practitioner.accepts_referrals     ?? false,
        profile_completeness_pct: practitioner.profile_completeness_pct ?? 0,
      }}
    />
  )
}
