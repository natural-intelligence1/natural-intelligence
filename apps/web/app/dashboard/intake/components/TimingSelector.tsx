'use client'

// ─── TimingSelector ───────────────────────────────────────────────────────────
// Flex-wrap chip multi-select for when symptoms occur.
// Output JSON: { scale: 'timing', values: ['immediately_after', '1_2hrs_after'] }

interface Props {
  value: string[]
  onChange: (timings: string[]) => void
  context?: 'digestive' | 'energy' | 'general'
  clinicalObjective?: string
}

const BASE_OPTIONS = [
  { key: 'before_meals',      label: 'Before meals'              },
  { key: 'immediately_after', label: 'Immediately after eating'  },
  { key: '1_2hrs_after',      label: '1–2 hours after meals'     },
  { key: '3_4hrs_after',      label: '3–4 hours after meals'     },
  { key: 'evening_night',     label: 'Evening or night'          },
  { key: 'on_waking',         label: 'On waking'                 },
  { key: 'random',            label: 'No clear pattern'          },
]

const ENERGY_EXTRA = [
  { key: 'mid_morning',    label: 'Mid-morning'    },
  { key: 'after_lunch',    label: 'After lunch'    },
  { key: 'late_afternoon', label: 'Late afternoon' },
]

interface ClinicalNote {
  text: string
}

function getClinicalNote(values: string[], context?: string): ClinicalNote | null {
  const has = (k: string) => values.includes(k)

  if (has('before_meals') && has('immediately_after')) {
    return { text: 'This pattern is consistent with low stomach acid or SIBO. Symptoms before or immediately after eating may reflect upper digestive function.' }
  }
  if (has('1_2hrs_after') || has('3_4hrs_after')) {
    return { text: 'Delayed symptoms after meals can suggest gut motility or dysbiosis patterns — where food ferments rather than moving through efficiently.' }
  }
  if (context === 'energy' && has('on_waking')) {
    return { text: 'Poor energy on waking is associated with HPA axis patterns and cortisol rhythm disruption.' }
  }
  return null
}

export default function TimingSelector({ value, onChange, context }: Props) {
  const options = context === 'energy'
    ? [...BASE_OPTIONS, ...ENERGY_EXTRA]
    : BASE_OPTIONS

  function toggle(key: string) {
    onChange(
      value.includes(key)
        ? value.filter(v => v !== key)
        : [...value, key]
    )
  }

  const clinicalNote = value.length >= 2 ? getClinicalNote(value, context) : null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {options.map(({ key, label }) => {
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

      <p className="text-xs text-text-muted">Select all that apply</p>

      {clinicalNote && (
        <p className="text-sm text-text-secondary leading-relaxed border-l-2 border-[#B8935A] pl-3">
          {clinicalNote.text}
        </p>
      )}
    </div>
  )
}
