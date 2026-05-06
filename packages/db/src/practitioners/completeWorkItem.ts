import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import type { CompleteWorkItemInput } from './types'

export async function completeWorkItem(
  authenticatedClient: ReturnType<typeof createClient<Database>>,
  input: CompleteWorkItemInput,
): Promise<string> {
  const { data, error } = await authenticatedClient.rpc('complete_practitioner_work', {
    p_work_id:        input.workId,
    p_decision:       input.decision,
    p_notes:          input.notes,
    p_recommendation: input.recommendation,
  })

  if (error) throw new Error(`completeWorkItem failed [${error.code}]: ${error.message}`)
  return data as string
}
