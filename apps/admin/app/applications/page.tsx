import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'
import { copy } from '@/lib/copy'

const statusColors: Record<string, string> = {
  pending:   'bg-surface-muted text-text-secondary',
  reviewing: 'bg-status-infoBg text-status-infoText',
  approved:  'bg-brand-light text-brand-text',
  rejected:  'bg-status-errorBg text-status-errorText',
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function ApplicationsPage() {
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

  const { data: applications } = await adminClient
    .from('practitioner_applications')
    .select('*')
    .order('submitted_at', { ascending: false })

  return (
    <div>
      <div className="px-8 py-6 border-b border-border-default bg-surface-raised">
        <h1 className="text-2xl font-semibold text-text-primary">{copy.applications.heading}</h1>
        <p className="text-sm text-text-secondary mt-1">{copy.applications.subheading}</p>
      </div>

      <div className="px-8 py-6">
        {!applications || applications.length === 0 ? (
          <p className="text-text-secondary text-sm">{copy.applications.empty}</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border-default bg-surface-raised shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default bg-surface-muted">
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">{copy.applications.columns.name}</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">{copy.applications.columns.email}</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">{copy.applications.columns.specialties}</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">{copy.applications.columns.status}</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">{copy.applications.columns.submitted}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-muted">
                {applications.map((app) => (
                  <tr key={app.id} className="hover:bg-surface-muted transition-colors cursor-pointer">
                    <td className="px-4 py-3">
                      <Link href={`/applications/${app.id}`} className="text-text-primary font-medium hover:underline">
                        {app.full_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{app.email}</td>
                    <td className="px-4 py-3 text-text-secondary">
                      {Array.isArray(app.specialties) ? app.specialties.join(', ') : app.specialties ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${statusColors[app.status] ?? 'bg-surface-muted text-text-secondary'}`}>
                        {copy.applications.statuses[app.status as keyof typeof copy.applications.statuses] ?? app.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{app.submitted_at ? fmt(app.submitted_at) : '—'}</td>
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
