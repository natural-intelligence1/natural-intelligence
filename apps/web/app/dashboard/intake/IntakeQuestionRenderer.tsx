'use client'

// ─── IntakeQuestionRenderer ───────────────────────────────────────────────────
// Renders the appropriate visual input component for a given question.
// Structured answer JSON is passed back via onChange.
// All components output JSON that maps to intake_answers.answer.

import type { Question } from './questionBank'
import IntakeVisualScale    from './components/IntakeVisualScale'
import BristolStoolSelector from './components/BristolStoolSelector'
import UrineColourSelector  from './components/UrineColourSelector'
import BodyMapSelector      from './components/BodyMapSelector'
import TimingSelector       from './components/TimingSelector'
import EnergyCurveSelector  from './components/EnergyCurveSelector'
import CyclePatternSelector from './components/CyclePatternSelector'

interface Props {
  question:  Question
  value:     unknown
  onChange:  (answer: unknown) => void
}

// ─── Chip cloud (multi-select) ────────────────────────────────────────────────

function ChipCloud({
  options,
  value,
  onChange,
  multi = true,
}: {
  options:  string[]
  value:    string[]
  onChange: (v: string[]) => void
  multi?:   boolean
}) {
  function toggle(opt: string) {
    if (multi) {
      onChange(value.includes(opt) ? value.filter(s => s !== opt) : [...value, opt])
    } else {
      onChange(value.includes(opt) ? [] : [opt])
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => toggle(opt)}
          className={`px-3 py-2 rounded-xl border text-sm transition-all ${
            value.includes(opt)
              ? 'bg-[#F8F1E4] border-[#B8935A] text-[#633806] font-medium'
              : 'bg-surface-raised border-border-default text-text-secondary hover:border-[#B8935A] hover:text-text-primary'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

// ─── FiveDot scale ────────────────────────────────────────────────────────────

function FiveDot({
  value,
  onChange,
}: {
  value:    number | null
  onChange: (v: number) => void
}) {
  return (
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`w-10 h-10 rounded-full border-2 text-sm font-semibold transition-all ${
            value !== null && value >= n
              ? 'bg-brand-default border-brand-default text-text-inverted'
              : 'bg-surface-raised border-border-default text-text-muted hover:border-[#B8935A]'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

// ─── Sleep slider ─────────────────────────────────────────────────────────────

function SleepSlider({
  value,
  onChange,
}: {
  value:    number | null
  onChange: (v: number) => void
}) {
  const display = value ?? 7
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-secondary">Hours per night</span>
        <span className="text-lg font-mono font-semibold text-[#633806]">{display}h</span>
      </div>
      <input
        type="range" min={3} max={12} step={0.5} value={display}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full accent-[#B8935A]"
      />
      <div className="flex justify-between text-xs text-text-muted">
        <span>3h</span><span>12h</span>
      </div>
    </div>
  )
}

// ─── Main renderer ────────────────────────────────────────────────────────────

export default function IntakeQuestionRenderer({ question, value, onChange }: Props) {
  const { id, inputType, options, context } = question

  switch (inputType) {

    // Existing types
    case 'chip_cloud':
      return (
        <ChipCloud
          options={options ?? []}
          value={(value as string[] | null) ?? []}
          onChange={v => onChange({ scale: 'chip_multi', values: v })}
          multi={true}
        />
      )

    case 'chip_cloud_single':
      return (
        <ChipCloud
          options={options ?? []}
          value={value ? [(value as { value: string }).value] : []}
          onChange={v => onChange({ scale: 'chip_single', value: v[0] ?? null })}
          multi={false}
        />
      )

    case 'scale_5_dots':
      return (
        <FiveDot
          value={(value as { value: number } | null)?.value ?? null}
          onChange={v => onChange({ scale: 'scale_5', value: v })}
        />
      )

    case 'sleep_slider':
      return (
        <SleepSlider
          value={(value as { hours: number } | null)?.hours ?? null}
          onChange={v => onChange({ scale: 'sleep_hours', hours: v })}
        />
      )

    case 'textarea':
      return (
        <textarea
          value={typeof value === 'string' ? value : ''}
          onChange={e => onChange(e.target.value)}
          placeholder={question.placeholder ?? 'Type your response…'}
          rows={4}
          className="w-full px-3 py-2.5 rounded-lg border border-border-default bg-surface-base text-text-primary placeholder:text-text-placeholder text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent transition-colors resize-none"
        />
      )

    // ── New visual input types ─────────────────────────────────────────────

    case 'visual_scale':
      return (
        <IntakeVisualScale
          value={(value as { value: number } | null)?.value ?? null}
          onChange={v => onChange({ scale: 'severity_10', value: v })}
          clinicalObjective={question.helperText}
        />
      )

    case 'bristol_stool':
      return (
        <BristolStoolSelector
          value={(value as { type: number } | null)?.type ?? null}
          onChange={v => {
            const interp = v <= 2 ? 'constipation_pattern'
              : v <= 4 ? 'optimal_range'
              : v <= 6 ? 'loose_pattern'
              : 'liquid_pattern'
            onChange({ scale: 'bristol', type: v, interpretation: interp })
          }}
          clinicalObjective={question.helperText}
        />
      )

    case 'urine_colour':
      return (
        <UrineColourSelector
          value={(value as { value: string } | null)?.value ?? null}
          onChange={v => onChange({ scale: 'urine_colour', value: v })}
          clinicalObjective={question.helperText}
        />
      )

    case 'body_map':
      return (
        <BodyMapSelector
          value={(value as { regions: string[] } | null)?.regions ?? []}
          onChange={v => onChange({ scale: 'body_map', regions: v })}
          clinicalObjective={question.helperText}
        />
      )

    case 'timing_selector':
      return (
        <TimingSelector
          value={(value as { values: string[] } | null)?.values ?? []}
          onChange={v => onChange({ scale: 'timing', values: v })}
          context={context}
          clinicalObjective={question.helperText}
        />
      )

    case 'energy_curve':
      return (
        <EnergyCurveSelector
          value={(value as { value: string } | null)?.value ?? null}
          onChange={v => onChange({ scale: 'energy_curve', value: v })}
          clinicalObjective={question.helperText}
        />
      )

    case 'cycle_pattern':
      return (
        <CyclePatternSelector
          value={(value as { values: string[] } | null)?.values ?? []}
          onChange={v => onChange({ scale: 'cycle_pattern', values: v })}
          clinicalObjective={question.helperText}
        />
      )

    default:
      return (
        <p className="text-sm text-text-muted italic">
          Unknown question type: {inputType} (id: {id})
        </p>
      )
  }
}
