// ─── /cases/[caseId]/work/[workId] — Case Review Workspace (B.2) ─────────────
// Full two-column workspace layout:
//
//   ┌──────────────────────────────────────────────────────────────┐
//   │ [Top bar — breadcrumb + practitioner name]                   │
//   ├──┬───────────────────────────────────────────┬──────────────┤
//   │  │ Workspace Header (Cormorant client name)   │ Action Panel │
//   │S │ ClientSummaryPanel      (expanded)         │ (sticky)     │
//   │e │ ReasoningTracePanel     (expanded)         │              │
//   │c │ CaseHistoryPanel        (collapsed)        │              │
//   │t │ BioHubSignalsPanel      (collapsed)        │              │
//   │i │ PriorReviewsPanel       (collapsed)        │              │
//   │o │                                            │              │
//   │n │                                            │              │
//   └──┴───────────────────────────────────────────┴──────────────┘
//
// Data flow:
//   1. Authenticated client verifies work item ownership (RLS).
//   2. startWorkItem fires fire-and-forget (assigned → in_review).
//   3. Admin client fetches intake summary + biohub signals (Q6 exception).
//   4. Authenticated client fetches case events + prior reviews.
//   5. Authenticated client fetches reasoning trace.
//
// Cormorant Garamond: one use only — the client's full name in the workspace
// header. Per Section 11 of the design proposal. If this feels disconnected
// from the data-dense workspace context, STOP and surface for design discussion.

import { notFound }                   from 'next/navigation'
import type { Metadata }              from 'next'
import {
  createServerSupabaseClient,
  createAdminClient,
}                                     from '@natural-intelligence/db'
import {
  startWorkItem,
  getIntakeSummary,
  getCaseEvents,
  getBioHubSignals,
  getPriorReviews,
}                                     from '@natural-intelligence/db/practitioners'
import { getPractitionerTrace }       from '@natural-intelligence/db/crt'
import { TopBar }                     from '@/components/TopBar'
import {
  ClientSummaryPanel,
  ReasoningTracePanel,
  CaseHistoryPanel,
  BioHubSignalsPanel,
  PriorReviewsPanel,
  SectionNavRail,
  ActionPanel,
}                                     from '@/components/workspace'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Case Review — NI Care' }

export default async function WorkspacePage({
  params,
}: {
  params: { caseId: string; workId: string }
}) {
  const supabase = createServerSupabaseClient()

  // ── 1. Verify work item ownership via RLS ─────────────────────────────────
  const { data: workItem, error: workErr } = await supabase
    .from('case_practitioner_work')
    .select('id, case_id, work_type, status, due_at, started_at')
    .eq('id', params.workId)
    .eq('case_id', params.caseId)
    .maybeSingle()

  if (workErr || !workItem) return notFound()

  // ── 2. Fire-and-forget: assigned → in_review ──────────────────────────────
  // Guard: only call startWorkItem if status is still 'assigned' (addendum S4).
  if (workItem.status === 'assigned') {
    startWorkItem(supabase, params.workId).catch(() => {})
  }

  // ── 3. Load case for header + client metadata ─────────────────────────────
  // profiles FK join is intentionally absent — full-row SELECT on profiles is
  // not granted to practitioners. Client identity (full_name, avatar_url) is
  // fetched separately from the practitioner_client_identity view (F2).
  const { data: clientCase, error: caseErr } = await supabase
    .from('client_cases')
    .select('id, primary_concern, case_complexity_score, escalation_required, status, client_id')
    .eq('id', params.caseId)
    .single()

  if (caseErr || !clientCase) return notFound()

  const workType = workItem.work_type.replace(/_/g, ' ')
  const memberId = clientCase.client_id

  // ── 4. Parallel data fetch ────────────────────────────────────────────────
  // Admin client for intake + biohub (Q6 exception — no practitioner RLS on these tables).
  // Authenticated client for case events, prior reviews, reasoning trace, and
  // client identity (via practitioner_client_identity view — column-scoped, F2).
  const adminClient = createAdminClient()

  const [intake, events, biohub, priorReviews, trace, identityResult] = await Promise.allSettled([
    getIntakeSummary(adminClient, memberId),
    getCaseEvents(supabase, params.caseId),
    getBioHubSignals(adminClient, memberId),
    getPriorReviews(supabase, params.caseId, params.workId),
    getPractitionerTrace(supabase, params.caseId),
    supabase
      .from('practitioner_client_identity' as 'profiles') // view not yet in generated types
      .select('full_name, avatar_url')
      .eq('id', memberId)
      .maybeSingle(),
  ])

  // Extract settled values — individual failures render panel-level empty states
  // rather than crashing the whole workspace.
  const intakeSummary  = intake.status       === 'fulfilled' ? intake.value       : null
  const caseEvents     = events.status       === 'fulfilled' ? events.value       : []
  const bioHubSignals  = biohub.status       === 'fulfilled' ? biohub.value       : []
  const reviews        = priorReviews.status === 'fulfilled' ? priorReviews.value : []
  const reasoningTrace = trace.status        === 'fulfilled' ? trace.value        : null

  const identityRow = identityResult.status === 'fulfilled'
    ? (identityResult.value.data as unknown as { full_name: string | null; avatar_url: string | null } | null)
    : null
  const fullName = identityRow?.full_name ?? 'Unknown'

  // ── 5. Section nav metadata ───────────────────────────────────────────────
  const navSections = [
    { id: 'client-summary', label: 'Client Summary', empty: false },
    { id: 'reasoning',      label: 'Reasoning',      empty: false },
    { id: 'case-history',   label: 'Case History',   empty: caseEvents.length === 0 },
    { id: 'biohub',         label: 'Lab Signals',    empty: bioHubSignals.length === 0 },
    { id: 'prior-reviews',  label: 'Prior Reviews',  empty: reviews.length === 0 },
  ]

  return (
    <main style={{ minHeight: '100vh', background: '#FAFAF9', color: '#1A1917' }}>
      <TopBar
        breadcrumb={[
          { label: fullName },
          { label: workType },
        ]}
      />

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>

        {/* ── Workspace header (Cormorant moment — Section 11) ──────────────── */}
        <div style={{ marginBottom: '28px' }}>
          {/* Breadcrumb sub-label */}
          <p style={{ fontSize: '11px', color: '#B0AEA8', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '4px' }}>
            Case Review Workspace
          </p>
          {/* Client name in Cormorant Garamond — the single editorial moment */}
          <h1 style={{
            fontFamily:  'var(--font-display)',
            fontSize:    '28px',
            fontWeight:  400,
            color:       '#1A1917',
            margin:      '0 0 4px',
            lineHeight:  '1.2',
          }}>
            {fullName}
          </h1>
          {/* Work type + metadata sub-line in DM Sans */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', color: '#8A8880', fontFamily: 'monospace' }}>
              {workItem.work_type}
            </span>
            {clientCase.primary_concern && (
              <span style={{ fontSize: '13px', color: '#8A8880' }}>
                {clientCase.primary_concern}
              </span>
            )}
            {clientCase.escalation_required && (
              <span style={{ fontSize: '11px', background: '#FEF2F2', color: '#DC2626', fontWeight: 600, padding: '2px 8px', borderRadius: '4px' }}>
                Escalation required
              </span>
            )}
            <span style={{ fontSize: '11px', background: '#F4F3F0', color: '#8A8880', padding: '2px 6px', borderRadius: '4px' }}>
              Complexity {clientCase.case_complexity_score}
            </span>
          </div>
        </div>

        {/* ── Three-column layout: nav · main · action ──────────────────────── */}
        <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>

          {/* Section nav rail */}
          <SectionNavRail sections={navSections} />

          {/* Main content column */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <ClientSummaryPanel  summary={intakeSummary} clientName={fullName} />
            <ReasoningTracePanel trace={reasoningTrace} />
            <CaseHistoryPanel    events={caseEvents} />
            <BioHubSignalsPanel  signals={bioHubSignals} />
            <PriorReviewsPanel   reviews={reviews} />
          </div>

          {/* Action panel — sticky right */}
          <ActionPanel
            workItemId={params.workId}
            status={workItem.status}
            dueAt={workItem.due_at}
            startedAt={workItem.started_at}
          />
        </div>
      </div>
    </main>
  )
}
