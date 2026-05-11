// ─── packages/db/src/practitioners/getCaseEvents.ts ──────────────────────────
// Returns case events ordered chronologically for the Case History panel.
// Uses authenticated client — case_events_practitioner_select RLS enforces access.

import { createClient } from '@supabase/supabase-js'
import type { Database }  from '../types'
import type { CaseEvent } from './types'

export async function getCaseEvents(
  client: ReturnType<typeof createClient<Database>>,
  caseId: string,
): Promise<CaseEvent[]> {
  const { data, error } = await client
    .from('case_events')
    .select('id, event_type, event_payload, created_at, source_id, source_table')
    .eq('case_id', caseId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`getCaseEvents failed [${error.code}]: ${error.message}`)
  }

  return (data ?? []).map(row => ({
    id:           row.id,
    eventType:    row.event_type,
    eventPayload: (row.event_payload ?? {}) as Record<string, unknown>,
    createdAt:    row.created_at,
    sourceId:     row.source_id,
    sourceTable:  row.source_table,
  }))
}
