import Link from 'next/link'
import { copy } from '@/lib/copy'
import { login } from '@/app/actions/auth'

interface LoginPageProps {
  searchParams: { error?: string; message?: string; redirectTo?: string }
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-text-primary mb-1">{copy.auth.login.heading}</h1>
          <p className="text-sm text-text-secondary">{copy.auth.login.subheading}</p>
        </div>

        {searchParams.error && (
          <div className="mb-5 rounded-lg border border-status-errorBorder bg-status-errorBg px-4 py-3 text-sm text-status-errorText">
            {searchParams.error}
          </div>
        )}
        {searchParams.message && (
          <div className="mb-5 rounded-lg border border-status-successBorder bg-status-successBg px-4 py-3 text-sm text-status-successText">
            {searchParams.message}
          </div>
        )}

        <form action={login} className="space-y-4">
          {searchParams.redirectTo && (
            <input type="hidden" name="redirectTo" value={searchParams.redirectTo} />
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-text-primary mb-1.5">
              {copy.auth.login.email}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full px-3 py-2.5 rounded-lg border border-border-default bg-surface-raised text-text-primary placeholder:text-text-placeholder text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent transition-colors"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-text-primary">
                {copy.auth.login.password}
              </label>
              <Link href="/auth/forgot-password" className="text-xs text-text-muted hover:text-text-brand hover:underline transition-colors">
                {copy.auth.login.forgot}
              </Link>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full px-3 py-2.5 rounded-lg border border-border-default bg-surface-raised text-text-primary placeholder:text-text-placeholder text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent transition-colors"
            />
          </div>

          <button
            type="submit"
            className="w-full px-5 py-2.5 rounded-lg bg-brand-default hover:bg-brand-hover text-white text-sm font-medium transition-colors"
          >
            {copy.auth.login.submit}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-text-secondary">
          {copy.auth.login.noAccount}{' '}
          <Link href="/auth/signup" className="font-medium text-text-brand hover:underline">
            {copy.auth.login.signup}
          </Link>
        </p>
      </div>
    </div>
  )
}
