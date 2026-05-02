'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'

// ─── startProtocol ────────────────────────────────────────────────────────────
export async function startProtocol(templateId: string): Promise<void> {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  const adminClient = createAdminClient()

  // Archive any existing active protocol
  await adminClient
    .from('member_protocols')
    .update({ status: 'archived' })
    .eq('member_id', user.id)
    .eq('status', 'active')

  // Fetch template
  const { data: template, error: tErr } = await adminClient
    .from('protocol_templates')
    .select('name')
    .eq('id', templateId)
    .single()

  if (tErr || !template) throw new Error('Template not found')

  const today = new Date().toISOString().split('T')[0]

  // Insert new member_protocol
  const { data: protocol, error: pErr } = await adminClient
    .from('member_protocols')
    .insert({
      member_id:   user.id,
      template_id: templateId,
      name:        template.name,
      status:      'active',
      started_at:  today,
    })
    .select('id')
    .single()

  if (pErr || !protocol) throw new Error(`Failed to create protocol: ${pErr?.message}`)

  // Generate today's adherence rows
  await _insertTodayRows(adminClient, user.id, protocol.id, templateId, today)

  // Upsert streak record (create if not exists)
  await adminClient
    .from('adherence_streaks')
    .upsert(
      {
        member_id:            user.id,
        protocol_id:          protocol.id,
        current_streak:       0,
        longest_streak:       0,
        total_days_completed: 0,
        updated_at:           new Date().toISOString(),
      },
      { onConflict: 'member_id,protocol_id', ignoreDuplicates: true }
    )

  revalidatePath('/dashboard/dailypath')
  revalidatePath('/dashboard')
}

// ─── generateTodayItems ───────────────────────────────────────────────────────
export async function generateTodayItems(protocolId: string): Promise<void> {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  const adminClient = createAdminClient()

  const { data: protocol } = await adminClient
    .from('member_protocols')
    .select('template_id')
    .eq('id', protocolId)
    .eq('member_id', user.id)
    .single()

  if (!protocol) throw new Error('Protocol not found')

  const today = new Date().toISOString().split('T')[0]
  await _insertTodayRows(adminClient, user.id, protocolId, protocol.template_id, today)

  revalidatePath('/dashboard/dailypath')
}

// ─── markItemDone ─────────────────────────────────────────────────────────────
export async function markItemDone(adherenceId: string): Promise<void> {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  const adminClient = createAdminClient()

  await adminClient
    .from('daily_adherence')
    .update({
      completed:    true,
      completed_at: new Date().toISOString(),
      skipped:      false,
      skip_reason:  null,
    })
    .eq('id', adherenceId)
    .eq('member_id', user.id)

  // Check if all items for that day are now complete/skipped
  const { data: ref } = await adminClient
    .from('daily_adherence')
    .select('protocol_id, log_date')
    .eq('id', adherenceId)
    .single()

  if (ref) {
    const { data: dayItems } = await adminClient
      .from('daily_adherence')
      .select('completed, skipped')
      .eq('protocol_id', ref.protocol_id)
      .eq('member_id', user.id)
      .eq('log_date', ref.log_date)

    const allDone = dayItems?.every((i) => i.completed || i.skipped) ?? false
    if (allDone) await _updateStreak(adminClient, user.id, ref.protocol_id)
  }

  revalidatePath('/dashboard/dailypath')
  revalidatePath('/dashboard')
}

// ─── markItemSkipped ──────────────────────────────────────────────────────────
export async function markItemSkipped(adherenceId: string, reason?: string): Promise<void> {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  const adminClient = createAdminClient()

  await adminClient
    .from('daily_adherence')
    .update({
      skipped:      true,
      skip_reason:  reason ?? null,
      completed:    false,
      completed_at: null,
    })
    .eq('id', adherenceId)
    .eq('member_id', user.id)

  const { data: ref } = await adminClient
    .from('daily_adherence')
    .select('protocol_id, log_date')
    .eq('id', adherenceId)
    .single()

  if (ref) {
    const { data: dayItems } = await adminClient
      .from('daily_adherence')
      .select('completed, skipped')
      .eq('protocol_id', ref.protocol_id)
      .eq('member_id', user.id)
      .eq('log_date', ref.log_date)

    const allDone = dayItems?.every((i) => i.completed || i.skipped) ?? false
    if (allDone) await _updateStreak(adminClient, user.id, ref.protocol_id)
  }

  revalidatePath('/dashboard/dailypath')
}

// ─── pauseProtocol ────────────────────────────────────────────────────────────
export async function pauseProtocol(protocolId: string): Promise<void> {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  const adminClient = createAdminClient()
  await adminClient
    .from('member_protocols')
    .update({ status: 'paused', paused_at: new Date().toISOString() })
    .eq('id', protocolId)
    .eq('member_id', user.id)

  revalidatePath('/dashboard/dailypath')
  revalidatePath('/dashboard')
}

// ─── resumeProtocol ───────────────────────────────────────────────────────────
export async function resumeProtocol(protocolId: string): Promise<void> {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  const adminClient = createAdminClient()
  await adminClient
    .from('member_protocols')
    .update({ status: 'active', paused_at: null })
    .eq('id', protocolId)
    .eq('member_id', user.id)

  revalidatePath('/dashboard/dailypath')
  revalidatePath('/dashboard')
}

// ─── abandonProtocol ─────────────────────────────────────────────────────────
export async function abandonProtocol(protocolId: string): Promise<void> {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  const adminClient = createAdminClient()
  await adminClient
    .from('member_protocols')
    .update({ status: 'archived' })
    .eq('id', protocolId)
    .eq('member_id', user.id)

  revalidatePath('/dashboard/dailypath')
  revalidatePath('/dashboard')
}

// ─── Private helpers ──────────────────────────────────────────────────────────

async function _insertTodayRows(
  adminClient: ReturnType<typeof createAdminClient>,
  memberId: string,
  protocolId: string,
  templateId: string,
  today: string
): Promise<void> {
  const { data: items } = await adminClient
    .from('protocol_items')
    .select('id, name, item_type, timing, sort_order')
    .eq('template_id', templateId)
    .order('sort_order', { ascending: true })

  if (!items || items.length === 0) return

  const rows = items.map((item) => ({
    member_id:   memberId,
    protocol_id: protocolId,
    item_id:     item.id,
    item_name:   item.name,
    log_date:    today,
    completed:   false,
    skipped:     false,
  }))

  await adminClient
    .from('daily_adherence')
    .upsert(rows, { onConflict: 'member_id,protocol_id,item_id,log_date', ignoreDuplicates: true })
}

async function _updateStreak(
  adminClient: ReturnType<typeof createAdminClient>,
  memberId: string,
  protocolId: string
): Promise<void> {
  const sixtyDaysAgo = new Date()
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)
  const cutoff = sixtyDaysAgo.toISOString().split('T')[0]

  // Get all dates with at least one completed item
  const { data: completedRows } = await adminClient
    .from('daily_adherence')
    .select('log_date')
    .eq('member_id', memberId)
    .eq('protocol_id', protocolId)
    .eq('completed', true)
    .gte('log_date', cutoff)

  const uniqueDates = new Set((completedRows ?? []).map((r) => r.log_date))

  // Count streak backwards from today
  const today = new Date()
  let currentStreak = 0
  const cursor = new Date(today)

  while (currentStreak < 60) {
    const dateStr = cursor.toISOString().split('T')[0]
    if (uniqueDates.has(dateStr)) {
      currentStreak++
      cursor.setDate(cursor.getDate() - 1)
    } else {
      break
    }
  }

  const { data: existing } = await adminClient
    .from('adherence_streaks')
    .select('longest_streak')
    .eq('member_id', memberId)
    .eq('protocol_id', protocolId)
    .maybeSingle()

  await adminClient
    .from('adherence_streaks')
    .upsert(
      {
        member_id:            memberId,
        protocol_id:          protocolId,
        current_streak:       currentStreak,
        longest_streak:       Math.max(existing?.longest_streak ?? 0, currentStreak),
        last_completed_date:  today.toISOString().split('T')[0],
        total_days_completed: uniqueDates.size,
        updated_at:           new Date().toISOString(),
      },
      { onConflict: 'member_id,protocol_id' }
    )
}
