'use client'
// ─── ActionPanel ──────────────────────────────────────────────────────────────
// Sticky right-side action panel for the Case Review Workspace.
//
// B.2 scope — read-only except draft state:
//   • Work item metadata display (status, due date, started-at)
//   • Notes textarea (localStorage autosave, 500ms debounce)
//   • Decision radio group (3 options)
//   • Recommendation textarea (optional)
//   • Submit button — DISABLED [B.3]. 50% opacity, cursor: not-allowed.
//     Tooltip: "Select a decision to continue" when no decision.
//
// localStorage draft (addendum S8):
//   Key: ni-care:draft:${workItemId}
//   Fields: notes, decision, recommendation, lastSavedAt
//   Multi-tab detection: amber banner if another tab wrote more recently.
//   Degraded mode: amber banner when localStorage unavailable.

import { useEffect, useRef, useState, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Decision = 'approved' | 'needs_revision' | 'escalated' | null

interface Draft {
  notes:          string
  decision:       Decision
  recommendation: string
  lastSavedAt:    string
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

function draftKey(workItemId: string): string {
  return `ni-care:draft:${workItemId}`
}

function readDraft(workItemId: string): Draft | null {
  try {
    const raw = localStorage.getItem(draftKey(workItemId))
    if (!raw) return null
    return JSON.parse(raw) as Draft
  } catch {
    return null
  }
}

function writeDraft(workItemId: string, draft: Draft): void {
  localStorage.setItem(draftKey(workItemId), JSON.stringify(draft))
}

function isLocalStorageAvailable(): boolean {
  try {
    const k = '__ni_ls_test__'
    localStorage.setItem(k, '1')
    localStorage.removeItem(k)
    return true
  } catch {
    return false
  }
}

// ─── Date formatting ──────────────────────────────────────────────────────────

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  const hrs  = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hrs < 24)  return `${hrs}h ago`
  return `${days}d ago`
}

function formatDue(iso: string): string {
  const future = new Date(iso).getTime() - Date.now()
  if (future < 0) return 'Overdue'
  const hrs  = Math.floor(future / 3_600_000)
  const days = Math.floor(future / 86_400_000)
  if (hrs < 24)  return 'Due today'
  if (days === 1) return 'Due tomorrow'
  if (days <= 7)  return `Due in ${days}d`
  return `Due ${new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ActionPanelProps {
  workItemId: string
  status:     string
  dueAt:      string | null
  startedAt:  string | null
}

const DECISION_OPTIONS: { value: NonNullable<Decision>; label: string }[] = [
  { value: 'approved',       label: 'Approved' },
  { value: 'needs_revision', label: 'Needs revision' },
  { value: 'escalated',      label: 'Escalate' },
]

export function ActionPanel({ workItemId, status, dueAt, startedAt }: ActionPanelProps) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [notes,          setNotes]          = useState('')
  const [decision,       setDecision]       = useState<Decision>(null)
  const [recommendation, setRecommendation] = useState('')
  const [draftMode,      setDraftMode]      = useState<'normal' | 'degraded'>('normal')
  const [multiTabBanner, setMultiTabBanner] = useState(false)

  // Timestamps used for multi-tab detection
  const mountTimeSavedAt  = useRef<string | null>(null)
  const lastWriteTimestamp = useRef<string | null>(null)
  const saveTimer          = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Mount: load draft ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLocalStorageAvailable()) {
      setDraftMode('degraded')
      return
    }

    const existing = readDraft(workItemId)
    if (existing) {
      setNotes(existing.notes ?? '')
      setDecision(existing.decision ?? null)
      setRecommendation(existing.recommendation ?? '')
      mountTimeSavedAt.current    = existing.lastSavedAt
      lastWriteTimestamp.current  = existing.lastSavedAt
    }
  }, [workItemId])

  // ── Debounced save ─────────────────────────────────────────────────────────
  const scheduleSave = useCallback((n: string, d: Decision, r: string) => {
    if (draftMode === 'degraded') return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const now = new Date().toISOString()
      writeDraft(workItemId, { notes: n, decision: d, recommendation: r, lastSavedAt: now })
      lastWriteTimestamp.current = now
    }, 500)
  }, [workItemId, draftMode])

  // ── Multi-tab detection on notes focus ────────────────────────────────────
  function handleFocus() {
    if (draftMode === 'degraded') return
    try {
      const stored = readDraft(workItemId)
      if (!stored || !mountTimeSavedAt.current) return
      const storedTime = new Date(stored.lastSavedAt).getTime()
      const myLastWrite = lastWriteTimestamp.current ? new Date(lastWriteTimestamp.current).getTime() : 0
      if (storedTime > myLastWrite + 2000) {
        setMultiTabBanner(true)
      }
    } catch { /* ignore */ }
  }

  function handleNotesChange(val: string) {
    setNotes(val)
    setMultiTabBanner(false) // dismiss on keystroke
    scheduleSave(val, decision, recommendation)
  }

  function handleDecisionChange(val: Decision) {
    setDecision(val)
    scheduleSave(notes, val, recommendation)
  }

  function handleRecommendationChange(val: string) {
    setRecommendation(val)
    scheduleSave(notes, decision, val)
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const humanStatus = status === 'in_review' ? 'In review' : status === 'assigned' ? 'Assigned' : status
  const metaParts: string[] = [humanStatus]
  if (dueAt)     metaParts.push(formatDue(dueAt))
  if (startedAt) metaParts.push(`Started ${formatRelative(startedAt)}`)

  const charCount = notes.length

  const submitDisabled = true // [B.3] — submission not wired in B.2

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <aside style={{
      position:   'sticky',
      top:        '72px',
      alignSelf:  'flex-start',
      width:      '280px',
      flexShrink: 0,
      border:     '1px solid #E8E6E0',
      borderRadius: '10px',
      background: '#FFFFFF',
      overflow:   'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #E8E6E0', background: '#FAFAF9' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#8A8880', marginBottom: '4px' }}>
          Review Actions
        </div>
        <div style={{ fontSize: '11px', color: '#B0AEA8', lineHeight: '1.4' }}>
          {metaParts.join(' · ')}
        </div>
      </div>

      <div style={{ padding: '16px' }}>

        {/* Degraded draft banner */}
        {draftMode === 'degraded' && (
          <div style={{ marginBottom: '12px', padding: '8px 10px', background: '#FFFBEB', border: '1px solid #D97706', borderRadius: '6px', fontSize: '11px', color: '#92400E', lineHeight: '1.4' }}>
            Draft saving unavailable. Notes will be lost if you navigate away.
          </div>
        )}

        {/* Multi-tab banner */}
        {multiTabBanner && (
          <div style={{ marginBottom: '12px', padding: '8px 10px', background: '#FFFBEB', border: '1px solid #D97706', borderRadius: '6px', fontSize: '11px', color: '#92400E', lineHeight: '1.4' }}>
            This case is open in another tab — edits may conflict.
          </div>
        )}

        {/* Notes textarea */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#8A8880', marginBottom: '6px' }}>
            Notes
          </label>
          <textarea
            value={notes}
            onChange={e => handleNotesChange(e.target.value)}
            placeholder="Clinical observations, questions, flags."
            style={{
              width:     '100%',
              minHeight: '80px',
              maxHeight: '320px',
              resize:    'vertical',
              padding:   '8px 10px',
              border:    '1px solid #E8E6E0',
              borderRadius: '6px',
              fontSize:  '13px',
              lineHeight: '1.5',
              color:     '#1A1917',
              background: '#FAFAF9',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
              outline:   'none',
            }}
            onFocus={e => { e.target.style.borderColor = '#B8935A'; handleFocus() }}
            onBlur={e  => { e.target.style.borderColor = '#E8E6E0' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
            {charCount > 200 && (
              <span style={{ fontSize: '10px', color: '#B0AEA8' }}>{charCount} characters</span>
            )}
            {draftMode === 'normal' && notes.length > 0 && (
              <span style={{ fontSize: '10px', color: '#B0AEA8', marginLeft: 'auto' }}>Saved locally</span>
            )}
          </div>
        </div>

        {/* Decision radio group */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#8A8880', marginBottom: '8px' }}>
            Decision
          </div>
          {DECISION_OPTIONS.map(opt => (
            <label
              key={opt.value}
              style={{
                display:     'flex',
                alignItems:  'center',
                gap:         '8px',
                marginBottom: '6px',
                cursor:      'pointer',
                fontSize:    '13px',
                color:       '#1A1917',
              }}
            >
              <input
                type="radio"
                name={`decision-${workItemId}`}
                value={opt.value}
                checked={decision === opt.value}
                onChange={() => handleDecisionChange(opt.value)}
                style={{ accentColor: '#B8935A' }}
              />
              {opt.label}
            </label>
          ))}
        </div>

        {/* Recommendation */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#8A8880', marginBottom: '6px' }}>
            Recommendation <span style={{ fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea
            value={recommendation}
            onChange={e => handleRecommendationChange(e.target.value)}
            placeholder="Guidance for protocol, follow-up, or next reviewer."
            style={{
              width:     '100%',
              minHeight: '64px',
              maxHeight: '160px',
              resize:    'vertical',
              padding:   '8px 10px',
              border:    '1px solid #E8E6E0',
              borderRadius: '6px',
              fontSize:  '13px',
              lineHeight: '1.5',
              color:     '#1A1917',
              background: '#FAFAF9',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
              outline:   'none',
            }}
            onFocus={e => { e.target.style.borderColor = '#B8935A' }}
            onBlur={e  => { e.target.style.borderColor = '#E8E6E0' }}
          />
        </div>

        {/* Submit — DISABLED [B.3] */}
        <div>
          <button
            disabled={submitDisabled}
            title={!decision ? 'Select a decision to continue' : undefined}
            style={{
              width:     '100%',
              padding:   '10px 16px',
              background: '#1A1917',
              color:     '#FFFFFF',
              border:    'none',
              borderRadius: '6px',
              fontSize:  '13px',
              fontWeight: 500,
              cursor:    'not-allowed',
              opacity:   0.5,
              fontFamily: 'inherit',
            }}
          >
            Complete review
          </button>
          <p style={{ fontSize: '10px', color: '#B0AEA8', textAlign: 'center', marginTop: '6px' }}>
            [B.3] Submission wired in next phase
          </p>
        </div>
      </div>
    </aside>
  )
}
