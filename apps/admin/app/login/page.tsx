import { adminLogin } from '@/app/actions/auth'

interface AdminLoginPageProps {
  searchParams: { error?: string }
}

export default function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-surface-inverse px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-text-inverted mb-2">Admin Portal</h1>
        <p className="text-sm text-text-on-inverse mb-8">Natural Intelligence</p>

        {searchParams.error && (
          <div className="mb-4 rounded-lg bg-status-errorBg border border-status-errorBorder px-4 py-3 text-sm text-status-errorText">
            {searchParams.error}
          </div>
        )}

        <form action={adminLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-text-on-inverse mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-lg border border-border-inverse bg-surface-inverse-raised px-3 py-2 text-sm text-text-inverted placeholder:text-text-on-inverse focus:border-brand-default focus:outline-none focus:ring-2 focus:ring-brand-default transition-colors"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-text-on-inverse mb-1">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-border-inverse bg-surface-inverse-raised px-3 py-2 text-sm text-text-inverted placeholder:text-text-on-inverse focus:border-brand-default focus:outline-none focus:ring-2 focus:ring-brand-default transition-colors"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-brand-default px-4 py-2.5 text-sm font-medium text-text-inverted hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-brand-default focus:ring-offset-2 focus:ring-offset-surface-inverse transition-colors"
          >
            Sign in
          </button>
        </form>
      </div>
    </main>
  )
}
