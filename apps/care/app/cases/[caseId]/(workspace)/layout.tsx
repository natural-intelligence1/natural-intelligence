// ─── Practitioner case workspace — shell ─────────────────────────────────────
// One longitudinal case, ten destinations, one frame.
//
// This is a ROUTE GROUP, (workspace), on purpose. /cases/[caseId]/reasoning
// and /cases/[caseId]/work/[workId] already exist and render their own TopBar
// and <main>. A plain [caseId]/layout.tsx would wrap those too and give them
// two top bars. The group applies this shell only to the sections below it
// and leaves the existing routes exactly as they are.
//
// Auth: inherited. apps/care middleware already gates every route on an
// active practitioner record, so there is no additional gate here — and
// deliberately no weakening of that one.

import type { Metadata } from 'next'
import { TopBar } from '@/components/TopBar'
import { CaseSectionNav } from '@/components/workspace/CaseSectionNav'
import { CaseHeader } from '@/components/workspace/CaseHeader'
import { T } from '@/components/workspace/caseTheme'
import { CASE_FIXTURE } from './caseFixture'

export const metadata: Metadata = { title: 'Case — NI Care' }

export default function CaseWorkspaceLayout({
  children, params,
}: {
  children: React.ReactNode
  params: { caseId: string }
}) {
  const c = CASE_FIXTURE

  return (
    <main style={{ minHeight: '100vh', background: T.page, color: T.text }}>
      {/* Reused as-is: the existing care top bar, with its breadcrumb back to
          the inbox. The practitioner's route out of a case already existed. */}
      <TopBar breadcrumb={[{ label: c.client.pseudonym }]} />

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px 64px' }}>
        <CaseHeader
          pseudonym={c.client.pseudonym}
          reference={c.reference}
          ageBand={c.client.ageBand}
          lead={c.lead.name}
          leadCredential={c.lead.credential}
          leadRole={c.lead.role}
          stage={c.stage}
          status={c.status}
          nextReview={c.nextReview}
        />

        <div className="ni-case-workspace-body" style={{ display: 'flex', gap: '32px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <CaseSectionNav caseId={params.caseId} />
          <div style={{ flex: '1 1 520px', minWidth: 0 }}>{children}</div>
        </div>
      </div>
    </main>
  )
}
