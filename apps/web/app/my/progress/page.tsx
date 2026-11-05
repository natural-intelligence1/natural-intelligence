// ─── MY PROGRESS ─────────────────────────────────────────────────────────────
// How things have moved, in the client's own terms.
//
// WHAT THIS DELIBERATELY IS NOT
//
// No score. No percentage. No streak. No "adherence". A person recovering
// their health is not a project being measured, and a number that goes down
// in a hard week is a reason to stop opening the app.
//
// So progress is reported as THEN and NOW, in the words they used, against
// the things THEY chose to track. Where a day was missed, nothing is said
// about it: the plan is twelve weeks long and a missed Tuesday is not an
// event. The one count shown — days recorded — is a count of what they did,
// never of what they did not.

import Link from 'next/link'
import { MY_PROGRESS } from '../clientFixture'

export default function MyProgressPage() {
  const { daysRecorded, planWeek, planWeeksTotal, tracked, reviews } = MY_PROGRESS

  return (
    <>
      <header className="mb-8">
        <h1 className="font-display text-3xl text-text-primary mb-2">My Progress</h1>
        <p className="text-sm text-text-secondary leading-relaxed max-w-2xl">
          Where you were when you started, and where you are now. Nothing here is a score.
        </p>
      </header>

      <section aria-labelledby="where-you-are" className="mb-10">
        <h2 id="where-you-are" className="sr-only">Where you are</h2>
        <div className="border border-border-default rounded-xl bg-surface-raised p-5">
          <dl className="grid grid-cols-2 gap-5">
            <div>
              <dt className="text-[11px] text-text-muted mb-0.5">Days you have recorded</dt>
              <dd className="font-display text-2xl text-text-primary tabular-nums">{daysRecorded}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-text-muted mb-0.5">Where you are in the plan</dt>
              <dd className="font-display text-2xl text-text-primary tabular-nums">
                Week {planWeek}
                <span className="text-sm text-text-muted font-sans"> of {planWeeksTotal}</span>
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section aria-labelledby="then-now" className="mb-10">
        <h2 id="then-now" className="font-display text-xl text-text-primary mb-1">What has changed</h2>
        <p className="text-xs text-text-muted mb-4">
          The things you asked to keep an eye on, as you described them.
        </p>

        <ul className="space-y-3">
          {tracked.map((t) => (
            <li key={t.name} className="border border-border-default rounded-lg bg-surface-raised p-4">
              <p className="text-[15px] text-text-primary font-medium mb-3">{t.name}</p>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm text-text-muted">{t.then}</span>
                <span aria-hidden className="text-text-muted">→</span>
                <span className="text-sm text-text-primary font-medium">{t.now}</span>
              </div>
              <p className="text-xs text-text-muted mt-2">{t.note}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="reviews" className="mb-10">
        <h2 id="reviews" className="font-display text-xl text-text-primary mb-3">Your reviews</h2>
        <ol className="space-y-3 border-l border-border-default pl-4">
          {reviews.map((r) => (
            <li key={r.at}>
              <p className="text-sm text-text-primary leading-relaxed">{r.what}</p>
              <p className="text-xs text-text-muted mt-0.5">{r.at}</p>
            </li>
          ))}
        </ol>
      </section>

      <p>
        <Link href="/my/plan" className="text-sm text-text-brand hover:underline">
          See your full plan
        </Link>
      </p>
    </>
  )
}
