'use client'

// ─── Cockpit chrome — header, section tabs, footer ───────────────────────────
// Board 1 (MASTER). Fixed zones: 64px header, 42px tabs, 62px footer. The page
// itself never scrolls; the two panes scroll internally.
//
// The timer sits in the HEADER, between vertical dividers, outside both panes.
// That placement is approved and load-bearing: the timer is operational, and
// putting it inside the pane where the practitioner is listening to someone
// would make it part of the consultation.

import {
  activeSeconds, isOverrunning, overrunSeconds, formatDuration,
  type TimerSession,
} from '@natural-intelligence/db/cockpit'
import { C, F, Z, button, eyebrow } from './cockpitTokens'

export interface SectionTab {
  id: string
  label: string
  /** Shown as a small gold-ink numeral before the label. */
  number: number
}

// ── Header ──────────────────────────────────────────────────────────────────

export function CockpitHeader({
  clientLine, contextLine, rolePill, timer, now, onPause, onResume, onSave,
}: {
  clientLine: string
  contextLine: string
  /** Student only. Absent for a qualified practitioner. */
  rolePill?: string
  timer: TimerSession
  now: string
  onPause: () => void
  onResume: () => void
  onSave: () => void
}) {
  const elapsed = activeSeconds(timer, now)
  const over = isOverrunning(timer, now)
  const planned = timer.plannedMinutes * 60
  const remaining = Math.max(0, planned - elapsed)
  const running = timer.state === 'running'
  const progress = Math.min(1, planned === 0 ? 0 : elapsed / planned)

  return (
    <header
      style={{
        height: `${Z.header}px`, flexShrink: 0, display: 'flex', alignItems: 'center',
        gap: '28px', padding: '0 28px', borderBottom: `1px solid ${C.line}`,
        background: C.warmWhite,
      }}
    >
      <span style={{
        fontFamily: F.display, fontSize: '16px', letterSpacing: '.18em',
        fontWeight: 600, color: C.pine, whiteSpace: 'nowrap',
      }}>
        NATURAL INTELLIGENCE
      </span>

      <div style={{
        display: 'flex', flexDirection: 'column', gap: '2px',
        paddingLeft: '24px', borderLeft: `1px solid ${C.line}`, minWidth: 0,
      }}>
        <b style={{ fontSize: '14.5px', fontWeight: 600, color: C.botanical }}>{clientLine}</b>
        <span style={{ fontSize: '12.5px', color: C.softText }}>{contextLine}</span>
      </div>

      {rolePill && (
        <span style={{
          ...eyebrow(C.goldInk, 11.5),
          border: `1px solid ${C.gold}`, background: C.goldTint,
          borderRadius: '999px', padding: '6px 14px', whiteSpace: 'nowrap',
        }}>
          {rolePill}
        </span>
      )}

      <span style={{ flex: 1 }} />

      {/* Timer — between dividers, outside both panes. */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px', padding: '0 20px',
        borderLeft: `1px solid ${C.line}`, borderRight: `1px solid ${C.line}`,
        height: `${Z.header}px`,
      }}>
        {timer.state === 'completed' ? (
          <span aria-hidden style={{ color: C.pine, fontSize: '15px' }}>✓</span>
        ) : (
          <span
            aria-hidden
            style={{
              width: '8px', height: '8px', borderRadius: '50%',
              // Running: quiet olive. Overrun: antique gold. Paused: hollow.
              background: running ? (over ? C.gold : C.olive) : 'transparent',
              border: running ? 'none' : `1.5px solid ${C.softText}`,
              display: 'inline-block',
            }}
          />
        )}

        <span style={{
          fontFamily: F.display, fontSize: '26px', fontWeight: 600,
          color: timer.state === 'paused' ? C.softText : C.botanical,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {formatDuration(elapsed)}
        </span>

        <span style={{ fontSize: '13px', color: C.softText, lineHeight: 1.35 }}>
          / {timer.plannedMinutes} min
          <br />
          {timer.state === 'paused'
            ? `Paused${timer.pauseReason ? ` · ${timer.pauseReason}` : ''}`
            : over
              ? `Over by ${formatDuration(overrunSeconds(timer, now))}`
              : `${formatDuration(remaining)} remaining`}
        </span>

        {/* Calm progress track. No red, no flashing, no sound. */}
        {timer.state !== 'not_started' && timer.state !== 'completed' && (
          <span
            aria-hidden
            style={{
              width: '120px', height: '3px', borderRadius: '2px',
              background: C.line, overflow: 'hidden', display: 'inline-block',
            }}
          >
            <span style={{
              display: 'block', height: '100%',
              width: `${Math.round(progress * 100)}%`,
              background: over ? C.gold : C.pine,
            }} />
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        {timer.state === 'paused' ? (
          <button type="button" onClick={onResume} style={button('primary')}>Resume</button>
        ) : (
          <button
            type="button"
            onClick={onPause}
            disabled={timer.state !== 'running'}
            style={{ ...button('outline'), opacity: timer.state === 'running' ? 1 : 0.55 }}
          >
            Pause
          </button>
        )}
        <button type="button" onClick={onSave} style={button('outline')}>Save</button>
      </div>
    </header>
  )
}

// ── Section tabs ────────────────────────────────────────────────────────────

export function SectionTabs({
  tabs, current, reviewCount, reviewMode, onSelect, onToggleReviewMode,
}: {
  tabs: SectionTab[]
  current: string
  /** Drives the red count badge on Safety summary. */
  reviewCount: number
  reviewMode: boolean
  onSelect: (id: string) => void
  onToggleReviewMode: () => void
}) {
  return (
    <nav
      aria-label="Consultation sections"
      style={{
        height: `${Z.tabs}px`, flexShrink: 0, display: 'flex', gap: '26px',
        padding: '0 28px', alignItems: 'stretch',
        borderBottom: `1px solid ${C.line}`, fontSize: '13.5px',
        background: C.cream,
      }}
    >
      {tabs.map((t) => {
        const active = t.id === current
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            aria-current={active ? 'page' : undefined}
            style={{
              all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center',
              gap: '7px', whiteSpace: 'nowrap',
              color: active ? C.botanical : C.softText,
              fontWeight: active ? 600 : 400,
              // 2px pine underline marks the current section.
              boxShadow: active ? `inset 0 -2px 0 ${C.pine}` : 'none',
            }}
          >
            <span style={{ fontSize: '11.5px', color: C.goldInk, fontWeight: 600 }}>{t.number}</span>
            {t.label}
          </button>
        )
      })}

      {/* Safety summary carries the review badge whenever anything in the
          case needs a human. It stays visible from every section. */}
      <span style={{ display: 'flex', alignItems: 'center', gap: '7px', whiteSpace: 'nowrap', color: C.softText }}>
        <span style={{ fontSize: '11.5px', color: C.goldInk, fontWeight: 600 }}>{tabs.length + 1}</span>
        Safety summary
        {reviewCount > 0 && (
          <span style={{
            fontSize: '10.5px', fontWeight: 600, background: C.oxblood, color: C.cream,
            borderRadius: '999px', padding: '2px 7px',
          }}>
            {reviewCount} review{reviewCount > 1 ? 's' : ''}
          </span>
        )}
      </span>

      <span style={{ flex: 1 }} />

      <button
        type="button"
        onClick={onToggleReviewMode}
        aria-pressed={reviewMode}
        style={{
          all: 'unset', cursor: 'pointer', alignSelf: 'center',
          font: `500 12px ${F.ui}`,
          color: reviewMode ? C.pine : C.softText,
          background: reviewMode ? C.sage : 'transparent',
          border: `1px dashed ${reviewMode ? C.pine : C.lineControl}`,
          borderRadius: '999px', padding: '4px 11px', minHeight: '30px',
          display: 'inline-flex', gap: '6px', alignItems: 'center', whiteSpace: 'nowrap',
        }}
      >
        <NodeGlyph />
        Node details · review mode
      </button>
    </nav>
  )
}

/** Share/graph glyph — NI line-icon primitive, drawn inline. */
function NodeGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
    </svg>
  )
}

// ── Footer ──────────────────────────────────────────────────────────────────

export function CockpitFooter({
  thisSection, caseWideSafety, primaryLabel, primaryDisabled, onSaveAndPause, onPrimary,
}: {
  /** Counts for the CURRENT section only. */
  thisSection: string[]
  /** Case-wide safety. Shown always; never blocks this section. */
  caseWideSafety: string[]
  primaryLabel: string
  primaryDisabled?: boolean
  onSaveAndPause: () => void
  onPrimary: () => void
}) {
  return (
    <footer
      style={{
        height: `${Z.footer}px`, flexShrink: 0, borderTop: `1px solid ${C.line}`,
        background: C.warmWhite, display: 'flex', alignItems: 'center',
        gap: '22px', padding: '0 28px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
        <span style={eyebrow(C.goldInk, 12)}>This section</span>
        <span style={{ fontSize: '13.5px', color: C.text, whiteSpace: 'nowrap' }}>
          {thisSection.length > 0 ? thisSection.join('  ·  ') : 'Nothing outstanding'}
        </span>
      </div>

      <span aria-hidden style={{ width: '1px', height: '26px', background: C.line }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
        <span style={eyebrow(C.oxblood, 12)}>Case-wide safety</span>
        <span style={{ fontSize: '13.5px', color: C.text, whiteSpace: 'nowrap' }}>
          {caseWideSafety.length > 0 ? caseWideSafety.join('  ·  ') : 'Nothing needs human review'}
        </span>
      </div>

      <span style={{ flex: 1 }} />

      <button type="button" onClick={onSaveAndPause} style={button('outline')}>Save and pause</button>
      <button
        type="button"
        onClick={onPrimary}
        disabled={primaryDisabled}
        style={{ ...button('primary'), opacity: primaryDisabled ? 0.55 : 1, cursor: primaryDisabled ? 'not-allowed' : 'pointer' }}
      >
        {primaryLabel}
      </button>
    </footer>
  )
}
