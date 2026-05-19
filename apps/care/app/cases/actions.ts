'use server'
// ─── /cases server actions ────────────────────────────────────────────────────
//
// B.3 — Completion flow.
//
// submitReview:
//   Layer 3 auth check (server-side getUser before any RPC) then delegates to
//   the completeWorkItem helper, which calls complete_practitioner_work RPC.
//   The RPC owns Layer 2 (practitioner_id = auth.uid() + status guard) and
//   Layer 1 (SECURITY DEFINER, own search_path).
//
// Returns a discriminated union so the client component can handle errors
// without catching exceptions across the server/client boundary.

import { createServerSupabaseClient } from '@natural-intelligence/db'
import { completeWorkItem }           from '@natural-intelligence/db/practitioners'
import { setClinicalNotesOnSex }      from '@natural-intelligence/db/personalisation'

export type SubmitResult =
  | { ok: true;  eventId: string }
  | { ok: false; code: 'auth' | 'error'; message: string }

export async function submitReview(
  workItemId:     string,
  decision:       'approved' | 'needs_revision' | 'escalated',
  notes:          string,
  recommendation: string,
): Promise<SubmitResult> {
  const supabase = createServerSupabaseClient()

  // Layer 3: server-side session check — if the JWT is gone, catch it here
  // before any DB round-trip. getUser() validates with the Supabase Auth server
  // (not just local JWT decode), so it detects revoked sessions too.
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { ok: false, code: 'auth', message: 'Session expired. Please sign in again.' }
  }

  try {
    const eventId = await completeWorkItem(supabase, {
      workId:         workItemId,
      decision,
      notes,
      recommendation,
    })
    return { ok: true, eventId }
  } catch (err) {
    const message  = err instanceof Error ? err.message : String(err)
    const isAuth   = /PGRST301|JWT|401|auth/i.test(message)
    return {
      ok:      false,
      code:    isAuth ? 'auth' : 'error',
      message: isAuth
        ? 'Session expired. Please sign in again.'
        : 'Something went wrong. Please try again.',
    }
  }
}

// ─── updateClinicalNotesOnSex (PS.2) ─────────────────────────────────────────
//
// Server action wrapping the set_clinical_notes_on_sex RPC. Same three-layer
// pattern as submitReview:
//   • Layer 3 — server-side getUser() validates session before any RPC call
//   • Layer 2 — RPC checks the calling practitioner is assigned to a case
//               for the target client (case_practitioner_work join)
//   • Layer 1 — RPC rejects null auth.uid()
//
// No practitioner_id parameter is accepted from the client — identity is
// derived entirely from the authenticated session via createServerSupabaseClient().
//
// Returns a discriminated union so the client component handles errors
// without catching exceptions across the server/client boundary.

export type ClinicalNoteUpdateResult =
  | { ok: true }
  | { ok: false; code: 'auth' | 'forbidden' | 'error'; message: string }

export async function updateClinicalNotesOnSex(
  memberId: string,
  notes:    string,
): Promise<ClinicalNoteUpdateResult> {
  const supabase = createServerSupabaseClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { ok: false, code: 'auth', message: 'Session expired. Please sign in again.' }
  }

  try {
    await setClinicalNotesOnSex(supabase, memberId, notes)
    return { ok: true }
  } catch (err) {
    const message    = err instanceof Error ? err.message : String(err)
    const isAuth     = /PGRST301|JWT|401|Authentication required/i.test(message)
    const isForbid   = /Not authorised/i.test(message)
    return {
      ok:      false,
      code:    isAuth ? 'auth' : isForbid ? 'forbidden' : 'error',
      message: isAuth
        ? 'Session expired. Please sign in again.'
        : isForbid
          ? 'You are not authorised to edit clinical notes for this client.'
          : 'Could not save the note. Please try again.',
    }
  }
}
