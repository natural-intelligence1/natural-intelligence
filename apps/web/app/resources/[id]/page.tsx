import Link from 'next/link'
import { notFound } from 'next/navigation'
import { copy } from '@/lib/copy'
import { createServerSupabaseClient } from '@natural-intelligence/db'

function TypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-block px-2 py-0.5 rounded-md bg-surface-muted text-text-secondary text-xs font-medium capitalize">
      {type.replace('_', ' ')}
    </span>
  )
}

interface ResourceDetailPageProps {
  params: { id: string }
}

export default async function ResourceDetailPage({ params }: ResourceDetailPageProps) {
  const supabase = createServerSupabaseClient()

  const { data: resource } = await supabase
    .from('resources')
    .select('*, profiles!resources_author_id_fkey(full_name)')
    .eq('id', params.id)
    .eq('status', 'published')
    .single()

  if (!resource) notFound()

  const author = (resource as any).profiles?.full_name
  const publishedDate = resource.published_at
    ? new Date(resource.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <div className="py-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
      <Link
        href="/resources"
        className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary mb-8 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        {copy.resources.heading}
      </Link>

      <div className="flex flex-wrap gap-2 mb-6">
        <TypeBadge type={(resource as any).resource_type} />
        {(resource as any).topic_tags && (resource as any).topic_tags.map((tag: string) => (
          <TypeBadge key={tag} type={tag} />
        ))}
      </div>

      <h1 className="text-3xl font-bold text-text-primary mb-4 leading-tight">
        {(resource as any).title}
      </h1>

      <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border-default">
        {author && (
          <p className="text-sm text-text-secondary">{author}</p>
        )}
        {publishedDate && (
          <p className="text-sm text-text-muted">{publishedDate}</p>
        )}
      </div>

      {(resource as any).body && (
        <div className="prose prose-sm max-w-none text-text-secondary leading-relaxed">
          <p className="whitespace-pre-line text-sm leading-relaxed text-text-secondary">
            {(resource as any).body}
          </p>
        </div>
      )}
    </div>
  )
}
