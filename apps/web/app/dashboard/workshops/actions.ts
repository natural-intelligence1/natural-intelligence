'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@natural-intelligence/db'

export async function cancelRegistration(registrationId: string): Promise<{ error?: string }> {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('event_registrations')
    .delete()
    .eq('id', registrationId)
    .eq('member_id', user.id) // safety: only delete own registrations

  if (error) return { error: error.message }

  revalidatePath('/dashboard/workshops')
  revalidatePath('/dashboard')
  return {}
}
