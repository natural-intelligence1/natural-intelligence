// ─── packages/db/src/intakeV2/careTeam.ts ─────────────────────────────────────
// "My Care Team" V1 — the ENTIRE workflow, nothing more:
//   ADMIN ASSIGNS → CLIENT APPROVES → PRACTITIONER CONTRIBUTES → LEAD COORDINATES
//
// This is the canonical MODEL + fail-closed GUARDS. It deliberately reuses
// the existing relationship architecture rather than inventing a parallel
// one: assignments mirror the case_practitioner_work conventions
// (admin-assigned, append-only, status-transitioned, never deleted), the
// student rules reuse governanceControls, professions map onto the
// practitioners table's existing primary_professions values, and the
// health-profile access bundle is the field registry's accessScope.
//
// LIVE-DATA GATE UNCHANGED: nothing here reads or writes real records.
// The Sprint 3 model, INTAKE_ASSIGNMENT_ENABLED (off) and the 0052-era RLS
// work remain the enforcement layer for real clients. Smallest schema
// delta for live use is documented at the foot of this file — NOT applied.
//
// NOT BUILT by design: AI matching, self-assignment, marketplaces,
// per-field permissions, messaging, notification engines.

import { canStudentAccessCase, type V2StudentAccessContext } from './governanceControls'
import { V2_FIELD_REGISTRY, type V2FieldDef } from './fieldRegistry'

// ─── Team role vs profession/modality (kept separate) ────────────────────────

export const CARE_TEAM_ROLES = ['lead', 'care_team', 'student'] as const
export type CareTeamRole = (typeof CARE_TEAM_ROLES)[number]

export const CARE_TEAM_ROLE_LABELS: Record<CareTeamRole, string> = {
  lead: 'Lead Responsible Practitioner',
  care_team: 'Care Team Practitioner',
  student: 'Student Practitioner', // a training status, never a regulatory category
}

/** Display set for profession/modality. Maps onto the EXISTING
 *  practitioners.primary_professions values where present — display only;
 *  regulatory status is NEVER inferred from profession/modality. */
export const PROFESSION_MODALITIES = [
  'Naturopath / Nutritional Therapist',
  'Health Coach',
  'Herbalist',
  'Homeopath',
  'Doctor / GP',
  'Nurse / Nurse Practitioner',
  'Pharmacist',
  'Dietitian',
  'Physiotherapist',
  'Osteopath / Chiropractor',
  'Acupuncturist / TCM Practitioner',
  'Psychologist / Psychotherapist / Counsellor',
  'Dentist / Oral Health Practitioner',
  'Other',
] as const

// ─── Membership lifecycle: Assigned → Pending approval → Active → Ended ──────

export type AssignmentStatus = 'assigned' | 'ended'
export type ClientApprovalStatus = 'pending' | 'approved' | 'withdrawn'

export interface CareTeamMembership {
  practitionerId: string
  practitionerName: string
  profession: (typeof PROFESSION_MODALITIES)[number]
  teamRole: CareTeamRole
  assignment: {
    status: AssignmentStatus
    assignedBy: string // admin user id — ONLY admin assigns in V1
    assignedAt: string
    endedAt?: string
  }
  clientApproval: {
    status: ClientApprovalStatus
    at?: string
    /** Consent record metadata kept UNDER the simple UI. */
    approvalTextVersion?: string
  }
  /** Students only — named supervisor (a practitioner on the platform). */
  supervisorId?: string
  supervisorName?: string
}

/** One simple V1 approval (A5) — a single access decision, versioned. */
export const CARE_TEAM_APPROVAL_TEXT_VERSION = 'care-team-approval.v1-draft'
export const CARE_TEAM_APPROVAL_TEXT =
  'Allow this practitioner to view and contribute to my NI Health Profile.'
export const CARE_TEAM_APPROVAL_EXPLANATION = [
  'The practitioner can view relevant health information shared within NI.',
  'They may add attributed contributions within their permitted role.',
  'Your original information remains preserved.',
  'Activity is recorded.',
  'Access can later be withdrawn, subject to NI’s applicable record-retention obligations.',
] as const

// ─── Fail-closed visibility guards ────────────────────────────────────────────

/** Only an NI admin creates an assignment in V1 — no self-assignment, no
 *  matching engine, no auto team-building. */
export function canCreateAssignment(actorRole: 'ni_admin' | 'practitioner' | 'client' | 'student' | 'ai' | 'automated_job'): boolean {
  return actorRole === 'ni_admin'
}

/** The practitioner appears on the client's team / sees the client listed
 *  ONLY while the admin assignment is active. No assignment = invisible. */
export function isMembershipVisible(membership: CareTeamMembership): boolean {
  return membership.assignment.status === 'assigned'
}

/** Health Profile access needs assignment AND client approval — and for a
 *  student, additionally a named active supervisor. Fail closed. */
export function canAccessHealthProfile(
  membership: CareTeamMembership,
  studentContext?: V2StudentAccessContext,
): boolean {
  if (membership.assignment.status !== 'assigned') return false
  if (membership.clientApproval.status !== 'approved') return false
  if (membership.teamRole === 'student') {
    if (!membership.supervisorId) return false
    if (!studentContext) return false
    return canStudentAccessCase(studentContext)
  }
  return true
}

/** At most ONE active Lead Responsible Practitioner per practitioner-led
 *  case. Returns the reason a proposed lead assignment must be refused. */
export function validateLeadAssignment(team: CareTeamMembership[], proposedRole: CareTeamRole): string | null {
  if (proposedRole !== 'lead') return null
  const activeLead = team.find((member) =>
    member.teamRole === 'lead' && member.assignment.status === 'assigned')
  return activeLead
    ? `A case has exactly one active Lead Responsible Practitioner (currently ${member_name(activeLead)}). End that lead role first.`
    : null
}
const member_name = (member: CareTeamMembership) => member.practitionerName

/** A student can never hold the lead role (and lead cannot be a student). */
export function validateRoleForMembership(membership: Pick<CareTeamMembership, 'teamRole' | 'supervisorId'>): string | null {
  if (membership.teamRole === 'student' && !membership.supervisorId) {
    return 'A Student Practitioner needs a named supervisor before assignment.'
  }
  return null
}

// ─── Lifecycle transitions (pure — history is never deleted) ─────────────────

export function approveMembership(membership: CareTeamMembership, at: string): CareTeamMembership {
  return {
    ...membership,
    clientApproval: { status: 'approved', at, approvalTextVersion: CARE_TEAM_APPROVAL_TEXT_VERSION },
  }
}

export function withdrawMembership(membership: CareTeamMembership, at: string): CareTeamMembership {
  return {
    ...membership,
    clientApproval: { ...membership.clientApproval, status: 'withdrawn', at },
  }
}

/** Ending an assignment removes active visibility; the record itself (and
 *  every contribution made under it) is retained per the retention rules —
 *  nothing is silently deleted. */
export function endAssignment(membership: CareTeamMembership, at: string): CareTeamMembership {
  return {
    ...membership,
    assignment: { ...membership.assignment, status: 'ended', endedAt: at },
  }
}

// ─── Standard Health Profile access bundle (A6 — ONE bundle, no per-field UI) ─

/** V1 practitioner access = every registry field with a synopsis
 *  destination. Operational data (contact details, credentials, internal
 *  admin material) is excluded by the registry itself (exportExcluded /
 *  no synopsis destination) — no per-field configuration exists in V1. */
export function healthProfileAccessBundle(): V2FieldDef[] {
  return V2_FIELD_REGISTRY.filter((field) =>
    field.synopsisSection !== null && field.exportExcluded !== true)
}

// ─── Contribution model (A7): contribute — never overwrite ───────────────────

export interface CareTeamContribution {
  id: string
  contributorId: string
  contributorName: string
  teamRole: CareTeamRole
  profession: (typeof PROFESSION_MODALITIES)[number]
  at: string
  /** 'consultation' | 'client_call' | 'document' | free text source note. */
  source: string
  content: string
}

/** Contributions are APPEND-ONLY: adding never mutates the list it was
 *  given, and there is no update/delete path — a later practitioner can add
 *  their own attributed contribution beside an earlier one, never over it. */
export function addContribution(
  existing: readonly CareTeamContribution[],
  contribution: CareTeamContribution,
): CareTeamContribution[] {
  return [...existing, contribution]
}

// ─── Smallest schema delta for LIVE use (REPORT ONLY — not applied) ──────────
// case_practitioner_work models per-item WORK, not standing membership, and
// its work_type CHECK cannot express a team role. The minimum live delta is
// one small table, arriving only with separate authority as a reviewed
// migration under the Sprint 3 access model:
//   care_team_memberships(
//     id, case_id → client_cases, practitioner_id → practitioners,
//     team_role CHECK in ('lead','care_team','student'),
//     assigned_by → auth.users (admin), assigned_at, ended_at,
//     client_approval_status CHECK in ('pending','approved','withdrawn'),
//     client_approved_at, approval_text_version,
//     supervisor_id → practitioners (required when team_role='student'),
//     UNIQUE partial index: one active lead per case)
// plus fail-closed RLS mirroring the guards above.
