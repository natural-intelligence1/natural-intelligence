'use client'

// ─── Question actions — common visible, exceptions quiet ─────────────────────
//
// WHAT THIS REPLACES
//
// Seven equally-weighted controls in a row on every active question:
//   Verify · Amend · Add observation · Mark unconfirmed · Not asked ·
//   Declined · plus a sentence about attribution.
//
// Every one of those is still available. None has been removed. What changed
// is weight: the three a practitioner reaches for during a consultation are
// visible, and the four they reach for occasionally live under More.
//
// ── WHY THE FIRST BUTTON STILL SAYS "VERIFY" ────────────────────────────────
//
// The Founder's sketch said "Confirm". I have kept "Verify", and this is a
// deliberate deviation worth overruling me on if you disagree.
//
// The action writes the provenance value `practitioner_verified`, whose
// approved label everywhere else in NI — the chip, the legend, the audit
// trail, the synopsis — is "Practitioner verified". Calling the button
// "Confirm" would create a second word for one concept, and 0063 is the
// standing lesson here: a shared or near word does not make two concepts the
// same, and a translation layer between what a button says and what the
// record stores is exactly the drift that migration had to unpick.
//
// So: same button, same place, same weight the Founder asked for — the label
// matches what it records. If "Confirm" is wanted as the client-facing and
// practitioner-facing word for this provenance state, that is a vocabulary
// change to make in provenance.ts and propagate, not a label to change here.

import { useEffect, useRef, useState } from 'react'
import { C, F, button } from './cockpitTokens'

export interface QuestionActionsProps {
  /** A qualified practitioner may verify and amend. */
  mayVerify: boolean
  /** Anyone authorised to take the case may capture. */
  mayCapture: boolean
  /** Supervised practitioners add observations as drafts. */
  asDraft: boolean
  /** True when there is a value to act on. */
  hasValue: boolean
  /** Reason shown in place of Verify when the actor may not verify. */
  verifyBlockedReason: string
  onVerify: () => void
  onAmend: () => void
  onObserve: () => void
  onUnconfirmed: () => void
  onNotAsked: () => void
  onDeclined: () => void
  onViewHistory: () => void
  /** Hidden unless there is history to view. */
  hasHistory: boolean
}

export function QuestionActions(props: QuestionActionsProps) {
  const {
    mayVerify, mayCapture, asDraft, hasValue, verifyBlockedReason,
    onVerify, onAmend, onObserve, onUnconfirmed, onNotAsked, onDeclined,
    onViewHistory, hasHistory,
  } = props

  const [moreOpen, setMoreOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)

  // Click-away and Escape. A menu that will not close is worse than a row of
  // buttons, which is what this is replacing.
  useEffect(() => {
    if (!moreOpen) return
    function onDown(e: MouseEvent) {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setMoreOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMoreOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [moreOpen])

  const stop = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn() }

  return (
    <div
      ref={wrap}
      style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', position: 'relative' }}
    >
      {mayVerify ? (
        <button
          type="button"
          disabled={!hasValue}
          onClick={stop(onVerify)}
          style={{ ...button(hasValue ? 'miniPrimary' : 'disabled') }}
        >
          Verify
        </button>
      ) : (
        <button type="button" disabled style={button('disabled')} title={verifyBlockedReason}>
          Verify — supervisor only
        </button>
      )}

      <button
        type="button"
        disabled={!mayVerify || !hasValue}
        onClick={stop(onAmend)}
        style={mayVerify && hasValue ? button('mini') : button('disabled')}
      >
        Amend
      </button>

      <button
        type="button"
        disabled={!mayCapture}
        onClick={stop(onObserve)}
        style={mayCapture ? button('mini') : button('disabled')}
      >
        {asDraft ? 'Add observation (draft)' : 'Add observation'}
      </button>

      {/* Exceptions, quiet. */}
      <button
        type="button"
        onClick={stop(() => setMoreOpen((v) => !v))}
        aria-expanded={moreOpen}
        aria-haspopup="menu"
        style={{
          ...button('mini'),
          borderColor: C.lineControl,
          color: C.softText,
        }}
      >
        More
        <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden
          style={{ transform: moreOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
          <path d="M1.5 3.5 L5 7 L8.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {moreOpen && (
        <div
          role="menu"
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 30,
            background: C.warmWhite, border: `1px solid ${C.lineStrong}`,
            borderRadius: '10px', padding: '6px', minWidth: '220px',
            boxShadow: '0 6px 18px rgba(30,47,36,.10)',
          }}
        >
          <MenuItem
            label="Mark unconfirmed"
            hint="Recorded, not yet verified"
            disabled={!mayCapture || !hasValue}
            onClick={() => { setMoreOpen(false); onUnconfirmed() }}
          />
          <MenuItem
            label="Not asked"
            hint="Never treated as No"
            disabled={!mayCapture}
            onClick={() => { setMoreOpen(false); onNotAsked() }}
          />
          <MenuItem
            label="Declined"
            hint="The client chose not to answer"
            disabled={!mayCapture}
            onClick={() => { setMoreOpen(false); onDeclined() }}
          />
          {hasHistory && (
            <>
              <div aria-hidden style={{ height: '1px', background: C.line, margin: '5px 2px' }} />
              <MenuItem
                label="View history"
                hint="Every earlier value, attributed"
                disabled={false}
                onClick={() => { setMoreOpen(false); onViewHistory() }}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}

function MenuItem({
  label, hint, disabled, onClick,
}: {
  label: string
  hint: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      style={{
        all: 'unset',
        display: 'block', width: '100%', boxSizing: 'border-box',
        padding: '7px 9px', borderRadius: '7px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        font: `500 13px ${F.ui}`, color: C.text,
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = C.cream }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
    >
      {label}
      <span style={{ display: 'block', fontSize: '11.5px', color: C.softText, fontWeight: 400, marginTop: '1px' }}>
        {hint}
      </span>
    </button>
  )
}
