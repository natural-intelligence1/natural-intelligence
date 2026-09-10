'use server'

// Sprint 3 — admin actions for the client rights request queue.
import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'
import {
  updateRightsRequestStatus,
  type RightsRequestStatus,
} from '@natural-intelligence/db'

async function requireAdmin(): Promise<string> {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')
  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') throw new Error('Admin only')
  return user.id
}

export async function moveRequest(formData: FormData): Promise<void> {
  const adminId = await requireAdmin()
  const requestId = String(formData.get('request_id') ?? '')
  const from = String(formData.get('from') ?? '') as RightsRequestStatus
  const to = String(formData.get('to') ?? '') as RightsRequestStatus
  const note = String(formData.get('note') ?? '').slice(0, 1000)
  if (!requestId) throw new Error('Missing request id')

  await updateRightsRequestStatus(createAdminClient(), {
    requestId, from, to, handledBy: adminId, resolutionNote: note || undefined,
  })
  revalidatePath('/requests')
}
