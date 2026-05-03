import { redirect } from 'next/navigation'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'
import SidebarNav from '@/app/components/SidebarNav'

// This layout wraps all protected routes (dashboard, practitioners, etc.)
// It is NOT applied to /login — that route sits outside this group.
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Middleware already redirects unauthenticated requests to /login,
  // but we double-check here as a server-side safety net.
  if (!user) redirect('/login')

  // TODO(hardening): Add rate limiting on this layout (or middleware) to prevent
  // brute-force enumeration of admin routes. Recommend: Upstash Ratelimit with
  // a sliding window of 60 requests per minute per IP.

  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('https://natural-intelligence.uk')

  return (
    <div className="flex min-h-screen bg-surface-base">
      <SidebarNav />
      <main className="flex-1 overflow-auto bg-surface-base">
        {children}
      </main>
    </div>
  )
}
