'use client'

// ─── Cockpit chrome — header, section tabs, footer ───────────────────────────
// Board 1 (MASTER). Fixed zones: 64px header, 42px tabs, 62px footer. The page
// itself never scrolls; the two panes scroll internally.
//
// The approved visual language in cockpitTokens.ts is UNCHANGED — same
// colours, type, zone heights and component states. The visual-design gate is
// closed and this is not a redesign. What changed is how much is on screen at
// once, per the Founder's review of 4 Nov 2026.
//
// ── WHAT WAS REMOVED, AND WHY ───────────────────────────────────────────────
//
// THE SAVE BUTTONS. The header carried "Save" and the footer "Save and
// pause". Capture now autosaves continuously, so a Save button offers a
// practitioner a choice they do not have and implies that not pressing it
// loses work. In their place is one quiet persistence state. Pause remains:
// pausing the CLOCK when you step out of the room is a real operational act,
// and is not the same thing as saving.
//
// THREE OF THE FOUR TIMERS. The header showed the same information four ways
// at once — a 26px elapsed figure, "/ 60 min", "42:00 remaining", and a
// progress track, plus a state dot. One reading is enough to glance at. It
// now shows elapsed against planned, and the progress track, which is the
// pairing that answers "how am I doing for time" without arithmetic.
//
// ── WHAT THE ROLE PILL NOW SAYS ─────────────────────────────────────────────
//
// It used to appear only for a student, reading "Student · supervised
// consultation" — which made supervision look like a different product. The
// Founder's ruling is that anyone authorised to take a case operates AS a
// practitioner, and the difference is authority at sign-off. So the pill
// always shows, and reads "Practitioner", "Practitioner · Supervised" or
// "Practitioner · Lead", from roleLabel() in the domain layer. The governance
// underneath is untouched: a supervised practitioner still cannot sign off
// and still cannot close a safety review.

import {
  activeSeconds, isOverrunning, overrunSeconds, formatDuration,
  type TimerSession,
} from '@natural-intelligence/db/cockpit'
import type { V2SaveState } from '@natural-intelligence/db/intakeV2'
import { C, F, Z, button, eyebrow } from './cockpitTokens'

export interface SectionTab {
  id: string
  label: string
  /** Shown as a small gold-ink numeral before the label. */
  number: number
}

// ── Persistence state ───────────────────────────────────────────────────────
//
// One quiet line in the chrome, not in the consultation. It says WHERE the
// work is, because that is the part a practitioner needs and the part it
// would be easiest to mislead them about.
//
// 'in_session_only' is the Cockpit's honest state TODAY, and it is not a
// placeholder for "saving". Capture cannot reach the canonical record while
// no Question → Concept(+variant) → Field mapping is approved, and there is
// no practitioner draft store to reach instead — case_contributions is
// append-only and nothing writes to it yet. So the work lives in this page
// and is lost on reload, and the line says exactly that rather than
// implying a save that is not happening.
//
// The other states exist so that when a server-side draft IS approved and
// built, this component already renders it and the indicator becomes a plain
// "Saved" — earned, because by then it will be true.

export type CockpitSaveState = V2SaveState | 'in_session_only'

function SaveState({ state }: { state: CockpitSaveState }) {
  const text =
    state === 'in_session_only' ? 'Held in this session only'
      : state === 'saving' ? 'Saving…'
        : state === 'saved' ? 'Saved'
          : state === 'error' ? 'Not saved — retrying'
            : ''

  return (
    <span
      role="status"
      style={{
        fontSize: '12px',
        color: state === 'error' ? C.oxblood : C.softText,
        whiteSpace: 'nowrap',
        minWidth: '150px',
        textAlign: 'right',
      }}
    >
      {text}
    </span>
  )
}

// ── Header ──────────────────────────────────────────────────────────────────

export function CockpitHeader({
  clientLine, contextLine, rolePill, timer, now, saveState, timerAction, onPause, onResume,
}: {
  clientLine: string
  contextLine: string
  /** Always present now: Practitioner · Supervised | Lead, or Practitioner. */
  rolePill: string
  timer: TimerSession
  now: string
  saveState: CockpitSaveState
  /**
   * Start / finish the consultation — the timer's own lifecycle, so it sits
   * with the timer rather than in the pilot banner, where it used to be
   * mixed in with text about mapping approval. Null when there is nothing to
   * offer.
   */
  timerAction: { label: string; onClick: () => void } | null
  onPause: () => void
  onResume: () => void
}) {
  const elapsed = activeSeconds(timer, now)
  const over = isOverrunning(timer, now)
  const planned = timer.plannedMinutes * 60
  const running = timer.state === 'running'
  const progress = Math.min(1, planned === 0 ? 0 : elapsed / planned)

  return (
    <header
      style={{
        height: `${Z.header}px`, flexShrink: 0, display: 'flex', alignItems: 'center',
        gap: '24px', padding: '0 28px', borderBottom: `1px solid ${C.line}`,
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

      <span style={{
        ...eyebrow(C.goldInk, 11.5),
        border: `1px solid ${C.gold}`, background: C.goldTint,
        borderRadius: '999px', padding: '6px 14px', whiteSpace: 'nowrap',
      }}>
        {rolePill}
      </span>

      <span style={{ flex: 1 }} />

      <SaveState state={saveState} />

      {/* ONE timer. Elapsed against planned, and a calm track. */}
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
              background: running ? (over ? C.gold : C.olive) : 'transparent',
              border: running ? 'none' : `1.5px solid ${C.softText}`,
              display: 'inline-block',
            }}
          />
        )}

        <span style={{
          fontFamily: F.display, fontSize: '22px', fontWeight: 600,
          color: timer.state === 'paused' ? C.softText : C.botanical,
          fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
        }}>
          {formatDuration(elapsed)}
          <span style={{ fontSize: '14px', color: C.softText, fontWeight: 400 }}>
            {' / '}{timer.plannedMinutes}:00
          </span>
        </span>

        {timer.state !== 'not_started' && timer.state !== 'completed' && (
          <span
            aria-hidden
            style={{
              width: '96px', height: '3px', borderRadius: '2px',
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

        {/* Only states that need words get them: paused, and overrunning. */}
        {(timer.state === 'paused' || over) && (
          <span style={{ fontSize: '12px', color: over ? C.goldInk : C.softText, whiteSpace: 'nowrap' }}>
            {timer.state === 'paused'
              ? `Paused${timer.pauseReason ? ` · ${timer.pauseReason}` : ''}`
              : `Over by ${formatDuration(overrunSeconds(timer, now))}`}
          </span>
        )}
      </div>

      {/* Pausing the clock, not saving work. */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        {timer.state === 'paused' ? (
          <button type="button" onClick={onResume} style={button('primary')}>Resume</button>
        ) : (
          timer.state === 'running' && (
            <button type="button" onClick={onPause} style={button('outline')}>Pause</button>
          )
        )}
        {timerAction && (
          <button
            type="button"
            onClick={timerAction.onClick}
            style={timer.state === 'not_started' ? button('primary') : button('outline')}
          >
            {timerAction.label}
          </button>
        )}
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
  /** Drives the count badge on Safety summary. */
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
  thisSection, caseWideSafety, primaryLabel, primaryDisabled, blockedReason, onPrimary,
}: {
  /** Counts for the CURRENT section only. */
  thisSection: string[]
  /** Case-wide safety. Shown always; never blocks this section. */
  caseWideSafety: string[]
  /** State-aware: says what will happen, including that a review stays open. */
  primaryLabel: string
  primaryDisabled?: boolean
  /** Why the primary action is unavailable, where it is. Shown, not hidden. */
  blockedReason?: string | null
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

      {/* ONE completion action. No "Save and pause" beside it competing for
          the eye — there is nothing to save and nothing to cancel. */}
      {blockedReason && (
        <span style={{ fontSize: '12.5px', color: C.softText, maxWidth: '320px', lineHeight: 1.4 }}>
          {blockedReason}
        </span>
      )}
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
