'use client'

// ─── EnergyCurveSelector ──────────────────────────────────────────────────────
// 6 energy curve cards with mini bar chart illustrations. Single select.
// Output JSON: { scale: 'energy_curve', value: 'afternoon_crash' }

interface Props {
  value: string | null
  onChange: (curve: string) => void
  clinicalObjective?: string
}

// Heights (0–1) for 6 time slots: dawn, morning, mid-morning, noon, afternoon, evening
const CURVES: Record<string, { name: string; description: string; bars: number[]; note?: string }> = {
  morning_low: {
    name:        'Morning low',
    description: 'Worst on waking, improves through the day',
    bars:        [0.15, 0.20, 0.45, 0.70, 0.85, 0.90],
    note:        'Associated with HPA axis patterns and cortisol rhythm.',
  },
  afternoon_crash: {
    name:        'Afternoon crash',
    description: 'Good in the morning, drops after lunch',
    bars:        [0.60, 0.85, 0.80, 0.65, 0.20, 0.35],
    note:        'Associated with blood sugar instability patterns.',
  },
  evening_wired: {
    name:        'Evening second wind',
    description: 'Alert and wired in the evening, hard to wind down',
    bars:        [0.35, 0.40, 0.40, 0.35, 0.55, 0.90],
    note:        'Associated with HPA axis and nervous system dysregulation.',
  },
  all_day_fatigue: {
    name:        'All-day fatigue',
    description: 'Consistently low throughout the day',
    bars:        [0.15, 0.20, 0.20, 0.18, 0.15, 0.20],
    note:        'Associated with mitochondrial function patterns.',
  },
  fluctuating: {
    name:        'Unpredictable',
    description: 'Energy varies with no clear pattern',
    bars:        [0.55, 0.25, 0.70, 0.30, 0.65, 0.20],
    note:        undefined,
  },
  generally_good: {
    name:        'Generally good',
    description: 'Energy not a significant concern',
    bars:        [0.75, 0.85, 0.85, 0.80, 0.80, 0.75],
    note:        undefined,
  },
}

const CHART_H = 24
const CHART_W = 72
const BAR_W   = 8
const BAR_GAP = 4

function MiniBarChart({ bars, selected }: { bars: number[]; selected: boolean }) {
  const fill = selected ? '#B8935A' : '#C4B89A'

  return (
    <svg width={CHART_W} height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`}>
      {bars.map((h, i) => {
        const barH = Math.max(2, Math.round(h * (CHART_H - 2)))
        const x    = i * (BAR_W + BAR_GAP)
        const y    = CHART_H - barH
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={BAR_W}
            height={barH}
            rx={2}
            fill={fill}
            fillOpacity={selected ? 1 : 0.6}
          />
        )
      })}
    </svg>
  )
}

export default function EnergyCurveSelector({ value, onChange }: Props) {
  const selectedCurve = value ? CURVES[value] : null

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(CURVES).map(([key, curve]) => {
          const selected = value === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              className={`
                flex flex-col gap-1.5 rounded-xl border p-3 text-left
                cursor-pointer transition-all
                ${selected
                  ? 'bg-[#F8F1E4] border-[#B8935A]'
                  : 'bg-surface-raised border-border-default hover:border-[#B8935A]'
                }
              `}
              aria-pressed={selected}
            >
              <MiniBarChart bars={curve.bars} selected={selected} />
              <span className={`text-sm font-medium leading-tight ${
                selected ? 'text-[#633806]' : 'text-text-primary'
              }`}>
                {curve.name}
              </span>
              <span className="text-[11px] text-text-muted leading-tight">
                {curve.description}
              </span>
            </button>
          )
        })}
      </div>

      {selectedCurve?.note && (
        <p className="text-sm text-text-secondary leading-relaxed border-l-2 border-[#B8935A] pl-3">
          {selectedCurve.note}
        </p>
      )}
    </div>
  )
}
