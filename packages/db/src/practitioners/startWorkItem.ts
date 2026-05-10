// ─── packages/db/src/practitioners/startWorkItem.ts ──────────────────────────
// Transitions a work item from 'assigned' → 'in_review' when the practitioner
// opens the workspace for the first time.
//
// Idempotent: the conditional .eq('status', 'assigned') filter means the update
// is a no-op if the item is already 'in_review', 'completed', or 'escalated'.
// This makes the function safe to call multiple times (fire-and-forget pattern).
//
// Uses the authenticated practitioner client. The work_practitioner_update RLS
// policy (practitioner_id = auth.uid()) ensures practitioners can only update
// their own work items — no practitioner_id filter needed in the query.

import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'

export async function startWorkItem(
  client:     ReturnType<typeof createClient<Database>>,
  workItemId: string,
): Promise<void> {
  const { error } = await client
    .from('case_practitioner_work')
    .update({
      status:     'in_review',
      started_at: new Date().toISOString(),
    })
    .eq('id', workItemId)
    .eq('status', 'assigned')  // Conditional: no-op if already transitioned

  if (error) throw new Error(`startWorkItem failed [${error.code}]: ${error.message}`)
}
