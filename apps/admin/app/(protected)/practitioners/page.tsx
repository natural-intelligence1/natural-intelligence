import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'
import { Badge } from '@natural-intelligence/ui'
import { copy } from '@/lib/copy'

type BadgeVariant = 'default' | 'info' | 'success' | 'danger' | 'warning'
const lifecycleBadge: Record<string, BadgeVariant> = {
  approved_pending_profile: 'warning',
  active:                   'success',
  paused:                   'default',
  rejected:                 'danger',
}

function CompletenessBar({ pct, isReady }: { pct: number; isReady: boolean }) {
  const colour = isReady ? 'bg-status-successText' : pct >= 60 ? 'bg-status-warningText' : 'bg-status-errorText'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-surface-muted overflow-hidden flex-shrink-0">
        <div className={`h-full rounded-full ${colour}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-text-muted">{pct}%</span>
    </div>
  )
}

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function PractitionersPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('profiles').select('role').eq('id', user.id).single()

  if (profile?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-base">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-text-primary">403</h1>
          <p className="text-text-secondary mt-2">{copy.shared.accessDenied}</p>
        </div>
      </div>
    )
  }

  const { data: practitioners } = await adminClient
    .from('practitioners')
    .select('*, profiles!practitioners_profile_id_fkey(full_name)')
    .order('created_at', { ascending: false })

  const c = copy.practitioners

  return (
    <div>
      <div className="px-8 py-6 border-b border-border-default bg-surface-raised">
        <h1 className="text-2xl font-semibold text-text-primary">{c.heading}</h1>
        <p className="text-sm text-text-secondary mt-1">{c.subheading}</p>
      </div>

      {/* Summary chips */}
      <div className="px-8 pt-5 flex flex-wrap gap-3">
        {(['active', 'approved_pending_profile', 'paused'] as const).map((status) => {
          const count = (practitioners ?? []).filter((p: any) => p.lifecycle_status === status).length
          return (
            <Badge key={status} variant={lifecycleBadge[status] ?? 'default'}>
              {c.lifecycle[status]} — {count}
            </Badge>
          )
        })}
      </div>

      <div className="px-8 py-6">
        {!practitioners || practitioners.length === 0 ? (
          <p className="text-text-secondary text-sm">{c.empty}</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border-default bg-surface-raised shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default bg-surface-muted">
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">{c.columns.name}</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">{c.columns.lifecycle}</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">{c.columns.completeness}</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">{c.columns.tier}</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">{c.columns.referrals}</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">{c.columns.approved}</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-muted">
                {(practitioners ?? []).map((p: any) => {
                  const name = p.profiles?.full_name ?? '—'
                  const lifecycle = p.lifecycle_status ?? 'approved_pending_profile'
                  const pct      = p.profile_completeness_pct ?? 0
                  const isReady  = p.is_directory_ready ?? false
                  return (
                    <tr key={p.id} className="hover:bg-surface-muted transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/practitioners/${p.id}`} className="font-medium text-text-primary hover:underline">
                          {name}
                        </Link>
                        {p.city && (
                          <p className="text-xs text-text-muted mt-0.5">{[p.city, p.country].filter(Boolean).join(', ')}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={lifecycleBadge[lifecycle] ?? 'default'}>
                          {c.lifecycle[lifecycle as keyof typeof c.lifecycle] ?? lifecycle}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <CompletenessBar pct={pct} isReady={isReady} />
                        {isReady && (
                          <span className="text-xs text-status-successText mt-0.5 block">{c.directoryReady}</span>
                        )}
                        {!isReady && lifecycle !== 'paused' && (
                          <span className="text-xs text-text-muted mt-0.5 block">{c.directoryNotReady}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-secondary capitalize">
                        {p.practitioner_tier ?? 'standard'}
                      </td>
                      <td className="px-4 py-3">
                        {p.accepts_referrals
                          ? <span className="text-xs text-status-successText font-medium">Yes</span>
                          : <span className="text-xs text-text-muted">No</span>}
                      </td>
                      <td className="px-4 py-3 text-text-muted text-xs">
                        {fmt(p.accepted_at ?? p.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/practitioners/${p.id}`}
                          className="text-xs text-brand-default hover:underline">
                          {copy.shared.view}
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
