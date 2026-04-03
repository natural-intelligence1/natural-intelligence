import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'
import { copy } from '@/lib/copy'

const statusColors: Record<string, string> = {
  draft:     'bg-surface-muted text-text-secondary',
  published: 'bg-brand-light text-brand-text',
  archived:  'bg-surface-muted text-text-muted',
}

export default async function ResourcesPage() {
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

  const { data: resources } = await adminClient
    .from('resources')
    .select('*, author:profiles(full_name)')
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="px-8 py-6 border-b border-border-default bg-surface-raised flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">{copy.resources.heading}</h1>
          <p className="text-sm text-text-secondary mt-1">{copy.resources.subheading}</p>
        </div>
        <Link
          href="/resources/new"
          className="px-4 py-2 rounded-lg bg-brand-default hover:bg-brand-hover text-white text-sm font-medium transition-colors"
        >
          {copy.resources.createNew}
        </Link>
      </div>

      <div className="px-8 py-6">
        {!resources || resources.length === 0 ? (
          <p className="text-text-secondary text-sm">{copy.resources.empty}</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border-default bg-surface-raised shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default bg-surface-muted">
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">{copy.resources.columns.title}</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">{copy.resources.columns.type}</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">{copy.resources.columns.status}</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">{copy.resources.columns.author}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-muted">
                {resources.map((res) => (
                  <tr key={res.id} className="hover:bg-surface-muted transition-colors cursor-pointer">
                    <td className="px-4 py-3">
                      <Link href={`/resources/${res.id}/edit`} className="text-text-primary font-medium hover:underline">
                        {res.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-surface-muted text-text-secondary">
                        {copy.resources.types[res.resource_type as keyof typeof copy.resources.types] ?? res.resource_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${statusColors[res.status] ?? 'bg-surface-muted text-text-secondary'}`}>
                        {copy.resources.statuses[res.status as keyof typeof copy.resources.statuses] ?? res.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {(res.author as { full_name?: string } | null)?.full_name ?? '—'}
                    </td>
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
