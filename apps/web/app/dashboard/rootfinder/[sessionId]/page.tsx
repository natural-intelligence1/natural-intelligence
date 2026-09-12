import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'
import { themeLabel } from '../themeLabels'

// ─── RootFinder pattern summary (SaMD softening — counsel ruling) ─────────────
// Self-serve RootFinder is broad educational symptom grouping ONLY. This page
// deliberately does NOT render: confidence scores or bars, primary/secondary
// ranking, the Bloch sphere (its geometry visualised ranking), dysfunction/
// pathophysiology names (display-layer theme labels are used instead — see
// ../themeLabels.ts), stored clinical descriptions, or protocol suggestions.
// The underlying data and components are retained for possible future
// practitioner-facing use behind Legal/MHRA review, but no uncleared output
// reaches the self-serve surface.

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

  // Fetch results for this session — gated to the requesting member. Only the
  // theme key is used for display; scores/ranks are not shown.
  const { data: rawResults } = await adminClient
    .from('rootfinder_results')
    .select('id, root_causes(key)')
    .eq('session_id', params.sessionId)
    .eq('member_id', user.id)

  if (!rawResults || rawResults.length === 0) notFound()

  // Unranked, de-duplicated, alphabetical broad themes — no ordering by score.
  const themes = [...new Set(
    (rawResults as any[]).map((r) => themeLabel(r.root_causes?.key)),
  )].sort((a, b) => a.localeCompare(b))

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

  return (
    <div className="min-h-screen bg-[#F8F6F2] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header */}
        <div>
          <Link
            href="/dashboard/rootfinder"
            className="inline-flex items-center text-xs text-text-brand hover:text-text-primary mb-6 transition-colors"
          >
            ← Choose symptoms again
          </Link>
          <p className="text-xs font-semibold text-text-brand uppercase tracking-wider mb-1">
            Pattern summary
          </p>
          <h1 className="text-2xl font-bold text-text-primary mb-2">
            Areas you may want to explore
          </h1>
          <p className="text-sm text-text-secondary leading-relaxed max-w-2xl">
            Based on the symptoms you selected, here are some broad wellbeing
            themes for reflection and practitioner discussion. They are listed
            alphabetically — the order carries no meaning.
          </p>
        </div>

        {/* Broad themes — unranked, no scores, no descriptions */}
        <section>
          <div className="flex flex-wrap gap-2.5">
            {themes.map((t) => (
              <span
                key={t}
                className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium border bg-surface-raised border-border-default text-text-primary"
              >
                Area to explore: {t}
              </span>
            ))}
          </div>
        </section>

        {/* Boundary copy */}
        <section className="rounded-xl border border-status-warningBorder bg-status-warningBg px-5 py-4">
          <p className="text-sm text-status-warningText leading-relaxed">
            This tool does not diagnose, treat, predict or recommend care. It
            groups the symptoms you chose into broad educational themes. Use
            this information for education and discussion with a qualified
            practitioner. For urgent concerns, contact your GP, NHS 111 or
            emergency services.
          </p>
        </section>

        {/* What to do with this */}
        <section className="rounded-xl border border-border-default bg-surface-raised p-6">
          <h2 className="text-sm font-semibold text-text-primary mb-3">What to do with this</h2>
          <p className="text-sm text-text-secondary leading-relaxed mb-4">
            A good next step is to bring this summary — and the symptom list
            below — to a conversation with a qualified practitioner, who can
            look at the whole picture with you.
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
                Organise a lab report
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
  )
}
