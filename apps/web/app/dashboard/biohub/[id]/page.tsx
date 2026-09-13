import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'

// ─── BioHub report page (updated legal clearance, 13 Sep 2026) ────────────────
// Cleared scope: the user's numerical result; the LABORATORY'S OWN reference
// interval exactly as supplied; the laboratory's own High/Low/Abnormal flag
// where the report supplied one ("Laboratory flag: …"); and a SEPARATELY
// LABELLED "NI Educational Comparison Range" with a neutral position
// statement (Below / Within / Above) — shown ONLY when the range carries
// identifiable source/methodology metadata (migration 0055 adds those
// columns; until it is applied and ranges are curated with sources, every
// marker shows the no-range-available line instead — default deny).
// NOT rendered, ever: zones, red/amber/green risk colouring, "optimal/
// deficient/abnormal" NI labels, diagnostic conclusions, or any treatment/
// supplement/dosage suggestion. Lab clinical intervals and NI educational
// ranges are never blurred together.

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
          <p className="text-sm font-semibold text-text-primary mb-1">Reading your report</p>
          <p className="text-sm text-text-muted">This usually takes 20–40 seconds. The page will refresh automatically.</p>
        </div>
      </div>
    )
  }

  if (report.upload_status === 'failed') {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="rounded-xl border border-red-200 bg-surface-raised p-8 text-center">
          <p className="text-sm font-semibold text-red-600 mb-1">We could not read this report</p>
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

  // Fetch biomarker results (only lab-extracted fields are displayed below)
  const { data: biomarkers } = await adminClient
    .from('biomarker_results')
    .select('*')
    .eq('report_id', id)
    .order('marker_name', { ascending: true })

  // NI Educational Comparison Ranges — SOURCE-GATED. A range is displayable
  // only when its functional_ranges row carries source/methodology metadata
  // (0055 columns). Pre-0055 the select errors → the map stays empty → every
  // marker shows the no-range-available line. Never a silent fallback to
  // unsourced ranges.
  interface EducationalRange {
    marker_key: string
    ni_range_low: number | null
    ni_range_high: number | null
    unit: string | null
    source_label: string | null
    source_reference: string | null
    last_reviewed_at: string | null
  }
  const eduRanges = new Map<string, EducationalRange>()
  const markerKeys = (biomarkers ?? []).map((b) => b.marker_key).filter((k): k is string => !!k)
  if (markerKeys.length > 0) {
    // eslint-disable-next-line
    const { data: rangeRows, error: rangeErr } = await (adminClient as any)
      .from('functional_ranges')
      .select('marker_key, ni_range_low, ni_range_high, unit, source_label, source_reference, last_reviewed_at')
      .in('marker_key', markerKeys)
    if (!rangeErr) {
      for (const r of (rangeRows ?? []) as EducationalRange[]) {
        if (r.ni_range_low !== null && r.ni_range_high !== null && r.source_label) {
          eduRanges.set(r.marker_key, r)
        }
      }
    }
  }

  // Neutral position statement against the NI educational range — never a
  // clinical label.
  function eduPosition(value: number | null, r: EducationalRange): string | null {
    if (value === null || r.ni_range_low === null || r.ni_range_high === null) return null
    if (value < r.ni_range_low)  return 'Below NI Educational Comparison Range'
    if (value > r.ni_range_high) return 'Above NI Educational Comparison Range'
    return 'Within NI Educational Comparison Range'
  }

  const reportDate = report.report_date
    ? new Date(report.report_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date(report.created_at!).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  const totalMarkers = biomarkers?.length ?? 0
  const withInterval = biomarkers?.filter((b) => b.gp_range_low !== null && b.gp_range_high !== null).length ?? 0

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

      {/* Summary cards — counts only, no clinical assessment */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="rounded-xl border border-border-default bg-surface-raised p-4 text-center">
          <p className="text-2xl font-semibold text-text-primary">{totalMarkers}</p>
          <p className="text-xs text-text-muted mt-0.5">Markers extracted</p>
        </div>
        <div className="rounded-xl border border-border-default bg-surface-raised p-4 text-center">
          <p className="text-2xl font-semibold text-text-primary">{withInterval}</p>
          <p className="text-xs text-text-muted mt-0.5">With a laboratory interval</p>
        </div>
      </div>

      {/* Biomarker list — value, unit, and the laboratory's own interval/flag */}
      {(!biomarkers || biomarkers.length === 0) ? (
        <div className="rounded-xl border border-border-default bg-surface-raised p-8 text-center">
          <p className="text-sm text-text-muted">No biomarkers could be extracted from this report.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {biomarkers.map((b) => {
            const edu = b.marker_key ? eduRanges.get(b.marker_key) : undefined
            const position = edu ? eduPosition(b.value, edu) : null
            return (
              <div key={b.id} className="rounded-xl border border-border-default bg-surface-raised p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary">{b.marker_name}</p>
                    <p className="text-sm text-text-secondary mt-1">
                      Your value:{' '}
                      <span className="font-semibold text-text-primary">
                        {b.value !== null ? `${b.value} ${b.unit ?? ''}` : b.raw_value ?? '—'}
                      </span>
                    </p>
                    <p className="text-xs text-text-muted mt-1">
                      {b.gp_range_low !== null && b.gp_range_high !== null
                        ? `Laboratory reference interval: ${b.gp_range_low}–${b.gp_range_high} ${b.unit ?? ''}`
                        : 'No laboratory interval found in this report'}
                    </p>
                  </div>
                  {b.gp_interpretation && (
                    <span className="inline-block px-2 py-0.5 rounded-md text-xs font-medium flex-shrink-0 bg-surface-muted text-text-secondary capitalize">
                      Laboratory flag: {b.gp_interpretation}
                    </span>
                  )}
                </div>

                {/* NI Educational Comparison Range — separate, source-gated */}
                {edu ? (
                  <div className="mt-3 rounded-lg border border-border-default bg-surface-muted px-3 py-2.5">
                    <p className="text-xs font-medium text-text-secondary">
                      NI Educational Comparison Range: {edu.ni_range_low}–{edu.ni_range_high} {edu.unit ?? b.unit ?? ''}
                    </p>
                    {position && (
                      <p className="text-xs text-text-primary mt-1">Your result: {position}</p>
                    )}
                    <p className="text-2xs text-text-muted mt-1.5 leading-relaxed" style={{ fontSize: '11px' }}>
                      Shown for educational comparison only. This is separate
                      from the reference interval provided by your laboratory
                      and is not a diagnostic or treatment threshold.
                      {' '}Source: {edu.source_label}
                      {edu.last_reviewed_at ? ` · reviewed ${new Date(edu.last_reviewed_at).toLocaleDateString('en-GB')}` : ''}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-text-muted mt-3">
                    No NI educational comparison range is currently available for this marker.
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Boundary copy */}
      <p className="text-xs text-text-muted mt-8 leading-relaxed text-center max-w-xl mx-auto">
        Values are shown with the reference intervals provided by the laboratory
        where available. This does not diagnose, treat or replace clinical
        interpretation — discuss your results with a qualified practitioner.
        For urgent concerns, contact your GP, NHS 111 or emergency services.
      </p>
    </div>
  )
}
