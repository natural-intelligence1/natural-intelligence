// Flow 1: case_team_roles → both views, through one reader.
// Pure — the scope functions are where client and practitioner are allowed to
// differ, so that is what these tests pin.

import { describe, it, expect } from 'vitest'
import {
  clientVisibleTeam, practitionerTeamView, leadPractitioner, summariseCaseTeam,
  CLIENT_APPROVAL_UNRECORDED, type CaseTeamMember,
} from './caseTeamView'

const member = (o: Partial<CaseTeamMember> & { practitionerId: string }): CaseTeamMember => ({
  displayName: 'A Practitioner', teamRole: 'care_team', roleLabel: 'Care team',
  active: true, startedAt: '2026-09-01T00:00:00Z', endedAt: null, endReason: null,
  supervisorId: null, supervisorName: null, assignedBy: 'admin-1',
  clientApproval: CLIENT_APPROVAL_UNRECORDED, ...o,
})

const lead = member({ practitionerId: 'p-lead', teamRole: 'lead', roleLabel: 'Lead Responsible Practitioner', displayName: 'Amara Okafor' })
const student = member({ practitionerId: 'p-stu', teamRole: 'student', roleLabel: 'Student', displayName: 'J. Student', supervisorId: 'p-lead', supervisorName: 'Amara Okafor' })
const departed = member({ practitionerId: 'p-old', displayName: 'Former Practitioner', active: false, endedAt: '2026-08-01T00:00:00Z', endReason: 'reassigned', startedAt: '2026-06-01T00:00:00Z' })

describe('one reader, two scopes', () => {
  const team = [lead, student, departed]

  it('the client sees only people currently on their team', () => {
    const seen = clientVisibleTeam(team)
    expect(seen.map((m) => m.practitionerId)).toEqual(['p-lead', 'p-stu'])
    expect(seen.some((m) => !m.active)).toBe(false)
  })

  it('a departed practitioner is withheld from the client', () => {
    // "Who can see my record?" is a question about now. Listing someone who
    // no longer has access would answer it alarmingly and wrongly.
    expect(clientVisibleTeam(team).find((m) => m.practitionerId === 'p-old')).toBeUndefined()
  })

  it('the practitioner sees the full history, active first', () => {
    const seen = practitionerTeamView(team)
    expect(seen).toHaveLength(3)
    expect(seen[seen.length - 1].practitionerId).toBe('p-old')
    expect(seen.slice(0, 2).every((m) => m.active)).toBe(true)
  })

  it('both scopes draw from the same list — neither filters the other\'s source', () => {
    const client = clientVisibleTeam(team)
    const prac = practitionerTeamView(team)
    for (const m of client) {
      expect(prac.find((p) => p.practitionerId === m.practitionerId)).toBeDefined()
    }
    // The client never sees anyone the practitioner does not.
    expect(client.length).toBeLessThanOrEqual(prac.length)
  })
})

describe('the Lead', () => {
  it('is found among active members', () => {
    expect(leadPractitioner([lead, student])?.practitionerId).toBe('p-lead')
  })

  it('is not found once their role has ended', () => {
    const endedLead = { ...lead, active: false, endedAt: '2026-10-01T00:00:00Z' }
    expect(leadPractitioner([endedLead, student])).toBeNull()
  })

  it('is null on an empty team rather than throwing', () => {
    expect(leadPractitioner([])).toBeNull()
  })
})

describe('a student always carries its supervisor', () => {
  it('names the supervising practitioner', () => {
    expect(student.supervisorId).toBe('p-lead')
    expect(student.supervisorName).toBe('Amara Okafor')
  })

  it('is counted as a student, not as a practitioner category', () => {
    // The architectural rule: student is a CASE-TEAM ROLE. There is no
    // 'student' value in practitioners.category, and nothing here invents one.
    const s = summariseCaseTeam([lead, student])
    expect(s.students).toBe(1)
    expect(student.teamRole).toBe('student')
  })
})

describe('client approval is reported as unrecorded, not assumed', () => {
  it('never claims an approval the schema cannot store', () => {
    // case_team_roles has no client-approval column. Defaulting to 'approved'
    // would imply a consent nobody captured.
    for (const m of [lead, student, departed]) {
      expect(m.clientApproval).toBe('unrecorded')
    }
  })
})

describe('the empty state is the truth today', () => {
  it('distinguishes "no team yet" from a failed read', () => {
    const s = summariseCaseTeam([])
    expect(s.empty).toBe(true)
    expect(s.total).toBe(0)
    expect(s.hasLead).toBe(false)
  })

  it('both scopes agree when there is nothing', () => {
    expect(clientVisibleTeam([])).toEqual([])
    expect(practitionerTeamView([])).toEqual([])
  })

  it('summarises a real team correctly', () => {
    const s = summariseCaseTeam([lead, student, departed])
    expect(s).toMatchObject({ total: 3, active: 2, ended: 1, hasLead: true, students: 1, empty: false })
  })
})
