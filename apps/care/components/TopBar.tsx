// ─── apps/care/components/TopBar.tsx ─────────────────────────────────────────
// Minimal top bar for all /cases/* pages in apps/care.
// Per Section 10 of the Phase B design: slim top bar (56px height), no sidebar.
//
// Left:  NI Care home link + optional breadcrumb trail
// Right: Practitioner display_name
//
// All server-rendered — no 'use client' needed.

import Link from 'next/link'

export interface BreadcrumbItem {
  label: string
  href?: string  // If provided, renders as a link
}

export interface TopBarProps {
  breadcrumb?:       BreadcrumbItem[]  // Items after the "Inbox" root
  practitionerName?: string
}

export function TopBar({ breadcrumb = [], practitionerName }: TopBarProps) {
  return (
    <div style={{
      borderBottom: '1px solid #E8E6E0',
      background:   '#FFFFFF',
      padding:      '0 32px',
    }}>
      <div style={{
        maxWidth:       '1100px',
        margin:         '0 auto',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        height:         '56px',
      }}>
        {/* ── Left: NI Care home + breadcrumb ─────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <Link
            href="/cases"
            style={{ fontSize: '13px', color: '#8A8880', textDecoration: 'none', fontWeight: 500, whiteSpace: 'nowrap' }}
          >
            Inbox
          </Link>
          {breadcrumb.map((item, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#D4D0C8', fontSize: '13px' }}>/</span>
              {item.href ? (
                <Link
                  href={item.href}
                  style={{ fontSize: '13px', color: '#555350', textDecoration: 'none', whiteSpace: 'nowrap' }}
                >
                  {item.label}
                </Link>
              ) : (
                <span style={{ fontSize: '13px', color: '#555350', whiteSpace: 'nowrap' }}>
                  {item.label}
                </span>
              )}
            </span>
          ))}
        </div>

        {/* ── Right: NI Care label + practitioner name ─────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
          {practitionerName && (
            <span style={{ fontSize: '13px', color: '#555350', fontWeight: 500 }}>
              {practitionerName}
            </span>
          )}
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#B8935A' }}>
            NI Care
          </span>
        </div>
      </div>
    </div>
  )
}
