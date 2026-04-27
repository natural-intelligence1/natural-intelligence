export default function PrivacyPage() {
  return (
    <div className="py-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
      <div className="mb-10">
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Legal</p>
        <h1 className="text-3xl font-bold text-text-primary mb-2">Privacy Policy</h1>
        <p className="text-sm text-text-muted">Last updated: 27 April 2026</p>
      </div>

      <div className="rounded-xl border border-border-default bg-surface-raised p-8 shadow-sm">
        <p className="text-text-secondary leading-relaxed mb-4">
          This document is being prepared and will be published shortly.
        </p>
        <p className="text-text-secondary leading-relaxed">
          For enquiries, contact{' '}
          <a
            href="mailto:hello@natural-intelligence.uk"
            className="text-text-brand hover:underline font-medium"
          >
            hello@natural-intelligence.uk
          </a>
        </p>
      </div>
    </div>
  )
}
