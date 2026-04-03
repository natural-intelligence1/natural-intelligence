'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'

export async function saveAdminNotes(requestId: string, notes: string) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  const adminClient = createAdminClient()
  await adminClient
    .from('support_requests')
    .update({ admin_notes: notes })
    .eq('id', requestId)

  revalidatePath(`/support/${requestId}`)
}

export async function updateSupportStatus(requestId: string, status: string) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  const adminClient = createAdminClient()
  await adminClient
    .from('support_requests')
    .update({ status, assigned_to: user.id })
    .eq('id', requestId)

  revalidatePath('/support')
  revalidatePath(`/support/${requestId}`)
}
