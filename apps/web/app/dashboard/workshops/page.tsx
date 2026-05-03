import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@natural-intelligence/db'
import { copy } from '@/lib/copy'
import { CancelRegistrationButton } from './CancelRegistrationButton'

function fmtDateTime(d: string) {
  const date = new Date(d)
  return {
    date: date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
    time: date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  }
}

export default async function DashboardWorkshopsPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: registrations } = await supabase
    .from('event_registrations')
    .select('*, events(id, title, event_type, starts_at, is_online, status)')
    .eq('member_id', user.id)
    .order('registered_at', { ascending: false })

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">{copy.dashboard.sections.workshops}</h1>
      </div>

      {!registrations || registrations.length === 0 ? (
        <div className="rounded-xl border border-border-default bg-surface-raised p-10 text-center">
          <p className="text-sm text-text-muted mb-4">{copy.dashboard.empty.workshops}</p>
          <Link
            href="/workshops"
            className="inline-block px-4 py-2 rounded-lg bg-brand-default hover:bg-brand-hover text-text-inverted text-sm font-medium transition-colors"
          >
            {copy.dashboard.quickLinks[1].label}
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {(registrations as any[]).map((reg) => {
            const event = reg.events
            if (!event) return null
            const { date, time } = fmtDateTime(event.starts_at)
            const isPast = new Date(event.starts_at) < new Date()
            const isCancelled = event.status === 'cancelled'
            return (
              <div
                key={reg.id}
                className={`rounded-xl border bg-surface-raised p-5 ${isCancelled ? 'border-status-errorBorder opacity-60' : 'border-border-default'}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text-primary mb-1">{event.title}</p>
                    <p className="text-xs text-text-muted mb-2">{date} · {time}</p>
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-block px-2 py-0.5 rounded-md bg-surface-muted text-text-secondary text-xs font-medium capitalize">
                        {event.event_type.replace(/_/g, ' ')}
                      </span>
                      {event.is_online && (
                        <span className="inline-block px-2 py-0.5 rounded-md bg-surface-muted text-text-secondary text-xs font-medium">
                          Online
                        </span>
                      )}
                      {isCancelled && (
                        <span className="inline-block px-2 py-0.5 rounded-md bg-status-errorBg text-status-errorText text-xs font-medium">
                          Cancelled by organiser
                        </span>
                      )}
                      {isPast && !isCancelled && (
                        <span className="inline-block px-2 py-0.5 rounded-md bg-surface-muted text-text-muted text-xs font-medium">
                          Past
                        </span>
                      )}
                    </div>
                  </div>
                  {!isPast && !isCancelled && (
                    <CancelRegistrationButton registrationId={reg.id} />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
