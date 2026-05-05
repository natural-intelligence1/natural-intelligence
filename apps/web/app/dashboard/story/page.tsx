import Link                         from 'next/link'
import { redirect }                 from 'next/navigation'
import type { Metadata }            from 'next'
import { createAdminClient, createServerSupabaseClient } from '@natural-intelligence/db'
import { getClientStory }           from '@natural-intelligence/db'
import { generateBodyStory }        from './actions'

export const metadata: Metadata = {
  title: "My Body’s Story",
  description: 'A personalised explanation of your body as a system — and a credible path forward.',
}

// ─── Fade-in animation (injected once via style tag) ─────────────────────────
function FadeStyles() {
  return (
    <style>{`
      @keyframes fadeSlideUp {
        from { opacity: 0; transform: translateY(12px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .story-section {
        animation: fadeSlideUp 500ms ease-out both;
      }
      .story-section:nth-child(2) { animation-delay: 80ms; }
      .story-section:nth-child(3) { animation-delay: 160ms; }
      .story-section:nth-child(4) { animation-delay: 240ms; }
    `}</style>
  )
}

// ─── Prose block renderer ─────────────────────────────────────────────────────
// Splits content by double newline. Bullet blocks → styled list. Plain → <p>.
function StoryProse({ content }: { content: string }) {
  const blocks = content.split(/\n\n+/).filter(Boolean)

  return (
    <div className="space-y-5">
      {blocks.map((block, i) => {
        const lines = block.split('\n').filter(Boolean)
        const allBullets = lines.every(l => /^[-•]/.test(l.trim()))

        if (allBullets) {
          return (
            <ul key={i} className="space-y-2 pl-0">
              {lines.map((line, j) => (
                <li
                  key={j}
                  className="flex gap-3 text-[17px] leading-relaxed text-text-secondary"
                >
                  <span className="mt-[5px] shrink-0 w-1 h-1 rounded-full bg-text-muted" />
                  <span>{line.replace(/^[-•]\s*/, '')}</span>
                </li>
              ))}
            </ul>
          )
        }

        // Mixed block
        const hasBullets = lines.some(l => /^[-•]/.test(l.trim()))
        if (hasBullets) {
          return (
            <div key={i} className="space-y-3">
              {lines.map((line, j) =>
                /^[-•]/.test(line.trim()) ? (
                  <div key={j} className="flex gap-3 text-[17px] leading-relaxed text-text-secondary">
                    <span className="mt-[5px] shrink-0 w-1 h-1 rounded-full bg-text-muted" />
                    <span>{line.replace(/^[-•]\s*/, '')}</span>
                  </div>
                ) : (
                  <p key={j} className="text-[17px] leading-[1.75] text-text-primary">{line}</p>
                )
              )}
            </div>
          )
        }

        return (
          <p key={i} className="text-[17px] leading-[1.75] text-text-primary">{block}</p>
        )
      })}
    </div>
  )
}

// ─── Section divider ──────────────────────────────────────────────────────────
function Divider() {
  return <div className="border-t border-border-default my-12" />
}

// ─── Phase block (Your Future Self) ──────────────────────────────────────────
function PhaseBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-text-muted">{label}</p>
      {children}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function StoryPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const adminClient = createAdminClient()

  // Check intake completion
  const { data: intake } = await adminClient
    .from('intake_responses')
    .select('is_complete')
    .eq('member_id', user.id)
    .eq('is_complete', true)
    .limit(1)
    .maybeSingle()

  // ── No intake completed ───────────────────────────────────────────────────
  if (!intake) {
    return (
      <div className="max-w-[720px] mx-auto px-4 py-12">
        <FadeStyles />
        <div className="story-section mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-3">My Body&apos;s Story</p>
          <h1 className="text-3xl font-medium text-text-primary leading-tight">
            Your health story isn&apos;t written yet.
          </h1>
        </div>
        <div className="story-section space-y-4 text-[17px] leading-[1.75] text-text-secondary">
          <p>
            Once you complete your health intake, we&apos;ll build a personalised explanation
            of what&apos;s happening in your body — and a clear path forward.
          </p>
          <p>
            This is not a report. It&apos;s how we make sense of you as a system.
          </p>
        </div>
        <div className="story-section mt-10">
          <Link
            href="/dashboard/intake"
            className="inline-block px-6 py-3 rounded-lg bg-brand-default hover:bg-brand-hover text-text-inverted text-sm font-medium transition-colors"
          >
            Start health intake →
          </Link>
        </div>
      </div>
    )
  }

  // ── Intake done — try to load the story ───────────────────────────────────
  const story = await getClientStory(adminClient, user.id)

  // ── Generating state ──────────────────────────────────────────────────────
  if (!story) {
    async function regenerate() {
      'use server'
      await generateBodyStory(user!.id)
    }

    return (
      <div className="max-w-[720px] mx-auto px-4 py-12">
        <FadeStyles />
        {/* Auto-refresh every 10 seconds while generating */}
        <meta httpEquiv="refresh" content="10" />
        <div className="story-section mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-3">My Body&apos;s Story</p>
          <h1 className="text-3xl font-medium text-text-primary leading-tight">
            Building your health story…
          </h1>
        </div>
        <div className="story-section space-y-5 text-[17px] leading-[1.75] text-text-secondary">
          <p>
            We&apos;re analysing your intake and constructing a picture of what&apos;s happening
            in your body. This takes about 30 seconds.
          </p>
          <p className="text-sm text-text-muted">This page refreshes automatically.</p>
        </div>
        <div className="story-section mt-10">
          <form action={regenerate}>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-lg border border-border-default text-sm font-medium text-text-secondary hover:bg-surface-muted transition-colors"
            >
              Generate now
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ── Story ready ───────────────────────────────────────────────────────────

  // Split future_self into phases for visual structure
  const futureSections = parseFutureSelf(story.future_self)

  async function regenerateStory() {
    'use server'
    await generateBodyStory(user!.id)
  }

  return (
    <div className="max-w-[720px] mx-auto px-4 py-12">
      <FadeStyles />

      {/* ── My Body's Story ───────────────────────────────────────────────── */}
      <div className="story-section mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-4">
          My Body&apos;s Story
        </p>
        <h1 className="text-3xl font-medium text-text-primary leading-tight">
          Why you&apos;re feeling the way you are.
        </h1>
      </div>

      <div className="story-section">
        <StoryProse content={story.body_story} />
      </div>

      <Divider />

      {/* ── Your Future Self ──────────────────────────────────────────────── */}
      <div className="story-section mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-4">
          Your Future Self
        </p>
        <h2 className="text-3xl font-medium text-text-primary leading-tight">
          What changes when you follow this path.
        </h2>
      </div>

      <div className="story-section space-y-10">
        {futureSections.intro && (
          <p className="text-[17px] leading-[1.75] text-text-secondary">{futureSections.intro}</p>
        )}

        {futureSections.phase1 && (
          <PhaseBlock label="Weeks 1–3">
            <StoryProse content={futureSections.phase1} />
          </PhaseBlock>
        )}

        {futureSections.phase2 && (
          <PhaseBlock label="Weeks 4–8">
            <StoryProse content={futureSections.phase2} />
          </PhaseBlock>
        )}

        {futureSections.phase3 && (
          <PhaseBlock label="Ongoing">
            <StoryProse content={futureSections.phase3} />
          </PhaseBlock>
        )}

        {futureSections.closing && (
          <div className="space-y-4 pt-4">
            {futureSections.closing.split('\n\n').filter(Boolean).map((block, i) => (
              <p key={i} className="text-[17px] leading-[1.75] text-text-secondary">{block}</p>
            ))}
          </div>
        )}
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div className="story-section mt-16 pt-8 border-t border-border-default flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Link
          href="/dashboard/dailypath"
          className="px-6 py-3 rounded-lg bg-brand-default hover:bg-brand-hover text-text-inverted text-sm font-medium transition-colors"
        >
          See your plan →
        </Link>
        <form action={regenerateStory}>
          <button
            type="submit"
            className="px-5 py-3 rounded-lg border border-border-default text-sm font-medium text-text-secondary hover:bg-surface-muted transition-colors"
          >
            Regenerate story
          </button>
        </form>
      </div>

      <p className="mt-6 text-xs text-text-muted leading-relaxed">
        This is for informational purposes only and does not constitute medical advice.
        A practitioner will review your case if needed.
      </p>
    </div>
  )
}

// ─── Parse future_self text into named phases ─────────────────────────────────
// Splits on phase headers. Works whether Claude uses "In the first few weeks:"
// or the labelled format from the system prompt.

function parseFutureSelf(text: string): {
  intro:   string
  phase1:  string
  phase2:  string
  phase3:  string
  closing: string
} {
  const intro1Marker  = /if we follow this path/i
  const phase1Marker  = /in the first few weeks[:\s]/i
  const phase2Marker  = /after 4[–-]8 weeks[:\s]/i
  const phase3Marker  = /over the following months[:\s]/i
  const closingMarker = /this is not about quick fixes/i

  function extractBetween(txt: string, from: RegExp, to: RegExp): string {
    const start = txt.search(from)
    if (start === -1) return ''
    const sub = txt.slice(start)
    const end = sub.search(to)
    return end === -1 ? sub.trim() : sub.slice(0, end).trim()
  }

  const intro   = extractBetween(text, intro1Marker, phase1Marker)
  const phase1  = extractBetween(text, phase1Marker, phase2Marker)
  const phase2  = extractBetween(text, phase2Marker, phase3Marker)
  const phase3  = extractBetween(text, phase3Marker, closingMarker)
  const closingStart = text.search(closingMarker)
  const closing = closingStart !== -1 ? text.slice(closingStart).trim() : ''

  return { intro, phase1, phase2, phase3, closing }
}
