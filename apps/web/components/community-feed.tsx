'use client'

import { useState, useTransition } from 'react'
import { copy } from '@/lib/copy'
import { createPost, toggleLike, addComment } from '@/app/community/actions'
import { Avatar } from '@natural-intelligence/ui'

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.floor((now - then) / 1000)
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

interface Comment {
  id: string
  author_id: string
  body: string
  created_at: string
  parent_id: string | null
  profiles: { full_name: string | null } | null
}

interface Post {
  id: string
  author_id: string
  body: string
  like_count: number
  published_at: string
  created_at: string
  profiles: { full_name: string | null } | null
  comments: Comment[]
  likedByMe: boolean
  commentCount: number
}

interface CommunityFeedProps {
  posts: Post[]
  isLoggedIn: boolean
  currentUserName: string | null
}

function CommentThread({
  postId,
  comments,
  isLoggedIn,
}: {
  postId: string
  comments: Comment[]
  isLoggedIn: boolean
}) {
  const [body, setBody] = useState('')
  const [isPending, startTransition] = useTransition()
  const [localComments, setLocalComments] = useState<Comment[]>(comments)

  const handleSubmit = () => {
    if (!body.trim()) return
    const text = body
    setBody('')
    startTransition(async () => {
      const result = await addComment(postId, text)
      if (!result.error) {
        setLocalComments((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            author_id: '',
            body: text,
            created_at: new Date().toISOString(),
            parent_id: null,
            profiles: null,
          },
        ])
      }
    })
  }

  return (
    <div className="pt-3 mt-3 border-t border-border-muted">
      {localComments.map((c) => {
        const author = c.profiles?.full_name ?? 'Member'
        return (
          <div key={c.id} className="flex gap-3 mb-3">
            <Avatar name={author} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="text-sm font-semibold text-text-primary">{author}</span>
                <span className="text-xs text-text-muted">{timeAgo(c.created_at)}</span>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed">{c.body}</p>
            </div>
          </div>
        )
      })}

      {isLoggedIn && (
        <div className="flex gap-2 mt-2">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() } }}
            placeholder={copy.community.compose.placeholder}
            className="flex-1 px-3 py-2 rounded-lg border border-border-default bg-surface-raised text-text-primary placeholder:text-text-placeholder text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent transition-colors"
          />
          <button
            onClick={handleSubmit}
            disabled={!body.trim() || isPending}
            className="px-3 py-2 rounded-lg bg-brand-default hover:bg-brand-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {copy.community.compose.post}
          </button>
        </div>
      )}
    </div>
  )
}

function PostCard({
  post,
  isLoggedIn,
}: {
  post: Post
  isLoggedIn: boolean
}) {
  const [liked, setLiked] = useState(post.likedByMe)
  const [likeCount, setLikeCount] = useState(post.like_count)
  const [showComments, setShowComments] = useState(false)
  const [isPending, startTransition] = useTransition()

  const authorName = post.profiles?.full_name ?? 'Member'

  const handleLike = () => {
    if (!isLoggedIn) return
    const wasLiked = liked
    setLiked(!wasLiked)
    setLikeCount((c) => c + (wasLiked ? -1 : 1))
    startTransition(async () => {
      await toggleLike(post.id, wasLiked)
    })
  }

  return (
    <article className="bg-surface-raised border border-border-default rounded-xl p-5">
      <div className="flex gap-3">
        <Avatar name={authorName} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-sm font-semibold text-text-primary">{authorName}</span>
            <span className="text-xs text-text-muted">{timeAgo(post.published_at ?? post.created_at)}</span>
          </div>
          <p className="text-sm text-text-primary leading-relaxed whitespace-pre-line mb-4">{post.body}</p>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleLike}
              disabled={!isLoggedIn || isPending}
              className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                liked ? 'text-brand-text' : 'text-text-muted hover:text-text-secondary'
              } disabled:cursor-default`}
            >
              <svg className="w-4 h-4" fill={liked ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
              {likeCount > 0 ? likeCount : copy.community.post.like}
            </button>

            <button
              onClick={() => setShowComments(!showComments)}
              className="flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text-secondary transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
              {post.commentCount > 0 ? post.commentCount : copy.community.post.comment}
            </button>
          </div>

          {showComments && (
            <CommentThread
              postId={post.id}
              comments={post.comments}
              isLoggedIn={isLoggedIn}
            />
          )}
        </div>
      </div>
    </article>
  )
}

export function CommunityFeed({ posts, isLoggedIn, currentUserName }: CommunityFeedProps) {
  const [newPostBody, setNewPostBody] = useState('')
  const [isPending, startTransition] = useTransition()
  const [localPosts, setLocalPosts] = useState<Post[]>(posts)

  const handlePost = () => {
    if (!newPostBody.trim()) return
    const text = newPostBody
    setNewPostBody('')
    startTransition(async () => {
      const result = await createPost(text)
      if (!result.error) {
        const optimistic: Post = {
          id: crypto.randomUUID(),
          author_id: '',
          body: text,
          like_count: 0,
          published_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          profiles: { full_name: currentUserName },
          comments: [],
          likedByMe: false,
          commentCount: 0,
        }
        setLocalPosts((prev) => [optimistic, ...prev])
      }
    })
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Compose */}
      {isLoggedIn ? (
        <div className="bg-surface-raised border border-border-default rounded-xl p-4 mb-6">
          <div className="flex gap-3">
            <Avatar name={currentUserName ?? 'Me'} />
            <div className="flex-1">
              <textarea
                value={newPostBody}
                onChange={(e) => setNewPostBody(e.target.value)}
                placeholder={copy.community.compose.placeholder}
                rows={3}
                className="w-full px-3 py-2.5 rounded-lg border border-border-default bg-surface-raised text-text-primary placeholder:text-text-placeholder text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent transition-colors resize-none"
              />
              <div className="flex justify-end mt-2">
                <button
                  onClick={handlePost}
                  disabled={!newPostBody.trim() || isPending}
                  className="px-5 py-2 rounded-lg bg-brand-default hover:bg-brand-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {copy.community.compose.post}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-surface-raised border border-border-default rounded-xl p-6 mb-6 text-center">
          <p className="text-sm text-text-secondary mb-3">{copy.community.loginPrompt}</p>
          <a
            href="/auth/login"
            className="inline-block px-5 py-2.5 rounded-lg bg-brand-default hover:bg-brand-hover text-white text-sm font-medium transition-colors"
          >
            {copy.nav.login}
          </a>
        </div>
      )}

      {/* Feed */}
      {localPosts.length === 0 ? (
        <p className="text-text-muted text-sm text-center py-12">{copy.community.empty}</p>
      ) : (
        <div className="space-y-4">
          {localPosts.map((post) => (
            <PostCard key={post.id} post={post} isLoggedIn={isLoggedIn} />
          ))}
        </div>
      )}
    </div>
  )
}
