'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { saveIntakeSection, completeIntake } from './actions'

// ─── Design tokens ────────────────────────────────────────────────────────────
const CHIP_SELECTED  = 'bg-[#F8F1E4] border-[#B8935A] text-[#633806] font-medium'
const CHIP_DEFAULT   = 'bg-surface-raised border-border-default text-text-secondary hover:border-[#B8935A] hover:text-text-primary'
const TAG_PILL       = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F8F1E4] border border-[#D4B07A] text-[#633806] text-sm font-medium'
const DOT_FILLED     = 'bg-brand-default border-brand-default text-text-inverted'
const DOT_EMPTY      = 'bg-surface-raised border-border-default text-text-muted hover:border-[#B8935A]'

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full transition-all ${
            i < current
              ? 'bg-[#B8935A]'
              : i === current
              ? 'bg-[#0E0D0B]'
              : 'bg-surface-muted'
          }`}
        />
      ))}
    </div>
  )
}

function ChipCloud({
  options,
  selected,
  onChange,
  multi = true,
}: {
  options: string[]
  selected: string[]
  onChange: (next: string[]) => void
  multi?: boolean
}) {
  function toggle(opt: string) {
    if (multi) {
      onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt])
    } else {
      onChange(selected.includes(opt) ? [] : [opt])
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
            selected.includes(opt) ? CHIP_SELECTED : CHIP_DEFAULT
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

function TagInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
}) {
  const [draft, setDraft] = useState('')

  function addTag() {
    const trimmed = draft.trim()
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed])
    }
    setDraft('')
  }

  function removeTag(tag: string) {
    onChange(value.filter(t => t !== tag))
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
          placeholder={placeholder ?? 'Type and press Enter'}
          className="flex-1 px-3 py-2 rounded-lg border border-border-default bg-surface-base text-text-primary placeholder:text-text-placeholder text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent transition-colors"
        />
        <button
          type="button"
          onClick={addTag}
          className="px-4 py-2 rounded-lg bg-brand-default hover:bg-brand-hover text-text-inverted text-sm font-medium transition-colors"
        >
          Add
        </button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map(tag => (
            <span key={tag} className={TAG_PILL}>
              {tag}
              <button type="button" onClick={() => removeTag(tag)} className="text-[#B8935A] hover:text-[#633806]">
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function FiveDot({
  value,
  onChange,
  labels,
}: {
  value: number | null
  onChange: (v: number) => void
  labels?: [string, string]
}) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n * 2)}
            className={`w-10 h-10 rounded-full border-2 text-sm font-semibold transition-all ${
              value !== null && value >= n * 2 ? DOT_FILLED : DOT_EMPTY
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      {labels && (
        <div className="flex justify-between text-xs text-text-muted">
          <span>{labels[0]}</span>
          <span>{labels[1]}</span>
        </div>
      )}
    </div>
  )
}

function SleepSlider({
  value,
  onChange,
}: {
  value: number | null
  onChange: (v: number) => void
}) {
  const display = value ?? 7
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-secondary">Hours per night</span>
        <span className="text-lg font-mono font-semibold text-[#633806]">{display}h</span>
      </div>
      <input
        type="range"
        min={3}
        max={12}
        step={0.5}
        value={display}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full accent-[#B8935A]"
      />
      <div className="flex justify-between text-xs text-text-muted">
        <span>3h</span>
        <span>12h</span>
      </div>
    </div>
  )
}

function EmojiCard({
  emoji,
  label,
  selected,
  onClick,
}: {
  emoji: string
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-sm font-medium transition-all ${
        selected ? CHIP_SELECTED : CHIP_DEFAULT
      }`}
    >
      <span className="text-2xl">{emoji}</span>
      <span>{label}</span>
    </button>
  )
}

// ─── Section data ─────────────────────────────────────────────────────────────

const COMPLAINT_OPTIONS = [
  'Persistent fatigue', 'Poor sleep', 'Low mood', 'Digestive issues',
  'Hormonal symptoms', 'Brain fog', 'Anxiety or worry', 'Joint pain',
  'Weight changes', 'Hair thinning', 'Skin issues', 'Low libido',
  'Frequent infections', 'Headaches', 'Something else',
]

const CONDITION_OPTIONS = [
  'Hypothyroidism', 'IBS', 'PCOS', 'Anxiety', 'Depression',
  'Endometriosis', 'Fibromyalgia', 'Autoimmune condition', 'Diabetes', 'None',
]

const PRACTITIONER_OPTIONS = [
  'GP', 'Nutritionist', 'Naturopath', 'Acupuncturist',
  'Therapist', 'Osteopath', 'Chiropractor', 'Other',
]

const DIET_OPTIONS = [
  { emoji: '🥗', label: 'Balanced' },
  { emoji: '🥩', label: 'Carnivore' },
  { emoji: '🌱', label: 'Plant-based' },
  { emoji: '🚫🍞', label: 'Gluten-free' },
  { emoji: '🥚', label: 'Keto' },
  { emoji: '🍽️', label: 'Intermittent fasting' },
  { emoji: '🤷', label: 'No pattern' },
]

const EXERCISE_OPTIONS = [
  { value: 'daily',          label: 'Daily' },
  { value: '4-6x_week',     label: '4–6×/week' },
  { value: '2-3x_week',     label: '2–3×/week' },
  { value: 'once_week',     label: 'Once a week' },
  { value: 'rarely',        label: 'Rarely' },
  { value: 'not_currently', label: 'Not currently' },
]

const GOAL_OPTIONS = [
  'More consistent energy', 'Better sleep quality', 'Reduce inflammation',
  'Understand my lab results', 'Lose weight sustainably', 'Improve mood',
  'Reduce medication dependency', 'Better gut health', 'Clearer skin',
  'Improve fertility', 'Something else',
]

// ─── FormData type ────────────────────────────────────────────────────────────

interface FormState {
  chief_complaints:      string[]
  complaint_duration:    string
  complaint_severity:    number | null
  existing_conditions:   string[]
  current_medications:   string[]
  current_supplements:   string[]
  previous_practitioners: string[]
  previous_treatments:   string
  diet_type:             string
  exercise_frequency:    string
  sleep_hours:           number | null
  stress_level:          number | null
  energy_level:          number | null
  mood_level:            number | null
  digestion_level:       number | null
  cognitive_level:       number | null
  family_history:        string
  health_goals:          string[]
  additional_notes:      string
}

function initialFormState(existing: Record<string, unknown> | null): FormState {
  return {
    chief_complaints:       (existing?.chief_complaints       as string[]) ?? [],
    complaint_duration:     (existing?.complaint_duration     as string)   ?? '',
    complaint_severity:     (existing?.complaint_severity     as number | null) ?? null,
    existing_conditions:    (existing?.existing_conditions    as string[]) ?? [],
    current_medications:    existing?.current_medications
      ? (existing.current_medications as string).split(',').map(s => s.trim()).filter(Boolean)
      : [],
    current_supplements:    existing?.current_supplements
      ? (existing.current_supplements as string).split(',').map(s => s.trim()).filter(Boolean)
      : [],
    previous_practitioners: (existing?.previous_practitioners as string[]) ?? [],
    previous_treatments:    (existing?.previous_treatments    as string)   ?? '',
    diet_type:              (existing?.diet_type              as string)   ?? '',
    exercise_frequency:     (existing?.exercise_frequency     as string)   ?? '',
    sleep_hours:            (existing?.sleep_hours            as number | null) ?? null,
    stress_level:           (existing?.stress_level           as number | null) ?? null,
    energy_level:           (existing?.energy_level           as number | null) ?? null,
    mood_level:             (existing?.mood_level             as number | null) ?? null,
    digestion_level:        (existing?.digestion_level        as number | null) ?? null,
    cognitive_level:        (existing?.cognitive_level        as number | null) ?? null,
    family_history:         (existing?.family_history         as string)   ?? '',
    health_goals:           (existing?.health_goals           as string[]) ?? [],
    additional_notes:       (existing?.additional_notes       as string)   ?? '',
  }
}

function getSectionData(form: FormState, section: number): Record<string, unknown> {
  switch (section) {
    case 1: return {
      chief_complaints:    form.chief_complaints,
      complaint_duration:  form.complaint_duration  || null,
      complaint_severity:  form.complaint_severity,
    }
    case 2: return {
      existing_conditions: form.existing_conditions,
      current_medications: form.current_medications.join(', ') || null,
      current_supplements: form.current_supplements.join(', ') || null,
    }
    case 3: return {
      previous_practitioners: form.previous_practitioners,
      previous_treatments:    form.previous_treatments || null,
    }
    case 4: return {
      diet_type:          form.diet_type          || null,
      exercise_frequency: form.exercise_frequency || null,
      sleep_hours:        form.sleep_hours,
      stress_level:       form.stress_level,
      alcohol_frequency:  null,
      smoking_status:     null,
    }
    case 5: return {
      energy_level:    form.energy_level,
      mood_level:      form.mood_level,
      digestion_level: form.digestion_level,
      cognitive_level: form.cognitive_level,
      family_history:  form.family_history || null,
    }
    case 6: return {
      health_goals:     form.health_goals,
      additional_notes: form.additional_notes || null,
    }
    default: return {}
  }
}

// ─── Section renderers ────────────────────────────────────────────────────────

function Section1({ form, setForm }: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>> }) {
  const DURATION_OPTIONS = ['Less than 1 month', '1–3 months', '3–6 months', '6–12 months', 'Over a year', 'Most of my life']
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-1">What brings you here?</h2>
        <p className="text-sm text-text-secondary mb-4">Select everything that applies to you right now.</p>
        <ChipCloud
          options={COMPLAINT_OPTIONS}
          selected={form.chief_complaints}
          onChange={v => setForm(f => ({ ...f, chief_complaints: v }))}
        />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary mb-3">How long have you been experiencing this?</p>
        <ChipCloud
          options={DURATION_OPTIONS}
          selected={form.complaint_duration ? [form.complaint_duration] : []}
          onChange={v => setForm(f => ({ ...f, complaint_duration: v[0] ?? '' }))}
          multi={false}
        />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary mb-3">How severe would you say it is? (1 = mild, 10 = debilitating)</p>
        <FiveDot
          value={form.complaint_severity}
          onChange={v => setForm(f => ({ ...f, complaint_severity: v }))}
          labels={['Mild', 'Debilitating']}
        />
      </div>
    </div>
  )
}

function Section2({ form, setForm }: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>> }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-1">Your health history</h2>
        <p className="text-sm text-text-secondary mb-4">Any existing diagnoses or conditions?</p>
        <ChipCloud
          options={CONDITION_OPTIONS}
          selected={form.existing_conditions}
          onChange={v => setForm(f => ({ ...f, existing_conditions: v }))}
        />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary mb-2">Current medications</p>
        <TagInput
          value={form.current_medications}
          onChange={v => setForm(f => ({ ...f, current_medications: v }))}
          placeholder="e.g. Levothyroxine 50mcg — press Enter to add"
        />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary mb-2">Current supplements</p>
        <TagInput
          value={form.current_supplements}
          onChange={v => setForm(f => ({ ...f, current_supplements: v }))}
          placeholder="e.g. Vitamin D 4000IU — press Enter to add"
        />
      </div>
    </div>
  )
}

function Section3({ form, setForm }: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>> }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-1">Previous support</h2>
        <p className="text-sm text-text-secondary mb-4">Which types of practitioners have you worked with?</p>
        <ChipCloud
          options={PRACTITIONER_OPTIONS}
          selected={form.previous_practitioners}
          onChange={v => setForm(f => ({ ...f, previous_practitioners: v }))}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">
          Any treatments or approaches you&apos;ve tried?
        </label>
        <textarea
          value={form.previous_treatments}
          onChange={e => setForm(f => ({ ...f, previous_treatments: e.target.value }))}
          placeholder="e.g. Tried elimination diet, acupuncture course, CBT..."
          rows={3}
          className="w-full px-3 py-2.5 rounded-lg border border-border-default bg-surface-base text-text-primary placeholder:text-text-placeholder text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent transition-colors resize-none"
        />
      </div>
    </div>
  )
}

function Section4({ form, setForm }: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>> }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-1">Lifestyle</h2>
        <p className="text-sm text-text-secondary mb-4">Help us understand your day-to-day habits.</p>
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary mb-3">What best describes your diet?</p>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {DIET_OPTIONS.map(d => (
            <EmojiCard
              key={d.label}
              emoji={d.emoji}
              label={d.label}
              selected={form.diet_type === d.label}
              onClick={() => setForm(f => ({ ...f, diet_type: f.diet_type === d.label ? '' : d.label }))}
            />
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary mb-3">How often do you exercise?</p>
        <ChipCloud
          options={EXERCISE_OPTIONS.map(o => o.label)}
          selected={form.exercise_frequency ? [EXERCISE_OPTIONS.find(o => o.value === form.exercise_frequency)?.label ?? form.exercise_frequency] : []}
          onChange={v => {
            const found = EXERCISE_OPTIONS.find(o => o.label === v[0])
            setForm(f => ({ ...f, exercise_frequency: found?.value ?? v[0] ?? '' }))
          }}
          multi={false}
        />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary mb-3">How much do you sleep?</p>
        <SleepSlider
          value={form.sleep_hours}
          onChange={v => setForm(f => ({ ...f, sleep_hours: v }))}
        />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary mb-3">Stress level (1 = calm, 10 = overwhelmed)</p>
        <FiveDot
          value={form.stress_level}
          onChange={v => setForm(f => ({ ...f, stress_level: v }))}
          labels={['Calm', 'Overwhelmed']}
        />
      </div>
    </div>
  )
}

function Section5({ form, setForm }: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>> }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-1">How you feel day to day</h2>
        <p className="text-sm text-text-secondary mb-4">Rate each area on a scale of 1–10.</p>
      </div>
      {[
        { label: 'Energy', field: 'energy_level' as const,    hint: ['Very low', 'High & consistent'] },
        { label: 'Mood',   field: 'mood_level' as const,      hint: ['Low / flat', 'Positive & stable'] },
        { label: 'Digestion', field: 'digestion_level' as const, hint: ['Problematic', 'Comfortable'] },
        { label: 'Cognitive function', field: 'cognitive_level' as const, hint: ['Brain fog', 'Sharp & clear'] },
      ].map(({ label, field, hint }) => (
        <div key={field}>
          <p className="text-sm font-medium text-text-primary mb-2">{label}</p>
          <FiveDot
            value={form[field]}
            onChange={v => setForm(f => ({ ...f, [field]: v }))}
            labels={hint as [string, string]}
          />
        </div>
      ))}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">
          Any relevant family health history? <span className="text-text-muted font-normal">(optional)</span>
        </label>
        <textarea
          value={form.family_history}
          onChange={e => setForm(f => ({ ...f, family_history: e.target.value }))}
          placeholder="e.g. Mother has Hashimoto's, father had type 2 diabetes..."
          rows={3}
          className="w-full px-3 py-2.5 rounded-lg border border-border-default bg-surface-base text-text-primary placeholder:text-text-placeholder text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent transition-colors resize-none"
        />
      </div>
    </div>
  )
}

function Section6({
  form,
  setForm,
  consent,
  setConsent,
}: {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  consent: boolean
  setConsent: (v: boolean) => void
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-1">Your goals</h2>
        <p className="text-sm text-text-secondary mb-4">What do you most want to achieve?</p>
        <ChipCloud
          options={GOAL_OPTIONS}
          selected={form.health_goals}
          onChange={v => setForm(f => ({ ...f, health_goals: v }))}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">
          Anything else you&apos;d like us to know? <span className="text-text-muted font-normal">(optional)</span>
        </label>
        <textarea
          value={form.additional_notes}
          onChange={e => setForm(f => ({ ...f, additional_notes: e.target.value }))}
          placeholder="Any context, concerns, or goals not covered above..."
          rows={4}
          className="w-full px-3 py-2.5 rounded-lg border border-border-default bg-surface-base text-text-primary placeholder:text-text-placeholder text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent transition-colors resize-none"
        />
      </div>
      {/* Consent block */}
      <div className="bg-[#F8F1E4] border border-[#D4B07A] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-[#633806] mb-2">AI analysis consent</h3>
        <p className="text-xs text-[#633806] leading-relaxed mb-4">
          Natural Intelligence will use the information you&apos;ve provided, along with any lab report data and root cause analysis results, to generate a personalised health synopsis using Claude (by Anthropic). This synopsis is for informational purposes only and does not constitute medical advice.
        </p>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={consent}
            onChange={e => setConsent(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-[#B8935A] text-brand-default focus:ring-brand-default"
          />
          <span className="text-sm text-[#633806] leading-relaxed">
            I consent to my health data being processed by AI to generate my health synopsis. I understand this is not a medical diagnosis.
          </span>
        </label>
      </div>
    </div>
  )
}

// ─── Main IntakeForm ──────────────────────────────────────────────────────────

export function IntakeForm({
  existing,
  memberId: _memberId,
}: {
  existing: Record<string, unknown> | null
  memberId: string
}) {
  const router  = useRouter()
  const initial = Math.min((existing?.completed_sections as number | undefined) ?? 0, 5)
  const [section,  setSection]  = useState<number>(initial)
  const [form,     setForm]     = useState<FormState>(() => initialFormState(existing))
  const [consent,  setConsent]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const TOTAL = 6

  const handleNext = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      const sectionNum = section + 1
      await saveIntakeSection(getSectionData(form, sectionNum), sectionNum)
      setSection(s => Math.min(s + 1, TOTAL - 1))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }, [form, section])

  const handleBack = useCallback(() => {
    setSection(s => Math.max(s - 1, 0))
    setError(null)
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!consent) {
      setError('Please give your consent to AI analysis to continue.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      // Save final section data first
      await saveIntakeSection(getSectionData(form, 6), 6)
      await completeIntake({
        consent_to_ai_analysis: true,
        consent_given_at:       new Date().toISOString(),
      })
      router.push('/dashboard/synopsis')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setSaving(false)
    }
  }, [consent, form, router])

  const isLastSection = section === TOTAL - 1

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <p className="text-xs font-semibold text-text-brand uppercase tracking-wider mb-1">Health intake</p>
        <h1 className="text-2xl font-bold text-text-primary">Tell us about your health</h1>
        <p className="text-sm text-text-secondary mt-1">
          This helps us generate your personalised health synopsis. Takes about 5 minutes.
        </p>
      </div>

      <StepIndicator current={section} total={TOTAL} />

      {/* Section content */}
      <div className="rounded-xl border border-border-default bg-surface-raised p-6 mb-6">
        {section === 0 && <Section1 form={form} setForm={setForm} />}
        {section === 1 && <Section2 form={form} setForm={setForm} />}
        {section === 2 && <Section3 form={form} setForm={setForm} />}
        {section === 3 && <Section4 form={form} setForm={setForm} />}
        {section === 4 && <Section5 form={form} setForm={setForm} />}
        {section === 5 && (
          <Section6
            form={form}
            setForm={setForm}
            consent={consent}
            setConsent={setConsent}
          />
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 mb-4">{error}</p>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between gap-4">
        {section > 0 ? (
          <button
            type="button"
            onClick={handleBack}
            disabled={saving}
            className="px-4 py-2.5 rounded-lg border border-border-default text-sm font-medium text-text-secondary hover:bg-surface-muted transition-colors disabled:opacity-50"
          >
            ← Back
          </button>
        ) : (
          <div />
        )}

        {isLastSection ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !consent}
            className="px-6 py-2.5 rounded-lg bg-brand-default hover:bg-brand-hover text-text-inverted text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? 'Generating synopsis…' : 'Generate my synopsis →'}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNext}
            disabled={saving}
            className="px-6 py-2.5 rounded-lg bg-brand-default hover:bg-brand-hover text-text-inverted text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Next →'}
          </button>
        )}
      </div>

      <p className="text-xs text-text-muted text-center mt-4">
        Your progress is saved automatically as you move between sections.
      </p>
    </div>
  )
}
