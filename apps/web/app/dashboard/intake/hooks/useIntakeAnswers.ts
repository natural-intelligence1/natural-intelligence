'use client'

// ─── apps/web/app/dashboard/intake/hooks/useIntakeAnswers.ts ─────────────────
// Manages intake session bootstrap, per-answer dual-write to intake_answers,
// and FormState hydration from intake_answers on mount (resume-on-refresh).
//
// Replaces the scattered session/persistAnswer/setForm logic that was spread
// across IntakeForm.tsx. All TODO(post-16.2) dual-write notes live here.

import { useState, useCallback, useEffect, useRef } from 'react'
import type { SupabaseClient }                       from '@supabase/supabase-js'
import {
  saveIntakeAnswer,
  getOrCreateIntakeSession,
  sectionNumberFromId,
} from '@natural-intelligence/db/intake'
import type { SaveIntakeAnswerInput } from '@natural-intelligence/db/intake'
import type { FormState, PersistMeta } from '../types'

// ─── Save status ──────────────────────────────────────────────────────────────

export type SaveStatus = 'idle' | 'saving' | 'error'

// ─── Return type ──────────────────────────────────────────────────────────────

export interface UseIntakeAnswersResult {
  form:           FormState
  setForm:        React.Dispatch<React.SetStateAction<FormState>>
  /** Sync-updates FormState AND fire-and-forgets a write to intake_answers. */
  setAnswer:      (
    questionId:    keyof FormState,
    value:         unknown,
    sectionNumber: number,
    meta?:         PersistMeta,
  ) => void
  sessionId:      string | null
  isHydrating:    boolean
  hydrationError: string | null
  /** Highest section number found in DB rows; 0 when no prior answers. */
  resumeSection:  number
  /** C5.5 — save status for UI indicator */
  saveStatus:     SaveStatus
  /** C5.5 — retry the last failed save */
  retryLastSave:  () => void
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useIntakeAnswers({
  supabase,
  memberId,
  initialForm,
}: {
  supabase:    SupabaseClient
  memberId:    string
  initialForm: FormState
}): UseIntakeAnswersResult {
  const [form,           setForm]           = useState<FormState>(initialForm)
  const [sessionId,      setSessionId]      = useState<string | null>(null)
  const [isHydrating,    setIsHydrating]    = useState(true)
  const [hydrationError, setHydrationError] = useState<string | null>(null)
  const [resumeSection,  setResumeSection]  = useState(0)

  // C5.5 — save status
  const [saveStatus,     setSaveStatus]     = useState<SaveStatus>('idle')

  // Pending save counter — when it drops to 0, transition idle (or error).
  // Using a ref so increment/decrement never cause re-renders on their own.
  const pendingCount  = useRef(0)
  // Timer ref for the 800 ms debounce before "saving" appears in the UI
  const savingTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Stash of the last input for retry
  const lastInput     = useRef<SaveIntakeAnswerInput | null>(null)

  // ── Step 1: Bootstrap session on mount ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    getOrCreateIntakeSession(supabase, memberId)
      .then(session => {
        if (!cancelled) setSessionId(session.id)
      })
      .catch(err => {
        console.error('[useIntakeAnswers] session bootstrap failed', {
          memberId,
          err: err instanceof Error ? err.message : String(err),
        })
        // Legacy mode: saveIntakeSection still fires at section boundaries.
        // Skip hydration — nothing to resume.
        if (!cancelled) setIsHydrating(false)
      })
    return () => { cancelled = true }
  }, [supabase, memberId])

  // ── Step 2: Hydrate FormState from intake_answers once sessionId is known ───
  useEffect(() => {
    if (!sessionId) return
    let cancelled = false

    supabase
      .from('intake_answers')
      .select('question_id, answer, section_id')
      .eq('session_id', sessionId)
      .then(({ data, error }) => {
        if (cancelled) return

        if (error) {
          console.warn('[useIntakeAnswers] hydration query failed', error.message)
          setHydrationError('Could not restore your previous answers. Starting fresh.')
          setIsHydrating(false)
          return
        }

        if (!data || data.length === 0) {
          setIsHydrating(false)
          return
        }

        const patch: Partial<FormState> = {}
        let maxSection = 0

        for (const row of data) {
          const qid = row.question_id as keyof FormState
          // Guard: unknown questionId → skip (warn so it's visible in dev)
          if (!(qid in initialForm)) {
            console.warn(`[useIntakeAnswers] unknown questionId "${qid}" in intake_answers — skipping`)
            continue
          }

          // Resume-hydration shape guard (Remediation Task 2).
          // Some fields are persisted to intake_answers in a different shape
          // than the FormState field expects. The known case:
          //   current_supplements — the Section 5 TagInput persists an ARRAY,
          //   but FormState types it as a comma-joined STRING (and Section 5
          //   reads it with .split(',')). On resume, the raw array overwrote
          //   the string and Section 5 crashed: "current_supplements.split is
          //   not a function". Coerce any answer whose FormState field is a
          //   string but whose stored value is an array into a joined string.
          //   This is generic — it protects every string-typed field from an
          //   array-shaped answer, not just current_supplements.
          const expected = (initialForm as unknown as Record<string, unknown>)[qid]
          let value: unknown = row.answer
          if (typeof expected === 'string' && Array.isArray(value)) {
            value = (value as unknown[]).map(v => String(v).trim()).filter(Boolean).join(', ')
          }
          ;(patch as Record<string, unknown>)[qid] = value
          const sn = sectionNumberFromId(String(row.section_id))
          if (sn > maxSection) maxSection = sn
        }

        setForm(prev => ({ ...prev, ...patch }))
        setResumeSection(maxSection)
        setIsHydrating(false)
      })

    return () => { cancelled = true }
  }, [sessionId, supabase, initialForm])

  // ── Internal save helper ─────────────────────────────────────────────────────
  // Shared by setAnswer and retryLastSave. Manages the debounced status transitions.

  const fireSave = useCallback(
    (input: SaveIntakeAnswerInput) => {
      lastInput.current = input

      // Increment pending; schedule "saving" indicator after 800 ms debounce
      pendingCount.current += 1
      if (savingTimer.current === null) {
        savingTimer.current = setTimeout(() => {
          savingTimer.current = null
          if (pendingCount.current > 0) setSaveStatus('saving')
        }, 800)
      }

      saveIntakeAnswer(supabase, input)
        .then(() => {
          pendingCount.current = Math.max(0, pendingCount.current - 1)
          if (pendingCount.current === 0) setSaveStatus('idle')
        })
        .catch(err => {
          pendingCount.current = Math.max(0, pendingCount.current - 1)
          console.error('[useIntakeAnswers] saveIntakeAnswer failed', {
            questionId:    input.questionId,
            sectionNumber: input.sectionNumber,
            err:           err instanceof Error ? err.message : String(err),
            code:          (err as { code?: string }).code,
          })
          setSaveStatus('error')
        })
    },
    [supabase],
  )

  // ── retryLastSave ───────────────────────────────────────────────────────────
  const retryLastSave = useCallback(() => {
    if (!lastInput.current) return
    setSaveStatus('idle')   // reset before retry so UI can transition again
    fireSave(lastInput.current)
  }, [fireSave])

  // ── setAnswer: sync FormState + fire-and-forget DB write ────────────────────
  // TODO(post-16.2): drop dual-write to legacy intake_responses once the
  // synopsis pipeline reads exclusively from intake_answers.
  const setAnswer = useCallback(
    (
      questionId:    keyof FormState,
      value:         unknown,
      sectionNumber: number,
      meta?:         PersistMeta,
    ) => {
      // Optimistic local update — always immediate, never blocked by DB
      setForm(prev => ({ ...prev, [questionId]: value as FormState[typeof questionId] }))

      if (!sessionId) return   // session not yet bootstrapped; local-only for now

      fireSave({
        sessionId,
        memberId,
        questionId:  questionId as string,
        sectionNumber,
        value,
        ...meta,
      })
    },
    [sessionId, memberId, fireSave],
  )

  return {
    form,
    setForm,
    setAnswer,
    sessionId,
    isHydrating,
    hydrationError,
    resumeSection,
    saveStatus,
    retryLastSave,
  }
}
