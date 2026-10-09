// DailyPath hotfix — proves the application's data path matches the LIVE
// schema. SYNTHETIC DATA ONLY (createTestUser fixtures, self-cleaning).
// Skips when no DB env is present.
//
// These tests exist because the application queried `daily_adherence.item_id`
// for an extended period. That column does not exist and never did: the live
// table is keyed (member_id, protocol_id, item_name, log_date). Migration
// 0029 declares `item_id`, but it is a retrospective record of hand-created
// tables and diverges from production in several places — see its header.
//
// Every test below exercises the SAME queries the application now issues, so
// a future regression to `item_id` fails here rather than in production.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import { createTestUser, deleteTestUser } from '../practitioners/__test-helpers__/createTestUser'

const HAVE_DB = !!process.env.NEXT_PUBLIC_SUPABASE_URL
function mkAdmin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

/** Exactly the columns apps/web/app/dashboard/dailypath/page.tsx selects. */
const ADHERENCE_SELECT =
  'id, item_name, log_date, completed, completed_at, skipped, skip_reason'
/** Exactly the conflict target the application now uses. */
const CONFLICT_TARGET = 'member_id,protocol_id,item_name,log_date'

describe.skipIf(!HAVE_DB)('DailyPath — application path matches live schema', () => {
  let admin: ReturnType<typeof mkAdmin>
  let member: Awaited<ReturnType<typeof createTestUser>>
  let templateId: string
  let protocolId: string
  const itemNames = ['DP-TEST Magnesium', 'DP-TEST Walk', 'DP-TEST Protein']
  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  beforeAll(async () => {
    admin = mkAdmin()
    member = await createTestUser(admin, 'dp-live-schema-member')

    const { data: tpl, error: tplErr } = await admin
      .from('protocol_templates')
      .insert({ name: 'DP-TEST Template', description: 'synthetic', is_published: false })
      .select('id').single()
    if (tplErr) throw tplErr
    templateId = tpl!.id

    // dose / timing / notes live on protocol_items — this is what the page
    // resolves for display, and what silently vanished under the old lookup.
    const { error: itemsErr } = await admin.from('protocol_items').insert([
      { template_id: templateId, name: itemNames[0], item_type: 'supplement',
        dose: '200 mg', timing: 'With evening meal', notes: 'Synthetic note A', display_order: 1 },
      { template_id: templateId, name: itemNames[1], item_type: 'lifestyle',
        dose: null, timing: 'After lunch', notes: null, display_order: 2 },
      { template_id: templateId, name: itemNames[2], item_type: 'nutrition',
        dose: '20-30 g', timing: 'Breakfast', notes: 'Synthetic note C', display_order: 3 },
    ])
    if (itemsErr) throw itemsErr

    const { data: proto, error: protoErr } = await admin
      .from('member_protocols')
      .insert({ member_id: member.id, template_id: templateId,
                name: 'DP-TEST Protocol', status: 'active', started_at: today })
      .select('id').single()
    if (protoErr) throw protoErr
    protocolId = proto!.id
  })

  afterAll(async () => {
    if (!admin) return
    await admin.from('daily_adherence').delete().eq('member_id', member.id)
    await admin.from('adherence_streaks').delete().eq('member_id', member.id)
    await admin.from('member_protocols').delete().eq('member_id', member.id)
    if (templateId) {
      await admin.from('protocol_items').delete().eq('template_id', templateId)
      await admin.from('protocol_templates').delete().eq('id', templateId)
    }
    await deleteTestUser(admin, member.id)
  })

  // ── The defect itself ──────────────────────────────────────────────────────

  it('A. daily_adherence has NO item_id column (the root cause)', async () => {
    const { error } = await admin.from('daily_adherence').select('item_id').limit(1)
    expect(error).not.toBeNull()
    expect(`${error?.message} ${error?.code}`).toMatch(/item_id|42703/)
  })

  it('B. the OLD conflict target is rejected — no such constraint exists', async () => {
    const { error } = await admin.from('daily_adherence').upsert(
      [{ member_id: member.id, protocol_id: protocolId, item_name: 'DP-TEST Probe',
         item_type: 'supplement', log_date: today, completed: false, skipped: false }],
      { onConflict: 'member_id,protocol_id,item_id,log_date', ignoreDuplicates: true },
    )
    // PostgREST cannot infer an ON CONFLICT target that does not exist.
    expect(error).not.toBeNull()
    await admin.from('daily_adherence').delete()
      .eq('member_id', member.id).eq('item_name', 'DP-TEST Probe')
  })

  it('C. the SELECT the page issues succeeds against the live table', async () => {
    const { error } = await admin
      .from('daily_adherence').select(ADHERENCE_SELECT)
      .eq('member_id', member.id).eq('protocol_id', protocolId).eq('log_date', today)
    expect(error).toBeNull()
  })

  // ── Generation, idempotency, persistence ───────────────────────────────────

  const rowsFor = (date: string) => itemNames.map((name, i) => ({
    member_id: member.id, protocol_id: protocolId, item_name: name,
    item_type: ['supplement', 'lifestyle', 'nutrition'][i],
    log_date: date, completed: false, skipped: false,
  }))

  it('D. generates today’s rows via the real conflict target', async () => {
    const { error } = await admin.from('daily_adherence')
      .upsert(rowsFor(today), { onConflict: CONFLICT_TARGET, ignoreDuplicates: true })
    expect(error).toBeNull()

    const { data } = await admin.from('daily_adherence').select(ADHERENCE_SELECT)
      .eq('member_id', member.id).eq('protocol_id', protocolId).eq('log_date', today)
    expect(data).toHaveLength(3)
  })

  it('E. re-running the same day creates NO duplicate rows', async () => {
    const { error } = await admin.from('daily_adherence')
      .upsert(rowsFor(today), { onConflict: CONFLICT_TARGET, ignoreDuplicates: true })
    expect(error).toBeNull()

    const { data } = await admin.from('daily_adherence').select('id')
      .eq('member_id', member.id).eq('protocol_id', protocolId).eq('log_date', today)
    expect(data).toHaveLength(3)   // still 3, not 6
  })

  it('F. the next day creates its own separate rows', async () => {
    await admin.from('daily_adherence')
      .upsert(rowsFor(tomorrow), { onConflict: CONFLICT_TARGET, ignoreDuplicates: true })

    const { data: all } = await admin.from('daily_adherence').select('log_date')
      .eq('member_id', member.id).eq('protocol_id', protocolId)
    expect(all).toHaveLength(6)
    expect(new Set(all!.map((r) => r.log_date)).size).toBe(2)
  })

  it('G. marking Done persists', async () => {
    const { data: row } = await admin.from('daily_adherence').select('id')
      .eq('member_id', member.id).eq('log_date', today).eq('item_name', itemNames[0]).single()

    await admin.from('daily_adherence')
      .update({ completed: true, completed_at: new Date().toISOString(),
                skipped: false, skip_reason: null })
      .eq('id', row!.id).eq('member_id', member.id)

    const { data: after } = await admin.from('daily_adherence')
      .select('completed, completed_at, skipped').eq('id', row!.id).single()
    expect(after!.completed).toBe(true)
    expect(after!.completed_at).not.toBeNull()
    expect(after!.skipped).toBe(false)
  })

  it('H. marking Not done (skipped) persists, with its reason', async () => {
    const { data: row } = await admin.from('daily_adherence').select('id')
      .eq('member_id', member.id).eq('log_date', today).eq('item_name', itemNames[1]).single()

    await admin.from('daily_adherence')
      .update({ skipped: true, skip_reason: 'Synthetic reason',
                completed: false, completed_at: null })
      .eq('id', row!.id).eq('member_id', member.id)

    const { data: after } = await admin.from('daily_adherence')
      .select('skipped, skip_reason, completed').eq('id', row!.id).single()
    expect(after!.skipped).toBe(true)
    expect(after!.skip_reason).toBe('Synthetic reason')
    expect(after!.completed).toBe(false)
  })

  // ── The second defect: metadata resolution ─────────────────────────────────

  it('I. dose, timing and notes resolve through the name lookup', async () => {
    const { data: adherence } = await admin.from('daily_adherence').select(ADHERENCE_SELECT)
      .eq('member_id', member.id).eq('protocol_id', protocolId).eq('log_date', today)
    const { data: items } = await admin.from('protocol_items')
      .select('id, name, item_type, dose, timing, notes, display_order')
      .eq('template_id', templateId).order('display_order', { ascending: true })

    // EXACTLY the merge the page now performs.
    const itemMeta = new Map((items ?? []).map((i) => [i.name, i]))
    const merged = (adherence ?? []).map((a) => {
      const meta = itemMeta.get(a.item_name) as NonNullable<typeof items>[number] | undefined
      return {
        name: a.item_name,
        itemType: meta?.item_type ?? 'supplement',
        dose: meta?.dose ?? null,
        timing: meta?.timing ?? null,
        notes: meta?.notes ?? null,
        sortOrder: meta?.display_order ?? 99,
      }
    }).sort((x, y) => x.sortOrder - y.sortOrder)

    expect(merged).toHaveLength(3)
    // Every row resolved to real metadata — none fell through to defaults.
    expect(merged.every((m) => m.sortOrder !== 99)).toBe(true)

    const mag = merged.find((m) => m.name === itemNames[0])!
    expect(mag.dose).toBe('200 mg')
    expect(mag.timing).toBe('With evening meal')
    expect(mag.notes).toBe('Synthetic note A')
    expect(mag.itemType).toBe('supplement')

    const walk = merged.find((m) => m.name === itemNames[1])!
    expect(walk.timing).toBe('After lunch')
    expect(walk.itemType).toBe('lifestyle')   // not the 'supplement' default
    expect(walk.dose).toBeNull()              // genuinely absent, not lost

    expect(merged.map((m) => m.name)).toEqual(itemNames)  // display_order honoured
  })

  it('J. the OLD lookup would have lost every value (regression guard)', async () => {
    const { data: adherence } = await admin.from('daily_adherence')
      .select(ADHERENCE_SELECT).eq('member_id', member.id).eq('log_date', today)
    const { data: items } = await admin.from('protocol_items')
      .select('id, name, dose, timing, notes, display_order').eq('template_id', templateId)

    // The pre-fix merge: map keyed by protocol_items.id, read with a.item_id.
    const oldMeta = new Map((items ?? []).map((i) => [i.id, i]))
    const oldMerged = (adherence ?? []).map((a) =>
      oldMeta.get((a as unknown as { item_id?: string }).item_id as string))

    expect(oldMerged.every((m) => m === undefined)).toBe(true)
  })

  // ── History and streak ─────────────────────────────────────────────────────

  it('K. history query still renders across the date range', async () => {
    const { data, error } = await admin.from('daily_adherence')
      .select('log_date, completed')
      .eq('member_id', member.id).eq('protocol_id', protocolId)
      .gte('log_date', today).lte('log_date', tomorrow)
    expect(error).toBeNull()
    expect(data!.length).toBe(6)
    expect(data!.some((r) => r.completed)).toBe(true)
  })

  it('L. streak upsert works on the live member-only unique key', async () => {
    const { data: completedRows } = await admin.from('daily_adherence')
      .select('log_date').eq('member_id', member.id)
      .eq('protocol_id', protocolId).eq('completed', true)
    const uniqueDates = new Set((completedRows ?? []).map((r) => r.log_date))

    const { error } = await admin.from('adherence_streaks').upsert({
      member_id: member.id, current_streak: 1,
      longest_streak: 1, last_completed_date: today,
      total_days_completed: uniqueDates.size, updated_at: new Date().toISOString(),
    }, { onConflict: 'member_id' })
    expect(error).toBeNull()

    const { data: streak } = await admin.from('adherence_streaks')
      .select('current_streak, total_days_completed').eq('member_id', member.id).single()
    expect(streak!.current_streak).toBe(1)
    expect(streak!.total_days_completed).toBe(uniqueDates.size)
  })

  // ── No clinical-content mutation ───────────────────────────────────────────

  it('M. the fix stores no new clinical content — dose/timing stay on protocol_items', async () => {
    const { data: rows } = await admin.from('daily_adherence')
      .select('dose, timing, notes, item_type, item_name')
      .eq('member_id', member.id).eq('log_date', today)

    // The generation path writes item_name and item_type only. dose/timing/
    // notes remain null ON THE ADHERENCE ROW and are resolved at read time
    // from protocol_items, so no clinical value is copied or duplicated.
    for (const r of rows!) {
      expect(r.dose).toBeNull()
      expect(r.timing).toBeNull()
      expect(r.notes).toBeNull()
      expect(r.item_name).toBeTruthy()
      expect(r.item_type).toBeTruthy()
    }
  })

  it('N. protocol_items were not modified by any of the above', async () => {
    const { data: items } = await admin.from('protocol_items')
      .select('name, dose, timing, notes').eq('template_id', templateId)
      .order('display_order', { ascending: true })
    expect(items!.map((i) => i.name)).toEqual(itemNames)
    expect(items![0].dose).toBe('200 mg')
    expect(items![0].notes).toBe('Synthetic note A')
  })
})
