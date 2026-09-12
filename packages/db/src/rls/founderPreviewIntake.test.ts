// Founder-preview intake allowlist — DB-LAYER negative tests (0053).
// SYNTHETIC DATA ONLY (createTestUser fixtures, self-cleaning).
//
// The hand-crafted-write tests SELF-SKIP until migration 0053 is applied
// (probe: the is_intake_preview_account() function is callable). The
// ai_summaries test runs against the LIVE database TODAY — that table has no
// authenticated write policy, so hand-crafting is already refused.
//
// The POSITIVE allowlisted case is deliberately NOT live-tested: it would
// require authenticating as the real named account's email, and tests must
// never touch a real person's account. The positive path is proven by the
// policy definition (WITH CHECK member_id = auth.uid() AND
// is_intake_preview_account()) plus the founder walkthrough after authorised
// application.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import { createTestUser, deleteTestUser } from '../practitioners/__test-helpers__/createTestUser'
import { signInAs } from '../practitioners/__test-helpers__/signInAs'

const HAVE_DB = !!process.env.NEXT_PUBLIC_SUPABASE_URL
function mkAdmin() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

describe.skipIf(!HAVE_DB)('founder-preview intake allowlist — DB layer (0053)', () => {
  let admin: ReturnType<typeof mkAdmin>
  let member: Awaited<ReturnType<typeof createTestUser>>
  let migrationApplied = false

  beforeAll(async () => {
    admin = mkAdmin()
    member = await createTestUser(admin, 'fp-nonallow-member')
    const m = await signInAs(member)
    // Probe: the allowlist function exists only once 0053 is applied.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const probe = await (m as any).rpc('is_intake_preview_account')
    migrationApplied = !probe.error
  })

  afterAll(async () => {
    // Belt-and-braces cleanup of anything a (pre-migration) run could write.
    await admin.from('intake_answers').delete().eq('member_id', member.id)
    await admin.from('intake_sessions').delete().eq('member_id', member.id)
    await admin.from('intake_responses').delete().eq('member_id', member.id)
    await deleteTestUser(admin, member.id)
  })

  it('the allowlist predicate is FALSE for a non-allowlisted account', async (ctx) => {
    if (!migrationApplied) return ctx.skip()
    const m = await signInAs(member)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (m as any).rpc('is_intake_preview_account')
    expect(error).toBeNull()
    expect(data).toBe(false)
  })

  it('non-allowlisted member cannot hand-craft an own-row intake_responses write', async (ctx) => {
    if (!migrationApplied) return ctx.skip()
    const m = await signInAs(member)
    const { error } = await m.from('intake_responses')
      .insert({ member_id: member.id, completed_sections: 1 })
    expect(error).not.toBeNull()
    const { count } = await admin.from('intake_responses')
      .select('id', { count: 'exact', head: true }).eq('member_id', member.id)
    expect(count ?? 0).toBe(0)
  })

  it('non-allowlisted member cannot hand-craft an own-row intake_sessions write', async (ctx) => {
    if (!migrationApplied) return ctx.skip()
    const m = await signInAs(member)
    const { error } = await m.from('intake_sessions')
      .insert({ member_id: member.id } as never)
    expect(error).not.toBeNull()
  })

  it('non-allowlisted member cannot hand-craft an own-row intake_answers write', async (ctx) => {
    if (!migrationApplied) return ctx.skip()
    // Seed a session via service role so the answers FK (if any) can resolve.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: session } = await (admin as any).from('intake_sessions')
      .insert({ member_id: member.id }).select('id').single()
    const m = await signInAs(member)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (m as any).from('intake_answers')
      .insert({ member_id: member.id, session_id: session?.id ?? null, question_key: 'fp_probe', answer: { v: 1 } })
    expect(error).not.toBeNull()
  })

  it('non-allowlisted member can still READ their own intake rows (no error)', async (ctx) => {
    if (!migrationApplied) return ctx.skip()
    const m = await signInAs(member)
    const { error } = await m.from('intake_responses').select('id').eq('member_id', member.id)
    expect(error).toBeNull()
  })

  it('ai_summaries cannot be hand-crafted by ANY member (runs pre-migration too)', async () => {
    const m = await signInAs(member)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (m as any).from('ai_summaries')
      .insert({ member_id: member.id, summary_type: 'health_synopsis', content: 'forged' })
    expect(error).not.toBeNull()
  })

  it('no assignment or case work exists for the member (assignment off)', async () => {
    const { data: cases } = await admin.from('client_cases').select('id').eq('client_id', member.id)
    expect(cases ?? []).toHaveLength(0)
  })
})
