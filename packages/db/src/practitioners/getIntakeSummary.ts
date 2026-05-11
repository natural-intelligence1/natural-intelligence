// ─── packages/db/src/practitioners/getIntakeSummary.ts ───────────────────────
// Returns a structured intake summary for the Client Summary panel.
//
// Uses admin client — intake/biohub tables have no practitioner RLS policy.
// Temporary: Option A migration required before Phase C (see Phase B Addendum Q6).
//
// Queries:
//   1. intake_responses — top-level structured fields (most recent row for member)
//   2. intake_answers   — curated clinical flags: post_exertional_worsening,
//                         concern_severity_baseline

import { createClient } from '@supabase/supabase-js'
import type { Database }    from '../types'
import type { IntakeSummary } from './types'

export async function getIntakeSummary(
  adminClient:  ReturnType<typeof createClient<Database>>,
  memberId:     string,
): Promise<IntakeSummary | null> {
  // ── Query 1: intake_responses ─────────────────────────────────────────────
  const { data: ir, error: irErr } = await adminClient
    .from('intake_responses')
    .select(`
      arrival_emotion,
      primary_concerns,
      primary_system,
      stress_level,
      sleep_quality,
      energy_level,
      diet_description,
      current_medications,
      current_supplements,
      symptom_onset,
      timeline_last_well,
      timeline_trigger,
      diagnosed_conditions,
      is_complete
    `)
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (irErr) {
    throw new Error(`getIntakeSummary (responses) failed [${irErr.code}]: ${irErr.message}`)
  }
  if (!ir) return null

  // ── Query 2: curated intake_answers ──────────────────────────────────────
  const { data: answers, error: answersErr } = await adminClient
    .from('intake_answers')
    .select('question_id, answer')
    .eq('member_id', memberId)
    .in('question_id', ['post_exertional_worsening', 'concern_severity_baseline'])

  if (answersErr) {
    throw new Error(`getIntakeSummary (answers) failed [${answersErr.code}]: ${answersErr.message}`)
  }

  const answerMap: Record<string, unknown> = {}
  for (const a of answers ?? []) {
    answerMap[a.question_id] = a.answer
  }

  const rawPex = answerMap['post_exertional_worsening']
  const rawSev = answerMap['concern_severity_baseline']

  return {
    arrivalEmotion:          ir.arrival_emotion,
    primaryConcerns:         ir.primary_concerns,
    primarySystem:           ir.primary_system,
    stressLevel:             ir.stress_level,
    sleepQuality:            ir.sleep_quality,
    energyLevel:             ir.energy_level,
    concernSeverity:         typeof rawSev === 'number' ? rawSev : null,
    postExertionalWorsening: typeof rawPex === 'boolean' ? rawPex : null,
    dietDescription:         ir.diet_description,
    currentMedications:      ir.current_medications,
    currentSupplements:      ir.current_supplements,
    symptomOnset:            ir.symptom_onset,
    timelineLastWell:        ir.timeline_last_well,
    timelineTrigger:         ir.timeline_trigger,
    diagnosedConditions:     ir.diagnosed_conditions,
  }
}
