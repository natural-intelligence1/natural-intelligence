'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const STORAGE_KEY = 'ni_cookie_consent'

export function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) setVisible(true)
    } catch {
      // localStorage unavailable — don't show banner
    }
  }, [])

  function accept() {
    try { localStorage.setItem(STORAGE_KEY, 'accepted') } catch {}
    setVisible(false)
  }

  function decline() {
    try { localStorage.setItem(STORAGE_KEY, 'declined') } catch {}
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-50 bg-surface-raised border-t border-border-default shadow-lg"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p className="text-sm text-text-secondary flex-1 leading-relaxed">
          We use essential cookies to keep the platform running. We do not use advertising or
          tracking cookies.{' '}
          <Link href="/legal/cookies" className="text-text-brand hover:underline font-medium">
            Cookie policy
          </Link>
        </p>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={decline}
            className="px-4 py-2 rounded-lg border border-border-default text-text-secondary text-sm font-medium hover:bg-surface-muted transition-colors"
          >
            Decline optional
          </button>
          <button
            onClick={accept}
            className="px-4 py-2 rounded-lg bg-brand-default text-text-inverted text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}
