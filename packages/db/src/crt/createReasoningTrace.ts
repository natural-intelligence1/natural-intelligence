// ─── packages/db/src/crt/createReasoningTrace.ts ─────────────────────────────
// Creates a reasoning_trace and bulk-inserts its entries in one transaction.
// Returns the trace id.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database }       from '../types'
import type { TraceType, TraceEntry, GeneratedBy } from './types'

type AdminClient = SupabaseClient<Database>

export async function createReasoningTrace(
  supabase: AdminClient,
  opts: {
    caseId:      string
    traceType:   TraceType
    generatedBy: GeneratedBy
    summary?:    string
    entries:     TraceEntry[]
  },
): Promise<string> {
  const { data: trace, error: traceErr } = await supabase
    .from('reasoning_traces')
    .insert({
      case_id:      opts.caseId,
      trace_type:   opts.traceType,
      generated_by: opts.generatedBy,
      summary:      opts.summary ?? null,
      status:       'client_visible',
    })
    .select('id')
    .single()

  if (traceErr) throw traceErr

  if (opts.entries.length > 0) {
    const rows = opts.entries.map(e => ({
      trace_id:         trace.id,
      case_id:          opts.caseId,
      agent_name:       e.agent_name,
      entry_type:       e.entry_type,
      content:          e.content,
      system_area:      e.system_area      ?? null,
      hypothesis_key:   e.hypothesis_key   ?? null,
      evidence_payload: e.evidence_payload ?? {},
      confidence:       e.confidence       ?? null,
      priority:         e.priority         ?? null,
      visibility:       e.visibility,
    }))

    const { error: entriesErr } = await supabase
      .from('reasoning_trace_entries')
      .insert(rows)

    if (entriesErr) throw entriesErr
  }

  return trace.id
}
