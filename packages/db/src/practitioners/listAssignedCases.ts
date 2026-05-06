import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'

type CaseRow = Database['public']['Tables']['client_cases']['Row']

export async function listAssignedCases(
  adminClient: ReturnType<typeof createClient<Database>>,
  practitionerId: string,
): Promise<CaseRow[]> {
  const { data, error } = await adminClient
    .from('case_practitioner_work')
    .select('client_cases(*)')
    .eq('practitioner_id', practitionerId)
    .in('status', ['assigned', 'in_review'])

  if (error) throw new Error(`listAssignedCases failed [${error.code}]: ${error.message}`)

  return (data ?? [])
    .map((row) => (row as { client_cases: CaseRow | null }).client_cases)
    .filter((c): c is CaseRow => c !== null)
}
