'use client'

// ─── Finish consultation + operational time log ──────────────────────────────
// Board 5.
//
// ── TWO DESTINATIONS, DELIBERATELY SEPARATE ─────────────────────────────────
//
// The overrun reason goes to the OPERATIONAL WORK LOG: practitioner, work
// reference, planned, active, pause, overrun, structured reason. Nothing else.
//
// The clinical note goes to the CASE RECORD, under clinical access controls.
// It is never written to the work log — `onFinish` carries only the structured
// reason, and `toWorkLogEntry` has no parameter a note could travel in.
//
// The log is for payment evidence and capacity planning. NOT for performance
// scoring, and the panel says so where a practitioner will read it.

import { useState } from 'react'
import {
  activeSeconds, pausedSeconds, overrunSeconds, formatDuration, toWorkLogEntry,
  OVERRUN_REASONS, OVERRUN_REASON_LABELS,
  type TimerSession, type OverrunReason,
} from '@natural-intelligence/db/cockpit'
import { C, F, button, eyebrow } from './cockpitTokens'

export function FinishConsultation({
  timer, now, practitionerName, workReference, caseId, onBack, onFinish,
}: {
  timer: TimerSession
  now: string
  practitionerName: string
  workReference: string
  caseId: string
  onBack: () => void
  onFinish: (reason?: OverrunReason) => void
}) {
  const [reason, setReason] = useState<OverrunReason | null>(null)
  const [clinicalNote, setClinicalNote] = useState('')

  const active = activeSeconds(timer, now)
  const paused = pausedSeconds(timer, now)
  const over = overrunSeconds(timer, now)
  const entry = toWorkLogEntry(timer, {
    caseId, practitionerId: 'prac-1', practitionerDisplayName: practitionerName,
    workReference, at: now,
  })

  return (
    <div
      role="dialog"
      aria-label="Finish consultation"
      style={{
        position: 'absolute', inset: 0, zIndex: 60,
        background: 'rgba(38,48,42,.28)', display: 'grid', placeItems: 'center', padding: '32px',
      }}
    >
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px',
        maxWidth: '1100px', width: '100%', maxHeight: '100%', overflowY: 'auto',
      }}>
        {/* ── Finish consultation ──────────────────────────────────────── */}
        <section style={panel}>
          <h2 style={heading}>Finish consultation</h2>
          <p style={{ fontSize: '13.5px', lineHeight: 1.55, color: C.text, margin: 0 }}>
            Active time was <b style={{ fontWeight: 600 }}>{formatDuration(active)}</b>
            {over > 0
              ? `, ${formatDuration(over)} over the planned ${timer.plannedMinutes} minutes. Please note why — this is used for capacity planning, not performance.`
              : `, within the planned ${timer.plannedMinutes} minutes.`}
          </p>

          {over > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {OVERRUN_REASONS.map((r) => (
                <label key={r} style={{
                  display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px',
                  border: `1px solid ${reason === r ? C.pine : C.lineStrong}`,
                  borderRadius: '8px', padding: '10px 12px', cursor: 'pointer',
                }}>
                  <input type="radio" name="overrun" checked={reason === r} onChange={() => setReason(r)} />
                  {OVERRUN_REASON_LABELS[r]}
                </label>
              ))}
            </div>
          )}

          {/* Clinical note — case record, never the work log. */}
          <span style={{ fontSize: '12.5px', fontWeight: 600, color: C.pine }}>
            Clinical note (optional) — saved to the case record, never to the work log
          </span>
          <textarea
            value={clinicalNote}
            onChange={(e) => setClinicalNote(e.target.value)}
            rows={2}
            style={{
              fontSize: '13px', padding: '9px 11px', borderRadius: '8px', fontFamily: F.ui,
              border: `1px solid ${C.lineStrong}`, background: C.warmWhite, color: C.text, resize: 'vertical',
            }}
          />

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button type="button" onClick={onBack} style={button('outline')}>Back to consultation</button>
            <button
              type="button"
              disabled={over > 0 && reason === null}
              onClick={() => onFinish(over > 0 ? reason! : undefined)}
              style={(over > 0 && reason === null)
                ? { ...button('primary'), opacity: 0.55, cursor: 'not-allowed' }
                : button('primary')}
            >
              Finish consultation
            </button>
          </div>
          {over > 0 && reason === null && (
            <span style={{ fontSize: '11.5px', color: C.softText }}>
              An overrun needs a reason from the approved list. It is refused rather than guessed.
            </span>
          )}
        </section>

        {/* ── Operational time log ─────────────────────────────────────── */}
        <section style={panel}>
          <h2 style={heading}>Operational time log</h2>

          {/* Active / paused / overrun as one calm bar. */}
          <div aria-hidden style={{ display: 'flex', height: '14px', borderRadius: '4px', overflow: 'hidden', gap: '2px' }}>
            <span style={{ flex: Math.max(1, active - over), background: C.pine }} />
            {paused > 0 && <span style={{ flex: paused, background: C.lineStrong }} />}
            {over > 0 && <span style={{ flex: over, background: C.gold }} />}
          </div>
          <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: C.softText }}>
            <Legend colour={C.pine} label="Active" />
            {paused > 0 && <Legend colour={C.lineStrong} label="Paused" />}
            {over > 0 && <Legend colour={C.gold} label="Over planned length" />}
          </div>

          <dl style={{ margin: '4px 0 0' }}>
            <Row k="Practitioner" v={entry.practitionerDisplayName} />
            <Row k="Work reference" v={entry.workReference} />
            <Row k="Planned duration" v={formatDuration(entry.plannedMinutes * 60)} />
            <Row k="Active duration" v={formatDuration(entry.activeSeconds)} strong />
            <Row k="Pause duration" v={formatDuration(entry.pauseSeconds)} />
            <Row k="Overrun" v={entry.overran ? `+${formatDuration(entry.overrunSeconds)}` : '—'} />
            <Row k="Overrun reason" v={reason ? OVERRUN_REASON_LABELS[reason] : '—'} />
          </dl>

          <p style={{ fontSize: '12.5px', lineHeight: 1.55, color: C.softText, margin: '6px 0 0' }}>
            Admin, payment and capacity view. Holds no clinical detail; any clinical note stays in the
            case record under clinical access controls.{' '}
            <b style={{ fontWeight: 600, color: C.text }}>Not used for performance scoring.</b>
          </p>
        </section>
      </div>
    </div>
  )
}

const panel: React.CSSProperties = {
  background: C.warmWhite, border: `1px solid ${C.line}`, borderRadius: '12px',
  padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px',
}

const heading: React.CSSProperties = {
  fontFamily: F.display, fontSize: '23px', fontWeight: 600, margin: 0, color: C.botanical,
}

function Legend({ colour, label }: { colour: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      <span aria-hidden style={{ width: '10px', height: '10px', borderRadius: '2px', background: colour }} />
      {label}
    </span>
  )
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: '12px', padding: '7px 0', borderBottom: `1px solid ${C.line}` }}>
      <dt style={{ fontSize: '13px', color: C.softText, minWidth: '160px' }}>{k}</dt>
      <dd style={{ margin: 0, fontSize: '13px', color: C.text, fontWeight: strong ? 600 : 400 }}>{v}</dd>
    </div>
  )
}

export { eyebrow }
