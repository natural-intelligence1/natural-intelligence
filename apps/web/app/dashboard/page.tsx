import Link from 'next/link'
import { redirect } from 'next/navigation'
import { copy } from '@/lib/copy'
import { createServerSupabaseClient } from '@natural-intelligence/db'

const sidebarLinks = [
  { label: 'Overview',     href: '/dashboard',          active: true  },
  { label: 'My workshops', href: '/dashboard/workshops', active: false },
  { label: 'My requests',  href: '/dashboard/requests',  active: false },
  { label: 'Intelligence', href: '/dashboard/intelligence', active: false, comingSoon: true },
  { label: 'Settings',     href: '/dashboard/settings',  active: false, comingSoon: true },
]

export default async function DashboardPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  // Practitioners get their own dedicated dashboard
  if (profile?.role === 'practitioner') redirect('/dashboard/practitioner')

  // Application status (for members who have applied to become practitioners)
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

  const firstName = profile?.full_name?.split(' ')[0] ?? null

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
      <div className="md:grid md:grid-cols-[220px_1fr] gap-8">

        {/* ── Sidebar nav ──────────────────────────────────────────────────── */}
        <aside className="hidden md:block">
          <div className="sticky top-24">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3 px-3">
              Dashboard
            </p>
            <nav className="space-y-0.5">
              {sidebarLinks.map((link) => (
                link.comingSoon ? (
                  <span
                    key={link.href}
                    className="flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-text-muted opacity-40 cursor-not-allowed"
                  >
                    {link.label}
                    <span className="text-2xs font-medium tracking-wide uppercase text-text-muted">Soon</span>
                  </span>
                ) : (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      link.active
                        ? 'bg-brand-subtle text-text-brand'
                        : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary'
                    }`}
                  >
                    {link.label}
                  </Link>
                )
              ))}
            </nav>
          </div>
        </aside>

        {/* ── Main content ─────────────────────────────────────────────────── */}
        <div>
          {/* Greeting */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-text-primary mb-0.5">
              {copy.dashboard.heading}{firstName ? `, ${firstName}` : ''}
            </h1>
            <p className="text-sm text-text-muted">{user.email}</p>
          </div>

          {/* ── Getting started card (shown until first action taken) ──────── */}
          {!application &&
            (!registrations || registrations.length === 0) &&
            (!supportRequests || supportRequests.length === 0) && (
            <section className="rounded-xl border border-border-default bg-surface-raised p-6 mb-8">
              <h2 className="text-base font-semibold text-text-primary mb-4">Getting started</h2>
              <div className="space-y-3">
                <Link
                  href="/directory"
                  className="flex items-center gap-3 p-3 rounded-lg border border-border-default hover:bg-surface-muted transition-colors group"
                >
                  <span className="text-text-brand text-sm">→</span>
                  <span className="text-sm font-medium text-text-primary group-hover:text-text-brand transition-colors">
                    Browse the practitioner directory
                  </span>
                </Link>
                <Link
                  href="/workshops"
                  className="flex items-center gap-3 p-3 rounded-lg border border-border-default hover:bg-surface-muted transition-colors group"
                >
                  <span className="text-text-brand text-sm">→</span>
                  <span className="text-sm font-medium text-text-primary group-hover:text-text-brand transition-colors">
                    Explore upcoming workshops
                  </span>
                </Link>
                <Link
                  href="/support"
                  className="flex items-center gap-3 p-3 rounded-lg border border-border-default hover:bg-surface-muted transition-colors group"
                >
                  <span className="text-text-brand text-sm">→</span>
                  <span className="text-sm font-medium text-text-primary group-hover:text-text-brand transition-colors">
                    Submit a support request
                  </span>
                </Link>
              </div>
            </section>
          )}

          {/* Metric cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
            <div className="rounded-xl border border-border-default bg-surface-raised p-5 shadow-sm">
              <p className="text-xs text-text-muted mb-1">Workshops</p>
              <p className="text-2xl font-semibold text-text-primary">{registrations?.length ?? 0}</p>
            </div>
            <div className="rounded-xl border border-border-default bg-surface-raised p-5 shadow-sm">
              <p className="text-xs text-text-muted mb-1">Requests</p>
              <p className="text-2xl font-semibold text-text-primary">{supportRequests?.length ?? 0}</p>
            </div>
            <div className="rounded-xl border border-border-default bg-surface-raised p-5 shadow-sm col-span-2 sm:col-span-1">
              <p className="text-xs text-text-muted mb-1">Role</p>
              <p className="text-sm font-semibold text-text-primary capitalize">{profile?.role ?? 'Member'}</p>
            </div>
          </div>

          {/* ── Application status banner (members who have applied) ── */}
          {application && (
            <section className="rounded-xl border border-border-default bg-surface-raised p-5 mb-8">
              <p className="text-sm font-semibold text-text-primary mb-1">
                {copy.dashboard.sections.application}
              </p>
              <p className="text-sm text-text-secondary">
                {copy.dashboard.application[application.status as keyof typeof copy.dashboard.application]
                  ?? copy.dashboard.application.submitted}
              </p>
            </section>
          )}

          {/* ── Registered workshops ──────────────────────────────────────────── */}
          <section className="mb-8">
            <h2 className="text-base font-semibold text-text-primary mb-4 pb-3 border-b border-border-default">
              {copy.dashboard.sections.workshops}
            </h2>
            {!registrations || registrations.length === 0 ? (
              <div className="rounded-xl border border-border-default bg-surface-raised p-6 text-center">
                <p className="text-sm text-text-muted mb-4">{copy.dashboard.empty.workshops}</p>
                <Link href="/workshops"
                  className="inline-block px-4 py-2 rounded-lg bg-brand-default hover:bg-brand-hover text-text-inverted text-sm font-medium transition-colors">
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

          {/* ── Support requests ──────────────────────────────────────────────── */}
          <section className="mb-8">
            <h2 className="text-base font-semibold text-text-primary mb-4 pb-3 border-b border-border-default">
              {copy.dashboard.sections.requests}
            </h2>
            {!supportRequests || supportRequests.length === 0 ? (
              <div className="rounded-xl border border-border-default bg-surface-raised p-6 text-center">
                <p className="text-sm text-text-muted mb-4">{copy.dashboard.empty.requests}</p>
                <Link href="/support"
                  className="inline-block px-4 py-2 rounded-lg bg-brand-default hover:bg-brand-hover text-text-inverted text-sm font-medium transition-colors">
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

          {/* ── Intelligence teaser ───────────────────────────────────────────── */}
          <section className="rounded-xl border border-border-default bg-surface-raised p-6">
            <p className="text-xs font-semibold text-text-brand uppercase tracking-wider mb-2">Coming soon</p>
            <h3 className="text-sm font-semibold text-text-primary mb-1">Care intelligence</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              Personalised daily protocols, lab result interpretation, and AI-assisted pattern recognition — built around you, guided by your practitioner.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
