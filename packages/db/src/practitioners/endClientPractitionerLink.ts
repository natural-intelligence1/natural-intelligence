import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import type { EndReason } from './types'

export async function endClientPractitionerLink(
  adminClient: ReturnType<typeof createClient<Database>>,
  linkId: string,
  reason?: EndReason,
): Promise<void> {
  const { error } = await adminClient
    .from('client_practitioner_links')
    .update({
      ended_at:   new Date().toISOString(),
      end_reason: reason ?? null,
    })
    .eq('id', linkId)

  if (error) throw new Error(`endClientPractitionerLink failed [${error.code}]: ${error.message}`)
}
