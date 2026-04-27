'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { createClient } from '@natural-intelligence/db/client'

export default function ForgotPasswordPage() {
  const [sent, setSent]         = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const email = (new FormData(e.currentTarget).get('email') as string).trim().toLowerCase()
    if (!email) return

    startTransition(async () => {
      const supabase = createClient()
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://natural-intelligence.uk'}/auth/update-password`,
      })
      if (err) {
        setError(err.message)
      } else {
        setSent(true)
      }
    })
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-16 bg-surface-base">
        <div className="w-full max-w-sm text-center">
          <p className="text-sm font-semibold text-text-primary mb-8">
            Natural<span className="text-text-brand"> Intelligence</span>
          </p>
          <div className="rounded-2xl border border-border-default bg-surface-raised p-8 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-brand-light flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-text-primary mb-2">Check your email</h1>
            <p className="text-sm text-text-secondary leading-relaxed">
              We&apos;ve sent a password reset link to your email address. It may take a minute to arrive.
            </p>
          </div>
          <p className="mt-6 text-sm text-text-secondary">
            <Link href="/auth/login" className="font-medium text-text-brand hover:underline">
              Back to login
            </Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16 bg-surface-base">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="text-sm font-semibold text-text-primary mb-1">
            Natural<span className="text-text-brand"> Intelligence</span>
          </p>
          <h1 className="text-2xl font-bold text-text-primary mb-1">Reset your password</h1>
          <p className="text-sm text-text-secondary">
            Enter your email address and we&apos;ll send you a reset link.
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-status-errorBorder bg-status-errorBg px-4 py-3 text-sm text-status-errorText">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-text-primary mb-1.5">
              Email address
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

          <button
            type="submit"
            disabled={isPending}
            className="w-full px-5 py-2.5 rounded-lg bg-brand-default hover:bg-brand-hover text-text-inverted text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isPending ? 'Sending…' : 'Send reset link'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-text-secondary">
          Remember your password?{' '}
          <Link href="/auth/login" className="font-medium text-text-brand hover:underline">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  )
}
