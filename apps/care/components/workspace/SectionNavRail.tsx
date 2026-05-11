'use client'
// ─── SectionNavRail ───────────────────────────────────────────────────────────
// Thin left-side navigation rail for the workspace. Highlights the current
// section on scroll. No persistence — resets on every workspace open.
// On narrow viewports (< 900px) the rail hides (action panel already takes right space).

import { useEffect, useState } from 'react'

interface NavSection {
  id:    string
  label: string
  empty: boolean  // greyed out if section has no content (e.g. no lab data)
}

interface SectionNavRailProps {
  sections: NavSection[]
}

export function SectionNavRail({ sections }: SectionNavRailProps) {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? '')

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // Find the topmost intersecting section
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible.length > 0) {
          setActiveId(visible[0].target.id)
        }
      },
      { threshold: 0.15, rootMargin: '-64px 0px -50% 0px' },
    )

    sections.forEach(s => {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [sections])

  function scrollTo(id: string) {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <nav
      aria-label="Workspace sections"
      style={{
        position:   'sticky',
        top:        '80px',
        width:      '120px',
        flexShrink: 0,
        display:    'flex',
        flexDirection: 'column',
        gap:        '4px',
        paddingTop: '8px',
      }}
    >
      {sections.map(s => {
        const isActive = activeId === s.id
        return (
          <button
            key={s.id}
            onClick={() => scrollTo(s.id)}
            disabled={s.empty}
            style={{
              display:         'block',
              width:           '100%',
              textAlign:       'left',
              padding:         '6px 10px',
              background:      'none',
              border:          'none',
              borderLeft:      isActive ? '2px solid #B8935A' : '2px solid transparent',
              fontSize:        '11px',
              fontWeight:      isActive ? 600 : 400,
              color:           s.empty ? '#D0CEC9' : isActive ? '#1A1917' : '#8A8880',
              cursor:          s.empty ? 'default' : 'pointer',
              lineHeight:      '1.3',
              transition:      'color 0.15s, border-color 0.15s',
            }}
          >
            {s.label}
          </button>
        )
      })}
    </nav>
  )
}
