import type { Metadata } from 'next'
import { NotYetAvailable } from '@/components/workspace/NotYetAvailable'

export const metadata: Metadata = { title: 'Evidence & Systems — NI Care' }

export default function Page() {
  return (
    <NotYetAvailable
      title="Evidence & Systems"
      what="Work through the systems under consideration and the influences recorded against them."
      domain="influences.ts and concerns.ts are complete domain code with no UI anywhere. Systems Under Stress does not exist at all — no table, no module, no screen."
    />
  )
}
