import type { Metadata } from 'next'
import { Cormorant_Garamond, DM_Sans } from 'next/font/google'
import { SynopsisV2Preview } from './SynopsisV2Preview'

// ─── Practitioner Synopsis V2 — internal preview (SYNTHETIC DATA ONLY) ────────
// Lives behind the admin (protected) layout (auth + role === 'admin'), is
// linked from no public surface, and is noindex — the same internal preview
// pattern as route-map/preview/pricing. Renders ONLY the synthetic fixture
// case; no intake_sessions, intake_answers, client_cases, ai_summaries or
// any real record is read.
//
// INTEGRATION TODO (separate, later task): the live Synopsis V2 must be
// built on the approved Sprint 3 data-access model (consent enforcement,
// de-identification/review-pack boundary, client_cases access controls) and
// needs clinician sign-off — see _careV2/fixtures.ts.

export const metadata: Metadata = {
  title: 'Practitioner Synopsis V2 — Preview',
  robots: { index: false, follow: false },
}

const displayFont = Cormorant_Garamond({
  subsets: ['latin'], weight: ['300', '400', '500', '600'], style: ['normal', 'italic'],
  display: 'swap', variable: '--font-display',
})
const bodyFont = DM_Sans({
  subsets: ['latin'], weight: ['400', '500', '600'],
  display: 'swap', variable: '--font-body',
})

export default function SynopsisV2PreviewPage() {
  return (
    <div className={`${displayFont.variable} ${bodyFont.variable}`}>
      <SynopsisV2Preview />
    </div>
  )
}
