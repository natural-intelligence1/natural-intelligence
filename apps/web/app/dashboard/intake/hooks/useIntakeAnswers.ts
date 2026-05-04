'use client'

// ─── apps/web/app/dashboard/intake/hooks/useIntakeAnswers.ts ─────────────────
// Manages intake session bootstrap, per-answer dual-write to intake_answers,
// and FormState hydration from intake_answers on mount (resume-on-refresh).
//
// Replaces the scattered session/persistAnswer/setForm logic that was spread
// across IntakeForm.tsx. All TODO(post-16.2) dual-write notes live here.

import { useState, useCallback, useEffect } from 'react'
import type { SupabaseClient }              from '@supabase/supabase-js'
import {
  saveIntakeAnswer,
  getOrCreateIntakeSession,
  sectionNumberFromId,
} from '@natural-intelligence/db'
import type { FormState, PersistMeta } from '../types'

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
          ;(patch as Record<string, unknown>)[qid] = row.answer
          const sn = sectionNumberFromId(String(row.section_id))
          if (sn > maxSection) maxSection = sn
        }

        setForm(prev => ({ ...prev, ...patch }))
        setResumeSection(maxSection)
        setIsHydrating(false)
      })

    return () => { cancelled = true }
  }, [sessionId, supabase, initialForm])

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

      saveIntakeAnswer(supabase, {
        sessionId,
        memberId,
        questionId:  questionId as string,
        sectionNumber,
        value,
        ...meta,
      }).catch(err => {
        console.error('[useIntakeAnswers] saveIntakeAnswer failed', {
          questionId,
          sectionNumber,
          err:  err instanceof Error ? err.message : String(err),
          code: (err as { code?: string }).code,
        })
      })
    },
    [sessionId, memberId, supabase],
  )

  return {
    form,
    setForm,
    setAnswer,
    sessionId,
    isHydrating,
    hydrationError,
    resumeSection,
  }
}
