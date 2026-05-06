import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import { updatePractitionerStatus } from './updatePractitionerStatus'
import { createTestUser, deleteTestUser } from './__test-helpers__/createTestUser'

const HAVE_DB = !!process.env.NEXT_PUBLIC_SUPABASE_URL

function mkAdmin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

describe.skipIf(!HAVE_DB)('updatePractitionerStatus', () => {
  let admin: ReturnType<typeof mkAdmin>
  let practitioner: Awaited<ReturnType<typeof createTestUser>>

  beforeAll(async () => {
    admin        = mkAdmin()
    practitioner = await createTestUser(admin, 'g13b-ups-pract')
    await admin.from('practitioners').insert({
      id: practitioner.id, display_name: `Test ${practitioner.email}`, status: 'pending_review',
    })
  })

  afterAll(async () => {
    await admin.from('practitioners').delete().eq('id', practitioner.id)
    await deleteTestUser(admin, practitioner.id)
  })

  it('transitions pending_review → approved', async () => {
    await updatePractitionerStatus(admin, practitioner.id, 'approved')
    const { data } = await admin.from('practitioners').select('status').eq('id', practitioner.id).single()
    expect(data?.status).toBe('approved')
  })

  it('transitions approved → active and sets verified_at when verifiedBy provided', async () => {
    await updatePractitionerStatus(admin, practitioner.id, 'active', { verifiedBy: practitioner.id })
    const { data } = await admin.from('practitioners').select('status, verified_at, verified_by').eq('id', practitioner.id).single()
    expect(data?.status).toBe('active')
    expect(data?.verified_at).not.toBeNull()
    expect(data?.verified_by).toBe(practitioner.id)
  })

  it('transitions active → suspended and sets suspension fields', async () => {
    await updatePractitionerStatus(admin, practitioner.id, 'suspended', {
      suspendedBy:      practitioner.id,
      suspensionReason: 'Policy violation',
    })
    const { data } = await admin.from('practitioners').select('status, suspended_at, suspension_reason').eq('id', practitioner.id).single()
    expect(data?.status).toBe('suspended')
    expect(data?.suspended_at).not.toBeNull()
    expect(data?.suspension_reason).toBe('Policy violation')
  })

  it('transitions → archived and sets archive fields', async () => {
    await updatePractitionerStatus(admin, practitioner.id, 'archived', {
      archivedBy:    practitioner.id,
      archiveReason: 'Account closure',
    })
    const { data } = await admin.from('practitioners').select('status, archived_at, archive_reason').eq('id', practitioner.id).single()
    expect(data?.status).toBe('archived')
    expect(data?.archived_at).not.toBeNull()
    expect(data?.archive_reason).toBe('Account closure')
  })
})
