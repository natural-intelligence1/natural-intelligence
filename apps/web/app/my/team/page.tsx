// ─── MY TEAM ─────────────────────────────────────────────────────────────────
// FLOW 1, WIRED. Reads case_team_roles through the shared care record reader
// — the same one the practitioner Team section uses. One source, two scopes.
//
// The client scope shows only people currently on the team. "Who can see my
// record?" is a question about now, and listing a practitioner who no longer
// has access would answer it alarmingly and wrongly.
//
// The empty state here is REAL, not a placeholder. There are currently no
// case_team_roles rows and none can be created: every insert must pass
// practitioner_assignment_eligibility(), and no practitioner does yet. So
// this page truthfully reports no team. When that gate clears, this page
// populates from the same reader with no further code.
//
// The markup lives in TeamView so the flag-gated review route can render the
// identical screen. Scoping stays here, with the session.

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@natural-intelligence/db'
import { loadCaseTeam, clientVisibleTeam, leadPractitioner, summariseCaseTeam } from '@natural-intelligence/db/careRecord'
import { TeamView, type TeamMemberView } from './TeamView'

export const dynamic = 'force-dynamic'

export default async function MyTeamPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // The client's own case. RLS scopes this to them; the page never takes a
  // case id from the URL, so one client cannot ask for another's team.
  const { data: ownCase } = await supabase
    .from('client_cases')
    .select('id')
    .eq('client_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const team = ownCase?.id ? await loadCaseTeam(supabase, ownCase.id) : []
  const visible = clientVisibleTeam(team)
  const lead = leadPractitioner(visible)
  const others = visible.filter((m) => m.practitionerId !== lead?.practitionerId)
  const summary = summariseCaseTeam(visible)

  return (
    <TeamView
      lead={(lead as TeamMemberView | null) ?? null}
      others={others as TeamMemberView[]}
      empty={summary.empty}
    />
  )
}
