// ─── packages/db/src/crt/intakeCaseSpine.ts ──────────────────────────────────
// Establish case identity at Intake completion — in ONE transaction.
//
// THE DEFECT THIS FIXES
//
// Case creation used to happen inside generateBodyStory() and inside the
// practitioner assignment bridge. Both are optional, both are fire-and-forget,
// and both are currently switched off — so a completed Intake created no case
// at all, silently. Case identity was a side effect of an AI feature.
//
// THE DEFECT THE FIRST FIX STILL HAD
//
// Moving the work onto the completion path was necessary but not sufficient.
// It was five separate PostgREST requests, each its own transaction, so a
// failure partway left is_complete = true with case_id NULL — the exact state
// the invariant forbids. An application throw does not undo a committed row.
// Two concurrent first completions could also both read "no open case" and
// both insert one, orphaning the loser's.
//
// So the mandatory spine is a single PostgreSQL function, complete_intake_
// with_case (migration 0068), serialised per client by a transaction-scoped
// advisory lock. This module is now a thin, honest wrapper over that call:
// all the decision logic lives in SQL, where it can be atomic.
//
// The reuse rule it implements, stated once: at most one non-closed case per
// client. Completion resumes any draft / intake_complete / active / paused
// case and never manufactures a second. A resumed draft advances to
// intake_complete; anything further along keeps its status, because
// re-submitting an Intake must not demote a client in live care. With no open
// case, one is created at intake_complete — identity, not active care.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types'

type AdminClient = SupabaseClient<Database>

/** Statuses that mean "this case is still a going concern". */
export const OPEN_CASE_STATUSES = ['draft', 'intake_complete', 'active', 'paused'] as const

/** The status a case is created in when an Intake completes. */
export const INTAKE_COMPLETION_CASE_STATUS = 'intake_complete' as const

/** The one database primitive that performs the mandatory spine. */
export const INTAKE_COMPLETION_RPC = 'complete_intake_with_case' as const

export interface IntakeCaseSpineResult {
  caseId: string
  /** created = no open case existed; resumed = one did. */
  outcome: 'created' | 'resumed'
  /** The case's status after resolution. */
  caseStatus: string
  /** True when the response already carried this link — a repeat completion. */
  alreadyLinked: boolean
}

export interface IntakeCompletionInput {
  consentToAi?: boolean | null
  consentGivenAt?: string | null
  completedSections?: number
}

/**
 * Complete an Intake and establish its canonical case, atomically.
 *
 * Everything below happens inside ONE database transaction, or none of it
 * does:
 *
 *   · intake_responses.is_complete / completed_sections / consent
 *   · canonical client_cases row created or resumed
 *   · intake_responses.case_id linked (immutable once set — 0067)
 *   · intake_sessions → completed, with completed_at
 *
 * Anything that throws here must reach the caller. Intake completion may not
 * report success when case identity could not be established — and now it
 * cannot report success over a half-written database either.
 */
export async function completeIntakeWithCase(
  admin: AdminClient,
  memberId: string,
  input: IntakeCompletionInput = {},
): Promise<IntakeCaseSpineResult> {
  const { data, error } = await admin.rpc(INTAKE_COMPLETION_RPC, {
    p_member_id: memberId,
    p_consent_to_ai: input.consentToAi ?? null,
    p_consent_given_at: input.consentGivenAt ?? null,
    p_completed_sections: input.completedSections ?? 6,
  } as never)

  if (error) throw error

  // RETURNS TABLE gives a one-row set. An empty result means the function
  // returned nothing, which would leave identity unestablished — refuse it
  // rather than reporting a completion we cannot name a case for.
  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== 'object') {
    throw new Error(
      `${INTAKE_COMPLETION_RPC}: no row returned for member ${memberId}; case identity unresolved`,
    )
  }

  const r = row as {
    case_id?: string | null
    outcome?: string | null
    case_status?: string | null
    already_linked?: boolean | null
  }

  if (!r.case_id) {
    throw new Error(
      `${INTAKE_COMPLETION_RPC}: returned no case id for member ${memberId}; case identity unresolved`,
    )
  }

  return {
    caseId: r.case_id,
    outcome: r.outcome === 'created' ? 'created' : 'resumed',
    caseStatus: r.case_status ?? '',
    alreadyLinked: r.already_linked === true,
  }
}

/**
 * Previous name, kept so existing callers and the structural guard keep
 * working. It now also persists completion, because completion and the case
 * link have to be in the same transaction to be worth anything.
 */
export const linkIntakeCompletionToCase = completeIntakeWithCase
