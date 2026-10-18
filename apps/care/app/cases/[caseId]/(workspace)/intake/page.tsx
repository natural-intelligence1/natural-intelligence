import type { Metadata } from 'next'
import { NotYetAvailable } from '@/components/workspace/NotYetAvailable'

export const metadata: Metadata = { title: 'Intake / Case-taking — NI Care' }

export default function Page() {
  return (
    <NotYetAvailable
      title="Intake / Case-taking"
      what="Read what the client reported, and add the case-taking a practitioner does on top of it."
      domain="The question registry and conditional flow exist and are tested (115 questions, 29 sections, 19 recorded branch edges). What does not exist is a practitioner-side view of them — the only intake UI today is client-facing and behind INTAKE_V2_ENABLED."
    />
  )
}
