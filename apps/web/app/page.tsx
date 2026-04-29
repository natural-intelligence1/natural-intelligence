import Link from 'next/link'
import Image from 'next/image'
import { copy } from '@/lib/copy'
import { createServerSupabaseClient } from '@natural-intelligence/db'
import { Avatar, VettedBadge, Pill } from '@natural-intelligence/ui'

// ─── Icon primitives ──────────────────────────────────────────────────────────

function IconDirectory() {
  return (
    <svg className="w-5 h-5 text-text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function IconWorkshops() {
  return (
    <svg className="w-5 h-5 text-text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
    </svg>
  )
}

function IconIntelligence() {
  return (
    <svg className="w-5 h-5 text-text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1 1 .03 2.774-1.406 2.774H4.204c-1.435 0-2.407-1.774-1.407-2.774L4.2 15.3" />
    </svg>
  )
}

// ─── Section eyebrow ──────────────────────────────────────────────────────────

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium tracking-widest uppercase text-text-brand mb-4">
      {children}
    </p>
  )
}

// ─── Step number circle ───────────────────────────────────────────────────────

function StepNumber({ n }: { n: number }) {
  return (
    <span className="w-7 h-7 rounded-full bg-brand-subtle text-text-brand text-sm font-medium flex items-center justify-center flex-shrink-0">
      {n}
    </span>
  )
}

// ─── Data fetching ────────────────────────────────────────────────────────────

export default async function HomePage() {
  const supabase = createServerSupabaseClient()

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

  const pillars = [
    {
      icon: <IconDirectory />,
      title: 'Find a vetted practitioner',
      body: 'Browse our directory of naturopathic doctors, functional medicine specialists, and integrative health practitioners — each reviewed before listing.',
    },
    {
      icon: <IconWorkshops />,
      title: 'Join expert-led workshops',
      body: 'Live sessions, Q&As, and group programmes run by practitioners in the NI network. Attend online or find events near you.',
    },
    {
      icon: <IconIntelligence />,
      title: 'Personalised care intelligence',
      body: 'An adaptive protocol engine, lab interpretation, and AI-assisted pattern recognition — built around you, guided by your practitioner.',
      comingSoon: true,
    },
  ]

  const intelligenceModules = [
    { name: 'Daily protocol', desc: 'Adaptive morning + evening' },
    { name: 'Lab interpretation', desc: 'Plain-language results' },
    { name: 'Pattern recognition', desc: 'Symptom timeline analysis' },
    { name: 'Practitioner sync', desc: 'Shared notes & goals' },
  ]

  return (
    <div>

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 text-center bg-surface-base">
        <div className="max-w-2xl mx-auto px-4">

          <div className="flex justify-center mb-6">
            <Image
              src="/images/NI_logo_thumb_transparent.png"
              alt="Natural Intelligence"
              width={72}
              height={72}
              priority
              className="h-[72px] w-auto"
            />
          </div>

          <Eyebrow>Naturopathic &amp; functional medicine</Eyebrow>

          <h1 className="font-display mb-6">
            <span className="block text-5xl md:text-6xl font-light text-text-primary leading-tight">
              The space between
            </span>
            <span className="block text-5xl md:text-6xl font-medium text-text-primary leading-tight">
              normal and thriving.
            </span>
          </h1>

          <p className="text-base text-text-secondary leading-relaxed max-w-lg mx-auto mb-9">
            Find trusted practitioners, join expert-led workshops, and access
            evidence-based resources — all in one place built for natural health.
          </p>

          <div className="flex gap-3 justify-center flex-wrap">
            <Link
              href="/directory"
              className="inline-flex items-center justify-center px-5 py-2.5 text-base rounded-md bg-brand-default text-text-inverted hover:bg-brand-hover transition-colors font-medium"
            >
              Find a practitioner
            </Link>
            <Link
              href="/workshops"
              className="inline-flex items-center justify-center px-5 py-2.5 text-base rounded-md bg-surface-raised text-text-primary border border-border-default hover:bg-surface-muted transition-colors font-medium"
            >
              Explore workshops
            </Link>
          </div>

          {/* Intelligence teaser */}
          <div className="mt-12 bg-surface-raised border border-border-default rounded-2xl p-6 text-left max-w-lg mx-auto">
            <Eyebrow>Coming to members</Eyebrow>
            <p className="text-sm text-text-secondary leading-relaxed">
              We&apos;re building personalised care intelligence — an adaptive daily
              protocol, lab interpretation, and AI-assisted pattern recognition.
              Built around you, guided by your practitioner.
            </p>
          </div>

        </div>
      </section>

      {/* ── THREE PILLARS ─────────────────────────────────────────────────── */}
      <section className="bg-surface-base border-t border-border-default py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-xl">
            <Eyebrow>What we offer</Eyebrow>
            <h2 className="text-3xl font-semibold text-text-primary mb-3">
              {copy.home.pillars.heading}
            </h2>
            <p className="text-text-secondary text-sm leading-relaxed">
              Three pillars designed to work together — connecting people with the
              right support at every stage of their health journey.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-10">
            {pillars.map((pillar) => (
              <div
                key={pillar.title}
                className="bg-surface-raised border border-border-default rounded-xl p-7 flex flex-col"
              >
                <div className="w-9 h-9 bg-brand-subtle rounded-lg flex items-center justify-center mb-4 flex-shrink-0">
                  {pillar.icon}
                </div>
                <h3 className="text-lg font-medium text-text-primary mb-2">{pillar.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed flex-1">{pillar.body}</p>
                {pillar.comingSoon && (
                  <p className="text-xs font-medium tracking-wide uppercase text-text-brand mt-4">
                    Available to members soon
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURED PRACTITIONERS ────────────────────────────────────────── */}
      <section className="bg-surface-raised/50 border-t border-border-default py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-8">
            <div>
              <Eyebrow>Our network</Eyebrow>
              <h2 className="text-2xl font-semibold text-text-primary mb-1">
                {copy.home.featuredPractitioners.heading}
              </h2>
              <p className="text-sm text-text-secondary">{copy.home.featuredPractitioners.subheading}</p>
            </div>
            <Link href="/directory" className="text-sm font-medium text-text-brand hover:underline hidden sm:block flex-shrink-0">
              {copy.home.featuredPractitioners.cta}
            </Link>
          </div>

          {practitioners && practitioners.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {practitioners.map((p: any) => {
                const profile = p.profiles
                const name    = profile?.full_name ?? 'Practitioner'
                const tags    = (p.area_tags as string[] | null) ?? []

                return (
                  <Link
                    key={p.id}
                    href={`/directory/${p.id}`}
                    className="group bg-surface-base border border-border-default rounded-2xl p-5 hover:shadow-sm transition-shadow flex flex-col"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <Avatar name={name} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-text-primary truncate mb-1">{name}</p>
                        {p.practice_name && (
                          <p className="text-xs text-text-muted truncate">{p.practice_name}</p>
                        )}
                      </div>
                    </div>

                    <VettedBadge vetted={p.trust_level === 'vetted'} size="sm" className="mb-3 self-start" />

                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {tags.slice(0, 3).map((tag: string) => (
                          <Pill key={tag}>{tag}</Pill>
                        ))}
                        {tags.length > 3 && (
                          <Pill>+{tags.length - 3}</Pill>
                        )}
                      </div>
                    )}

                    {profile?.bio && (
                      <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed mt-auto">
                        {profile.bio}
                      </p>
                    )}
                  </Link>
                )
              })}
            </div>
          ) : (
            <p className="text-text-muted text-sm">{copy.home.featuredPractitioners.empty}</p>
          )}

          <div className="mt-6 sm:hidden">
            <Link href="/directory" className="text-sm font-medium text-text-brand hover:underline">
              {copy.home.featuredPractitioners.cta}
            </Link>
          </div>
        </div>
      </section>

      {/* ── UPCOMING WORKSHOPS ────────────────────────────────────────────── */}
      <section className="bg-surface-base border-t border-border-default py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-8">
            <div>
              <Eyebrow>Live &amp; online</Eyebrow>
              <h2 className="text-2xl font-semibold text-text-primary mb-1">
                {copy.home.upcomingWorkshops.heading}
              </h2>
              <p className="text-sm text-text-secondary">{copy.home.upcomingWorkshops.subheading}</p>
            </div>
            <Link href="/workshops" className="text-sm font-medium text-text-brand hover:underline hidden sm:block flex-shrink-0">
              {copy.home.upcomingWorkshops.cta}
            </Link>
          </div>

          {events && events.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {events.map((event: any) => {
                const date      = new Date(event.starts_at)
                const day       = date.toLocaleDateString('en-GB', { day: 'numeric' })
                const month     = date.toLocaleDateString('en-GB', { month: 'short' })
                const time      = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                const hostName  = event.profiles?.full_name ?? ''

                return (
                  <div
                    key={event.id}
                    className="bg-surface-base border border-border-default rounded-2xl p-5 flex gap-4"
                  >
                    {/* Date block */}
                    <div className="min-w-[48px] text-center flex-shrink-0">
                      <p className="text-2xl font-light text-text-primary leading-none">{day}</p>
                      <p className="text-xs uppercase tracking-wider text-text-muted mt-1">{month}</p>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-xs uppercase tracking-wide text-text-brand font-medium mb-1 capitalize">
                        {event.event_type.replace('_', ' ')}
                      </p>
                      <h3 className="text-sm font-medium text-text-primary mb-1 leading-snug">
                        {event.title}
                      </h3>
                      <p className="text-xs text-text-muted">
                        {time}{hostName ? ` · ${hostName}` : ''}
                        {event.is_online ? ' · Online' : ''}
                      </p>
                      <Link
                        href="/workshops"
                        className="inline-block mt-3 text-xs font-medium text-text-brand hover:underline"
                      >
                        Register →
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-text-muted text-sm">{copy.home.upcomingWorkshops.empty}</p>
          )}
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────────── */}
      <section className="bg-surface-raised/50 border-t border-border-default py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Eyebrow>Simple by design</Eyebrow>
            <h2 className="text-2xl font-semibold text-text-primary">
              {copy.home.howItWorks.heading}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {/* Members */}
            <div>
              <h3 className="text-base font-semibold text-text-primary mb-6 pb-3 border-b border-border-default">
                {copy.home.howItWorks.members.heading}
              </h3>
              <div className="space-y-5">
                {copy.home.howItWorks.members.steps.map((step, i) => (
                  <div key={step.step} className="flex gap-4">
                    <StepNumber n={i + 1} />
                    <div>
                      <p className="text-sm font-semibold text-text-primary mb-0.5">{step.title}</p>
                      <p className="text-sm text-text-secondary leading-relaxed">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Practitioners */}
            <div>
              <h3 className="text-base font-semibold text-text-primary mb-6 pb-3 border-b border-border-default">
                {copy.home.howItWorks.practitioners.heading}
              </h3>
              <div className="space-y-5">
                {copy.home.howItWorks.practitioners.steps.map((step, i) => (
                  <div key={step.step} className="flex gap-4">
                    <StepNumber n={i + 1} />
                    <div>
                      <p className="text-sm font-semibold text-text-primary mb-0.5">{step.title}</p>
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
              className="inline-flex items-center justify-center px-5 py-2.5 text-sm rounded-md border border-border-default hover:bg-surface-muted text-text-primary font-medium transition-colors"
            >
              {copy.nav.apply}
            </Link>
          </div>
        </div>
      </section>

      {/* ── INTELLIGENCE BANNER ───────────────────────────────────────────── */}
      <section className="px-4 md:px-8 py-4 mb-16">
        <div className="max-w-6xl mx-auto">
          <div className="bg-text-primary rounded-2xl p-10 md:p-14 text-center">

            <p className="text-xs uppercase tracking-widest text-brand-muted font-medium mb-4">
              Coming to members
            </p>

            <h2 className="font-display text-3xl font-light text-text-inverted mb-4 max-w-md mx-auto leading-snug">
              Care intelligence, built around you.
            </h2>

            <p className="text-sm text-text-on-inverse max-w-md mx-auto mb-8 leading-relaxed">
              An adaptive daily protocol, lab result interpretation, and AI-assisted
              pattern recognition — always guided by your practitioner, never replacing them.
            </p>

            {/* Module pills */}
            <div className="flex flex-wrap justify-center gap-3 mb-8">
              {intelligenceModules.map((mod) => (
                <div
                  key={mod.name}
                  className="bg-surface-dark border border-border-inverse rounded-lg px-4 py-2.5 text-left"
                >
                  <p className="text-sm font-medium text-text-inverted">{mod.name}</p>
                  <p className="text-xs text-text-on-inverse mt-0.5">{mod.desc}</p>
                </div>
              ))}
            </div>

            {/* Waitlist CTA */}
            <Link
              href="/auth/signup"
              className="inline-flex items-center justify-center px-6 py-3 text-base rounded-md bg-brand-default text-text-inverted hover:opacity-90 transition-opacity font-medium"
            >
              Join the waitlist
            </Link>

          </div>
        </div>
      </section>

    </div>
  )
}
