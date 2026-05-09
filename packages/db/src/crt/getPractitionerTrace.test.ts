import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import { getPractitionerTrace } from './getPractitionerTrace'
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

describe('getPractitionerTrace — unit', () => {
  it('returns null when no trace found', async () => {
    const fakeClient = {
      from: () => ({
        select: () => ({
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
    } as unknown as ReturnType<typeof createClient<Database>>

    const result = await getPractitionerTrace(fakeClient, 'case-id')
    expect(result).toBeNull()
  })

  it('throws when the trace query errors', async () => {
    const fakeClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: null, error: { message: 'trace query failed', code: '42P01' } }),
                }),
              }),
            }),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof createClient<Database>>

    await expect(getPractitionerTrace(fakeClient, 'case-id')).rejects.toMatchObject({ message: 'trace query failed' })
  })
})

// ─── Integration tests ────────────────────────────────────────────────────────

describe.skipIf(!HAVE_DB)('getPractitionerTrace — integration', () => {
  let admin: ReturnType<typeof mkAdmin>
  let member: Awaited<ReturnType<typeof createTestUser>>
  let caseId: string
  let traceId: string

  beforeAll(async () => {
    admin = mkAdmin()
    member = await createTestUser(admin, 'crt-gpt')
    caseId = await getOrCreateClientCase(admin, member.id)

    traceId = await createReasoningTrace(admin, {
      caseId,
      traceType:   'intake_analysis',
      generatedBy: 'ai',
      summary:     'Practitioner trace test',
      entries: [
        {
          agent_name:  'case_historian',
          entry_type:  'observation',
          content:     'Persistent fatigue since viral illness',
          visibility:  'practitioner',
          priority:    1,
        },
        {
          agent_name:       'root_cause',
          entry_type:       'hypothesis',
          content:          'Post-viral energy dysregulation',
          system_area:      'energy',
          hypothesis_key:   'post_viral_dysregulation',
          confidence:       0.75,
          visibility:       'practitioner',
          priority:         1,
        },
        {
          agent_name:  'protocol_builder',
          entry_type:  'client_explanation',
          system_area: 'body_story',
          content:     'Your symptoms are not random.',
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

  it('returns null for a case with no trace', async () => {
    const newMember = await createTestUser(admin, 'crt-gpt-empty')
    const newCaseId = await getOrCreateClientCase(admin, newMember.id)
    const result = await getPractitionerTrace(admin, newCaseId)
    expect(result).toBeNull()
    await admin.from('client_cases').delete().eq('client_id', newMember.id)
    await deleteTestUser(admin, newMember.id)
  })

  it('returns a PractitionerTrace with the correct case id', async () => {
    const trace = await getPractitionerTrace(admin, caseId)
    expect(trace).not.toBeNull()
    expect(trace!.id).toBe(traceId)
    expect(trace!.trace_type).toBe('intake_analysis')
    expect(trace!.generated_by).toBe('ai')
    expect(trace!.summary).toBe('Practitioner trace test')
  })

  it('includes all entries regardless of visibility', async () => {
    const trace = await getPractitionerTrace(admin, caseId)
    expect(trace!.entries.length).toBeGreaterThanOrEqual(3)
  })

  it('includes both practitioner and client visibility entries', async () => {
    const trace = await getPractitionerTrace(admin, caseId)
    const visibilities = trace!.entries.map(e => e.visibility)
    expect(visibilities).toContain('practitioner')
    expect(visibilities).toContain('client')
  })

  it('preserves typed fields on entries', async () => {
    const trace = await getPractitionerTrace(admin, caseId)
    const hyp = trace!.entries.find(e => e.entry_type === 'hypothesis')
    expect(hyp).toBeDefined()
    expect(hyp!.agent_name).toBe('root_cause')
    expect(hyp!.hypothesis_key).toBe('post_viral_dysregulation')
    expect(hyp!.system_area).toBe('energy')
    expect(Number(hyp!.confidence)).toBeCloseTo(0.75)
  })
})
