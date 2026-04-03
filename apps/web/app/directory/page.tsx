import Link from 'next/link'
import { copy } from '@/lib/copy'
import { createServerSupabaseClient } from '@natural-intelligence/db'
import { DirectorySearch } from '@/components/directory-search'
import { Suspense } from 'react'

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-16 h-16 text-xl' }
  return (
    <div className={`${sizes[size]} rounded-full bg-brand-light text-brand-text font-semibold flex items-center justify-center flex-shrink-0`}>
      {initials}
    </div>
  )
}

function VettedBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-light text-brand-text text-xs font-medium">
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
      {copy.directory.card.vettedBadge}
    </span>
  )
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-block px-2 py-0.5 rounded-md bg-surface-muted text-text-secondary text-xs font-medium capitalize">
      {type.replace('_', ' ')}
    </span>
  )
}

interface DirectoryPageProps {
  searchParams: { q?: string; trust?: string }
}

export default async function DirectoryPage({ searchParams }: DirectoryPageProps) {
  const supabase = createServerSupabaseClient()
  const { q, trust } = searchParams

  let query = supabase
    .from('practitioners')
    .select('*, profiles!practitioners_profile_id_fkey(*)')
    .eq('is_active', true)

  if (trust === 'vetted') {
    query = query.eq('trust_level', 'vetted')
  } else if (trust === 'unvetted') {
    query = query.eq('trust_level', 'unvetted')
  }

  if (q) {
    query = query.or(
      `specialties.cs.{${q}},profiles.full_name.ilike.%${q}%`
    )
  }

  const { data: practitioners } = await query.order('display_order', { ascending: true, nullsFirst: false })

  const sorted = (practitioners ?? []).sort((a: any, b: any) => {
    if (a.trust_level === 'vetted' && b.trust_level !== 'vetted') return -1
    if (a.trust_level !== 'vetted' && b.trust_level === 'vetted') return 1
    return 0
  })

  return (
    <div className="py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-text-primary mb-2">{copy.directory.heading}</h1>
        <p className="text-text-secondary">{copy.directory.subheading}</p>
      </div>

      <Suspense>
        <DirectorySearch />
      </Suspense>

      {sorted.length === 0 ? (
        <p className="text-text-muted text-sm py-12 text-center">{copy.directory.empty}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sorted.map((p: any) => {
            const profile = p.profiles
            const name = profile?.full_name ?? 'Practitioner'
            return (
              <div
                key={p.id}
                className="rounded-xl border border-border-default bg-surface-raised p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col"
              >
                <div className="flex items-start gap-3 mb-4">
                  <Avatar name={name} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold text-text-primary truncate mb-1">{name}</p>
                    {p.trust_level === 'vetted' && <VettedBadge />}
                  </div>
                </div>

                {p.specialties && p.specialties.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {p.specialties.slice(0, 4).map((s: string) => (
                      <TypeBadge key={s} type={s} />
                    ))}
                  </div>
                )}

                {profile?.bio && (
                  <p className="text-sm text-text-secondary leading-relaxed line-clamp-3 mb-4 flex-1">
                    {profile.bio}
                  </p>
                )}

                <Link
                  href={`/directory/${p.id}`}
                  className="mt-auto text-sm font-medium text-white bg-brand-default hover:bg-brand-hover px-4 py-2 rounded-lg text-center transition-colors"
                >
                  {copy.directory.card.viewProfile}
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
