'use client'

// ─── NumberStepper ────────────────────────────────────────────────────────────
// Replaces MoonSelector for sleep hours input.
// Layout: [−]  7 hours  [+]
// Range 0–12, default 7. Value rendered in font-display at 24px.
// Buttons use border-border-default, hover:border-brand-default.

interface Props {
  value:    number | null
  onChange: (v: number) => void
  min?:     number
  max?:     number
  default?: number
  unit?:    string
}

export default function NumberStepper({
  value,
  onChange,
  min      = 0,
  max      = 12,
  default: defaultVal = 7,
  unit     = 'hours',
}: Props) {
  const display = value ?? defaultVal

  function decrement() {
    const next = display - 1
    if (next >= min) onChange(next)
  }

  function increment() {
    const next = display + 1
    if (next <= max) onChange(next)
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={decrement}
        disabled={display <= min}
        aria-label="Decrease"
        className="w-10 h-10 rounded-lg border border-border-default bg-surface-raised
                   text-text-primary text-lg font-light flex items-center justify-center
                   transition-all hover:border-brand-default hover:bg-brand-ultra/40
                   disabled:opacity-40 disabled:cursor-not-allowed"
      >
        −
      </button>

      <span
        className="font-display text-2xl font-light text-text-primary min-w-[7rem] text-center tabular-nums"
      >
        {display} {unit}
      </span>

      <button
        type="button"
        onClick={increment}
        disabled={display >= max}
        aria-label="Increase"
        className="w-10 h-10 rounded-lg border border-border-default bg-surface-raised
                   text-text-primary text-lg font-light flex items-center justify-center
                   transition-all hover:border-brand-default hover:bg-brand-ultra/40
                   disabled:opacity-40 disabled:cursor-not-allowed"
      >
        +
      </button>
    </div>
  )
}
