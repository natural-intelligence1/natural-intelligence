// ─── Client shell ────────────────────────────────────────────────────────────
// Today · My Plan · My Health · My Team.
//
// Four destinations describing what a person HAS, rather than the thirteen
// features NI has built. The existing /dashboard routes stay exactly as they
// are and become content underneath these, so nothing live is disturbed while
// the shape is reviewed.
//
// Auth reuses the same pattern as the dashboard: a session is required, and
// the redirect target is the existing login route.

import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@natural-intelligence/db'
import { MyNav } from './MyNav'

export const metadata: Metadata = { title: 'Your care — Natural Intelligence' }

export default async function MyLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  return (
    <div className="py-10 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      <MyNav />
      {children}
      <p className="text-xs text-text-muted mt-12 pt-5 border-t border-border-muted leading-relaxed">
        Fictional example for review. No real health information appears here.
      </p>
    </div>
  )
}
