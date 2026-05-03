import Link from 'next/link'
import { redirect } from 'next/navigation'
import { copy } from '@/lib/copy'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'


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

  // DailyPath — active protocol + today's progress
  const adminClient = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const { data: activeProtocol } = await adminClient
    .from('member_protocols')
    .select('id, name, started_at, template_id, protocol_templates(duration_weeks)')
    .eq('member_id', user.id)
    .eq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let todayProgress: { completed: number; total: number } | null = null
  let activeStreak = 0

  // Trajectory — count distinct markers & latest date
  const { data: trajectoryStats } = await adminClient
    .from('biomarker_trajectory')
    .select('marker_key, report_date')
    .eq('member_id', user.id)
    .order('report_date', { ascending: false })
    .limit(200)

  const distinctMarkers = new Set((trajectoryStats ?? []).map((r: { marker_key: string }) => r.marker_key)).size
  const latestReportDate = (trajectoryStats ?? [])[0] as { marker_key: string; report_date: string | null } | undefined

  // LifeTracker — today's vitality score
  const { data: latestVitality } = await adminClient
    .from('vitality_scores')
    .select('overall_score, score_date')
    .eq('member_id', user.id)
    .order('score_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: todayCheckin } = await adminClient
    .from('lifetracker_checkins')
    .select('id')
    .eq('member_id', user.id)
    .eq('checkin_date', today)
    .maybeSingle()

  if (activeProtocol) {
    const [{ data: todayRows }, { data: streakRow }] = await Promise.all([
      adminClient
        .from('daily_adherence')
        .select('completed, skipped')
        .eq('member_id', user.id)
        .eq('protocol_id', activeProtocol.id)
        .eq('log_date', today),
      adminClient
        .from('adherence_streaks')
        .select('current_streak')
        .eq('member_id', user.id)
        .eq('protocol_id', activeProtocol.id)
        .maybeSingle(),
    ])
    const rows = todayRows ?? []
    todayProgress = {
      completed: rows.filter((r: any) => r.completed || r.skipped).length,
      total:     rows.length,
    }
    activeStreak = streakRow?.current_streak ?? 0
  }

  return (
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

          {/* ── BioHub teaser card ────────────────────────────────────────────── */}
          <section className="rounded-xl border border-border-default bg-surface-raised p-6 mb-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-text-brand uppercase tracking-wider mb-1">BioHub</p>
                <h3 className="text-sm font-semibold text-text-primary mb-1">Lab report analysis</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                  Upload a PDF lab report and see your biomarkers mapped against functional reference ranges — not just GP limits.
                </p>
              </div>
            </div>
            <div className="mt-4">
              <Link
                href="/dashboard/biohub"
                className="inline-block px-4 py-2 rounded-lg bg-brand-default hover:bg-brand-hover text-text-inverted text-sm font-medium transition-colors"
              >
                Upload a report
              </Link>
            </div>
          </section>

          {/* ── RootFinder teaser card ────────────────────────────────────────── */}
          <section className="rounded-xl border border-border-default bg-surface-raised p-6 mb-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-text-brand uppercase tracking-wider mb-1">RootFinder</p>
                <h3 className="text-sm font-semibold text-text-primary mb-1">Find your root cause</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                  Select the symptoms you&apos;ve been experiencing and our analysis engine will identify the most likely functional root causes driving them.
                </p>
              </div>
            </div>
            <div className="mt-4">
              <Link
                href="/dashboard/rootfinder"
                className="inline-block px-4 py-2 rounded-lg bg-brand-default hover:bg-brand-hover text-text-inverted text-sm font-medium transition-colors"
              >
                Start analysis
              </Link>
            </div>
          </section>

          {/* ── Trajectory card ──────────────────────────────────────────────── */}
          {distinctMarkers > 0 ? (
            <section className="rounded-xl border border-border-default bg-surface-raised p-5 mb-8">
              <p className="text-xs font-semibold text-text-brand uppercase tracking-wider mb-1">Trajectory</p>
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <p className="text-sm font-semibold text-text-primary">Biomarker trends</p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {distinctMarkers} marker{distinctMarkers !== 1 ? 's' : ''} tracked
                    {latestReportDate?.report_date && (
                      <> · Last report{' '}
                        {new Date(latestReportDate.report_date).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short',
                        })}
                      </>
                    )}
                  </p>
                </div>
              </div>
              <Link
                href="/dashboard/trajectory"
                className="text-sm font-medium text-text-brand hover:text-text-primary transition-colors"
              >
                View trends →
              </Link>
            </section>
          ) : (
            <section className="rounded-xl border border-border-default bg-surface-raised p-6 mb-8">
              <p className="text-xs font-semibold text-text-brand uppercase tracking-wider mb-1">Trajectory</p>
              <h3 className="text-sm font-semibold text-text-primary mb-1">Track your biomarkers over time</h3>
              <p className="text-sm text-text-secondary leading-relaxed mb-4">
                Upload lab reports in BioHub and Trajectory will chart how your markers shift across reports.
              </p>
              <Link
                href="/dashboard/biohub"
                className="inline-block px-4 py-2 rounded-lg bg-brand-default hover:bg-brand-hover text-text-inverted text-sm font-medium transition-colors"
              >
                Upload a lab report
              </Link>
            </section>
          )}

          {/* ── LifeTracker card ──────────────────────────────────────────────── */}
          {latestVitality ? (
            <section className="rounded-xl border border-border-default bg-surface-raised p-5 mb-8">
              <p className="text-xs font-semibold text-text-brand uppercase tracking-wider mb-1">LifeTracker</p>
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <p className="text-sm font-semibold text-text-primary">Vitality score</p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {todayCheckin ? '✓ Checked in today' : 'No check-in yet today'}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-2xl font-light font-mono text-text-primary leading-none">
                    {latestVitality.overall_score ?? '—'}
                  </p>
                  <p className="text-[10px] text-text-muted uppercase tracking-wide mt-0.5">Vitality</p>
                </div>
              </div>
              <Link
                href="/dashboard/lifetracker"
                className="text-sm font-medium text-text-brand hover:text-text-primary transition-colors"
              >
                {todayCheckin ? 'View LifeTracker →' : 'Check in now →'}
              </Link>
            </section>
          ) : (
            <section className="rounded-xl border border-border-default bg-surface-raised p-6 mb-8">
              <p className="text-xs font-semibold text-text-brand uppercase tracking-wider mb-1">LifeTracker</p>
              <h3 className="text-sm font-semibold text-text-primary mb-1">Track your daily vitality</h3>
              <p className="text-sm text-text-secondary leading-relaxed mb-4">
                Rate how you feel each day across energy, sleep, mood, and digestion to build your vitality score.
              </p>
              <Link
                href="/dashboard/lifetracker"
                className="inline-block px-4 py-2 rounded-lg bg-brand-default hover:bg-brand-hover text-text-inverted text-sm font-medium transition-colors"
              >
                Start tracking →
              </Link>
            </section>
          )}

          {/* ── DailyPath card ────────────────────────────────────────────────── */}
          {activeProtocol && todayProgress ? (
            <section className="rounded-xl border border-border-default bg-surface-raised p-5 mb-8">
              <p className="text-xs font-semibold text-text-brand uppercase tracking-wider mb-1">DailyPath</p>
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <p className="text-sm font-semibold text-text-primary">{activeProtocol.name}</p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {todayProgress.completed}/{todayProgress.total} items complete today
                    {activeStreak > 0 && <> · 🔥 {activeStreak} day streak</>}
                  </p>
                </div>
              </div>
              {/* Mini progress bar */}
              <div className="h-1.5 w-full rounded-full bg-surface-muted overflow-hidden mb-4">
                <div
                  className="h-full rounded-full bg-brand-default transition-all"
                  style={{
                    width: todayProgress.total > 0
                      ? `${Math.round((todayProgress.completed / todayProgress.total) * 100)}%`
                      : '0%',
                  }}
                />
              </div>
              <Link
                href="/dashboard/dailypath"
                className="text-sm font-medium text-text-brand hover:text-text-primary transition-colors"
              >
                Open DailyPath →
              </Link>
            </section>
          ) : (
            <section className="rounded-xl border border-border-default bg-surface-raised p-6 mb-8">
              <p className="text-xs font-semibold text-text-brand uppercase tracking-wider mb-1">DailyPath</p>
              <h3 className="text-sm font-semibold text-text-primary mb-1">Start your daily protocol</h3>
              <p className="text-sm text-text-secondary leading-relaxed mb-4">
                A personalised routine built around your health pattern.
              </p>
              <Link
                href="/dashboard/dailypath"
                className="inline-block px-4 py-2 rounded-lg bg-brand-default hover:bg-brand-hover text-text-inverted text-sm font-medium transition-colors"
              >
                Browse protocols →
              </Link>
            </section>
          )}
    </div>
  )
}
