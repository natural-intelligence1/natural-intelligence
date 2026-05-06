import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'

type LinkRow = Database['public']['Tables']['client_practitioner_links']['Row']

export async function listClientLinksForPractitioner(
  adminClient: ReturnType<typeof createClient<Database>>,
  practitionerId: string,
): Promise<LinkRow[]> {
  const { data, error } = await adminClient
    .from('client_practitioner_links')
    .select('*')
    .eq('practitioner_id', practitionerId)
    .is('ended_at', null)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`listClientLinksForPractitioner failed [${error.code}]: ${error.message}`)
  return data ?? []
}
