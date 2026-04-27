import Link from 'next/link'
import { copy } from '@/lib/copy'
import { createServerSupabaseClient } from '@natural-intelligence/db'
import { Pill } from '@natural-intelligence/ui'

interface ResourcesPageProps {
  searchParams: { type?: string }
}

export default async function ResourcesPage({ searchParams }: ResourcesPageProps) {
  const supabase = createServerSupabaseClient()

  let query = supabase
    .from('resources')
    .select(`
      id,
      title,
      description,
      body,
      resource_type,
      topic_tags,
      published_at,
      profiles!resources_author_id_fkey(full_name)
    `)
    .eq('status', 'published')
    .order('published_at', { ascending: false })

  if (searchParams.type) {
    query = query.eq('resource_type', searchParams.type)
  }

  const { data: resources } = await query

  const typeFilters = [
    { value: '', label: copy.resources.filters.all },
    { value: 'article', label: copy.resources.filters.article },
    { value: 'guide', label: copy.resources.filters.guide },
    { value: 'video_link', label: copy.resources.filters.video_link },
    { value: 'podcast_link', label: copy.resources.filters.podcast_link },
    { value: 'external_link', label: copy.resources.filters.external_link },
  ]

  const isExternal = (type: string) =>
    ['video_link', 'podcast_link', 'external_link'].includes(type)

  return (
    <div className="py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-text-primary mb-2">{copy.resources.heading}</h1>
        <p className="text-text-secondary">{copy.resources.subheading}</p>
      </div>

      {/* Type filters */}
      <div className="flex flex-wrap gap-2 mb-8">
        {typeFilters.map((f) => (
          <Link
            key={f.value}
            href={f.value ? `/resources?type=${f.value}` : '/resources'}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              (searchParams.type ?? '') === f.value
                ? 'bg-brand-default text-white'
                : 'border border-border-default text-text-secondary hover:bg-surface-muted'
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {!resources || resources.length === 0 ? (
        <p className="text-text-muted text-sm py-12 text-center">{copy.resources.empty}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {resources.map((resource: any) => {
            const external = isExternal(resource.resource_type)
            const author = resource.profiles?.full_name

            return (
              <div
                key={resource.id}
                className="rounded-xl border border-border-default bg-surface-raised p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col"
              >
                <div className="flex flex-wrap gap-2 mb-3">
                  <Pill label={resource.resource_type.replace('_', ' ')} />
                  {resource.topic_tags && resource.topic_tags.length > 0 &&
                    resource.topic_tags.slice(0, 2).map((tag: string) => (
                      <Pill key={tag} label={tag} />
                    ))
                  }
                </div>

                <h3 className="text-base font-semibold text-text-primary mb-2 leading-snug flex-1">
                  {resource.title}
                </h3>

                {resource.description && (
                  <p className="text-sm text-text-secondary line-clamp-3 mb-4 leading-relaxed">
                    {resource.description}
                  </p>
                )}

                <div className="mt-auto flex items-center justify-between">
                  {author && (
                    <p className="text-xs text-text-muted">{author}</p>
                  )}
                  {external ? (
                    <a
                      href={resource.body}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-text-brand hover:underline ml-auto"
                    >
                      {copy.resources.card.visit}
                    </a>
                  ) : (
                    <Link
                      href={`/resources/${resource.id}`}
                      className="text-sm font-medium text-text-brand hover:underline ml-auto"
                    >
                      {copy.resources.card.readMore}
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
