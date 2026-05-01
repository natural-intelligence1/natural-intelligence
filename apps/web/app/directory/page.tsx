import Link from 'next/link'
import { copy } from '@/lib/copy'
import { createServerSupabaseClient } from '@natural-intelligence/db'
import { DirectorySearch } from '@/components/directory-search'
import { Avatar, Pill } from '@natural-intelligence/ui'
import { Suspense } from 'react'

interface DirectoryPageProps {
  searchParams: {
    q?:         string
    trust?:     string
    delivery?:  string
    referrals?: string
  }
}

function FilterButton({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={[
        'block w-full text-left px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-brand-subtle text-text-brand border-l-2 border-brand-default'
          : 'text-text-secondary hover:text-text-primary hover:bg-surface-muted',
      ].join(' ')}
    >
      {children}
    </Link>
  )
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <p className="text-[10px] font-semibold text-text-muted uppercase tracking-[0.12em] mb-2 px-3">
        {label}
      </p>
      {children}
    </div>
  )
}

export default async function DirectoryPage({ searchParams }: DirectoryPageProps) {
  const supabase = createServerSupabaseClient()
  const { q, trust, delivery, referrals } = searchParams

  let query = supabase
    .from('practitioners')
    .select(`
      id,
      tagline,
      city,
      country,
      delivery_mode,
      area_tags,
      primary_professions,
      trust_level,
      practitioner_tier,
      accepts_referrals,
      display_order,
      profiles!practitioners_profile_id_fkey(full_name, bio)
    `)
    .eq('lifecycle_status', 'active')
    .eq('is_directory_ready', true)

  if (trust === 'vetted') {
    query = query.eq('trust_level', 'vetted')
  }

  if (delivery === 'online') {
    query = query.or('delivery_mode.eq.online,delivery_mode.eq.both')
  } else if (delivery === 'in_person') {
    query = query.or('delivery_mode.eq.in_person,delivery_mode.eq.both')
  } else if (delivery === 'both') {
    query = query.eq('delivery_mode', 'both')
  }

  if (referrals === 'yes') {
    query = query.eq('accepts_referrals', true)
  }

  if (q) {
    query = query.or(
      `area_tags.cs.{${q}},primary_professions.cs.{${q}},profiles.full_name.ilike.%${q}%,city.ilike.%${q}%`
    )
  }

  const { data: practitioners } = await query.order('display_order', { ascending: true, nullsFirst: false })

  const sorted = (practitioners ?? []).sort((a: any, b: any) => {
    if (a.trust_level === 'vetted' && b.trust_level !== 'vetted') return -1
    if (a.trust_level !== 'vetted' && b.trust_level === 'vetted') return 1
    const tierOrder: Record<string, number> = { featured: 0, specialist: 1, senior: 2, standard: 3 }
    return (tierOrder[a.practitioner_tier] ?? 3) - (tierOrder[b.practitioner_tier] ?? 3)
  })

  const deliveryUrl = (val: string) => {
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    if (trust) p.set('trust', trust)
    if (val) p.set('delivery', val)
    if (referrals) p.set('referrals', referrals)
    return `/directory?${p}`
  }

  const referralsUrl = (val: string) => {
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    if (trust) p.set('trust', trust)
    if (delivery) p.set('delivery', delivery)
    if (val) p.set('referrals', val)
    return `/directory?${p}`
  }

  const trustUrl = (val: string) => {
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    if (val) p.set('trust', val)
    if (delivery) p.set('delivery', delivery)
    if (referrals) p.set('referrals', referrals)
    return `/directory?${p}`
  }

  return (
    <div className="py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">

      {/* Page heading */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-text-primary mb-2">{copy.directory.heading}</h1>
        <p className="text-text-secondary">
          {sorted.length > 0
            ? `${sorted.length} practitioner${sorted.length === 1 ? '' : 's'} · ${copy.directory.subheading}`
            : copy.directory.subheading}
        </p>
      </div>

      {/* Full-width search bar above the grid */}
      <div className="mb-8">
        <Suspense>
          <DirectorySearch />
        </Suspense>
      </div>

      <div className="md:grid md:grid-cols-[240px_1fr] gap-8">

        {/* ── Sidebar filters ─────────────────────────────────────────────── */}
        <aside className="mb-8 md:mb-0">

          <FilterGroup label="Trust level">
            <FilterButton href={trustUrl('')} active={!trust}>
              All practitioners
            </FilterButton>
            <FilterButton href={trustUrl('vetted')} active={trust === 'vetted'}>
              Vetted only
            </FilterButton>
          </FilterGroup>

          <FilterGroup label="Delivery mode">
            <FilterButton href={deliveryUrl('')} active={!delivery}>
              All
            </FilterButton>
            <FilterButton href={deliveryUrl('online')} active={delivery === 'online'}>
              Online
            </FilterButton>
            <FilterButton href={deliveryUrl('in_person')} active={delivery === 'in_person'}>
              In-person
            </FilterButton>
            <FilterButton href={deliveryUrl('both')} active={delivery === 'both'}>
              Both
            </FilterButton>
          </FilterGroup>

          <FilterGroup label="Accepts referrals">
            <FilterButton href={referralsUrl('')} active={!referrals}>
              All
            </FilterButton>
            <FilterButton href={referralsUrl('yes')} active={referrals === 'yes'}>
              Accepting referrals
            </FilterButton>
          </FilterGroup>

        </aside>

        {/* ── Results grid ──────────────────────────────────────────────────── */}
        <div>
          {sorted.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-text-primary font-medium mb-2">
                No practitioners match your filters.
              </p>
              <p className="text-text-secondary text-sm mb-6">
                Try broadening your search or clearing a filter.
              </p>
              <Link
                href="/directory"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg border border-border-default bg-surface-raised text-text-primary text-sm font-medium hover:bg-surface-muted transition-colors"
              >
                Clear all filters
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {sorted.map((p: any) => {
                const profile  = (p as any).profiles
                const name     = profile?.full_name ?? 'Practitioner'
                const role     = ((p.primary_professions as string[] | null)?.[0]) ?? null
                const areas    = (p.area_tags as string[] | null) ?? []

                return (
                  <div
                    key={p.id}
                    className="rounded-xl border border-border-default bg-surface-raised p-5 flex flex-col transition-all duration-200 hover:shadow-[0_4px_12px_rgba(14,13,11,0.08)] hover:border-border-strong"
                  >
                    {/* Top row — avatar + name + vetted badge */}
                    <div className="flex items-start gap-3 mb-3">
                      <Avatar name={name} size="lg" />
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-semibold text-text-primary truncate leading-tight mb-0.5">
                          {name}
                        </p>
                        {role && (
                          <p className="text-sm text-text-secondary truncate mb-1">{role}</p>
                        )}
                        {p.trust_level === 'vetted' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-status-successBg text-status-successText">
                            ✓ Vetted
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Tagline */}
                    {(p.tagline || profile?.bio) && (
                      <p className="text-sm text-text-secondary leading-relaxed line-clamp-2 mb-3 flex-1">
                        {p.tagline ?? profile?.bio}
                      </p>
                    )}

                    {/* Area tags */}
                    {areas.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {areas.slice(0, 3).map((s: string) => (
                          <span
                            key={s}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-surface-muted text-text-muted"
                          >
                            {s}
                          </span>
                        ))}
                        {areas.length > 3 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-muted text-text-muted">
                            +{areas.length - 3} more
                          </span>
                        )}
                      </div>
                    )}

                    {/* CTA */}
                    <Link
                      href={`/directory/${p.id}`}
                      className="mt-auto text-sm font-medium text-text-brand hover:underline"
                    >
                      View profile →
                    </Link>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
