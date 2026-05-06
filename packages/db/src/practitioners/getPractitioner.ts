import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'

type PractitionerRow = Database['public']['Tables']['practitioners']['Row']

export async function getPractitioner(
  adminClient: ReturnType<typeof createClient<Database>>,
  id: string,
): Promise<PractitionerRow | null> {
  const { data, error } = await adminClient
    .from('practitioners')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(`getPractitioner failed [${error.code}]: ${error.message}`)
  return data
}
