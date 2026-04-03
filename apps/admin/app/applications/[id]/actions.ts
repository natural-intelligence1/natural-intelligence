'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'
import { sendEmail, applicationDecisionEmail } from '@natural-intelligence/db'

export async function approveApplication(applicationId: string, notes: string) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  const adminClient = createAdminClient()

  const { data: app } = await adminClient
    .from('practitioner_applications')
    .select('full_name, email')
    .eq('id', applicationId)
    .single()

  await adminClient
    .from('practitioner_applications')
    .update({
      status: 'approved',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      reviewer_notes: notes || null,
    })
    .eq('id', applicationId)

  if (app?.email && app?.full_name) {
    try {
      await sendEmail(applicationDecisionEmail({
        to: app.email,
        fullName: app.full_name,
        decision: 'approved',
        notes: notes || undefined,
      }))
    } catch (e) {
      console.error('[approveApplication] Email failed:', e)
    }
  }

  revalidatePath('/applications')
  revalidatePath(`/applications/${applicationId}`)
}

export async function rejectApplication(applicationId: string, notes: string) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  const adminClient = createAdminClient()

  const { data: app } = await adminClient
    .from('practitioner_applications')
    .select('full_name, email')
    .eq('id', applicationId)
    .single()

  await adminClient
    .from('practitioner_applications')
    .update({
      status: 'rejected',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      reviewer_notes: notes || null,
    })
    .eq('id', applicationId)

  if (app?.email && app?.full_name) {
    try {
      await sendEmail(applicationDecisionEmail({
        to: app.email,
        fullName: app.full_name,
        decision: 'rejected',
        notes: notes || undefined,
      }))
    } catch (e) {
      console.error('[rejectApplication] Email failed:', e)
    }
  }

  revalidatePath('/applications')
  revalidatePath(`/applications/${applicationId}`)
}

export async function markReviewing(applicationId: string) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  const adminClient = createAdminClient()

  await adminClient
    .from('practitioner_applications')
    .update({ status: 'reviewing' })
    .eq('id', applicationId)

  revalidatePath('/applications')
  revalidatePath(`/applications/${applicationId}`)
}
