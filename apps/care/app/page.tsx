import Image from 'next/image'
import WaitlistForm from './WaitlistForm'

const MODULES = ['DailyPath', 'BioHub', 'RootFinder', 'LifeTracker', 'AutoAdjust'] as const

// v5 dark shell palette — obsidian, not pure black
const C = {
  shell:      '#0E0D0B',   // dark shell bg (--ni-dark v5)
  card:       '#1A1917',   // dark card bg
  border:     '#2A2825',   // dark border
  text:       '#F8F6F2',   // text on dark (warm parchment)
  textMuted:  '#8A8880',   // muted text on dark
  gold:       '#B8935A',   // gold accent
  goldMid:    '#D4B07A',   // gold mid (pill text)
  sage:       '#4E7A5C',   // sage (success)
} as const

export default function CarePage() {
  return (
    <main
      className="min-h-screen flex flex-col"
      style={{ background: C.shell, color: C.text }}
    >
      {/* ── Topbar ──────────────────────────────────────────────────────── */}
      <div className="px-10 py-8 flex-shrink-0">
        <Image
          src="/images/NI_logo_thumb_transparent.png"
          alt="Natural Intelligence"
          width={40}
          height={40}
          unoptimized
          className="h-10 w-auto"
          style={{ filter: 'invert(1)' }}
        />
      </div>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6 pb-20 w-full">
        <div className="max-w-2xl mx-auto w-full">
          <p
            className="text-xs font-medium uppercase mb-6"
            style={{ color: C.gold, letterSpacing: '0.16em' }}
          >
            care.natural-intelligence.uk
          </p>

          <h1
            className="mb-6"
            style={{
              fontFamily: 'var(--font-display), Georgia, serif',
              fontSize: 'clamp(40px, 6vw, 56px)',
              fontWeight: 400,
              lineHeight: 1.1,
              letterSpacing: '-0.025em',
              color: C.text,
            }}
          >
            Intelligent care,{' '}
            <em style={{ fontWeight: 500, fontStyle: 'italic', color: C.gold }}>
              coming soon.
            </em>
          </h1>

          <p
            className="mb-12 mx-auto"
            style={{
              fontSize: '16px',
              lineHeight: 1.7,
              color: C.textMuted,
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
                  background: C.card,
                  border: `1px solid rgba(184, 147, 90, 0.4)`,
                  color: C.goldMid,
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
            style={{ color: C.textMuted }}
          >
            We&apos;ll only use this to tell you when care.natural-intelligence.uk opens.
          </p>
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div
        className="px-10 py-6 flex items-center justify-between text-xs flex-shrink-0"
        style={{ borderTop: `1px solid ${C.border}`, color: C.textMuted }}
      >
        <a
          href="https://natural-intelligence.uk"
          style={{ color: C.gold, textDecoration: 'none' }}
        >
          ← Return to Natural Intelligence
        </a>
        <span>
          care.natural-intelligence.uk
        </span>
      </div>
    </main>
  )
}
