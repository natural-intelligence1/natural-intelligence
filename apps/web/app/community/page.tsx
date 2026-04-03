import { copy } from '@/lib/copy'
import { createServerSupabaseClient } from '@natural-intelligence/db'
import { CommunityFeed } from '@/components/community-feed'

export default async function CommunityPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: posts } = await supabase
    .from('posts')
    .select('*, profiles!posts_author_id_fkey(full_name), comments(id, author_id, body, created_at, parent_id, profiles!comments_author_id_fkey(full_name))')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(50)

  // Fetch likes for current user
  let userLikes: Set<string> = new Set()
  if (user && posts && posts.length > 0) {
    const { data: likes } = await supabase
      .from('post_likes')
      .select('post_id')
      .eq('profile_id', user.id)
      .in('post_id', posts.map((p: any) => p.id))

    if (likes) {
      likes.forEach((l: any) => userLikes.add(l.post_id))
    }
  }

  let currentUserName: string | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()
    currentUserName = profile?.full_name ?? null
  }

  const enrichedPosts = (posts ?? []).map((p: any) => ({
    ...p,
    likedByMe: userLikes.has(p.id),
    commentCount: (p.comments ?? []).length,
  }))

  return (
    <div className="py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
      <div className="mb-10 max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-text-primary mb-2">{copy.community.heading}</h1>
        <p className="text-text-secondary">{copy.community.subheading}</p>
      </div>

      <CommunityFeed
        posts={enrichedPosts}
        isLoggedIn={!!user}
        currentUserName={currentUserName}
      />
    </div>
  )
}
