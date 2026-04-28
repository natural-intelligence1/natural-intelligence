'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'

export async function createResource(formData: FormData) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  const tagsRaw = formData.get('topic_tags') as string
  const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : []

  const adminClient = createAdminClient()
  // eslint-disable-next-line
  const payload: any = {
    title:         formData.get('title') as string,
    description:   formData.get('description') as string || null,
    body:          formData.get('body') as string || null,
    resource_type: formData.get('resource_type') as string,
    topic_tags:    tags,
    status:        formData.get('status') as string,
    author_id:     user.id,
  }
  const { data, error } = await adminClient
    .from('resources')
    .insert(payload)
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  revalidatePath('/resources')
  redirect(`/resources/${data.id}/edit`)
}

export async function updateResource(resourceId: string, formData: FormData) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  const tagsRaw = formData.get('topic_tags') as string
  const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : []

  const adminClient = createAdminClient()
  // eslint-disable-next-line
  const updatePayload: any = {
    title:         formData.get('title') as string,
    description:   formData.get('description') as string || null,
    body:          formData.get('body') as string || null,
    resource_type: formData.get('resource_type') as string,
    topic_tags:    tags,
    status:        formData.get('status') as string,
  }
  const { error } = await adminClient
    .from('resources')
    .update(updatePayload)
    .eq('id', resourceId)

  if (error) throw new Error(error.message)

  revalidatePath('/resources')
  revalidatePath(`/resources/${resourceId}/edit`)
}
