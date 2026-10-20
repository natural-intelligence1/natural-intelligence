'use client'
// ─── MyNav ───────────────────────────────────────────────────────────────────
// The client's primary navigation. Four destinations, locked.
//
// Deliberately NOT the existing DashboardSidebar, which is a flat list of
// thirteen features — Overview, BioHub, RootFinder, Trajectory, LifeTracker
// and so on. That list describes what NI built; these four describe what a
// person has. The features become content underneath them rather than
// competing with them for attention.

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS = [
  { href: '/my', label: 'Today', exact: true },
  { href: '/my/plan', label: 'My Plan' },
  { href: '/my/health', label: 'My Health' },
  { href: '/my/team', label: 'My Team' },
]

export function MyNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Your care" className="border-b border-border-default mb-8">
      <ul className="flex gap-1 overflow-x-auto -mb-px">
        {ITEMS.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
          return (
            <li key={item.href} className="flex-shrink-0">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={[
                  'block px-4 py-3 text-sm whitespace-nowrap border-b-2 transition-colors',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-default rounded-t',
                  active
                    ? 'border-brand-default text-text-primary font-medium'
                    : 'border-transparent text-text-muted hover:text-text-primary',
                ].join(' ')}
              >
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
