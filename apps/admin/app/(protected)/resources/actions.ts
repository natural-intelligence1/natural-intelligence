'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'
import type { Database } from '@natural-intelligence/db'

type ContentStatus = Database['public']['Enums']['content_status']

export async function createResource(formData: FormData) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  const tagsRaw = formData.get('topic_tags') as string
  const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : []

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('resources')
    .insert({
      title:         formData.get('title') as string,
      description:   formData.get('description') as string || null,
      body:          formData.get('body') as string || null,
      resource_type: formData.get('resource_type') as string,
      topic_tags:    tags,
      status:        (formData.get('status') as ContentStatus) || 'draft',
      author_id:     user.id,
    })
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
  const { error } = await adminClient
    .from('resources')
    .update({
      title:         formData.get('title') as string,
      description:   formData.get('description') as string || null,
      body:          formData.get('body') as string || null,
      resource_type: formData.get('resource_type') as string,
      topic_tags:    tags,
      status:        (formData.get('status') as ContentStatus) || 'draft',
    })
    .eq('id', resourceId)

  if (error) throw new Error(error.message)

  revalidatePath('/resources')
  revalidatePath(`/resources/${resourceId}/edit`)
}
