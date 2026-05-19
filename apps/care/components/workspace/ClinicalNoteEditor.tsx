'use client'
// ─── ClinicalNoteEditor ───────────────────────────────────────────────────────
// Inline edit affordance for clinical_notes_on_sex inside the Clinical context
// subsection. Renders as a quiet annotation (DM Sans, muted colours) — not a
// primary feature.
//
// States:
//   'idle'    → text + inline "Edit" or "Add clinical note" link
//   'editing' → textarea + Save / Cancel buttons
//   'saving'  → textarea disabled, "Saving…" indicator
//
// Save calls updateClinicalNotesOnSex server action. On success, the local
// note state updates immediately (optimistic re-render — no page reload).
// On failure, returns to 'editing' state with an inline error message and
// the user's draft preserved.

import { useState, useTransition } from 'react'
import { updateClinicalNotesOnSex } from '@/app/cases/actions'
import type { ClinicalNoteUpdateResult } from '@/app/cases/actions'

interface ClinicalNoteEditorProps {
  memberId:    string
  initialNote: string | null
}

type Mode = 'idle' | 'editing' | 'saving'

export function ClinicalNoteEditor({ memberId, initialNote }: ClinicalNoteEditorProps) {
  const [note,  setNote]   = useState<string>(initialNote ?? '')
  const [mode,  setMode]   = useState<Mode>('idle')
  const [draft, setDraft]  = useState<string>(initialNote ?? '')
  const [error, setError]  = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function beginEdit() {
    setDraft(note)
    setError(null)
    setMode('editing')
  }

  function cancel() {
    setDraft(note)        // discard draft
    setError(null)
    setMode('idle')
  }

  function save() {
    setMode('saving')
    setError(null)
    startTransition(async () => {
      let result: ClinicalNoteUpdateResult
      try {
        result = await updateClinicalNotesOnSex(memberId, draft)
      } catch {
        result = { ok: false, code: 'error', message: 'Could not save the note. Please try again.' }
      }
      if (result.ok) {
        setNote(draft)
        setMode('idle')
      } else {
        setError(result.message)
        setMode('editing')
      }
    })
  }

  // ── Idle: show text + inline edit affordance ──────────────────────────────
  if (mode === 'idle') {
    if (note.trim().length === 0) {
      return (
        <div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#8A8880', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Clinical note
          </div>
          <button
            type="button"
            onClick={beginEdit}
            style={{
              background:   'none',
              border:       'none',
              padding:      0,
              fontFamily:   'inherit',
              fontSize:     '12px',
              color:        '#8A8880',
              cursor:       'pointer',
              textDecoration: 'underline',
            }}
          >
            Add clinical note
          </button>
        </div>
      )
    }
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#8A8880', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Clinical note
          </span>
          <button
            type="button"
            onClick={beginEdit}
            style={{
              background:   'none',
              border:       'none',
              padding:      0,
              fontFamily:   'inherit',
              fontSize:     '11px',
              color:        '#8A8880',
              cursor:       'pointer',
              textDecoration: 'underline',
            }}
          >
            Edit
          </button>
        </div>
        <div style={{ fontSize: '12px', color: '#8A8880', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
          {note}
        </div>
      </div>
    )
  }

  // ── Editing / Saving: inline textarea + Save/Cancel ───────────────────────
  return (
    <div>
      <div style={{ fontSize: '11px', fontWeight: 600, color: '#8A8880', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Clinical note
      </div>
      <textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        disabled={mode === 'saving'}
        placeholder="Add a brief clinical note (e.g., trans female on estradiol; pattern intermediate)."
        style={{
          width:        '100%',
          minHeight:    '60px',
          maxHeight:    '200px',
          resize:       'vertical',
          padding:      '6px 8px',
          border:       '1px solid #E8E6E0',
          borderRadius: '4px',
          fontSize:     '12px',
          lineHeight:   '1.5',
          color:        '#1A1917',
          background:   '#FAFAF9',
          boxSizing:    'border-box',
          fontFamily:   'inherit',
          outline:      'none',
        }}
        onFocus={e => { e.target.style.borderColor = '#B8935A' }}
        onBlur ={e => { e.target.style.borderColor = '#E8E6E0' }}
      />
      {error && (
        <p style={{ fontSize: '11px', color: '#991B1B', marginTop: '4px', marginBottom: 0 }}>
          {error}
        </p>
      )}
      <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
        <button
          type="button"
          onClick={save}
          disabled={mode === 'saving'}
          style={{
            padding:      '4px 10px',
            background:   '#1A1917',
            color:        '#FFFFFF',
            border:       'none',
            borderRadius: '4px',
            fontSize:     '11px',
            cursor:       mode === 'saving' ? 'not-allowed' : 'pointer',
            opacity:      mode === 'saving' ? 0.6 : 1,
            fontFamily:   'inherit',
          }}
        >
          {mode === 'saving' ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={mode === 'saving'}
          style={{
            padding:      '4px 10px',
            background:   'transparent',
            color:        '#8A8880',
            border:       '1px solid #E8E6E0',
            borderRadius: '4px',
            fontSize:     '11px',
            cursor:       mode === 'saving' ? 'not-allowed' : 'pointer',
            fontFamily:   'inherit',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
