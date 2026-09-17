import type { Metadata } from 'next'
import Link from 'next/link'
import { Cormorant_Garamond, DM_Sans } from 'next/font/google'
import { IntakeV2DesignPreview } from './IntakeV2DesignPreview'
import { FIXTURE_CASE } from '../_careV2/fixtures'
import { PreviewContextBanner, SignOffPanel } from '../_careV2/signoff'

// ─── Intake V2 (client) — internal mobile-first design preview ────────────────
// Behind the admin (protected) layout (auth + role === 'admin'), linked from
// no public surface, noindex. Local state seeded from the synthetic fixture;
// nothing saves, sends or generates. The LIVE client intake remains the
// flagged /dashboard/intake-v2 flow in apps/web — this preview shows the V2
// design shape beside the synopsis it feeds (route-map/preview/synopsis-v2).
//
// INTEGRATION TODO (separate, later task): live wiring requires the approved
// Sprint 3 data-access model and clinician sign-off — see _careV2/fixtures.ts.

export const metadata: Metadata = {
  title: 'Intake V2 — Design Preview',
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

export default function IntakeV2DesignPreviewPage() {
  return (
    <div className={`${displayFont.variable} ${bodyFont.variable} min-h-screen`} style={{ background: '#F4ECDD' }}>
      <div className="max-w-[420px] mx-auto px-5 pt-6">
        <PreviewContextBanner />
        <div className="rounded-lg px-4 py-2.5 text-[12px]"
          style={{ fontFamily: 'var(--font-body), sans-serif', background: '#F5EDDA', border: '1px dashed #B08A3E', color: '#7D6128' }}>
          {FIXTURE_CASE.banner} All controls are inert — nothing is saved, sent or generated.
          {' '}The synopsis this feeds: <Link href="/route-map/preview/synopsis-v2" className="underline">Synopsis V2 preview</Link>.
        </div>
      </div>
      <IntakeV2DesignPreview />
      <div className="max-w-2xl mx-auto px-5 pb-10">
        <SignOffPanel surface="Intake V2 client flow (synthetic preview)" />
      </div>
    </div>
  )
}
