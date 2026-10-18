import type { Metadata } from 'next'
import { NotYetAvailable } from '@/components/workspace/NotYetAvailable'

export const metadata: Metadata = { title: 'Team — NI Care' }

export default function Page() {
  return (
    <NotYetAvailable
      title="Team"
      what="See who is on this case, in what role, and since when."
      domain="careTeam.ts is complete and tested, and case_team_roles is live with the Lead-responsibility triggers from 0057 and 0060. There is no UI for it."
    />
  )
}
