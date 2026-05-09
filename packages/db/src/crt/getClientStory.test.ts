import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import { getClientStory } from './getClientStory'
import { getOrCreateClientCase } from './getOrCreateClientCase'
import { createReasoningTrace } from './createReasoningTrace'
import { createTestUser, deleteTestUser } from '../practitioners/__test-helpers__/createTestUser'

const HAVE_DB = !!process.env.NEXT_PUBLIC_SUPABASE_URL

function mkAdmin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ─── Unit tests ───────────────────────────────────────────────────────────────

describe('getClientStory — unit', () => {
  it('returns null when no trace exists', async () => {
    const fakeClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({ data: null, error: null }),
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof createClient<Database>>

    const result = await getClientStory(fakeClient, 'member-id')
    expect(result).toBeNull()
  })

  it('throws when the trace query errors', async () => {
    const fakeClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({ data: null, error: { message: 'DB error', code: '500' } }),
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof createClient<Database>>

    await expect(getClientStory(fakeClient, 'member-id')).rejects.toMatchObject({ message: 'DB error' })
  })
})

// ─── Integration tests ────────────────────────────────────────────────────────

describe.skipIf(!HAVE_DB)('getClientStory — integration', () => {
  let admin: ReturnType<typeof mkAdmin>
  let member: Awaited<ReturnType<typeof createTestUser>>
  let caseId: string

  beforeAll(async () => {
    admin = mkAdmin()
    member = await createTestUser(admin, 'crt-gcs')
    caseId = await getOrCreateClientCase(admin, member.id)

    // Write a complete story trace
    await createReasoningTrace(admin, {
      caseId,
      traceType:   'intake_analysis',
      generatedBy: 'ai',
      summary:     'Integration test trace',
      entries: [
        {
          agent_name:  'protocol_builder',
          entry_type:  'client_explanation',
          system_area: 'systems_involved',
          content:     '["digestion","energy"]',
          visibility:  'client',
        },
        {
          agent_name:  'protocol_builder',
          entry_type:  'client_explanation',
          system_area: 'body_story',
          content:     'Your symptoms are not random.',
          visibility:  'client',
        },
        {
          agent_name:  'protocol_builder',
          entry_type:  'client_explanation',
          system_area: 'future_self',
          content:     'In the first few weeks you will feel better.',
          visibility:  'client',
        },
      ],
    })
  })

  afterAll(async () => {
    await admin.from('reasoning_trace_entries').delete().eq('case_id', caseId)
    await admin.from('reasoning_traces').delete().eq('case_id', caseId)
    await admin.from('client_cases').delete().eq('client_id', member.id)
    await deleteTestUser(admin, member.id)
  })

  it('returns null for a member with no trace', async () => {
    const newMember = await createTestUser(admin, 'crt-gcs-empty')
    const result = await getClientStory(admin, newMember.id)
    expect(result).toBeNull()
    await deleteTestUser(admin, newMember.id)
  })

  it('returns a ClientStory with body_story and future_self', async () => {
    const story = await getClientStory(admin, member.id)
    expect(story).not.toBeNull()
    expect(story!.body_story).toBe('Your symptoms are not random.')
    expect(story!.future_self).toBe('In the first few weeks you will feel better.')
  })

  it('parses systems from JSON string', async () => {
    const story = await getClientStory(admin, member.id)
    expect(Array.isArray(story!.systems)).toBe(true)
    expect(story!.systems).toContain('digestion')
    expect(story!.systems).toContain('energy')
  })

  it('returns a generated_at ISO timestamp', async () => {
    const story = await getClientStory(admin, member.id)
    expect(typeof story!.generated_at).toBe('string')
    expect(new Date(story!.generated_at).getTime()).toBeGreaterThan(0)
  })
})
