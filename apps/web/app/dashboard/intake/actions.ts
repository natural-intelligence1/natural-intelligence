'use server'

import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'
import { routeIntakeAssignment }      from '@natural-intelligence/db/practitioners'
import { generateHealthSynopsis }    from '../synopsis/actions'
import { generateBodyStory }         from '../story/actions'

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

  // Fire-and-forget: CRT body story generation (Sprint 17/18)
  generateBodyStory(user.id).catch((err) => {
    console.error('[completeIntake] body story generation failed:', err)
  })

  // Sprint 2 — assignment bridge: route the completed case to the client's linked
  // practitioner so it surfaces in the practitioner inbox. Fire-and-forget: a missing
  // link or failure never blocks intake completion.
  routeCompletedCaseToPractitioner(user.id).catch((err) => {
    console.error('[completeIntake] assignment bridge failed:', err)
  })
}

// ─── routeCompletedCaseToPractitioner ─────────────────────────────────────────
// Sprint 2 minimum assignment bridge (server-side, admin client), gated by the
// INTAKE_ASSIGNMENT_ENABLED kill-switch. Routing logic (flag → link resolution →
// assignment) lives in routeIntakeAssignment (db layer, unit-tested); this wrapper
// just invokes it and logs the outcome. DISABLED BY DEFAULT: no assignment is
// created unless INTAKE_ASSIGNMENT_ENABLED === "true".
async function routeCompletedCaseToPractitioner(memberId: string): Promise<void> {
  const admin = createAdminClient()
  const res = await routeIntakeAssignment(admin, memberId)

  if (res.status === 'disabled') {
    console.log(JSON.stringify({ event: 'intake.assignment.disabled', member_id: memberId }))
    return
  }
  if (res.status === 'no_linked_practitioner') {
    console.log(JSON.stringify({ event: 'intake.assignment.no_linked_practitioner', member_id: memberId }))
    return
  }
  console.log(JSON.stringify({
    event: 'intake.assignment.created', member_id: memberId,
    case_id: res.caseId, work_id: res.workId, already_assigned: res.alreadyAssigned,
  }))
}
