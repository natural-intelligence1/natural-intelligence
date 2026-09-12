import { notFound }                   from 'next/navigation'
import type { Metadata }              from 'next'
import { createServerSupabaseClient } from '@natural-intelligence/db'
import { getPractitionerTrace }       from '@natural-intelligence/db/crt'
import {
  isReviewPacksEnabled,
  makePseudonym,
  PACK_MODE_ACTIVE_STATUSES,
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
  // client_cases, profiles OR the reasoning trace: access is verified via the
  // caller's own ACTIVE work items only (final hardening, item 3 — completed/
  // cancelled/declined grant nothing and 404), and the trace is NOT fetched
  // (final hardening, item 2 — getPractitionerTrace returns AI reasoning
  // content, hypotheses and evidence payloads generated from the IDENTIFIED
  // intake, which is not proven pack-safe; until a pack-safe reasoning
  // surface exists, pack mode shows an explicit unavailable state instead).
  // No fallback to the identified path.
  if (isReviewPacksEnabled()) {
    const { data: workRow } = await supabase
      .from('case_practitioner_work')
      .select('id, status')
      .eq('case_id', params.caseId)
      .in('status', [...PACK_MODE_ACTIVE_STATUSES])
      .limit(1)
      .maybeSingle()
    if (!workRow) return notFound()

    const pseudonym = makePseudonym(params.caseId)
    return (
      <main style={{ minHeight: '100vh', background: '#FAFAF9', color: '#1A1917' }}>
        <TopBar breadcrumb={[{ label: pseudonym }]} />
        <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 24px' }}>
          <p style={{ fontSize: '11px', color: '#B0AEA8', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '4px' }}>
            Clinical Reasoning — de-identified mode
          </p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 400, margin: '0 0 24px', lineHeight: 1.2 }}>
            {pseudonym}
          </h1>
          <section style={{ background: '#FFFFFF', border: '1px solid #E8E6E1', borderRadius: '12px', padding: '32px', textAlign: 'center' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 8px' }}>
              Reasoning trace is not available in de-identified review-pack mode yet.
            </h2>
            <p style={{ fontSize: '14px', color: '#8A8880', margin: 0, lineHeight: 1.6 }}>
              The reasoning trace is generated from the identified record and has
              not yet been through the de-identification pathway, so it cannot be
              shown here. The de-identified clinical summary is available in the
              case review workspace.
            </p>
          </section>
        </div>
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
