// ─── packages/db/src/practitioners/assignCaseForReview.ts ────────────────────
// Sprint 2 assignment bridge. Turns a completed intake into a practitioner-visible
// review: ensures the member's active client_case exists, then creates a
// `case_practitioner_work` item (work_type 'case_review', status 'assigned') that
// surfaces in the practitioner inbox via listWorkForInbox.
//
// Composes the two EXISTING mechanisms — getOrCreateClientCase + assignWork — so
// there is no new domain model. Idempotent: a repeated intake completion reuses an
// existing OPEN case_review for the same case+practitioner rather than duplicating.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import { getOrCreateClientCase } from '../crt/getOrCreateClientCase'
import { assignWork } from './assignWork'
import type { WorkType } from './types'

type AdminClient = SupabaseClient<Database>

export interface AssignCaseForReviewInput {
  memberId:        string
  practitionerId:  string
  assignedBy?:     string       // defaults to practitionerId (system/admin-sourced)
  workType?:       WorkType     // defaults to 'case_review'
  primaryConcern?: string
  dueAt?:          string
}

export interface AssignCaseForReviewResult {
  caseId:          string
  workId:          string
  alreadyAssigned: boolean
}

export async function assignCaseForReview(
  admin: AdminClient,
  input: AssignCaseForReviewInput,
): Promise<AssignCaseForReviewResult> {
  const workType = input.workType ?? 'case_review'

  // 1. Ensure the member's active case exists (idempotent).
  const caseId = await getOrCreateClientCase(admin, input.memberId, {
    primaryConcern: input.primaryConcern,
  })

  // 2. Idempotency — reuse an existing open work item for this case+practitioner+type.
  const { data: existing, error: lookupErr } = await admin
    .from('case_practitioner_work')
    .select('id')
    .eq('case_id', caseId)
    .eq('practitioner_id', input.practitionerId)
    .eq('work_type', workType)
    .in('status', ['assigned', 'in_review'])
    .order('assigned_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (lookupErr) throw new Error(`assignCaseForReview lookup failed [${lookupErr.code}]: ${lookupErr.message}`)
  if (existing) return { caseId, workId: existing.id, alreadyAssigned: true }

  // 3. Create the review assignment via the existing assignWork mechanism.
  const workId = await assignWork(admin, {
    caseId,
    practitionerId:   input.practitionerId,
    workType,
    assignedBy:       input.assignedBy ?? input.practitionerId,
    assignmentSource: 'admin',
    dueAt:            input.dueAt,
  })

  return { caseId, workId, alreadyAssigned: false }
}
