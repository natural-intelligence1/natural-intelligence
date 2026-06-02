// ─── packages/db/src/practitioners/getIntakeSummary.ts ───────────────────────
// Returns a structured intake summary for the Client Summary panel.
//
// Uses authenticated client — RLS (practitioners_read_assigned_client,
// migration 0048) enforces practitioner-scoped access on intake_responses
// and intake_answers. Q6 Option A closed.
//
// Queries:
//   1. intake_responses — top-level structured fields (most recent row for member)
//   2. intake_answers   — curated clinical flags: post_exertional_worsening,
//                         concern_severity_baseline

import { createClient } from '@supabase/supabase-js'
import type { Database }    from '../types'
import type { IntakeSummary } from './types'

export async function getIntakeSummary(
  client:   ReturnType<typeof createClient<Database>>,
  memberId: string,
): Promise<IntakeSummary | null> {
  // ── Query 1: intake_responses ─────────────────────────────────────────────
  // Note: 'most_want_to_understand' (Sprint B Phase 1, migration 0049) is in
  // the live schema but not yet in the generated Database TypeScript types.
  // Storing the column list in a variable bypasses literal-type validation
  // while keeping the runtime fetch correct.
  const IR_SELECT = [
    'arrival_emotion', 'primary_concerns', 'primary_system',
    'stress_level', 'sleep_quality', 'energy_level',
    'diet_description', 'current_medications', 'current_supplements',
    'symptom_onset', 'timeline_last_well', 'timeline_trigger',
    'diagnosed_conditions', 'most_want_to_understand', 'is_complete',
    // Sprint B Phase 2 — Best Self Baseline (migration 0050).
    'best_self_description', 'best_self_sleep', 'best_self_energy',
    'best_self_mood', 'best_self_recovery_goal',
  ].join(', ')

  const { data: irRaw, error: irErr } = await client
    .from('intake_responses')
    .select(IR_SELECT)
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (irErr) {
    throw new Error(`getIntakeSummary (responses) failed [${irErr.code}]: ${irErr.message}`)
  }
  if (!irRaw) return null

  // Runtime shape — column names match the select string above; mostWantToUnderstand
  // is the new Sprint B Phase 1 field.
  const ir = irRaw as unknown as {
    arrival_emotion:          string | null
    primary_concerns:         string[] | null
    primary_system:           string | null
    stress_level:             number | null
    sleep_quality:            number | null
    energy_level:             number | null
    diet_description:         string | null
    current_medications:      string | null
    current_supplements:      string | null
    symptom_onset:            string | null
    timeline_last_well:       string | null
    timeline_trigger:         string | null
    diagnosed_conditions:     string[] | null
    most_want_to_understand:  string | null
    is_complete:              boolean | null
    best_self_description:    string | null
    best_self_sleep:          string | null
    best_self_energy:         string | null
    best_self_mood:           string | null
    best_self_recovery_goal:  string | null
  }

  // ── Query 2: curated intake_answers ──────────────────────────────────────
  const { data: answers, error: answersErr } = await client
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
    // Sprint B Phase 1 — signature question (most_want_to_understand column
    // added in migration 0049). Generated DB types not yet regenerated;
    // accessed via the cast shape above.
    mostWantToUnderstand:    ir.most_want_to_understand ?? null,
    // Sprint B Phase 2 — Best Self Baseline (migration 0050).
    bestSelfDescription:     ir.best_self_description    ?? null,
    bestSelfSleep:           ir.best_self_sleep          ?? null,
    bestSelfEnergy:          ir.best_self_energy         ?? null,
    bestSelfMood:            ir.best_self_mood           ?? null,
    bestSelfRecoveryGoal:    ir.best_self_recovery_goal  ?? null,
  }
}
