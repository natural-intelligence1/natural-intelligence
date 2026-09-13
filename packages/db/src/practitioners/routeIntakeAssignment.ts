// ─── packages/db/src/practitioners/routeIntakeAssignment.ts ──────────────────
// Sprint 2 assignment bridge routing + KILL-SWITCH.
//
// The completed-intake → practitioner-assignment bridge is DISABLED BY DEFAULT.
// It only routes when INTAKE_ASSIGNMENT_ENABLED === "true". This lets the bridge
// be paused/enabled operationally (env var) without a code change, so identified
// intake data cannot reach a practitioner inbox until it is explicitly turned on
// (i.e. after the Sprint 3 safety/consent/anonymisation gates exist).
//
// Routing logic (flag → link resolution → assignment) lives here in the db layer
// so it is unit-testable with synthetic data; the web action is a thin wrapper.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import { assignCaseForReview } from './assignCaseForReview'
import { assertSynopsisSharingPermitted } from './reviewPackAccess'

type AdminClient = SupabaseClient<Database>

export type RouteIntakeAssignmentResult =
  | { status: 'disabled' }
  | { status: 'blocked_by_consent'; reason: string }
  | { status: 'no_linked_practitioner' }
  | { status: 'assigned'; caseId: string; workId: string; alreadyAssigned: boolean }

/** Kill-switch: the assignment bridge is off unless explicitly enabled. */
export function isIntakeAssignmentEnabled(): boolean {
  return process.env.INTAKE_ASSIGNMENT_ENABLED === 'true'
}

export async function routeIntakeAssignment(
  admin: AdminClient,
  memberId: string,
): Promise<RouteIntakeAssignmentResult> {
  // Kill-switch — default disabled. No work item is created unless explicitly on.
  if (!isIntakeAssignmentEnabled()) return { status: 'disabled' }

  // Sprint 3 consent gate — FAIL CLOSED. Routing puts a case in front of a
  // practitioner (a de-identified synopsis under the target model), so it
  // requires an active deidentified_synopsis_sharing consent and no
  // restriction/withdrawal on file, exactly like pack generation.
  try {
    await assertSynopsisSharingPermitted(admin, memberId)
  } catch (err) {
    return {
      status: 'blocked_by_consent',
      reason: err instanceof Error ? err.message : 'consent check failed',
    }
  }

  // Resolve the client's active practitioner (ended_at IS NULL).
  const { data: link, error } = await admin
    .from('client_practitioner_links')
    .select('practitioner_id')
    .eq('client_id', memberId)
    .is('ended_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`routeIntakeAssignment link lookup failed [${error.code}]: ${error.message}`)

  if (!link?.practitioner_id) return { status: 'no_linked_practitioner' }

  const res = await assignCaseForReview(admin, { memberId, practitionerId: link.practitioner_id })
  return { status: 'assigned', caseId: res.caseId, workId: res.workId, alreadyAssigned: res.alreadyAssigned }
}
