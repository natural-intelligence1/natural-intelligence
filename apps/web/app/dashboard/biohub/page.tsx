import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@natural-intelligence/db'
import UploadForm from './UploadForm'

export default async function BioHubPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'practitioner') redirect('/dashboard/practitioner')

  // Fetch existing reports for this member
  const { data: reports } = await supabase
    .from('lab_reports')
    .select('id, file_name, upload_status, lab_name, report_date, created_at, parse_error')
    .eq('member_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
      {/* Back link */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors mb-8"
      >
        ← Dashboard
      </Link>

      <div className="mb-8">
        <p className="text-xs font-semibold text-text-brand uppercase tracking-wider mb-1">BioHub</p>
        <h1 className="text-2xl font-bold text-text-primary mb-1">Lab report analysis</h1>
        <p className="text-sm text-text-muted">
          Upload a PDF lab report and our AI will map your biomarkers against functional reference ranges.
        </p>
      </div>

      {/* Upload card */}
      <section className="rounded-xl border border-border-default bg-surface-raised p-6 mb-8">
        <h2 className="text-sm font-semibold text-text-primary mb-4">Upload a new report</h2>
        <UploadForm memberId={user.id} />
      </section>

      {/* Reports list */}
      {reports && reports.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-text-primary mb-4 pb-3 border-b border-border-default">
            Your reports
          </h2>
          <div className="space-y-3">
            {reports.map((report) => {
              const statusConfig = {
                uploaded:   { label: 'Queued',     dot: 'bg-amber-400'  },
                processing: { label: 'Processing', dot: 'bg-amber-400'  },
                parsed:     { label: 'Ready',      dot: 'bg-sage-500'   },
                failed:     { label: 'Failed',     dot: 'bg-red-400'    },
              }[report.upload_status] ?? { label: report.upload_status, dot: 'bg-surface-muted' }

              const date = report.report_date
                ? new Date(report.report_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                : new Date(report.created_at!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

              const isReady = report.upload_status === 'parsed'

              return (
                <div
                  key={report.id}
                  className="rounded-xl border border-border-default bg-surface-raised p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text-primary mb-0.5 truncate">
                        {report.file_name}
                      </p>
                      <p className="text-xs text-text-muted">
                        {report.lab_name ? `${report.lab_name} · ` : ''}{date}
                      </p>
                      {report.upload_status === 'failed' && report.parse_error && (
                        <p className="text-xs text-red-500 mt-1 line-clamp-1">{report.parse_error}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="flex items-center gap-1.5 text-xs text-text-secondary font-medium">
                        <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                        {statusConfig.label}
                      </span>
                      {isReady && (
                        <Link
                          href={`/dashboard/biohub/${report.id}`}
                          className="inline-block px-3 py-1 rounded-lg bg-brand-default hover:bg-brand-hover text-text-inverted text-xs font-medium transition-colors"
                        >
                          View
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {(!reports || reports.length === 0) && (
        <div className="rounded-xl border border-border-default bg-surface-raised p-8 text-center">
          <p className="text-sm text-text-muted">No reports yet. Upload your first lab PDF above.</p>
        </div>
      )}
    </div>
  )
}
