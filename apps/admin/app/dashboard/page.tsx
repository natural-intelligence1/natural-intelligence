import { redirect } from 'next/navigation'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'
import { copy } from '@/lib/copy'

export default async function AdminDashboardPage() {
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

  const [
    { count: pendingApplications },
    { count: newSupportRequests },
    { count: totalMembers },
    { count: publishedWorkshops },
    { count: publishedResources },
  ] = await Promise.all([
    adminClient
      .from('practitioner_applications')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
    adminClient
      .from('support_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'new'),
    adminClient
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'member'),
    adminClient
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published'),
    adminClient
      .from('resources')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published'),
  ])

  const metrics = [
    { label: copy.dashboard.metrics.pendingApplications, count: pendingApplications ?? 0, href: '/applications' },
    { label: copy.dashboard.metrics.newSupportRequests,  count: newSupportRequests ?? 0,  href: '/support' },
    { label: copy.dashboard.metrics.totalMembers,        count: totalMembers ?? 0,        href: '/members' },
    { label: copy.dashboard.metrics.publishedWorkshops,  count: publishedWorkshops ?? 0,  href: '/workshops' },
    { label: copy.dashboard.metrics.publishedResources,  count: publishedResources ?? 0,  href: '/resources' },
  ]

  return (
    <div>
      <div className="px-8 py-6 border-b border-border-default bg-surface-raised">
        <h1 className="text-2xl font-semibold text-text-primary">{copy.dashboard.heading}</h1>
      </div>

      <div className="px-8 py-8">
        <div className="grid grid-cols-3 gap-6">
          {metrics.map(({ label, count, href }) => (
            <a key={label} href={href} className="block rounded-xl border border-border-default bg-surface-raised p-6 shadow-sm hover:shadow-md transition-shadow">
              <p className="text-sm font-medium text-text-secondary">{label}</p>
              <p className="text-4xl font-bold text-text-primary mt-2">{count}</p>
              <div className="mt-4 h-0.5 bg-brand-default rounded-full" />
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
