/**
 * useIntakeAnswers — unit tests
 *
 * Requires: vitest + @testing-library/react + @testing-library/react-hooks
 * Run from the web app once those devDependencies are added.
 *
 * All Supabase calls are mocked; no network traffic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useIntakeAnswers } from './useIntakeAnswers'
import type { FormState } from '../types'

// ─── Mock @natural-intelligence/db ────────────────────────────────────────────

vi.mock('@natural-intelligence/db', () => ({
  saveIntakeAnswer:         vi.fn().mockResolvedValue({}),
  getOrCreateIntakeSession: vi.fn().mockResolvedValue({ id: 'session-uuid-1' }),
  sectionNumberFromId:      (s: string) => parseInt(s, 10),
}))

import { saveIntakeAnswer, getOrCreateIntakeSession } from '@natural-intelligence/db'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSupabaseMock(rows: { question_id: string; answer: unknown; section_id: string }[] = []) {
  const single   = vi.fn()
  const then_fn  = vi.fn((cb: (v: { data: typeof rows; error: null }) => void) => {
    cb({ data: rows, error: null })
    return { catch: vi.fn() }
  })
  const eq       = vi.fn().mockReturnThis()
  const select   = vi.fn().mockReturnValue({ eq, then: then_fn })
  const from     = vi.fn().mockReturnValue({ select, single })
  return { from, select, eq, single } as unknown as import('@supabase/supabase-js').SupabaseClient
}

const INITIAL_FORM: FormState = {
  arrival_emotion:        '',
  primary_concerns:       [],
  concern_duration:       '',
  symptom_pattern:        '',
  systems_reviewed:       [],
  gi_bloating:            null,
  gi_timing:              [],
  gi_severity:            null,
  gi_stool_type:          null,
  energy_low_times:       [],
  energy_curve:           '',
  energy_severity:        null,
  hormonal_symptoms:      [],
  cycle_patterns:         [],
  timeline_last_well:     '',
  timeline_trigger:       '',
  sleep_hours:            null,
  sleep_quality:          null,
  stress_level:           null,
  energy_level:           null,
  exercise_frequency:     '',
  diet_description:       '',
  diagnosed_conditions:   [],
  current_medications:    '',
  current_supplements:    '',
  past_treatments:        '',
  practitioner_types:     [],
  surgeries_or_injuries:  '',
  family_history:         [],
  psychosocial_impact:    '',
  psychosocial_worry:     '',
  psychosocial_supported: '',
  health_goals:           [],
  timeline_expectation:   '',
  biggest_barrier:        '',
  readiness_time:         '',
  readiness_budget:       '',
  readiness_change:       '',
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useIntakeAnswers', () => {

  beforeEach(() => vi.clearAllMocks())

  it('setAnswer updates form state synchronously', async () => {
    const supabase = makeSupabaseMock()
    const { result } = renderHook(() =>
      useIntakeAnswers({ supabase, memberId: 'member-1', initialForm: INITIAL_FORM }),
    )

    act(() => {
      result.current.setAnswer('arrival_emotion', 'calm', 0, { clinicalObjective: 'tone_baseline' })
    })

    expect(result.current.form.arrival_emotion).toBe('calm')
  })

  it('setAnswer triggers saveIntakeAnswer once sessionId is available', async () => {
    const supabase = makeSupabaseMock()
    const { result } = renderHook(() =>
      useIntakeAnswers({ supabase, memberId: 'member-1', initialForm: INITIAL_FORM }),
    )

    // Wait for session bootstrap
    await waitFor(() => expect(result.current.sessionId).toBe('session-uuid-1'))

    act(() => {
      result.current.setAnswer('sleep_hours', 7, 4, { clinicalObjective: 'sleep_quantity' })
    })

    expect(saveIntakeAnswer).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        sessionId:         'session-uuid-1',
        memberId:          'member-1',
        questionId:        'sleep_hours',
        sectionNumber:     4,
        value:             7,
        clinicalObjective: 'sleep_quantity',
      }),
    )
  })

  it('setAnswer error does not throw — logs and continues', async () => {
    vi.mocked(saveIntakeAnswer).mockRejectedValueOnce(new Error('network fail'))
    const supabase = makeSupabaseMock()
    const { result } = renderHook(() =>
      useIntakeAnswers({ supabase, memberId: 'member-1', initialForm: INITIAL_FORM }),
    )

    await waitFor(() => expect(result.current.sessionId).toBeTruthy())

    // Should not throw
    await expect(
      act(() => {
        result.current.setAnswer('arrival_emotion', 'anxious', 0)
      }),
    ).resolves.not.toThrow()
  })

  // TypeScript type test — @ts-expect-error ensures the compiler rejects bad questionIds
  it('rejects invalid questionId at compile time', () => {
    const supabase = makeSupabaseMock()
    const { result } = renderHook(() =>
      useIntakeAnswers({ supabase, memberId: 'member-1', initialForm: INITIAL_FORM }),
    )

    act(() => {
      // @ts-expect-error — 'not_a_real_field' is not keyof FormState
      result.current.setAnswer('not_a_real_field', 'value', 0)
    })
  })

  // ── C5.5: saveStatus transitions ─────────────────────────────────────────────

  it('saveStatus starts as idle', () => {
    const supabase = makeSupabaseMock()
    const { result } = renderHook(() =>
      useIntakeAnswers({ supabase, memberId: 'member-1', initialForm: INITIAL_FORM }),
    )
    expect(result.current.saveStatus).toBe('idle')
  })

  it('saveStatus returns to idle after successful save', async () => {
    vi.mocked(saveIntakeAnswer).mockResolvedValue({} as never)
    const supabase = makeSupabaseMock()
    const { result } = renderHook(() =>
      useIntakeAnswers({ supabase, memberId: 'member-1', initialForm: INITIAL_FORM }),
    )

    await waitFor(() => expect(result.current.sessionId).toBeTruthy())
    act(() => { result.current.setAnswer('arrival_emotion', 'hopeful', 0) })
    await waitFor(() => expect(result.current.saveStatus).toBe('idle'))
  })

  it('saveStatus transitions to saving after 800 ms debounce when save is pending', async () => {
    vi.useFakeTimers()
    // Save never resolves within the timer window
    vi.mocked(saveIntakeAnswer).mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 5000))
    )
    const supabase = makeSupabaseMock()
    const { result } = renderHook(() =>
      useIntakeAnswers({ supabase, memberId: 'member-1', initialForm: INITIAL_FORM }),
    )

    await waitFor(() => expect(result.current.sessionId).toBeTruthy())
    act(() => { result.current.setAnswer('arrival_emotion', 'hopeful', 0) })

    // Before debounce fires — still idle
    expect(result.current.saveStatus).toBe('idle')

    // Advance past 800 ms threshold
    act(() => { vi.advanceTimersByTime(801) })
    expect(result.current.saveStatus).toBe('saving')

    vi.useRealTimers()
  })

  it('saveStatus transitions to error when save fails', async () => {
    vi.mocked(saveIntakeAnswer).mockRejectedValueOnce(new Error('network error'))
    const supabase = makeSupabaseMock()
    const { result } = renderHook(() =>
      useIntakeAnswers({ supabase, memberId: 'member-1', initialForm: INITIAL_FORM }),
    )

    await waitFor(() => expect(result.current.sessionId).toBeTruthy())
    act(() => { result.current.setAnswer('arrival_emotion', 'hopeful', 0) })
    await waitFor(() => expect(result.current.saveStatus).toBe('error'))
  })

  it('retryLastSave re-fires the failed save and returns to idle on success', async () => {
    const spy = vi.mocked(saveIntakeAnswer)
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({} as never)

    const supabase = makeSupabaseMock()
    const { result } = renderHook(() =>
      useIntakeAnswers({ supabase, memberId: 'member-1', initialForm: INITIAL_FORM }),
    )

    await waitFor(() => expect(result.current.sessionId).toBeTruthy())
    act(() => { result.current.setAnswer('arrival_emotion', 'hopeful', 0) })
    await waitFor(() => expect(result.current.saveStatus).toBe('error'))

    act(() => { result.current.retryLastSave() })
    await waitFor(() => expect(result.current.saveStatus).toBe('idle'))

    expect(spy).toHaveBeenCalledTimes(2)
  })

})
