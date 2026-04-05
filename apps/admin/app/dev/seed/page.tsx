import { redirect, notFound } from 'next/navigation'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'
import { copy } from '@/lib/copy'
import SeedClient from './SeedClient'

export default async function SeedPage() {
  // Hard block in production — this route must never be reachable in a live build
  if (process.env.NODE_ENV === 'production') notFound()

  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('profiles').select('role').eq('id', user.id).single()

  if (profile?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-base">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-text-primary">403</h1>
          <p className="text-text-secondary mt-2">{copy.shared.accessDenied}</p>
        </div>
      </div>
    )
  }

  const c = copy.dev

  return (
    <div>
      <div className="px-8 py-6 border-b border-border-default bg-surface-raised">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-semibold text-text-primary">{c.heading}</h1>
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-status-warningBg text-status-warningText border border-status-warningBorder">
            Internal only
          </span>
        </div>
        <p className="text-sm text-text-secondary">{c.subheading}</p>
      </div>

      <div className="px-8 py-6 max-w-3xl">
        <SeedClient />
      </div>
    </div>
  )
}
