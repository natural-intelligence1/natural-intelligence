// ─── Practitioner Protocol workspace (synthetic preview) ────────────────────
// Draft → edit freely → review → sign → immutable → revise into a new draft.
//
// Admin-protected by the (protected) layout, noindex, and entirely in-memory:
// nothing is saved and no database is touched. Migration 0061, which would
// make this persist, is deliberately unapplied — the database behaviour is
// proven separately in packages/db/src/protocols, not here. This screen is
// for UX judgement.
import type { Metadata } from 'next'
import { Shell } from '../_connected/shared'
import Workspace from './Workspace'

export const metadata: Metadata = {
  title: 'Practitioner Protocol workspace — Preview',
  robots: { index: false, follow: false },
}

export default function ProtocolWorkspacePreview() {
  return (
    <Shell
      eyebrow="Connected care preview — Screen D"
      title="Practitioner Protocol workspace"
      intro="Where the practitioner makes the Protocol their own work and signs it. Draft freely, review it as the client will receive it, then sign — after which the version is fixed and the only way forward is a new one."
    >
      <Workspace />
    </Shell>
  )
}
