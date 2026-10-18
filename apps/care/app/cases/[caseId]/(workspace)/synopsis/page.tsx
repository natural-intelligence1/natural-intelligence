import type { Metadata } from 'next'
import { NotYetAvailable } from '@/components/workspace/NotYetAvailable'

export const metadata: Metadata = { title: 'Factual Synopsis — NI Care' }

export default function Page() {
  return (
    <NotYetAvailable
      title="Factual Synopsis"
      what="Read the factual synopsis assembled from what the client reported, section by section, with each fact attributed."
      domain="synopsis.ts and synopsisMapping.ts are complete and tested. The live /dashboard/synopsis page is a separate, older implementation that does not use them, so there is no practitioner view of Synopsis V2 yet."
    />
  )
}
