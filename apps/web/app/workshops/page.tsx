import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { copy } from '@/lib/copy'
import { workshopBoundaryNotice } from '@/lib/communityWorkshops'
import type { CommunityWorkshop } from '@/lib/communityWorkshops'
import { getEventPhase, isBookable } from '@/lib/workshops/lifecycle'
import { getUpcomingWorkshops, getPastWorkshops, getUndatedWorkshops } from '@/lib/workshops/selectors'
import { Pill } from '@natural-intelligence/ui'

// Lifecycle phases are derived from the canonical timestamps at request time,
// so a workshop moves open → closed → past without a rebuild.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Workshops & events',
  description:
    'Join expert-led workshops, webinars, and live Q&As on functional medicine and natural health.',
}

// ─── Community workshop card (static Founder-supplied content) ────────────────
// Renders a communityWorkshops entry. No registration form and no health-data
// capture: booking (where open) is an external WhatsApp group link only.
// Entries with canonical `scheduling` derive their booking state live
// (open → closed → past) instead of showing a stale static CTA.
function CommunityWorkshopCard({ w }: { w: CommunityWorkshop }) {
  const now = new Date()
  const phase = w.scheduling ? getEventPhase(w.scheduling, now) : null
  const showBooking = !!w.booking && (!w.scheduling || isBookable(w.scheduling, now))
  return (
    <article className="rounded-2xl border border-border-default bg-surface-raised shadow-sm overflow-hidden">
      <div className={w.poster ? 'grid grid-cols-1 md:grid-cols-[minmax(0,320px)_1fr]' : ''}>

        {w.poster && (
          <div className="p-5 md:pr-0 flex items-start justify-center md:justify-start">
            <Image
              src={w.poster.src}
              width={w.poster.width}
              height={w.poster.height}
              alt={w.poster.alt}
              className="rounded-xl border border-border-muted w-full max-w-[320px] h-auto"
            />
          </div>
        )}

        <div className="p-6 md:p-8">
          {/* Status + audience + cost */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {w.status === 'coming_soon' && w.statusLabel && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-surface-muted text-text-secondary border border-border-muted">
                {w.statusLabel}
              </span>
            )}
            <Pill>{w.audience}</Pill>
            <Pill>{w.cost}</Pill>
          </div>

          <h3 className="font-display text-2xl md:text-3xl font-semibold text-text-primary mb-1">
            {w.title}
          </h3>
          {w.subtitle && (
            <p className="font-display text-lg text-text-secondary italic mb-1">{w.subtitle}</p>
          )}
          <p className="text-sm text-text-secondary mb-1">
            Presented by {w.presentedBy} — <span className="italic">{w.tagline}</span>
          </p>
          <p className="text-xs font-medium tracking-wide uppercase text-text-brand mb-5">{w.theme}</p>

          {/* Date / time / venue */}
          <div className="rounded-xl border border-border-muted bg-surface-base p-4 mb-5 text-sm text-text-secondary space-y-1">
            <p className="font-medium text-text-primary">{w.date} · {w.time}</p>
            <p>{w.venueLines.join(', ')}</p>
            {w.venueNote && <p className="text-text-muted">({w.venueNote})</p>}
          </div>

          <p className="text-sm text-text-secondary leading-relaxed mb-5">{w.intro}</p>
          {w.provisionalNote && (
            <p className="text-sm text-text-secondary leading-relaxed mb-5">{w.provisionalNote}</p>
          )}

          {/* Guest practitioners */}
          {w.practitioners.length > 0 && (
            <div className="mb-5">
              <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
                Our guest practitioners
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {w.practitioners.map((p) => (
                  <div key={p.name} className="rounded-xl border border-border-muted bg-surface-base p-4">
                    <p className="text-sm font-semibold text-text-primary">{p.name}</p>
                    <p className="text-xs text-text-muted mb-2">{p.credentials.join(' · ')}</p>
                    <p className="text-sm font-medium text-text-brand mb-1.5 leading-snug">{p.topic}</p>
                    <p className="text-xs text-text-secondary leading-relaxed">{p.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {w.practitionersNote && (
            <p className="text-sm text-text-muted mb-5">{w.practitionersNote}</p>
          )}

          {/* What to expect / learn about */}
          {(w.whatToExpect || w.learnAbout) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              {w.whatToExpect && (
                <div>
                  <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">What to expect</h4>
                  <ul className="text-sm text-text-secondary space-y-1">
                    {w.whatToExpect.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span aria-hidden="true" className="mt-1.5 w-1 h-1 rounded-full bg-brand-default flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {w.learnAbout && (
                <div>
                  <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Learn about</h4>
                  <ul className="text-sm text-text-secondary space-y-1">
                    {w.learnAbout.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span aria-hidden="true" className="mt-1.5 w-1 h-1 rounded-full bg-brand-default flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {w.connect && (
            <p className="text-sm text-text-secondary leading-relaxed mb-5">{w.connect}</p>
          )}

          {/* Booking — live entries only; closed/past states shown calmly */}
          {showBooking && w.booking && (
            <div className="rounded-xl border border-border-default bg-brand-subtle/40 p-5 mb-4">
              <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Register free</h4>
              {w.registerLines && (
                <p className="text-sm text-text-secondary mb-3">{w.registerLines.join(' ')}</p>
              )}
              <p className="text-sm text-text-secondary mb-3">{w.booking.instruction}</p>
              <a
                href={w.booking.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-brand-default text-text-inverted text-sm font-medium hover:bg-brand-hover transition-colors mb-3"
              >
                {w.booking.linkLabel}
              </a>
              <p className="text-sm font-medium text-text-primary">{w.booking.deadline}</p>
            </div>
          )}
          {!showBooking && phase === 'booking_open' && w.scheduling?.bookingState === 'full' && (
            <p className="text-sm font-medium text-text-primary mb-4">{copy.workshopDetail.fullyBooked}</p>
          )}
          {phase === 'booking_closed_upcoming' && w.scheduling?.bookingState !== 'full' && (
            <p className="text-sm font-medium text-text-primary mb-4">{copy.workshopDetail.bookingClosed}</p>
          )}
          {phase === 'past' && (
            <p className="text-sm font-medium text-text-muted mb-4">{copy.workshopDetail.eventPast}</p>
          )}
          {w.bookingComingSoon && (
            <p className="text-sm font-medium text-text-muted mb-4">{w.bookingComingSoon}</p>
          )}

          {w.scheduling && (
            <p className="mb-4">
              <Link
                href={`/workshops/${w.slug}`}
                className="text-sm font-medium text-brand-default hover:underline"
              >
                {copy.workshopDetail.fullDetails} →
              </Link>
            </p>
          )}

          {phase !== 'past' && w.closing && <p className="text-sm text-text-secondary mb-1">{w.closing}</p>}
          {phase !== 'past' && w.shareNote && <p className="text-xs text-text-muted">{w.shareNote}</p>}
        </div>
      </div>
    </article>
  )
}

export default function WorkshopsPage() {
  // ONE source of truth: the canonical registry, read through the shared
  // selectors the homepage preview also uses. Dated workshops sort upcoming
  // soonest-first then past most-recent-first; undated announcements follow
  // the dated upcoming ones.
  const now = new Date()
  const upcoming = [...getUpcomingWorkshops(now), ...getUndatedWorkshops()]
  const past = getPastWorkshops(now)

  return (
    <div className="py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
      <div className="mb-10">
        <h1 className="font-display text-3xl md:text-4xl font-semibold text-text-primary mb-2">{copy.workshops.heading}</h1>
        <p className="text-text-secondary">{copy.workshops.subheading}</p>
      </div>

      {upcoming.length > 0 && (
        <section aria-labelledby="upcoming-workshops" className="mb-14">
          <h2 id="upcoming-workshops" className="text-xl font-semibold text-text-primary mb-5">
            {copy.workshopDetail.upcomingHeading}
          </h2>
          <div className="space-y-8">
            {upcoming.map((w) => (
              <CommunityWorkshopCard key={w.slug} w={w} />
            ))}
          </div>
        </section>
      )}

      {upcoming.length === 0 && (
        <p className="text-text-muted text-sm mb-14">{copy.workshopDetail.nextAnnouncedSoon}</p>
      )}

      {past.length > 0 && (
        <section aria-labelledby="past-workshops" className="mb-14">
          <h2 id="past-workshops" className="text-xl font-semibold text-text-primary mb-5">
            {copy.workshopDetail.pastHeading}
          </h2>
          <div className="space-y-8">
            {past.map((w) => (
              <CommunityWorkshopCard key={w.slug} w={w} />
            ))}
          </div>
        </section>
      )}

      {/* Education-only boundary — calm, single line block */}
      <p role="note" className="mt-12 text-xs text-text-muted leading-relaxed max-w-2xl">
        {workshopBoundaryNotice}
      </p>
    </div>
  )
}
