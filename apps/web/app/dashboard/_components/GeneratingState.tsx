'use client'

// Shared "generating…" UI for the synopsis and body-story pages.
//
// V.8 / M1 — true client-side timeout. The previous implementation on the
// body story page used intake_responses.created_at as a timestamp proxy,
// which broke for returning users (intake completed weeks ago →
// immediately past the 5-minute timeout). The synopsis page had no
// timeout at all (stuck "Generating" forever if no row appeared).
//
// This component owns the timer client-side: a per-page sessionStorage
// key records the moment the user first saw the generating state for the
// current attempt; the timer fires the failure UI at 5 minutes regardless
// of any server timestamp. Server is still re-fetched every 8 seconds
// via router.refresh() — when the trace lands, the parent server
// component renders the ready state and unmounts this component.
//
// Copy bands:
//   0 – 30 s   "This usually takes under 30 seconds."
//  30 s – 5 m  "Still working on this — almost there."
//  > 5 m       failure state with Try again

import { useEffect, useState }   from 'react'
import { useRouter }              from 'next/navigation'

const REFRESH_EVERY_MS = 8_000
const SOFT_BAND_MS     = 30_000
const TIMEOUT_MS       = 5 * 60_000

interface GeneratingStateProps {
  storageKey:        string                       // 'gen.synopsis' / 'gen.story'
  title:             string                       // e.g. "Generating your synopsis…"
  description:       string                       // calm one-liner about what's happening
  failureHeading:    string                       // e.g. "We couldn't put this together this time."
  failureBody:       string                       // e.g. "You can try again, or come back later."
  retryLabel:        string                       // e.g. "Try again"
  generateLabel:     string                       // e.g. "Generate now"
  regenerateAction:  () => void | Promise<void>   // server action — bound in parent
  className?:        string                       // optional outer styling hook
}

export function GeneratingState({
  storageKey,
  title,
  description,
  failureHeading,
  failureBody,
  retryLabel,
  generateLabel,
  regenerateAction,
  className,
}: GeneratingStateProps) {
  const router = useRouter()
  const [elapsedMs, setElapsedMs] = useState(0)

  useEffect(() => {
    // First-mount-or-resume timestamp. Persists across the meta-refresh
    // re-renders of the parent so the timer cannot get reset back to zero
    // every time the page polls.
    let storedStart = sessionStorage.getItem(storageKey)
    if (!storedStart) {
      storedStart = String(Date.now())
      sessionStorage.setItem(storageKey, storedStart)
    }
    const startedAt = Number(storedStart)

    const tickId = setInterval(() => {
      setElapsedMs(Date.now() - startedAt)
    }, 1_000)

    const refreshId = setInterval(() => {
      router.refresh()
    }, REFRESH_EVERY_MS)

    return () => {
      clearInterval(tickId)
      clearInterval(refreshId)
    }
  }, [storageKey, router])

  function resetTimer() {
    // Called from the Try-again form-submit click so the next attempt
    // starts a fresh 5-minute window.
    try { sessionStorage.removeItem(storageKey) } catch { /* ignore */ }
  }

  // ── Failure band ────────────────────────────────────────────────────────
  if (elapsedMs >= TIMEOUT_MS) {
    return (
      <section
        className={
          className ??
          'rounded-xl border border-border-default bg-surface-raised p-8 text-center'
        }
      >
        <h2 className="text-base font-semibold text-text-primary mb-2">
          {failureHeading}
        </h2>
        <p className="text-sm text-text-secondary leading-relaxed mb-6 max-w-sm mx-auto">
          {failureBody}
        </p>
        <form action={regenerateAction}>
          <button
            type="submit"
            onClick={resetTimer}
            className="inline-block px-6 py-2.5 rounded-lg bg-brand-default hover:bg-brand-hover text-text-inverted text-sm font-medium transition-colors"
          >
            {retryLabel}
          </button>
        </form>
      </section>
    )
  }

  // ── Generating band ─────────────────────────────────────────────────────
  const subtitle =
    elapsedMs < SOFT_BAND_MS
      ? 'This usually takes under 30 seconds.'
      : 'Still working on this — almost there.'

  return (
    <section
      className={
        className ??
        'rounded-xl border border-border-default bg-surface-raised p-8 text-center'
      }
    >
      <div className="text-4xl mb-4 animate-pulse">🧬</div>
      <h2 className="text-base font-semibold text-text-primary mb-2">{title}</h2>
      <p className="text-sm text-text-secondary leading-relaxed mb-2 max-w-sm mx-auto">
        {description}
      </p>
      <p className="text-sm text-text-secondary leading-relaxed mb-6 max-w-sm mx-auto">
        {subtitle}
      </p>
      <p className="text-xs text-text-muted mb-6">This page refreshes automatically.</p>
      <form action={regenerateAction}>
        <button
          type="submit"
          onClick={resetTimer}
          className="inline-block px-5 py-2.5 rounded-lg border border-border-default text-sm font-medium text-text-secondary hover:bg-surface-muted transition-colors"
        >
          {generateLabel}
        </button>
      </form>
    </section>
  )
}
