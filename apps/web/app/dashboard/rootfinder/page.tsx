import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'
import { SymptomCloud } from './SymptomCloud'

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
      .select('session_id, confidence_score, created_at, root_causes(name, colour)')
      .eq('member_id', user.id)
      .eq('rank', 1)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const lastCause = lastResult
    ? {
        name:       (lastResult as any).root_causes?.name as string | null,
        colour:     (lastResult as any).root_causes?.colour as string | null,
        sessionId:  lastResult.session_id,
        confidence: lastResult.confidence_score,
        date:       lastResult.created_at,
      }
    : null

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-semibold text-text-brand uppercase tracking-wider mb-1">RootFinder</p>
        <h1 className="text-2xl font-bold text-text-primary mb-2">
          What&apos;s going on with your body?
        </h1>
        <p className="text-sm text-text-secondary">
          Select everything you&apos;ve been experiencing. We&apos;ll find the common thread.
        </p>
      </div>

      {/* State B — previous result summary card */}
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
              <p className="text-xs text-text-muted mb-0.5">Last analysis</p>
              <p className="text-sm font-semibold text-text-primary truncate">{lastCause.name}</p>
              <p className="text-xs text-text-secondary mt-0.5">
                {Math.round(lastCause.confidence * 100)}% confidence
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
