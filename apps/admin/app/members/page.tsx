import { redirect } from 'next/navigation'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'
import { copy } from '@/lib/copy'

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function MembersPage() {
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

  const { data: members } = await adminClient
    .from('profiles')
    .select('id, full_name, role, created_at')
    .in('role', ['member', 'user'])
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="px-8 py-6 border-b border-border-default bg-surface-raised">
        <h1 className="text-2xl font-semibold text-text-primary">{copy.members.heading}</h1>
        <p className="text-sm text-text-secondary mt-1">{copy.members.subheading}</p>
      </div>

      <div className="px-8 py-6">
        {!members || members.length === 0 ? (
          <p className="text-text-secondary text-sm">{copy.members.empty}</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border-default bg-surface-raised shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default bg-surface-muted">
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">{copy.members.columns.name}</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">{copy.members.columns.role}</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">{copy.members.columns.joined}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-muted">
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-surface-muted transition-colors">
                    <td className="px-4 py-3 text-text-primary font-medium">{m.full_name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-surface-muted text-text-secondary capitalize">
                        {m.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{m.created_at ? fmt(m.created_at) : '—'}</td>
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
