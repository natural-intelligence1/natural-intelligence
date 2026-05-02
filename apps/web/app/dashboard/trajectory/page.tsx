import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'
import { TrajectoryChart } from './TrajectoryChart'
import type { MarkerData } from './TrajectoryChart'

export default async function TrajectoryPage() {
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

  // Fetch all biomarker trajectory data for this member
  const { data: rawPoints } = await adminClient
    .from('biomarker_trajectory')
    .select('id, marker_key, marker_name, value, unit, functional_zone, report_date')
    .eq('member_id', user.id)
    .order('report_date', { ascending: true })

  const points = (rawPoints ?? []) as Array<{
    id:              string
    marker_key:      string
    marker_name:     string
    value:           number | null
    unit:            string | null
    functional_zone: number | null
    report_date:     string | null
  }>

  // Group by marker_key, skip rows with null value or date
  const markerMap = new Map<string, {
    key:    string
    name:   string
    unit:   string | null
    points: Array<{ date: string; value: number; zone: number | null }>
  }>()

  for (const p of points) {
    if (p.value === null || !p.report_date) continue
    if (!markerMap.has(p.marker_key)) {
      markerMap.set(p.marker_key, { key: p.marker_key, name: p.marker_name, unit: p.unit, points: [] })
    }
    markerMap.get(p.marker_key)!.points.push({
      date:  p.report_date,
      value: p.value,
      zone:  p.functional_zone,
    })
  }

  // Fetch functional ranges for the optimal band overlay
  const markerKeys = Array.from(markerMap.keys())
  const { data: ranges } = markerKeys.length > 0
    ? await adminClient
        .from('functional_ranges')
        .select('marker_key, ni_optimal_low, ni_optimal_high')
        .in('marker_key', markerKeys)
    : { data: [] }

  const rangeMap = new Map((ranges ?? []).map(r => [r.marker_key, r]))

  const markers: MarkerData[] = Array.from(markerMap.values()).map(m => ({
    key:         m.key,
    name:        m.name,
    unit:        m.unit,
    points:      m.points,
    optimalLow:  rangeMap.get(m.key)?.ni_optimal_low  ?? null,
    optimalHigh: rangeMap.get(m.key)?.ni_optimal_high ?? null,
  }))

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      <Link
        href="/dashboard"
        className="inline-flex items-center text-xs text-text-brand hover:text-text-primary mb-8 transition-colors"
      >
        ← Dashboard
      </Link>

      <div className="mb-8">
        <p className="text-xs font-semibold text-text-brand uppercase tracking-wider mb-1">Trajectory</p>
        <h1 className="text-2xl font-bold text-text-primary">Biomarker trends</h1>
        <p className="text-sm text-text-secondary mt-1 max-w-lg">
          Track how your key biomarkers shift across lab reports over time — mapped against
          functional optimal ranges.
        </p>
      </div>

      {markers.length === 0 ? (
        <section className="rounded-xl border border-border-default bg-surface-raised p-10 text-center">
          <p className="text-sm font-semibold text-text-primary mb-2">No trajectory data yet</p>
          <p className="text-sm text-text-secondary leading-relaxed mb-5 max-w-sm mx-auto">
            Upload your first lab report in BioHub to start tracking biomarker trends over time.
          </p>
          <Link
            href="/dashboard/biohub"
            className="inline-block px-4 py-2 rounded-lg bg-brand-default hover:bg-brand-hover text-text-inverted text-sm font-medium transition-colors"
          >
            Upload a lab report
          </Link>
        </section>
      ) : (
        <TrajectoryChart markers={markers} />
      )}
    </div>
  )
}
