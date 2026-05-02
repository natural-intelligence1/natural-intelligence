'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'

// ─── Internal: compute + upsert vitality score ────────────────────────────────

async function _computeVitalityScore(
  adminClient: ReturnType<typeof createAdminClient>,
  memberId:    string,
  ratings: {
    energy:    number
    sleep:     number
    mood:      number
    digestion: number
    overall:   number
  },
  scoreDate: string,
): Promise<void> {
  // Map 1-10 ratings → 0-100 scores
  const physicalScore  = ratings.energy    * 10
  const cognitiveScore = ratings.sleep     * 10
  const emotionalScore = ratings.mood      * 10
  const hormonalScore  = ratings.digestion * 10

  // Get today's daily adherence percentage
  const { data: adherenceRows } = await adminClient
    .from('daily_adherence')
    .select('completed, skipped')
    .eq('member_id', memberId)
    .eq('log_date', scoreDate)

  const rows = adherenceRows ?? []
  const adherencePct = rows.length > 0
    ? Math.round((rows.filter((r: { completed: boolean; skipped: boolean }) => r.completed || r.skipped).length / rows.length) * 100)
    : 0

  const overallScore = Math.round(
    ((physicalScore + cognitiveScore + emotionalScore + hormonalScore) / 4) * 0.6 +
    adherencePct * 0.4
  )

  // Upsert: one score per member per day
  await adminClient
    .from('vitality_scores')
    .upsert(
      {
        member_id:       memberId,
        score_date:      scoreDate,
        physical_score:  physicalScore,
        cognitive_score: cognitiveScore,
        emotional_score: emotionalScore,
        hormonal_score:  hormonalScore,
        adherence_pct:   adherencePct,
        overall_score:   overallScore,
      },
      { onConflict: 'member_id,score_date' },
    )
}

// ─── submitCheckin ────────────────────────────────────────────────────────────

export async function submitCheckin(formData: FormData): Promise<void> {
  const supabase    = createServerSupabaseClient()
  const adminClient = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  const today = new Date().toISOString().split('T')[0]

  const energy    = Number(formData.get('energy'))    || 0
  const sleep     = Number(formData.get('sleep'))     || 0
  const mood      = Number(formData.get('mood'))      || 0
  const digestion = Number(formData.get('digestion')) || 0
  const overall   = Number(formData.get('overall'))   || 0
  const notes     = (formData.get('notes') as string | null) ?? null

  // Upsert check-in for today
  await adminClient
    .from('lifetracker_checkins')
    .upsert(
      {
        member_id:        user.id,
        checkin_date:     today,
        energy_rating:    energy    > 0 ? energy    : null,
        sleep_rating:     sleep     > 0 ? sleep     : null,
        mood_rating:      mood      > 0 ? mood      : null,
        digestion_rating: digestion > 0 ? digestion : null,
        overall_rating:   overall   > 0 ? overall   : null,
        notes:            notes || null,
      },
      { onConflict: 'member_id,checkin_date' },
    )

  // Compute vitality score from ratings
  if (energy > 0 && sleep > 0 && mood > 0 && digestion > 0) {
    await _computeVitalityScore(adminClient, user.id, { energy, sleep, mood, digestion, overall }, today)
  }

  revalidatePath('/dashboard/lifetracker')
  revalidatePath('/dashboard')
}

// ─── addGoal ──────────────────────────────────────────────────────────────────

export async function addGoal(formData: FormData): Promise<void> {
  const supabase    = createServerSupabaseClient()
  const adminClient = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  const title       = (formData.get('title') as string | null)?.trim()
  if (!title) throw new Error('Title is required')

  const description  = (formData.get('description') as string | null)?.trim() || null
  const category     = (formData.get('category') as string | null)?.trim() || null
  const targetValue  = formData.get('target_value') ? Number(formData.get('target_value')) : null
  const targetUnit   = (formData.get('target_unit') as string | null)?.trim() || null
  const targetDate   = (formData.get('target_date') as string | null)?.trim() || null

  await adminClient
    .from('lifetracker_goals')
    .insert({
      member_id:    user.id,
      title,
      description,
      category,
      target_value: targetValue,
      target_unit:  targetUnit,
      target_date:  targetDate || null,
      status:       'active',
    })

  revalidatePath('/dashboard/lifetracker')
}

// ─── updateGoalStatus ─────────────────────────────────────────────────────────

export async function updateGoalStatus(goalId: string, status: string): Promise<void> {
  const supabase    = createServerSupabaseClient()
  const adminClient = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  await adminClient
    .from('lifetracker_goals')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', goalId)
    .eq('member_id', user.id)

  revalidatePath('/dashboard/lifetracker')
}

// ─── archiveGoal ─────────────────────────────────────────────────────────────

export async function archiveGoal(goalId: string): Promise<void> {
  return updateGoalStatus(goalId, 'archived')
}
