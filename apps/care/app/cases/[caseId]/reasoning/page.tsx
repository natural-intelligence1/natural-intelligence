import { notFound }                   from 'next/navigation'
import type { Metadata }              from 'next'
import { createServerSupabaseClient } from '@natural-intelligence/db'
import { getPractitionerTrace }       from '@natural-intelligence/db/crt'
import { ReasoningPageView }          from '@/components/reasoning'
import { TopBar }                     from '@/components/TopBar'

export const metadata: Metadata = { title: 'Clinical Reasoning — NI Care' }

export default async function ReasoningPage({
  params,
}: {
  params: { caseId: string }
}) {
  // Authenticated SSR client — RLS (case_practitioner_select) ensures
  // only practitioners with assigned/in_review work on this case can load it.
  const supabase = createServerSupabaseClient()

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
