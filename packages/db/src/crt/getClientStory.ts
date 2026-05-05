// ─── packages/db/src/crt/getClientStory.ts ───────────────────────────────────
// Reads the client-visible reasoning trace for a member and returns the two
// client_explanation entries that power My Body's Story and Your Future Self.
// Returns null if no client_visible trace exists yet.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database }       from '../types'
import type { ClientStory }    from './types'

type AdminClient = SupabaseClient<Database>

export async function getClientStory(
  supabase:  AdminClient,
  memberId:  string,
): Promise<ClientStory | null> {
  // Find the most recent client_visible intake_analysis trace for this member
  const { data: trace, error: traceErr } = await supabase
    .from('reasoning_traces')
    .select('id, summary, created_at, client_cases!inner(client_id)')
    .eq('client_cases.client_id', memberId)
    .eq('status', 'client_visible')
    .eq('trace_type', 'intake_analysis')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (traceErr) throw traceErr
  if (!trace)   return null

  // Fetch client_explanation entries
  const { data: entries, error: entriesErr } = await supabase
    .from('reasoning_trace_entries')
    .select('system_area, content')
    .eq('trace_id', trace.id)
    .eq('entry_type', 'client_explanation')
    .eq('visibility', 'client')

  if (entriesErr) throw entriesErr

  const bodyStoryEntry  = entries?.find(e => e.system_area === 'body_story')
  const futureSelfEntry = entries?.find(e => e.system_area === 'future_self')
  const systemsEntry    = entries?.find(e => e.system_area === 'systems_involved')

  if (!bodyStoryEntry && !futureSelfEntry) return null

  return {
    body_story:   bodyStoryEntry?.content   ?? '',
    future_self:  futureSelfEntry?.content  ?? '',
    systems:      systemsEntry ? JSON.parse(systemsEntry.content) : [],
    generated_at: (trace as unknown as { created_at: string }).created_at,
  }
}
