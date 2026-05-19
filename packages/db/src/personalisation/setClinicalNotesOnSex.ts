// PS.1 helper — invokes the set_clinical_notes_on_sex RPC.
//
// The RPC enforces both Layer 1 (auth.uid not null) and Layer 2 (caller must
// be a practitioner with case_practitioner_work linking them to the client).
// This helper is the typed entry point; it throws on RPC error.

import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'

export async function setClinicalNotesOnSex(
  client:  ReturnType<typeof createClient<Database>>,
  userId:  string,
  notes:   string,
): Promise<void> {
  const { error } = await client.rpc('set_clinical_notes_on_sex' as never, {
    p_user_id: userId,
    p_notes:   notes,
  } as never)

  if (error) {
    throw new Error(`setClinicalNotesOnSex failed [${error.code}]: ${error.message}`)
  }
}
