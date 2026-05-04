// ─── packages/db/src/intake/getOrCreateIntakeSession.ts ──────────────────────
// Returns the member's active (status = 'in_progress') intake session,
// creating a new one if none exists.
//
// Live schema uses status text ('in_progress' | 'completed') rather than
// is_complete bool. All code uses status throughout.

import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Public types ─────────────────────────────────────────────────────────────

export interface IntakeSessionRow {
  id:                    string
  member_id:             string
  status:                string
  current_section:       string | null
  visible_question_ids:  string[] | null
  answered_question_ids: string[] | null
  completion_percentage: number | null
  red_flag_count:        number | null
  primary_system:        string | null
  arrival_emotion:       string | null
  started_at:            string | null
  completed_at:          string | null
  created_at:            string | null
  updated_at:            string | null
}

// ─── Implementation ───────────────────────────────────────────────────────────

export async function getOrCreateIntakeSession(
  supabase: SupabaseClient,
  memberId: string,
): Promise<IntakeSessionRow> {
  // Step 1: look for an existing in-progress session
  const { data: existing, error: selectError } = await supabase
    .from('intake_sessions')
    .select('*')
    .eq('member_id', memberId)
    .eq('status', 'in_progress')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (selectError) {
    throw new Error(
      `getOrCreateIntakeSession select failed [${selectError.code ?? 'unknown'}]: ${selectError.message}`,
    )
  }

  if (existing) {
    return existing as IntakeSessionRow
  }

  // Step 2: none found — create a new session
  // status defaults to 'in_progress' at the DB level, but we set it explicitly
  // so the intent is visible to the reader.
  const { data: created, error: insertError } = await supabase
    .from('intake_sessions')
    .insert({ member_id: memberId, status: 'in_progress' })
    .select()
    .single()

  if (insertError) {
    throw new Error(
      `getOrCreateIntakeSession insert failed [${insertError.code ?? 'unknown'}]: ${insertError.message}`,
    )
  }

  return created as IntakeSessionRow
}
