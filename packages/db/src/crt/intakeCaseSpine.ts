// ─── packages/db/src/crt/intakeCaseSpine.ts ──────────────────────────────────
// Establish case identity at Intake completion.
//
// THE DEFECT THIS FIXES
//
// Case creation used to happen inside generateBodyStory() and inside the
// practitioner assignment bridge. Both are optional, both are fire-and-forget,
// and both are currently switched off — so a completed Intake created no case
// at all, silently, because the caller's .catch() swallowed it. Case identity
// was a side effect of an AI feature.
//
// Identity is not optional. It is resolved here, synchronously, on the
// completion path, BEFORE any downstream work runs. Interpretation, body
// story and assignment may each be held, disabled or broken; the case exists
// regardless.
//
// THE REUSE RULE, STATED ONCE
//
//   · A client may have at most one case that is not closed.
//   · Completion RESUMES any existing non-closed case — draft,
//     intake_complete, active or paused. It never manufactures a second.
//   · A resumed `draft` case is advanced to `intake_complete`, because an
//     Intake has now completed.
//   · A resumed `intake_complete`, `active` or `paused` case keeps its status.
//     Re-submitting an Intake must never demote live care back to
//     intake_complete — that would misreport a client in active care.
//   · With no non-closed case, one is created at `intake_complete`.
//
// WHY `intake_complete` AND NOT `active`
//
// The lifecycle already distinguishes draft / intake_complete / active /
// paused / closed, and the CHECK constraint has carried all five since 0033.
// A completed Intake establishes CASE IDENTITY; it does not mean a
// practitioner has picked the case up. `active` is a later transition, when
// care genuinely activates. The pre-existing getOrCreateClientCase() inserts
// `active` directly, which is why it is not reused unchanged here.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types'

type AdminClient = SupabaseClient<Database>

/** Statuses that mean "this case is still a going concern". */
export const OPEN_CASE_STATUSES = ['draft', 'intake_complete', 'active', 'paused'] as const

/** The status a case is created in when an Intake completes. */
export const INTAKE_COMPLETION_CASE_STATUS = 'intake_complete' as const

export interface IntakeCaseSpineResult {
  caseId: string
  /** created = no open case existed; resumed = one did. */
  outcome: 'created' | 'resumed'
  /** The case's status after resolution. */
  caseStatus: string
  /** True when the response already carried this link — a repeat completion. */
  alreadyLinked: boolean
}

/**
 * Resolve the canonical case for a member completing an Intake.
 *
 * Does NOT touch intake_responses — see linkIntakeCompletionToCase for the
 * whole mandatory unit.
 */
export async function resolveCaseForIntakeCompletion(
  admin: AdminClient,
  memberId: string,
  opts?: { primaryConcern?: string },
): Promise<{ caseId: string; outcome: 'created' | 'resumed'; caseStatus: string }> {
  const { data: open, error: lookupErr } = await admin
    .from('client_cases')
    .select('id, status')
    .eq('client_id', memberId)
    .in('status', OPEN_CASE_STATUSES as unknown as string[])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // A lookup failure must NOT fall through to an insert: that is how a client
  // with an unreadable existing case ends up with a second one.
  if (lookupErr) throw lookupErr

  if (open) {
    // Only draft advances. Anything further along keeps its status.
    if (open.status === 'draft') {
      const { error: promoteErr } = await admin
        .from('client_cases')
        .update({ status: INTAKE_COMPLETION_CASE_STATUS })
        .eq('id', open.id)
        .eq('status', 'draft')          // guard: do not clobber a concurrent change
      if (promoteErr) throw promoteErr
      return { caseId: open.id, outcome: 'resumed', caseStatus: INTAKE_COMPLETION_CASE_STATUS }
    }
    return { caseId: open.id, outcome: 'resumed', caseStatus: open.status }
  }

  const { data: created, error: insertErr } = await admin
    .from('client_cases')
    .insert({
      client_id: memberId,
      status: INTAKE_COMPLETION_CASE_STATUS,
      primary_concern: opts?.primaryConcern ?? null,
    })
    .select('id, status')
    .single()

  if (insertErr) throw insertErr
  return { caseId: created.id, outcome: 'created', caseStatus: created.status }
}

/**
 * THE MANDATORY UNIT of Intake completion, after the response row is written.
 *
 *   1. if the response already carries a case_id, return it — idempotent
 *   2. otherwise resolve (create or resume) the canonical case
 *   3. link the response to it
 *   4. mark the intake session completed, consistently
 *
 * Anything that throws here must reach the caller. Intake completion may not
 * report success when case identity could not be established.
 *
 * Step 4 is inside this unit because Stage 0 found intake_responses.is_complete
 * = true while intake_sessions.status was still 'in_progress' on every
 * historical completion — the two tables disagreed about what completion
 * means. The session schema has carried a valid 'completed' state and a
 * completed_at column since it was created, so nothing is invented here.
 */
export async function linkIntakeCompletionToCase(
  admin: AdminClient,
  memberId: string,
  opts?: { primaryConcern?: string },
): Promise<IntakeCaseSpineResult> {
  // 1. Idempotency. A browser retry, a double submit or a replayed action
  //    must not produce a second case or a second link.
  const { data: response, error: responseErr } = await admin
    .from('intake_responses')
    .select('id, case_id')
    .eq('member_id', memberId)
    .maybeSingle()

  if (responseErr) throw responseErr
  if (!response) {
    throw new Error(
      `linkIntakeCompletionToCase: no intake_responses row for member ${memberId}`,
    )
  }

  if (response.case_id) {
    const { data: existing, error: statusErr } = await admin
      .from('client_cases')
      .select('status')
      .eq('id', response.case_id)
      .single()
    if (statusErr) throw statusErr
    await markIntakeSessionCompleted(admin, memberId)
    return {
      caseId: response.case_id,
      outcome: 'resumed',
      caseStatus: existing.status,
      alreadyLinked: true,
    }
  }

  // 2. Resolve.
  const resolved = await resolveCaseForIntakeCompletion(admin, memberId, opts)

  // 3. Link. Conditional on case_id still being NULL, so two concurrent
  //    completions cannot both claim the write; the loser re-reads and
  //    returns the winner's case rather than overwriting it. The 0067
  //    trigger independently refuses any reassignment.
  const { data: linked, error: linkErr } = await admin
    .from('intake_responses')
    .update({ case_id: resolved.caseId })
    .eq('id', response.id)
    .is('case_id', null)
    .select('case_id')
    .maybeSingle()

  if (linkErr) throw linkErr

  let finalCaseId = resolved.caseId
  if (!linked) {
    // Lost the race. Read what the winner wrote.
    const { data: winner, error: reReadErr } = await admin
      .from('intake_responses')
      .select('case_id')
      .eq('id', response.id)
      .single()
    if (reReadErr) throw reReadErr
    if (!winner.case_id) {
      throw new Error(
        `linkIntakeCompletionToCase: case link for member ${memberId} is unresolved`,
      )
    }
    finalCaseId = winner.case_id
  }

  // 4. Session consistency.
  await markIntakeSessionCompleted(admin, memberId)

  return {
    caseId: finalCaseId,
    outcome: finalCaseId === resolved.caseId ? resolved.outcome : 'resumed',
    caseStatus: resolved.caseStatus,
    alreadyLinked: false,
  }
}

/**
 * Bring intake_sessions into agreement with intake_responses.
 *
 * Scoped to sessions still in_progress, so a completed or abandoned session is
 * never rewritten. Idempotent: a repeat completion matches zero rows.
 */
export async function markIntakeSessionCompleted(
  admin: AdminClient,
  memberId: string,
): Promise<number> {
  const { data, error } = await admin
    .from('intake_sessions')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('member_id', memberId)
    .eq('status', 'in_progress')
    .select('id')

  if (error) throw error
  return data?.length ?? 0
}
