'use client'

// ─── Four-ring vitality SVG ───────────────────────────────────────────────────

function VitalityRings() {
  const rings = [
    { r: 85, pct: 0.78, color: '#4E7A5C', label: 'Physical'  },
    { r: 70, pct: 0.65, color: '#7A9DBF', label: 'Cognitive' },
    { r: 55, pct: 0.82, color: '#B87840', label: 'Emotional' },
    { r: 40, pct: 0.71, color: '#B8935A', label: 'Hormonal'  },
  ]

  return (
    <div className="flex justify-center">
      <div className="relative" style={{ width: 200, height: 200 }}>
        <svg
          width="200"
          height="200"
          viewBox="0 0 200 200"
          style={{ animation: 'breathe 8s ease-in-out infinite' }}
        >
          {rings.map(({ r, pct, color }) => {
            const circ = 2 * Math.PI * r
            return (
              <g key={r}>
                {/* Track ring */}
                <circle
                  cx="100" cy="100" r={r}
                  fill="none"
                  stroke={color}
                  strokeOpacity={0.12}
                  strokeWidth={8}
                />
                {/* Progress arc */}
                <circle
                  cx="100" cy="100" r={r}
                  fill="none"
                  stroke={color}
                  strokeWidth={8}
                  strokeLinecap="round"
                  strokeDasharray={`${circ * pct} ${circ}`}
                  style={{ transition: 'stroke-dasharray 1s ease-out' }}
                />
              </g>
            )
          })}
        </svg>

        {/* Centre score */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-medium text-text-primary font-mono leading-none">
            87
          </span>
          <span className="text-[10px] text-text-muted uppercase tracking-wider mt-1">
            Vitality
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Dashboard scene ──────────────────────────────────────────────────────────

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export default function HeroDashboard() {
  return (
    /* Hidden on mobile; absolutely bleeds to the right viewport edge on lg+ */
    <div
      className={[
        'hidden lg:flex',
        'lg:absolute lg:right-0 lg:top-0 lg:bottom-0 lg:w-[52%]',
        'items-center justify-end',
      ].join(' ')}
    >
      {/* ── Frame wrapper (relative so widgets can be absolute) ── */}
      <div className="relative" style={{ width: '420px', maxWidth: '100%' }}>

        {/* ── Dashboard frame — left-rounded, right flush ── */}
        <div
          className="bg-surface-base border border-border-default shadow-elevated overflow-hidden"
          style={{ borderRadius: '20px 0 0 20px' }}
        >
          <div className="p-6 pt-8">

            {/* Header row */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs text-text-muted font-mono">
                  Wednesday, 16 April
                </p>
                <p className="text-base font-medium text-text-primary">
                  Good morning, Sarah.
                </p>
              </div>
              <div className="w-8 h-8 rounded-full bg-brand-subtle flex items-center justify-center">
                <span className="text-xs font-medium text-text-brand font-mono">87</span>
              </div>
            </div>

            {/* Four-ring vitality chart */}
            <VitalityRings />

            {/* Next action card */}
            <div className="mt-6 bg-surface-raised rounded-xl p-4 border border-border-default">
              <p className="text-[10px] font-semibold tracking-wider uppercase text-text-brand mb-2">
                Next action
              </p>
              <p className="text-sm font-medium text-text-primary">
                Magnesium Glycinate
              </p>
              <p className="text-xs text-text-muted mt-0.5 font-mono">
                400mg · 3:00pm · with food
              </p>
              <div className="flex gap-2 mt-3">
                <button className="flex-1 py-2 rounded-lg bg-brand-default text-text-inverted text-xs font-medium transition-opacity hover:opacity-90">
                  Done
                </button>
                <button className="flex-1 py-2 rounded-lg border border-border-default text-text-secondary text-xs transition-colors hover:bg-surface-muted">
                  Remind me
                </button>
              </div>
            </div>

            {/* Week streak dots */}
            <div className="mt-4 flex gap-1.5 justify-center">
              {DAYS.map((day, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <span className="text-[9px] text-text-muted font-mono">{day}</span>
                  <div
                    className={[
                      'w-5 h-5 rounded-full',
                      i < 3
                        ? 'bg-brand-default'
                        : i === 3
                        ? 'bg-brand-subtle'
                        : 'bg-surface-muted',
                    ].join(' ')}
                  />
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* ── Widget 1 — Lab trends (bleeds left) ── */}
        <div className="absolute" style={{ top: '34px', left: '-46px' }}>
          <div className="bg-surface-base border border-border-default rounded-xl shadow-md px-3 py-2.5 w-[140px]">
            <p className="text-[9px] font-semibold tracking-wider uppercase text-text-muted mb-1">
              Ferritin
            </p>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-text-primary font-mono">
                18 µg/L
              </span>
              <span className="text-[10px] text-sage-600 font-medium">↑ improving</span>
            </div>
            {/* Mini sparkline */}
            <div className="flex items-end gap-0.5 mt-1.5 h-4">
              {[40, 55, 50, 65, 72].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm bg-brand-subtle"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
            {/* Connector line to frame */}
            <div
              className="absolute bg-border-default"
              style={{ right: '-26px', top: '50%', width: '26px', height: '1px' }}
            />
          </div>
        </div>

        {/* ── Widget 2 — Streak pill (bleeds bottom-left) ── */}
        <div className="absolute" style={{ left: '-32px', bottom: '-18px' }}>
          <div className="bg-surface-base border border-border-default rounded-full shadow-md px-4 py-2 flex items-center gap-2">
            {/* fire emoji is intentional data-UI for streak count */}
            <span className="text-base leading-none" role="img" aria-label="streak">🔥</span>
            <span className="text-xs font-medium text-text-primary">18 day streak</span>
          </div>
        </div>

        {/* ── Widget 3 — Dr Chen message (bottom, inside frame bounds) ── */}
        <div className="absolute" style={{ bottom: '-32px', right: '0px' }}>
          <div className="bg-surface-base border border-border-default rounded-xl shadow-md px-3 py-2.5">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-5 h-5 rounded-full bg-brand-subtle flex items-center justify-center flex-shrink-0">
                <span className="text-[8px] font-medium text-text-brand">SC</span>
              </div>
              <span className="text-[10px] font-medium text-text-primary">Dr Chen</span>
            </div>
            <p className="text-[10px] text-text-muted max-w-[140px] leading-relaxed">
              Your cortisol levels are improving — keep going.
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}
