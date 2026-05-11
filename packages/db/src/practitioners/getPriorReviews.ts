// ─── packages/db/src/practitioners/getPriorReviews.ts ────────────────────────
// Returns completed work history on a case for the Prior Reviews panel.
// Excludes the current work item so practitioners don't see their own in-progress
// item as "prior context."
//
// Uses authenticated client — case_practitioner_work RLS scopes access correctly.
// Limit 10 most recent, ordered by completed_at descending.

import { createClient } from '@supabase/supabase-js'
import type { Database }   from '../types'
import type { PriorReview, WorkType, WorkStatus } from './types'

export async function getPriorReviews(
  client:            ReturnType<typeof createClient<Database>>,
  caseId:            string,
  currentWorkItemId: string,
): Promise<PriorReview[]> {
  const { data, error } = await client
    .from('case_practitioner_work')
    .select(`
      id,
      work_type,
      status,
      completed_at,
      notes,
      practitioners ( display_name )
    `)
    .eq('case_id', caseId)
    .eq('status', 'completed')
    .neq('id', currentWorkItemId)
    .order('completed_at', { ascending: false })
    .limit(10)

  if (error) {
    throw new Error(`getPriorReviews failed [${error.code}]: ${error.message}`)
  }

  return (data ?? []).map(row => {
    const pract = row.practitioners as { display_name: string } | null
    return {
      workItemId:       row.id,
      workType:         row.work_type as WorkType,
      status:           row.status as WorkStatus,
      completedAt:      row.completed_at!,
      notes:            row.notes,
      practitionerName: pract?.display_name ?? null,
    }
  })
}
