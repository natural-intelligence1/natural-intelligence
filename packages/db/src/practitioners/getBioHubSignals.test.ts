import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import { getBioHubSignals } from './getBioHubSignals'
import { createTestUser, deleteTestUser } from './__test-helpers__/createTestUser'

const HAVE_DB = !!process.env.NEXT_PUBLIC_SUPABASE_URL

function mkAdmin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ─── Unit tests ───────────────────────────────────────────────────────────────

function mockAdminClient(
  result: { data: unknown[] | null; error: { code: string; message: string } | null },
) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve(result),
        }),
      }),
    }),
  } as unknown as ReturnType<typeof createClient<Database>>
}

describe('getBioHubSignals — unit', () => {
  it('throws when query errors', async () => {
    const client = mockAdminClient({ data: null, error: { code: '42501', message: 'denied' } })
    await expect(getBioHubSignals(client, 'member-1')).rejects.toThrow('getBioHubSignals failed')
  })

  it('returns empty array when no biomarker results', async () => {
    const client = mockAdminClient({ data: [], error: null })
    expect(await getBioHubSignals(client, 'member-1')).toEqual([])
  })

  it('maps a row to BioHubSignal shape', async () => {
    const row = {
      id:             'bm-1',
      marker_name:    'Vitamin D',
      marker_key:     'vitamin_d',
      value:          42.5,
      unit:           'nmol/L',
      functional_zone: 2,
      gp_range_low:   50,
      gp_range_high:  125,
      ni_optimal_low:  80,
      ni_optimal_high: 120,
      lab_reports:    { report_date: '2026-03-15' },
    }
    const client = mockAdminClient({ data: [row], error: null })
    const [result] = await getBioHubSignals(client, 'member-1')
    expect(result.id).toBe('bm-1')
    expect(result.markerName).toBe('Vitamin D')
    expect(result.markerKey).toBe('vitamin_d')
    expect(result.value).toBe(42.5)
    expect(result.unit).toBe('nmol/L')
    expect(result.reportDate).toBe('2026-03-15')
    expect(result.functionalZone).toBe(2)
    expect(result.gpRangeLow).toBe(50)
    expect(result.niOptimalHigh).toBe(120)
  })

  it('handles null lab_reports join gracefully', async () => {
    const row = {
      id: 'bm-2', marker_name: 'Iron', marker_key: null,
      value: 12, unit: 'μmol/L', functional_zone: 1,
      gp_range_low: null, gp_range_high: null, ni_optimal_low: null, ni_optimal_high: null,
      lab_reports: null,
    }
    const client = mockAdminClient({ data: [row], error: null })
    const [result] = await getBioHubSignals(client, 'member-1')
    expect(result.reportDate).toBeNull()
  })
})

// ─── Integration tests ────────────────────────────────────────────────────────

describe.skipIf(!HAVE_DB)('getBioHubSignals — integration', () => {
  let admin:      ReturnType<typeof mkAdmin>
  let memberUser: Awaited<ReturnType<typeof createTestUser>>
  let reportId:   string

  beforeAll(async () => {
    admin      = mkAdmin()
    memberUser = await createTestUser(admin, 'b2-gbhs-member')

    const { data: report } = await admin
      .from('lab_reports')
      .insert({
        member_id:     memberUser.id,
        file_name:     'test-report.pdf',
        file_path:     'tests/test-report.pdf',
        upload_status: 'parsed',
        report_date:   '2026-03-01',
      })
      .select('id')
      .single()
    reportId = report!.id
  })

  afterAll(async () => {
    await admin.from('biomarker_results').delete().eq('member_id', memberUser.id)
    await admin.from('lab_reports').delete().eq('id', reportId)
    await deleteTestUser(admin, memberUser.id)
  })

  it('returns empty array when no biomarker results', async () => {
    const result = await getBioHubSignals(admin, memberUser.id)
    expect(result).toEqual([])
  })

  it('returns biomarker signals after lab upload', async () => {
    await admin.from('biomarker_results').insert({
      member_id:   memberUser.id,
      report_id:   reportId,
      marker_name: 'Vitamin B12',
      marker_key:  'vitamin_b12',
      value:       320,
      unit:        'pmol/L',
      gp_range_low:  148,
      gp_range_high: 616,
    })

    const result = await getBioHubSignals(admin, memberUser.id)
    expect(result.length).toBe(1)
    expect(result[0].markerName).toBe('Vitamin B12')
    expect(result[0].reportDate).toBe('2026-03-01')
  })
})
