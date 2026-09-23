import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { copy } from '@/lib/copy'
import { communityWorkshops, workshopBoundaryNotice } from '@/lib/communityWorkshops'
import type { CommunityWorkshop } from '@/lib/communityWorkshops'
import { getEventPhase, isBookable, isUpcoming } from '@/lib/workshops/lifecycle'
import { createServerSupabaseClient, sendEmail, eventRegistrationConfirmationEmail } from '@natural-intelligence/db'
import { RegisterButton } from '@/components/register-button'
import { Pill } from '@natural-intelligence/ui'

export const metadata: Metadata = {
  title: 'Workshops & events',
  description:
    'Join expert-led workshops, webinars, and live Q&As on functional medicine and natural health.',
}

async function registerForEvent(eventId: string): Promise<{ error?: string }> {
  'use server'
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('event_registrations')
    .insert({ event_id: eventId, member_id: user.id })

  if (error) return { error: error.message }

  // Send confirmation email — fire-and-forget (failure must not block registration)
  try {
    const [{ data: event }, { data: profile }] = await Promise.all([
      supabase
        .from('events')
        .select('title, starts_at, is_online, meeting_url, profiles!events_hosted_by_fkey(full_name)')
        .eq('id', eventId)
        .single(),
      supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single(),
    ])

    if (event && user.email) {
      const starts = new Date(event.starts_at)
      const practitionerName = (event as any).profiles?.full_name ?? undefined

      await sendEmail(
        eventRegistrationConfirmationEmail({
          to:               user.email,
          memberName:       profile?.full_name ?? 'there',
          eventTitle:       event.title,
          eventDate:        starts.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
          eventTime:        starts.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          isOnline:         event.is_online ?? false,
          meetingUrl:       event.meeting_url ?? undefined,
          practitionerName,
        })
      )
    }
  } catch (emailErr) {
    // Email failure must never roll back the registration
    console.error('[registerForEvent] confirmation email failed:', emailErr)
  }

  return {}
}

interface WorkshopsPageProps {
  searchParams: { type?: string }
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

const formatEventTime = (dateStr: string) =>
  new Date(dateStr).toLocaleTimeString('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Europe/London',
  })

export default async function WorkshopsPage({ searchParams }: WorkshopsPageProps) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const now = new Date().toISOString()
  // meeting_url is intentionally excluded — it must not reach unauthenticated users.
  // Registered attendees receive it separately via email/dashboard (future feature).
  let query = supabase
    .from('events')
    .select(`
      id,
      title,
      description,
      event_type,
      starts_at,
      ends_at,
      location,
      is_online,
      max_capacity,
      status,
      profiles!events_hosted_by_fkey(full_name)
    `)
    .eq('status', 'published')
    .gt('starts_at', now)
    .order('starts_at', { ascending: true })

  if (searchParams.type) {
    query = query.eq('event_type', searchParams.type)
  }

  const { data: events } = await query

  // Get registration counts and user registrations
  const eventIds = (events ?? []).map((e: any) => e.id)
  let registrationCounts: Record<string, number> = {}
  let userRegistrations: Set<string> = new Set()

  if (eventIds.length > 0) {
    const { data: regCounts } = await supabase
      .from('event_registrations')
      .select('event_id')
      .in('event_id', eventIds)

    if (regCounts) {
      regCounts.forEach((r: any) => {
        registrationCounts[r.event_id] = (registrationCounts[r.event_id] ?? 0) + 1
      })
    }

    if (user) {
      const { data: userRegs } = await supabase
        .from('event_registrations')
        .select('event_id')
        .in('event_id', eventIds)
        .eq('member_id', user.id)

      if (userRegs) {
        userRegs.forEach((r: any) => userRegistrations.add(r.event_id))
      }
    }
  }

  const typeFilters = [
    { value: '', label: copy.workshops.filters.all },
    { value: 'workshop', label: copy.workshops.filters.workshop },
    { value: 'webinar', label: copy.workshops.filters.webinar },
    { value: 'qa', label: copy.workshops.filters.qa },
    { value: 'group_session', label: copy.workshops.filters.group_session },
  ]

  return (
    <div className="py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
      <div className="mb-10">
        <h1 className="font-display text-3xl md:text-4xl font-semibold text-text-primary mb-2">{copy.workshops.heading}</h1>
        <p className="text-text-secondary">{copy.workshops.subheading}</p>
      </div>

      {/* ── Community workshops (static Founder-supplied content) ──────────── */}
      {/* Upcoming soonest-first (date-TBC announcements after the dated ones),
          then past workshops most-recent-first. Derived from the canonical
          timestamps at request time (the page is already request-rendered). */}
      {communityWorkshops.length > 0 && (() => {
        const nowDate = new Date()
        const upcoming = communityWorkshops
          .filter((w) => !w.scheduling || isUpcoming(w.scheduling, nowDate))
          .sort((a, b) => {
            if (!a.scheduling) return 1
            if (!b.scheduling) return -1
            return new Date(a.scheduling.start).getTime() - new Date(b.scheduling.start).getTime()
          })
        const past = communityWorkshops
          .filter((w) => w.scheduling && !isUpcoming(w.scheduling, nowDate))
          .sort((a, b) => new Date(b.scheduling!.start).getTime() - new Date(a.scheduling!.start).getTime())
        return (
          <section className="mb-14">
            <h2 className="text-xl font-semibold text-text-primary mb-5">Community workshops</h2>
            {upcoming.length > 0 && (
              <div className="space-y-8">
                {upcoming.map((w) => (
                  <CommunityWorkshopCard key={w.slug} w={w} />
                ))}
              </div>
            )}
            {past.length > 0 && (
              <>
                <h3 className="text-base font-semibold text-text-secondary mt-10 mb-5">
                  {copy.workshopDetail.pastHeading}
                </h3>
                <div className="space-y-8">
                  {past.map((w) => (
                    <CommunityWorkshopCard key={w.slug} w={w} />
                  ))}
                </div>
              </>
            )}
          </section>
        )
      })()}

      {/* ── Online sessions & member events (platform-hosted) ──────────────── */}
      <h2 className="text-xl font-semibold text-text-primary mb-5">Online sessions &amp; member events</h2>

      {/* Type filters */}
      <div className="flex flex-wrap gap-2 mb-8">
        {typeFilters.map((f) => (
          <Link
            key={f.value}
            href={f.value ? `/workshops?type=${f.value}` : '/workshops'}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              (searchParams.type ?? '') === f.value
                ? 'bg-brand-default text-text-inverted'
                : 'border border-border-default text-text-secondary hover:bg-surface-muted'
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {!events || events.length === 0 ? (
        <p className="text-text-muted text-sm py-12 text-center">{copy.workshops.empty}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event: any) => {
            const date = new Date(event.starts_at)
            const hostProfile = event.profiles
            const regCount = registrationCounts[event.id] ?? 0
            const spotsLeft = event.max_capacity ? event.max_capacity - regCount : null
            const isFull = spotsLeft !== null && spotsLeft <= 0
            const isRegistered = userRegistrations.has(event.id)

            return (
              <div
                key={event.id}
                className="rounded-xl border border-border-default bg-surface-raised p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col"
              >
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <Pill>{event.event_type.replace('_', ' ')}</Pill>
                  {event.is_online && (
                    <Pill>{copy.workshops.card.online}</Pill>
                  )}
                </div>

                <h3 className="text-base font-semibold text-text-primary mb-2 leading-snug flex-1">
                  {event.title}
                </h3>

                {event.description && (
                  <p className="text-sm text-text-secondary line-clamp-2 mb-3 leading-relaxed">
                    {event.description}
                  </p>
                )}

                <p className="text-xs text-text-muted mb-1">
                  {date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <p className="text-xs text-text-muted mb-1">
                  {formatEventTime(event.starts_at)}
                </p>

                {hostProfile?.full_name && (
                  <p className="text-xs text-text-muted mb-3">{hostProfile.full_name}</p>
                )}

                {spotsLeft !== null && (
                  <p className="text-xs text-text-secondary mb-4">
                    {isFull ? copy.workshops.card.full : `${spotsLeft} ${copy.workshops.card.capacity}`}
                  </p>
                )}

                <div className="mt-auto">
                  <RegisterButton
                    eventId={event.id}
                    isLoggedIn={!!user}
                    isFull={isFull}
                    isRegistered={isRegistered}
                    registerAction={registerForEvent}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Education-only boundary — calm, single line block */}
      <p role="note" className="mt-12 text-xs text-text-muted leading-relaxed max-w-2xl">
        {workshopBoundaryNotice}
      </p>
    </div>
  )
}
