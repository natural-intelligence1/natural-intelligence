import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import type { AssignWorkInput } from './types'

export async function assignWork(
  adminClient: ReturnType<typeof createClient<Database>>,
  input: AssignWorkInput,
): Promise<string> {
  const { data, error } = await adminClient
    .from('case_practitioner_work')
    .insert({
      case_id:           input.caseId,
      practitioner_id:   input.practitionerId,
      work_type:         input.workType,
      assigned_by:       input.assignedBy,
      assignment_source: input.assignmentSource ?? 'admin',
      due_at:            input.dueAt ?? null,
    })
    .select('id')
    .single()

  if (error) throw new Error(`assignWork failed [${error.code}]: ${error.message}`)
  return data.id
}
