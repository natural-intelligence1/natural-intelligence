import { notFound }                   from 'next/navigation'
import type { Metadata }              from 'next'
import { createServerSupabaseClient } from '@natural-intelligence/db'
import { getPractitionerTrace }       from '@natural-intelligence/db/crt'
import {
  isReviewPacksEnabled,
  makePseudonym,
}                                     from '@natural-intelligence/db/practitioners'
import { ReasoningPageView }          from '@/components/reasoning'
import { TopBar }                     from '@/components/TopBar'

export const metadata: Metadata = { title: 'Clinical Reasoning — NI Care' }

export default async function ReasoningPage({
  params,
}: {
  params: { caseId: string }
}) {
  const supabase = createServerSupabaseClient()

  // ── Sprint 3: de-identified mode ──────────────────────────────────────────
  // When PRACTITIONER_REVIEW_PACKS_ENABLED is on, this page never reads
  // client_cases or profiles: access is verified via the caller's own work
  // items (RLS), operational fields come from the column-scoped
  // practitioner_case_index view (0052) where available, the header shows the
  // case pseudonym, and primary_concern is never fetched. No fallback to the
  // identified path.
  if (isReviewPacksEnabled()) {
    const { data: workRow } = await supabase
      .from('case_practitioner_work')
      .select('id, status')
      .eq('case_id', params.caseId)
      .limit(1)
      .maybeSingle()
    if (!workRow) return notFound()

    // eslint-disable-next-line
    const { data: idx } = await (supabase as any)
      .from('practitioner_case_index')
      .select('id, status, case_complexity_score, escalation_required')
      .eq('id', params.caseId)
      .maybeSingle()

    const pseudonym = makePseudonym(params.caseId)
    const trace = await getPractitionerTrace(supabase, params.caseId)
    return (
      <main style={{ minHeight: '100vh', background: '#FAFAF9', color: '#1A1917' }}>
        <TopBar breadcrumb={[{ label: pseudonym }]} />
        <ReasoningPageView
          trace={trace}
          clientCase={{
            id:                    params.caseId,
            primary_concern:       null,
            case_complexity_score: idx?.case_complexity_score ?? 0,
            escalation_required:   idx?.escalation_required ?? false,
            status:                idx?.status ?? workRow.status,
          }}
          clientName={pseudonym}
        />
      </main>
    )
  }

  // ── Identified mode (legacy — retired by the pack rollout) ────────────────
  // RLS (case_practitioner_select) ensures only practitioners with work on
  // this case can load it.
  const { data: clientCase, error: caseErr } = await supabase
    .from('client_cases')
    .select('id, primary_concern, case_complexity_score, escalation_required, status, profiles:client_id (full_name)')
    .eq('id', params.caseId)
    .single()

  if (caseErr || !clientCase) return notFound()

  const trace = await getPractitionerTrace(supabase, params.caseId)

  const profile  = clientCase.profiles as unknown as { full_name: string | null } | null
  const fullName = profile?.full_name ?? 'Unknown'

  return (
    <main style={{ minHeight: '100vh', background: '#FAFAF9', color: '#1A1917' }}>
      <TopBar
        breadcrumb={[{ label: fullName }]}
      />
      <ReasoningPageView
        trace={trace}
        clientCase={clientCase}
        clientName={fullName}
      />
    </main>
  )
}
