import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'
import { SymptomCloud } from './SymptomCloud'
import { themeLabel } from './themeLabels'

export default async function RootFinderPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'practitioner') redirect('/dashboard/practitioner')

  const adminClient = createAdminClient()

  const [{ data: symptoms }, { data: lastResult }] = await Promise.all([
    adminClient
      .from('symptoms')
      .select('id, name, category')
      .order('name', { ascending: true }),
    adminClient
      .from('rootfinder_results')
      .select('session_id, created_at, root_causes(key, colour)')
      .eq('member_id', user.id)
      .eq('rank', 1)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  // Display-layer theme label only (SaMD softening): no dysfunction names,
  // no confidence score reaches the page.
  const lastCause = lastResult
    ? {
        name:       themeLabel((lastResult as any).root_causes?.key as string | null),
        colour:     (lastResult as any).root_causes?.colour as string | null,
        sessionId:  lastResult.session_id,
        date:       lastResult.created_at,
      }
    : null

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header — educational framing only (SaMD wording softening): no
          certainty, diagnosis or root-cause-finding claims. */}
      <div className="mb-8">
        <p className="text-xs font-semibold text-text-brand uppercase tracking-wider mb-1">RootFinder</p>
        <h1 className="text-2xl font-bold text-text-primary mb-2">
          Organise your symptoms into patterns
        </h1>
        <p className="text-sm text-text-secondary mb-3">
          Select what you&apos;ve noticed. We&apos;ll group your symptoms into areas
          you may want to explore.
        </p>
        <p className="text-xs text-text-muted leading-relaxed">
          This tool does not diagnose, treat or recommend care. Use this
          information for education and discussion with a qualified
          practitioner. For urgent concerns, contact your GP, NHS 111 or
          emergency services.
        </p>
      </div>

      {/* State B — previous pattern summary card */}
      {lastCause && lastCause.name && (
        <div className="rounded-xl border border-border-default bg-surface-raised p-5 mb-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {lastCause.colour && (
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: lastCause.colour }}
              />
            )}
            <div className="min-w-0">
              <p className="text-xs text-text-muted mb-0.5">Pattern summary</p>
              <p className="text-sm font-semibold text-text-primary truncate">
                Area to explore: {lastCause.name}
              </p>
              <p className="text-xs text-text-secondary mt-0.5">
                For reflection and practitioner discussion
                {lastCause.date && (
                  <> · {new Date(lastCause.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</>
                )}
              </p>
            </div>
          </div>
          <Link
            href={`/dashboard/rootfinder/${lastCause.sessionId}`}
            className="flex-shrink-0 px-4 py-2 rounded-lg border border-border-default text-sm font-medium text-text-secondary hover:bg-surface-muted transition-colors"
          >
            View
          </Link>
        </div>
      )}

      {/* Symptom cloud — client component handles interactivity */}
      <SymptomCloud symptoms={symptoms ?? []} />
    </div>
  )
}
