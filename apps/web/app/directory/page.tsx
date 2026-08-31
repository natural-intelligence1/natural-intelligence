import type { Metadata } from 'next'
import Link from 'next/link'
import { copy } from '@/lib/copy'

export const metadata: Metadata = {
  title: 'Practitioner directory',
  description:
    'Our practitioner directory is coming soon — we are onboarding and verifying ' +
    'practitioners before publishing it.',
}

// ─── Directory-truth fix (Front Door Sprint) ──────────────────────────────────
// The directory previously displayed synthetic showcase practitioner profiles as
// if they were real. Until real approved practitioners exist, this page shows an
// honest "coming soon" state. Display-layer only: no practitioner rows are
// queried or shown; the underlying records are untouched.
export default function DirectoryPage() {
  return (
    <div className="py-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">

      <div className="text-center mb-10">
        <p className="text-xs font-semibold text-text-brand uppercase tracking-[0.16em] mb-4">
          Our network
        </p>
        <h1 className="font-display text-3xl md:text-4xl font-medium text-text-primary mb-4">
          {copy.directory.heading}
        </h1>
        <p className="text-base text-text-secondary leading-relaxed max-w-xl mx-auto">
          {copy.directory.subheading}
        </p>
      </div>

      <div className="rounded-xl border border-border-default bg-surface-raised p-8 shadow-sm text-center">
        <h2 className="text-lg font-semibold text-text-primary mb-3">
          {copy.directory.comingSoon.heading}
        </h2>
        <p className="text-sm text-text-secondary leading-relaxed max-w-lg mx-auto mb-8">
          {copy.directory.comingSoon.body}
        </p>

        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/workshops"
            className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-brand-default text-text-inverted text-sm font-medium hover:bg-brand-hover transition-colors"
          >
            {copy.directory.comingSoon.workshopsCta}
          </Link>
          <Link
            href="/resources"
            className="inline-flex items-center justify-center px-6 py-3 rounded-lg border border-border-default bg-surface-base text-text-primary text-sm font-medium hover:bg-surface-muted transition-colors"
          >
            {copy.directory.comingSoon.libraryCta}
          </Link>
          <Link
            href="/apply"
            className="inline-flex items-center justify-center px-6 py-3 rounded-lg text-text-brand text-sm font-medium hover:bg-surface-muted transition-colors"
          >
            {copy.nav.apply}
          </Link>
        </div>
      </div>

      <p className="text-sm text-text-muted text-center mt-8 max-w-lg mx-auto leading-relaxed">
        {copy.directory.comingSoon.note}
      </p>

    </div>
  )
}
