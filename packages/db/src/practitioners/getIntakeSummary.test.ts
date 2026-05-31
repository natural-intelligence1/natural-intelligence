import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import { getIntakeSummary } from './getIntakeSummary'
import { createTestUser, deleteTestUser } from './__test-helpers__/createTestUser'

const HAVE_DB = !!process.env.NEXT_PUBLIC_SUPABASE_URL

function mkAdmin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ─── Unit tests (always-run, mock client) ─────────────────────────────────────

function mockAdminClient(
  irResult:      { data: unknown | null; error: { code: string; message: string } | null },
  answersResult: { data: unknown[] | null; error: { code: string; message: string } | null },
) {
  let callCount = 0
  return {
    from: () => {
      callCount++
      if (callCount === 1) {
        // intake_responses: .select().eq().order().limit().maybeSingle()
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: () => Promise.resolve(irResult),
                }),
              }),
            }),
          }),
        }
      }
      // intake_answers: .select().eq().in()
      return {
        select: () => ({
          eq: () => ({
            in: () => Promise.resolve(answersResult),
          }),
        }),
      }
    },
  } as unknown as ReturnType<typeof createClient<Database>>
}

describe('getIntakeSummary — unit', () => {
  it('returns null when no intake_responses row exists', async () => {
    const client = mockAdminClient(
      { data: null, error: null },
      { data: [], error: null },
    )
    const result = await getIntakeSummary(client, 'member-id')
    expect(result).toBeNull()
  })

  it('throws when intake_responses query errors', async () => {
    const client = mockAdminClient(
      { data: null, error: { code: '42501', message: 'RLS denied' } },
      { data: [], error: null },
    )
    await expect(getIntakeSummary(client, 'member-id')).rejects.toThrow(
      'getIntakeSummary (responses) failed',
    )
  })

  it('throws when intake_answers query errors', async () => {
    const client = mockAdminClient(
      {
        data: {
          arrival_emotion: 'hopeful', primary_concerns: ['fatigue'],
          primary_system: 'energy', stress_level: 6, sleep_quality: 4,
          energy_level: 3, diet_description: null, current_medications: null,
          current_supplements: null, symptom_onset: null, timeline_last_well: null,
          timeline_trigger: null, diagnosed_conditions: null, is_complete: true,
        },
        error: null,
      },
      { data: null, error: { code: '42501', message: 'timeout' } },
    )
    await expect(getIntakeSummary(client, 'member-id')).rejects.toThrow(
      'getIntakeSummary (answers) failed',
    )
  })

  it('maps a complete intake_responses row to IntakeSummary', async () => {
    const client = mockAdminClient(
      {
        data: {
          arrival_emotion: 'anxious',
          primary_concerns: ['fatigue', 'brain fog'],
          primary_system: 'neurological',
          stress_level: 8,
          sleep_quality: 3,
          energy_level: 2,
          diet_description: 'Mostly whole foods',
          current_medications: 'Levothyroxine 50mcg',
          current_supplements: 'Vitamin D',
          symptom_onset: '2022-01',
          timeline_last_well: '2020-06',
          timeline_trigger: 'Viral illness',
          diagnosed_conditions: ['hypothyroidism'],
          most_want_to_understand: 'Whether my fatigue is connected to my thyroid medication',
          is_complete: true,
        },
        error: null,
      },
      {
        data: [
          { question_id: 'post_exertional_worsening', answer: true },
          { question_id: 'concern_severity_baseline', answer: 7 },
        ],
        error: null,
      },
    )
    const result = await getIntakeSummary(client, 'member-id')
    expect(result).not.toBeNull()
    expect(result!.arrivalEmotion).toBe('anxious')
    // Sprint B Phase 1 — signature question quoted verbatim through the helper.
    expect(result!.mostWantToUnderstand).toBe('Whether my fatigue is connected to my thyroid medication')
    expect(result!.primaryConcerns).toEqual(['fatigue', 'brain fog'])
    expect(result!.primarySystem).toBe('neurological')
    expect(result!.stressLevel).toBe(8)
    expect(result!.sleepQuality).toBe(3)
    expect(result!.energyLevel).toBe(2)
    expect(result!.postExertionalWorsening).toBe(true)
    expect(result!.concernSeverity).toBe(7)
    expect(result!.dietDescription).toBe('Mostly whole foods')
    expect(result!.currentMedications).toBe('Levothyroxine 50mcg')
    expect(result!.diagnosedConditions).toEqual(['hypothyroidism'])
  })

  it('returns null for postExertionalWorsening when answer is absent', async () => {
    const client = mockAdminClient(
      {
        data: {
          arrival_emotion: null, primary_concerns: null, primary_system: null,
          stress_level: null, sleep_quality: null, energy_level: null,
          diet_description: null, current_medications: null, current_supplements: null,
          symptom_onset: null, timeline_last_well: null, timeline_trigger: null,
          diagnosed_conditions: null, is_complete: false,
        },
        error: null,
      },
      { data: [], error: null },
    )
    const result = await getIntakeSummary(client, 'member-id')
    expect(result!.postExertionalWorsening).toBeNull()
    expect(result!.concernSeverity).toBeNull()
    // Sprint B Phase 1 — signature question absent on legacy rows.
    expect(result!.mostWantToUnderstand).toBeNull()
  })
})

// ─── Integration tests ────────────────────────────────────────────────────────

describe.skipIf(!HAVE_DB)('getIntakeSummary — integration', () => {
  let admin:  ReturnType<typeof mkAdmin>
  let member: Awaited<ReturnType<typeof createTestUser>>

  beforeAll(async () => {
    admin  = mkAdmin()
    member = await createTestUser(admin, 'b2-gis-member')
  })

  afterAll(async () => {
    await admin.from('intake_answers').delete().eq('member_id', member.id)
    await admin.from('intake_responses').delete().eq('member_id', member.id)
    await deleteTestUser(admin, member.id)
  })

  it('returns null when no intake data exists', async () => {
    const result = await getIntakeSummary(admin, member.id)
    expect(result).toBeNull()
  })

  it('returns structured summary when intake_responses exists', async () => {
    await admin.from('intake_responses').insert({
      member_id:       member.id,
      arrival_emotion: 'hopeful',
      primary_concerns: ['fatigue'],
      stress_level:    7,
      sleep_quality:   4,
    })

    const result = await getIntakeSummary(admin, member.id)
    expect(result).not.toBeNull()
    expect(result!.arrivalEmotion).toBe('hopeful')
    expect(result!.stressLevel).toBe(7)
    expect(result!.sleepQuality).toBe(4)
    expect(result!.postExertionalWorsening).toBeNull() // no intake_answer row
  })

  it('surfaces post-exertional worsening flag from intake_answers', async () => {
    const { data: session } = await admin
      .from('intake_sessions')
      .insert({ member_id: member.id, status: 'in_progress' })
      .select('id')
      .single()

    await admin.from('intake_answers').insert({
      member_id:   member.id,
      session_id:  session!.id,
      question_id: 'post_exertional_worsening',
      section_id:  'symptoms',
      answer:      true,
    })

    const result = await getIntakeSummary(admin, member.id)
    expect(result!.postExertionalWorsening).toBe(true)
  })
})
