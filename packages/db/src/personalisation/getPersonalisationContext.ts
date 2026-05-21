// PS.3 helper — read the authenticated user's own personalisation row for
// dashboard rendering context.
//
// Uses the authenticated SSR client; reads the user's own row through the
// up_member_select RLS policy (no admin client). Returns a small typed
// context that the PersonalisationProvider exposes to the dashboard subtree.
//
// Column scope (architectural contract — Future-Sensitive Columns Rule):
//   • Includes:  biological_sex, religion, religious_content_preference
//   • EXCLUDES:  clinical_notes_on_sex (practitioner-only annotation; must
//                never enter client-side personalisation context)
//   • EXCLUDES:  created_at / updated_at (not needed for rendering)
//
// Defensive defaults when the row is somehow missing (the PS.1 handle_new_user
// extension makes this near-impossible for new users, and PS.1 backfilled
// existing profiles; this branch protects against unforeseen edge cases):
//   biologicalSex:              null
//   religion:                  'prefer_not_to_say'
//   religiousContentPreference:'hide'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import type { BiologicalSex, Religion, ReligiousContentPreference } from './types'

export interface PersonalisationContext {
  biologicalSex:              BiologicalSex | null
  religion:                   Religion
  religiousContentPreference: ReligiousContentPreference
  // NOTE: clinical_notes_on_sex is intentionally absent. Adding it here
  // would violate the Future-Sensitive Columns Rule (practitioner-only data
  // must not enter client-side context). Do not add without explicit review.
}

export const DEFAULT_PERSONALISATION_CONTEXT: PersonalisationContext = {
  biologicalSex:              null,
  religion:                   'prefer_not_to_say',
  religiousContentPreference: 'hide',
}

export async function getPersonalisationContext(
  client: ReturnType<typeof createClient<Database>>,
  userId: string,
): Promise<PersonalisationContext> {
  // The table isn't in the generated Database types yet (same pattern as the
  // F2 view); cast through a loose-typed client to name it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loose = (client as unknown as SupabaseClient<any>)

  const { data, error } = await loose
    .from('user_personalisation')
    .select('biological_sex, religion, religious_content_preference')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    // Soft-fail to safe defaults rather than throwing — the dashboard layout
    // must always render. The error is logged for ops visibility but doesn't
    // crash the user's session.
    console.error('getPersonalisationContext failed:', error.code, error.message)
    return DEFAULT_PERSONALISATION_CONTEXT
  }

  if (!data) return DEFAULT_PERSONALISATION_CONTEXT

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

// Islamic content gating rule (per addendum §3, Part 3):
//   Islamic content renders iff religion='muslim' AND religiousContentPreference='show'.
//   The substrate is wired in PS.3; actual content authoring is a later phase.
export function isIslamicContentEnabled(ctx: PersonalisationContext): boolean {
  return ctx.religion === 'muslim' && ctx.religiousContentPreference === 'show'
}
