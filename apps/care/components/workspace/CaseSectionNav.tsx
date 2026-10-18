'use client'
// ─── CaseSectionNav ──────────────────────────────────────────────────────────
// Route-aware navigation for the case workspace.
//
// Deliberately NOT SectionNavRail: that is a scroll-spy for anchors within one
// long page. These sections are separate routes, so the active state comes
// from the pathname and each item is a real link — back/forward, open in a new
// tab and deep links all behave as a practitioner would expect.
//
// Horizontal and scrollable on narrow viewports; a column from 900px up.

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SECTIONS, T } from './caseTheme'

export function CaseSectionNav({ caseId }: { caseId: string }) {
  const pathname = usePathname()
  const base = `/cases/${caseId}`

  return (
    <nav aria-label="Case sections" className="ni-case-nav">
      {SECTIONS.map((s) => {
        const href = s.slug ? `${base}/${s.slug}` : base
        // Overview must match exactly, or it stays active on every subsection.
        const active = s.slug ? pathname.startsWith(href) : pathname === base
        return (
          <Link
            key={s.slug || 'overview'}
            href={href}
            aria-current={active ? 'page' : undefined}
            className="ni-case-nav__item"
            style={{
              color: active ? T.text : T.muted,
              fontWeight: active ? 600 : 400,
              borderColor: active ? T.gold : 'transparent',
            }}
          >
            {s.label}
          </Link>
        )
      })}
    </nav>
  )
}
