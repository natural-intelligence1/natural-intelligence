import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'
import { Badge } from '@natural-intelligence/ui'
import { copy } from '@/lib/copy'

type BadgeVariant = 'default' | 'info' | 'success' | 'danger' | 'warning'
const statusBadge: Record<string, BadgeVariant> = {
  new:       'warning',
  in_review: 'info',
  actioned:  'success',
  closed:    'default',
}
const urgencyBadge: Record<string, BadgeVariant> = {
  high:   'danger',
  normal: 'warning',
  low:    'default',
}
const urgencyRowBorder: Record<string, string> = {
  high:   'border-l-4 border-l-status-errorText',
  normal: 'border-l-4 border-l-border-default',
  low:    'border-l-4 border-l-transparent',
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface Props {
  searchParams: { status?: string }
}

export default async function SupportPage({ searchParams }: Props) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-base">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-text-primary">403</h1>
          <p className="text-text-secondary mt-2">{copy.shared.accessDenied ?? 'Access denied'}</p>
        </div>
      </div>
    )
  }

  let query = adminClient
    .from('support_requests')
    .select('*')
    .order('submitted_at', { ascending: false })

  if (searchParams.status) {
    query = query.eq('status', searchParams.status)
  }

  const { data: requests } = await query

  const statuses = Object.keys(copy.support.statuses)

  return (
    <div>
      <div className="px-8 py-6 border-b border-border-default bg-surface-raised">
        <h1 className="text-2xl font-semibold text-text-primary">{copy.support.heading}</h1>
        <p className="text-sm text-text-secondary mt-1">{copy.support.subheading}</p>
      </div>

      <div className="px-8 py-6">
        {/* Status filters */}
        <div className="flex gap-2 mb-6">
          <Link
            href="/support"
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${!searchParams.status ? 'bg-brand-default text-text-inverted' : 'border border-border-default text-text-secondary hover:bg-surface-muted'}`}
          >
            All
          </Link>
          {statuses.map((s) => (
            <Link
              key={s}
              href={`/support?status=${s}`}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${searchParams.status === s ? 'bg-brand-default text-text-inverted' : 'border border-border-default text-text-secondary hover:bg-surface-muted'}`}
            >
              {copy.support.statuses[s as keyof typeof copy.support.statuses]}
            </Link>
          ))}
        </div>

        {!requests || requests.length === 0 ? (
          <p className="text-text-secondary text-sm">{copy.support.empty}</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border-default bg-surface-raised shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default bg-surface-muted">
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">{copy.support.columns.name}</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">{copy.support.columns.email}</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">{copy.support.columns.requestType}</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">{copy.support.columns.urgency}</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">{copy.support.columns.status}</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">{copy.support.columns.submitted}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-muted">
                {requests.map((req) => (
                  <tr key={req.id} className={`hover:bg-surface-muted transition-colors cursor-pointer ${urgencyRowBorder[req.urgency ?? ''] ?? ''}`}>
                    <td className="px-4 py-3">
                      <Link href={`/support/${req.id}`} className="text-text-primary font-medium hover:underline">
                        {req.full_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{req.email}</td>
                    <td className="px-4 py-3 text-text-secondary">
                      {copy.support.requestTypes[(req.request_type ?? '') as keyof typeof copy.support.requestTypes] ?? req.request_type}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={urgencyBadge[req.urgency ?? ''] ?? 'default'}>
                        {copy.support.urgency[(req.urgency ?? '') as keyof typeof copy.support.urgency] ?? req.urgency}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusBadge[req.status] ?? 'default'}>
                        {copy.support.statuses[req.status as keyof typeof copy.support.statuses] ?? req.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{req.submitted_at ? fmt(req.submitted_at) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
