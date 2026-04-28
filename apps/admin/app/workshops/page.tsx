import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'
import { Badge } from '@natural-intelligence/ui'
import { copy } from '@/lib/copy'

type BadgeVariant = 'default' | 'info' | 'success' | 'danger' | 'warning'
const statusBadge: Record<string, BadgeVariant> = {
  draft:     'default',
  published: 'success',
  cancelled: 'danger',
  completed: 'info',
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function WorkshopsPage() {
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

  const { data: events } = await adminClient
    .from('events')
    .select('*')
    .order('starts_at', { ascending: false })

  return (
    <div>
      <div className="px-8 py-6 border-b border-border-default bg-surface-raised flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">{copy.workshops.heading}</h1>
          <p className="text-sm text-text-secondary mt-1">{copy.workshops.subheading}</p>
        </div>
        <Link
          href="/workshops/new"
          className="px-4 py-2 rounded-lg bg-brand-default hover:bg-brand-hover text-text-inverted text-sm font-medium transition-colors"
        >
          {copy.workshops.createNew}
        </Link>
      </div>

      <div className="px-8 py-6">
        {!events || events.length === 0 ? (
          <p className="text-text-secondary text-sm">{copy.workshops.empty}</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border-default bg-surface-raised shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default bg-surface-muted">
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">{copy.workshops.columns.title}</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">{copy.workshops.columns.type}</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">{copy.workshops.columns.starts}</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">{copy.workshops.columns.status}</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">{copy.workshops.columns.capacity}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-muted">
                {events.map((event) => (
                  <tr key={event.id} className="hover:bg-surface-muted transition-colors cursor-pointer">
                    <td className="px-4 py-3">
                      <Link href={`/workshops/${event.id}/edit`} className="text-text-primary font-medium hover:underline">
                        {event.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-surface-muted text-text-secondary">
                        {copy.workshops.types[event.event_type as keyof typeof copy.workshops.types] ?? event.event_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{event.starts_at ? fmt(event.starts_at) : '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusBadge[event.status] ?? 'default'}>
                        {copy.workshops.statuses[event.status as keyof typeof copy.workshops.statuses] ?? event.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{event.max_capacity ?? '—'}</td>
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
