'use client'
// ─── MyNav ───────────────────────────────────────────────────────────────────
// The client's primary navigation. Five destinations describing what a person
// HAS, with everything else NI has built one quiet link away.
//
// Deliberately NOT the existing DashboardSidebar, which is a flat list of
// fourteen features — Overview, BioHub, RootFinder, Trajectory, LifeTracker
// and so on. That list describes what NI built. These five describe what a
// person has, and the features become content underneath them rather than
// competing with them for attention.
//
// "Everything else" is a LINK, not a sixth tab. It is the way back to the
// whole product for someone who wants it, sized so it does not ask to be
// clicked on a first visit. Which modules it offers is decided by
// lib/my/progressiveNav.ts, where the rule can be read and tested.

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PRIMARY_DESTINATIONS } from '@/lib/my/progressiveNav'

export function MyNav() {
  const pathname = usePathname()
  const onMore = pathname.startsWith('/my/more')

  return (
    <nav aria-label="Your care" className="border-b border-border-default mb-8">
      <div className="flex items-end justify-between gap-4">
        <ul className="flex gap-1 overflow-x-auto -mb-px">
          {PRIMARY_DESTINATIONS.map((item) => {
            const exact = 'exact' in item && item.exact
            const active = exact ? pathname === item.href : pathname.startsWith(item.href)
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

        {/* Quieter than a tab, on purpose. */}
        <Link
          href="/my/more"
          aria-current={onMore ? 'page' : undefined}
          className={[
            'flex-shrink-0 px-3 py-3 -mb-px text-xs whitespace-nowrap border-b-2 transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-default rounded-t',
            onMore
              ? 'border-border-strong text-text-secondary'
              : 'border-transparent text-text-muted hover:text-text-secondary',
          ].join(' ')}
        >
          Everything else
        </Link>
      </div>
    </nav>
  )
}
