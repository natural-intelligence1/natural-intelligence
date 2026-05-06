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
      status:           'active',
      suspended_at:     null,
      suspension_reason: null,
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
      status:            'suspended',
      is_directory_ready: false,
      suspended_at:      new Date().toISOString(),
      suspension_reason: reason || null,
      updated_at:        new Date().toISOString(),
    })
    .eq('id', practitionerId)

  revalidatePath('/practitioners')
  revalidatePath(`/practitioners/${practitionerId}`)
}

export async function toggleDirectoryReady(practitionerId: string, ready: boolean) {
  const { adminClient } = await requireAdmin()

  await adminClient
    .from('practitioners')
    .update({
      is_directory_ready: ready,
      updated_at:         new Date().toISOString(),
    })
    .eq('id', practitionerId)

  revalidatePath('/practitioners')
  revalidatePath(`/practitioners/${practitionerId}`)
}

export async function resendApprovalEmail(practitionerId: string) {
  const { adminClient } = await requireAdmin()

  // practitioners.id IS auth.users.id — fetch display_name and email directly
  const { data: practitioner } = await adminClient
    .from('practitioners')
    .select('id, display_name')
    .eq('id', practitionerId)
    .single()

  if (!practitioner?.id) throw new Error('Practitioner not found')

  const { data: { user: authUser } } = await adminClient.auth.admin.getUserById(practitioner.id)
  const email    = authUser?.email
  const fullName = practitioner.display_name ?? 'Practitioner'

  if (!email) throw new Error('No email found for this practitioner')

  await sendEmail(applicationDecisionEmail({
    to:       email,
    fullName,
    decision: 'approved',
  }))

  revalidatePath(`/practitioners/${practitionerId}`)
}
