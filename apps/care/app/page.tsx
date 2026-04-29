import Image from 'next/image'
import WaitlistForm from './components/waitlist-form'

const MODULES = ['DailyPath', 'BioHub', 'RootFinder', 'LifeTracker', 'AutoAdjust'] as const

export default function CarePage() {
  return (
    <main
      className="min-h-screen flex flex-col"
      style={{ background: '#0E0D0B', color: '#F8F6F2' }}
    >
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 flex items-center justify-between"
        style={{ padding: '32px 40px' }}
      >
        {/* Left: NI logo mark (inverted) */}
        <Image
          src="/images/NI_logo_thumb_transparent.png"
          alt="Natural Intelligence"
          width={36}
          height={36}
          unoptimized
          style={{ height: '36px', width: 'auto', filter: 'invert(1)' }}
        />

        {/* Right: back link */}
        <a
          href="https://natural-intelligence.uk"
          style={{
            fontSize:       '12px',
            color:          '#8A8880',
            textDecoration: 'none',
          }}
        >
          ← natural-intelligence.uk
        </a>
      </div>

      {/* ── Centre content ───────────────────────────────────────────────── */}
      <div
        className="flex-1 flex flex-col items-center justify-center text-center"
        style={{ padding: '0 32px 80px' }}
      >
        <div style={{ maxWidth: '600px', width: '100%' }}>

          {/* Eyebrow */}
          <p
            style={{
              fontSize:      '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.16em',
              color:         '#B8935A',
              marginBottom:  '24px',
            }}
          >
            Personalised clinical intelligence
          </p>

          {/* H1 — Cormorant Garamond two-line treatment */}
          <h1 style={{ marginBottom: '24px', lineHeight: '1.05' }}>
            <span
              className="block font-display"
              style={{
                fontSize:   'clamp(40px, 6vw, 64px)',
                fontWeight: 300,
                fontStyle:  'italic',
                color:      '#F8F6F2',
              }}
            >
              Intelligent care,
            </span>
            <span
              className="block font-display"
              style={{
                fontSize:   'clamp(40px, 6vw, 64px)',
                fontWeight: 500,
                color:      '#F8F6F2',
              }}
            >
              coming soon.
            </span>
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontSize:    '16px',
              lineHeight:  '1.7',
              color:       '#8A8880',
              maxWidth:    '480px',
              margin:      '0 auto 40px',
            }}
          >
            care.natural-intelligence.uk is where your personalised health
            protocol will live — your DailyPath, your labs interpreted, your
            patterns understood. Built around you, guided by your practitioner.
          </p>

          {/* Module pills */}
          <div
            className="flex flex-wrap justify-center"
            style={{ gap: '8px', marginBottom: '40px' }}
          >
            {MODULES.map((mod) => (
              <span
                key={mod}
                style={{
                  background:   '#1A1917',
                  border:       '1px solid rgba(184, 147, 90, 0.35)',
                  borderRadius: '8px',
                  padding:      '10px 16px',
                  fontSize:     '13px',
                  fontWeight:   500,
                  color:        '#D4B07A',
                }}
              >
                {mod}
              </span>
            ))}
          </div>

          {/* Waitlist form */}
          <WaitlistForm />

          <p
            style={{
              fontSize:   '12px',
              color:      '#8A8880',
              marginTop:  '16px',
            }}
          >
            We&apos;ll only use this to tell you when care.natural-intelligence.uk opens.
          </p>
        </div>
      </div>

      {/* ── Bottom bar ───────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 flex items-center justify-center"
        style={{ padding: '24px 40px' }}
      >
        <p style={{ fontSize: '12px', color: '#8A8880' }}>
          &copy; 2026 Natural Intelligence
        </p>
      </div>
    </main>
  )
}
