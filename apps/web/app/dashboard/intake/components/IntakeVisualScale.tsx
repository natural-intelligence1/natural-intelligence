'use client'

// ─── IntakeVisualScale ────────────────────────────────────────────────────────
// 0–10 severity scale using 11 coloured squares with cumulative fill.
// Output JSON: { scale: 'severity_10', value: N }

interface Props {
  value: number | null
  onChange: (value: number) => void
  label?: string
  clinicalObjective?: string
}

type Zone = 'none' | 'mild' | 'moderate' | 'severe'

function getZone(n: number): Zone {
  if (n === 0)       return 'none'
  if (n <= 3)        return 'mild'
  if (n <= 6)        return 'moderate'
  return 'severe'
}

// Inactive (background) colour per zone
function bgInactive(n: number): string {
  if (n === 0) return 'bg-surface-muted'
  if (n <= 3)  return 'bg-[#E1F5EE]'
  if (n <= 6)  return 'bg-[#FAEEDA]'
  return 'bg-[#FCEBEB]'
}

// Active (filled) colour per zone
function bgActive(n: number): string {
  if (n === 0) return 'bg-surface-muted'
  if (n <= 3)  return 'bg-[#1D9E75]'
  if (n <= 6)  return 'bg-[#B8935A]'
  return 'bg-[#E24B4A]'
}

// Text colour inside the active square
function textActive(n: number): string {
  if (n === 0) return 'text-text-muted'
  return 'text-white'
}

function zoneLabel(zone: Zone, value: number): string {
  if (zone === 'none')     return 'None'
  if (zone === 'mild')     return `Mild — ${value} out of 10`
  if (zone === 'moderate') return `Moderate — ${value} out of 10`
  return `Severe — ${value} out of 10`
}

export default function IntakeVisualScale({ value, onChange, label }: Props) {
  const squares = Array.from({ length: 11 }, (_, i) => i) // 0–10
  const selectedZone = value !== null ? getZone(value) : null

  return (
    <div className="space-y-3">
      {label && (
        <p className="text-sm font-medium text-text-primary">{label}</p>
      )}

      {/* Scale squares */}
      <div className="flex gap-[4px]">
        {squares.map(n => {
          const isFilled = value !== null && n <= value
          const isSelected = value === n

          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={`
                w-[28px] h-[28px] rounded-[6px] flex items-center justify-center
                text-[10px] font-semibold transition-all
                ${isFilled
                  ? `${bgActive(n)} ${textActive(n)}`
                  : `${bgInactive(n)} text-text-muted`
                }
                ${isSelected ? 'ring-2 ring-offset-1 ring-current' : ''}
                hover:opacity-80
              `}
              aria-label={`Severity ${n}`}
            >
              {n}
            </button>
          )
        })}
      </div>

      {/* Zone labels */}
      <div className="flex justify-between text-[10px] text-text-muted px-0.5">
        <span>None</span>
        <span>Mild</span>
        <span>Moderate</span>
        <span>Severe</span>
      </div>

      {/* Selected value readout */}
      {value !== null && (
        <p className={`text-sm font-medium ${
          selectedZone === 'severe'   ? 'text-[#E24B4A]'
          : selectedZone === 'moderate' ? 'text-[#B8935A]'
          : selectedZone === 'mild'   ? 'text-[#1D9E75]'
          : 'text-text-muted'
        }`}>
          {zoneLabel(selectedZone!, value)}
        </p>
      )}
    </div>
  )
}
