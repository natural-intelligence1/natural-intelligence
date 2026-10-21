// ─── TEMPORARY Founder review route — Consultation Cockpit V2 pilot ─────────
//
// WHY THIS EXISTS
//
// The cockpit's real home is /cases/[caseId]/intake, inside the practitioner
// Client Case Workspace. That route is gated by the care middleware on an
// active practitioner record, and the Founder does not have one — converting
// the Founder account into a practitioner was explicitly out of bounds, and
// weakening the middleware more so.
//
// So this route renders THE SAME COMPONENT from the same place in apps/care.
// It is not a second implementation and not an admin preview product: delete
// this file and the cockpit is untouched.
//
// WHY IT NEEDS NO AUTH CHANGE
//
// The care middleware gates only paths beginning /cases (see its line 27), so
// a route outside that prefix is reachable without a practitioner record. No
// middleware edit, no bypass, no new exemption.
//
// WHY IT IS OFF BY DEFAULT
//
// Reachable-without-a-practitioner-record is exactly the property that makes
// it useful for review and unsuitable for production. It renders only when
// COCKPIT_PILOT_REVIEW_ENABLED is set to '1', and 404s otherwise. Unset means
// off, so merging this changes nothing anywhere until someone sets the flag.
//
// It shows a FICTIONAL case and persists nothing — no mapping is approved, so
// there is no write path to reach even with the flag on.

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ConsultationCockpit } from '@/components/cockpit/ConsultationCockpit'
import { T, FONT_DISPLAY } from '@/components/workspace/caseTheme'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Cockpit pilot review — NI Care',
  robots: { index: false, follow: false },
}

export default function Page() {
  if (process.env.COCKPIT_PILOT_REVIEW_ENABLED !== '1') notFound()

  return (
    <main style={{ minHeight: '100vh', background: T.page, color: T.text }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '28px 24px 64px' }}>
        <header style={{ marginBottom: '22px' }}>
          <p style={{
            fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.14em',
            color: T.muted, margin: '0 0 5px',
          }}>
            Temporary Founder review route
          </p>
          <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: '27px', color: T.text, margin: '0 0 8px' }}>
            Consultation Cockpit V2 · pilot
          </h1>
          <p style={{ fontSize: '13px', color: T.text2, margin: 0, lineHeight: 1.6, maxWidth: '760px' }}>
            This renders the same component as{' '}
            <code style={{ fontSize: '12px', color: T.goldInk }}>/cases/[caseId]/intake</code>, which is
            the cockpit&rsquo;s real home inside the practitioner case workspace. That route is gated
            on an active practitioner record; this one exists only so it can be reviewed without
            one. It is off unless <code style={{ fontSize: '12px' }}>COCKPIT_PILOT_REVIEW_ENABLED=1</code>,
            and it is safe to delete.
          </p>
        </header>

        <ConsultationCockpit caseId="demo-case" />
      </div>
    </main>
  )
}
