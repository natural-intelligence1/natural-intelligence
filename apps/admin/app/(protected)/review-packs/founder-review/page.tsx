import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'
import { listFounderReviewCases } from '@natural-intelligence/db/crt'
import { FounderReviewPickerView } from './view'

export const metadata: Metadata = { title: 'Founder Review' }
export const dynamic = 'force-dynamic'

// ─── Founder Review Mode — case picker ───────────────────────────────────────
// TEST CASES ONLY. listFounderReviewCases filters profiles on is_test_data and
// then restricts the case query to those clients, so a real member cannot
// appear here. There is deliberately no search and no filter control — the
// restriction is the feature, not a default someone can widen from the UI.
//
// Read only: no server action, no form, no mutation verb.

export default async function FounderReviewIndexPage() {
  // Defence-in-depth admin guard (convention: layout + per-page).
  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('https://natural-intelligence.uk')

  const rows = await listFounderReviewCases(admin)

  return <FounderReviewPickerView rows={rows} />
}
