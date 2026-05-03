import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@natural-intelligence/db'
import { copy } from '@/lib/copy'

type StatusKey = keyof typeof copy.dashboard.status

const statusStyles: Record<string, string> = {
  new:       'bg-brand-subtle text-text-brand border border-brand-default',
  in_review: 'bg-status-warningBg text-status-warningText border border-status-warningBorder',
  actioned:  'bg-status-successBg text-status-successText border border-status-successBorder',
  closed:    'bg-surface-muted text-text-muted border border-border-default',
}

const urgencyStyles: Record<string, string> = {
  high:   'bg-status-errorBg text-status-errorText',
  normal: 'bg-surface-muted text-text-secondary',
  low:    'bg-surface-muted text-text-muted',
}

const urgencyLabels: Record<string, string> = {
  high:   'Urgent',
  normal: 'Normal',
  low:    'Not urgent',
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function DashboardRequestsPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: requests } = await supabase
    .from('member_support_requests')
    .select('id, request_type, description, urgency, status, submitted_at')
    .order('submitted_at', { ascending: false })

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">{copy.dashboard.sections.requests}</h1>
        <p className="text-sm text-text-muted mt-1">Read-only — contact us if you need to update a request.</p>
      </div>

      {!requests || requests.length === 0 ? (
        <div className="rounded-xl border border-border-default bg-surface-raised p-10 text-center">
          <p className="text-sm text-text-muted mb-4">{copy.dashboard.empty.requests}</p>
          <Link
            href="/support"
            className="inline-block px-4 py-2 rounded-lg bg-brand-default hover:bg-brand-hover text-text-inverted text-sm font-medium transition-colors"
          >
            {copy.dashboard.quickLinks[2].label}
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {(requests as any[]).map((req) => {
            const statusLabel = copy.dashboard.status[req.status as StatusKey] ?? req.status
            const typeLabel = (copy.support.requestTypes as Record<string, string>)[req.request_type] ?? req.request_type.replace(/_/g, ' ')
            return (
              <div key={req.id} className="rounded-xl border border-border-default bg-surface-raised p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text-primary mb-1">{typeLabel}</p>
                    <p className="text-xs text-text-secondary leading-relaxed line-clamp-2 mb-2">{req.description}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${urgencyStyles[req.urgency] ?? 'bg-surface-muted text-text-secondary'}`}>
                        {urgencyLabels[req.urgency] ?? req.urgency}
                      </span>
                      <span className="text-xs text-text-muted">{fmt(req.submitted_at)}</span>
                    </div>
                  </div>
                  <span className={`flex-shrink-0 inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles[req.status] ?? 'bg-surface-muted text-text-secondary border border-border-default'}`}>
                    {statusLabel}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
