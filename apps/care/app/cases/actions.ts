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
