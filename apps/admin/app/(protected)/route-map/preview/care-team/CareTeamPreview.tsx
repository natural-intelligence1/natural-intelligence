'use client'

// ─── My Care Team V1 — internal synthetic preview ─────────────────────────────
// Three views of the ONE simple workflow:
//   ADMIN ASSIGNS → CLIENT APPROVES → PRACTITIONER CONTRIBUTES → LEAD COORDINATES
// Local state only, seeded synthetic ("Rowan Example"); approve/withdraw/end
// run the REAL model guards from packages/db (careTeam.ts) so KR sees the
// actual fail-closed behaviour. Nothing saves; no live records exist here.

import { useState } from 'react'
import {
  isMembershipVisible, canAccessHealthProfile, validateLeadAssignment,
  approveMembership, withdrawMembership, endAssignment,
  CARE_TEAM_ROLE_LABELS, CARE_TEAM_APPROVAL_TEXT, CARE_TEAM_APPROVAL_EXPLANATION,
  type CareTeamMembership,
} from '@natural-intelligence/db/intakeV2'
import { C, display, body } from '../_careV2/ui'
import { PreviewContextBanner } from '../_careV2/signoff'

const STUDENT_CONTEXT = {
  clientInformedOfStudent: true, namedSupervisorId: 'pract-lead',
  supervisionActive: true, caseInvolvementActive: true,
}

const SEED_TEAM: CareTeamMembership[] = [
  {
    practitionerId: 'pract-lead', practitionerName: 'Fern Exampleton',
    profession: 'Naturopath / Nutritional Therapist', teamRole: 'lead',
    assignment: { status: 'assigned', assignedBy: 'admin-kr', assignedAt: '2026-09-15T09:00:00Z' },
    clientApproval: { status: 'approved', at: '2026-09-15T18:00:00Z', approvalTextVersion: 'care-team-approval.v1-draft' },
  },
  {
    practitionerId: 'pract-2', practitionerName: 'Sorrel Samplewood',
    profession: 'Herbalist', teamRole: 'care_team',
    assignment: { status: 'assigned', assignedBy: 'admin-kr', assignedAt: '2026-09-17T11:00:00Z' },
    clientApproval: { status: 'pending' },
  },
  {
    practitionerId: 'stud-1', practitionerName: 'Ash Traineeson',
    profession: 'Naturopath / Nutritional Therapist', teamRole: 'student',
    assignment: { status: 'assigned', assignedBy: 'admin-kr', assignedAt: '2026-09-17T11:05:00Z' },
    clientApproval: { status: 'approved', at: '2026-09-17T19:00:00Z', approvalTextVersion: 'care-team-approval.v1-draft' },
    supervisorId: 'pract-lead', supervisorName: 'Fern Exampleton',
  },
]

const avatarColour: Record<string, string> = { lead: C.pine, care_team: C.olive, student: C.sage }

function accessStatus(member: CareTeamMembership): { label: string; tone: string } {
  if (member.assignment.status === 'ended') return { label: 'Access ended', tone: C.muted }
  if (member.clientApproval.status === 'withdrawn') return { label: 'Access ended', tone: C.muted }
  if (member.clientApproval.status === 'pending') return { label: 'Pending your approval', tone: C.goldInk }
  return { label: 'Access approved', tone: C.olive }
}

export function CareTeamPreview() {
  const [tab, setTab] = useState<'client' | 'admin' | 'practitioner'>('client')
  const [team, setTeam] = useState<CareTeamMembership[]>(SEED_TEAM)
  const [approving, setApproving] = useState<string | null>(null)

  const update = (id: string, transform: (m: CareTeamMembership) => CareTeamMembership) =>
    setTeam((current) => current.map((member) => member.practitionerId === id ? transform(member) : member))

  const visibleTeam = team.filter(isMembershipVisible)
  const lead = visibleTeam.find((member) => member.teamRole === 'lead')
  const rest = visibleTeam.filter((member) => member.teamRole !== 'lead')
  const secondLeadRefusal = validateLeadAssignment(team, 'lead')

  function MemberCard({ member, prominent }: { member: CareTeamMembership; prominent?: boolean }) {
    const status = accessStatus(member)
    const hasAccess = canAccessHealthProfile(member, member.teamRole === 'student' ? STUDENT_CONTEXT : undefined)
    return (
      <div className="rounded-2xl p-5 flex gap-4 items-start"
        style={{ background: prominent ? C.warm : '#fff', border: `1px solid ${prominent ? C.gold : C.border}` }}>
        <div className="w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-[16px] font-medium"
          style={{ ...display, background: avatarColour[member.teamRole], color: C.cream }}>
          {member.practitionerName.split(' ').map((part) => part[0]).join('')}
        </div>
        <div className="flex-1 min-w-0" style={body}>
          <p className="text-[16px] font-medium" style={{ ...display, color: C.pine }}>{member.practitionerName}</p>
          <p className="text-[12.5px]" style={{ color: C.text2 }}>{member.profession}</p>
          <p className="text-[11.5px] mt-0.5 font-medium" style={{ color: member.teamRole === 'student' ? C.goldInk : C.olive }}>
            {CARE_TEAM_ROLE_LABELS[member.teamRole]}
            {member.teamRole === 'student' && member.supervisorName && (
              <span style={{ color: C.text2, fontWeight: 400 }}> · Supervised by {member.supervisorName}</span>
            )}
          </p>
          <p className="text-[11.5px] mt-1.5" style={{ color: status.tone }}>
            {status.label}{hasAccess ? ' — can view and contribute' : ''}
          </p>
          <div className="flex gap-2 mt-2.5 flex-wrap">
            {member.clientApproval.status === 'pending' && member.assignment.status === 'assigned' && (
              <button type="button" onClick={() => setApproving(member.practitionerId)}
                className="px-3.5 py-1.5 rounded-full text-[12px] font-medium"
                style={{ ...body, background: C.pine, color: C.cream }}>
                Approve access
              </button>
            )}
            <span role="button" aria-disabled="true" className="px-3.5 py-1.5 rounded-full text-[12px] cursor-default"
              style={{ ...body, border: `1px solid ${C.border}`, color: C.text2 }}>
              View practitioner
            </span>
            {member.clientApproval.status === 'approved' && member.assignment.status === 'assigned' && (
              <button type="button" onClick={() => update(member.practitionerId, (m) => withdrawMembership(m, new Date().toISOString()))}
                className="px-3.5 py-1.5 rounded-full text-[12px]"
                style={{ ...body, border: `1px solid ${C.border}`, color: C.muted, background: 'transparent' }}>
                Withdraw access
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-5 py-8">
      <PreviewContextBanner />
      <div className="rounded-lg px-4 py-2.5 text-[12px] mb-5"
        style={{ ...body, background: C.goldWash, border: `1px dashed ${C.gold}`, color: C.goldInk }}>
        Synthetic preview — “Rowan Example” and all practitioners are fictional. Actions run the real
        fail-closed model locally; nothing is saved and no live records exist.
      </div>

      <div className="flex gap-1 rounded-full p-1 mb-6" style={{ background: C.sand }}>
        {([['client', 'Client — My Care Team'], ['admin', 'Admin — Assignment'], ['practitioner', 'Practitioner — Assigned Clients']] as const).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)}
            className="px-3.5 py-2 rounded-full text-[12px] font-medium flex-1"
            style={{ ...body, background: tab === key ? C.pine : 'transparent', color: tab === key ? C.cream : C.text2 }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── CLIENT: My Care Team ─────────────────────────────────────────────── */}
      {tab === 'client' && (
        <div>
          <h1 className="text-[28px] font-medium mb-1" style={{ ...display, color: C.pine }}>My Care Team</h1>
          <p className="text-[13px] mb-5 leading-relaxed" style={{ ...body, color: C.text2 }}>
            Who leads your care, who else is supporting you, and who currently has access. You approve
            everyone, and you can withdraw access at any time.
          </p>
          {lead ? (
            <div className="mb-3">
              <p className="text-[11px] uppercase tracking-wide mb-1.5" style={{ ...body, color: C.goldInk }}>Leads my care</p>
              <MemberCard member={lead} prominent />
            </div>
          ) : (
            <p className="text-[13px] mb-3 italic" style={{ ...body, color: C.muted }}>No lead practitioner at the moment.</p>
          )}
          {rest.length > 0 && (
            <div className="space-y-2.5">
              <p className="text-[11px] uppercase tracking-wide mb-1.5" style={{ ...body, color: C.muted }}>Also supporting me</p>
              {rest.map((member) => <MemberCard key={member.practitionerId} member={member} />)}
            </div>
          )}

          {/* One simple approval sheet */}
          {approving && (
            <div className="mt-5 rounded-2xl p-5" style={{ background: C.warm, border: `1px solid ${C.gold}` }}>
              <p className="text-[15px] font-medium mb-2" style={{ ...display, color: C.pine }}>
                {CARE_TEAM_APPROVAL_TEXT}
              </p>
              <ul className="text-[12.5px] leading-relaxed list-disc pl-4 mb-3" style={{ ...body, color: C.text2 }}>
                {CARE_TEAM_APPROVAL_EXPLANATION.map((line) => <li key={line}>{line}</li>)}
              </ul>
              <div className="flex gap-2">
                <button type="button"
                  onClick={() => { update(approving, (m) => approveMembership(m, new Date().toISOString())); setApproving(null) }}
                  className="px-4 py-2 rounded-full text-[13px] font-medium" style={{ ...body, background: C.pine, color: C.cream }}>
                  Approve access
                </button>
                <button type="button" onClick={() => setApproving(null)}
                  className="px-4 py-2 rounded-full text-[13px]" style={{ ...body, border: `1px solid ${C.border}`, color: C.text2, background: 'transparent' }}>
                  Not now
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ADMIN: Care Team Assignment ──────────────────────────────────────── */}
      {tab === 'admin' && (
        <div style={body}>
          <h1 className="text-[24px] font-medium mb-1" style={{ ...display, color: C.pine }}>Care Team Assignment</h1>
          <p className="text-[12.5px] mb-4" style={{ color: C.text2 }}>
            Client: Rowan Example (synthetic). Only Admin assigns in V1 — no self-assignment, no matching,
            no auto team-building. Lifecycle: Assigned → Pending client approval → Active → Ended/Withdrawn.
          </p>
          <div className="space-y-2 mb-4">
            {team.map((member) => (
              <div key={member.practitionerId} className="rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap"
                style={{ background: '#fff', border: `1px solid ${C.border}` }}>
                <span className="text-[13px] font-medium" style={{ color: C.pine }}>{member.practitionerName}</span>
                <span className="text-[11.5px]" style={{ color: C.text2 }}>{CARE_TEAM_ROLE_LABELS[member.teamRole]}</span>
                <span className="text-[11.5px]" style={{ color: C.muted }}>
                  {member.assignment.status === 'ended' ? 'Assignment ended'
                    : member.clientApproval.status === 'pending' ? 'Awaiting client approval'
                    : member.clientApproval.status === 'withdrawn' ? 'Client withdrew access'
                    : 'Active'}
                </span>
                <span className="text-[10.5px] ml-auto font-mono" style={{ color: C.muted }}>
                  assigned by {member.assignment.assignedBy} · {new Date(member.assignment.assignedAt).toLocaleDateString('en-GB')}
                </span>
                {member.assignment.status === 'assigned' && (
                  <button type="button" onClick={() => update(member.practitionerId, (m) => endAssignment(m, new Date().toISOString()))}
                    className="text-[11px] underline" style={{ color: C.muted }}>
                    End assignment
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="rounded-xl px-4 py-3 text-[12px]" style={{ background: C.goldWash, border: `1px dashed ${C.gold}`, color: C.goldInk }}>
            {secondLeadRefusal
              ? <>Guard live: “{secondLeadRefusal}”</>
              : 'A lead role is currently open — one active Lead Responsible Practitioner may be assigned.'}
            {' '}Assignment history is append-only: ending an assignment keeps the full audit record.
          </div>
        </div>
      )}

      {/* ── PRACTITIONER: Assigned Clients ───────────────────────────────────── */}
      {tab === 'practitioner' && (
        <div style={body}>
          <h1 className="text-[24px] font-medium mb-1" style={{ ...display, color: C.pine }}>Assigned Clients</h1>
          <p className="text-[12.5px] mb-4" style={{ color: C.text2 }}>
            Viewing as Sorrel Samplewood (Herbalist). Only clients with an active Admin assignment appear —
            there is no NI-wide client search.
          </p>
          {(() => {
            const me = team.find((member) => member.practitionerId === 'pract-2')!
            if (!isMembershipVisible(me)) {
              return <p className="text-[13px] italic" style={{ color: C.muted }}>No assigned clients.</p>
            }
            const hasAccess = canAccessHealthProfile(me)
            return (
              <div className="rounded-xl px-4 py-3.5" style={{ background: '#fff', border: `1px solid ${C.border}` }}>
                <p className="text-[14px] font-medium" style={{ color: C.pine }}>Rowan Example</p>
                <p className="text-[12px] mt-0.5" style={{ color: hasAccess ? C.olive : C.goldInk }}>
                  {hasAccess
                    ? 'Health Profile open — view and contribute (attributed; originals preserved)'
                    : 'Awaiting client approval — no Health Profile access until Rowan approves'}
                </p>
                <p className="text-[11px] mt-1" style={{ color: C.muted }}>
                  Role: {CARE_TEAM_ROLE_LABELS[me.teamRole]} · assigned {new Date(me.assignment.assignedAt).toLocaleDateString('en-GB')}
                </p>
              </div>
            )
          })()}
          <p className="text-[11px] mt-4 leading-relaxed" style={{ color: C.muted }}>
            Real practitioner access remains fully gated: the Sprint 3 data-access model,
            INTAKE_ASSIGNMENT_ENABLED (off) and the locked 0052 policies are unchanged — this preview
            demonstrates the model only, on synthetic data.
          </p>
        </div>
      )}
    </div>
  )
}
