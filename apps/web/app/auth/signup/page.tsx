import Link from 'next/link'
import { copy } from '@/lib/copy'
import { signupWithConsent } from '@/app/actions/auth-signup'

interface SignupPageProps {
  searchParams: { error?: string }
}

export default function SignupPage({ searchParams }: SignupPageProps) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-text-primary mb-1">{copy.auth.signup.heading}</h1>
          <p className="text-sm text-text-secondary">{copy.auth.signup.subheading}</p>
        </div>

        {searchParams.error && (
          <div className="mb-5 rounded-lg border border-status-errorBorder bg-status-errorBg px-4 py-3 text-sm text-status-errorText">
            {searchParams.error}
          </div>
        )}

        <div className="bg-surface-raised border border-border-default rounded-xl p-6 shadow-sm">
          <form action={signupWithConsent} className="space-y-4">
            <div>
              <label htmlFor="full_name" className="block text-sm font-medium text-text-primary mb-1.5">
                {copy.auth.signup.fullName}
              </label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                required
                autoComplete="name"
                className="w-full px-3 py-2.5 rounded-lg border border-border-default bg-surface-base text-text-primary placeholder:text-text-placeholder text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent transition-colors"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-text-primary mb-1.5">
                {copy.auth.signup.email}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="w-full px-3 py-2.5 rounded-lg border border-border-default bg-surface-base text-text-primary placeholder:text-text-placeholder text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent transition-colors"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-text-primary mb-1.5">
                {copy.auth.signup.password}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="new-password"
                minLength={8}
                className="w-full px-3 py-2.5 rounded-lg border border-border-default bg-surface-base text-text-primary placeholder:text-text-placeholder text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent transition-colors"
              />
              <p className="text-xs text-text-muted mt-1">{copy.auth.signup.passwordHint}</p>
            </div>

            <div className="space-y-3 pt-1">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="consent_terms"
                  value="1"
                  required
                  className="mt-0.5 w-4 h-4 rounded border-border-default text-brand-default focus:ring-brand-default"
                />
                <span className="text-sm text-text-secondary leading-relaxed">
                  {copy.auth.signup.consentTerms}
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="consent_data"
                  value="1"
                  required
                  className="mt-0.5 w-4 h-4 rounded border-border-default text-brand-default focus:ring-brand-default"
                />
                <span className="text-sm text-text-secondary leading-relaxed">
                  {copy.auth.signup.consentData}
                </span>
              </label>
            </div>

            <button
              type="submit"
              className="w-full px-5 py-2.5 rounded-lg bg-brand-default hover:bg-brand-hover text-white text-sm font-medium transition-colors"
            >
              {copy.auth.signup.submit}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-text-secondary">
          {copy.auth.signup.hasAccount}{' '}
          <Link href="/auth/login" className="font-medium text-text-brand hover:underline">
            {copy.auth.signup.login}
          </Link>
        </p>
      </div>
    </div>
  )
}
