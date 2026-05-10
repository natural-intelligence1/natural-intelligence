// ─── /cases/[caseId]/work/[workId] — Case Review Workspace (B.1) ─────────────
// B.1 renders the same ReasoningPageView as the /reasoning page.
// The full workspace UX (Client Summary, Case Events, BioHub, Action Panel)
// is added in B.2.
//
// On load:
//   1. Authenticate and verify the work item belongs to this practitioner.
//   2. Transition work item from 'assigned' → 'in_review' (fire-and-forget).
//   3. Render reasoning trace with workspace top bar and breadcrumb.

import { notFound }                   from 'next/navigation'
import type { Metadata }              from 'next'
import { createServerSupabaseClient } from '@natural-intelligence/db'
import { startWorkItem }              from '@natural-intelligence/db/practitioners'
import { getPractitionerTrace }       from '@natural-intelligence/db/crt'
import { ReasoningPageView }          from '@/components/reasoning'
import { TopBar }                     from '@/components/TopBar'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Case Review — NI Care' }

export default async function WorkspacePage({
  params,
}: {
  params: { caseId: string; workId: string }
}) {
  const supabase = createServerSupabaseClient()

  // Verify the work item exists and belongs to the signed-in practitioner.
  // work_practitioner_select RLS: practitioner_id = auth.uid() — returns null
  // if this practitioner doesn't own the item, giving the same 404 as notFound().
  const { data: workItem, error: workErr } = await supabase
    .from('case_practitioner_work')
    .select('id, case_id, work_type, status, due_at, started_at')
    .eq('id', params.workId)
    .eq('case_id', params.caseId)
    .maybeSingle()

  if (workErr || !workItem) return notFound()

  // Fire-and-forget: transition to in_review on first open.
  // Per addendum S4: only if currently 'assigned'; idempotent otherwise.
  // Errors are swallowed — a failed transition does not block the workspace.
  startWorkItem(supabase, params.workId).catch(() => {})

  // Load case — authenticated client, RLS (case_practitioner_select) enforces access.
  const { data: clientCase, error: caseErr } = await supabase
    .from('client_cases')
    .select('id, primary_concern, case_complexity_score, escalation_required, status, profiles:client_id (full_name)')
    .eq('id', params.caseId)
    .single()

  if (caseErr || !clientCase) return notFound()

  const trace = await getPractitionerTrace(supabase, params.caseId)

  const profile    = clientCase.profiles as unknown as { full_name: string | null } | null
  const fullName   = profile?.full_name ?? 'Unknown'
  const workType   = workItem.work_type.replace(/_/g, ' ')

  return (
    <main style={{ minHeight: '100vh', background: '#FAFAF9', color: '#1A1917' }}>
      <TopBar
        breadcrumb={[
          { label: fullName },
          { label: workType },
        ]}
      />
      {/* B.1: Render reasoning trace. Full workspace panels added in B.2. */}
      <ReasoningPageView
        trace={trace}
        clientCase={clientCase}
        clientName={fullName}
      />
    </main>
  )
}
