import type { Metadata } from 'next'
import { NotYetAvailable } from '@/components/workspace/NotYetAvailable'

export const metadata: Metadata = { title: 'Progress — NI Care' }

export default function Page() {
  return (
    <NotYetAvailable
      title="Progress"
      what="Follow what has actually happened between reviews, and how the signed plan is being lived."
      domain="buildSinceLastReview is complete, tested and in use — it produces the Since last review list on the Overview, now reading real case_events through careRecord/caseUpdates.ts. Clients cannot yet record an update themselves: case_events has no client INSERT policy, so only service_role can write one. DailyPath is live for clients; the practitioner-side progress view is not built."
    />
  )
}
