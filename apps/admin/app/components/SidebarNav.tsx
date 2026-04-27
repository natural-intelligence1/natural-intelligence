'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { copy } from '@/lib/copy'
import { adminLogout } from '@/app/actions/auth'

const navLinks = [
  { href: '/dashboard',     label: copy.nav.dashboard },
  { href: '/applications',  label: copy.nav.applications },
  { href: '/practitioners', label: copy.nav.practitioners },
  { href: '/support',       label: copy.nav.support },
  { href: '/workshops',     label: copy.nav.workshops },
  { href: '/resources',     label: copy.nav.resources },
  { href: '/members',       label: copy.nav.members },
]

// process.env.NODE_ENV is replaced at build time by Next.js — safe in client components
const isDev = process.env.NODE_ENV !== 'production'

export default function SidebarNav() {
  const pathname = usePathname()

  function NavLink({ href, label }: { href: string; label: string }) {
    const isActive = pathname === href || pathname.startsWith(href + '/')
    return (
      <Link
        href={href}
        className={`
          flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors
          ${isActive
            ? 'bg-surface-inverse-raised text-text-inverted'
            : 'text-text-on-inverse hover:text-text-inverted hover:bg-surface-inverse-raised'
          }
        `}
      >
        {label}
      </Link>
    )
  }

  return (
    <aside className="w-64 flex-shrink-0 min-h-screen bg-surface-inverse flex flex-col">
      <div className="px-6 py-5 border-b border-border-inverse">
        <span className="text-base font-semibold text-text-inverted">
          {copy.brand.name}
        </span>
        <span className="ml-2 text-xs font-medium text-text-on-inverse uppercase tracking-wider">
          {copy.brand.suffix}
        </span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navLinks.map(({ href, label }) => (
          <NavLink key={href} href={href} label={label} />
        ))}

        {isDev && (
          <div className="pt-4 mt-4 border-t border-border-inverse">
            <NavLink href="/dev/seed" label={copy.nav.dev} />
          </div>
        )}
      </nav>

      <div className="px-3 py-4 border-t border-border-inverse">
        <form action={adminLogout}>
          <button
            type="submit"
            className="w-full flex items-center px-3 py-2 rounded-md text-sm font-medium text-text-on-inverse hover:text-text-inverted hover:bg-surface-inverse-raised transition-colors"
          >
            {copy.nav.logout}
          </button>
        </form>
      </div>
    </aside>
  )
}
