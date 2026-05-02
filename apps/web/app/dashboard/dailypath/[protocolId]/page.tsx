import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'
import { ProtocolActions } from './ProtocolActions'

interface PageProps {
  params: { protocolId: string }
}

const itemTypeLabelMap: Record<string, string> = {
  supplement: 'Supplement',
  lifestyle:  'Lifestyle',
  nutrition:  'Nutrition',
  test:       'Test',
}

export default async function ProtocolDetailPage({ params }: PageProps) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'practitioner') redirect('/dashboard/practitioner')

  const adminClient = createAdminClient()

  // Fetch the protocol (gated to member)
  const { data: rawProtocol } = await adminClient
    .from('member_protocols')
    .select('id, name, status, started_at, paused_at, template_id, protocol_templates(duration_weeks, description, root_cause_key, root_causes(name, colour))')
    .eq('id', params.protocolId)
    .eq('member_id', user.id)
    .single()

  if (!rawProtocol) notFound()

  const protocol = rawProtocol as any
  const templateMeta = protocol.protocol_templates as any

  // Week number
  const startDate  = new Date(protocol.started_at)
  const now        = new Date()
  const daysDiff   = Math.max(0, Math.floor((now.getTime() - startDate.getTime()) / 86400000))
  const weekNumber = Math.min(Math.floor(daysDiff / 7) + 1, templateMeta?.duration_weeks ?? 99)

  // Fetch all protocol items
  const { data: protocolItems } = await adminClient
    .from('protocol_items')
    .select('id, name, item_type, dose, timing, duration_weeks, notes, sort_order')
    .eq('template_id', protocol.template_id)
    .order('sort_order', { ascending: true })

  // Group items by type
  const byType: Record<string, typeof protocolItems> = {}
  for (const item of protocolItems ?? []) {
    const t = (item as any).item_type ?? 'supplement'
    if (!byType[t]) byType[t] = []
    byType[t]!.push(item)
  }
  const typeOrder = ['supplement', 'nutrition', 'lifestyle', 'test']

  // ── 14-day adherence history ─────────────────────────────────────────────────
  const fourteenDaysAgo = new Date()
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13)
  const startDateStr = fourteenDaysAgo.toISOString().split('T')[0]
  const todayStr     = now.toISOString().split('T')[0]

  const { data: adherenceRows } = await adminClient
    .from('daily_adherence')
    .select('log_date, completed')
    .eq('member_id', user.id)
    .eq('protocol_id', params.protocolId)
    .gte('log_date', startDateStr)
    .lte('log_date', todayStr)

  // Build 14-day array (oldest first)
  const completedDates = new Set(
    (adherenceRows ?? []).filter((r: any) => r.completed).map((r: any) => r.log_date)
  )

  const historyDays = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(fourteenDaysAgo)
    d.setDate(fourteenDaysAgo.getDate() + i)
    const dateStr = d.toISOString().split('T')[0]
    return {
      date:        dateStr,
      isCompleted: completedDates.has(dateStr),
      isToday:     dateStr === todayStr,
      isFuture:    dateStr > todayStr,
    }
  })

  const completedCount = historyDays.filter((d) => d.isCompleted && !d.isFuture).length
  const pastDays       = historyDays.filter((d) => !d.isFuture).length
  const adherencePct   = pastDays > 0 ? Math.round((completedCount / pastDays) * 100) : 0

  const rootCause      = templateMeta?.root_causes as { name: string; colour: string | null } | null

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto">
      {/* Back link */}
      <Link
        href="/dashboard/dailypath"
        className="inline-flex items-center text-xs text-text-brand hover:text-text-primary mb-8 transition-colors"
      >
        ← Back to DailyPath
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4 mb-2">
          <h1 className="text-2xl font-bold text-text-primary">{protocol.name}</h1>
          <span className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${
            protocol.status === 'active'
              ? 'bg-[#E8F2EB] text-[#4E7A5C]'
              : protocol.status === 'paused'
              ? 'bg-[#FDF3EA] text-[#B87840]'
              : 'bg-surface-muted text-text-muted'
          }`}>
            {protocol.status}
          </span>
        </div>
        <p className="text-xs text-text-muted">
          Started {new Date(protocol.started_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          {' · '}Week {weekNumber} of {templateMeta?.duration_weeks ?? '—'}
        </p>
      </div>

      {/* Overview */}
      <section className="rounded-xl border border-border-default bg-surface-raised p-5 mb-6">
        <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Overview</h2>
        <div className="flex flex-wrap gap-4">
          <div>
            <p className="text-xs text-text-muted mb-0.5">Duration</p>
            <p className="text-sm font-medium text-text-primary">{templateMeta?.duration_weeks ?? '—'}-week protocol</p>
          </div>
          {rootCause && (
            <div>
              <p className="text-xs text-text-muted mb-0.5">Root cause</p>
              <div className="flex items-center gap-1.5">
                {rootCause.colour && (
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: rootCause.colour }} />
                )}
                <p className="text-sm font-medium text-text-primary">{rootCause.name}</p>
              </div>
            </div>
          )}
        </div>
        {templateMeta?.description && (
          <p className="text-sm text-text-secondary leading-relaxed mt-3">{templateMeta.description}</p>
        )}
      </section>

      {/* Items by type */}
      <section className="mb-6 space-y-4">
        <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider">Protocol items</h2>
        {typeOrder.map((type) => {
          const typeItems = byType[type]
          if (!typeItems || typeItems.length === 0) return null
          return (
            <div key={type}>
              <p className="text-xs font-medium text-text-secondary mb-2">{itemTypeLabelMap[type] ?? type}</p>
              <div className="space-y-2">
                {typeItems.map((item: any) => (
                  <div key={item.id} className="rounded-xl border border-border-default bg-surface-raised p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-text-primary">{item.name}</p>
                        {(item.dose || item.timing) && (
                          <p className="text-xs text-text-muted mt-0.5">
                            {[item.dose, item.timing].filter(Boolean).join(' · ')}
                          </p>
                        )}
                        {item.duration_weeks && item.duration_weeks < (templateMeta?.duration_weeks ?? 99) && (
                          <p className="text-xs text-text-muted mt-0.5">
                            Weeks 1–{item.duration_weeks} only
                          </p>
                        )}
                        {item.notes && (
                          <p className="text-xs text-text-secondary mt-1 leading-relaxed">{item.notes}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </section>

      {/* 14-day adherence history */}
      <section className="rounded-xl border border-border-default bg-surface-raised p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider">Last 14 days</h2>
          <span className="text-xs text-text-muted font-mono">{adherencePct}% adherence</span>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {historyDays.map((day) => (
            <div
              key={day.date}
              title={day.date}
              className={`w-6 h-6 rounded-full flex-shrink-0 ${
                day.isFuture
                  ? 'bg-surface-muted'
                  : day.isCompleted
                  ? 'bg-brand-default'
                  : 'bg-surface-muted border border-[#B87840]/30'
              }`}
            />
          ))}
        </div>
      </section>

      {/* Pause / Abandon */}
      {(protocol.status === 'active' || protocol.status === 'paused') && (
        <section className="rounded-xl border border-border-default bg-surface-raised p-5">
          <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Manage</h2>
          <ProtocolActions protocolId={protocol.id} status={protocol.status} />
        </section>
      )}
    </div>
  )
}
