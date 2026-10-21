// ─── Intake / Case-taking — Consultation Cockpit V2 (pilot) ──────────────────
// The cockpit's home: inside the real practitioner Client Case Workspace,
// under Intake / Case-taking. Not an admin preview product.
//
// Auth is inherited. apps/care middleware already gates every route on an
// active practitioner record, and nothing here weakens it.
//
// PILOT SCOPE: Digestion, Energy & metabolism, Sleep. Nothing persists — no
// Question → Concept → Field mapping is approved, so the cockpit runs on
// session state and says so on screen rather than implying a write happened.

import type { Metadata } from 'next'
import { ConsultationCockpit } from '@/components/cockpit/ConsultationCockpit'

export const metadata: Metadata = { title: 'Intake / Case-taking — NI Care' }

export default function Page({ params }: { params: { caseId: string } }) {
  return <ConsultationCockpit caseId={params.caseId} />
}
