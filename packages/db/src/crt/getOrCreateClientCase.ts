// ─── packages/db/src/crt/getOrCreateClientCase.ts ────────────────────────────
// Returns the open client_case for a member, creating one if none exists.
//
// NOT the Intake-completion path. Case identity is established by
// linkIntakeCompletionToCase() in ./intakeCaseSpine.ts, synchronously, before
// any optional downstream work. This helper remains for the two callers that
// run AFTER that — body-story generation and the practitioner assignment
// bridge — which need a case to attach to and must never create a second one.
//
// LOOKUP WIDENED (Stage 1). It previously matched status = 'active' only.
// Once Intake completion started creating cases at 'intake_complete', an
// 'active'-only lookup would have missed the case it was meant to find and
// inserted a duplicate — for every client, the moment the AI hold was lifted.
// It now resumes any case that is not closed, which is the same reuse rule
// the completion path follows.
//
// What it INSERTS is deliberately unchanged: this is not the Intake path, and
// rewriting the wider case state machine is out of scope here.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import { OPEN_CASE_STATUSES } from './intakeCaseSpine'

type AdminClient = SupabaseClient<Database>

export async function getOrCreateClientCase(
  supabase: AdminClient,
  memberId:  string,
  opts?: { primaryConcern?: string },
): Promise<string> {
  const { data: existing, error: fetchErr } = await supabase
    .from('client_cases')
    .select('id')
    .eq('client_id', memberId)
    .in('status', OPEN_CASE_STATUSES as unknown as string[])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (fetchErr) throw fetchErr
  if (existing) return existing.id

  const { data: created, error: insertErr } = await supabase
    .from('client_cases')
    .insert({
      client_id:       memberId,
      status:          'active',
      primary_concern: opts?.primaryConcern ?? null,
    })
    .select('id')
    .single()

  if (insertErr) throw insertErr
  return created.id
}
