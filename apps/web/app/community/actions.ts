'use server'

import { createServerSupabaseClient } from '@natural-intelligence/db'
import { revalidatePath } from 'next/cache'

export async function createPost(body: string) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (!body.trim()) return { error: 'Post cannot be empty' }

  const { error } = await supabase.from('posts').insert({
    author_id: user.id,
    body: body.trim(),
    post_type: 'community',
    status: 'published',
    published_at: new Date().toISOString(),
  })

  if (error) return { error: error.message }
  revalidatePath('/community')
  return {}
}

export async function toggleLike(postId: string, currentlyLiked: boolean) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  if (currentlyLiked) {
    await supabase
      .from('post_likes')
      .delete()
      .eq('post_id', postId)
      .eq('profile_id', user.id)

    // Decrement like count
    const { data: post } = await supabase
      .from('posts')
      .select('like_count')
      .eq('id', postId)
      .single()

    if (post) {
      await supabase
        .from('posts')
        .update({ like_count: Math.max(0, (post.like_count ?? 0) - 1) })
        .eq('id', postId)
    }
  } else {
    const { error: likeError } = await supabase
      .from('post_likes')
      .insert({ post_id: postId, profile_id: user.id })

    if (!likeError) {
      // Increment like count
      const { data: post } = await supabase
        .from('posts')
        .select('like_count')
        .eq('id', postId)
        .single()

      if (post) {
        await supabase
          .from('posts')
          .update({ like_count: (post.like_count ?? 0) + 1 })
          .eq('id', postId)
      }
    }
  }

  revalidatePath('/community')
  return {}
}

export async function addComment(postId: string, body: string, parentId?: string) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  if (!body.trim()) return { error: 'Comment cannot be empty' }

  const { error } = await supabase.from('comments').insert({
    post_id: postId,
    author_id: user.id,
    body: body.trim(),
    ...(parentId ? { parent_id: parentId } : {}),
  })

  if (error) return { error: error.message }
  revalidatePath('/community')
  return {}
}
