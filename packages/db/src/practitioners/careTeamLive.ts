// ─── packages/db/src/practitioners/careTeamLive.ts ────────────────────────────
// SPRINT 6 — Care Team live wiring helpers, on the EXISTING architecture.
// Thin wrappers only: every rule is enforced at the database (0056
// eligibility trigger, 0057 lead/class/student triggers + unique index,
// consent machinery, analysis author trigger, release RPCs). These
// helpers surface clear errors and never duplicate the gate logic.
//
// Client approval is NOT a boolean: it is a versioned consent_records row
// with purpose 'practitioner_access', scoped to one practitioner via
// context_practitioner_id, withdrawable through withdraw_own_consent.
// Health-data access stays pack-only (Sprint 5) — nothing here reads
// identified client health data.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createClientPractitionerLink } from './createClientPractitionerLink'
import type { CreateClientPractitionerLinkInput } from './types'
import { CARE_TEAM_APPROVAL_TEXT_VERSION } from '../intakeV2/careTeam'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any>

/** ADMIN ASSIGNS — V1's only assignment path. The 0056 eligibility trigger
 *  and the 0057 lead/class/student rules fire on the INSERT itself. */
export async function adminAssignCareTeamMember(
  adminClient: AnyClient,
  input: Omit<CreateClientPractitionerLinkInput, 'connectionType' | 'controlLevel' | 'creationActor'> &
    Partial<Pick<CreateClientPractitionerLinkInput, 'connectionType' | 'controlLevel' | 'creationActor'>>,
): Promise<string> {
  return createClientPractitionerLink(adminClient as Parameters<typeof createClientPractitionerLink>[0], {
    connectionType: 'assigned_by_admin',
    controlLevel: 'flexible',
    creationActor: 'admin',
    ...input,
  })
}

/** CLIENT APPROVES — the member records the approval through the EXISTING
 *  consent machinery, as themselves (their own session; RLS own-row insert). */
export async function grantPractitionerAccess(
  memberClient: AnyClient,
  input: { memberId: string; memberEmail: string; practitionerId: string; consentVersion?: string },
): Promise<void> {
  const { error } = await (memberClient as AnyClient)
    .from('consent_records')
    .insert({
      profile_id: input.memberId,
      email: input.memberEmail,
      consent_type: 'practitioner_access',
      consented: true,
      consented_at: new Date().toISOString(),
      consent_version: input.consentVersion ?? CARE_TEAM_APPROVAL_TEXT_VERSION,
      source: 'care_team_approval',
      actor: 'member',
      context_practitioner_id: input.practitionerId,
    })
  if (error) throw new Error(`grantPractitionerAccess failed [${error.code}]: ${error.message}`)
}

/** Withdraw the approval — same RPC as every other granular purpose. */
export async function withdrawPractitionerAccess(
  memberClient: AnyClient, practitionerId: string,
): Promise<number> {
  const { data, error } = await (memberClient as AnyClient)
    .rpc('withdraw_own_consent', {
      p_consent_type: 'practitioner_access',
      p_context_practitioner_id: practitionerId,
    })
  if (error) throw new Error(`withdrawPractitionerAccess failed [${error.code}]: ${error.message}`)
  return (data as number) ?? 0
}

/** PRACTITIONER SEES — assigned clients only, pseudonymous, via the 0057
 *  view (active assignment AND active consent required by the view itself). */
export interface AssignedClientRow {
  link_id: string
  team_role: string
  supervisor_id: string | null
  assigned_at: string
  case_id: string | null
  case_status: string | null
}

export async function listAssignedClients(practitionerClient: AnyClient): Promise<AssignedClientRow[]> {
  const { data, error } = await (practitionerClient as AnyClient)
    .from('practitioner_assigned_clients')
    .select('*')
  if (error) return [] // fail closed: no list on error / pre-0057
  return (data ?? []) as AssignedClientRow[]
}

/** PRACTITIONER CONTRIBUTES — append-only, attributed. RLS requires the
 *  author's own session, an active link and active consent. */
export async function addCaseContribution(
  practitionerClient: AnyClient,
  input: {
    caseId: string; authorId: string; teamRole: string; profession?: string
    kind: 'verification' | 'correction' | 'addition' | 'professional_contribution'
    content: string; source?: string
  },
): Promise<string> {
  const { data, error } = await (practitionerClient as AnyClient)
    .from('case_contributions')
    .insert({
      case_id: input.caseId, author_id: input.authorId, team_role: input.teamRole,
      profession: input.profession ?? null, kind: input.kind,
      content: input.content, source: input.source ?? 'consultation',
    })
    .select('id')
    .single()
  if (error) throw new Error(`addCaseContribution failed [${error.code}]: ${error.message}`)
  return (data as { id: string }).id
}

/** Analysis & Plan authorship — the 0057 trigger is the gate (authenticated
 *  authoring practitioner with active consented non-student involvement). */
export async function writeAnalysisSection(
  practitionerClient: AnyClient,
  input: { caseId: string; section: string; content: string; authorId: string },
): Promise<string> {
  const { data, error } = await (practitionerClient as AnyClient)
    .from('case_analysis_plan')
    .insert({ case_id: input.caseId, section: input.section, content: input.content, author_id: input.authorId })
    .select('id')
    .single()
  if (error) throw new Error(`writeAnalysisSection failed [${error.code}]: ${error.message}`)
  return (data as { id: string }).id
}

/** LEAD COORDINATES — two explicit workflow steps, RPC-only writes. */
export async function recordLeadCoordinationReview(
  leadClient: AnyClient, caseId: string, note?: string,
): Promise<string> {
  const { data, error } = await (leadClient as AnyClient)
    .rpc('record_lead_coordination_review', { p_case_id: caseId, p_note: note ?? null })
  if (error) throw new Error(`recordLeadCoordinationReview failed: ${error.message}`)
  return data as string
}

export async function releaseCarePlan(leadClient: AnyClient, caseId: string): Promise<string> {
  const { data, error } = await (leadClient as AnyClient)
    .rpc('release_care_plan', { p_case_id: caseId })
  if (error) throw new Error(`releaseCarePlan failed: ${error.message}`)
  return data as string
}
