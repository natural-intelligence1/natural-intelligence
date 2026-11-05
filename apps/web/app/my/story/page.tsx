// ─── YOUR HEALTH STORY (preview) ─────────────────────────────────────────────
// The client intake, inside the client's own shell.
//
// AUTH, AND DELIBERATELY NOT THE COLLECTION KILL-SWITCH
//
// A session is required, the same as every other /my route. What this route
// does NOT do is check INTAKE_COLLECTION_ENABLED — because it collects
// nothing. There is no server action, no Supabase write and no intake session
// here; answers are held in the viewer's own browser (lib/my/storyDraft.ts).
//
// That is the point. The kill-switch exists so identifiable health data is
// not collected while the intake is unapproved, and this route honours it by
// not being a collection path at all rather than by asking permission to be
// one. The live intake at /dashboard/intake and /dashboard/intake-v2 keeps its
// guards exactly as they are; nothing here touches them.
//
// noindex because it is a preview surface, not a product page.

import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@natural-intelligence/db'
import { CalmStory } from './CalmStory'

export const metadata: Metadata = {
  title: 'Your health story — Natural Intelligence',
  robots: { index: false, follow: false },
}

export default async function MyStoryPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  return <CalmStory />
}
