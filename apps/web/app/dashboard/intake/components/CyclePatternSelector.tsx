'use client'

// ─── CyclePatternSelector ─────────────────────────────────────────────────────
// Chip cloud for hormonal/cycle pattern selection. Multi-select.
// Output JSON: { scale: 'cycle_pattern', values: ['pre_period', 'heavy_bleeding'] }

interface Props {
  value: string[]
  onChange: (patterns: string[]) => void
  clinicalObjective?: string
}

const REGULAR_OPTIONS = [
  { key: 'pre_period',     label: 'Symptoms before my period' },
  { key: 'during_period',  label: 'Symptoms during my period' },
  { key: 'mid_cycle',      label: 'Symptoms at mid-cycle'     },
  { key: 'irregular',      label: 'Irregular cycle'           },
  { key: 'heavy_bleeding', label: 'Heavy bleeding'            },
  { key: 'pain_cramping',  label: 'Pain or cramping'          },
  { key: 'no_pattern',     label: 'No noticeable cycle pattern'},
]

const SPECIAL_OPTIONS = [
  { key: 'not_applicable', label: 'Not applicable'      },
  { key: 'prefer_not',     label: 'Prefer not to say'  },
]

const SPECIAL_KEYS = new Set(['not_applicable', 'prefer_not'])

export default function CyclePatternSelector({ value, onChange }: Props) {
  function toggle(key: string) {
    if (SPECIAL_KEYS.has(key)) {
      // Special options deselect everything else; toggle off if already selected
      onChange(value.includes(key) ? [] : [key])
      return
    }
    // Regular option: remove any special keys
    const without = value.filter(v => !SPECIAL_KEYS.has(v))
    if (without.includes(key)) {
      onChange(without.filter(v => v !== key))
    } else {
      onChange([...without, key])
    }
  }

  return (
    <div className="space-y-4">
      {/* Hint */}
      <p className="text-xs text-text-muted">
        Select all that apply. This helps identify hormonal root cause patterns.
      </p>

      {/* Regular options */}
      <div className="flex flex-wrap gap-2">
        {REGULAR_OPTIONS.map(({ key, label }) => {
          const selected = value.includes(key)
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              className={`
                px-3 py-2 rounded-xl border text-sm transition-all
                ${selected
                  ? 'bg-[#F8F1E4] border-[#B8935A] text-[#633806] font-medium'
                  : 'bg-surface-raised border-border-default text-text-secondary hover:border-[#B8935A] hover:text-text-primary'
                }
              `}
              aria-pressed={selected}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Special options — dashed border */}
      <div className="flex flex-wrap gap-2">
        {SPECIAL_OPTIONS.map(({ key, label }) => {
          const selected = value.includes(key)
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              className={`
                px-3 py-2 rounded-xl border border-dashed text-sm transition-all
                ${selected
                  ? 'bg-surface-muted border-border-default text-text-muted font-medium'
                  : 'bg-surface-raised border-border-default text-text-muted hover:border-[#B8935A]'
                }
              `}
              aria-pressed={selected}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Privacy note */}
      <p className="text-[11px] text-text-muted leading-relaxed">
        🔒 This information is entirely optional and treated with the highest confidentiality.
      </p>
    </div>
  )
}
