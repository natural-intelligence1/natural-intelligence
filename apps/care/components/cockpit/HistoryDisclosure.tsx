'use client'

// ─── History · n changes ─────────────────────────────────────────────────────
//
// THE PROBLEM THIS SOLVES
//
// The capture pane used to show, permanently and for every question: a
// provenance legend of seven chips across the top of the consultation; the
// current value's provenance chip; the attribution line; and, on the active
// card, every earlier value struck through with its own chip and timestamp
// and the words "original kept".
//
// All of that is real and none of it is deleted. But it made provenance look
// like a global interaction mode, and it meant a practitioner listening to a
// client was reading an audit trail instead of a current answer.
//
// WHAT CHANGED
//
// The main screen shows the CURRENT WORKING VALUE. Behind one control —
// "History · 4 changes" — sits the complete chain: the original client
// answer, every previous value, each amendment, who made it, when, and the
// provenance of each. Nothing is summarised away and nothing is dropped.
//
// A question with no history has no control, because there is nothing to open.
//
// WHAT IS STILL ALWAYS VISIBLE
//
// Two things, because hiding either would change meaning rather than reduce
// noise:
//
//   · "Not asked". It is a state with its own sentence and is NEVER rendered
//     as, defaulted to, or counted as "No". It stays on the card.
//   · A student draft awaiting supervisor review. A supervisor must not have
//     to open a drawer to discover that what they are reading is unverified.

import { useState } from 'react'
import { attributionLine, type CaptureActor } from '@natural-intelligence/db/cockpit'
import { C, F, PROVENANCE_CHIP } from './cockpitTokens'

const PROVENANCE_LABEL: Record<string, string> = {
  client_reported: 'Client reported',
  practitioner_verified: 'Practitioner verified',
  corrected: 'Amended',
  observed: 'Observed',
  unconfirmed: 'Unconfirmed',
  not_asked: 'Not asked',
  declined: 'Declined',
}

export function Chip({ kind, children }: { kind: string; children?: React.ReactNode }) {
  return (
    <span style={PROVENANCE_CHIP[kind] ?? PROVENANCE_CHIP.not_asked}>
      {children ?? PROVENANCE_LABEL[kind] ?? kind}
    </span>
  )
}

export interface HistoryEntry {
  value: unknown
  provenance: string
  at: string
  actor?: CaptureActor
}

export interface CurrentEntry {
  value: unknown
  provenance: string
  at: string
  actor: CaptureActor
}

function asList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String)
  if (value === null || value === undefined || value === '') return []
  return [String(value)]
}

/**
 * The disclosure control plus, when open, the whole chain.
 *
 * The count is of CHANGES, not of entries: an answer given once and never
 * amended has nothing to disclose, so nothing appears. The first value is
 * included inside the panel as the original.
 */
export function HistoryDisclosure({
  current, history, label = 'History',
}: {
  current: CurrentEntry | null
  history: HistoryEntry[]
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const changes = history.length
  if (changes === 0) return null

  return (
    <div style={{ marginTop: '2px' }}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
        aria-expanded={open}
        style={{
          all: 'unset', cursor: 'pointer',
          font: `500 12px ${F.ui}`, color: C.softText,
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          borderBottom: `1px dotted ${C.lineControl}`, paddingBottom: '1px',
        }}
      >
        <Caret open={open} />
        {label} · {changes} change{changes > 1 ? 's' : ''}
      </button>

      {open && (
        <div
          style={{
            marginTop: '9px', background: C.cream, borderRadius: '10px',
            border: `1px solid ${C.line}`, padding: '12px 14px',
            fontSize: '13px', lineHeight: 1.5,
          }}
        >
          {/* Current first — it is what the record says now. */}
          {current && (
            <Row
              value={current.value}
              provenance={current.provenance}
              when={attributionLine(current.actor, current.at)}
              note="current"
              struck={false}
            />
          )}

          {/* Then every earlier value, newest first, each kept whole. */}
          {history.map((h, i) => (
            <Row
              key={`${h.at}-${i}`}
              value={h.value}
              provenance={h.provenance}
              when={h.actor
                ? attributionLine(h.actor, h.at)
                : new Date(h.at).toLocaleString('en-GB')}
              note={i === history.length - 1 ? 'original kept' : 'previous'}
              struck
            />
          ))}

          <p style={{ margin: '10px 0 0', fontSize: '11.5px', color: C.softText }}>
            Every entry is attributed and dated. Nothing is overwritten — earlier values are kept.
          </p>
        </div>
      )}
    </div>
  )
}

function Row({
  value, provenance, when, note, struck,
}: {
  value: unknown
  provenance: string
  when: string
  note: string
  struck: boolean
}) {
  const text = asList(value).join(', ') || '—'
  return (
    <div style={{ marginBottom: '9px' }}>
      <div style={{
        textDecoration: struck ? 'line-through' : 'none',
        color: struck ? C.softText : C.botanical,
        fontWeight: struck ? 400 : 600,
      }}>
        {text}
      </div>
      <div style={{
        display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap',
        fontSize: '11.5px', color: C.softText, marginTop: '4px',
      }}>
        <Chip kind={provenance} />
        <span>{when}</span>
        <span>· {note}</span>
      </div>
    </div>
  )
}

function Caret({ open }: { open: boolean }) {
  return (
    <svg
      width="9" height="9" viewBox="0 0 10 10" aria-hidden
      style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}
    >
      <path d="M3 1.5 L7 5 L3 8.5" fill="none" stroke="currentColor" strokeWidth="1.6"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
