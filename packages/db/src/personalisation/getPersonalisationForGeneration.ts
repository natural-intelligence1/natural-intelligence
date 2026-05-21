// PS.4 helper — fetch personalisation for AI generation paths.
//
// Distinct from getPersonalisationContext (PS.3, dashboard provider):
//   • Runs admin-client side (Q6 exception — AI generation uses admin client).
//   • Called server-side in generation actions, not in layout rendering.
//   • Caller may be any session (member, practitioner, system) generating for
//     a memberId that is not the calling user.
//
// Column scope (architectural contract — Future-Sensitive Columns Rule):
//   • Includes:  biological_sex (clinical interpretation)
//   • Includes:  religion (parameterises framing — only when preference is
//                'show' AND religion has a content variant)
//   • Includes:  religious_content_preference (the gate boolean)
//   • EXCLUDES:  clinical_notes_on_sex — practitioner-authored chart
//                annotation; NOT appropriate input to AI generation.
//
// Defensive defaults when the row is somehow missing (PS.1's
// handle_new_user trigger + backfill makes this near-impossible, but we
// soft-fail to a neutral context rather than throwing — AI generation
// must always be able to attempt a result):
//   biologicalSex:              null
//   religion:                  'prefer_not_to_say'
//   religiousContentPreference:'hide'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import type { BiologicalSex, Religion, ReligiousContentPreference } from './types'

export interface PersonalisationForGeneration {
  biologicalSex:              BiologicalSex | null
  religion:                   Religion
  religiousContentPreference: ReligiousContentPreference
  // NOTE: clinical_notes_on_sex is intentionally absent. See module header.
}

export const DEFAULT_PERSONALISATION_FOR_GENERATION: PersonalisationForGeneration = {
  biologicalSex:              null,
  religion:                   'prefer_not_to_say',
  religiousContentPreference: 'hide',
}

export async function getPersonalisationForGeneration(
  adminClient: ReturnType<typeof createClient<Database>>,
  userId:      string,
): Promise<PersonalisationForGeneration> {
  // user_personalisation not in generated types; cast through a loose client.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loose = (adminClient as unknown as SupabaseClient<any>)

  const { data, error } = await loose
    .from('user_personalisation')
    .select('biological_sex, religion, religious_content_preference')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('getPersonalisationForGeneration failed:', error.code, error.message)
    return DEFAULT_PERSONALISATION_FOR_GENERATION
  }

  if (!data) return DEFAULT_PERSONALISATION_FOR_GENERATION

  const row = data as {
    biological_sex:                BiologicalSex | null
    religion:                      Religion | null
    religious_content_preference:  ReligiousContentPreference | null
  }

  return {
    biologicalSex:              row.biological_sex,
    religion:                   row.religion                     ?? 'prefer_not_to_say',
    religiousContentPreference: row.religious_content_preference ?? 'hide',
  }
}
