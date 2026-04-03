'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'

export async function createEvent(formData: FormData) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('events')
    .insert({
      title:        formData.get('title') as string,
      description:  formData.get('description') as string || null,
      event_type:   formData.get('event_type') as string,
      starts_at:    formData.get('starts_at') as string || null,
      ends_at:      formData.get('ends_at') as string || null,
      location:     formData.get('location') as string || null,
      is_online:    formData.get('is_online') === 'on',
      meeting_url:  formData.get('meeting_url') as string || null,
      max_capacity: formData.get('max_capacity') ? Number(formData.get('max_capacity')) : null,
      status:       formData.get('status') as string,
      hosted_by:    user.id,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  revalidatePath('/workshops')
  redirect(`/workshops/${data.id}/edit`)
}

export async function updateEvent(eventId: string, formData: FormData) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('events')
    .update({
      title:        formData.get('title') as string,
      description:  formData.get('description') as string || null,
      event_type:   formData.get('event_type') as string,
      starts_at:    formData.get('starts_at') as string || null,
      ends_at:      formData.get('ends_at') as string || null,
      location:     formData.get('location') as string || null,
      is_online:    formData.get('is_online') === 'on',
      meeting_url:  formData.get('meeting_url') as string || null,
      max_capacity: formData.get('max_capacity') ? Number(formData.get('max_capacity')) : null,
      status:       formData.get('status') as string,
    })
    .eq('id', eventId)

  if (error) throw new Error(error.message)

  revalidatePath('/workshops')
  revalidatePath(`/workshops/${eventId}/edit`)
}
