'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'
import { calcCompleteness, isProfileComplete } from '@/lib/completeness'

export async function savePractitionerProfile(
  practitionerId: string,
  payload: {
    practice_name?:          string
    tagline?:                string
    bio?:                    string
    delivery_mode?:          string
    open_to_collaboration?:  boolean
    collaboration_types?:    string[]
    referral_contact_method?: string
    instagram_url?:          string
    other_social_urls?:      string
    support_needs?:          string
  }
) {
  const supabase     = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  // Verify ownership via admin client
  const adminClient = createAdminClient()
  const { data: practitioner } = await adminClient
    .from('practitioners')
    .select('id, profile_id, city, country, primary_professions, area_tags')
    .eq('id', practitionerId)
    .single()

  if (!practitioner || practitioner.profile_id !== user.id) {
    throw new Error('Forbidden')
  }

  // Validate tagline and bio lengths
  if (payload.tagline && payload.tagline.length > 200) {
    throw new Error('Tagline must be under 200 characters.')
  }
  if (payload.bio && payload.bio.length > 2000) {
    throw new Error('Bio must be under 2000 characters.')
  }

  // Validate URL fields
  if (payload.instagram_url) {
    try { new URL(payload.instagram_url) } catch {
      throw new Error('Please enter a valid Instagram URL.')
    }
  }

  // Update practitioners row
  const { error } = await adminClient
    .from('practitioners')
    .update({
      practice_name:           payload.practice_name           ?? null,
      tagline:                 payload.tagline?.trim()         ?? null,
      delivery_mode:           payload.delivery_mode           ?? null,
      open_to_collaboration:   payload.open_to_collaboration   ?? false,
      collaboration_types:     payload.collaboration_types     ?? [],
      referral_contact_method: payload.referral_contact_method ?? null,
      instagram_url:           payload.instagram_url?.trim()  ?? null,
      other_social_urls:       payload.other_social_urls?.trim() ?? null,
      support_needs:           payload.support_needs           ?? null,
      updated_at:              new Date().toISOString(),
    })
    .eq('id', practitionerId)

  if (error) throw new Error(error.message)

  // Sync bio to profiles table
  if (payload.bio !== undefined) {
    await adminClient
      .from('profiles')
      .update({ bio: payload.bio?.trim() || null })
      .eq('id', user.id)
  }

  // Recalculate profile completeness
  const pct = calcCompleteness({
    tagline:             payload.tagline    ?? null,
    bio:                 payload.bio        ?? null,
    primary_professions: practitioner.primary_professions ?? [],
    area_tags:           practitioner.area_tags           ?? [],
    delivery_mode:       payload.delivery_mode ?? null,
    city:                practitioner.city     ?? null,
    country:             practitioner.country  ?? null,
  })
  const ready = isProfileComplete({
    tagline:             payload.tagline    ?? null,
    bio:                 payload.bio        ?? null,
    primary_professions: practitioner.primary_professions ?? [],
    area_tags:           practitioner.area_tags           ?? [],
    delivery_mode:       payload.delivery_mode ?? null,
    city:                practitioner.city     ?? null,
    country:             practitioner.country  ?? null,
  })

  await adminClient
    .from('practitioners')
    .update({
      profile_completeness_pct: pct,
      is_directory_ready:       ready,
      // Promote to active if complete and currently pending profile
    })
    .eq('id', practitionerId)

  // If now complete, check if we should auto-promote lifecycle_status
  if (ready) {
    const { data: current } = await adminClient
      .from('practitioners')
      .select('lifecycle_status')
      .eq('id', practitionerId)
      .single()

    if (current?.lifecycle_status === 'approved_pending_profile') {
      // Don't auto-activate — admin must manually activate.
      // Just set is_directory_ready = true so admin can see it's ready to activate.
    }
  }

  revalidatePath('/dashboard/profile')
  revalidatePath('/dashboard')
}
