// ─── packages/db/src/careRecord/caseTeamView.ts ─────────────────────────────
// FLOW 1 WIRED: case_team_roles → Client "My Team" AND Practitioner "Team".
//
// ONE reader, two scopes. Both apps call loadCaseTeam() and then narrow with
// the scope function that fits them. Neither keeps its own copy, and neither
// decides for itself who is on the team — which is the whole point of the
// shared care record contract.
//
// WHAT IS REAL HERE AND WHAT IS NOT
//
// Real: the read path, the role mapping, the Lead rule, the supervisor link,
// and the client/practitioner scope difference. All of it runs against
// case_team_roles as it exists today, with no schema change.
//
// Honestly not real yet: there are currently ZERO rows in case_team_roles,
// and none can be created, because every insert must pass
// practitioner_assignment_eligibility() and all five practitioners fail it
// (class not set, credentials not verified, indemnity missing, scope not
// approved — and agreement acceptance once a class is set, with zero
// agreements published). So both views correctly render "no team recorded
// yet". That empty state is the truth, not a placeholder, and the moment the
// eligibility gate is cleared both surfaces populate from this one reader
// with no further code.
//
// Also not persisted: CareTeamMembership models a clientApproval lifecycle
// that case_team_roles has no column for. Rather than invent a value, this
// reader reports it as unrecorded — see CLIENT_APPROVAL_UNRECORDED.

import type { SupabaseClient } from '@supabase/supabase-js'
import { CARE_TEAM_ROLE_LABELS, type CareTeamRole } from '../intakeV2/careTeam'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any>

/**
 * case_team_roles has no client-approval column, and this reader says so
 * rather than defaulting to 'approved' and implying a consent nobody recorded.
 *
 * 'unrecorded' means NOT RECORDED YET, not NOWHERE TO RECORD IT. The store
 * already exists and needs no migration:
 *
 *   consent_records, consent_type = 'practitioner_access'   (in the CHECK)
 *                    context_practitioner_id                (the column)
 *                    "Members create own consent records"   (the INSERT policy)
 *
 * Zero practitioner_access rows exist today, and no code reads or writes
 * them. Two things must change in the consent module before anything does:
 * 'practitioner_access' is absent from CONSENT_PURPOSES, and hasActiveConsent
 * filters on profile_id + consent_type ALONE — so used as-is for this purpose
 * it would report a client who approved one practitioner as having approved
 * any practitioner. The missing purpose is currently what stops that.
 */
export const CLIENT_APPROVAL_UNRECORDED = 'unrecorded' as const

export interface CaseTeamMember {
  practitionerId: string
  /** practitioners.display_name, or a neutral fallback. Never a legal name
   *  pulled from profiles. */
  displayName: string
  teamRole: CareTeamRole
  roleLabel: string
  /** True only while the role is active (ended_at IS NULL). */
  active: boolean
  startedAt: string
  endedAt: string | null
  endReason: string | null
  /** Students only. The database refuses a student role without one. */
  supervisorId: string | null
  supervisorName: string | null
  /** Who made the assignment — admin only in V1. */
  assignedBy: string
  clientApproval: typeof CLIENT_APPROVAL_UNRECORDED
}

interface RawRow {
  practitioner_id: string
  team_role: string
  supervisor_id: string | null
  assigned_by: string
  started_at: string
  ended_at: string | null
  end_reason: string | null
}

/**
 * Every role ever held on this case, active or ended, newest first.
 *
 * Deliberately unfiltered: the scope functions below decide what each
 * audience sees. A reader that pre-filtered would make the client and
 * practitioner views diverge here rather than at the point where the
 * difference is actually intended.
 */
export async function loadCaseTeam(
  client: AnyClient,
  caseId: string,
): Promise<CaseTeamMember[]> {
  const { data: roles, error } = await client
    .from('case_team_roles')
    .select('practitioner_id, team_role, supervisor_id, assigned_by, started_at, ended_at, end_reason')
    .eq('case_id', caseId)
    .order('started_at', { ascending: false })
  if (error) throw new Error(`loadCaseTeam failed [${error.code}]: ${error.message}`)

  const rows = (roles ?? []) as RawRow[]
  if (rows.length === 0) return []

  // One lookup for every practitioner and supervisor named on the case.
  const ids = [...new Set(rows.flatMap((r) => [r.practitioner_id, r.supervisor_id].filter((x): x is string => !!x)))]
  const { data: people } = await client
    .from('practitioners')
    .select('id, display_name')
    .in('id', ids)

  const nameOf = new Map<string, string>(
    ((people ?? []) as Array<{ id: string; display_name: string | null }>)
      .map((p) => [p.id, p.display_name?.trim() || 'Practitioner']),
  )

  return rows.map((r) => ({
    practitionerId: r.practitioner_id,
    displayName: nameOf.get(r.practitioner_id) ?? 'Practitioner',
    teamRole: r.team_role as CareTeamRole,
    roleLabel: CARE_TEAM_ROLE_LABELS[r.team_role as CareTeamRole] ?? r.team_role,
    active: r.ended_at === null,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    endReason: r.end_reason,
    supervisorId: r.supervisor_id,
    supervisorName: r.supervisor_id ? nameOf.get(r.supervisor_id) ?? 'Supervisor' : null,
    assignedBy: r.assigned_by,
    clientApproval: CLIENT_APPROVAL_UNRECORDED,
  }))
}

/**
 * What the CLIENT sees: only people currently on their team.
 *
 * Ended roles are withheld. A client asking "who can see my record?" is
 * asking about now, and listing practitioners who no longer have access
 * would answer a different question alarmingly.
 */
export function clientVisibleTeam(team: readonly CaseTeamMember[]): CaseTeamMember[] {
  return team.filter((m) => m.active)
}

/**
 * What the PRACTITIONER sees: the full history, active first.
 *
 * Who was involved and when is clinically relevant, so ended roles stay
 * visible here — the one intended difference between the two views.
 */
export function practitionerTeamView(team: readonly CaseTeamMember[]): CaseTeamMember[] {
  return [...team].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1
    return b.startedAt.localeCompare(a.startedAt)
  })
}

/** The one practitioner accountable for the case. Exactly one active Lead is
 *  enforced by the database (0057, 0060), not here — this only finds them. */
export function leadPractitioner(team: readonly CaseTeamMember[]): CaseTeamMember | null {
  return team.find((m) => m.active && m.teamRole === 'lead') ?? null
}

export interface CaseTeamSummary {
  total: number
  active: number
  ended: number
  hasLead: boolean
  students: number
  /** True when there is nothing to show. Distinguishes "no team yet" from a
   *  failed read, so the UI can say which. */
  empty: boolean
}

export function summariseCaseTeam(team: readonly CaseTeamMember[]): CaseTeamSummary {
  const active = team.filter((m) => m.active)
  return {
    total: team.length,
    active: active.length,
    ended: team.length - active.length,
    hasLead: active.some((m) => m.teamRole === 'lead'),
    students: active.filter((m) => m.teamRole === 'student').length,
    empty: team.length === 0,
  }
}
