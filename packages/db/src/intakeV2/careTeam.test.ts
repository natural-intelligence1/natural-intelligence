// ─── My Care Team V1 — lifecycle and fail-closed visibility tests ─────────────

import { describe, it, expect } from 'vitest'
import {
  canCreateAssignment, isMembershipVisible, canAccessHealthProfile,
  validateLeadAssignment, validateRoleForMembership,
  approveMembership, withdrawMembership, endAssignment, addContribution,
  healthProfileAccessBundle, CARE_TEAM_APPROVAL_TEXT, CARE_TEAM_ROLE_LABELS,
  type CareTeamMembership, type CareTeamContribution,
} from './careTeam'

const base: CareTeamMembership = {
  practitionerId: 'pract-1',
  practitionerName: 'Practitioner One',
  profession: 'Naturopath / Nutritional Therapist',
  teamRole: 'care_team',
  assignment: { status: 'assigned', assignedBy: 'admin-1', assignedAt: '2026-09-18T09:00:00Z' },
  clientApproval: { status: 'pending' },
}

const studentContext = {
  clientInformedOfStudent: true, namedSupervisorId: 'pract-1',
  supervisionActive: true, caseInvolvementActive: true,
}

describe('assignment — admin only, fail closed', () => {
  it('ONLY admin can create an assignment in V1 (no self-assignment, no AI, no automation)', () => {
    expect(canCreateAssignment('ni_admin')).toBe(true)
    for (const actor of ['practitioner', 'client', 'student', 'ai', 'automated_job'] as const) {
      expect(canCreateAssignment(actor), actor).toBe(false)
    }
  })

  it('no assignment = no visibility at all', () => {
    const ended = endAssignment(base, '2026-09-19T09:00:00Z')
    expect(isMembershipVisible(base)).toBe(true)
    expect(isMembershipVisible(ended)).toBe(false)
    expect(canAccessHealthProfile(ended)).toBe(false)
  })

  it('assignment WITHOUT client approval = no health-profile access', () => {
    expect(canAccessHealthProfile(base)).toBe(false) // pending approval
  })

  it('assignment + client approval = active relationship with access', () => {
    const active = approveMembership(base, '2026-09-18T10:00:00Z')
    expect(canAccessHealthProfile(active)).toBe(true)
    expect(active.clientApproval.approvalTextVersion).toBeTruthy() // consent metadata kept under the simple UI
  })
})

describe('student — additionally requires a named active supervisor', () => {
  const student: CareTeamMembership = {
    ...base, practitionerId: 'stud-1', practitionerName: 'Student One',
    teamRole: 'student', supervisorId: 'pract-1', supervisorName: 'Practitioner One',
  }

  it('approved student with named active supervisor has access; missing any condition fails closed', () => {
    const approved = approveMembership(student, '2026-09-18T10:00:00Z')
    expect(canAccessHealthProfile(approved, studentContext)).toBe(true)
    expect(canAccessHealthProfile(approved)).toBe(false) // no supervision context
    expect(canAccessHealthProfile(approved, { ...studentContext, supervisionActive: false })).toBe(false)
    expect(canAccessHealthProfile(approveMembership({ ...student, supervisorId: undefined }, '2026-09-18T10:00:00Z'), studentContext)).toBe(false)
  })

  it('a student cannot be assigned without a named supervisor; roles have client-facing labels', () => {
    expect(validateRoleForMembership({ teamRole: 'student', supervisorId: undefined })).toMatch(/supervisor/)
    expect(validateRoleForMembership({ teamRole: 'student', supervisorId: 'pract-1' })).toBeNull()
    expect(CARE_TEAM_ROLE_LABELS.student).toBe('Student Practitioner')
  })
})

describe('lead — at most one active Lead Responsible Practitioner', () => {
  it('refuses a second active lead; allows one after the first lead role ends', () => {
    const lead = { ...base, practitionerId: 'lead-1', practitionerName: 'Lead One', teamRole: 'lead' as const }
    expect(validateLeadAssignment([lead], 'lead')).toMatch(/exactly one active Lead/)
    expect(validateLeadAssignment([lead], 'care_team')).toBeNull()
    expect(validateLeadAssignment([endAssignment(lead, '2026-09-19T09:00:00Z')], 'lead')).toBeNull()
  })
})

describe('ending access — audit history remains', () => {
  it('withdrawal/ending removes active visibility but keeps the record and its history', () => {
    const active = approveMembership(base, '2026-09-18T10:00:00Z')
    const withdrawn = withdrawMembership(active, '2026-09-20T10:00:00Z')
    expect(canAccessHealthProfile(withdrawn)).toBe(false)
    expect(withdrawn.clientApproval.status).toBe('withdrawn')
    expect(withdrawn.assignment.assignedAt).toBe('2026-09-18T09:00:00Z') // history intact
    const ended = endAssignment(active, '2026-09-20T10:00:00Z')
    expect(ended.assignment.endedAt).toBe('2026-09-20T10:00:00Z')
    expect(ended.assignment.assignedBy).toBe('admin-1') // audit retained, nothing deleted
  })
})

describe('contributions — contribute, never overwrite', () => {
  it('contributions are append-only and fully attributed', () => {
    const first: CareTeamContribution = {
      id: 'c1', contributorId: 'pract-1', contributorName: 'Practitioner One',
      teamRole: 'care_team', profession: 'Herbalist', at: '2026-09-18T11:00:00Z',
      source: 'consultation', content: 'Attributed factual contribution.',
    }
    const existing: readonly CareTeamContribution[] = Object.freeze([first])
    const second = { ...first, id: 'c2', contributorId: 'pract-2', contributorName: 'Practitioner Two', content: 'A second, separate contribution.' }
    const next = addContribution(existing, second)
    expect(next).toHaveLength(2)
    expect(next[0]).toEqual(first) // earlier contribution untouched
    expect(existing).toHaveLength(1) // input list not mutated
  })
})

describe('health-profile access bundle — one standard bundle', () => {
  it('includes synopsis-destined health fields and excludes operational data', () => {
    const bundle = healthProfileAccessBundle()
    const ids = bundle.map((field) => field.id)
    expect(ids).toContain('intake.concerns[n].own_words')
    expect(ids).not.toContain('profile.email')
    expect(ids).not.toContain('profile.phone')
    expect(ids).not.toContain('profile.address')
  })

  it('the single approval wording is the simple V1 sentence', () => {
    expect(CARE_TEAM_APPROVAL_TEXT).toBe('Allow this practitioner to view and contribute to my NI Health Profile.')
  })
})
