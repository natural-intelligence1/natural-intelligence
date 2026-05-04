'use server'

import { createServerSupabaseClient } from '@natural-intelligence/db'
import { generateHealthSynopsis } from '../synopsis/actions'

// ─── saveIntakeSection ────────────────────────────────────────────────────────
// Upsert a partial section's data into intake_responses.
// Uses select-first pattern (no unique constraint on member_id).
export async function saveIntakeSection(
  sectionData: Record<string, unknown>,
  sectionNumber: number
): Promise<void> {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  const { data: existing } = await supabase
    .from('intake_responses')
    .select('id, completed_sections')
    .eq('member_id', user.id)
    .maybeSingle()

  const completedSections = Math.max(existing?.completed_sections ?? 0, sectionNumber)

  if (existing) {
    await supabase
      .from('intake_responses')
      .update({
        ...sectionData,
        completed_sections: completedSections,
        updated_at: new Date().toISOString(),
      })
      .eq('member_id', user.id)
  } else {
    await supabase
      .from('intake_responses')
      .insert({
        member_id: user.id,
        ...sectionData,
        completed_sections: completedSections,
      })
  }
}

// ─── completeIntake ───────────────────────────────────────────────────────────
// Mark the intake as complete, record consent, and fire off synopsis generation
// (non-blocking — same fire-and-forget pattern as BioHub's parseLabReport).
export async function completeIntake(consentData: {
  consent_to_ai_analysis: boolean
  consent_given_at: string
}): Promise<void> {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  const { data: existing } = await supabase
    .from('intake_responses')
    .select('id, completed_sections')
    .eq('member_id', user.id)
    .maybeSingle()

  const finalData = {
    ...consentData,
    is_complete: true,
    completed_sections: 6,
    updated_at: new Date().toISOString(),
  }

  if (existing) {
    await supabase
      .from('intake_responses')
      .update(finalData)
      .eq('member_id', user.id)
  } else {
    await supabase
      .from('intake_responses')
      .insert({ member_id: user.id, ...finalData })
  }

  // Fire-and-forget: synopsis page shows generating state with meta refresh
  generateHealthSynopsis(user.id).catch((err) => {
    console.error('[completeIntake] synopsis generation failed:', err)
  })
}
