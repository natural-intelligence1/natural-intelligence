// ─── TODAY ───────────────────────────────────────────────────────────────────
// What this person has agreed to do today, and what is coming.
//
// Everything shown traces to a SIGNED Protocol. If there is no signed plan
// there are no actions — Today does not invent something to do, and does not
// fall back to a draft.

import Link from 'next/link'
import { planState } from '@natural-intelligence/db/careRecord'
import { CLIENT, PROTOCOL_VERSIONS, TODAY_ACTIONS, SIGNED_BY_NAME } from './clientFixture'

export default function TodayPage() {
  // The SAME function the practitioner surface uses to decide what is current.
  const plan = planState(PROTOCOL_VERSIONS)
  const practitioner = plan.kind === 'current' && plan.version.signed_by
    ? SIGNED_BY_NAME[plan.version.signed_by]
    : null

  const done = TODAY_ACTIONS.filter((a) => a.done).length

  return (
    <>
      <header className="mb-8">
        <h1 className="font-display text-3xl text-text-primary mb-1">
          Today
        </h1>
        <p className="text-sm text-text-secondary">
          {plan.kind === 'current'
            ? `From your current plan, signed by ${practitioner?.name ?? 'your practitioner'}.`
            : 'You have no signed plan yet.'}
        </p>
      </header>

      {plan.kind === 'none' ? (
        <section className="border border-dashed border-border-default rounded-xl p-8 bg-surface-raised">
          <h2 className="font-display text-xl text-text-primary mb-2">Nothing to do yet</h2>
          <p className="text-sm text-text-secondary leading-relaxed mb-4">
            Your practitioner has not signed a plan for you yet. When they do, the things you have
            agreed together will appear here, a day at a time.
          </p>
          <Link href="/my/health" className="text-sm text-text-brand hover:underline">
            See what you have told us so far
          </Link>
        </section>
      ) : (
        <>
          <section aria-labelledby="today-actions" className="mb-10">
            <div className="flex items-baseline justify-between mb-4">
              <h2 id="today-actions" className="font-display text-xl text-text-primary">
                Your day
              </h2>
              <span className="text-xs text-text-muted">{done} of {TODAY_ACTIONS.length} done</span>
            </div>

            <ul className="space-y-2">
              {TODAY_ACTIONS.map((a) => (
                <li
                  key={a.name}
                  className="flex items-start gap-3 border border-border-default rounded-lg p-4 bg-surface-raised"
                >
                  {/* State in a word as well as a mark — never colour alone. */}
                  <span
                    aria-hidden
                    className={[
                      'mt-0.5 h-4 w-4 flex-shrink-0 rounded-full border flex items-center justify-center text-[10px]',
                      a.done ? 'bg-brand-default border-brand-default text-text-inverted' : 'border-border-strong',
                    ].join(' ')}
                  >
                    {a.done ? '✓' : ''}
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm text-text-primary">{a.name}</span>
                    <span className="block text-xs text-text-muted mt-0.5">{a.detail}</span>
                  </span>
                  <span className="text-xs text-text-muted flex-shrink-0">
                    {a.done ? 'Done' : 'To do'}
                  </span>
                </li>
              ))}
            </ul>

            <p className="text-xs text-text-muted mt-3 leading-relaxed">
              These come from your plan exactly as your practitioner wrote them. Nothing here changes
              an amount or an instruction.
            </p>
          </section>

          <section aria-labelledby="coming-up" className="mb-10">
            <h2 id="coming-up" className="font-display text-xl text-text-primary mb-3">Coming up</h2>
            <div className="border border-border-default rounded-lg p-4 bg-surface-raised">
              <p className="text-sm text-text-primary">Review with {practitioner?.name ?? 'your practitioner'}</p>
              <p className="text-xs text-text-muted mt-0.5">{CLIENT.nextReview}</p>
            </div>
          </section>

          <Link href="/my/plan" className="text-sm text-text-brand hover:underline">
            See your full plan
          </Link>
        </>
      )}
    </>
  )
}
