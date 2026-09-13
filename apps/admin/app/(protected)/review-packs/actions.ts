'use server'

// Sprint 3 — admin-only, server-side review-pack generation. This is the ONLY
// pathway that creates review packs: it runs with the service-role client
// after an explicit admin role check, writes the de-identified pack to the
// practitioner-readable table and the source/audit linkage to the admin-only
// review_pack_audit table. Practitioners have no generation route and no
// access to audit or source fields. Degraded (throws a clear error) until
// migration 0051 is applied.

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'
import { generateAndStoreReviewPack } from '@natural-intelligence/db/practitioners'

async function requireAdmin(): Promise<string> {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')
  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') throw new Error('Admin only')
  return user.id
}

export interface GeneratePackState {
  ok: boolean
  message: string
}

export async function generatePackForCase(
  _prev: GeneratePackState | null,
  formData: FormData,
): Promise<GeneratePackState> {
  let adminId: string
  try {
    adminId = await requireAdmin()
  } catch {
    return { ok: false, message: 'Admin access required.' }
  }

  const caseId = String(formData.get('case_id') ?? '').trim()
  if (!caseId) return { ok: false, message: 'Missing case id.' }

  try {
    const result = await generateAndStoreReviewPack(createAdminClient(), caseId, adminId)
    revalidatePath('/review-packs')
    return {
      ok: true,
      message: `Generated pack ${result.pseudonym} v${result.packVersion} (${result.suppressedCount} fields suppressed).`,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generation failed.'
    return { ok: false, message }
  }
}
