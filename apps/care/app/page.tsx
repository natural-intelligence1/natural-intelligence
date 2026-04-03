const copy = {
  heading:    'Natural Intelligence Care Portal',
  subheading: 'Private clinical care — coming soon',
  tagline:    'This portal is reserved for the Natural Intelligence clinical care platform, launching in a future phase.',
} as const

export default function CarePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-surface-base px-6">
      <div className="max-w-md text-center">
        <p className="text-xs font-medium tracking-widest uppercase text-text-muted mb-6">
          Natural Intelligence
        </p>
        <h1 className="text-4xl font-semibold text-text-primary mb-4">
          {copy.heading}
        </h1>
        <p className="text-lg text-text-secondary mb-3">
          {copy.subheading}
        </p>
        <p className="text-sm text-text-muted">
          {copy.tagline}
        </p>
      </div>
    </main>
  )
}
