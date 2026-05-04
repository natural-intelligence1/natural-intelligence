'use client'

// ─── BodyMapSelector ──────────────────────────────────────────────────────────
// 2-column grid of region chips. Multi-select.
// Output JSON: { scale: 'body_map', regions: ['upper_abdomen', 'lower_abdomen'] }

interface Props {
  value: string[]
  onChange: (regions: string[]) => void
  clinicalObjective?: string
}

const REGIONS = [
  { key: 'head_neck',     label: 'Head & neck'      },
  { key: 'chest',         label: 'Chest'            },
  { key: 'upper_abdomen', label: 'Upper abdomen'    },
  { key: 'lower_abdomen', label: 'Lower abdomen'    },
  { key: 'back_upper',    label: 'Upper back'       },
  { key: 'back_lower',    label: 'Lower back'       },
  { key: 'joints',        label: 'Joints (multiple)'},
  { key: 'muscles',       label: 'Muscles'          },
  { key: 'skin',          label: 'Skin'             },
  { key: 'pelvic',        label: 'Pelvic area'      },
  { key: 'limbs',         label: 'Arms or legs'     },
  { key: 'none',          label: 'No localised pain'},
]

export default function BodyMapSelector({ value, onChange }: Props) {
  function toggle(key: string) {
    if (key === 'none') {
      // Selecting 'none' clears everything else
      onChange(value.includes('none') ? [] : ['none'])
      return
    }
    // Selecting any region deselects 'none'
    const without = value.filter(r => r !== 'none')
    if (without.includes(key)) {
      onChange(without.filter(r => r !== key))
    } else {
      onChange([...without, key])
    }
  }

  const count = value.filter(r => r !== 'none').length

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {REGIONS.map(({ key, label }) => {
          const selected = value.includes(key)
          const isNone = key === 'none'
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              className={`
                flex items-center gap-2.5 px-3 py-2 rounded-lg border text-sm
                text-left transition-all
                ${selected
                  ? 'bg-[#F8F1E4] border-[#B8935A] text-[#633806] font-medium'
                  : isNone
                    ? 'bg-surface-raised border-dashed border-border-default text-text-muted hover:border-[#B8935A]'
                    : 'bg-surface-raised border-border-default text-text-secondary hover:border-[#B8935A] hover:text-text-primary'
                }
              `}
              aria-pressed={selected}
            >
              {selected && !isNone && (
                <span className="w-2 h-2 rounded-full bg-[#B8935A] flex-shrink-0" />
              )}
              {label}
            </button>
          )
        })}
      </div>

      {count > 0 && (
        <p className="text-xs text-text-muted">
          {count} region{count !== 1 ? 's' : ''} selected
        </p>
      )}
    </div>
  )
}
