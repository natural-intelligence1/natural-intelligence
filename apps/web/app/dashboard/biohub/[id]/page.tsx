import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'

// ─── BioHub report page (SaMD softening — counsel ruling) ─────────────────────
// Self-serve BioHub is outside SaMD only as EXTRACTION + ORGANISED DISPLAY of
// the uploaded report's own values and the LABORATORY'S OWN reference
// intervals. This page therefore deliberately does NOT render: the NI
// functional ranges (ni_range_* / ni_optimal_*), the six-zone bar, zone
// badges, zone-based "Optimal / Review" counts, or NI interpretations —
// those remain stored by the pipeline (unchanged) but are held back from the
// self-serve surface pending Legal/MHRA review. Where the report carried no
// interval for a marker, we say so — we never substitute an NI range.

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
          {biomarkers.map((b) => (
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
                    Lab flag: {b.gp_interpretation}
                  </span>
                )}
              </div>
            </div>
          ))}
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
