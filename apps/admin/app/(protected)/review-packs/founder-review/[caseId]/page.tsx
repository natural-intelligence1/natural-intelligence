import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'
import { getFounderReviewCase } from '@natural-intelligence/db/crt'
import { FounderReviewView, FounderReviewRefusedView } from '../view'

export const metadata: Metadata = { title: 'Founder Review' }
export const dynamic = 'force-dynamic'

// ─── Founder Review Mode — the route ─────────────────────────────────────────
// Stage 2 of the one-case walkthrough. The Founder sees the real synthetic
// walkthrough case as a practitioner eventually will, without being granted
// any clinical authority.
//
// Three lines of work and nothing else: check the admin role, read the
// canonical case, hand it to the view. The test-data restriction lives in
// getFounderReviewCase, not here, so it cannot be skipped by a second caller
// — and a refusal is rendered, never silently turned into an empty page.
//
// No server action, no form, no mutation verb, no fixture. Asserted by
// packages/db/src/crt/founderReviewBoundary.test.ts.

export default async function FounderReviewCasePage({ params }: { params: { caseId: string } }) {
  // Defence-in-depth admin guard (convention: layout + per-page).
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('https://natural-intelligence.uk')

  const result = await getFounderReviewCase(admin, params.caseId)

  if (!result.ok) {
    return <FounderReviewRefusedView caseId={params.caseId} refusal={result.refusal} />
  }

  return <FounderReviewView data={result.data} />
}
