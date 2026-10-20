// ─── Team ────────────────────────────────────────────────────────────────────
// FLOW 1, WIRED. The practitioner half of the same connection the client sees
// at /my/team, reading case_team_roles through the shared care record reader.
//
// The practitioner scope keeps ENDED roles visible, which the client scope
// hides. That is the one intended difference between the two views: who was
// involved and when is clinically relevant to a practitioner, and not what a
// client is asking when they look at who can see their record.
//
// The empty state is real. No case_team_roles rows exist and none can be
// created until practitioner_assignment_eligibility() passes, so both views
// correctly report no team.

import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@natural-intelligence/db'
import { loadCaseTeam, practitionerTeamView, summariseCaseTeam } from '@natural-intelligence/db/careRecord'
import { T, FONT_DISPLAY } from '@/components/workspace/caseTheme'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Team — NI Care' }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function TeamPage({ params }: { params: { caseId: string } }) {
  const supabase = createServerSupabaseClient()

  // A real case id reaches the reader; the fixture route id does not, and
  // simply returns an empty team rather than inventing one.
  const team = await loadCaseTeam(supabase, params.caseId).catch(() => [])
  const ordered = practitionerTeamView(team)
  const summary = summariseCaseTeam(team)

  return (
    <section aria-labelledby="team-heading">
      <h2 id="team-heading" style={{ fontFamily: FONT_DISPLAY, fontSize: '19px', color: T.text, margin: '0 0 12px' }}>
        Care team
      </h2>

      {summary.empty ? (
        <div style={{ border: `1px dashed ${T.border}`, borderRadius: '10px', background: T.card, padding: '28px', maxWidth: '640px' }}>
          <p style={{ fontSize: '14px', color: T.text, margin: '0 0 10px' }}>
            No one is recorded on this case yet.
          </p>
          <p style={{ fontSize: '12.5px', color: T.text2, margin: '0 0 12px', lineHeight: 1.55 }}>
            Roles are assigned by an NI admin. Once assigned, this list and the client&rsquo;s own
            &ldquo;My Team&rdquo; are filled from the same record — neither keeps its own copy.
          </p>
          <p style={{ fontSize: '12px', color: T.muted, margin: 0, lineHeight: 1.5 }}>
            <strong style={{ color: T.goldInk, fontWeight: 600 }}>Why it is empty · </strong>
            every assignment must pass practitioner eligibility, and no practitioner currently
            does — class not set, credentials not verified, indemnity missing, scope not approved.
          </p>
        </div>
      ) : (
        <>
          <p style={{ fontSize: '12px', color: T.muted, margin: '0 0 14px' }}>
            {summary.active} active{summary.ended > 0 ? ` · ${summary.ended} ended` : ''}
            {summary.hasLead ? '' : ' · no active Lead'}
          </p>

          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {ordered.map((m) => (
              <li
                key={`${m.practitionerId}-${m.startedAt}`}
                style={{
                  border: `1px solid ${T.border}`, borderRadius: '8px', padding: '14px 16px',
                  background: m.active ? T.card : T.sunken,
                  opacity: m.active ? 1 : 0.75,
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'baseline' }}>
                  <span style={{ fontSize: '14px', color: T.text }}>{m.displayName}</span>
                  <span style={{
                    fontSize: '11px', padding: '2px 8px', borderRadius: '999px',
                    background: m.teamRole === 'lead' ? T.goldWash : T.sunken,
                    border: `1px solid ${m.teamRole === 'lead' ? T.goldPale : T.border}`,
                    color: m.teamRole === 'lead' ? T.goldInk : T.text2,
                  }}>
                    {m.roleLabel}
                  </span>
                  {/* State in words, never colour alone. */}
                  {!m.active && <span style={{ fontSize: '11.5px', color: T.muted }}>Ended</span>}
                </div>

                {m.supervisorName && (
                  <p style={{ fontSize: '12px', color: T.text2, margin: '6px 0 0' }}>
                    Supervised by {m.supervisorName}
                  </p>
                )}

                <p style={{ fontSize: '11.5px', color: T.muted, margin: '6px 0 0' }}>
                  {formatDate(m.startedAt)}
                  {m.endedAt ? ` — ${formatDate(m.endedAt)}` : ' — present'}
                  {m.endReason ? ` · ${m.endReason}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}

      <p style={{ fontSize: '11.5px', color: T.muted, marginTop: '20px', lineHeight: 1.5 }}>
        Exactly one active Lead Responsible Practitioner per case is enforced by the database, not
        by this screen. Client approval of each assignment is not yet stored.
      </p>
    </section>
  )
}
