'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'
import { sendEmail, applicationDecisionEmail } from '@natural-intelligence/db'

async function requireAdmin() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') throw new Error('Forbidden')

  return { adminClient }
}

export async function activatePractitioner(practitionerId: string) {
  const { adminClient } = await requireAdmin()

  await adminClient
    .from('practitioners')
    .update({
      lifecycle_status: 'active',
      is_active:        true,
      activated_at:     new Date().toISOString(),
      paused_at:        null,
      paused_reason:    null,
      updated_at:       new Date().toISOString(),
    })
    .eq('id', practitionerId)

  revalidatePath('/practitioners')
  revalidatePath(`/practitioners/${practitionerId}`)
}

export async function pausePractitioner(practitionerId: string, reason: string) {
  const { adminClient } = await requireAdmin()

  await adminClient
    .from('practitioners')
    .update({
      lifecycle_status: 'paused',
      is_active:        false,
      is_directory_ready: false,
      paused_at:        new Date().toISOString(),
      paused_reason:    reason || null,
      updated_at:       new Date().toISOString(),
    })
    .eq('id', practitionerId)

  revalidatePath('/practitioners')
  revalidatePath(`/practitioners/${practitionerId}`)
}

export async function resendApprovalEmail(practitionerId: string) {
  const { adminClient } = await requireAdmin()

  // Get practitioner + linked profile email via auth.users
  const { data: practitioner } = await adminClient
    .from('practitioners')
    .select('profile_id, profiles!practitioners_profile_id_fkey(full_name)')
    .eq('id', practitionerId)
    .single()

  if (!practitioner?.profile_id) throw new Error('No profile linked to this practitioner')

  // Use Supabase admin to get auth user email
  const { data: { user: authUser } } = await adminClient.auth.admin.getUserById(
    practitioner.profile_id
  )
  const email    = authUser?.email
  const fullName = (practitioner as any).profiles?.full_name ?? 'Practitioner'

  if (!email) throw new Error('No email found for this practitioner')

  await sendEmail(applicationDecisionEmail({
    to:       email,
    fullName,
    decision: 'approved',
  }))

  revalidatePath(`/practitioners/${practitionerId}`)
}
