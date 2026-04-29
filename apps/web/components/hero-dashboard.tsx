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
                {/* Track */}
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
    /*
     * Outer panel — absolutely fills the right 52 % of the hero section.
     * The hero section already has position:relative and overflow:hidden,
     * so this bleeds cleanly to the right viewport edge.
     * Hidden on mobile; block on lg+.
     */
    <div className="hidden lg:block absolute right-0 top-0 bottom-0 w-[52%] xl:w-[50%]">

      {/*
       * Inner relative wrapper — full-height, used as the containing block
       * for both the frame card AND the floating widgets.
       * Widgets are siblings of the frame card so they are NOT clipped
       * by the frame's overflow:hidden.
       */}
      <div className="relative w-full h-full">

        {/* ── Dashboard frame — stretches to right viewport edge ── */}
        {/*
         * top-[8%] / bottom-[8%]: vertical breathing room inside the panel.
         * left-[5%]: offset from panel left so the left-rounded corner is visible.
         * right-0: flush with the viewport right edge — no right border/radius.
         * shadow: left-only (-4px x-offset) → frame appears to float in from the right.
         */}
        <div
          className={[
            'absolute top-[8%] bottom-[8%] left-[5%] right-0',
            'bg-surface-base border border-border-default border-r-0',
            'overflow-hidden',
            'shadow-[-4px_0_32px_rgba(14,13,11,0.08)]',
          ].join(' ')}
          style={{ borderRadius: '20px 0 0 20px' }}
        >
          <div className="p-5 pt-7">

            {/* Frame header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs text-text-muted font-mono">Wednesday, 16 April</p>
                <p className="text-base font-medium text-text-primary">Good morning, Sarah.</p>
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
              <p className="text-sm font-medium text-text-primary">Magnesium Glycinate</p>
              <p className="text-xs text-text-muted mt-0.5 font-mono">400mg · 3:00pm · with food</p>
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

        {/*
         * Floating widgets — all positioned relative to the inner wrapper.
         * Their coordinates are expressed as offsets from the frame card's
         * own position (top-[8%], left-[5%]) using calc(), so they sit
         * exactly where they would if positioned relative to the frame card
         * itself — but as siblings they escape overflow:hidden.
         *
         * Widget 1: top:  calc(8% + 34px)  = frame-top  + 34px
         *           left: calc(5% - 46px)  = frame-left - 46px  (bleeds left)
         *
         * Widget 2: bottom: calc(8% - 18px) = frame-bottom - 18px (bleeds down)
         *           left:   calc(5% - 32px) = frame-left  - 32px  (bleeds left)
         *
         * Widget 3: bottom: calc(8% - 32px) = frame-bottom - 32px (bleeds down)
         *           right:  0               = flush with panel right (inside viewport)
         */}

        {/* ── Widget 1 — Lab trends (top-left, bleeds left of frame) ── */}
        <div
          className="absolute"
          style={{ top: 'calc(8% + 28px)', left: 'calc(5% - 52px)' }}
        >
          <div className="bg-surface-base border border-border-default rounded-xl shadow-md px-3 py-2 w-[130px] opacity-95">
            <p className="text-[9px] font-semibold tracking-wider uppercase text-text-muted mb-1">
              Ferritin
            </p>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-text-primary font-mono">18 µg/L</span>
              <span className="text-[9px] text-sage-600 font-medium">↑ improving</span>
            </div>
            {/* Mini sparkline */}
            <div className="flex items-end gap-0.5 mt-1.5 h-3">
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

        {/* ── Widget 2 — Streak pill (bottom-left, bleeds below frame) ── */}
        <div
          className="absolute"
          style={{ bottom: 'calc(8% - 24px)', left: 'calc(5% - 36px)' }}
        >
          <div className="bg-surface-base border border-border-default rounded-full shadow-md px-3 py-1.5 flex items-center gap-2 opacity-95">
            <span className="text-sm leading-none" role="img" aria-label="streak">🔥</span>
            <span className="text-[11px] font-medium text-text-primary">18 day streak</span>
          </div>
        </div>

        {/* ── Widget 3 — Dr Chen message (bottom-right, inside panel) ── */}
        {/* right:8px keeps it clear of the viewport edge clip zone */}
        <div
          className="absolute"
          style={{ bottom: 'calc(8% - 38px)', right: '8px' }}
        >
          <div className="bg-surface-base border border-border-default rounded-xl shadow-md px-3 py-2 opacity-95">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-4 h-4 rounded-full bg-brand-subtle flex items-center justify-center flex-shrink-0">
                <span className="text-[7px] font-medium text-text-brand">SC</span>
              </div>
              <span className="text-[9px] font-medium text-text-primary">Dr Chen</span>
            </div>
            <p className="text-[9px] text-text-muted max-w-[120px] leading-relaxed">
              Your cortisol levels are improving — keep going.
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}
