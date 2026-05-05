// ─── packages/db/src/crt/getPractitionerTrace.ts ─────────────────────────────
// Fetches all trace entries visible to practitioners for a given case.
// Includes internal + practitioner + client visibility.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database }       from '../types'

type AdminClient = SupabaseClient<Database>

export interface PractitionerTraceEntry {
  id:               string
  agent_name:       string
  entry_type:       string
  system_area:      string | null
  hypothesis_key:   string | null
  content:          string
  evidence_payload: Record<string, unknown>
  confidence:       number | null
  priority:         number | null
  visibility:       string
  created_at:       string
}

export interface PractitionerTrace {
  id:           string
  trace_type:   string
  status:       string
  summary:      string | null
  generated_by: string
  created_at:   string
  entries:      PractitionerTraceEntry[]
}

export async function getPractitionerTrace(
  supabase: AdminClient,
  caseId:   string,
): Promise<PractitionerTrace | null> {
  const { data: trace, error: traceErr } = await supabase
    .from('reasoning_traces')
    .select('id, trace_type, status, summary, generated_by, created_at')
    .eq('case_id', caseId)
    .eq('trace_type', 'intake_analysis')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (traceErr) throw traceErr
  if (!trace)   return null

  const { data: entries, error: entriesErr } = await supabase
    .from('reasoning_trace_entries')
    .select('id, agent_name, entry_type, system_area, hypothesis_key, content, evidence_payload, confidence, priority, visibility, created_at')
    .eq('trace_id', trace.id)
    .order('created_at', { ascending: true })

  if (entriesErr) throw entriesErr

  return {
    ...trace,
    entries: (entries ?? []).map(e => ({
      ...e,
      evidence_payload: (e.evidence_payload ?? {}) as Record<string, unknown>,
    })),
  }
}
