import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import type { ClientTeamMember, LinkRole } from './types'

const FORBIDDEN_FIELDS: ReadonlyArray<string> = [
  'connection_type', 'control_level', 'created_by',
  'creation_actor', 'end_reason', 'notes', 'ended_at',
]

export function assertNoForbiddenFields(member: Record<string, unknown>): void {
  for (const field of FORBIDDEN_FIELDS) {
    if (field in member) throw new Error(`ClientTeamMember must not expose field: ${field}`)
  }
}

export async function getClientTeam(
  adminClient: ReturnType<typeof createClient<Database>>,
  clientId: string,
): Promise<ClientTeamMember[]> {
  const { data, error } = await adminClient
    .from('client_practitioner_links')
    .select(`
      role,
      created_at,
      practitioners (
        id,
        display_name,
        bio,
        credentials_summary,
        specialisations,
        modalities
      )
    `)
    .eq('client_id', clientId)
    .is('ended_at', null)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`getClientTeam failed [${error.code}]: ${error.message}`)

  return (data ?? []).map((row) => {
    const p = row.practitioners as {
      id: string
      display_name: string
      bio: string | null
      credentials_summary: string | null
      specialisations: string[] | null
      modalities: string | null
    } | null

    return {
      practitionerId:     p?.id          ?? '',
      displayName:        p?.display_name ?? '',
      bio:                p?.bio          ?? null,
      credentialsSummary: p?.credentials_summary ?? null,
      specialisations:    p?.specialisations ?? null,
      modalities:         p?.modalities  ?? null,
      role:               row.role as LinkRole,
      linkedAt:           row.created_at,
    }
  })
}
