'use server'

// Sprint 3 — practitioner agreement acceptance (post-approval gate).
// Review amendment 4: SERVER-VERIFIED. Client input is never authority — the
// server identifies the practitioner, reads their category from the DB,
// fetches the CURRENT agreement for that category, and records acceptance of
// that agreement only, with the version and a hash of the exact text taken
// from the DB row. A submitted agreement_id (what the page displayed) is
// cross-checked and mismatches are rejected.
import { createHash } from 'node:crypto'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@natural-intelligence/db'
import {
  acceptAgreement, getCurrentAgreement, isPractitionerCategory,
} from '@natural-intelligence/db/practitioners'

export async function acceptCurrentAgreement(formData: FormData): Promise<void> {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  // 1. Practitioner category — from the DB, never the form.
  // eslint-disable-next-line
  const loose = supabase as any
  const { data: prac } = await loose
    .from('practitioners').select('category').eq('id', user.id).maybeSingle()
  if (!prac?.category || !isPractitionerCategory(prac.category)) {
    throw new Error('No practitioner category is set on your account. Contact the NI team.')
  }

  // 2. Current agreement for that category — from the DB.
  const current = await getCurrentAgreement(supabase, prac.category)
  if (!current) {
    throw new Error('No current agreement is published for your category. Contact the NI team.')
  }

  // 3. Cross-check: the agreement the page DISPLAYED must be the one being
  //    accepted. A mismatch (stale page after a version change) is rejected.
  const displayedId = String(formData.get('agreement_id') ?? '')
  if (displayedId && displayedId !== current.id) {
    throw new Error('The agreement has been updated since you opened this page. Please reload and review the current version.')
  }

  // 4. Record acceptance of the DB-resolved agreement, version and text hash.
  const acceptedTextHash = createHash('sha256').update(current.body, 'utf8').digest('hex')
  await acceptAgreement(supabase, {
    practitionerId: user.id,
    agreementId: current.id,
    agreementVersion: current.version,
    acceptedTextHash,
  })
  redirect('/cases')
}
