'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { copy } from '@/lib/copy'
import { logout } from '@/app/actions/auth'

interface NavMobileProps {
  isLoggedIn: boolean
}

export function NavMobile({ isLoggedIn }: NavMobileProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(!open)}
        aria-label={open ? copy.nav.close : copy.nav.menu}
        className="p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-muted transition-colors"
      >
        {open ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 bg-surface-raised border-b border-border-default shadow-md z-nav">
          <div className="px-4 pt-4 pb-2">
            <Image
              src="/images/NI_logo_thumb_transparent.png"
              alt="Natural Intelligence"
              width={32}
              height={32}
              className="h-8 w-auto"
            />
          </div>
          <nav className="flex flex-col px-4 py-2 gap-1">
            <Link href="/directory" onClick={() => setOpen(false)} className="px-3 py-2.5 rounded-lg text-sm font-medium text-text-primary hover:bg-surface-muted transition-colors">
              {copy.nav.directory}
            </Link>
            <Link href="/workshops" onClick={() => setOpen(false)} className="px-3 py-2.5 rounded-lg text-sm font-medium text-text-primary hover:bg-surface-muted transition-colors">
              {copy.nav.workshops}
            </Link>
            <Link href="/resources" onClick={() => setOpen(false)} className="px-3 py-2.5 rounded-lg text-sm font-medium text-text-primary hover:bg-surface-muted transition-colors">
              {copy.nav.resources}
            </Link>
            <Link href="/apply" onClick={() => setOpen(false)} className="px-3 py-2.5 rounded-lg text-sm font-medium text-text-primary hover:bg-surface-muted transition-colors">
              {copy.nav.apply}
            </Link>
            <div className="border-t border-border-muted my-2" />
            {isLoggedIn ? (
              <>
                <Link href="/dashboard" onClick={() => setOpen(false)} className="px-3 py-2.5 rounded-lg text-sm font-medium text-text-primary hover:bg-surface-muted transition-colors">
                  {copy.nav.dashboard}
                </Link>
                <form action={logout}>
                  <button type="submit" className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:bg-surface-muted transition-colors">
                    {copy.nav.logout}
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link href="/auth/login" onClick={() => setOpen(false)} className="px-3 py-2.5 rounded-lg text-sm font-medium text-text-primary hover:bg-surface-muted transition-colors">
                  {copy.nav.login}
                </Link>
                <Link href="/auth/signup" onClick={() => setOpen(false)} className="px-3 py-2.5 rounded-lg text-sm font-medium text-text-inverted bg-brand-default hover:bg-brand-hover transition-colors">
                  {copy.nav.signup}
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </div>
  )
}
