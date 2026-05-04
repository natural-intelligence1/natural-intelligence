import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createAdminClient, createServerSupabaseClient } from '@natural-intelligence/db'
import { generateHealthSynopsis, rateSynopsis } from './actions'

export const metadata: Metadata = {
  title: 'My health synopsis',
  description: 'Your personalised AI-generated health overview based on your intake and data.',
}

// ─── Prose renderer ───────────────────────────────────────────────────────────
// Splits content by double newline; detects bullet lines; renders with design tokens.
function ProseRenderer({ content }: { content: string }) {
  const paragraphs = content.split(/\n\n+/)

  return (
    <div className="space-y-4 text-sm text-text-primary leading-relaxed">
      {paragraphs.map((para, i) => {
        const lines = para.split('\n')
        const isBulletBlock = lines.every(l => /^[-•]\s/.test(l.trim()))

        if (isBulletBlock) {
          return (
            <ul
              key={i}
              className="space-y-2 border-l-2 border-brand-default pl-4 ml-0"
            >
              {lines.map((line, j) => (
                <li key={j} className="text-text-secondary">
                  {line.replace(/^[-•]\s+/, '')}
                </li>
              ))}
            </ul>
          )
        }

        // Mixed paragraph: some lines may be bullets
        const hasBullets = lines.some(l => /^[-•]\s/.test(l.trim()))
        if (hasBullets) {
          return (
            <div key={i} className="space-y-2">
              {lines.map((line, j) => {
                if (/^[-•]\s/.test(line.trim())) {
                  return (
                    <div key={j} className="border-l-2 border-brand-default pl-4">
                      <p className="text-text-secondary">{line.replace(/^[-•]\s+/, '')}</p>
                    </div>
                  )
                }
                return <p key={j}>{line}</p>
              })}
            </div>
          )
        }

        return <p key={i}>{para}</p>
      })}
    </div>
  )
}

// ─── Confidence badge ─────────────────────────────────────────────────────────
function ConfidenceBadge({ confidence }: { confidence: string | null }) {
  const label = confidence === 'high' ? 'High confidence'
    : confidence === 'medium' ? 'Medium confidence'
    : 'Limited data'
  const cls = confidence === 'high'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : confidence === 'medium'
    ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-surface-muted text-text-muted border-border-default'

  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full border text-xs font-medium ${cls}`}>
      {label}
    </span>
  )
}

// ─── Star rating (client-side via form action) ────────────────────────────────
function StarRating({ synopsisId }: { synopsisId: string }) {
  async function handleRate(formData: FormData) {
    'use server'
    const rating = Number(formData.get('rating'))
    if (rating >= 1 && rating <= 5) {
      await rateSynopsis(synopsisId, rating)
    }
  }

  return (
    <form action={handleRate} className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="submit"
          name="rating"
          value={String(n)}
          className="text-xl text-text-muted hover:text-[#B8935A] transition-colors"
          title={`Rate ${n} star${n !== 1 ? 's' : ''}`}
        >
          ★
        </button>
      ))}
      <span className="text-xs text-text-muted ml-2">Rate this synopsis</span>
    </form>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function SynopsisPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const adminClient = createAdminClient()

  const [{ data: intake }, { data: synopsis }, { data: biomarkers }, { data: rootfinder }] = await Promise.all([
    adminClient
      .from('intake_responses')
      .select('id, completed_sections, is_complete, created_at')
      .eq('member_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    adminClient
      .from('ai_summaries')
      .select('id, content, content_short, confidence, generated_at, model_used, member_rating, source_intake_id')
      .eq('member_id', user.id)
      .eq('summary_type', 'health_synopsis')
      .eq('is_current', true)
      .maybeSingle(),
    adminClient
      .from('biomarker_results')
      .select('id')
      .eq('member_id', user.id)
      .limit(1),
    adminClient
      .from('rootfinder_results')
      .select('id')
      .eq('member_id', user.id)
      .limit(1),
  ])

  const hasIntake       = intake !== null
  const intakeComplete  = Boolean(intake?.is_complete)
  const hasSynopsis     = synopsis !== null
  const hasBiomarkers   = (biomarkers?.length ?? 0) > 0
  const hasRootfinder   = (rootfinder?.length ?? 0) > 0
  const sectionsComplete = intake?.completed_sections ?? 0

  // ── State A: No intake at all ─────────────────────────────────────────────
  if (!hasIntake) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <p className="text-xs font-semibold text-text-brand uppercase tracking-wider mb-1">My synopsis</p>
          <h1 className="text-2xl font-bold text-text-primary">Your health synopsis</h1>
          <p className="text-sm text-text-secondary mt-1">
            Complete your health intake to receive a personalised AI health overview.
          </p>
        </div>
        <section className="rounded-xl border border-border-default bg-surface-raised p-8 text-center">
          <div className="text-4xl mb-4">📋</div>
          <h2 className="text-base font-semibold text-text-primary mb-2">Start your health intake</h2>
          <p className="text-sm text-text-secondary leading-relaxed mb-6 max-w-sm mx-auto">
            Answer 6 short sections about your health, symptoms, and lifestyle. Takes about 5 minutes.
          </p>
          <Link
            href="/dashboard/intake"
            className="inline-block px-6 py-2.5 rounded-lg bg-brand-default hover:bg-brand-hover text-text-inverted text-sm font-medium transition-colors"
          >
            Start health intake →
          </Link>
        </section>
      </div>
    )
  }

  // ── State B: Intake started but not complete ──────────────────────────────
  if (!intakeComplete) {
    const pct = Math.round((sectionsComplete / 6) * 100)
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <p className="text-xs font-semibold text-text-brand uppercase tracking-wider mb-1">My synopsis</p>
          <h1 className="text-2xl font-bold text-text-primary">Your health synopsis</h1>
        </div>
        <section className="rounded-xl border border-border-default bg-surface-raised p-6">
          <h2 className="text-sm font-semibold text-text-primary mb-1">Intake in progress</h2>
          <p className="text-sm text-text-secondary mb-4">
            You&apos;ve completed {sectionsComplete} of 6 sections. Finish your intake to generate your synopsis.
          </p>
          <div className="h-2 w-full rounded-full bg-surface-muted overflow-hidden mb-4">
            <div
              className="h-full rounded-full bg-brand-default transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-text-muted mb-5">{pct}% complete</p>
          <Link
            href="/dashboard/intake"
            className="inline-block px-5 py-2.5 rounded-lg bg-brand-default hover:bg-brand-hover text-text-inverted text-sm font-medium transition-colors"
          >
            Continue intake →
          </Link>
        </section>
      </div>
    )
  }

  // ── State C: Intake complete but no synopsis yet (generating) ─────────────
  if (!hasSynopsis) {
    async function regenerate() {
      'use server'
      await generateHealthSynopsis(user!.id)
    }

    return (
      <div className="max-w-2xl mx-auto">
        {/* Auto-refresh every 8 seconds while generating */}
        <meta httpEquiv="refresh" content="8" />
        <div className="mb-8">
          <p className="text-xs font-semibold text-text-brand uppercase tracking-wider mb-1">My synopsis</p>
          <h1 className="text-2xl font-bold text-text-primary">Your health synopsis</h1>
        </div>
        <section className="rounded-xl border border-border-default bg-surface-raised p-8 text-center">
          <div className="text-4xl mb-4 animate-pulse">🧬</div>
          <h2 className="text-base font-semibold text-text-primary mb-2">Generating your synopsis…</h2>
          <p className="text-sm text-text-secondary leading-relaxed mb-6 max-w-sm mx-auto">
            Claude is analysing your health data and building your personalised overview. This usually takes under 30 seconds.
          </p>
          <p className="text-xs text-text-muted mb-6">This page refreshes automatically.</p>
          <form action={regenerate}>
            <button
              type="submit"
              className="inline-block px-5 py-2.5 rounded-lg border border-border-default text-sm font-medium text-text-secondary hover:bg-surface-muted transition-colors"
            >
              Regenerate now
            </button>
          </form>
        </section>
      </div>
    )
  }

  // ── State D: Synopsis ready ───────────────────────────────────────────────
  async function regenerateSynopsis() {
    'use server'
    await generateHealthSynopsis(user!.id)
  }

  const generatedDate = synopsis.generated_at
    ? new Date(synopsis.generated_at).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : null

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <p className="text-xs font-semibold text-text-brand uppercase tracking-wider mb-1">My synopsis</p>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold text-text-primary">Your health synopsis</h1>
          <ConfidenceBadge confidence={synopsis.confidence} />
        </div>
        {generatedDate && (
          <p className="text-xs text-text-muted mt-1">Generated {generatedDate}</p>
        )}
      </div>

      {/* Main synopsis content */}
      <section className="rounded-xl border border-border-default bg-surface-raised p-6 mb-6">
        <ProseRenderer content={synopsis.content} />
      </section>

      {/* Data sources */}
      <section className="rounded-xl border border-border-default bg-surface-muted p-5 mb-6">
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Data sources used</h3>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-sm">
            <span className={intakeComplete ? 'text-emerald-600' : 'text-text-muted'}>
              {intakeComplete ? '✓' : '○'}
            </span>
            <span className={intakeComplete ? 'text-text-primary' : 'text-text-muted'}>
              Health intake form
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className={hasBiomarkers ? 'text-emerald-600' : 'text-text-muted'}>
              {hasBiomarkers ? '✓' : '○'}
            </span>
            <span className={hasBiomarkers ? 'text-text-primary' : 'text-text-muted'}>
              Lab biomarker results
              {!hasBiomarkers && (
                <Link href="/dashboard/biohub" className="ml-1.5 text-text-brand hover:underline text-xs">
                  Upload a report →
                </Link>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className={hasRootfinder ? 'text-emerald-600' : 'text-text-muted'}>
              {hasRootfinder ? '✓' : '○'}
            </span>
            <span className={hasRootfinder ? 'text-text-primary' : 'text-text-muted'}>
              Root cause analysis
              {!hasRootfinder && (
                <Link href="/dashboard/rootfinder" className="ml-1.5 text-text-brand hover:underline text-xs">
                  Run analysis →
                </Link>
              )}
            </span>
          </div>
        </div>
        {synopsis.model_used && (
          <p className="text-[10px] text-text-muted mt-3">
            Generated by {synopsis.model_used} · Natural Intelligence
          </p>
        )}
      </section>

      {/* Rating */}
      {!synopsis.member_rating && (
        <section className="rounded-xl border border-border-default bg-surface-raised p-5 mb-6">
          <StarRating synopsisId={synopsis.id} />
        </section>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <form action={regenerateSynopsis}>
          <button
            type="submit"
            className="px-4 py-2.5 rounded-lg border border-border-default text-sm font-medium text-text-secondary hover:bg-surface-muted transition-colors"
          >
            ↻ Regenerate synopsis
          </button>
        </form>
        <Link
          href="/directory"
          className="px-4 py-2.5 rounded-lg bg-brand-default hover:bg-brand-hover text-text-inverted text-sm font-medium transition-colors"
        >
          Find a practitioner →
        </Link>
      </div>

      <p className="text-xs text-text-muted mt-6 leading-relaxed">
        This synopsis is for informational purposes only and does not constitute medical advice.
        Always consult a qualified healthcare professional before making health decisions.
      </p>
    </div>
  )
}
