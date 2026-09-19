import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import type { CreateClientPractitionerLinkInput } from './types'
import { assertPractitionerAssignable } from './credentialing'

export async function createClientPractitionerLink(
  adminClient: ReturnType<typeof createClient<Database>>,
  input: CreateClientPractitionerLinkInput,
): Promise<string> {
  // Sprint 4: same single eligibility path as case work assignment; the
  // 0056 BEFORE INSERT trigger on client_practitioner_links is the backstop.
  await assertPractitionerAssignable(adminClient, input.practitionerId)

  const { data, error } = await adminClient
    .from('client_practitioner_links')
    .insert({
      client_id:       input.clientId,
      practitioner_id: input.practitionerId,
      connection_type: input.connectionType,
      role:            input.role,
      control_level:   input.controlLevel,
      creation_actor:  input.creationActor,
      created_by:      input.createdBy ?? null,
      notes:           input.notes ?? null,
      ...(input.supervisorId ? { supervisor_id: input.supervisorId } : {}),
    } as never)
    .select('id')
    .single()

  if (error) throw new Error(`createClientPractitionerLink failed [${error.code}]: ${error.message}`)
  return data.id
}
