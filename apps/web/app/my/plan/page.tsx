// ─── MY PLAN ─────────────────────────────────────────────────────────────────
// The current SIGNED Protocol, and nothing else.
//
// The rule is enforced by planState() from the shared care record, which the
// practitioner surface also uses: a plan is a signed version that no signed
// version supersedes. Two things follow, and both are deliberate.
//
//   · An unsigned draft NEVER appears here, whatever produced it. A draft has
//     no clinical status, so showing it as "your plan" would be a lie with
//     consequences.
//   · A revision in progress does NOT withdraw the plan the client currently
//     has. They keep it until the next version is signed, and they are told
//     plainly that a new one is being prepared.

import Link from 'next/link'
import { planState } from '@natural-intelligence/db/careRecord'
import { CLIENT, PROTOCOL_VERSIONS, PLAN_ACTIONS, SIGNED_BY_NAME } from '../clientFixture'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function MyPlanPage() {
  const plan = planState(PROTOCOL_VERSIONS)

  if (plan.kind === 'none') {
    return (
      <>
        <h1 className="font-display text-3xl text-text-primary mb-6">My Plan</h1>
        <section className="border border-dashed border-border-default rounded-xl p-8 bg-surface-raised">
          <h2 className="font-display text-xl text-text-primary mb-2">No plan yet</h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            Your practitioner has not signed a plan for you yet. When they do, it will appear here in
            full — every action, with the instructions they wrote.
          </p>
        </section>
      </>
    )
  }

  const { version, revisionInProgress } = plan
  const signer = version.signed_by ? SIGNED_BY_NAME[version.signed_by] : null

  return (
    <>
      <header className="mb-8">
        <h1 className="font-display text-3xl text-text-primary mb-3">My Plan</h1>

        <div className="border border-border-default rounded-lg bg-surface-raised p-4">
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              ['Version', `v${version.version}`],
              ['Status', 'Current'],
              ['Signed by', signer?.name ?? '—'],
              ['Signed', version.signed_at ? formatDate(version.signed_at) : '—'],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[11px] text-text-muted mb-0.5">{k}</dt>
                <dd className="text-sm text-text-primary">{v}</dd>
              </div>
            ))}
          </dl>
          {signer && (
            <p className="text-xs text-text-muted mt-3 pt-3 border-t border-border-muted">
              {signer.credential}
            </p>
          )}
        </div>

        {revisionInProgress && (
          <p className="mt-3 text-[13px] text-text-secondary border border-border-default rounded-lg px-4 py-3 bg-surface-base">
            Your practitioner is preparing an updated plan. <strong className="font-medium">This plan still
            applies</strong> until the new one is signed.
          </p>
        )}
      </header>

      <section aria-labelledby="plan-actions">
        <h2 id="plan-actions" className="font-display text-xl text-text-primary mb-4">
          What you and {signer?.name?.split(' ')[0] ?? 'your practitioner'} agreed
        </h2>

        <ol className="space-y-3">
          {PLAN_ACTIONS.map((a, i) => (
            <li key={a.name} className="border border-border-default rounded-lg p-4 bg-surface-raised">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1.5">
                <span className="text-xs text-text-muted tabular-nums">{i + 1}</span>
                <h3 className="text-[15px] text-text-primary font-medium">{a.name}</h3>
                <span className="text-[11px] uppercase tracking-wider text-text-muted bg-surface-muted rounded-full px-2 py-0.5">
                  {a.kind}
                </span>
              </div>
              <p className="text-xs text-text-muted mb-2">
                {[a.amount, a.when, a.weeks ? `${a.weeks} weeks` : null].filter(Boolean).join(' · ')}
              </p>
              <p className="text-sm text-text-secondary leading-relaxed">{a.instructions}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10 pt-6 border-t border-border-muted">
        <h2 className="font-display text-lg text-text-primary mb-2">Earlier versions</h2>
        <p className="text-sm text-text-secondary leading-relaxed mb-3">
          Your plan changes as your care does. Earlier signed versions stay readable, so you can see
          what changed and when.
        </p>
        <p className="text-xs text-text-muted">
          Not yet available — the readable version history is part of the Protocol work still in review.
        </p>
      </section>

      <p className="mt-8">
        <Link href="/my" className="text-sm text-text-brand hover:underline">Back to today</Link>
      </p>
    </>
  )
}
