'use client'

// ─── Vitality data shape (exported for page.tsx import) ───────────────────────

export interface VitalityData {
  overallScore:   number
  physicalScore:  number
  cognitiveScore: number
  emotionalScore: number
  hormonalScore:  number
}

// ─── Four-ring vitality SVG ───────────────────────────────────────────────────

function VitalityRings({ vitalityData }: { vitalityData?: VitalityData | null }) {
  // Use real scores (0-100 → 0-1) or demo values
  const rings = [
    { r: 85, pct: vitalityData ? vitalityData.physicalScore  / 100 : 0.78, color: '#4E7A5C', label: 'Physical'  },
    { r: 70, pct: vitalityData ? vitalityData.cognitiveScore / 100 : 0.65, color: '#7A9DBF', label: 'Cognitive' },
    { r: 55, pct: vitalityData ? vitalityData.emotionalScore / 100 : 0.82, color: '#B87840', label: 'Emotional' },
    { r: 40, pct: vitalityData ? vitalityData.hormonalScore  / 100 : 0.71, color: '#B8935A', label: 'Hormonal'  },
  ]
  const centreScore = vitalityData ? vitalityData.overallScore : 87

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
            {centreScore}
          </span>
          <span className="text-[10px] text-text-muted uppercase tracking-wider mt-1">
            Vitality
          </span>
        </div>
      </div>

      {/* Ring legend */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-4 px-2">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
               style={{ backgroundColor: '#4E7A5C' }} />
          <span className="text-[9px] text-text-muted font-mono uppercase tracking-wide">
            Physical
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
               style={{ backgroundColor: '#7A9DBF' }} />
          <span className="text-[9px] text-text-muted font-mono uppercase tracking-wide">
            Cognitive
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
               style={{ backgroundColor: '#B87840' }} />
          <span className="text-[9px] text-text-muted font-mono uppercase tracking-wide">
            Emotional
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
               style={{ backgroundColor: '#B8935A' }} />
          <span className="text-[9px] text-text-muted font-mono uppercase tracking-wide">
            Hormonal
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Dashboard scene ──────────────────────────────────────────────────────────

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

interface HeroDashboardProps {
  vitalityData?: VitalityData | null
}

export default function HeroDashboard({ vitalityData }: HeroDashboardProps) {
  return (
    /*
     * Outer panel — absolutely fills the right 52 % of the hero section.
     * The hero section already has position:relative and overflow:hidden,
     * so this bleeds cleanly to the right viewport edge.
     * Hidden on mobile; block on lg+.
     */
    <div className="hidden lg:block absolute right-0 top-0 bottom-0 w-[52%]">

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
          <div className="p-6 pt-8">

            {/* Frame header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs text-text-muted font-mono">Wednesday, 16 April</p>
                <p className="text-base font-medium text-text-primary">Good morning, Sarah.</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-brand-subtle flex items-center justify-center">
                <span className="text-xs font-medium text-text-brand font-mono">
                  {vitalityData ? vitalityData.overallScore : 87}
                </span>
              </div>
            </div>

            {/* Four-ring vitality chart */}
            <VitalityRings vitalityData={vitalityData} />

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
          style={{ top: 'calc(8% + 34px)', left: 'calc(5% - 46px)' }}
        >
          <div className="bg-surface-base border border-border-default rounded-xl shadow-md px-3 py-2.5 w-[140px]">
            <p className="text-[9px] font-semibold tracking-wider uppercase text-text-muted mb-1">
              Ferritin
            </p>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-text-primary font-mono">18 µg/L</span>
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

        {/* ── Widget 2 — Streak pill (bottom-left, bleeds below frame) ── */}
        <div
          className="absolute"
          style={{ bottom: 'calc(8% - 18px)', left: 'calc(5% - 32px)' }}
        >
          <div className="bg-surface-base border border-border-default rounded-full shadow-md px-4 py-2 flex items-center gap-2">
            <span className="text-base leading-none" role="img" aria-label="streak">🔥</span>
            <span className="text-xs font-medium text-text-primary">18 day streak</span>
          </div>
        </div>

        {/* ── Widget 3 — Dr Chen message (bottom-right, inside panel) ── */}
        {/* right:0 keeps it within the viewport — the frame's right edge is the viewport edge */}
        <div
          className="absolute"
          style={{ bottom: 'calc(8% - 32px)', right: '0' }}
        >
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
