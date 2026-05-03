'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavLink {
  label:      string
  href:       string | null
  exact?:     boolean
  comingSoon?: boolean
}

const memberLinks: NavLink[] = [
  { label: 'Overview',     href: '/dashboard',             exact: true  },
  { label: 'My workshops', href: '/dashboard/workshops'                  },
  { label: 'My requests',  href: '/dashboard/requests'                   },
  { label: 'BioHub',       href: '/dashboard/biohub'                    },
  { label: 'RootFinder',   href: '/dashboard/rootfinder'                 },
  { label: 'DailyPath',    href: '/dashboard/dailypath'                  },
  { label: 'Trajectory',   href: '/dashboard/trajectory'                 },
  { label: 'LifeTracker',  href: '/dashboard/lifetracker'                },
  { label: 'Intelligence', href: null,                     comingSoon: true },
  { label: 'Settings',     href: null,                     comingSoon: true },
]

const practitionerLinks: NavLink[] = [
  { label: 'Overview',   href: '/dashboard/practitioner',         exact: true  },
  { label: 'My profile', href: '/dashboard/practitioner/profile'              },
  { label: 'Referrals',  href: null,                              comingSoon: true },
  { label: 'Workshops',  href: '/workshops'                                    },
]

export function DashboardSidebar({ role }: { role: string }) {
  const pathname = usePathname()
  const links    = role === 'practitioner' ? practitionerLinks : memberLinks
  const heading  = role === 'practitioner' ? 'Practitioner' : 'Dashboard'

  function isActive(link: NavLink): boolean {
    if (!link.href) return false
    return link.exact ? pathname === link.href : pathname.startsWith(link.href)
  }

  return (
    <div className="sticky top-24">
      <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3 px-3">
        {heading}
      </p>
      <nav className="space-y-0.5">
        {links.map((link) =>
          link.comingSoon ? (
            <span
              key={link.label}
              className="flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-text-muted opacity-40 cursor-not-allowed"
            >
              {link.label}
              <span className="text-[10px] font-medium tracking-wide uppercase text-text-muted">Soon</span>
            </span>
          ) : (
            <Link
              key={link.label}
              href={link.href!}
              className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive(link)
                  ? 'bg-brand-subtle text-text-brand'
                  : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary'
              }`}
            >
              {link.label}
            </Link>
          )
        )}
      </nav>
    </div>
  )
}
