import type { Metadata } from 'next'
import { NotYetAvailable } from '@/components/workspace/NotYetAvailable'

export const metadata: Metadata = { title: 'Safety — NI Care' }

export default function Page() {
  return (
    <NotYetAvailable
      title="Safety"
      what="Review anything the client reported that needs a safety decision, and record that it has been seen."
      domain="safetyWorkflow.ts and deriveV2SafetyReviewItems are complete domain code with no UI and no test file. 14 intake questions already carry safetyOptions metadata."
    />
  )
}
