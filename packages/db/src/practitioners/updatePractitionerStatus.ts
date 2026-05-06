import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import type { PractitionerStatus } from './types'

export async function updatePractitionerStatus(
  adminClient: ReturnType<typeof createClient<Database>>,
  id: string,
  status: PractitionerStatus,
  meta?: {
    verifiedBy?:       string
    suspendedBy?:      string
    suspensionReason?: string
    archivedBy?:       string
    archiveReason?:    string
  },
): Promise<void> {
  const now = new Date().toISOString()

  const patch: Record<string, unknown> = {
    status,
    updated_at: now,
  }

  if (status === 'active' && meta?.verifiedBy) {
    patch.verified_by = meta.verifiedBy
    patch.verified_at = now
  }
  if (status === 'suspended') {
    patch.suspended_by       = meta?.suspendedBy ?? null
    patch.suspended_at       = now
    patch.suspension_reason  = meta?.suspensionReason ?? null
  }
  if (status === 'archived') {
    patch.archived_by    = meta?.archivedBy ?? null
    patch.archived_at    = now
    patch.archive_reason = meta?.archiveReason ?? null
  }

  const { error } = await adminClient
    .from('practitioners')
    .update(patch)
    .eq('id', id)

  if (error) throw new Error(`updatePractitionerStatus failed [${error.code}]: ${error.message}`)
}
