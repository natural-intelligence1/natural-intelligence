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

// V2 eyebrow: JetBrains Mono 11px, 0.14em tracking, gold-ink (the text-safe gold).
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-gold-ink mb-4">
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
      title: 'A practitioner directory',
      body: 'We are onboarding and reviewing naturopathic, functional, and integrative health practitioners now. The public directory opens once profiles are complete.',
      badge: 'Directory coming soon',
    },
    {
      icon: <IconWorkshops />,
      title: 'Community workshops',
      body: 'Live sessions, Q&As, and group programmes run by practitioners in the network. Attend online or find events near you.',
    },
    {
      icon: <IconIntelligence />,
      title: 'Thoughtful preparation',
      body: 'Reading and reflection to help you prepare well for working with a practitioner — being developed carefully, with human expertise at the centre.',
      badge: 'Being built carefully',
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

      {/* ── HERO — V2 rebalance: the mark anchors, the tagline shares the stage ── */}
      <section className="relative overflow-hidden bg-surface-base pt-16 pb-16 md:pt-20 md:pb-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center">

          {/* Lockup: mark at feature scale + one-line Cormorant-caps wordmark +
              short gold rule. The wordmark is never split; the mark never
              interrupts the hero sentence. */}
          <div className="mb-8 flex flex-col items-center gap-5">
            <Image
              src="/images/NI_logo_thumb_transparent.png"
              alt="Natural Intelligence"
              width={176}
              height={176}
              priority
              className="object-contain w-[108px] sm:w-[176px] h-auto"
            />
            <p className="font-display font-medium uppercase text-text-brand whitespace-nowrap leading-none text-[17px] tracking-[0.14em] sm:text-[30px] sm:tracking-[0.22em]">
              Natural Intelligence
            </p>
            <span aria-hidden="true" className="block w-24 h-px bg-gold-default" />
          </div>

          {/* Descriptor — founder ruling: visible to a first-time visitor
              (kept from the front-door spec; V2 eyebrow treatment) */}
          <p className="font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-gold-ink mb-5">
            Naturopathic &amp; Functional Medicine
          </p>

          {/* H1 — the tagline, italic Cormorant, one unbroken sentence. */}
          <h1 className="font-display italic font-light text-[28px] sm:text-[38px] md:text-[46px] text-text-primary leading-[1.16] tracking-[-0.016em] mb-3 [text-wrap:balance]">
            The signs are within you.
          </h1>

          {/* Secondary campaign line — gold-ink lede per V2 */}
          <p className="text-[15px] font-medium tracking-[0.03em] text-gold-ink mb-7">
            Beyond survival. Designed for thriving.
          </p>

          {/* Subheadline — V2 wording: claims only what is open */}
          <p className="text-base md:text-[16.5px] font-light text-text-secondary leading-[1.75] mb-9 max-w-xl [text-wrap:pretty]">
            A careful, human-led home for natural health. We are building it
            gradually — starting with The Library and community workshops, while
            practitioners are onboarded and reviewed.
          </p>

          {/* CTAs — full-round per V2; only currently-possible actions */}
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/resources"
              className="inline-flex items-center justify-center px-6 py-3.5 rounded-full bg-brand-default text-text-inverted text-[15px] font-medium hover:bg-brand-hover transition-colors"
            >
              Explore The Library
            </Link>
            <Link
              href="/workshops"
              className="inline-flex items-center justify-center px-6 py-3.5 rounded-full border border-border-strong bg-transparent text-text-primary text-[15px] font-medium hover:bg-surface-muted transition-colors"
            >
              See workshops
            </Link>
            <Link
              href="/about"
              className="inline-flex items-center justify-center px-6 py-3.5 rounded-full text-text-brand text-[15px] font-medium hover:bg-surface-muted transition-colors"
            >
              Learn how it works
            </Link>
          </div>

        </div>
      </section>

      {/* ── CLINICAL BOUNDARY — canonical three-clause wording (V2) ─────────── */}
      <div className="border-t border-b border-border-default bg-surface-sunken py-5">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-[13.5px] leading-[1.7] text-text-secondary">
            <strong className="font-medium text-text-primary">A qualified human practitioner is always responsible for clinical judgement.</strong>{' '}
            Natural Intelligence supports care; it does not replace medical care.
            Technology here organises and assists — it makes no clinical decision.
          </p>
        </div>
      </div>

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

      {/* ── THE LIBRARY — the one thing genuinely open (V2 pine section) ───── */}
      <section className="relative overflow-hidden bg-brand-default py-16 md:py-20">
        {/* The single permitted gradient: a near-imperceptible radial inside a pine section */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-36 -right-32 w-[480px] h-[480px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(176,138,62,0.15), transparent 68%)' }}
        />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">

          <div>
            <p className="font-mono text-[11px] font-medium tracking-[0.14em] uppercase text-gold-pale mb-4">
              Open now
            </p>
            <h2 className="font-display text-[34px] md:text-[46px] font-light text-ni-cream leading-[1.08] tracking-[-0.024em] mb-4 [text-wrap:balance]">
              Start with <em className="italic font-normal text-gold-pale">The Library</em>.
            </h2>
            <p className="text-base font-light text-ni-cream/80 leading-[1.8] mb-8 max-w-md [text-wrap:pretty]">
              Reading on natural health, written and reviewed with care. No account
              needed, nothing to submit, nothing to upload — just clear, honest
              material to read at your own pace.
            </p>
            <Link
              href="/resources"
              className="inline-flex items-center justify-center px-6 py-3.5 rounded-full bg-ni-cream text-text-brand text-[15px] font-medium hover:bg-surface-raised transition-colors"
            >
              Explore The Library
            </Link>
          </div>

          {/* Reading themes — themes, not article titles (real titles pending
              founder ruling on Library content; V2 RECONCILIATION open Q2) */}
          <div className="flex flex-col gap-px rounded-[14px] overflow-hidden border border-ni-cream/[0.16] bg-ni-cream/[0.14]">
            {[
              {
                k: 'Foundations',
                v: 'What naturopathic care actually is',
                d: 'And what it is not. Scope, training, and where it sits alongside conventional medicine.',
              },
              {
                k: 'Preparing well',
                v: 'Questions worth asking a practitioner',
                d: 'How to arrive at a first consultation ready, and what a careful practitioner will ask you.',
              },
              {
                k: 'Boundaries',
                v: 'Reading health claims critically',
                d: 'How to tell considered practice from overreach — including ours.',
              },
            ].map((row) => (
              <div key={row.k} className="bg-brand-default px-6 py-5 flex flex-col gap-1.5">
                <span className="font-mono text-[10.5px] tracking-[0.12em] uppercase text-gold-pale">{row.k}</span>
                <span className="font-display text-xl text-ni-cream leading-snug">{row.v}</span>
                <span className="text-[13px] text-ni-cream/70 leading-relaxed">{row.d}</span>
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
                className="inline-flex items-center justify-center px-6 py-3.5 text-[15px] rounded-full bg-brand-default text-text-inverted hover:bg-brand-hover transition-colors font-medium"
              >
                Explore The Library
              </Link>
              <Link
                href="/about"
                className="inline-flex items-center justify-center px-6 py-3.5 text-[15px] rounded-full border border-border-strong bg-transparent text-text-primary hover:bg-surface-muted transition-colors font-medium"
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
