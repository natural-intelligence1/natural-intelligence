import type { Metadata } from 'next'
import { NotYetAvailable } from '@/components/workspace/NotYetAvailable'

export const metadata: Metadata = { title: 'Aims & Outcomes — NI Care' }

export default function Page() {
  return (
    <NotYetAvailable
      title="Aims & Outcomes"
      what="Agree therapeutic aims with the client and record how progress against them will be measured."
      domain="Nothing exists for this yet: no domain module, no schema, no UI. This destination is reserved so the journey is complete, not because code is hiding behind it."
    />
  )
}
