'use client'

// ─── Consultation chrome ─────────────────────────────────────────────────────
// The timer and work log live HERE — in the product chrome, outside both
// working panes. That placement is the point: it is operational, it is not
// part of the consultation, and it must not sit inside the pane where the
// practitioner is listening to someone.
//
// It cannot affect what is asked. This component receives a TimerSession and
// callbacks and nothing else — no question, no section, no capture state — so
// there is no route by which it could hide, reorder or suppress anything.

import { useEffect, useState } from 'react'
import {
  activeSeconds, isOverrunning, overrunSeconds, formatDuration,
  OVERRUN_REASONS, OVERRUN_REASON_LABELS,
  type TimerSession, type OverrunReason,
} from '@natural-intelligence/db/cockpit'
import { T, FONT_DISPLAY } from '@/components/workspace/caseTheme'

const btn = (tone: 'plain' | 'gold' = 'plain') => ({
  fontSize: '12.5px',
  padding: '5px 12px',
  borderRadius: '6px',
  cursor: 'pointer',
  background: tone === 'gold' ? T.gold : T.card,
  color: tone === 'gold' ? '#fff' : T.text2,
  border: `1px solid ${tone === 'gold' ? T.gold : T.border}`,
})

export function CockpitChrome({
  timer, onStart, onPause, onResume, onComplete,
}: {
  timer: TimerSession
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onComplete: (overrun?: { reason: OverrunReason; note?: string }) => void
}) {
  // A ticking clock needs a render each second while running, and none at all
  // while paused or finished.
  const [now, setNow] = useState(() => new Date().toISOString())
  useEffect(() => {
    if (timer.state !== 'running') return
    const id = setInterval(() => setNow(new Date().toISOString()), 1000)
    return () => clearInterval(id)
  }, [timer.state])

  const [askingReason, setAskingReason] = useState(false)
  const [reason, setReason] = useState<OverrunReason>('more_history_than_expected')
  const [note, setNote] = useState('')

  const elapsed = activeSeconds(timer, now)
  const over = isOverrunning(timer, now)
  const overBy = overrunSeconds(timer, now)

  const finish = () => {
    if (over) { setAskingReason(true); return }
    onComplete()
  }

  return (
    <section
      aria-label="Consultation timer and work log"
      style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '14px',
        background: over ? T.warnBg : T.card,
        border: `1px solid ${over ? T.warnBorder : T.border}`,
        borderRadius: '10px', padding: '10px 14px', marginBottom: '18px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
        <span style={{
          fontFamily: FONT_DISPLAY, fontSize: '21px',
          color: over ? T.warnText : T.text, fontVariantNumeric: 'tabular-nums',
        }}>
          {formatDuration(elapsed)}
        </span>
        <span style={{ fontSize: '11.5px', color: T.muted }}>
          of {timer.plannedMinutes} min planned
        </span>
      </div>

      {/* State in words, never colour alone. */}
      <span style={{
        fontSize: '11px', padding: '2px 9px', borderRadius: '999px',
        background: T.sunken, border: `1px solid ${T.border}`, color: T.text2,
      }}>
        {timer.state === 'not_started' ? 'Not started'
          : timer.state === 'running' ? 'Running'
          : timer.state === 'paused' ? `Paused · ${timer.pauseCount}×`
          : 'Completed'}
      </span>

      {over && timer.state !== 'completed' && (
        <span style={{ fontSize: '11.5px', color: T.warnText }}>
          Over by {formatDuration(overBy)}
        </span>
      )}

      <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto', flexWrap: 'wrap' }}>
        {timer.state === 'not_started' && (
          <button type="button" onClick={onStart} style={btn('gold')}>Start consultation</button>
        )}
        {timer.state === 'running' && (
          <>
            <button type="button" onClick={onPause} style={btn()}>Pause</button>
            <button type="button" onClick={finish} style={btn('gold')}>Complete</button>
          </>
        )}
        {timer.state === 'paused' && (
          <>
            <button type="button" onClick={onResume} style={btn('gold')}>Resume</button>
            <button type="button" onClick={finish} style={btn()}>Complete</button>
          </>
        )}
        {timer.state === 'completed' && (
          <span style={{ fontSize: '12px', color: T.muted }}>
            {timer.overrunReason
              ? `Overrun recorded · ${OVERRUN_REASON_LABELS[timer.overrunReason]}`
              : 'Within planned time'}
          </span>
        )}
      </div>

      {/* An overrun needs a structured reason. A closed list, deliberately:
          free text here would collect clinical detail into payroll data. */}
      {askingReason && (
        <div style={{
          flexBasis: '100%', borderTop: `1px solid ${T.border}`, paddingTop: '12px', marginTop: '4px',
        }}>
          <p style={{ fontSize: '12.5px', color: T.text, margin: '0 0 8px' }}>
            This consultation ran over by {formatDuration(overBy)}. Why?
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as OverrunReason)}
              aria-label="Reason for overrun"
              style={{
                fontSize: '12.5px', padding: '5px 8px', borderRadius: '6px',
                border: `1px solid ${T.border}`, background: T.card, color: T.text,
              }}
            >
              {OVERRUN_REASONS.map((r) => (
                <option key={r} value={r}>{OVERRUN_REASON_LABELS[r]}</option>
              ))}
            </select>

            {reason === 'other_operational' && (
              <input
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 140))}
                maxLength={140}
                placeholder="Operational reason only — not a clinical note"
                aria-label="Operational reason"
                style={{
                  fontSize: '12.5px', padding: '5px 8px', borderRadius: '6px', minWidth: '280px',
                  border: `1px solid ${T.border}`, background: T.card, color: T.text,
                }}
              />
            )}

            <button
              type="button"
              onClick={() => { onComplete({ reason, note }); setAskingReason(false) }}
              style={btn('gold')}
            >
              Record and complete
            </button>
            <button type="button" onClick={() => setAskingReason(false)} style={btn()}>Cancel</button>
          </div>
          <p style={{ fontSize: '11px', color: T.muted, margin: '8px 0 0' }}>
            This goes to the work log for payment and capacity. It carries no clinical information,
            and it is not a performance measure.
          </p>
        </div>
      )}
    </section>
  )
}
