// ─── packages/db/src/crt/getPractitionerTrace.ts ─────────────────────────────
// Fetches all trace entries visible to practitioners for a given case.
// Includes internal + practitioner + client visibility.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database }       from '../types'
import type { AgentName, EntryType, Visibility, TraceType, TraceStatus, GeneratedBy } from './types'

type AdminClient = SupabaseClient<Database>

export interface PractitionerTraceEntry {
  id:               string
  agent_name:       AgentName
  entry_type:       EntryType
  system_area:      string | null
  hypothesis_key:   string | null
  content:          string
  evidence_payload: Record<string, unknown>
  confidence:       number | null
  priority:         number | null
  visibility:       Visibility
  created_at:       string
}

export interface PractitionerTrace {
  id:           string
  trace_type:   TraceType
  status:       TraceStatus
  summary:      string | null
  generated_by: GeneratedBy
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
    trace_type:   trace.trace_type   as TraceType,
    status:       trace.status       as TraceStatus,
    generated_by: trace.generated_by as GeneratedBy,
    entries: (entries ?? []).map(e => ({
      ...e,
      agent_name:       e.agent_name   as AgentName,
      entry_type:       e.entry_type   as EntryType,
      visibility:       e.visibility   as Visibility,
      evidence_payload: (e.evidence_payload ?? {}) as Record<string, unknown>,
    })),
  }
}
