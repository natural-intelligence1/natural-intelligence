import { redirect } from 'next/navigation'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'
import { ProtocolLibrary } from './ProtocolLibrary'
import { DailyView } from './DailyView'
import type { DailyItem, WeekDot } from './DailyView'

interface PageProps {
  searchParams: { template?: string }
}

export default async function DailyPathPage({ searchParams }: PageProps) {
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
  const today = new Date().toISOString().split('T')[0]

  // ── Fetch active protocol ────────────────────────────────────────────────────
  const { data: rawProtocol } = await adminClient
    .from('member_protocols')
    .select('id, name, template_id, started_at, status, protocol_templates(duration_weeks)')
    .eq('member_id', user.id)
    .in('status', ['active', 'paused'])
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // ── STATE B — active protocol ────────────────────────────────────────────────
  if (rawProtocol) {
    const protocol = rawProtocol as any
    const templateMeta = protocol.protocol_templates as { duration_weeks: number } | null
    const durationWeeks = templateMeta?.duration_weeks ?? 12

    // Fetch today's adherence rows
    let { data: todayAdherence } = await adminClient
      .from('daily_adherence')
      .select('id, item_id, item_name, log_date, completed, completed_at, skipped, skip_reason')
      .eq('member_id', user.id)
      .eq('protocol_id', protocol.id)
      .eq('log_date', today)

    // Generate today's rows if none exist (first visit of the day)
    if (!todayAdherence || todayAdherence.length === 0) {
      const { data: items } = await adminClient
        .from('protocol_items')
        .select('id, name, item_type, timing, sort_order')
        .eq('template_id', protocol.template_id)
        .order('sort_order', { ascending: true })

      if (items && items.length > 0) {
        const rows = items.map((item: any) => ({
          member_id:   user.id,
          protocol_id: protocol.id,
          item_id:     item.id,
          item_name:   item.name,
          log_date:    today,
          completed:   false,
          skipped:     false,
        }))
        await adminClient
          .from('daily_adherence')
          .upsert(rows, { onConflict: 'member_id,protocol_id,item_id,log_date', ignoreDuplicates: true })

        const { data: refetched } = await adminClient
          .from('daily_adherence')
          .select('id, item_id, item_name, log_date, completed, completed_at, skipped, skip_reason')
          .eq('member_id', user.id)
          .eq('protocol_id', protocol.id)
          .eq('log_date', today)
        todayAdherence = refetched
      }
    }

    // Fetch protocol items for timing/dose/type metadata
    const { data: protocolItems } = await adminClient
      .from('protocol_items')
      .select('id, name, item_type, dose, timing, notes, sort_order')
      .eq('template_id', protocol.template_id)
      .order('sort_order', { ascending: true })

    const itemMeta = new Map((protocolItems ?? []).map((i: any) => [i.id, i]))

    // Merge adherence + item metadata
    const dailyItems: DailyItem[] = (todayAdherence ?? [])
      .map((a: any) => {
        const meta = itemMeta.get(a.item_id) as any
        return {
          id:        a.id,
          itemId:    a.item_id,
          name:      a.item_name,
          itemType:  meta?.item_type ?? 'supplement',
          dose:      meta?.dose ?? null,
          timing:    meta?.timing ?? null,
          notes:     meta?.notes ?? null,
          sortOrder: meta?.sort_order ?? 99,
          completed: a.completed,
          skipped:   a.skipped,
        }
      })
      .sort((a: DailyItem, b: DailyItem) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99))

    // Fetch streak
    const { data: streak } = await adminClient
      .from('adherence_streaks')
      .select('current_streak, longest_streak, total_days_completed')
      .eq('member_id', user.id)
      .eq('protocol_id', protocol.id)
      .maybeSingle()

    // ── Week dots (Mon–Sun of current week) ──────────────────────────────────
    const now = new Date()
    const dow = now.getDay()                             // 0=Sun … 6=Sat
    const monday = new Date(now)
    monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1))
    monday.setHours(0, 0, 0, 0)

    const weekDates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      return d.toISOString().split('T')[0]
    })

    const { data: weekRows } = await adminClient
      .from('daily_adherence')
      .select('log_date, completed')
      .eq('member_id', user.id)
      .eq('protocol_id', protocol.id)
      .gte('log_date', weekDates[0])
      .lte('log_date', weekDates[6])

    const completedDates = new Set(
      (weekRows ?? []).filter((r: any) => r.completed).map((r: any) => r.log_date)
    )

    const weekDots: WeekDot[] = weekDates.map((date) => ({
      date,
      isCompleted: completedDates.has(date),
      isToday:     date === today,
      isFuture:    date > today,
    }))

    // Week number
    const startDate = new Date(protocol.started_at)
    const daysDiff  = Math.max(0, Math.floor((now.getTime() - startDate.getTime()) / 86400000))
    const weekNumber = Math.floor(daysDiff / 7) + 1

    return (
      <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto">
        <DailyView
          protocol={{
            id:            protocol.id,
            name:          protocol.name,
            status:        protocol.status,
            startedAt:     protocol.started_at,
            durationWeeks: durationWeeks,
            weekNumber:    Math.min(weekNumber, durationWeeks),
          }}
          items={dailyItems}
          streak={streak ? {
            currentStreak:       streak.current_streak,
            longestStreak:       streak.longest_streak,
            totalDaysCompleted:  streak.total_days_completed,
          } : null}
          memberId={user.id}
          weekDots={weekDots}
        />
      </div>
    )
  }

  // ── STATE A — no active protocol ─────────────────────────────────────────────
  const [{ data: templates }, { data: lastResult }] = await Promise.all([
    adminClient
      .from('protocol_templates')
      .select('id, name, description, duration_weeks, root_cause_key, root_cause_id, root_causes(name, colour)')
      .eq('status', 'published')
      .order('name', { ascending: true }),
    adminClient
      .from('rootfinder_results')
      .select('session_id, root_cause_id, root_causes(name, key, colour)')
      .eq('member_id', user.id)
      .eq('rank', 1)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  // Find suggested template based on RootFinder primary result
  const rootCauseKey = (lastResult as any)?.root_causes?.key as string | null
  const suggested = templates?.find((t: any) => t.root_cause_key && t.root_cause_key === rootCauseKey) ?? null

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <p className="text-[11px] font-medium text-text-brand uppercase tracking-widest mb-1">DailyPath</p>
        <h1 className="text-2xl font-bold text-text-primary mb-2">Your daily health protocol.</h1>
        <p className="text-sm text-text-secondary leading-relaxed">
          A personalised morning and evening routine, built around your root cause pattern
          and guided by functional medicine principles.
        </p>
      </div>

      <ProtocolLibrary
        templates={(templates ?? []) as any[]}
        suggested={suggested as any}
        rootCauseName={(lastResult as any)?.root_causes?.name ?? null}
        highlightTemplateId={searchParams.template ?? null}
      />
    </div>
  )
}
