import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'
import { BlochSphere } from './BlochSphere'
import type { SpherePoint } from './BlochSphere'

// bg-surface-raised → bg-surface-raised (design token alignment)

interface PageProps {
  params: { sessionId: string }
}

const severityLabel: Record<number, string> = {
  1: 'Mild',
  2: 'Moderate',
  3: 'Significant',
}

export default async function RootFinderResultsPage({ params }: PageProps) {
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

  // Fetch results for this session — gated to the requesting member
  const { data: rawResults } = await adminClient
    .from('rootfinder_results')
    .select(`
      id,
      rank,
      weighted_score,
      confidence_score,
      symptom_count,
      root_cause_id,
      root_causes(id, name, key, colour, description, sphere_position_theta, sphere_position_phi)
    `)
    .eq('session_id', params.sessionId)
    .eq('member_id', user.id)
    .order('rank', { ascending: true })

  if (!rawResults || rawResults.length === 0) notFound()

  interface ResultRow {
    id: string
    rank: number
    weightedScore: number
    confidenceScore: number
    symptomCount: number
    rootCause: {
      id: string
      name: string
      key: string
      colour: string | null
      description: string | null
      sphere_position_theta: number | null
      sphere_position_phi: number | null
    }
  }

  const results: ResultRow[] = (rawResults as any[]).map((r) => ({
    id:              r.id,
    rank:            r.rank,
    weightedScore:   r.weighted_score,
    confidenceScore: r.confidence_score,
    symptomCount:    r.symptom_count,
    rootCause:       r.root_causes,
  }))

  const primary   = results[0]
  const secondary = results.slice(1)

  // Fetch matching protocol template for the primary root cause
  const { data: suggestedTemplate } = await adminClient
    .from('protocol_templates')
    .select('id, name, description')
    .eq('root_cause_key', primary.rootCause.key)
    .eq('status', 'published')
    .limit(1)
    .maybeSingle()

  // Fetch symptom logs for this session
  const { data: rawLogs } = await adminClient
    .from('member_symptom_logs')
    .select('id, severity, symptoms(id, name, category)')
    .eq('session_id', params.sessionId)
    .eq('member_id', user.id)

  const logs = (rawLogs as any[] ?? [])
    .map((l) => ({
      id:       l.id,
      severity: l.severity as number,
      symptom:  l.symptoms as { id: string; name: string; category: string | null } | null,
    }))
    .filter((l) => l.symptom !== null)

  // Build sphere points for BlochSphere animation
  const spherePoints: SpherePoint[] = results.map((r) => ({
    theta:      r.rootCause.sphere_position_theta ?? Math.PI / 2,
    phi:        r.rootCause.sphere_position_phi   ?? 0,
    confidence: r.confidenceScore,
    colour:     r.rootCause.colour ?? '#B8935A',
    name:       r.rootCause.name,
  }))

  return (
    <div className="min-h-screen">

      {/* ── Dark Obsidian header ──────────────────────────────────────────────── */}
      <div className="bg-[#0E0D0B] py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/dashboard/rootfinder"
            className="inline-flex items-center text-xs text-[#B8935A] hover:text-[#c9a96b] mb-8 transition-colors"
          >
            ← Run again
          </Link>

          <div className="flex flex-col sm:flex-row items-center gap-8">
            {/* Bloch sphere */}
            <BlochSphere points={spherePoints} />

            {/* Primary finding */}
            <div className="flex-1 text-center sm:text-left">
              <p className="text-xs font-semibold text-[#B8935A] uppercase tracking-wider mb-2">
                Primary finding
              </p>
              <h1 className="text-3xl font-bold text-[#F8F6F2] mb-3 leading-tight">
                {primary.rootCause.name}
              </h1>

              {/* Confidence bar */}
              <div className="flex items-center gap-2 justify-center sm:justify-start mb-4">
                <div className="h-1.5 w-28 rounded-full bg-[#2a2925] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#B8935A] transition-all"
                    style={{ width: `${Math.round(primary.confidenceScore * 100)}%` }}
                  />
                </div>
                <span className="text-xs text-[#8a8579]">
                  {Math.round(primary.confidenceScore * 100)}% confidence
                </span>
              </div>

              {primary.rootCause.description && (
                <p className="text-sm text-[#8a8579] leading-relaxed max-w-md">
                  {primary.rootCause.description}
                </p>
              )}

              <p className="text-xs text-[#5a5850] mt-4">
                Based on {primary.symptomCount} symptom{primary.symptomCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Light body ───────────────────────────────────────────────────────── */}
      <div className="bg-[#F8F6F2] py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-8">

          {/* Secondary findings */}
          {secondary.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">
                Also contributing
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {secondary.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-xl border border-border-default bg-surface-raised p-5"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {r.rootCause.colour && (
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: r.rootCause.colour }}
                        />
                      )}
                      <p className="text-sm font-semibold text-text-primary">{r.rootCause.name}</p>
                    </div>

                    {/* Mini confidence bar */}
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-1 flex-1 rounded-full bg-surface-muted overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.round(r.confidenceScore * 100)}%`,
                            backgroundColor: r.rootCause.colour ?? '#B8935A',
                          }}
                        />
                      </div>
                      <span className="text-xs text-text-muted">
                        {Math.round(r.confidenceScore * 100)}%
                      </span>
                    </div>

                    {r.rootCause.description && (
                      <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">
                        {r.rootCause.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* DailyPath protocol suggestion */}
          {suggestedTemplate && (
            <section className="bg-[#F8F1E4] border border-[#B8935A]/30 rounded-xl p-5">
              <p className="text-[10px] font-medium text-text-brand uppercase tracking-widest mb-1">
                Recommended next step
              </p>
              <h2 className="text-base font-semibold text-text-primary mb-1">
                Start the {suggestedTemplate.name}
              </h2>
              {suggestedTemplate.description && (
                <p className="text-sm text-text-secondary leading-relaxed mb-3 line-clamp-2">
                  {suggestedTemplate.description.slice(0, 100)}{suggestedTemplate.description.length > 100 ? '…' : ''}
                </p>
              )}
              <Link
                href={`/dashboard/dailypath?template=${suggestedTemplate.id}`}
                className="text-sm font-medium text-text-brand hover:text-text-primary transition-colors"
              >
                Start this protocol →
              </Link>
            </section>
          )}

          {/* What to do with this */}
          <section className="rounded-xl border border-border-default bg-surface-raised p-6">
            <h2 className="text-sm font-semibold text-text-primary mb-3">What to do with this</h2>
            <p className="text-sm text-text-secondary leading-relaxed mb-4">
              These findings are a starting point — patterns from your symptoms matched against our
              functional root cause library. They&apos;re not a diagnosis.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link
                href="/directory"
                className="flex items-center gap-2 p-3 rounded-lg border border-border-default hover:bg-surface-muted transition-colors group"
              >
                <span className="text-text-brand text-sm">→</span>
                <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
                  Find a practitioner
                </span>
              </Link>
              <Link
                href="/dashboard/biohub"
                className="flex items-center gap-2 p-3 rounded-lg border border-border-default hover:bg-surface-muted transition-colors group"
              >
                <span className="text-text-brand text-sm">→</span>
                <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
                  Upload a lab report
                </span>
              </Link>
            </div>
          </section>

          {/* Collapsible symptom log */}
          {logs.length > 0 && (
            <section>
              <details className="rounded-xl border border-border-default bg-surface-raised overflow-hidden">
                <summary className="px-6 py-4 cursor-pointer text-sm font-semibold text-text-primary list-none flex items-center justify-between select-none">
                  Symptoms you logged ({logs.length})
                  <span className="text-text-muted text-xs">▼</span>
                </summary>
                <div className="px-6 pb-5 border-t border-border-default">
                  <div className="flex flex-wrap gap-2 pt-4">
                    {logs.map((l) => (
                      <span
                        key={l.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border bg-surface-muted border-border-default text-text-secondary"
                      >
                        {l.symptom?.name}
                        {l.severity && (
                          <span className="opacity-60 font-normal">
                            · {severityLabel[l.severity] ?? l.severity}
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              </details>
            </section>
          )}

        </div>
      </div>
    </div>
  )
}
