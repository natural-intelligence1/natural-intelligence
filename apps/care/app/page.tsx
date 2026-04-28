import WaitlistForm from './WaitlistForm'

const MODULES = ['DailyPath', 'BioHub', 'RootFinder', 'LifeTracker', 'AutoAdjust'] as const

export default function CarePage() {
  return (
    <main
      className="min-h-screen flex flex-col"
      style={{ background: '#111111', color: '#FAFAF8' }}
    >
      {/* ── Topbar ──────────────────────────────────────────────────────── */}
      <div className="px-10 py-8 flex-shrink-0">
        <span className="inline-flex items-center gap-2.5">
          <span
            className="text-sm font-medium"
            style={{ color: '#C9A96E', letterSpacing: '0.04em' }}
          >
            NI ·
          </span>
          <span
            className="text-sm"
            style={{ color: '#9E9B96', letterSpacing: '0.04em' }}
          >
            Natural Intelligence
          </span>
        </span>
      </div>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6 pb-20 w-full">
        <div className="max-w-2xl mx-auto w-full">
          <p
            className="text-xs font-medium uppercase mb-6"
            style={{ color: '#C9A96E', letterSpacing: '0.16em' }}
          >
            care.natural-intelligence.uk
          </p>

          <h1
            className="mb-6"
            style={{
              fontFamily: 'var(--font-playfair), Georgia, serif',
              fontSize: 'clamp(40px, 6vw, 56px)',
              fontWeight: 400,
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              color: '#FAFAF8',
            }}
          >
            Intelligent care,{' '}
            <em style={{ fontWeight: 500, fontStyle: 'normal', color: '#C9A96E' }}>
              coming soon.
            </em>
          </h1>

          <p
            className="mb-12 mx-auto"
            style={{
              fontSize: '16px',
              lineHeight: 1.7,
              color: '#9E9B96',
              maxWidth: '540px',
            }}
          >
            This is where your personalised health protocol will live. Built around you, guided by your practitioner.
          </p>

          {/* Module pills */}
          <div className="flex flex-wrap gap-2 justify-center mb-12">
            {MODULES.map((mod) => (
              <span
                key={mod}
                className="px-4 py-2.5 rounded-lg text-sm font-medium"
                style={{
                  background: '#1A1A1A',
                  border: '1px solid rgba(201, 169, 110, 0.4)',
                  color: '#E8D5B0',
                }}
              >
                {mod}
              </span>
            ))}
          </div>

          {/* Waitlist form */}
          <WaitlistForm />

          <p
            className="mt-4 text-xs"
            style={{ color: '#9E9B96' }}
          >
            We&apos;ll only use this to tell you when care.natural-intelligence.uk opens.
          </p>
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div
        className="px-10 py-6 flex items-center justify-between text-xs flex-shrink-0"
        style={{ borderTop: '1px solid #2A2A2A', color: '#9E9B96' }}
      >
        <a
          href="https://natural-intelligence.uk"
          style={{ color: '#C9A96E', textDecoration: 'none' }}
        >
          ← Return to Natural Intelligence
        </a>
        <span style={{ fontFamily: 'var(--font-dm-sans), monospace' }}>
          care.natural-intelligence.uk
        </span>
      </div>
    </main>
  )
}
