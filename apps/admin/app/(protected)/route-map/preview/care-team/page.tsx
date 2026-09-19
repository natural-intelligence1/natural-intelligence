import type { Metadata } from 'next'
import { Cormorant_Garamond, DM_Sans } from 'next/font/google'
import { CareTeamPreview } from './CareTeamPreview'

// ─── My Care Team V1 — internal synthetic preview ─────────────────────────────
// Admin-protected (auth + role gate from the (protected) layout), noindex,
// linked only from the internal Route Map preview index. Synthetic data
// only; the real practitioner/client wiring stays behind the Sprint 3
// live-data gate, INTAKE_ASSIGNMENT_ENABLED (off) and the locked 0052 work.

export const metadata: Metadata = {
  title: 'My Care Team — Preview',
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

export default function CareTeamPreviewPage() {
  return (
    <div className={`${displayFont.variable} ${bodyFont.variable} min-h-screen`} style={{ background: '#F4ECDD' }}>
      <CareTeamPreview />
    </div>
  )
}
