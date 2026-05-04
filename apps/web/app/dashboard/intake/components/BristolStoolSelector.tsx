'use client'

// ─── BristolStoolSelector ─────────────────────────────────────────────────────
// 7-type bowel pattern selector based on the Bristol Stool Chart.
// Output JSON: { scale: 'bristol', type: N, interpretation: '...' }

interface Props {
  value: number | null
  onChange: (value: number) => void
  clinicalObjective?: string
}

const TYPES = [
  {
    type: 1,
    label: 'Separate hard lumps',
  },
  {
    type: 2,
    label: 'Lumpy sausage',
  },
  {
    type: 3,
    label: 'Sausage with cracks',
  },
  {
    type: 4,
    label: 'Smooth sausage',
  },
  {
    type: 5,
    label: 'Soft blobs',
  },
  {
    type: 6,
    label: 'Fluffy pieces',
  },
  {
    type: 7,
    label: 'Watery liquid',
  },
]

function TypeSVG({ type, selected }: { type: number; selected: boolean }) {
  const fill = type === 4 && selected ? '#639922'
    : type === 4 ? '#A8C96A'
    : selected ? '#B8935A' : '#C4B89A'
  const bg = type === 4 && selected ? '#EAF3DE'
    : selected ? '#F8F1E4' : '#F5F0E8'

  switch (type) {
    case 1:
      // Scattered hard circles
      return (
        <svg width="36" height="24" viewBox="0 0 36 24" fill="none">
          <circle cx="6"  cy="12" r="4" fill={fill} />
          <circle cx="16" cy="8"  r="4" fill={fill} />
          <circle cx="26" cy="14" r="4" fill={fill} />
          <circle cx="32" cy="7"  r="3" fill={fill} />
        </svg>
      )
    case 2:
      // Lumpy sausage — rect with circle overlays
      return (
        <svg width="36" height="24" viewBox="0 0 36 24" fill="none">
          <rect x="4" y="8" width="28" height="10" rx="5" fill={fill} />
          <circle cx="10" cy="8"  r="4" fill={fill} />
          <circle cx="18" cy="7"  r="4" fill={fill} />
          <circle cx="26" cy="8"  r="4" fill={fill} />
        </svg>
      )
    case 3:
      // Sausage with surface cracks
      return (
        <svg width="36" height="24" viewBox="0 0 36 24" fill="none">
          <rect x="4" y="8" width="28" height="10" rx="5" fill={fill} />
          <path d="M10 9 Q12 12 10 15" stroke={bg} strokeWidth="1.2" fill="none" />
          <path d="M18 9 Q20 12 18 15" stroke={bg} strokeWidth="1.2" fill="none" />
          <path d="M26 9 Q28 12 26 15" stroke={bg} strokeWidth="1.2" fill="none" />
        </svg>
      )
    case 4:
      // Smooth sausage — optimal
      return (
        <svg width="36" height="24" viewBox="0 0 36 24" fill="none">
          <rect x="4" y="8" width="28" height="10" rx="5" fill={fill} />
        </svg>
      )
    case 5:
      // Two soft blobs
      return (
        <svg width="36" height="24" viewBox="0 0 36 24" fill="none">
          <ellipse cx="12" cy="13" rx="7"  ry="5"  fill={fill} />
          <ellipse cx="24" cy="12" rx="7"  ry="5"  fill={fill} />
        </svg>
      )
    case 6:
      // Fluffy irregular shape
      return (
        <svg width="36" height="24" viewBox="0 0 36 24" fill="none">
          <path
            d="M6 16 C6 8 10 6 14 9 C16 4 22 4 24 9 C28 6 32 9 30 16 Z"
            fill={fill}
          />
        </svg>
      )
    case 7:
      // Liquid / wavy
      return (
        <svg width="36" height="24" viewBox="0 0 36 24" fill="none">
          <path
            d="M4 12 Q9 8 14 12 Q19 16 24 12 Q29 8 34 12"
            stroke={fill} strokeWidth="3" fill="none" strokeLinecap="round"
          />
          <path
            d="M4 16 Q9 12 14 16 Q19 20 24 16 Q29 12 34 16"
            stroke={fill} strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.5"
          />
        </svg>
      )
    default:
      return null
  }
}

function interpretation(type: number | null): { text: string; cls: string } | null {
  if (type === null) return null
  if (type <= 2) return {
    text: 'Indicates constipation — hydration, fibre and gut health may help.',
    cls: 'text-[#B8935A]',
  }
  if (type <= 4) return {
    text: 'Optimal range. Good bowel transit.',
    cls: 'text-[#1D9E75]',
  }
  if (type <= 6) return {
    text: 'Looser than ideal — gut flora, stress or food sensitivities may be involved.',
    cls: 'text-[#B8935A]',
  }
  return {
    text: 'This pattern warrants attention. If frequent, speak with your GP.',
    cls: 'text-[#E24B4A]',
  }
}

export default function BristolStoolSelector({ value, onChange }: Props) {
  const interp = interpretation(value)

  return (
    <div className="space-y-4">
      {/* Info tooltip text */}
      <p className="text-[11px] text-text-muted leading-relaxed">
        ⓘ The Bristol Stool Chart is a clinical tool used to assess bowel transit time and digestive health. It is not a diagnosis.
      </p>

      {/* 7-column grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {TYPES.map(({ type, label }) => {
          const selected = value === type
          const isOptimal = type === 4

          return (
            <button
              key={type}
              type="button"
              onClick={() => onChange(type)}
              className={`
                flex flex-col items-center gap-1.5 rounded-xl border px-1 py-2
                text-center cursor-pointer transition-all
                ${selected
                  ? isOptimal
                    ? 'bg-[#EAF3DE] border-[#639922]'
                    : 'bg-[#F8F1E4] border-[#B8935A]'
                  : 'bg-surface-raised border-border-default hover:border-[#B8935A]'
                }
              `}
              aria-label={`Type ${type} — ${label}`}
            >
              <TypeSVG type={type} selected={selected} />
              <span className={`text-[11px] font-medium leading-tight ${
                selected ? isOptimal ? 'text-[#3D6B14]' : 'text-[#633806]' : 'text-text-primary'
              }`}>
                Type {type}
              </span>
              <span className="text-[9px] text-text-muted leading-tight">{label}</span>
            </button>
          )
        })}
      </div>

      {/* Interpretation */}
      {interp && (
        <p className={`text-sm leading-relaxed ${interp.cls}`}>
          {interp.text}
        </p>
      )}
    </div>
  )
}
