// ─── EVERYTHING ELSE ─────────────────────────────────────────────────────────
// The whole of NI, for someone who has come looking for it.
//
// This page exists so that progressive disclosure is DISCLOSURE and not
// concealment. Nothing has been removed: every /dashboard route still works
// and is still listed here. What changed is that a person meeting NI for the
// first time is not handed the product map on day one.
//
// A module that is not open yet says WHY and what would open it. That is the
// difference between "not yet" and "not for you".
//
// The two rights channels — My requests and Privacy & Data Controls — are
// listed unconditionally, in their own group, because the ability to ask for
// your data or change what you agreed to cannot depend on NI's view of
// whether you need it yet.

import Link from 'next/link'
import { availableModules, heldBackModules } from '@/lib/my/progressiveNav'
import { CLIENT_CONTEXT } from '../clientFixture'

export default function MyMorePage() {
  const open = availableModules(CLIENT_CONTEXT)
  const waiting = heldBackModules(CLIENT_CONTEXT)

  const rights = open.filter((m) => m.alwaysAvailable)
  const openNow = open.filter((m) => !m.alwaysAvailable)

  return (
    <>
      <header className="mb-8">
        <h1 className="font-display text-3xl text-text-primary mb-2">Everything else</h1>
        <p className="text-sm text-text-secondary leading-relaxed max-w-2xl">
          The rest of what Natural Intelligence can do. Your five main screens cover the day to day —
          this is here when you want to go further.
        </p>
      </header>

      {openNow.length > 0 && (
        <section aria-labelledby="open-now" className="mb-10">
          <h2 id="open-now" className="text-[11px] uppercase tracking-[0.12em] text-text-muted mb-3">
            Open to you now
          </h2>
          <ul className="grid sm:grid-cols-2 gap-2">
            {openNow.map((m) => (
              <li key={m.id}>
                <Link
                  href={m.href}
                  className="block h-full border border-border-default rounded-lg p-4 bg-surface-raised hover:border-border-strong transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-default"
                >
                  <span className="block text-sm text-text-primary">{m.label}</span>
                  <span className="block text-xs text-text-muted mt-0.5 leading-relaxed">{m.blurb}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {waiting.length > 0 && (
        <section aria-labelledby="not-yet" className="mb-10">
          <h2 id="not-yet" className="text-[11px] uppercase tracking-[0.12em] text-text-muted mb-1">
            Not open yet
          </h2>
          <p className="text-xs text-text-muted mb-3">
            These appear as your care moves on. Nothing is being withheld from you.
          </p>
          <ul className="space-y-2">
            {waiting.map((m) => (
              <li
                key={m.id}
                className="border border-dashed border-border-default rounded-lg p-4 bg-surface-base"
              >
                <span className="block text-sm text-text-secondary">{m.label}</span>
                <span className="block text-xs text-text-muted mt-0.5 leading-relaxed">{m.blurb}</span>
                <span className="block text-xs text-text-muted mt-2">{m.waitingFor}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="your-rights" className="pt-6 border-t border-border-muted">
        <h2 id="your-rights" className="text-[11px] uppercase tracking-[0.12em] text-text-muted mb-1">
          Your data, your choices
        </h2>
        <p className="text-xs text-text-muted mb-3">
          Always available, whatever stage you are at.
        </p>
        <ul className="grid sm:grid-cols-2 gap-2">
          {rights.map((m) => (
            <li key={m.id}>
              <Link
                href={m.href}
                className="block h-full border border-border-default rounded-lg p-4 bg-surface-raised hover:border-border-strong transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-default"
              >
                <span className="block text-sm text-text-primary">{m.label}</span>
                <span className="block text-xs text-text-muted mt-0.5 leading-relaxed">{m.blurb}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-8">
        <Link href="/dashboard" className="text-xs text-text-muted hover:text-text-secondary hover:underline">
          Open the older dashboard
        </Link>
      </p>
    </>
  )
}
