'use client'
// ─── ActionPanel ──────────────────────────────────────────────────────────────
// Sticky right-side action panel for the Case Review Workspace.
//
// B.3 — 5-state inline completion flow (approved / needs_revision):
//   'compose'  → user fills notes / decision / recommendation
//   'confirm'  → summary shown, awaiting final confirmation
//   'loading'  → submitReview in-flight, no interaction
//   'success'  → event recorded, back-to-inbox link shown
//   (errors)   → return to 'compose' with errorBanner set
//
// B.4 — Escalation path:
//   When decision='escalated' is selected, compose state changes shape:
//     • Notes label becomes "Escalation reason" (load-bearing, required)
//     • Five shortcut prefix buttons render above the textarea
//     • Submit gated on non-empty reason (separate from canSubmit)
//   Confirm state shows escalation-specific copy.
//   Success state shows "↑ Escalated · Flagged for admin review."
//   Reload after escalation (status='escalated' from server) renders success
//     state directly — Option A: no event-fetch, copy derived from status prop.
//
// Shortcut prefix semantics (per addendum S6):
//   Clicking a shortcut prepends "[Label] " at the start of the reason field.
//   If the field already starts with a prefix, the new shortcut REPLACES it
//   while preserving the free-text portion. "Other" CLEARS any prefix.
//
// localStorage draft (addendum S8):
//   Key: ni-care:draft:${workItemId}
//   Fields: notes, decision, recommendation, lastSavedAt
//   Cleared only on successful completion (State 3 → 4 transition).

import { useEffect, useRef, useState, useCallback, useTransition } from 'react'
import { submitReview } from '@/app/cases/actions'
import type { SubmitResult } from '@/app/cases/actions'

// ─── Types ────────────────────────────────────────────────────────────────────

type Decision      = 'approved' | 'needs_revision' | 'escalated' | null
type SubmittableDecision = 'approved' | 'needs_revision' | 'escalated'
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

// ─── Escalation prefix logic (addendum S6) ────────────────────────────────────

const ESCALATION_PREFIX_RE = /^\[[^\]]+\]\s*/

// Apply a shortcut prefix to the reason field.
//   label = null  → clear any existing prefix, preserve rest
//   label = "X"   → ensure reason starts with "[X] " followed by existing rest
export function applyEscalationPrefix(current: string, label: string | null): string {
  const match = current.match(ESCALATION_PREFIX_RE)
  const rest  = match ? current.slice(match[0].length) : current
  if (label === null) return rest
  return `[${label}] ${rest}`
}

const ESCALATION_SHORTCUTS: { label: string; prefix: string | null }[] = [
  { label: 'Senior practitioner',  prefix: 'Senior practitioner'  },
  { label: 'Specialist referral',  prefix: 'Specialist referral'  },
  { label: 'GP letter',            prefix: 'GP letter'            },
  { label: 'Urgent safety',        prefix: 'Urgent safety'        },
  { label: 'Other',                prefix: null                   }, // clears prefix
]

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
  escalated:      'Escalated',
}

// Success copy.
//   forStatus='escalated'    → escalation copy regardless of confirmedDecision
//   forStatus='completed'    → use confirmedDecision (set during this session
//                              by State 2→3 click) or fallback for reload
function successCopy(status: string, confirmedDecision: SubmittableDecision | null): string {
  if (status === 'escalated' || confirmedDecision === 'escalated') {
    return '↑ Escalated · Flagged for admin review.'
  }
  if (confirmedDecision === 'approved')       return '✓ Approved · Case event recorded.'
  if (confirmedDecision === 'needs_revision') return '✓ Recorded · Marked for revision.'
  return '✓ Review submitted.'
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ActionPanelProps {
  workItemId: string
  status:     string
  dueAt:      string | null
  startedAt:  string | null
}

const DECISION_OPTIONS: { value: SubmittableDecision; label: string }[] = [
  { value: 'approved',       label: 'Approved' },
  { value: 'needs_revision', label: 'Needs revision' },
  { value: 'escalated',      label: 'Escalate' },
]

export function ActionPanel({ workItemId, status, dueAt, startedAt }: ActionPanelProps) {
  // ── State ──────────────────────────────────────────────────────────────────
  // Initialise to 'success' when the work item is already terminal so the
  // panel renders a done state immediately, without the compose form.
  const isTerminalStatus = status === 'completed' || status === 'escalated'
  const [panelState,        setPanelState]        = useState<PanelState>(
    isTerminalStatus ? 'success' : 'compose',
  )
  const [errorBanner,       setErrorBanner]       = useState<ErrorCode>(null)
  const [notes,             setNotes]             = useState('')
  const [decision,          setDecision]          = useState<Decision>(null)
  const [recommendation,    setRecommendation]    = useState('')
  const [draftMode,         setDraftMode]         = useState<'normal' | 'degraded'>('normal')
  const [multiTabBanner,    setMultiTabBanner]    = useState(false)
  const [confirmedDecision, setConfirmedDecision] = useState<SubmittableDecision | null>(null)

  const [isPending, startTransition] = useTransition()

  const mountTimeSavedAt   = useRef<string | null>(null)
  const lastWriteTimestamp = useRef<string | null>(null)
  const saveTimer          = useRef<ReturnType<typeof setTimeout> | null>(null)
  const notesRef           = useRef<HTMLTextAreaElement | null>(null)

  // ── Mount: load draft ──────────────────────────────────────────────────────
  useEffect(() => {
    if (isTerminalStatus) return

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
  }, [workItemId, isTerminalStatus])

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

  // ── Escalation shortcut click ──────────────────────────────────────────────
  function handleShortcutClick(prefix: string | null) {
    const next = applyEscalationPrefix(notes, prefix)
    setNotes(next)
    setMultiTabBanner(false)
    scheduleSave(next, decision, recommendation)
    // Focus the textarea after applying so the user can keep typing
    requestAnimationFrame(() => {
      notesRef.current?.focus()
      const len = notesRef.current?.value.length ?? 0
      notesRef.current?.setSelectionRange(len, len)
    })
  }

  // ── State machine actions ──────────────────────────────────────────────────

  function handleSubmitClick() {
    if (decision !== 'approved' && decision !== 'needs_revision' && decision !== 'escalated') return
    if (decision === 'escalated' && notes.trim().length === 0) return
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
    : status === 'escalated'  ? 'Escalated'
    : status
  const metaParts: string[] = [humanStatus]
  if (dueAt)     metaParts.push(formatDue(dueAt))
  if (startedAt) metaParts.push(`Started ${formatRelative(startedAt)}`)

  const isEscalating  = decision === 'escalated'
  const charCount     = notes.length
  const reasonOk      = !isEscalating || notes.trim().length > 0
  const canSubmit     = (decision === 'approved' || decision === 'needs_revision' || decision === 'escalated') && reasonOk
  const isInteractive = panelState === 'compose'
  const isEscalationConfirm = confirmedDecision === 'escalated'

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
      {panelState === 'success' && (() => {
        const isEscalatedSuccess = status === 'escalated' || confirmedDecision === 'escalated'
        return (
          <div style={{ padding: '24px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', marginBottom: '12px' }}>
              {isEscalatedSuccess ? '↑' : '✓'}
            </div>
            <p style={{ fontSize: '13px', color: '#1A1917', fontWeight: 500, marginBottom: '8px', lineHeight: '1.4' }}>
              {successCopy(status, confirmedDecision)}
            </p>
            <p style={{ fontSize: '11px', color: '#B0AEA8', marginBottom: '20px', lineHeight: '1.4' }}>
              {isEscalatedSuccess
                ? 'An admin will pick this case up for review.'
                : 'This review is complete. The case event has been recorded.'}
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
        )
      })()}

      {/* ── LOADING state ───────────────────────────────────────────────────── */}
      {panelState === 'loading' && (
        <div style={{ padding: '40px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: '13px', color: '#8A8880' }}>Submitting…</div>
        </div>
      )}

      {/* ── CONFIRM state ───────────────────────────────────────────────────── */}
      {panelState === 'confirm' && confirmedDecision && (
        <div style={{ padding: '16px' }}>
          <p style={{ fontSize: '12px', color: isEscalationConfirm ? '#92400E' : '#8A8880', marginBottom: '12px', lineHeight: '1.5' }}>
            {isEscalationConfirm
              ? 'You are about to escalate this case for admin review.'
              : 'Confirm your decision before submitting.'}
          </p>
          <div style={{
            padding:      '10px 12px',
            background:   isEscalationConfirm ? '#FFFBEB' : '#F4F3F0',
            border:       isEscalationConfirm ? '1px solid #D97706' : 'none',
            borderRadius: '6px',
            marginBottom: '16px',
            fontSize:     '13px',
            color:        '#1A1917',
            fontWeight:   500,
          }}>
            {isEscalationConfirm ? '↑ ' : ''}{DECISION_LABELS[confirmedDecision]}
          </div>
          {notes.trim() && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#8A8880', marginBottom: '4px' }}>
                {isEscalationConfirm ? 'Escalation reason' : 'Notes'}
              </div>
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
              background:   isEscalationConfirm ? '#D97706' : '#1A1917',
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
            {isEscalationConfirm ? 'Confirm and submit' : 'Confirm & submit'}
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
            {isEscalationConfirm ? 'Back to edit' : 'Edit'}
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

          {/* ── Escalation shortcuts (rendered above notes when escalating) ── */}
          {isEscalating && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#8A8880', marginBottom: '6px' }}>
                Reason shortcuts
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {ESCALATION_SHORTCUTS.map(s => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => handleShortcutClick(s.prefix)}
                    style={{
                      padding:      '4px 8px',
                      background:   '#FFFFFF',
                      color:        '#1A1917',
                      border:       '1px solid #E8E6E0',
                      borderRadius: '4px',
                      fontSize:     '11px',
                      cursor:       'pointer',
                      fontFamily:   'inherit',
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Notes / Escalation reason textarea */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#8A8880', marginBottom: '6px' }}>
              {isEscalating ? (
                <>Escalation reason <span style={{ color: '#D97706' }}>*</span></>
              ) : 'Notes'}
            </label>
            <textarea
              ref={notesRef}
              value={notes}
              onChange={e => handleNotesChange(e.target.value)}
              disabled={!isInteractive}
              placeholder={isEscalating
                ? 'What needs admin attention? Use a shortcut above or type freely.'
                : 'Clinical observations, questions, flags.'}
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
              <label
                key={opt.value}
                style={{
                  display:      'flex',
                  alignItems:   'center',
                  gap:          '8px',
                  marginBottom: '6px',
                  cursor:       'pointer',
                  fontSize:     '13px',
                  color:        '#1A1917',
                }}
              >
                <input
                  type="radio"
                  name={`decision-${workItemId}`}
                  value={opt.value}
                  checked={decision === opt.value}
                  onChange={() => handleDecisionChange(opt.value)}
                  style={{ accentColor: opt.value === 'escalated' ? '#D97706' : '#B8935A' }}
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
              title={!canSubmit
                ? (isEscalating
                    ? 'Provide an escalation reason to submit.'
                    : 'Select a decision to continue')
                : undefined}
              style={{
                width:        '100%',
                padding:      '10px 16px',
                background:   isEscalating ? '#D97706' : '#1A1917',
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
              {isEscalating ? 'Escalate for admin review' : 'Complete review'}
            </button>
            {isEscalating && !reasonOk && (
              <p style={{ fontSize: '11px', color: '#B0AEA8', marginTop: '6px', textAlign: 'center' }}>
                Provide an escalation reason to submit.
              </p>
            )}
          </div>
        </div>
      )}
    </aside>
  )
}
