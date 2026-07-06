import type { Metadata } from 'next'
import Link from 'next/link'
import { copy } from '@/lib/copy'

export const metadata: Metadata = {
  title: 'About',
  description:
    'What Natural Intelligence is, what it is not, and how it works — a calm, ' +
    'careful front door to natural-health practitioners, resources, and workshops.',
}

const whatItIs = [
  'A place to find qualified natural-health practitioners in the Natural Intelligence network.',
  'A place to learn through practitioner-curated resources and workshops.',
  'A way to begin a more thoughtful care journey, with time to prepare and reflect.',
]

const whatItIsNot = [
  'An emergency service.',
  'A diagnostic service.',
  'A replacement for a GP, hospital, or medical professional.',
  'An AI system that makes clinical decisions.',
  'A guarantee of health outcomes.',
]

const howItWorks = [
  {
    title: 'Explore',
    body: 'Browse practitioners, resources, and workshops to find people and ideas that fit how you want to look after your health.',
  },
  {
    title: 'Reach out when you are ready',
    body: 'Apply to work with a practitioner, or send an enquiry. There is no rush, and you choose what you share.',
  },
  {
    title: 'Human expertise stays in charge',
    body: 'A qualified human practitioner remains responsible for clinical judgement. Natural Intelligence supports that relationship — it does not replace it.',
  },
]

export default function AboutPage() {
  return (
    <div className="py-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">

      {/* Header */}
      <div className="mb-12 text-center">
        <p className="text-xs font-semibold text-text-brand uppercase tracking-[0.16em] mb-4">
          About Natural Intelligence
        </p>
        <h1 className="font-display mb-5 leading-[1.1] tracking-[-0.02em]">
          <span className="block text-3xl md:text-4xl font-light text-text-primary italic">
            Beyond survival.
          </span>
          <span className="block text-3xl md:text-4xl font-semibold text-text-primary">
            Designed for thriving.
          </span>
        </h1>
        <p className="text-base text-text-secondary leading-relaxed max-w-xl mx-auto">
          Natural Intelligence helps you find qualified natural-health practitioners and begin a
          more personal kind of care — with thoughtful preparation, human expertise, and clear
          boundaries. We are building carefully, with a small base of practitioners.
        </p>
      </div>

      <div className="space-y-6">

        {/* What NI is */}
        <section className="rounded-xl border border-border-default bg-surface-raised p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-text-primary mb-4">What Natural Intelligence is</h2>
          <ul className="space-y-3">
            {whatItIs.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-text-secondary leading-relaxed">
                <span aria-hidden="true" className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-default flex-shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* What NI is not */}
        <section className="rounded-xl border border-border-default bg-surface-raised p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-text-primary mb-4">What Natural Intelligence is not</h2>
          <ul className="space-y-3">
            {whatItIsNot.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-text-secondary leading-relaxed">
                <span aria-hidden="true" className="mt-1.5 w-1.5 h-1.5 rounded-full bg-text-muted flex-shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* How it works */}
        <section className="rounded-xl border border-border-default bg-surface-raised p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-text-primary mb-6">How it works</h2>
          <ol className="space-y-6">
            {howItWorks.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span className="w-7 h-7 rounded-full bg-brand-subtle text-text-brand text-sm font-medium flex items-center justify-center flex-shrink-0">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-text-primary mb-1">{step.title}</p>
                  <p className="text-sm text-text-secondary leading-relaxed">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Trust + privacy */}
        <section className="rounded-xl border border-border-default bg-surface-raised p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-text-primary mb-3">Your trust and privacy</h2>
          <p className="text-sm text-text-secondary leading-relaxed mb-4">{copy.brand.trustNote}</p>
          <div className="flex flex-wrap gap-4 text-sm">
            <Link href="/legal/privacy" className="text-text-brand font-medium hover:underline">
              {copy.footer.legal.privacy}
            </Link>
            <Link href="/legal/terms" className="text-text-brand font-medium hover:underline">
              {copy.footer.legal.terms}
            </Link>
            <Link href="/legal/cookies" className="text-text-brand font-medium hover:underline">
              {copy.footer.legal.cookies}
            </Link>
          </div>
        </section>

        {/* Safety / emergency boundary */}
        <section
          role="note"
          className="rounded-xl border border-status-warningBorder bg-status-warningBg p-6"
        >
          <h2 className="text-sm font-semibold text-status-warningText mb-2">In an emergency</h2>
          <p className="text-sm text-status-warningText leading-relaxed">{copy.brand.safetyNotice}</p>
        </section>

      </div>

      {/* Closing CTAs */}
      <div className="mt-12 flex flex-wrap justify-center gap-3">
        <Link
          href="/directory"
          className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-brand-default text-text-inverted text-sm font-medium hover:bg-brand-hover transition-colors"
        >
          Find a practitioner
        </Link>
        <Link
          href="/apply"
          className="inline-flex items-center justify-center px-6 py-3 rounded-lg border border-border-default bg-surface-raised text-text-primary text-sm font-medium hover:bg-surface-muted transition-colors"
        >
          Apply to join
        </Link>
      </div>

    </div>
  )
}
