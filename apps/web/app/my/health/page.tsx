// ─── MY HEALTH ───────────────────────────────────────────────────────────────
// The longitudinal factual record: what this person has told NI, what they
// have reported since, and where the existing tools sit.
//
// This is the surface that carries the capture-once thesis. It is explicitly
// the SAME record the practitioner reads — not a client-friendly copy — so a
// correction here is a correction there. The synopsis itself is not wired yet
// and says so rather than rendering a plausible-looking stand-in.

import Link from 'next/link'
import { availableModules } from '@/lib/my/progressiveNav'
import { CLIENT, CLIENT_CONTEXT, MY_HEALTH_SUMMARY, MY_UPDATES } from '../clientFixture'

export default function MyHealthPage() {
  // The records and tools that are open to THIS person, decided by
  // lib/my/progressiveNav.ts. Replaces the fixed five-item list that used to
  // sit here: a tool nobody can use yet is noise, not a feature.
  const tools = availableModules(CLIENT_CONTEXT)
    .filter((m) => !m.alwaysAvailable && m.id !== 'workshops')

  return (
    <>
      <header className="mb-8">
        <h1 className="font-display text-3xl text-text-primary mb-2">My Health</h1>
        <p className="text-sm text-text-secondary leading-relaxed max-w-2xl">
          Your health story, told once and kept. This is the same record your practitioner reads —
          so when you add something, they see it, and you are not starting again with every
          practitioner you meet.
        </p>
      </header>

      {/* THE INTAKE'S PLACE IN THE SHELL.
          Intake is not a separate product with its own front door — it is how
          My Health gets filled in. So it lives here, as one entry, and it is
          the same entry whether you are starting it or adding to it. */}
      <section aria-labelledby="your-story" className="mb-10">
        <h2 id="your-story" className="sr-only">Your health story</h2>
        <Link
          href="/my/story"
          className="block border border-border-default rounded-xl p-5 bg-surface-raised hover:border-border-strong transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-default"
        >
          <span className="block font-display text-xl text-text-primary mb-1">Your health story</span>
          <span className="block text-sm text-text-secondary leading-relaxed">
            One thing at a time, saved as you go. Stop whenever you like and pick up where you left off.
          </span>
          <span className="block text-xs text-text-muted mt-2">
            Started {MY_HEALTH_SUMMARY.intakeCompleted} · add to it any time
          </span>
        </Link>
      </section>

      {/* What they came with */}
      <section aria-labelledby="concerns" className="mb-10">
        <h2 id="concerns" className="font-display text-xl text-text-primary mb-3">What brought you here</h2>
        <div className="flex flex-wrap gap-2 mb-2">
          {MY_HEALTH_SUMMARY.concerns.map((c) => (
            <span key={c} className="text-[13px] px-3 py-1.5 rounded-full bg-surface-muted border border-border-default text-text-secondary">
              {c}
            </span>
          ))}
        </div>
        <p className="text-xs text-text-muted">
          Recorded when you completed your intake on {MY_HEALTH_SUMMARY.intakeCompleted}.
        </p>
      </section>

      {/* What they have reported since */}
      <section aria-labelledby="updates" className="mb-10">
        <h2 id="updates" className="font-display text-xl text-text-primary mb-1">What you have told us since</h2>
        <p className="text-xs text-text-muted mb-4">
          Since your last review on {CLIENT.lastReview}. Your practitioner sees this same list.
        </p>
        <ol className="space-y-3 border-l border-border-default pl-4">
          {MY_UPDATES.map((u) => (
            <li key={u.at}>
              <p className="text-sm text-text-primary leading-relaxed">{u.text}</p>
              <p className="text-xs text-text-muted mt-0.5">{u.at}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Synopsis — honest about not being wired */}
      <section aria-labelledby="synopsis" className="mb-10">
        <h2 id="synopsis" className="font-display text-xl text-text-primary mb-3">Your factual summary</h2>
        <div className="border border-dashed border-border-default rounded-xl p-6 bg-surface-raised">
          <p className="text-sm text-text-secondary leading-relaxed mb-3">
            A plain, factual summary of everything you have told us, organised so a practitioner can
            read it quickly — and so you can check it is right.
          </p>
          <p className="text-xs text-text-muted">
            <strong className="text-text-secondary font-medium">Not connected yet.</strong>{' '}
            The summary is built and tested, but it is not yet joined to this screen. The older
            version is still available from your dashboard.
          </p>
          <Link href="/dashboard/synopsis" className="text-xs text-text-brand hover:underline mt-2 inline-block">
            Open the current version
          </Link>
        </div>
      </section>

      {/* Your records and tools — only the ones open to you */}
      <section aria-labelledby="tools">
        <h2 id="tools" className="font-display text-xl text-text-primary mb-3">Your records and tools</h2>
        <ul className="grid sm:grid-cols-2 gap-2">
          {tools.map((t) => (
            <li key={t.id}>
              <Link
                href={t.href}
                className="block h-full border border-border-default rounded-lg p-4 bg-surface-raised hover:border-border-strong transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-default"
              >
                <span className="block text-sm text-text-primary">{t.label}</span>
                <span className="block text-xs text-text-muted mt-0.5 leading-relaxed">{t.blurb}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="text-xs text-text-muted mt-3">
          <Link href="/my/more" className="hover:underline">See everything else</Link>
        </p>
      </section>
    </>
  )
}
