'use server'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'

export async function analyseSymptoms(
  symptoms: Array<{ symptom_id: string; severity: 1 | 2 | 3 }>
): Promise<void> {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  if (symptoms.length < 3) throw new Error('At least 3 symptoms required')

  const sessionId = crypto.randomUUID()
  const adminClient = createAdminClient()

  // Insert member_symptom_logs
  const logRows = symptoms.map(({ symptom_id, severity }) => ({
    member_id:  user.id,
    symptom_id,
    severity,
    session_id: sessionId,
    logged_at:  new Date().toISOString(),
  }))

  const { error: logError } = await adminClient
    .from('member_symptom_logs')
    .insert(logRows)

  if (logError) throw new Error(`Failed to log symptoms: ${logError.message}`)

  // Fetch all root_causes
  const { data: rootCauses } = await adminClient
    .from('root_causes')
    .select('id')

  if (!rootCauses || rootCauses.length === 0) throw new Error('No root causes found')

  // Fetch symptom_root_mappings for the submitted symptoms
  const symptomIds = symptoms.map((s) => s.symptom_id)
  const { data: mappings } = await adminClient
    .from('symptom_root_mappings')
    .select('symptom_id, root_cause_id, weight')
    .in('symptom_id', symptomIds)

  if (!mappings) throw new Error('Failed to fetch mappings')

  // Build severity lookup
  const severityMap = new Map<string, 1 | 2 | 3>(
    symptoms.map(({ symptom_id, severity }) => [symptom_id, severity])
  )

  // Weighted scoring: score += weight × (severity / 2)
  const scores = new Map<string, number>()
  for (const m of mappings) {
    const sev = severityMap.get(m.symptom_id) ?? 1
    const contribution = m.weight * (sev / 2)
    scores.set(m.root_cause_id, (scores.get(m.root_cause_id) ?? 0) + contribution)
  }

  if (scores.size === 0) throw new Error('No root cause matches found for the selected symptoms')

  // Normalise to 0-1 confidence
  const maxScore = Math.max(...Array.from(scores.values()))

  // Sort descending, take top 5
  const top5 = Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  // Insert rootfinder_results
  const resultRows = top5.map(([root_cause_id, weighted_score], idx) => ({
    session_id:       sessionId,
    member_id:        user.id,
    root_cause_id,
    rank:             idx + 1,
    weighted_score,
    confidence_score: weighted_score / maxScore,
    symptom_count:    symptoms.length,
  }))

  const { error: resultError } = await adminClient
    .from('rootfinder_results')
    .insert(resultRows)

  if (resultError) throw new Error(`Failed to save results: ${resultError.message}`)

  redirect(`/dashboard/rootfinder/${sessionId}`)
}
