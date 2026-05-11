'use client'
// ─── CollapsibleSection ───────────────────────────────────────────────────────
// Client component for collapsible workspace panels. Collapse state resets to
// defaultExpanded on each workspace open — no persistence across sessions.

import { useState } from 'react'

interface CollapsibleSectionProps {
  id:              string        // anchor id for section nav rail
  title:           string
  subtitle?:       string        // e.g. "4 events" shown when collapsed
  defaultExpanded: boolean
  children:        React.ReactNode
  emptyState?:     string        // if set, renders a muted subtitle and suppresses expand
}

export function CollapsibleSection({
  id,
  title,
  subtitle,
  defaultExpanded,
  children,
  emptyState,
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded && !emptyState)

  const headerStyle: React.CSSProperties = {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    padding:        '14px 20px',
    background:     '#FFFFFF',
    cursor:         emptyState ? 'default' : 'pointer',
    userSelect:     'none',
    borderBottom:   expanded && !emptyState ? '1px solid #E8E6E0' : 'none',
  }

  const chevron = expanded ? '▲' : '▼'

  return (
    <div id={id} style={{ border: '1px solid #E8E6E0', borderRadius: '8px', overflow: 'hidden', marginBottom: '16px' }}>
      {/* Header */}
      <div
        style={headerStyle}
        onClick={() => { if (!emptyState) setExpanded(e => !e) }}
        role={emptyState ? undefined : 'button'}
        aria-expanded={emptyState ? undefined : expanded}
      >
        <div>
          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#8A8880' }}>
            {title}
          </span>
          {(subtitle || emptyState) && (
            <span style={{ fontSize: '11px', color: '#B0AEA8', marginLeft: '8px' }}>
              {emptyState ?? subtitle}
            </span>
          )}
        </div>
        {!emptyState && (
          <span style={{ fontSize: '10px', color: '#B0AEA8' }}>{chevron}</span>
        )}
      </div>

      {/* Content */}
      {expanded && !emptyState && (
        <div style={{ padding: '20px', background: '#FAFAF9' }}>
          {children}
        </div>
      )}
    </div>
  )
}
