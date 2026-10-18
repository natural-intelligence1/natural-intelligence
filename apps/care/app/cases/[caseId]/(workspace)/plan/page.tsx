import type { Metadata } from 'next'
import { NotYetAvailable } from '@/components/workspace/NotYetAvailable'

export const metadata: Metadata = { title: 'Plan / Protocol — NI Care' }

export default function Page() {
  return (
    <NotYetAvailable
      title="Plan / Protocol"
      what="Draft, review and sign the Protocol, then revise it into a new version when it changes."
      domain="The signed-Protocol version chain is live in the database (migration 0059: version, signed_at, signed_by, supersedes, with three enforcing triggers). The practitioner editor and signing workspace are built but sit on an unmerged branch alongside migration 0061, which is deliberately unapplied. This destination is intentionally a shell tonight — the Protocol feature will be integrated under controlled release sequencing, not duplicated here."
    />
  )
}
