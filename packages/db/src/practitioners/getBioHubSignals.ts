// ─── packages/db/src/practitioners/getBioHubSignals.ts ───────────────────────
// Returns biomarker results for the BioHub Signals panel.
//
// Uses admin client — intake/biohub tables have no practitioner RLS policy.
// Temporary: Option A migration required before Phase C (see Phase B Addendum Q6).
//
// Returns raw marker values + reference ranges. No interpretation — practitioners
// apply clinical judgement. Empty array if no lab data uploaded for this member.

import { createClient } from '@supabase/supabase-js'
import type { Database }     from '../types'
import type { BioHubSignal } from './types'

export async function getBioHubSignals(
  adminClient: ReturnType<typeof createClient<Database>>,
  memberId:    string,
): Promise<BioHubSignal[]> {
  const { data, error } = await adminClient
    .from('biomarker_results')
    .select(`
      id,
      marker_name,
      marker_key,
      value,
      unit,
      functional_zone,
      gp_range_low,
      gp_range_high,
      ni_optimal_low,
      ni_optimal_high,
      lab_reports ( report_date )
    `)
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`getBioHubSignals failed [${error.code}]: ${error.message}`)
  }

  return (data ?? []).map(row => {
    const report = row.lab_reports as { report_date: string | null } | null
    return {
      id:             row.id,
      markerName:     row.marker_name,
      markerKey:      row.marker_key,
      value:          row.value,
      unit:           row.unit,
      reportDate:     report?.report_date ?? null,
      functionalZone: row.functional_zone,
      gpRangeLow:     row.gp_range_low,
      gpRangeHigh:    row.gp_range_high,
      niOptimalLow:   row.ni_optimal_low,
      niOptimalHigh:  row.ni_optimal_high,
    }
  })
}
