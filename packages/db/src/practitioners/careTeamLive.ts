// ─── packages/db/src/practitioners/careTeamLive.ts ────────────────────────────
// SPRINT 6 (revised) — Care Team live wiring helpers, on the EXISTING
// architecture. Thin wrappers only: every rule is enforced at the database
// (0056 eligibility trigger, 0057 case_team_roles rules trigger + per-CASE
// lead unique index, consent machinery, analysis author trigger, release
// RPCs). These helpers surface clear errors and never duplicate gate logic.
//
// TWO LEVELS, kept separate:
//   CLIENT level — adminAssignCareTeamMember creates the relationship
//     (client_practitioner_links); grantPractitionerAccess records the
//     client's approval as a versioned consent_records row with purpose
//     'practitioner_access' scoped to one practitioner — NEVER a boolean.
//   CASE level — assignCaseTeamRole gives a practitioner their clinical
//     role (lead / care_team / student) on ONE case; the DB holds exactly
//     one active Lead per case.
//
// TWO MODES, kept separate:
//   Mode 1 (pre-care review) stays the Sprint 5 de-identified pack path —
//     nothing here touches it.
//   Mode 2 (active care) reads ONLY the scoped care_team_health_profile
//     view; raw source tables remain closed to practitioners (0052).

import type { SupabaseClient } from '@supabase/supabase-js'
import { createClientPractitionerLink } from './createClientPractitionerLink'
import type { AssignCaseTeamRoleInput, CreateClientPractitionerLinkInput } from './types'
import { CARE_TEAM_APPROVAL_TEXT_VERSION } from '../intakeV2/careTeam'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any>

// ─── CLIENT LEVEL ─────────────────────────────────────────────────────────────

/** ADMIN ASSIGNS (client level) — creates the relationship record. The 0056
 *  eligibility trigger fires on the INSERT itself. */
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

/** Withdraw the approval — same RPC as every other granular purpose.
 *  Withdrawal removes ALL future Mode 2 access for that practitioner. */
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

// ─── CASE LEVEL ───────────────────────────────────────────────────────────────

/** ADMIN ASSIGNS (case level) — the clinical role on ONE case. The 0057
 *  rules trigger enforces eligibility, the Category-3 lead bar and student
 *  supervision; the partial unique index enforces one active Lead per case. */
export async function assignCaseTeamRole(
  adminClient: AnyClient, input: AssignCaseTeamRoleInput,
): Promise<string> {
  const { data, error } = await (adminClient as AnyClient)
    .from('case_team_roles')
    .insert({
      case_id: input.caseId,
      practitioner_id: input.practitionerId,
      team_role: input.teamRole,
      assigned_by: input.assignedBy,
      ...(input.supervisorId ? { supervisor_id: input.supervisorId } : {}),
    })
    .select('id')
    .single()
  if (error) throw new Error(`assignCaseTeamRole failed [${error.code}]: ${error.message}`)
  return (data as { id: string }).id
}

/** End a case role (role change or off-boarding): the row is history, the
 *  per-case Lead slot frees up, and Mode 2 access ends immediately. */
export async function endCaseTeamRole(
  adminClient: AnyClient, roleId: string, endReason: string,
): Promise<void> {
  const { error } = await (adminClient as AnyClient)
    .from('case_team_roles')
    .update({ ended_at: new Date().toISOString(), end_reason: endReason })
    .eq('id', roleId)
  if (error) throw new Error(`endCaseTeamRole failed [${error.code}]: ${error.message}`)
}

// ─── MODE 2 — the scoped Active Care Health Profile ───────────────────────────

/** Every column the Mode 2 bundle exposes — the single documented surface.
 *  No email, phone or address; no religion or clinical notes on sex; no
 *  other cases or clients. Tests assert rows carry NOTHING beyond this. */
export const CARE_HEALTH_PROFILE_FIELDS = [
  'case_id', 'case_status', 'presenting_concern', 'escalation_required',
  'client_full_name', 'biological_sex',
  'arrival_emotion', 'primary_concerns', 'primary_system',
  'stress_level', 'sleep_quality', 'energy_level',
  'current_medications', 'current_supplements', 'symptom_onset',
  'diagnosed_conditions', 'timeline_last_well', 'timeline_trigger',
  'diet_description', 'most_want_to_understand',
] as const

export type CareHealthProfileRow = Record<(typeof CARE_HEALTH_PROFILE_FIELDS)[number], unknown>

/** Fetch the ONE scoped bundle for a case. The view's WHERE clause is the
 *  authorisation (relationship + case role + eligibility + consent +
 *  supervision) — a null here means "no access", and we never fall back to
 *  raw tables (0052 keeps them closed anyway). */
export async function getCareHealthProfile(
  practitionerClient: AnyClient, caseId: string,
): Promise<CareHealthProfileRow | null> {
  const { data, error } = await (practitionerClient as AnyClient)
    .from('care_team_health_profile')
    .select('*')
    .eq('case_id', caseId)
    .maybeSingle()
  if (error) return null // fail closed: no bundle on error / pre-0057
  return (data as CareHealthProfileRow) ?? null
}

/** PRACTITIONER SEES — their active, consented case assignments only.
 *  (Named distinctly from the legacy work-item listAssignedCases helper.) */
export interface AssignedCaseRow {
  role_id: string
  case_id: string
  team_role: string
  supervisor_id: string | null
  assigned_at: string
  case_status: string | null
  client_full_name: string | null
}

export async function listActiveCareCases(practitionerClient: AnyClient): Promise<AssignedCaseRow[]> {
  const { data, error } = await (practitionerClient as AnyClient)
    .from('practitioner_assigned_cases')
    .select('*')
  if (error) return [] // fail closed: no list on error / pre-0057
  return (data ?? []) as AssignedCaseRow[]
}

// ─── Contributions / Analysis / Coordination ─────────────────────────────────

/** PRACTITIONER CONTRIBUTES — append-only, attributed. RLS requires the
 *  author's own session and the full active-care authorisation. */
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
 *  authoring practitioner, active authorised NON-student case role). */
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

/** LEAD COORDINATES — two explicit workflow steps, RPC-only writes; the RPCs
 *  verify the caller is THIS case's active, still-eligible Lead. */
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
