'use client'

// ─── UrineColourSelector ──────────────────────────────────────────────────────
// Row of coloured pill chips for urine colour assessment.
// Output JSON: { scale: 'urine_colour', value: 'yellow' }

interface Props {
  value: string | null
  onChange: (value: string) => void
  clinicalObjective?: string
}

const OPTIONS = [
  { key: 'pale_clear',    hex: '#F5F0D8', label: 'Pale / clear'  },
  { key: 'light_yellow',  hex: '#F5E87A', label: 'Light yellow'  },
  { key: 'yellow',        hex: '#F0C93A', label: 'Yellow'        },
  { key: 'dark_yellow',   hex: '#C8961A', label: 'Dark yellow'   },
  { key: 'amber',         hex: '#A05E10', label: 'Amber'         },
  { key: 'red_brown',     hex: '#C82828', label: 'Brown / red'   },
]

const FEEDBACK: Record<string, { text: string; warn?: boolean }> = {
  pale_clear:   { text: 'Very pale can indicate good hydration or excessive fluid intake.' },
  light_yellow: { text: 'Good hydration indicator.' },
  yellow:       { text: 'Normal and well-hydrated.' },
  dark_yellow:  { text: 'Mildly dehydrated — try drinking more water.' },
  amber:        { text: 'Dehydrated. Increase fluid intake.' },
  red_brown:    { text: '⚠ Red, pink, or brown urine can sometimes indicate a medical condition that needs review. Please speak with your GP, especially if this is unexplained or new.', warn: true },
}

export default function UrineColourSelector({ value, onChange }: Props) {
  const feedback = value ? FEEDBACK[value] : null

  return (
    <div className="space-y-4">
      {/* Colour chips */}
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map(({ key, hex, label }) => {
          const selected = value === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-full border-2 text-sm
                transition-all cursor-pointer
                ${selected
                  ? 'font-medium bg-surface-raised'
                  : 'border-border-default bg-surface-raised text-text-secondary hover:border-[#B8935A]'
                }
              `}
              style={selected ? { borderColor: hex } : undefined}
              aria-label={label}
            >
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: hex }}
              />
              <span className={selected ? 'text-text-primary' : ''}>{label}</span>
            </button>
          )
        })}
      </div>

      {/* Contextual feedback */}
      {feedback && (
        feedback.warn ? (
          <div className="bg-[#FCEBEB] border border-[#F7C1C1] rounded-lg p-3">
            <p className="text-sm text-[#C82828] leading-relaxed">{feedback.text}</p>
          </div>
        ) : (
          <p className="text-sm text-text-secondary leading-relaxed">{feedback.text}</p>
        )
      )}
    </div>
  )
}
