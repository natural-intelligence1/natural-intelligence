import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'

// ─── Zone config ─────────────────────────────────────────────────────────────
const ZONE_CONFIG = [
  { label: 'Depleted',    colour: '#DC2626', width: 12 }, // Zone 1
  { label: 'Low',         colour: '#F97316', width: 14 }, // Zone 2
  { label: 'Sub-optimal', colour: '#EAB308', width: 14 }, // Zone 3
  { label: 'Optimal',     colour: '#4E7A5C', width: 20 }, // Zone 4 — NI sage
  { label: 'Elevated',    colour: '#F97316', width: 14 }, // Zone 5
  { label: 'Excess',      colour: '#DC2626', width: 12 }, // Zone 6
] as const

// Remaining percentage is used as padding on each side; zones sum to 86%
const ZONE_WIDTHS_PCT = ZONE_CONFIG.map((z) => z.width)

// ─── ZoneBar component ────────────────────────────────────────────────────────
function ZoneBar({ zone, value, unit }: { zone: number | null; value: number | null; unit: string | null }) {
  // Compute dot position: centre of the corresponding zone segment
  const PADDING_EACH = (100 - ZONE_WIDTHS_PCT.reduce((a, b) => a + b, 0)) / 2

  let dotPct: number | null = null
  if (zone !== null && zone >= 1 && zone <= 6) {
    let left = PADDING_EACH
    for (let i = 0; i < zone - 1; i++) left += ZONE_WIDTHS_PCT[i]
    dotPct = left + ZONE_WIDTHS_PCT[zone - 1] / 2
  }

  return (
    <div className="mt-3">
      {/* Bar */}
      <div className="relative h-2.5 rounded-full overflow-hidden flex"
           style={{ background: '#E5E7EB' }}>
        {/* Leading padding */}
        <div style={{ width: `${PADDING_EACH}%` }} />
        {ZONE_CONFIG.map((z, i) => (
          <div
            key={i}
            style={{ width: `${z.width}%`, background: z.colour }}
            className="h-full"
          />
        ))}
        {/* Trailing padding */}
        <div style={{ width: `${PADDING_EACH}%` }} />

        {/* Marker dot */}
        {dotPct !== null && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow"
            style={{
              left: `calc(${dotPct}% - 6px)`,
              background: ZONE_CONFIG[(zone ?? 1) - 1].colour,
            }}
          />
        )}
      </div>

      {/* Zone labels */}
      <div className="flex justify-between mt-1 px-0" style={{ paddingLeft: `${PADDING_EACH}%`, paddingRight: `${PADDING_EACH}%` }}>
        {ZONE_CONFIG.map((z, i) => (
          <span
            key={i}
            className="text-2xs font-medium"
            style={{
              width: `${z.width}%`,
              color: zone === i + 1 ? z.colour : '#9CA3AF',
              textAlign: 'center',
              display: 'inline-block',
              fontSize: '9px',
            }}
          >
            {z.label}
          </span>
        ))}
      </div>

      {/* Value + unit */}
      {value !== null && (
        <p className="text-xs text-text-muted mt-1">
          Your value: <span className="font-semibold text-text-primary">{value} {unit ?? ''}</span>
        </p>
      )}
    </div>
  )
}

// ─── GP vs NI callout ─────────────────────────────────────────────────────────
function GpNiCallout({
  gpLow, gpHigh, gpInterpretation,
  niLow, niHigh,
  unit,
}: {
  gpLow: number | null; gpHigh: number | null; gpInterpretation: string | null
  niLow: number | null; niHigh: number | null
  unit: string | null
}) {
  const hasGp = gpLow !== null || gpHigh !== null || gpInterpretation !== null
  const hasNi = niLow !== null || niHigh !== null

  if (!hasGp && !hasNi) return null

  return (
    <div className="flex gap-2 mt-3 flex-wrap">
      {hasGp && (
        <div className="flex-1 min-w-[120px] rounded-lg border border-border-default bg-surface-muted px-3 py-2">
          <p className="text-2xs font-semibold uppercase tracking-wider text-text-muted mb-0.5"
             style={{ fontSize: '9px' }}>
            GP / Conventional
          </p>
          <p className="text-xs text-text-secondary">
            {gpLow !== null && gpHigh !== null
              ? `${gpLow}–${gpHigh} ${unit ?? ''}`
              : gpInterpretation ?? '—'}
          </p>
          {gpInterpretation && (
            <p className="text-xs font-medium text-text-primary capitalize">{gpInterpretation}</p>
          )}
        </div>
      )}
      {hasNi && (
        <div
          className="flex-1 min-w-[120px] rounded-lg px-3 py-2 border"
          style={{ borderColor: '#B8935A', background: 'rgba(184,147,90,0.06)' }}
        >
          <p
            className="text-2xs font-semibold uppercase tracking-wider mb-0.5"
            style={{ fontSize: '9px', color: '#B8935A' }}
          >
            NI Functional range
          </p>
          <p className="text-xs" style={{ color: '#B8935A' }}>
            {niLow !== null && niHigh !== null ? `${niLow}–${niHigh} ${unit ?? ''}` : '—'}
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function BioHubReportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const adminClient = createAdminClient()

  const { data: report } = await adminClient
    .from('lab_reports')
    .select('id, file_name, upload_status, lab_name, report_date, parse_error, created_at')
    .eq('id', id)
    .eq('member_id', user.id) // ownership check
    .maybeSingle()

  if (!report) notFound()

  // Processing / failed states
  if (report.upload_status === 'uploaded' || report.upload_status === 'processing') {
    return (
      <div className="max-w-3xl mx-auto">
        {/* Auto-refresh every 5 s while processing */}
        {/* eslint-disable-next-line @next/next/no-head-element */}
        <meta httpEquiv="refresh" content="5" />
        <div className="rounded-xl border border-border-default bg-surface-raised p-8 text-center">
          <div className="w-8 h-8 rounded-full border-2 border-text-brand border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-sm font-semibold text-text-primary mb-1">Analysing your report</p>
          <p className="text-sm text-text-muted">This usually takes 20–40 seconds. The page will refresh automatically.</p>
        </div>
      </div>
    )
  }

  if (report.upload_status === 'failed') {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="rounded-xl border border-red-200 bg-surface-raised p-8 text-center">
          <p className="text-sm font-semibold text-red-600 mb-1">Analysis failed</p>
          {report.parse_error && (
            <p className="text-xs text-text-muted mb-4">{report.parse_error}</p>
          )}
          <Link
            href="/dashboard/biohub"
            className="inline-block px-4 py-2 rounded-lg bg-brand-default hover:bg-brand-hover text-text-inverted text-sm font-medium transition-colors"
          >
            Upload a new report
          </Link>
        </div>
      </div>
    )
  }

  // Fetch biomarker results
  const { data: biomarkers } = await adminClient
    .from('biomarker_results')
    .select('*')
    .eq('report_id', id)
    .order('marker_name', { ascending: true })

  const reportDate = report.report_date
    ? new Date(report.report_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date(report.created_at!).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  const totalMarkers = biomarkers?.length ?? 0
  const optimalCount = biomarkers?.filter((b) => b.functional_zone === 4).length ?? 0
  const outOfRangeCount = biomarkers?.filter((b) => b.functional_zone !== null && b.functional_zone !== 4).length ?? 0

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-semibold text-text-brand uppercase tracking-wider mb-1">Lab Report</p>
        <h1 className="text-2xl font-bold text-text-primary mb-0.5 truncate">{report.file_name}</h1>
        <p className="text-sm text-text-muted">
          {report.lab_name ? `${report.lab_name} · ` : ''}{reportDate}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl border border-border-default bg-surface-raised p-4 text-center">
          <p className="text-2xl font-semibold text-text-primary">{totalMarkers}</p>
          <p className="text-xs text-text-muted mt-0.5">Markers</p>
        </div>
        <div className="rounded-xl border border-border-default bg-surface-raised p-4 text-center">
          <p className="text-2xl font-semibold" style={{ color: '#4E7A5C' }}>{optimalCount}</p>
          <p className="text-xs text-text-muted mt-0.5">Optimal</p>
        </div>
        <div className="rounded-xl border border-border-default bg-surface-raised p-4 text-center">
          <p className="text-2xl font-semibold text-amber-500">{outOfRangeCount}</p>
          <p className="text-xs text-text-muted mt-0.5">Review</p>
        </div>
      </div>

      {/* Biomarker list */}
      {(!biomarkers || biomarkers.length === 0) ? (
        <div className="rounded-xl border border-border-default bg-surface-raised p-8 text-center">
          <p className="text-sm text-text-muted">No biomarkers could be extracted from this report.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {biomarkers.map((b) => (
            <div key={b.id} className="rounded-xl border border-border-default bg-surface-raised p-5">
              {/* Marker header */}
              <div className="flex items-start justify-between gap-4 mb-2">
                <div>
                  <p className="text-sm font-semibold text-text-primary">{b.marker_name}</p>
                  {b.ni_interpretation && (
                    <p className="text-xs text-text-secondary mt-0.5">{b.ni_interpretation}</p>
                  )}
                </div>
                {b.functional_zone !== null && (
                  <span
                    className="inline-block px-2 py-0.5 rounded-md text-xs font-medium flex-shrink-0"
                    style={{
                      background: `${ZONE_CONFIG[b.functional_zone - 1].colour}18`,
                      color: ZONE_CONFIG[b.functional_zone - 1].colour,
                    }}
                  >
                    Zone {b.functional_zone} · {ZONE_CONFIG[b.functional_zone - 1].label}
                  </span>
                )}
              </div>

              {/* 6-zone bar */}
              <ZoneBar zone={b.functional_zone} value={b.value} unit={b.unit} />

              {/* GP vs NI callout */}
              <GpNiCallout
                gpLow={b.gp_range_low}
                gpHigh={b.gp_range_high}
                gpInterpretation={b.gp_interpretation}
                niLow={b.ni_range_low}
                niHigh={b.ni_range_high}
                unit={b.unit}
              />
            </div>
          ))}
        </div>
      )}

      {/* NI disclaimer */}
      <p className="text-xs text-text-muted mt-8 leading-relaxed text-center">
        Functional ranges are for educational purposes only and do not constitute medical advice.
        Always discuss results with your practitioner.
      </p>
    </div>
  )
}
