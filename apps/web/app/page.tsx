import Link from 'next/link'
import { copy } from '@/lib/copy'
import { createServerSupabaseClient } from '@natural-intelligence/db'

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
      {type.replace(/_/g, ' ')}
    </span>
  )
}

export default async function HomePage() {
  const supabase = createServerSupabaseClient()

  // Only surface practitioners who are active AND directory-ready.
  // Uses lifecycle_status (not the legacy is_active boolean) for consistency
  // with the directory page filter applied during the hardening pass.
  const { data: practitioners } = await supabase
    .from('practitioners')
    .select(`
      id,
      profile_id,
      practice_name,
      tagline,
      area_tags,
      primary_professions,
      trust_level,
      lifecycle_status,
      is_directory_ready,
      display_order,
      profiles!practitioners_profile_id_fkey(full_name, bio)
    `)
    .eq('lifecycle_status', 'active')
    .eq('is_directory_ready', true)
    .order('display_order', { ascending: true })
    .limit(3)

  const now = new Date().toISOString()
  const { data: events } = await supabase
    .from('events')
    .select(`
      id,
      title,
      event_type,
      starts_at,
      is_online,
      profiles!events_hosted_by_fkey(full_name)
    `)
    .eq('status', 'published')
    .gt('starts_at', now)
    .order('starts_at', { ascending: true })
    .limit(3)

  return (
    <div>
      {/* Hero */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <div className="max-w-3xl">
          <h1 className="text-5xl font-bold text-text-primary mb-6 leading-tight">
            {copy.home.hero.headline}
          </h1>
          <p className="text-lg text-text-secondary mb-10 leading-relaxed max-w-2xl">
            {copy.home.hero.subheadline}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/directory"
              className="px-5 py-2.5 rounded-lg bg-brand-default hover:bg-brand-hover text-white text-sm font-medium transition-colors"
            >
              {copy.home.hero.ctaPrimary}
            </Link>
            <Link
              href="/apply"
              className="px-5 py-2.5 rounded-lg border border-border-default hover:bg-surface-muted text-text-primary text-sm font-medium transition-colors"
            >
              {copy.home.hero.ctaSecondary}
            </Link>
          </div>
        </div>
      </section>

      {/* Three pillars */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <h2 className="text-2xl font-semibold text-text-primary mb-10">
          {copy.home.pillars.heading}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {copy.home.pillars.items.map((pillar) => (
            <div
              key={pillar.title}
              className="rounded-xl border border-border-default bg-surface-raised p-6 shadow-sm"
            >
              <h3 className="text-lg font-semibold text-text-primary mb-3">{pillar.title}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{pillar.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured practitioners */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-2xl font-semibold text-text-primary mb-1">
              {copy.home.featuredPractitioners.heading}
            </h2>
            <p className="text-sm text-text-secondary">{copy.home.featuredPractitioners.subheading}</p>
          </div>
          <Link
            href="/directory"
            className="text-sm font-medium text-text-brand hover:underline hidden sm:block"
          >
            {copy.home.featuredPractitioners.cta}
          </Link>
        </div>

        {practitioners && practitioners.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {practitioners.map((p: any) => {
              const profile = p.profiles
              const name = profile?.full_name ?? 'Practitioner'
              const tags = (p.area_tags as string[] | null) ?? []
              return (
                <div
                  key={p.id}
                  className="rounded-xl border border-border-default bg-surface-raised p-6 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-3 mb-4">
                    <Avatar name={name} size="lg" />
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-text-primary truncate">{name}</p>
                      {p.trust_level === 'vetted' && <VettedBadge />}
                    </div>
                  </div>
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {tags.slice(0, 3).map((tag: string) => (
                        <TypeBadge key={tag} type={tag} />
                      ))}
                    </div>
                  )}
                  {profile?.bio && (
                    <p className="text-sm text-text-secondary line-clamp-2 mb-4 leading-relaxed">
                      {profile.bio}
                    </p>
                  )}
                  <Link
                    href={`/directory/${p.id}`}
                    className="text-sm font-medium text-text-brand hover:underline"
                  >
                    {copy.directory.card.viewProfile}
                  </Link>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-text-muted text-sm">{copy.home.featuredPractitioners.empty}</p>
        )}

        <div className="mt-6 sm:hidden">
          <Link
            href="/directory"
            className="text-sm font-medium text-text-brand hover:underline"
          >
            {copy.home.featuredPractitioners.cta}
          </Link>
        </div>
      </section>

      {/* Upcoming workshops */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-2xl font-semibold text-text-primary mb-1">
              {copy.home.upcomingWorkshops.heading}
            </h2>
            <p className="text-sm text-text-secondary">{copy.home.upcomingWorkshops.subheading}</p>
          </div>
          <Link
            href="/workshops"
            className="text-sm font-medium text-text-brand hover:underline hidden sm:block"
          >
            {copy.home.upcomingWorkshops.cta}
          </Link>
        </div>

        {events && events.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {events.map((event: any) => {
              const date = new Date(event.starts_at)
              const hostName = event.profiles?.full_name ?? ''
              return (
                <div
                  key={event.id}
                  className="rounded-xl border border-border-default bg-surface-raised p-6 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <TypeBadge type={event.event_type} />
                    {event.is_online && (
                      <span className="inline-block px-2 py-0.5 rounded-md bg-surface-muted text-text-secondary text-xs font-medium">
                        {copy.workshops.card.online}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-text-primary mb-2 leading-snug">
                    {event.title}
                  </h3>
                  <p className="text-xs text-text-muted mb-1">
                    {date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                    {' '}
                    {date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {hostName && (
                    <p className="text-xs text-text-muted mb-4">{hostName}</p>
                  )}
                  <Link
                    href="/workshops"
                    className="text-sm font-medium text-text-brand hover:underline"
                  >
                    {copy.workshops.card.register}
                  </Link>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-text-muted text-sm">{copy.home.upcomingWorkshops.empty}</p>
        )}
      </section>

      {/* How it works */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <h2 className="text-2xl font-semibold text-text-primary mb-12 text-center">
          {copy.home.howItWorks.heading}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Members */}
          <div>
            <h3 className="text-lg font-semibold text-text-primary mb-6 pb-3 border-b border-border-default">
              {copy.home.howItWorks.members.heading}
            </h3>
            <div className="space-y-6">
              {copy.home.howItWorks.members.steps.map((step) => (
                <div key={step.step} className="flex gap-4">
                  <span className="text-xs font-semibold text-text-muted mt-0.5 w-6 flex-shrink-0">{step.step}</span>
                  <div>
                    <p className="text-sm font-semibold text-text-primary mb-1">{step.title}</p>
                    <p className="text-sm text-text-secondary leading-relaxed">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Practitioners */}
          <div>
            <h3 className="text-lg font-semibold text-text-primary mb-6 pb-3 border-b border-border-default">
              {copy.home.howItWorks.practitioners.heading}
            </h3>
            <div className="space-y-6">
              {copy.home.howItWorks.practitioners.steps.map((step) => (
                <div key={step.step} className="flex gap-4">
                  <span className="text-xs font-semibold text-text-muted mt-0.5 w-6 flex-shrink-0">{step.step}</span>
                  <div>
                    <p className="text-sm font-semibold text-text-primary mb-1">{step.title}</p>
                    <p className="text-sm text-text-secondary leading-relaxed">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/apply"
            className="px-5 py-2.5 rounded-lg border border-border-default hover:bg-surface-muted text-text-primary text-sm font-medium transition-colors"
          >
            {copy.nav.apply}
          </Link>
        </div>
      </section>
    </div>
  )
}
