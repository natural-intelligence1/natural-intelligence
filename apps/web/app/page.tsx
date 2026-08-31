import Link from 'next/link'
import Image from 'next/image'
import { copy } from '@/lib/copy'
import { createServerSupabaseClient } from '@natural-intelligence/db'

// ─── Icon primitives ──────────────────────────────────────────────────────────

function IconDirectory() {
  return (
    <svg aria-hidden="true" focusable="false" className="w-5 h-5 text-text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function IconWorkshops() {
  return (
    <svg aria-hidden="true" focusable="false" className="w-5 h-5 text-text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
    </svg>
  )
}

function IconIntelligence() {
  return (
    <svg aria-hidden="true" focusable="false" className="w-5 h-5 text-text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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

  // Directory-truth fix: no practitioner records are fetched or displayed on the
  // public homepage until real approved practitioners are published.
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
      title: 'A verified practitioner network',
      body: 'We are onboarding and reviewing naturopathic, functional, and integrative health practitioners now. The public directory opens once profiles are verified.',
      badge: 'Directory coming soon',
    },
    {
      icon: <IconWorkshops />,
      title: 'Join expert-led workshops',
      body: 'Live sessions, Q&As, and group programmes run by practitioners in the NI network. Attend online or find events near you.',
    },
    {
      icon: <IconIntelligence />,
      title: 'Thoughtful preparation',
      body: 'Tools to help you reflect on your health and prepare for working with a practitioner — being developed carefully, with human expertise at the centre.',
      badge: 'Available to members soon',
    },
  ]

  const formatEventTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString('en-GB', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Europe/London',
    })

  return (
    <div>

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-surface-base pt-20 pb-16 md:pt-28 md:pb-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center">

          {/* Hero brand lockup — symbol + wordmark */}
          <div className="mb-8 flex flex-col items-center">
            <Image
              src="/images/NI_logo_thumb_transparent.png"
              alt="Natural Intelligence"
              width={88}
              height={88}
              priority
              className="object-contain mb-3"
              style={{ height: '88px', width: 'auto' }}
            />
            <p
              className="font-sans font-normal text-text-primary uppercase"
              style={{ fontSize: '13px', letterSpacing: '0.18em' }}
            >
              Natural Intelligence
            </p>
          </div>

          {/* Descriptor — tells a first-time visitor what NI is */}
          <p className="text-xs sm:text-sm font-semibold tracking-[0.16em] uppercase text-text-brand mb-5">
            Naturopathic &amp; Functional Medicine
          </p>

          {/* H1 — primary hero line. One unbroken sentence: nothing (logo, break,
              span-split) may interrupt the phrase. Founder ruling. */}
          <h1 className="font-display text-[32px] sm:text-[44px] md:text-[54px] lg:text-[60px] font-medium text-text-primary leading-[1.12] tracking-[-0.02em] mb-4 [text-wrap:balance]">
            The signs are within you.
          </h1>

          {/* Secondary campaign line */}
          <p className="font-display text-lg sm:text-xl md:text-2xl italic font-light text-text-secondary mb-5">
            Beyond survival. Designed for thriving.
          </p>

          {/* Rare gold accent — a single hairline, per Brand System V1 */}
          <span aria-hidden="true" className="block w-14 h-px bg-gold-default mb-6" />

          {/* Subheadline — modest, truthful positioning */}
          <p className="text-base md:text-lg text-text-secondary leading-relaxed mb-9 max-w-xl">
            Natural Intelligence is building a careful, human-led home for natural
            health — education, workshops, and a verified practitioner network,
            with thoughtful preparation and clear boundaries.
          </p>

          {/* CTAs — truthful: directory is in "coming soon" state, so the primary
              actions point at what is genuinely live today */}
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/resources"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-brand-default text-text-inverted text-sm font-medium hover:bg-brand-hover transition-colors"
            >
              Explore The Library
            </Link>
            <Link
              href="/workshops"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg border border-border-default bg-surface-raised text-text-primary text-sm font-medium hover:bg-surface-muted transition-colors"
            >
              See workshops
            </Link>
            <Link
              href="/about"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg text-text-brand text-sm font-medium hover:bg-surface-muted transition-colors"
            >
              Learn how it works
            </Link>
          </div>

          {/* Quiet reassurance — no clinical or handoff claim */}
          <p className="text-sm text-text-muted mt-8 max-w-md">
            A qualified human practitioner is always responsible for clinical judgement.
            Natural Intelligence supports care; it does not replace medical care.
          </p>

        </div>
      </section>

      {/* ── THREE PILLARS ─────────────────────────────────────────────────── */}
      <section className="bg-surface-base border-t border-border-default pt-12 md:pt-20 pb-16">
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
                {pillar.badge && (
                  <p className="text-xs font-medium tracking-wide uppercase text-text-brand mt-4">
                    {pillar.badge}
                  </p>
                )}
              </div>
            ))}
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
                const time      = formatEventTime(event.starts_at)
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

      {/* ── CLOSING INVITATION ────────────────────────────────────────────── */}
      <section className="px-4 md:px-8 py-4 mb-16">
        <div className="max-w-6xl mx-auto">
          <div className="bg-surface-raised border border-border-default rounded-2xl p-10 md:p-14 text-center">

            <p className="text-xs uppercase tracking-widest text-text-brand font-medium mb-4">
              Built carefully
            </p>

            <h2 className="font-display text-3xl font-light text-text-primary mb-4 max-w-md mx-auto leading-snug">
              A more thoughtful kind of care.
            </h2>

            <p className="text-sm text-text-secondary max-w-md mx-auto mb-8 leading-relaxed">
              Natural Intelligence is being built gradually, with a small base of qualified
              practitioners. Human practitioners remain responsible for clinical decisions —
              we simply help you find the right people and prepare well.
            </p>

            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/resources"
                className="inline-flex items-center justify-center px-6 py-3 text-sm rounded-lg bg-brand-default text-text-inverted hover:bg-brand-hover transition-colors font-medium"
              >
                Explore The Library
              </Link>
              <Link
                href="/about"
                className="inline-flex items-center justify-center px-6 py-3 text-sm rounded-lg border border-border-default bg-surface-base text-text-primary hover:bg-surface-muted transition-colors font-medium"
              >
                Learn how it works
              </Link>
            </div>

          </div>
        </div>
      </section>

    </div>
  )
}
