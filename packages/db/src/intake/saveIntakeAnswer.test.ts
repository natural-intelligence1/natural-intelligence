import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { saveIntakeAnswer } from './saveIntakeAnswer'

// ─── Mock builder ─────────────────────────────────────────────────────────────

/**
 * Builds a minimal Supabase mock that chains .from → .upsert → .select → .single.
 * Pass `resolvedValue` for the final .single() resolution.
 */
function makeMockSupabase(resolvedValue: { data: unknown; error: unknown }) {
  const single  = vi.fn().mockResolvedValue(resolvedValue)
  const select  = vi.fn().mockReturnValue({ single })
  const upsert  = vi.fn().mockReturnValue({ select })
  const from    = vi.fn().mockReturnValue({ upsert })
  return { from, upsert, select, single } as unknown as SupabaseClient & {
    from: ReturnType<typeof vi.fn>
    upsert: ReturnType<typeof vi.fn>
    select: ReturnType<typeof vi.fn>
    single: ReturnType<typeof vi.fn>
  }
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_ROW = {
  id:                 'row-uuid-1',
  session_id:         'session-uuid-1',
  member_id:          'member-uuid-1',
  question_id:        'arrival_emotion',
  section_id:         '0',
  answer:             'calm',
  clinical_objective: 'tone_baseline',
  mapped_systems:     null,
  mapped_hypotheses:  null,
  answered_at:        '2026-05-04T10:00:00Z',
  updated_at:         '2026-05-04T10:00:00Z',
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('saveIntakeAnswer', () => {

  describe('happy path', () => {
    it('returns the row on success', async () => {
      const mock = makeMockSupabase({ data: BASE_ROW, error: null })
      const result = await saveIntakeAnswer(mock, {
        sessionId:         'session-uuid-1',
        questionId:        'arrival_emotion',
        sectionNumber:     0,
        value:             'calm',
        clinicalObjective: 'tone_baseline',
      })
      expect(result).toEqual(BASE_ROW)
    })

    it('calls from with intake_answers table', async () => {
      const mock = makeMockSupabase({ data: BASE_ROW, error: null })
      await saveIntakeAnswer(mock, {
        sessionId:     'session-uuid-1',
        questionId:    'arrival_emotion',
        sectionNumber: 0,
        value:         'calm',
      })
      expect(mock.from).toHaveBeenCalledWith('intake_answers')
    })

    it('converts sectionNumber to section_id string', async () => {
      const mock = makeMockSupabase({ data: BASE_ROW, error: null })
      await saveIntakeAnswer(mock, {
        sessionId:     'session-uuid-1',
        questionId:    'gi_severity',
        sectionNumber: 2,
        value:         7,
      })
      const upsertPayload = mock.upsert.mock.calls[0][0]
      expect(upsertPayload.section_id).toBe('2')
    })
  })

  describe('upsert conflict resolution', () => {
    it('passes onConflict session_id,question_id', async () => {
      const mock = makeMockSupabase({ data: BASE_ROW, error: null })
      await saveIntakeAnswer(mock, {
        sessionId:     's1',
        questionId:    'q1',
        sectionNumber: 0,
        value:         'x',
      })
      const upsertOptions = mock.upsert.mock.calls[0][1]
      expect(upsertOptions.onConflict).toBe('session_id,question_id')
      expect(upsertOptions.ignoreDuplicates).toBe(false)
    })

    it('updated row (upsert) returns new updated_at', async () => {
      const updatedRow = { ...BASE_ROW, answer: 'energised', updated_at: '2026-05-04T11:00:00Z' }
      const mock = makeMockSupabase({ data: updatedRow, error: null })
      const result = await saveIntakeAnswer(mock, {
        sessionId:     'session-uuid-1',
        questionId:    'arrival_emotion',
        sectionNumber: 0,
        value:         'energised',
      })
      expect(result.updated_at).toBe('2026-05-04T11:00:00Z')
      expect(result.answer).toBe('energised')
    })
  })

  describe('partial input', () => {
    it('writes null for missing optional fields', async () => {
      const mock = makeMockSupabase({ data: BASE_ROW, error: null })
      await saveIntakeAnswer(mock, {
        sessionId:     's1',
        questionId:    'q1',
        sectionNumber: 0,
        value:         'x',
        // no clinicalObjective, mappedSystems, mappedHypotheses
      })
      const payload = mock.upsert.mock.calls[0][0]
      expect(payload.clinical_objective).toBeNull()
      expect(payload.mapped_systems).toBeNull()
      expect(payload.mapped_hypotheses).toBeNull()
    })

    it('preserves array value shape (not stringified)', async () => {
      const arrayValue = ['digestive issues', 'poor sleep']
      const rowWithArray = { ...BASE_ROW, answer: arrayValue }
      const mock = makeMockSupabase({ data: rowWithArray, error: null })
      const result = await saveIntakeAnswer(mock, {
        sessionId:     's1',
        questionId:    'primary_concerns',
        sectionNumber: 1,
        value:         arrayValue,
      })
      expect(Array.isArray(result.answer)).toBe(true)
      expect(result.answer).toEqual(arrayValue)
    })
  })

  describe('RLS / error handling', () => {
    it('throws on Supabase error', async () => {
      const mock = makeMockSupabase({
        data:  null,
        error: { code: '42501', message: 'new row violates row-level security policy' },
      })
      await expect(
        saveIntakeAnswer(mock, {
          sessionId:     's1',
          questionId:    'q1',
          sectionNumber: 0,
          value:         'x',
        }),
      ).rejects.toThrow('saveIntakeAnswer failed [42501]')
    })

    it('throws with code unknown when error has no code', async () => {
      const mock = makeMockSupabase({
        data:  null,
        error: { message: 'network error' },
      })
      await expect(
        saveIntakeAnswer(mock, {
          sessionId:     's1',
          questionId:    'q1',
          sectionNumber: 0,
          value:         'x',
        }),
      ).rejects.toThrow('saveIntakeAnswer failed [unknown]')
    })
  })

})
