import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@natural-intelligence/db'
import { adminLogin } from '@/app/actions/auth'

interface AdminLoginPageProps {
  searchParams: { error?: string }
}

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  // If already authenticated, skip login — middleware won't do this since
  // /login is excluded from the matcher to prevent redirect loops.
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')
  return (
    <main className="min-h-screen flex items-center justify-center bg-sidebar-bg px-4">
      <div className="w-full max-w-sm">
        {/* Brand header */}
        <div className="mb-8">
          <p className="text-xs font-medium tracking-widest uppercase text-sidebar-textMuted mb-2">
            Natural Intelligence
          </p>
          <h1 className="text-2xl font-semibold text-sidebar-text">Admin portal</h1>
        </div>

        {/* Error banner */}
        {searchParams.error && (
          <div className="mb-5 rounded-lg bg-status-errorBg border border-status-errorBorder px-4 py-3 text-sm text-status-errorText">
            {searchParams.error}
          </div>
        )}

        {/* Login card */}
        <div className="bg-surface-dark border border-sidebar-border rounded-xl p-6">
          <form action={adminLogin} className="space-y-4">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-sidebar-text mb-1.5">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="admin@natural-intelligence.uk"
                className="w-full px-3 py-2.5 rounded-lg border border-sidebar-border bg-sidebar-bg text-sidebar-text placeholder:text-sidebar-textMuted text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-brand-default transition-colors"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-sidebar-text mb-1.5">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="w-full px-3 py-2.5 rounded-lg border border-sidebar-border bg-sidebar-bg text-sidebar-text placeholder:text-sidebar-textMuted text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-brand-default transition-colors"
              />
            </div>

            <button
              type="submit"
              className="w-full px-4 py-2.5 rounded-lg bg-brand-default hover:bg-brand-hover text-text-inverted text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-default focus:ring-offset-2 focus:ring-offset-sidebar-bg"
            >
              Sign in
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
