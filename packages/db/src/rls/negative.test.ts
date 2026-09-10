// Sprint 3 — NEGATIVE RLS tests: prove cross-member and unauthorised
// practitioner access is denied by the EXISTING policies. SYNTHETIC DATA ONLY
// (createTestUser fixtures, is_test_data, self-cleaning). Skip when no DB env.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import { createTestUser, deleteTestUser } from '../practitioners/__test-helpers__/createTestUser'
import { signInAs } from '../practitioners/__test-helpers__/signInAs'

const HAVE_DB = !!process.env.NEXT_PUBLIC_SUPABASE_URL
function mkAdmin() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

describe.skipIf(!HAVE_DB)('negative RLS — cross-member and unauthorised practitioner access', () => {
  let admin: ReturnType<typeof mkAdmin>
  let memberA: Awaited<ReturnType<typeof createTestUser>>
  let memberB: Awaited<ReturnType<typeof createTestUser>>
  let strangerPract: Awaited<ReturnType<typeof createTestUser>>

  beforeAll(async () => {
    admin = mkAdmin()
    memberA = await createTestUser(admin, 's3-rls-member-a')
    memberB = await createTestUser(admin, 's3-rls-member-b')
    strangerPract = await createTestUser(admin, 's3-rls-stranger-pract')
    // stranger is a real practitioner row but has NO work item for member A
    await admin.from('practitioners').insert({
      id: strangerPract.id, display_name: `Test ${strangerPract.email}`, status: 'active',
    })
    // seed synthetic rows AS member A (member insert path is the by-design own-row write)
    const a = await signInAs(memberA)
    await a.from('intake_responses').insert({ member_id: memberA.id, completed_sections: 1 })
    await a.from('lifetracker_goals').insert({ member_id: memberA.id, description: 'synthetic goal', status: 'active' } as never)
  })

  afterAll(async () => {
    await admin.from('intake_responses').delete().eq('member_id', memberA.id)
    await admin.from('lifetracker_goals').delete().eq('member_id', memberA.id)
    await admin.from('practitioners').delete().eq('id', strangerPract.id)
    await deleteTestUser(admin, memberA.id)
    await deleteTestUser(admin, memberB.id)
    await deleteTestUser(admin, strangerPract.id)
  })

  it('member B cannot read member A intake_responses', async () => {
    const b = await signInAs(memberB)
    const { data } = await b.from('intake_responses').select('id').eq('member_id', memberA.id)
    expect(data ?? []).toHaveLength(0)
  })

  it('member B cannot update member A intake_responses', async () => {
    const b = await signInAs(memberB)
    const { data } = await b.from('intake_responses')
      .update({ completed_sections: 9 }).eq('member_id', memberA.id).select('id')
    expect(data ?? []).toHaveLength(0)
    const { data: check } = await admin.from('intake_responses')
      .select('completed_sections').eq('member_id', memberA.id).single()
    expect(check?.completed_sections).toBe(1)
  })

  it('member B cannot read member A lifetracker_goals (single-policy table)', async () => {
    const b = await signInAs(memberB)
    const { data } = await b.from('lifetracker_goals').select('id').eq('member_id', memberA.id)
    expect(data ?? []).toHaveLength(0)
  })

  it('member B cannot insert rows AS member A (spoofed member_id)', async () => {
    const b = await signInAs(memberB)
    const { error } = await b.from('lifetracker_goals')
      .insert({ member_id: memberA.id, description: 'spoofed', status: 'active' } as never)
    expect(error).not.toBeNull()
  })

  it('a practitioner with NO work item for member A cannot read their intake', async () => {
    const p = await signInAs(strangerPract)
    const { data } = await p.from('intake_responses').select('id').eq('member_id', memberA.id)
    expect(data ?? []).toHaveLength(0)
  })

  it('a practitioner with NO work item cannot read member A lab_reports', async () => {
    const p = await signInAs(strangerPract)
    const { data } = await p.from('lab_reports').select('id').eq('member_id', memberA.id)
    expect(data ?? []).toHaveLength(0)
  })

  it('an anonymous client reads nothing from intake_responses', async () => {
    const anon = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { data } = await anon.from('intake_responses').select('id').limit(5)
    expect(data ?? []).toHaveLength(0)
  })
})
