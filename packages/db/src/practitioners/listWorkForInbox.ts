// ─── packages/db/src/practitioners/listWorkForInbox.ts ────────────────────────
// Returns all work items for the practitioner inbox, joined with case + client
// display data.
//
// Uses an authenticated SSR client — no admin client required. The
// `case_practitioner_select` policy on `client_cases` was extended in migration
// `extend_case_practitioner_select_all_statuses` to cover any work history
// (assigned, in_review, escalated, completed) without a status restriction.
// RLS ensures a practitioner can only read cases they hold work items for.

import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import type { InboxWorkItem, InboxUrgency, WorkType, WorkStatus } from './types'
import { isReviewPacksEnabled } from './reviewPackAccess'
import { makePseudonym } from './reviewPack'

// Sprint 3 (final review, item 3): when PRACTITIONER_REVIEW_PACKS_ENABLED is
// on, the inbox runs in DE-IDENTIFIED mode — no client_cases join (no
// client_id, no primary_concern), no identity-view lookup. Display name is
// the deterministic case pseudonym; operational case fields come from the
// column-scoped practitioner_case_index view (0052) where available.

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

// client_id is included so we can batch-fetch identities from the
// practitioner_client_identity view after the work-item queries resolve.
// The profiles FK join is intentionally absent — full-row access to profiles
// is not granted to practitioners; the view is the access boundary (F2).
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
    client_id,
    primary_concern,
    case_complexity_score,
    escalation_required
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
    client_id:             string
    primary_concern:       string | null
    case_complexity_score: number
    escalation_required:   boolean
  } | null
}

function mapRow(row: RawRow, clientName: string): InboxWorkItem {
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
    clientName,
    primaryConcern:      cc?.primary_concern        ?? null,
    caseComplexityScore: cc?.case_complexity_score  ?? 0,
    escalationRequired:  cc?.escalation_required    ?? false,
    urgency:             computeUrgency({ status, dueAt: row.due_at, assignedAt: row.assigned_at }),
  }
}

// ─── Pack-mode (de-identified) inbox ─────────────────────────────────────────

const PACK_WORK_SELECT =
  'id, case_id, work_type, status, assigned_at, started_at, completed_at, due_at' as const

type PackModeRow = Omit<RawRow, 'client_cases'>

interface CaseIndexRow {
  id: string
  case_complexity_score: number | null
  escalation_required: boolean | null
}

async function listWorkForInboxPackMode(
  client:         ReturnType<typeof createClient<Database>>,
  practitionerId: string,
): Promise<InboxWorkItem[]> {
  const { data: activeData, error: activeError } = await client
    .from('case_practitioner_work')
    .select(PACK_WORK_SELECT)
    .eq('practitioner_id', practitionerId)
    .in('status', ['assigned', 'in_review', 'escalated'])
    .order('assigned_at', { ascending: false })
  if (activeError) {
    throw new Error(`listWorkForInbox (active, pack mode) failed [${activeError.code}]: ${activeError.message}`)
  }

  const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS).toISOString()
  const { data: completedData, error: completedError } = await client
    .from('case_practitioner_work')
    .select(PACK_WORK_SELECT)
    .eq('practitioner_id', practitionerId)
    .eq('status', 'completed')
    .gte('completed_at', sevenDaysAgo)
    .order('completed_at', { ascending: false })
    .limit(5)
  if (completedError) {
    throw new Error(`listWorkForInbox (completed, pack mode) failed [${completedError.code}]: ${completedError.message}`)
  }

  const rows = [...(activeData ?? []), ...(completedData ?? [])] as unknown as PackModeRow[]

  // Operational case fields from the column-scoped view (0052). Pre-migration
  // the view does not exist: tolerate the error and fall back to defaults —
  // NEVER to a client_cases read.
  const indexMap = new Map<string, CaseIndexRow>()
  const caseIds = [...new Set(rows.map((r) => r.case_id))]
  if (caseIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: indexRows, error: indexError } = await (client as any)
      .from('practitioner_case_index')
      .select('id, case_complexity_score, escalation_required')
      .in('id', caseIds)
    if (!indexError) {
      for (const row of (indexRows ?? []) as CaseIndexRow[]) indexMap.set(row.id, row)
    }
  }

  return rows.map((row) => {
    const idx = indexMap.get(row.case_id)
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
      clientName:          makePseudonym(row.case_id),
      primaryConcern:      null,
      caseComplexityScore: idx?.case_complexity_score ?? 0,
      escalationRequired:  idx?.escalation_required   ?? false,
      urgency:             computeUrgency({ status, dueAt: row.due_at, assignedAt: row.assigned_at }),
    }
  })
}

// ─── Main function ────────────────────────────────────────────────────────────

export async function listWorkForInbox(
  client:         ReturnType<typeof createClient<Database>>,
  practitionerId: string,
): Promise<InboxWorkItem[]> {
  // Sprint 3: de-identified inbox when the review-pack mode is on. No
  // client_cases join, no identity lookup, no fallback to the identified path.
  if (isReviewPacksEnabled()) {
    return listWorkForInboxPackMode(client, practitionerId)
  }

  // Query 1 — active work items (assigned / in_review / escalated)
  const { data: activeData, error: activeError } = await client
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
  const { data: completedData, error: completedError } = await client
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

  // Batch-fetch client identities from the column-scoped view (F2).
  // The view enforces practitioner-scope access; RLS on profiles itself is not
  // relied on. We skip the query when there are no work items to avoid a
  // pointless .in('id', []) call (which may return empty or error depending
  // on the driver).
  const allRows   = [...(activeData ?? []), ...(completedData ?? [])]
  const clientIds = [...new Set(
    allRows
      .map(r => (r as unknown as RawRow).client_cases?.client_id)
      .filter((id): id is string => typeof id === 'string'),
  )]

  const nameMap = new Map<string, string>()
  if (clientIds.length > 0) {
    const { data: identities } = await client
      .from('practitioner_client_identity' as 'profiles') // cast: view not in generated types yet
      .select('id, full_name')
      .in('id', clientIds)
    for (const identity of identities ?? []) {
      const row = identity as unknown as { id: string; full_name: string | null }
      nameMap.set(row.id, row.full_name ?? 'Unknown')
    }
  }

  const getName = (r: RawRow) => {
    const clientId = r.client_cases?.client_id
    return clientId ? (nameMap.get(clientId) ?? 'Unknown') : 'Unknown'
  }

  const active    = (activeData    ?? []).map(r => mapRow(r as unknown as RawRow, getName(r as unknown as RawRow)))
  const completed = (completedData ?? []).map(r => mapRow(r as unknown as RawRow, getName(r as unknown as RawRow)))

  return [...active, ...completed]
}
