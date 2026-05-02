import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'

// ─── Sidebar ──────────────────────────────────────────────────────────────────

const sidebarLinks = [
  { label: 'Overview',   href: '/dashboard/practitioner',         active: true  },
  { label: 'My profile', href: '/dashboard/practitioner/profile', active: false },
  { label: 'Referrals',  href: null,                              active: false, comingSoon: true },
  { label: 'Workshops',  href: '/workshops',                      active: false },
]

const MODULES = ['DailyPath', 'BioHub', 'RootFinder', 'LifeTracker', 'AutoAdjust'] as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeGreeting(): string {
  const h = new Date().getUTCHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function statusColor(status: string): string {
  const map: Record<string, string> = {
    new:       'bg-status-warningText',
    in_review: 'bg-brand-default',
    actioned:  'bg-status-successText',
    closed:    'bg-surface-muted',
  }
  return map[status] ?? 'bg-surface-muted'
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    new:       'New',
    in_review: 'In review',
    actioned:  'Actioned',
    closed:    'Closed',
  }
  return map[status] ?? status
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PractitionerDashboardPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'practitioner') redirect('/dashboard')

  // Fetch the practitioner row
  const adminClient = createAdminClient()
  const { data: practitioner } = await adminClient
    .from('practitioners')
    .select('id, tagline, is_directory_ready, profile_completeness_pct, lifecycle_status, practitioner_tier, trust_level')
    .eq('profile_id', user.id)
    .maybeSingle()

  if (!practitioner) redirect('/dashboard')

  // Fetch referrals (support requests assigned to this practitioner)
  const { data: referrals } = await adminClient
    .from('support_requests')
    .select('id, request_type, description, urgency, status, submitted_at, full_name')
    .eq('assigned_to', user.id)
    .order('submitted_at', { ascending: false })
    .limit(5)

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'
  const pct       = practitioner.profile_completeness_pct ?? 0
  const isLive    = practitioner.is_directory_ready

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
      <div className="md:grid md:grid-cols-[220px_1fr] gap-8">

        {/* ── Sidebar nav ──────────────────────────────────────────────────── */}
        <aside className="hidden md:block">
          <div className="sticky top-24">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3 px-3">
              Practitioner
            </p>
            <nav className="space-y-0.5">
              {sidebarLinks.map((link) =>
                link.comingSoon ? (
                  <span
                    key={link.label}
                    className="flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-text-muted opacity-40 cursor-not-allowed"
                  >
                    {link.label}
                    <span className="text-[10px] font-medium tracking-wide uppercase text-text-muted">
                      Soon
                    </span>
                  </span>
                ) : (
                  <Link
                    key={link.label}
                    href={link.href!}
                    className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      link.active
                        ? 'bg-brand-subtle text-text-brand'
                        : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary'
                    }`}
                  >
                    {link.label}
                  </Link>
                )
              )}
            </nav>
          </div>
        </aside>

        {/* ── Main content ─────────────────────────────────────────────────── */}
        <div>

          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold text-text-primary mb-1">
                {timeGreeting()}, {firstName}.
              </h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-subtle text-text-brand">
                Practitioner
              </span>
            </div>
          </div>

          {/* Directory status card */}
          <section className="rounded-xl border border-border-default bg-surface-raised p-5 mb-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <span
                  className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                    isLive ? 'bg-status-successText' : 'bg-status-warningText'
                  }`}
                />
                <div>
                  {isLive ? (
                    <>
                      <p className="text-sm font-medium text-text-primary mb-0.5">
                        Your profile is live in the directory
                      </p>
                      <p className="text-xs text-text-muted">
                        Members can find and view your profile now.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-text-primary mb-0.5">
                        Your profile is not yet visible in the directory
                      </p>
                      <p className="text-xs text-text-muted">
                        Complete your profile to go live.
                      </p>
                    </>
                  )}
                </div>
              </div>
              <Link
                href={isLive ? `/directory/${practitioner.id}` : '/dashboard/practitioner/profile'}
                className="flex-shrink-0 text-sm font-medium text-text-brand hover:underline"
              >
                {isLive ? 'View your profile →' : 'Edit your profile →'}
              </Link>
            </div>

            {/* Completeness bar */}
            <div className="mt-5 pt-4 border-t border-border-default">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-text-secondary">Profile completeness</p>
                <p className="text-xs text-text-muted">{pct}%</p>
              </div>
              <div className="h-2 rounded-full bg-surface-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-brand-default transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </section>

          {/* Metric row */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="rounded-xl border border-border-default bg-surface-raised p-5 shadow-sm">
              <p className="text-xs text-text-muted mb-1">Directory</p>
              <p className={`text-sm font-semibold ${isLive ? 'text-status-successText' : 'text-text-muted'}`}>
                {isLive ? 'Live' : 'Not visible'}
              </p>
            </div>
            <div className="rounded-xl border border-border-default bg-surface-raised p-5 shadow-sm">
              <p className="text-xs text-text-muted mb-1">Referrals</p>
              <p className="text-2xl font-semibold text-text-primary">{referrals?.length ?? 0}</p>
            </div>
            <div className="rounded-xl border border-border-default bg-surface-raised p-5 shadow-sm">
              <p className="text-xs text-text-muted mb-1">Profile score</p>
              <p className="text-2xl font-semibold text-text-primary">{pct}%</p>
            </div>
          </div>

          {/* Recent referrals */}
          <section className="mb-8">
            <h2 className="text-base font-semibold text-text-primary mb-4 pb-3 border-b border-border-default">
              Recent referrals
            </h2>
            {!referrals || referrals.length === 0 ? (
              <div className="rounded-xl border border-border-default bg-surface-raised p-6 text-center">
                <p className="text-sm text-text-muted">
                  No referrals yet. Complete your profile to start receiving referrals.
                </p>
                <Link
                  href="/dashboard/practitioner/profile"
                  className="inline-block mt-4 px-4 py-2 rounded-lg bg-brand-default hover:bg-brand-hover text-text-inverted text-sm font-medium transition-colors"
                >
                  Complete profile →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {referrals.map((ref: any) => (
                  <div
                    key={ref.id}
                    className="rounded-xl border border-border-default bg-surface-raised p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-primary capitalize mb-0.5">
                          {ref.request_type?.replace('_', ' ')}
                        </p>
                        <p className="text-xs text-text-muted">
                          {new Date(ref.submitted_at).toLocaleDateString('en-GB', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium text-text-inverted flex-shrink-0 ${statusColor(ref.status)}`}
                      >
                        {statusLabel(ref.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Intelligence teaser — dark obsidian shell */}
          <section
            className="rounded-xl p-6"
            style={{ background: '#0E0D0B', color: '#F8F6F2' }}
          >
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.14em] mb-3"
              style={{ color: '#B8935A' }}
            >
              Coming soon
            </p>
            <h3 className="text-sm font-semibold mb-3" style={{ color: '#F8F6F2' }}>
              Care intelligence
            </h3>
            <div className="flex flex-wrap gap-2 mb-5">
              {MODULES.map((mod) => (
                <span
                  key={mod}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium"
                  style={{
                    background:   '#1A1917',
                    border:       '1px solid rgba(184, 147, 90, 0.35)',
                    color:        '#D4B07A',
                  }}
                >
                  {mod}
                </span>
              ))}
            </div>
            <a
              href="https://care.natural-intelligence.uk"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
              style={{ background: '#B8935A', color: '#0E0D0B' }}
            >
              Join the waitlist
            </a>
          </section>

        </div>
      </div>
    </div>
  )
}
