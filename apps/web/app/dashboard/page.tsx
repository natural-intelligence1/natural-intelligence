import Link from 'next/link'
import { redirect } from 'next/navigation'
import { copy } from '@/lib/copy'
import { createServerSupabaseClient } from '@natural-intelligence/db'

function CompletenessBar({ pct }: { pct: number }) {
  const colour = pct === 100 ? 'bg-status-successText' : pct >= 60 ? 'bg-status-warningText' : 'bg-status-errorText'
  return (
    <div className="mt-2">
      <div className="h-1.5 rounded-full bg-surface-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all ${colour}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-brand-text mt-1">{copy.dashboard.practitioner.activePct(pct)}</p>
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  // Application status (for non-practitioner users who may have applied)
  const { data: application } = await supabase
    .from('practitioner_applications')
    .select('status')
    .eq('profile_id', user.id)
    .maybeSingle()

  // Registered workshops
  const { data: registrations } = await supabase
    .from('event_registrations')
    .select('*, events(id, title, event_type, starts_at, is_online, status)')
    .eq('member_id', user.id)
    .order('registered_at', { ascending: false })
    .limit(10)

  // Support requests — queried through the safe member view, which excludes
  // internal admin fields (admin_notes, assigned_to) at the database layer.
  const { data: supportRequests } = await supabase
    .from('member_support_requests')
    .select('id, request_type, description, urgency, status, submitted_at')
    .order('submitted_at', { ascending: false })
    .limit(10)

  // Practitioner row (if applicable)
  let practitionerRow: {
    id: string; tagline: string | null; is_directory_ready: boolean
    profile_completeness_pct: number; lifecycle_status: string
  } | null = null

  if (profile?.role === 'practitioner') {
    const { data: pRow } = await supabase
      .from('practitioners')
      .select('id, tagline, is_directory_ready, profile_completeness_pct, lifecycle_status')
      .eq('profile_id', user.id)
      .maybeSingle()
    practitionerRow = pRow ?? null
  }

  const firstName = profile?.full_name?.split(' ')[0] ?? null

  return (
    <div className="py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-text-primary mb-1">
          {copy.dashboard.heading}{firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="text-sm text-text-muted">{user.email}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">

          {/* ── Practitioner profile banner ─────────────────────────────── */}
          {profile?.role === 'practitioner' && practitionerRow && (
            <section className="rounded-xl border border-brand-default bg-brand-light p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-brand-text mb-1">
                    {copy.dashboard.sections.practitioner}
                  </p>
                  <p className="text-xs text-brand-text opacity-80">
                    {practitionerRow.is_directory_ready
                      ? copy.dashboard.practitioner.readyForDirectory
                      : copy.dashboard.practitioner.notReadyForDirectory}
                  </p>
                  <CompletenessBar pct={practitionerRow.profile_completeness_pct} />
                </div>
                <Link href="/dashboard/profile"
                  className="flex-shrink-0 px-4 py-2 rounded-lg bg-brand-default hover:bg-brand-hover text-white text-xs font-medium transition-colors">
                  {practitionerRow.tagline
                    ? copy.dashboard.practitioner.editProfile
                    : copy.dashboard.practitioner.completeProfileCta}
                </Link>
              </div>
            </section>
          )}

          {/* ── Application status banner (non-practitioners who applied) ── */}
          {!practitionerRow && application && (
            <section className="rounded-xl border border-border-default bg-surface-raised p-5">
              <p className="text-sm font-semibold text-text-primary mb-1">
                {copy.dashboard.sections.application}
              </p>
              <p className="text-sm text-text-secondary">
                {copy.dashboard.application[application.status as keyof typeof copy.dashboard.application]
                  ?? copy.dashboard.application.submitted}
              </p>
            </section>
          )}

          {/* ── Registered workshops ──────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-5 pb-3 border-b border-border-default">
              {copy.dashboard.sections.workshops}
            </h2>
            {!registrations || registrations.length === 0 ? (
              <div className="rounded-xl border border-border-default bg-surface-raised p-6 text-center">
                <p className="text-sm text-text-muted mb-4">{copy.dashboard.empty.workshops}</p>
                <Link href="/workshops"
                  className="inline-block px-4 py-2 rounded-lg bg-brand-default hover:bg-brand-hover text-white text-sm font-medium transition-colors">
                  {copy.dashboard.quickLinks[1].label}
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {registrations.map((reg: any) => {
                  const event = reg.events
                  if (!event) return null
                  const date = new Date(event.starts_at)
                  return (
                    <div key={reg.id} className="rounded-xl border border-border-default bg-surface-raised p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-text-primary mb-1">{event.title}</p>
                          <p className="text-xs text-text-muted">
                            {date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                            {' '}{date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <span className="inline-block px-2 py-0.5 rounded-md bg-surface-muted text-text-secondary text-xs font-medium capitalize flex-shrink-0">
                          {event.event_type.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* ── Support requests ──────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-5 pb-3 border-b border-border-default">
              {copy.dashboard.sections.requests}
            </h2>
            {!supportRequests || supportRequests.length === 0 ? (
              <div className="rounded-xl border border-border-default bg-surface-raised p-6 text-center">
                <p className="text-sm text-text-muted mb-4">{copy.dashboard.empty.requests}</p>
                <Link href="/support"
                  className="inline-block px-4 py-2 rounded-lg bg-brand-default hover:bg-brand-hover text-white text-sm font-medium transition-colors">
                  {copy.dashboard.quickLinks[2].label}
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {supportRequests.map((req: any) => {
                  const statusCopy = copy.dashboard.status[req.status as keyof typeof copy.dashboard.status] ?? req.status
                  return (
                    <div key={req.id} className="rounded-xl border border-border-default bg-surface-raised p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-text-primary mb-1 capitalize">
                            {req.request_type.replace('_', ' ')}
                          </p>
                          <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">{req.description}</p>
                          <p className="text-xs text-text-muted mt-1">
                            {new Date(req.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                        <span className="inline-block px-2 py-0.5 rounded-md bg-surface-muted text-text-secondary text-xs font-medium flex-shrink-0">
                          {statusCopy}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        {/* ── Quick links sidebar ───────────────────────────────────────── */}
        <div>
          <h2 className="text-lg font-semibold text-text-primary mb-5 pb-3 border-b border-border-default">
            {copy.dashboard.sections.quickLinks}
          </h2>
          <div className="space-y-2">
            {copy.dashboard.quickLinks.map((link) => (
              <Link key={link.href} href={link.href}
                className="flex items-center justify-between px-4 py-3 rounded-lg border border-border-default bg-surface-raised hover:bg-surface-muted transition-colors">
                <span className="text-sm font-medium text-text-primary">{link.label}</span>
                <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
