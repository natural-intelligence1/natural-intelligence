// ─── packages/db/src/crt/getOrCreateClientCase.ts ────────────────────────────
// Returns the active client_case for a member, creating one if it doesn't exist.
// Idempotent — safe to call on every intake completion.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types'

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
    .eq('status', 'active')
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
