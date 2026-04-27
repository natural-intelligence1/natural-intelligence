import Link from 'next/link'
import { copy } from '@/lib/copy'
import { createServerSupabaseClient, sendEmail, eventRegistrationConfirmationEmail } from '@natural-intelligence/db'
import { RegisterButton } from '@/components/register-button'
import { Pill } from '@natural-intelligence/ui'

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
        <h1 className="text-3xl font-bold text-text-primary mb-2">{copy.workshops.heading}</h1>
        <p className="text-text-secondary">{copy.workshops.subheading}</p>
      </div>

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
                  {date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
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
    </div>
  )
}
