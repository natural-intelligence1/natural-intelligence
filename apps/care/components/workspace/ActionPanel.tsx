'use client'
// ─── ActionPanel ──────────────────────────────────────────────────────────────
// Sticky right-side action panel for the Case Review Workspace.
//
// B.3 — 5-state inline completion flow:
//
//   'compose'  → user fills notes / decision / recommendation
//   'confirm'  → summary shown, awaiting final confirmation
//   'loading'  → submitReview in-flight, no interaction
//   'success'  → event recorded, back-to-inbox link shown
//   (errors)   → return to 'compose' with errorBanner set
//
// State initialised to 'success' when the server passes status='completed'
// (page reloads after completion — no re-submission possible).
//
// Escalate is rendered but non-interactive: B.4 will wire the escalation path.
//
// localStorage draft (addendum S8):
//   Key: ni-care:draft:${workItemId}
//   Fields: notes, decision, recommendation, lastSavedAt
//   Cleared only on successful completion (State 3 → 4 transition).
//   Multi-tab detection: amber banner if another tab wrote more recently.
//   Degraded mode: amber banner when localStorage unavailable.

import { useEffect, useRef, useState, useCallback, useTransition } from 'react'
import { submitReview } from '@/app/cases/actions'
import type { SubmitResult } from '@/app/cases/actions'

// ─── Types ────────────────────────────────────────────────────────────────────

type Decision      = 'approved' | 'needs_revision' | 'escalated' | null
type SubmittableDecision = 'approved' | 'needs_revision'
type PanelState    = 'compose' | 'confirm' | 'loading' | 'success'
type ErrorCode     = 'generic' | 'auth' | null

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

function clearDraft(workItemId: string): void {
  try { localStorage.removeItem(draftKey(workItemId)) } catch { /* ignore */ }
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

// ─── Decision display helpers ─────────────────────────────────────────────────

const DECISION_LABELS: Record<SubmittableDecision, string> = {
  approved:       'Approved',
  needs_revision: 'Needs revision',
}

function successCopy(decision: SubmittableDecision | null): string {
  if (decision === 'approved')       return '✓ Approved · Case event recorded.'
  if (decision === 'needs_revision') return '✓ Recorded · Marked for revision.'
  return '✓ Review submitted.'
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ActionPanelProps {
  workItemId: string
  status:     string
  dueAt:      string | null
  startedAt:  string | null
}

const DECISION_OPTIONS: { value: NonNullable<Decision>; label: string; b4?: true }[] = [
  { value: 'approved',       label: 'Approved' },
  { value: 'needs_revision', label: 'Needs revision' },
  { value: 'escalated',      label: 'Escalate', b4: true },
]

export function ActionPanel({ workItemId, status, dueAt, startedAt }: ActionPanelProps) {
  // ── State ──────────────────────────────────────────────────────────────────
  // Initialise to 'success' when the work item is already completed so the
  // panel renders a done state immediately, without the compose form.
  const [panelState,       setPanelState]       = useState<PanelState>(
    status === 'completed' ? 'success' : 'compose',
  )
  const [errorBanner,      setErrorBanner]      = useState<ErrorCode>(null)
  const [notes,            setNotes]            = useState('')
  const [decision,         setDecision]         = useState<Decision>(null)
  const [recommendation,   setRecommendation]   = useState('')
  const [draftMode,        setDraftMode]        = useState<'normal' | 'degraded'>('normal')
  const [multiTabBanner,   setMultiTabBanner]   = useState(false)
  // Holds the decision that was confirmed at the confirm-click instant,
  // used both for the RPC call and the success copy message.
  const [confirmedDecision, setConfirmedDecision] = useState<SubmittableDecision | null>(null)

  const [isPending, startTransition] = useTransition()

  // Timestamps used for multi-tab detection
  const mountTimeSavedAt   = useRef<string | null>(null)
  const lastWriteTimestamp = useRef<string | null>(null)
  const saveTimer          = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Mount: load draft ──────────────────────────────────────────────────────
  useEffect(() => {
    if (status === 'completed') return // skip draft restore for completed items

    if (!isLocalStorageAvailable()) {
      setDraftMode('degraded')
      return
    }

    const existing = readDraft(workItemId)
    if (existing) {
      setNotes(existing.notes ?? '')
      setDecision(existing.decision ?? null)
      setRecommendation(existing.recommendation ?? '')
      mountTimeSavedAt.current   = existing.lastSavedAt
      lastWriteTimestamp.current = existing.lastSavedAt
    }
  }, [workItemId, status])

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
      const storedTime  = new Date(stored.lastSavedAt).getTime()
      const myLastWrite = lastWriteTimestamp.current ? new Date(lastWriteTimestamp.current).getTime() : 0
      if (storedTime > myLastWrite + 2000) setMultiTabBanner(true)
    } catch { /* ignore */ }
  }

  function handleNotesChange(val: string) {
    setNotes(val)
    setMultiTabBanner(false)
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

  // ── State machine actions ──────────────────────────────────────────────────

  function handleSubmitClick() {
    // Guard: only 'approved' and 'needs_revision' are submittable in B.3
    if (decision !== 'approved' && decision !== 'needs_revision') return
    setConfirmedDecision(decision)
    setErrorBanner(null)
    setPanelState('confirm')
  }

  function handleBackToEdit() {
    setPanelState('compose')
  }

  function handleConfirm() {
    if (!confirmedDecision) return
    setPanelState('loading')
    startTransition(async () => {
      let result: SubmitResult
      try {
        result = await submitReview(workItemId, confirmedDecision, notes, recommendation)
      } catch {
        result = { ok: false, code: 'error', message: 'Something went wrong. Please try again.' }
      }

      if (result.ok) {
        clearDraft(workItemId)
        setPanelState('success')
      } else {
        setErrorBanner(result.code === 'auth' ? 'auth' : 'generic')
        setPanelState('compose')
      }
    })
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const humanStatus = status === 'in_review' ? 'In review'
    : status === 'assigned'   ? 'Assigned'
    : status === 'completed'  ? 'Completed'
    : status
  const metaParts: string[] = [humanStatus]
  if (dueAt)     metaParts.push(formatDue(dueAt))
  if (startedAt) metaParts.push(`Started ${formatRelative(startedAt)}`)

  const charCount     = notes.length
  const canSubmit     = decision === 'approved' || decision === 'needs_revision'
  const isInteractive = panelState === 'compose'

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <aside style={{
      position:     'sticky',
      top:          '72px',
      alignSelf:    'flex-start',
      width:        '280px',
      flexShrink:   0,
      border:       '1px solid #E8E6E0',
      borderRadius: '10px',
      background:   '#FFFFFF',
      overflow:     'hidden',
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

      {/* ── SUCCESS state ───────────────────────────────────────────────────── */}
      {panelState === 'success' && (
        <div style={{ padding: '24px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '12px' }}>✓</div>
          <p style={{ fontSize: '13px', color: '#1A1917', fontWeight: 500, marginBottom: '8px', lineHeight: '1.4' }}>
            {successCopy(confirmedDecision)}
          </p>
          <p style={{ fontSize: '11px', color: '#B0AEA8', marginBottom: '20px', lineHeight: '1.4' }}>
            This review is complete. The case event has been recorded.
          </p>
          <a
            href="/cases"
            style={{
              display:      'block',
              padding:      '10px 16px',
              background:   '#1A1917',
              color:        '#FFFFFF',
              borderRadius: '6px',
              fontSize:     '13px',
              fontWeight:   500,
              textAlign:    'center',
              textDecoration: 'none',
            }}
          >
            Back to inbox
          </a>
        </div>
      )}

      {/* ── LOADING state ───────────────────────────────────────────────────── */}
      {panelState === 'loading' && (
        <div style={{ padding: '40px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: '13px', color: '#8A8880' }}>Submitting…</div>
        </div>
      )}

      {/* ── CONFIRM state ───────────────────────────────────────────────────── */}
      {panelState === 'confirm' && confirmedDecision && (
        <div style={{ padding: '16px' }}>
          <p style={{ fontSize: '12px', color: '#8A8880', marginBottom: '12px' }}>
            Confirm your decision before submitting.
          </p>
          <div style={{
            padding:      '10px 12px',
            background:   '#F4F3F0',
            borderRadius: '6px',
            marginBottom: '16px',
            fontSize:     '13px',
            color:        '#1A1917',
            fontWeight:   500,
          }}>
            {DECISION_LABELS[confirmedDecision]}
          </div>
          {notes.trim() && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#8A8880', marginBottom: '4px' }}>Notes</div>
              <div style={{ fontSize: '12px', color: '#1A1917', lineHeight: '1.5', maxHeight: '80px', overflow: 'hidden' }}>
                {notes.slice(0, 200)}{notes.length > 200 ? '…' : ''}
              </div>
            </div>
          )}
          {recommendation.trim() && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#8A8880', marginBottom: '4px' }}>Recommendation</div>
              <div style={{ fontSize: '12px', color: '#1A1917', lineHeight: '1.5', maxHeight: '60px', overflow: 'hidden' }}>
                {recommendation.slice(0, 150)}{recommendation.length > 150 ? '…' : ''}
              </div>
            </div>
          )}
          <button
            onClick={handleConfirm}
            style={{
              width:        '100%',
              padding:      '10px 16px',
              background:   '#1A1917',
              color:        '#FFFFFF',
              border:       'none',
              borderRadius: '6px',
              fontSize:     '13px',
              fontWeight:   500,
              cursor:       'pointer',
              fontFamily:   'inherit',
              marginBottom: '8px',
            }}
          >
            Confirm & submit
          </button>
          <button
            onClick={handleBackToEdit}
            style={{
              width:        '100%',
              padding:      '8px 16px',
              background:   'transparent',
              color:        '#8A8880',
              border:       '1px solid #E8E6E0',
              borderRadius: '6px',
              fontSize:     '13px',
              cursor:       'pointer',
              fontFamily:   'inherit',
            }}
          >
            Edit
          </button>
        </div>
      )}

      {/* ── COMPOSE state ───────────────────────────────────────────────────── */}
      {panelState === 'compose' && (
        <div style={{ padding: '16px' }}>

          {/* Error banner — auth */}
          {errorBanner === 'auth' && (
            <div style={{ marginBottom: '12px', padding: '8px 10px', background: '#FEF2F2', border: '1px solid #DC2626', borderRadius: '6px', fontSize: '11px', color: '#991B1B', lineHeight: '1.4' }}>
              Session expired. Please{' '}
              <a href="/auth/login" style={{ color: '#991B1B', textDecoration: 'underline' }}>sign in again</a>
              {' '}to continue.
            </div>
          )}

          {/* Error banner — generic */}
          {errorBanner === 'generic' && (
            <div style={{ marginBottom: '12px', padding: '8px 10px', background: '#FEF2F2', border: '1px solid #DC2626', borderRadius: '6px', fontSize: '11px', color: '#991B1B', lineHeight: '1.4' }}>
              Something went wrong. Please try again.
            </div>
          )}

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
              disabled={!isInteractive}
              placeholder="Clinical observations, questions, flags."
              style={{
                width:        '100%',
                minHeight:    '80px',
                maxHeight:    '320px',
                resize:       'vertical',
                padding:      '8px 10px',
                border:       '1px solid #E8E6E0',
                borderRadius: '6px',
                fontSize:     '13px',
                lineHeight:   '1.5',
                color:        '#1A1917',
                background:   '#FAFAF9',
                boxSizing:    'border-box',
                fontFamily:   'inherit',
                outline:      'none',
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
              <div key={opt.value}>
                <label
                  style={{
                    display:     'flex',
                    alignItems:  'center',
                    gap:         '8px',
                    marginBottom: opt.b4 ? '2px' : '6px',
                    cursor:      opt.b4 ? 'not-allowed' : 'pointer',
                    fontSize:    '13px',
                    color:       opt.b4 ? '#B0AEA8' : '#1A1917',
                  }}
                >
                  <input
                    type="radio"
                    name={`decision-${workItemId}`}
                    value={opt.value}
                    checked={decision === opt.value}
                    onChange={() => !opt.b4 && handleDecisionChange(opt.value)}
                    disabled={!!opt.b4}
                    style={{ accentColor: '#B8935A' }}
                  />
                  {opt.label}
                </label>
                {/* B.4 marker beneath the Escalate option */}
                {opt.b4 && (
                  <p style={{ fontSize: '10px', color: '#B0AEA8', marginTop: 0, marginBottom: '6px', marginLeft: '20px' }}>
                    [B.4] Escalation handling lands in B.4
                  </p>
                )}
              </div>
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
              disabled={!isInteractive}
              placeholder="Guidance for protocol, follow-up, or next reviewer."
              style={{
                width:        '100%',
                minHeight:    '64px',
                maxHeight:    '160px',
                resize:       'vertical',
                padding:      '8px 10px',
                border:       '1px solid #E8E6E0',
                borderRadius: '6px',
                fontSize:     '13px',
                lineHeight:   '1.5',
                color:        '#1A1917',
                background:   '#FAFAF9',
                boxSizing:    'border-box',
                fontFamily:   'inherit',
                outline:      'none',
              }}
              onFocus={e => { e.target.style.borderColor = '#B8935A' }}
              onBlur={e  => { e.target.style.borderColor = '#E8E6E0' }}
            />
          </div>

          {/* Submit */}
          <div>
            <button
              disabled={!canSubmit || isPending}
              onClick={handleSubmitClick}
              title={!canSubmit ? 'Select a decision to continue' : undefined}
              style={{
                width:        '100%',
                padding:      '10px 16px',
                background:   '#1A1917',
                color:        '#FFFFFF',
                border:       'none',
                borderRadius: '6px',
                fontSize:     '13px',
                fontWeight:   500,
                cursor:       canSubmit && !isPending ? 'pointer' : 'not-allowed',
                opacity:      canSubmit && !isPending ? 1 : 0.5,
                fontFamily:   'inherit',
              }}
            >
              Complete review
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}
