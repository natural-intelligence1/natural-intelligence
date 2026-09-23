import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { communityWorkshops, eventHealthNotice } from '@/lib/communityWorkshops'
import type { CommunityWorkshop } from '@/lib/communityWorkshops'
import { copy } from '@/lib/copy'
import { getEventPhase, isBookable, isUpcoming } from '@/lib/workshops/lifecycle'

// Phase (booking open → closed → past) is derived from the canonical
// timestamps at request time — the page can never go stale in a static build.
export const dynamic = 'force-dynamic'

const SITE_URL = 'https://natural-intelligence.uk'

interface WorkshopPageProps {
  params: { slug: string }
}

// Only registry entries carrying canonical scheduling have detail pages.
function findWorkshop(slug: string): CommunityWorkshop | undefined {
  return communityWorkshops.find((w) => w.slug === slug && w.scheduling)
}

export function generateMetadata({ params }: WorkshopPageProps): Metadata {
  const event = findWorkshop(params.slug)
  if (!event) return {}
  const canonical = `${SITE_URL}/workshops/${event.slug}`
  const title = event.metaTitle ?? `${event.title} — Natural Intelligence`
  const description = event.metaDescription ?? event.excerpt ?? event.intro
  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    openGraph: {
      type: 'website',
      siteName: 'Natural Intelligence',
      title,
      description,
      url: canonical,
      ...(event.poster
        ? {
            images: [
              {
                url: `${SITE_URL}${event.poster.src}`,
                width: event.poster.width,
                height: event.poster.height,
                alt: event.poster.alt,
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(event.poster ? { images: [`${SITE_URL}${event.poster.src}`] } : {}),
    },
    robots: { index: true, follow: true },
  }
}

function buildEventJsonLd(event: CommunityWorkshop, now: Date) {
  const scheduling = event.scheduling!
  const canonical = `${SITE_URL}/workshops/${event.slug}`
  const offer: Record<string, unknown> = {
    '@type': 'Offer',
    price: 0,
    priceCurrency: 'GBP',
    url: event.booking?.url,
    validThrough: scheduling.bookingClosesAt,
  }
  // Availability reflects live bookability; once bookings close, validThrough
  // alone conveys expiry (schema.org has no "closed" availability value).
  if (isBookable(scheduling, now)) {
    offer.availability = 'https://schema.org/InStock'
  } else if (scheduling.bookingState === 'full' && getEventPhase(scheduling, now) === 'booking_open') {
    offer.availability = 'https://schema.org/SoldOut'
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description: event.subtitle ?? event.excerpt ?? event.intro,
    startDate: scheduling.start,
    endDate: scheduling.end,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    url: canonical,
    ...(event.poster ? { image: `${SITE_URL}${event.poster.src}` } : {}),
    location: {
      '@type': 'Place',
      name: 'Ilford Community Centre',
      address: {
        '@type': 'PostalAddress',
        streetAddress: '15 Albert Road',
        addressLocality: 'Ilford',
        postalCode: 'IG1 1NG',
        addressCountry: 'GB',
      },
    },
    offers: offer,
    ...(event.speaker ? { performer: { '@type': 'Person', name: event.speaker.name } } : {}),
    organizer: {
      '@type': 'Organization',
      name: 'Natural Intelligence',
      url: SITE_URL,
    },
    audience: { '@type': 'Audience', audienceType: event.audience },
    isAccessibleForFree: true,
  }
}

export default function WorkshopDetailPage({ params }: WorkshopPageProps) {
  const event = findWorkshop(params.slug)
  if (!event) notFound()

  const scheduling = event.scheduling!
  const now = new Date()
  const phase = getEventPhase(scheduling, now)
  const bookable = isBookable(scheduling, now)
  const isFull = scheduling.bookingState === 'full' && phase === 'booking_open'
  const jsonLd = buildEventJsonLd(event, now)
  const t = copy.workshopDetail

  // Past phase: the soonest other workshop that has not yet ended, if any.
  const nextEvent =
    phase === 'past'
      ? communityWorkshops
          .filter((w) => w.scheduling && w.slug !== event.slug && isUpcoming(w.scheduling, now))
          .sort((a, b) => new Date(a.scheduling!.start).getTime() - new Date(b.scheduling!.start).getTime())[0]
      : undefined

  return (
    <div className="py-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav aria-label="Breadcrumb" className="mb-8 text-sm">
        <Link
          href="/workshops"
          className="text-text-muted hover:text-text-primary transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-default rounded"
        >
          ← {t.backToWorkshops}
        </Link>
      </nav>

      <header className="mb-10">
        {event.series && (
          <p className="text-xs font-medium tracking-wide uppercase text-gold-ink mb-3">{event.series}</p>
        )}
        <h1 className="font-display text-4xl md:text-5xl font-semibold text-text-primary mb-2">
          {event.title}
        </h1>
        {event.subtitle && (
          <p className="font-display text-xl md:text-2xl text-text-secondary italic">{event.subtitle}</p>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,380px)_1fr] gap-10">
        {/* Poster */}
        {event.poster && (
          <div>
            <Image
              src={event.poster.src}
              width={event.poster.width}
              height={event.poster.height}
              alt={event.poster.alt}
              priority
              sizes="(max-width: 768px) 100vw, 380px"
              className="rounded-2xl border border-border-muted w-full h-auto shadow-sm"
            />
          </div>
        )}

        <div>
          {/* ── Summary block ── */}
          <dl className="rounded-2xl border border-border-default bg-surface-raised p-6 mb-8 text-sm space-y-4">
            <div>
              <dt className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                {t.summary.when}
              </dt>
              <dd className="text-text-primary font-medium">
                <time dateTime={scheduling.start}>{event.date}</time>
                <br />
                {event.time}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                {t.summary.where}
              </dt>
              <dd className="text-text-secondary">
                {event.venueLines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
                {event.venueNote && <span className="block text-text-muted">({event.venueNote})</span>}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                {t.summary.details}
              </dt>
              <dd className="text-text-primary">
                <span className="block font-medium">{event.cost}</span>
                <span className="block font-medium">{event.audience}</span>
                <span className="block">{t.summary.bookingEssential}</span>
              </dd>
            </div>
            {event.speaker && (
              <div>
                <dt className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                  {t.summary.speaker}
                </dt>
                <dd className="text-text-secondary">
                  <span className="block font-medium text-text-primary">{event.speaker.name}</span>
                  <span className="block">{event.speaker.title}</span>
                </dd>
              </div>
            )}
          </dl>

          {/* ── Body copy (verbatim) ── */}
          {(event.detailCopy?.intro ?? [event.intro]).map((paragraph) => (
            <p key={paragraph.slice(0, 40)} className="text-text-secondary leading-relaxed mb-4">
              {paragraph}
            </p>
          ))}

          {event.detailCopy?.lookAt && (
            <section aria-labelledby="look-at" className="my-8">
              <h2 id="look-at" className="text-lg font-semibold text-text-primary mb-3">
                {t.lookAtHeading}
              </h2>
              <ul className="text-text-secondary space-y-2">
                {event.detailCopy.lookAt.map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <span aria-hidden="true" className="mt-2 w-1 h-1 rounded-full bg-brand-default flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ── Booking (phase-aware; WhatsApp link is the entire mechanism) ── */}
          <section aria-labelledby="booking" className="my-8">
            <h2 id="booking" className="text-lg font-semibold text-text-primary mb-3">
              {t.bookingHeading}
            </h2>

            {bookable && event.booking && (
              <div className="rounded-2xl border border-border-default bg-brand-subtle/40 p-6">
                {event.detailCopy?.booking.map((paragraph) => (
                  <p key={paragraph.slice(0, 40)} className="text-sm text-text-secondary leading-relaxed mb-3">
                    {paragraph}
                  </p>
                ))}
                <a
                  href={event.booking.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center px-7 py-3.5 rounded-lg bg-brand-default text-text-inverted text-sm font-medium hover:bg-brand-hover transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-default"
                >
                  {event.booking.linkLabel}
                </a>
              </div>
            )}

            {isFull && <p className="text-text-primary font-medium">{t.fullyBooked}</p>}

            {phase === 'booking_closed_upcoming' && !isFull && (
              <p className="text-text-primary font-medium">{t.bookingClosed}</p>
            )}

            {phase === 'past' && (
              <div className="text-sm text-text-secondary space-y-2">
                <p>{t.eventPast}</p>
                {nextEvent ? (
                  <p>
                    {t.nextWorkshop}{' '}
                    <Link
                      href={`/workshops/${nextEvent.slug}`}
                      className="font-medium text-brand-default hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-default rounded"
                    >
                      {nextEvent.title} — {nextEvent.date}
                    </Link>
                  </p>
                ) : (
                  <p>
                    {t.nextAnnouncedSoon}{' '}
                    <Link
                      href="/workshops"
                      className="font-medium text-brand-default hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-default rounded"
                    >
                      {t.seeAllWorkshops}
                    </Link>
                  </p>
                )}
              </div>
            )}
          </section>

          {/* ── Health notice — always fully visible ── */}
          <p role="note" className="text-xs text-text-muted leading-relaxed border-t border-border-muted pt-5 mt-10">
            {eventHealthNotice}
          </p>
        </div>
      </div>
    </div>
  )
}
