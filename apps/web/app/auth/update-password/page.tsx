'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@natural-intelligence/db/client'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [error, setError]       = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd       = new FormData(e.currentTarget)
    const password = fd.get('password') as string
    const confirm  = fd.get('confirm') as string

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    startTransition(async () => {
      const supabase = createClient()
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) {
        setError(err.message)
      } else {
        router.push('/dashboard')
      }
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-text-primary mb-1">Set a new password</h1>
          <p className="text-sm text-text-secondary">
            Choose a strong password for your account.
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-status-errorBorder bg-status-errorBg px-4 py-3 text-sm text-status-errorText">
            {error}
          </div>
        )}

        <div className="bg-surface-raised border border-border-default rounded-xl p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-text-primary mb-1.5">
                New password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full px-3 py-2.5 rounded-lg border border-border-default bg-surface-base text-text-primary placeholder:text-text-placeholder text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent transition-colors"
              />
            </div>

            <div>
              <label htmlFor="confirm" className="block text-sm font-medium text-text-primary mb-1.5">
                Confirm new password
              </label>
              <input
                id="confirm"
                name="confirm"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full px-3 py-2.5 rounded-lg border border-border-default bg-surface-base text-text-primary placeholder:text-text-placeholder text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full px-5 py-2.5 rounded-lg bg-brand-default hover:bg-brand-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isPending ? 'Updating…' : 'Update password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
