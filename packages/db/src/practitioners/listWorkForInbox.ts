// ─── packages/db/src/practitioners/listWorkForInbox.ts ────────────────────────
// Returns all work items for the practitioner inbox, joined with case + client
// display data.
//
// NOTE: Uses admin client (service_role), not an authenticated practitioner
// client. The `case_practitioner_select` policy on `client_cases` only covers
// statuses 'assigned' and 'in_review' — querying via an authenticated client
// would return null case data for escalated and completed work items, making
// those inbox sections unusable. The admin client is safe here because:
//   1. The caller derives practitionerId from an authenticated session.
//   2. All queries are hard-scoped to that practitioner's ID.
//   3. No data beyond the specified practitioner's work is returned.
// Tracked: Option A RLS migration (five-table practitioner policies) must land
// before Phase C — see Phase B Addendum Q6.

import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import type { InboxWorkItem, InboxUrgency, WorkType, WorkStatus } from './types'

// ─── Urgency computation ─────────────────────────────────────────────────────

const FIVE_DAYS_MS  = 5 * 24 * 60 * 60 * 1000
const TWO_DAYS_MS   = 2 * 24 * 60 * 60 * 1000
const ONE_DAY_MS    =     24 * 60 * 60 * 1000
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

// Exported for unit tests and potential reuse in UI layers.
export function computeUrgency(opts: {
  status:     string
  dueAt:      string | null
  assignedAt: string
}): InboxUrgency {
  const now = Date.now()
  if (opts.dueAt) {
    const due = new Date(opts.dueAt).getTime()
    if (due < now)               return 'overdue'
    if (due < now + ONE_DAY_MS)  return 'watch'
    return 'normal'
  }
  // No due date: fall back to time-since-assigned for unstarted items
  if (opts.status === 'assigned') {
    const age = now - new Date(opts.assignedAt).getTime()
    if (age > FIVE_DAYS_MS) return 'overdue'
    if (age > TWO_DAYS_MS)  return 'watch'
  }
  return 'normal'
}

// ─── Query helpers ────────────────────────────────────────────────────────────

const WORK_SELECT = `
  id,
  case_id,
  work_type,
  status,
  assigned_at,
  started_at,
  completed_at,
  due_at,
  client_cases (
    primary_concern,
    case_complexity_score,
    escalation_required,
    profiles:client_id ( full_name )
  )
` as const

type RawRow = {
  id:           string
  case_id:      string
  work_type:    string
  status:       string
  assigned_at:  string
  started_at:   string | null
  completed_at: string | null
  due_at:       string | null
  client_cases: {
    primary_concern:       string | null
    case_complexity_score: number
    escalation_required:   boolean
    profiles:              { full_name: string | null } | null
  } | null
}

function mapRow(row: RawRow): InboxWorkItem {
  const cc     = row.client_cases
  const status = row.status as WorkStatus
  return {
    workItemId:          row.id,
    caseId:              row.case_id,
    workType:            row.work_type as WorkType,
    status,
    assignedAt:          row.assigned_at,
    startedAt:           row.started_at,
    completedAt:         row.completed_at,
    dueAt:               row.due_at,
    clientName:          cc?.profiles?.full_name   ?? 'Unknown',
    primaryConcern:      cc?.primary_concern        ?? null,
    caseComplexityScore: cc?.case_complexity_score  ?? 0,
    escalationRequired:  cc?.escalation_required    ?? false,
    urgency:             computeUrgency({ status, dueAt: row.due_at, assignedAt: row.assigned_at }),
  }
}

// ─── Main function ────────────────────────────────────────────────────────────

export async function listWorkForInbox(
  adminClient:    ReturnType<typeof createClient<Database>>,
  practitionerId: string,
): Promise<InboxWorkItem[]> {
  // Query 1 — active work items (assigned / in_review / escalated)
  const { data: activeData, error: activeError } = await adminClient
    .from('case_practitioner_work')
    .select(WORK_SELECT)
    .eq('practitioner_id', practitionerId)
    .in('status', ['assigned', 'in_review', 'escalated'])
    .order('assigned_at', { ascending: false })

  if (activeError) {
    throw new Error(`listWorkForInbox (active) failed [${activeError.code}]: ${activeError.message}`)
  }

  // Query 2 — recently completed (last 7 days, max 5 per addendum S3)
  const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS).toISOString()
  const { data: completedData, error: completedError } = await adminClient
    .from('case_practitioner_work')
    .select(WORK_SELECT)
    .eq('practitioner_id', practitionerId)
    .eq('status', 'completed')
    .gte('completed_at', sevenDaysAgo)
    .order('completed_at', { ascending: false })
    .limit(5)

  if (completedError) {
    throw new Error(`listWorkForInbox (completed) failed [${completedError.code}]: ${completedError.message}`)
  }

  const active    = (activeData    ?? []).map(r => mapRow(r as unknown as RawRow))
  const completed = (completedData ?? []).map(r => mapRow(r as unknown as RawRow))

  return [...active, ...completed]
}
