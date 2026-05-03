import { redirect } from 'next/navigation'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'
import { CheckinForm } from './CheckinForm'
import { GoalsList } from './GoalsList'
import type { Goal } from './GoalsList'

// ─── Vitality trend bar chart (server-rendered SVG) ───────────────────────────

function VitalityTrendBars({
  scores,
}: {
  scores: Array<{ score_date: string; overall_score: number | null }>
}) {
  if (scores.length === 0) return null

  const W = 340, H = 80
  const barW    = Math.floor((W - (scores.length - 1) * 4) / scores.length)
  const maxVal  = 100

  return (
    <div>
      <div className="flex items-end justify-between mb-1">
        <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider">
          Vitality trend — last {scores.length} days
        </h3>
        {scores[scores.length - 1]?.overall_score != null && (
          <span className="text-xs font-mono font-medium text-text-brand">
            {scores[scores.length - 1].overall_score}
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxWidth: '100%' }}>
        {scores.map((s, i) => {
          const score = s.overall_score ?? 0
          const bH    = Math.max(2, Math.round((score / maxVal) * (H - 16)))
          const x     = i * (barW + 4)
          const y     = H - 12 - bH
          const isLatest = i === scores.length - 1
          return (
            <g key={s.score_date}>
              <rect
                x={x} y={y} width={barW} height={bH}
                rx={2}
                fill={isLatest ? '#B8935A' : '#B8935A'}
                fillOpacity={isLatest ? 1 : 0.35}
              />
              <text x={x + barW / 2} y={H - 2} textAnchor="middle" fontSize={7} fill="#8a8579">
                {new Date(s.score_date).toLocaleDateString('en-GB', { weekday: 'narrow' })}
              </text>
              {score > 0 && (
                <text x={x + barW / 2} y={y - 2} textAnchor="middle" fontSize={7} fill="#5a5850">
                  {score}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function LifeTrackerPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'practitioner') redirect('/dashboard/practitioner')

  const adminClient = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  // Parallel fetches
  const [
    { data: rawCheckin },
    { data: rawScores },
    { data: rawGoals },
  ] = await Promise.all([
    // Today's check-in (if any)
    adminClient
      .from('lifetracker_checkins')
      .select('energy_rating, sleep_rating, mood_rating, digestion_rating, overall_rating, notes')
      .eq('member_id', user.id)
      .eq('checkin_date', today)
      .maybeSingle(),
    // Last 14 vitality scores
    adminClient
      .from('vitality_scores')
      .select('score_date, overall_score')
      .eq('member_id', user.id)
      .order('score_date', { ascending: false })
      .limit(14),
    // All goals (non-archived shown first)
    adminClient
      .from('lifetracker_goals')
      .select('id, title, description, category, target_value, target_unit, target_date, current_value, status')
      .eq('member_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  const todayCheckin = rawCheckin as {
    energy_rating:    number | null
    sleep_rating:     number | null
    mood_rating:      number | null
    digestion_rating: number | null
    overall_rating:   number | null
    notes:            string | null
  } | null

  // Scores sorted oldest→newest for bar chart
  const scores = (rawScores ?? []).reverse() as Array<{
    score_date:    string
    overall_score: number | null
  }>

  const goals = (rawGoals ?? []) as Goal[]
  const latestScore = scores[scores.length - 1]?.overall_score ?? null

  const hasCheckedIn = todayCheckin !== null && (
    todayCheckin.energy_rating !== null ||
    todayCheckin.sleep_rating  !== null
  )

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-semibold text-text-brand uppercase tracking-wider mb-1">LifeTracker</p>
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-2xl font-bold text-text-primary">Daily check-in</h1>
          {latestScore !== null && (
            <div className="text-right flex-shrink-0">
              <p className="text-3xl font-light font-mono text-text-primary leading-none">{latestScore}</p>
              <p className="text-[10px] text-text-muted uppercase tracking-wider mt-0.5">Vitality</p>
            </div>
          )}
        </div>
        <p className="text-sm text-text-secondary mt-1">
          {hasCheckedIn
            ? "You've checked in today. Update your ratings below."
            : "Rate how you feel across five areas to track your vitality score."}
        </p>
      </div>

      {/* Check-in form */}
      <section className="rounded-xl border border-border-default bg-surface-raised p-5 mb-6">
        <CheckinForm existing={todayCheckin} />
      </section>

      {/* Vitality trend */}
      {scores.length > 0 && (
        <section className="rounded-xl border border-border-default bg-surface-raised p-5 mb-6">
          <VitalityTrendBars scores={scores} />
        </section>
      )}

      {/* Four-ring breakdown (if today's check-in exists) */}
      {hasCheckedIn && todayCheckin && (
        <section className="rounded-xl border border-border-default bg-surface-raised p-5 mb-6">
          <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-4">
            Today&apos;s breakdown
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Energy',    value: todayCheckin.energy_rating,    color: '#4E7A5C' },
              { label: 'Sleep',     value: todayCheckin.sleep_rating,     color: '#7A9DBF' },
              { label: 'Mood',      value: todayCheckin.mood_rating,      color: '#B87840' },
              { label: 'Digestion', value: todayCheckin.digestion_rating, color: '#B8935A' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-text-secondary">{label}</span>
                    <span className="text-xs font-mono font-medium text-text-primary">
                      {value ?? '—'}/10
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-surface-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${(value ?? 0) * 10}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Goals */}
      <section className="rounded-xl border border-border-default bg-surface-raised p-5">
        <h2 className="text-sm font-semibold text-text-primary mb-4">Your goals</h2>
        <GoalsList goals={goals} />
      </section>
    </div>
  )
}
