import type { Metadata } from 'next'
import { NotYetAvailable } from '@/components/workspace/NotYetAvailable'

export const metadata: Metadata = { title: 'Progress — NI Care' }

export default function Page() {
  return (
    <NotYetAvailable
      title="Progress"
      what="Follow what has actually happened between reviews, and how the signed plan is being lived."
      domain="updates.ts / buildSinceLastReview is complete, tested and already in use — it produces the Since last review list on the Overview. DailyPath is live for clients; the practitioner-side progress view is not built."
    />
  )
}
