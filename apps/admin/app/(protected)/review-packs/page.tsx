import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'
import { GenerateForm } from './GenerateForm'

export const metadata: Metadata = { title: 'Review packs' }
export const dynamic = 'force-dynamic'

// Sprint 3 — admin-only review-pack generation queue. Lists cases and the
// latest de-identified pack version for each; generation is the explicit
// server action in ./actions.ts (service-role, audit row written to the
// admin-only review_pack_audit table). Degraded until migration 0051 is
// applied: the pack table is absent, so the listing shows cases with no pack
// state and generation returns a clear error. This page never exposes pack
// audit/source fields to practitioners — it is inside the admin app and
// guarded per-page.

interface CaseRow {
  id: string
  client_id: string
  status: string
  created_at: string
}

interface PackRow {
  case_id: string
  pseudonym: string
  pack_version: number
  generated_at: string
}

export default async function ReviewPacksPage() {
  // Defence-in-depth admin guard (convention: layout + per-page)
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('https://natural-intelligence.uk')

  const { data: caseRows } = await adminClient
    .from('client_cases')
    .select('id, client_id, status, created_at')
    .order('created_at', { ascending: false })
    .limit(100)
  const cases = (caseRows ?? []) as CaseRow[]

  // Final review, item 6: a pack can only be generated from a COMPLETED
  // intake, so members without one are visibly labelled and their generate
  // button disabled — admins cannot attempt impossible packs.
  const memberIds = [...new Set(cases.map((c) => c.client_id))]
  const completedIntakeMembers = new Set<string>()
  if (memberIds.length > 0) {
    const { data: intakeRows } = await adminClient
      .from('intake_responses')
      .select('member_id, is_complete')
      .in('member_id', memberIds)
      .eq('is_complete', true)
    for (const r of intakeRows ?? []) completedIntakeMembers.add(r.member_id)
  }

  // Loose client: table arrives with unapplied migration 0051, so it is not
  // in the generated types yet (repo pattern for pre-typegen tables).
  // eslint-disable-next-line
  const { data: packRows, error: packErr } = await (adminClient as any)
    .from('practitioner_review_packs')
    .select('case_id, pseudonym, pack_version, generated_at')
    .order('pack_version', { ascending: false })

  const latestByCase = new Map<string, PackRow>()
  if (!packErr) {
    for (const p of (packRows ?? []) as PackRow[]) {
      if (!latestByCase.has(p.case_id)) latestByCase.set(p.case_id, p)
    }
  }

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-semibold text-text-primary mb-1">Review packs</h1>
      <p className="text-sm text-text-secondary mb-6 max-w-2xl">
        De-identified practitioner review packs. Generation reads the identified
        intake once server-side, applies the default-deny de-identifier, and
        stores the pack with an internal audit record. Regeneration always
        creates a new version. Generation requires the member&apos;s active
        consent for de-identified synopsis sharing and is refused when a
        restriction or withdrawal is on file. DRAFT — requires
        solicitor/clinician review before real-client use.
      </p>

      {packErr && (
        <div className="mb-6 px-4 py-3 rounded-md bg-status-warningBg text-status-warningText border border-status-warningBorder text-sm">
          Pack storage is not available yet (migration 0051 not applied). Cases
          are listed below, but generation will fail until the migration is
          applied with Founder authorisation.
        </div>
      )}

      {cases.length === 0 ? (
        <p className="text-sm text-text-muted">No client cases found.</p>
      ) : (
        <div className="space-y-3">
          {cases.map((c) => {
            const pack = latestByCase.get(c.id)
            const intakeComplete = completedIntakeMembers.has(c.client_id)
            return (
              <div key={c.id} className="flex items-center justify-between gap-4 px-4 py-3 rounded-lg bg-surface-raised border border-border-default">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary font-mono truncate">{c.id}</p>
                  <p className="text-xs text-text-muted">
                    Case status: {c.status} · created {new Date(c.created_at).toLocaleDateString('en-GB')}
                    {pack
                      ? ` · latest pack ${pack.pseudonym} v${pack.pack_version} (${new Date(pack.generated_at).toLocaleDateString('en-GB')})`
                      : ' · no pack generated'}
                  </p>
                  {!intakeComplete && (
                    <p className="text-xs text-status-warningText mt-1">
                      No completed intake — cannot generate.
                    </p>
                  )}
                </div>
                {intakeComplete ? (
                  <GenerateForm caseId={c.id} hasPack={Boolean(pack)} />
                ) : (
                  <span className="px-3 py-1.5 rounded-md text-xs font-semibold bg-surface-muted text-text-muted border border-border-default cursor-not-allowed select-none">
                    Generate pack
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
