import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import type { AssignedWork, WorkStatus } from './types'

export async function listAssignedWork(
  adminClient: ReturnType<typeof createClient<Database>>,
  practitionerId: string,
  status?: WorkStatus | WorkStatus[],
): Promise<AssignedWork[]> {
  let q = adminClient
    .from('case_practitioner_work')
    .select('*')
    .eq('practitioner_id', practitionerId)
    .order('assigned_at', { ascending: false })

  if (status !== undefined) {
    const statuses = Array.isArray(status) ? status : [status]
    q = q.in('status', statuses)
  }

  const { data, error } = await q
  if (error) throw new Error(`listAssignedWork failed [${error.code}]: ${error.message}`)

  return (data ?? []).map((row) => ({
    id:               row.id,
    caseId:           row.case_id,
    practitionerId:   row.practitioner_id,
    workType:         row.work_type as AssignedWork['workType'],
    status:           row.status as AssignedWork['status'],
    assignedBy:       row.assigned_by,
    assignmentSource: row.assignment_source as AssignedWork['assignmentSource'],
    dueAt:            row.due_at,
    assignedAt:       row.assigned_at,
    startedAt:        row.started_at,
    completedAt:      row.completed_at,
    notes:            row.notes,
    outputEventId:    row.output_event_id,
  }))
}
