'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'

export async function savePractitionerCoreProfile(
  practitionerId: string,
  payload: {
    tagline:             string
    bio:                 string
    primary_profession:  string
    delivery_mode:       string
    accepts_referrals:   boolean
    area_tags:           string[]
  }
) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  // Verify ownership
  const adminClient = createAdminClient()
  const { data: practitioner } = await adminClient
    .from('practitioners')
    .select('id, profile_id')
    .eq('id', practitionerId)
    .single()

  if (!practitioner || practitioner.profile_id !== user.id) {
    throw new Error('Forbidden')
  }

  // Validate lengths
  if (payload.tagline.length > 160) {
    throw new Error('Tagline must be 160 characters or fewer.')
  }
  if (payload.bio.length > 800) {
    throw new Error('Bio must be 800 characters or fewer.')
  }

  // primary_professions is stored as an array — wrap the single text value
  const primaryProfessions = payload.primary_profession.trim()
    ? [payload.primary_profession.trim()]
    : []

  const { error } = await adminClient.from('practitioners').update({
    tagline:             payload.tagline.trim()   || null,
    delivery_mode:       payload.delivery_mode    || null,
    accepts_referrals:   payload.accepts_referrals,
    primary_professions: primaryProfessions,
    area_tags:           payload.area_tags,
    bio:                 payload.bio.trim()       || null,
    updated_at:          new Date().toISOString(),
  }).eq('id', practitionerId)

  if (error) throw new Error(error.message)

  // Sync bio to profiles table (keeps the two in sync)
  await adminClient
    .from('profiles')
    .update({ bio: payload.bio.trim() || null })
    .eq('id', user.id)

  revalidatePath('/dashboard/practitioner')
  revalidatePath('/dashboard/practitioner/profile')
  revalidatePath(`/directory/${practitionerId}`)
}
