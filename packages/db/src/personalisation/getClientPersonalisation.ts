// PS.2 helper — read the practitioner-facing view of a client's personalisation.
//
// Uses an authenticated SSR client; access is enforced by the view's WHERE
// clause (practitioner must hold case_practitioner_work for the client, or
// is_admin()). Returns null when the view yields zero rows (unassigned
// practitioner) — callers render an empty-state.
//
// Column scope: ONLY biological_sex + clinical_notes_on_sex + updated_at.
// religion and religious_content_preference are NOT in the view by design
// (PS architectural contract: future-sensitive columns are opt-in per surface).

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import type { BiologicalSex } from './types'

export interface ClientPersonalisation {
  biologicalSex:      BiologicalSex | null
  clinicalNotesOnSex: string | null
  updatedAt:          string | null
}

export async function getClientPersonalisation(
  client:   ReturnType<typeof createClient<Database>>,
  memberId: string,
): Promise<ClientPersonalisation | null> {
  // The view is not in the generated Database types yet (see F2 pattern); cast
  // through a loose-typed client so we can name it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loose = (client as unknown as SupabaseClient<any>)

  const { data, error } = await loose
    .from('practitioner_client_personalisation')
    .select('biological_sex, clinical_notes_on_sex, updated_at')
    .eq('user_id', memberId)
    .maybeSingle()

  if (error) {
    throw new Error(`getClientPersonalisation failed [${error.code}]: ${error.message}`)
  }

  if (!data) return null

  const row = data as {
    biological_sex:        BiologicalSex | null
    clinical_notes_on_sex: string | null
    updated_at:            string | null
  }

  return {
    biologicalSex:      row.biological_sex,
    clinicalNotesOnSex: row.clinical_notes_on_sex,
    updatedAt:          row.updated_at,
  }
}
