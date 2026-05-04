import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getOrCreateIntakeSession } from './getOrCreateIntakeSession'

// ─── Mock builder ─────────────────────────────────────────────────────────────

/**
 * Builds a minimal Supabase mock for the SELECT path:
 *   .from → .select → .eq → .eq → .order → .limit → .maybeSingle
 * And for the INSERT path:
 *   .from → .insert → .select → .single
 *
 * selectResult: what maybeSingle() resolves to
 * insertResult: what single() resolves to after insert (only called if selectResult.data is null)
 */
function makeMockSupabase(
  selectResult: { data: unknown; error: unknown },
  insertResult?: { data: unknown; error: unknown },
) {
  // INSERT chain
  const insertSingle = vi.fn().mockResolvedValue(insertResult ?? { data: null, error: null })
  const insertSelect = vi.fn().mockReturnValue({ single: insertSingle })
  const insert       = vi.fn().mockReturnValue({ select: insertSelect })

  // SELECT chain
  const maybeSingle = vi.fn().mockResolvedValue(selectResult)
  const limit       = vi.fn().mockReturnValue({ maybeSingle })
  const order       = vi.fn().mockReturnValue({ limit })
  const eq2         = vi.fn().mockReturnValue({ order })
  const eq1         = vi.fn().mockReturnValue({ eq: eq2 })
  const selectFn    = vi.fn().mockReturnValue({ eq: eq1 })

  // from() returns different chains based on what's called next
  const from = vi.fn().mockReturnValue({
    select: selectFn,
    insert,
  })

  const client = { from } as unknown as SupabaseClient
  return {
    client,
    mocks: { from, selectFn, eq1, eq2, order, limit, maybeSingle, insert, insertSelect, insertSingle },
  }
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const EXISTING_SESSION = {
  id:                    'session-uuid-existing',
  member_id:             'member-uuid-1',
  status:                'in_progress',
  current_section:       'arrival',
  visible_question_ids:  [],
  answered_question_ids: [],
  completion_percentage: 0,
  red_flag_count:        0,
  primary_system:        null,
  arrival_emotion:       null,
  started_at:            '2026-05-04T09:00:00Z',
  completed_at:          null,
  created_at:            '2026-05-04T09:00:00Z',
  updated_at:            '2026-05-04T09:00:00Z',
}

const NEW_SESSION = {
  ...EXISTING_SESSION,
  id:         'session-uuid-new',
  started_at: '2026-05-04T10:00:00Z',
  created_at: '2026-05-04T10:00:00Z',
  updated_at: '2026-05-04T10:00:00Z',
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getOrCreateIntakeSession', () => {

  describe('existing in-progress session', () => {
    it('returns existing session without inserting', async () => {
      const { client, mocks } = makeMockSupabase(
        { data: EXISTING_SESSION, error: null },
      )
      const result = await getOrCreateIntakeSession(client, 'member-uuid-1')
      expect(result).toEqual(EXISTING_SESSION)
      expect(mocks.insert).not.toHaveBeenCalled()
    })

    it('queries for in_progress status', async () => {
      const { client, mocks } = makeMockSupabase(
        { data: EXISTING_SESSION, error: null },
      )
      await getOrCreateIntakeSession(client, 'member-uuid-1')
      expect(mocks.eq2).toHaveBeenCalledWith('status', 'in_progress')
    })

    it('queries by member_id', async () => {
      const { client, mocks } = makeMockSupabase(
        { data: EXISTING_SESSION, error: null },
      )
      await getOrCreateIntakeSession(client, 'member-uuid-1')
      expect(mocks.eq1).toHaveBeenCalledWith('member_id', 'member-uuid-1')
    })
  })

  describe('no in-progress session exists — create new', () => {
    it('creates a new session when none exists', async () => {
      const { client, mocks } = makeMockSupabase(
        { data: null, error: null },         // maybeSingle → no existing
        { data: NEW_SESSION, error: null },  // insert → new row
      )
      const result = await getOrCreateIntakeSession(client, 'member-uuid-1')
      expect(result).toEqual(NEW_SESSION)
      expect(mocks.insert).toHaveBeenCalledWith({
        member_id: 'member-uuid-1',
        status:    'in_progress',
      })
    })

    it('does NOT return a completed session (creates new instead)', async () => {
      // maybeSingle returns null because completed sessions are filtered by WHERE status='in_progress'
      // The mock correctly returns null for the select, triggering insert.
      const { client, mocks } = makeMockSupabase(
        { data: null, error: null },
        { data: NEW_SESSION, error: null },
      )
      const result = await getOrCreateIntakeSession(client, 'member-uuid-1')
      expect(result.status).toBe('in_progress')
      expect(mocks.insert).toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('throws on select error', async () => {
      const { client } = makeMockSupabase({
        data:  null,
        error: { code: '42501', message: 'RLS violation on select' },
      })
      await expect(
        getOrCreateIntakeSession(client, 'member-uuid-1'),
      ).rejects.toThrow('getOrCreateIntakeSession select failed [42501]')
    })

    it('throws on insert error', async () => {
      const { client } = makeMockSupabase(
        { data: null, error: null },
        { data: null, error: { code: '42501', message: 'RLS violation on insert' } },
      )
      await expect(
        getOrCreateIntakeSession(client, 'member-uuid-1'),
      ).rejects.toThrow('getOrCreateIntakeSession insert failed [42501]')
    })
  })

})
