'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { saveIntakeSection, completeIntake } from './actions'
import IntakeVisualScale    from './components/IntakeVisualScale'
import BristolStoolSelector from './components/BristolStoolSelector'
import TimingSelector       from './components/TimingSelector'
import EnergyCurveSelector  from './components/EnergyCurveSelector'
import CyclePatternSelector from './components/CyclePatternSelector'

// ─── Journey nodes ────────────────────────────────────────────────────────────

const JOURNEY_NODES = [
  'Arrival', 'Your story', 'Deeper dive', 'Timeline',
  'Daily life', 'Medical', 'Mind', 'Goals', 'Readiness', 'Complete',
]

function JourneyMap({ current }: { current: number }) {
  return (
    <div className="flex items-start mb-10 overflow-x-auto pb-2 -mx-1 px-1">
      {JOURNEY_NODES.map((label, i) => {
        const isDone    = i < current
        const isCurrent = i === current
        return (
          <div key={i} className="flex items-start flex-shrink-0" style={{ minWidth: 0 }}>
            <div className="flex flex-col items-center gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold transition-all ${
                isDone    ? 'bg-[#B8935A] text-text-inverted'
                : isCurrent ? 'bg-[#0E0D0B] text-text-inverted'
                : 'border border-border-default text-text-muted'
              }`}>
                {isDone ? '✓' : i + 1}
              </div>
              <span className="text-[9px] text-text-muted text-center leading-tight max-w-[52px]">{label}</span>
            </div>
            {i < JOURNEY_NODES.length - 1 && (
              <div className={`h-px w-6 mt-3.5 flex-shrink-0 mx-0.5 transition-all ${
                i < current ? 'bg-[#B8935A]' : 'bg-border-default'
              }`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  section, name, heading, subtitle,
}: { section: number; name: string; heading: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <p className="text-[10px] uppercase tracking-[0.14em] text-[#B8935A] font-medium mb-2">
        Section {section} of {JOURNEY_NODES.length - 1} — {name}
      </p>
      <h2 className="font-display text-2xl font-light text-text-primary leading-snug mb-1">
        {heading}
      </h2>
      <p className="text-sm italic text-text-secondary">{subtitle}</p>
    </div>
  )
}

// ─── Acknowledgement banner ───────────────────────────────────────────────────

function AcknowledgementBanner({ text }: { text: string }) {
  return (
    <div className="border-l-4 border-[#B8935A] bg-[#F8F1E4] px-5 py-4 rounded-r-xl mb-6">
      <p className="font-display italic text-base text-[#633806] leading-relaxed">{text}</p>
    </div>
  )
}

// ─── Big visual chip cloud (large rounded-full chips per spec) ────────────────

function BigChipCloud({
  options, selected, onChange, multi = true,
}: { options: string[]; selected: string[]; onChange: (v: string[]) => void; multi?: boolean }) {
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
        <button key={opt} type="button" onClick={() => toggle(opt)}
          className={`px-5 py-2.5 rounded-full border text-sm transition-all ${
            selected.includes(opt)
              ? 'bg-[#F8F1E4] border-[#B8935A] text-[#633806] font-medium'
              : 'border-border-default bg-surface-raised text-text-secondary hover:border-[#B8935A] hover:text-text-primary'
          }`}
        >{opt}</button>
      ))}
    </div>
  )
}

// ─── Emoji card grid ──────────────────────────────────────────────────────────

interface EmojiOption { key: string; icon: string; label: string; sub?: string }

function EmojiCardGrid({
  options, selected, onChange, cols = 4, single = true,
}: { options: EmojiOption[]; selected: string[]; onChange: (v: string[]) => void; cols?: number; single?: boolean }) {
  function toggle(key: string) {
    if (single) {
      onChange(selected.includes(key) ? [] : [key])
    } else {
      onChange(selected.includes(key) ? selected.filter(k => k !== key) : [...selected, key])
    }
  }
  const gridClass: Record<number, string> = {
    2: 'grid grid-cols-2 gap-3',
    3: 'grid grid-cols-3 gap-3',
    4: 'grid grid-cols-4 gap-2',
    5: 'flex flex-wrap gap-2',
  }
  return (
    <div className={gridClass[cols] ?? 'flex flex-wrap gap-2'}>
      {options.map(({ key, icon, label, sub }) => {
        const sel = selected.includes(key)
        return (
          <button key={key} type="button" onClick={() => toggle(key)}
            className={`flex flex-col items-center gap-3 rounded-2xl border px-5 py-5 cursor-pointer transition-all text-center ${
              sel ? 'bg-[#F8F1E4] border-[#B8935A] text-[#633806]' : 'bg-surface-raised border-border-default text-text-secondary hover:border-[#B8935A] hover:text-text-primary'
            }`}
          >
            <span style={{ fontSize: 32, lineHeight: 1 }}>{icon}</span>
            <span className="text-sm font-medium leading-tight">{label}</span>
            {sub && <span className="text-[11px] text-text-muted leading-tight">{sub}</span>}
          </button>
        )
      })}
    </div>
  )
}

// ─── Moon sleep selector ──────────────────────────────────────────────────────

function MoonSelector({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const hours = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
  const display = value ?? null
  const note = value === null ? null
    : value <= 5 ? 'Short sleep duration can significantly impact health and recovery.'
    : value <= 6 ? 'Slightly below most adults\' optimal range.'
    : value <= 9 ? 'Good sleep duration for most adults.'
    : 'Long sleep can sometimes indicate fatigue or other factors worth exploring.'
  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {hours.map(h => {
          const filled = display !== null && h <= display
          return (
            <button key={h} type="button" onClick={() => onChange(h)}
              className="text-2xl transition-all"
              style={{ opacity: filled ? 1 : 0.25, filter: filled ? 'sepia(80%) saturate(200%) hue-rotate(5deg)' : 'none' }}
              aria-label={`${h} hours`}
            >🌙</button>
          )
        })}
      </div>
      {display !== null && (
        <p className="font-mono text-2xl font-light text-[#633806]">{display} hours</p>
      )}
      {note && <p className="text-sm text-text-secondary leading-relaxed">{note}</p>}
    </div>
  )
}

// ─── Named five-dot (each dot has a label) ────────────────────────────────────

function NamedFiveDot({
  value, onChange, labels,
}: { value: number | null; onChange: (v: number) => void; labels: string[] }) {
  return (
    <div className="space-y-2">
      <div className="flex gap-3">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button" onClick={() => onChange(n)}
            className={`w-10 h-10 rounded-full border-2 text-sm font-semibold transition-all flex-shrink-0 ${
              value !== null && value >= n
                ? 'bg-[#B8935A] border-[#B8935A] text-text-inverted'
                : 'bg-surface-raised border-border-default text-text-muted hover:border-[#B8935A]'
            }`}
          >{n}</button>
        ))}
      </div>
      {labels.length === 5 && (
        <div className="flex gap-3">
          {labels.map((l, i) => (
            <span key={i} className="text-[10px] text-text-muted w-10 text-center leading-tight">{l}</span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Boolean two-card ─────────────────────────────────────────────────────────

function BooleanCards({
  value, onChange, yesLabel, noLabel, yesSub, noSub,
}: { value: boolean | null; onChange: (v: boolean) => void; yesLabel: string; noLabel: string; yesSub?: string; noSub?: string }) {
  return (
    <div className="flex gap-3">
      {[{ val: true, icon: '↑', label: yesLabel, sub: yesSub }, { val: false, icon: '✓', label: noLabel, sub: noSub }].map(({ val, icon, label, sub }) => {
        const sel = value === val
        return (
          <button key={String(val)} type="button" onClick={() => onChange(val)}
            className={`flex-1 rounded-2xl border py-6 flex flex-col items-center gap-3 cursor-pointer text-center transition-all ${
              sel ? 'bg-[#F8F1E4] border-2 border-[#B8935A] text-[#633806]' : 'bg-surface-raised border-border-default text-text-secondary hover:border-[#B8935A]'
            }`}
          >
            <span className="text-2xl">{icon}</span>
            <span className="text-sm font-medium">{label}</span>
            {sub && <span className="text-[11px] text-text-muted">{sub}</span>}
          </button>
        )
      })}
    </div>
  )
}

// ─── Tag input ────────────────────────────────────────────────────────────────

function TagInput({
  value, onChange, placeholder, presets,
}: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; presets?: string[] }) {
  const [draft, setDraft] = useState('')
  function addTag(tag?: string) {
    const t = (tag ?? draft).trim()
    if (t && !value.includes(t)) onChange([...value, t])
    if (!tag) setDraft('')
  }
  function removeTag(t: string) { onChange(value.filter(x => x !== t)) }
  return (
    <div className="space-y-2">
      {presets && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {presets.filter(p => !value.includes(p)).map(p => (
            <button key={p} type="button" onClick={() => addTag(p)}
              className="px-3 py-1 rounded-full border border-border-default text-xs text-text-muted hover:border-[#B8935A] hover:text-text-primary transition-all"
            >+ {p}</button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input type="text" value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
          placeholder={placeholder ?? 'Type and press Enter'}
          className="flex-1 px-3 py-2 rounded-lg border border-border-default bg-surface-base text-text-primary placeholder:text-text-placeholder text-sm focus:outline-none focus:ring-2 focus:ring-[#B8935A] focus:border-transparent transition-colors"
        />
        <button type="button" onClick={() => addTag()}
          className="px-4 py-2 rounded-lg bg-[#B8935A] hover:bg-[#9E7A47] text-text-inverted text-sm font-medium transition-colors"
        >Add</button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map(t => (
            <span key={t} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F8F1E4] border border-[#D4B07A] text-[#633806] text-sm">
              {t}
              <button type="button" onClick={() => removeTag(t)} className="text-[#B8935A] hover:text-[#633806]">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Warm textarea ────────────────────────────────────────────────────────────

function WarmTextarea({ value, onChange, placeholder, rows = 4 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea value={value} rows={rows} onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-4 py-3 rounded-xl border border-border-default bg-surface-base text-text-primary placeholder:text-text-placeholder text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#B8935A] focus:border-transparent transition-colors resize-none"
    />
  )
}

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  arrival_emotion:      string
  primary_concerns:     string[]
  concern_duration:     string
  symptom_pattern:      string
  systems_reviewed:     string[]
  gi_bloating:          boolean | null
  gi_timing:            string[]
  gi_severity:          number | null
  gi_stool_type:        number | null
  energy_low_times:     string[]
  energy_curve:         string
  energy_severity:      number | null
  hormonal_symptoms:    string[]
  cycle_patterns:       string[]
  timeline_last_well:   string
  timeline_trigger:     string
  sleep_hours:          number | null
  sleep_quality:        number | null
  stress_level:         number | null
  energy_level:         number | null
  exercise_frequency:   string
  diet_description:     string
  diagnosed_conditions: string[]
  current_medications:  string
  current_supplements:  string
  past_treatments:      string
  practitioner_types:   string[]
  surgeries_or_injuries:string
  family_history:       string[]
  psychosocial_impact:  string
  psychosocial_worry:   string
  psychosocial_supported: string
  health_goals:         string[]
  timeline_expectation: string
  biggest_barrier:      string
  readiness_time:       string
  readiness_budget:     string
  readiness_change:     string
}

function initialState(e: Record<string, unknown> | null): FormState {
  const arr = (k: string) => (e?.[k] as string[] | null) ?? []
  const str = (k: string) => (e?.[k] as string | null) ?? ''
  const num = (k: string) => (e?.[k] as number | null) ?? null
  const bol = (k: string) => (e?.[k] as boolean | null) ?? null
  return {
    arrival_emotion:      str('arrival_emotion'),
    primary_concerns:     arr('primary_concerns'),
    concern_duration:     str('concern_duration'),
    symptom_pattern:      str('symptom_pattern'),
    systems_reviewed:     arr('systems_reviewed'),
    gi_bloating:          bol('gi_bloating') as boolean | null,
    gi_timing:            [],
    gi_severity:          null,
    gi_stool_type:        null,
    energy_low_times:     [],
    energy_curve:         '',
    energy_severity:      null,
    hormonal_symptoms:    [],
    cycle_patterns:       [],
    timeline_last_well:   str('timeline_last_well'),
    timeline_trigger:     str('timeline_trigger'),
    sleep_hours:          num('sleep_hours'),
    sleep_quality:        num('sleep_quality'),
    stress_level:         num('stress_level'),
    energy_level:         num('energy_level'),
    exercise_frequency:   str('exercise_frequency'),
    diet_description:     str('diet_description'),
    diagnosed_conditions: arr('diagnosed_conditions'),
    current_medications:  str('current_medications'),
    current_supplements:  str('current_supplements'),
    past_treatments:      str('past_treatments'),
    practitioner_types:   arr('practitioner_types'),
    surgeries_or_injuries:str('surgeries_or_injuries'),
    family_history:       arr('family_history'),
    psychosocial_impact:  str('psychosocial_impact'),
    psychosocial_worry:   str('psychosocial_worry'),
    psychosocial_supported: '',
    health_goals:         arr('health_goals'),
    timeline_expectation: str('timeline_expectation'),
    biggest_barrier:      str('biggest_barrier'),
    readiness_time:       str('readiness_time'),
    readiness_budget:     str('readiness_budget'),
    readiness_change:     str('readiness_change'),
  }
}

function detectPrimarySystem(concerns: string[]): string {
  if (concerns.some(c => c.toLowerCase().includes('digest') || c.toLowerCase().includes('bloat'))) return 'digestive'
  if (concerns.some(c => c.toLowerCase().includes('hormonal'))) return 'hormonal'
  if (concerns.some(c => c.toLowerCase().includes('tired') || c.toLowerCase().includes('fatigue') || c.toLowerCase().includes('exhaust'))) return 'energy'
  if (concerns.some(c => c.toLowerCase().includes('brain fog') || c.toLowerCase().includes('focus'))) return 'cognitive'
  return 'general'
}

function getSectionData(f: FormState, s: number): Record<string, unknown> {
  const primarySystem = detectPrimarySystem(f.primary_concerns)
  switch (s) {
    case 1: return { arrival_emotion: f.arrival_emotion || null }
    case 2: return { primary_concerns: f.primary_concerns, concern_duration: f.concern_duration || null, symptom_pattern: f.symptom_pattern || null, primary_system: primarySystem }
    case 3: return { systems_reviewed: f.systems_reviewed, primary_system: primarySystem }
    case 4: return { timeline_last_well: f.timeline_last_well || null, timeline_trigger: f.timeline_trigger || null }
    case 5: return { sleep_hours: f.sleep_hours, sleep_quality: f.sleep_quality, stress_level: f.stress_level, energy_level: f.energy_level, exercise_frequency: f.exercise_frequency || null, diet_description: f.diet_description || null }
    case 6: return { diagnosed_conditions: f.diagnosed_conditions, current_medications: f.current_medications || null, current_supplements: f.current_supplements || null, past_treatments: f.past_treatments || null, practitioner_types: f.practitioner_types, surgeries_or_injuries: f.surgeries_or_injuries || null, family_history: f.family_history }
    case 7: return { psychosocial_impact: f.psychosocial_impact || null, psychosocial_worry: f.psychosocial_worry || null, psychosocial_supported: f.psychosocial_supported ? ['alone', 'not_really'].includes(f.psychosocial_supported) ? false : true : null }
    case 8: return { health_goals: f.health_goals, timeline_expectation: f.timeline_expectation || null, biggest_barrier: f.biggest_barrier || null }
    case 9: return { readiness_time: f.readiness_time || null, readiness_budget: f.readiness_budget || null, readiness_change: f.readiness_change || null }
    default: return {}
  }
}

// ─── Arrival emotion acknowledgements ─────────────────────────────────────────

function arrivalAck(emotion: string): string {
  switch (emotion) {
    case 'frustrated': return 'Thank you for being here despite the frustration. That feeling makes complete sense.'
    case 'worried':    return 'It takes courage to look into this. You\'re in the right place.'
    case 'hopeful':    return 'That energy is exactly right for this. Let\'s make the most of it.'
    case 'curious':    return 'Curiosity is the best starting point. Let\'s explore this together.'
    case 'exhausted':  return 'I know arriving here when you\'re exhausted takes real effort. Thank you for coming.'
    default:           return 'Thank you for being here. Let\'s explore this together, at your pace.'
  }
}

// ─── Section 0 — Arrival ──────────────────────────────────────────────────────

const ARRIVAL_EMOTIONS: EmojiOption[] = [
  { key: 'hopeful',    icon: '😌', label: 'Hopeful'    },
  { key: 'frustrated', icon: '😤', label: 'Frustrated'  },
  { key: 'worried',    icon: '😟', label: 'Worried'     },
  { key: 'curious',    icon: '🤔', label: 'Curious'     },
  { key: 'exhausted',  icon: '😞', label: 'Exhausted'   },
]

function Section0({ form, setForm }: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>> }) {
  return (
    <div className="text-center space-y-6">
      <div className="flex justify-center mb-2">
        <div className="w-16 h-16 rounded-2xl bg-[#F8F1E4] border border-[#D4B07A] flex items-center justify-center">
          <span className="text-3xl">🌿</span>
        </div>
      </div>
      <div>
        <h1 className="font-display text-4xl font-light text-text-primary leading-tight mb-4">
          This space is for you.
        </h1>
        <p className="text-[15px] text-text-secondary leading-relaxed max-w-md mx-auto">
          We&apos;re going to explore your health together — step by step, at your pace.
          Nothing overwhelming. Just honest questions and space to answer them.
        </p>
      </div>
      <div className="pt-4">
        <p className="text-[11px] uppercase tracking-[0.14em] text-[#B8935A] font-medium mb-4">
          How are you feeling arriving here today?
        </p>
        <EmojiCardGrid
          options={ARRIVAL_EMOTIONS}
          selected={form.arrival_emotion ? [form.arrival_emotion] : []}
          onChange={v => setForm(f => ({ ...f, arrival_emotion: v[0] ?? '' }))}
          cols={5}
          single={true}
        />
      </div>
    </div>
  )
}

// ─── Section 1 — Your story ───────────────────────────────────────────────────

const PRIMARY_CONCERNS = [
  'Always tired or exhausted', 'Poor or broken sleep', 'Digestive issues or bloating',
  'Hormonal symptoms', 'Brain fog or poor focus', 'Anxiety or low mood',
  'Chronic pain or joint issues', 'Skin problems', 'Weight changes',
  'Hair thinning', 'Frequent infections', 'Something else',
]

const DURATION_EMOJIS: EmojiOption[] = [
  { key: 'weeks',        icon: '📅', label: 'A few weeks'   },
  { key: 'months',       icon: '🗓', label: 'Several months' },
  { key: 'over_a_year',  icon: '📆', label: 'Over a year'   },
  { key: 'most_my_life', icon: '∞',  label: 'Most of my life'},
]

const PATTERN_EMOJIS: EmojiOption[] = [
  { key: 'always',     icon: '📍', label: 'Always there'      },
  { key: 'comes_goes', icon: '〰', label: 'Comes and goes'    },
  { key: 'worsening',  icon: '📉', label: 'Getting worse'     },
  { key: 'improving',  icon: '📈', label: 'Slowly improving'  },
]

function Section1({ form, setForm }: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>> }) {
  return (
    <div className="space-y-8">
      <SectionHeader section={1} name="Your story" heading="What's been on your mind most lately?" subtitle="Select everything that resonates." />
      <div>
        <BigChipCloud
          options={PRIMARY_CONCERNS}
          selected={form.primary_concerns}
          onChange={v => setForm(f => ({ ...f, primary_concerns: v }))}
        />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary mb-3">How long has this been going on?</p>
        <EmojiCardGrid
          options={DURATION_EMOJIS}
          selected={form.concern_duration ? [form.concern_duration] : []}
          onChange={v => setForm(f => ({ ...f, concern_duration: v[0] ?? '' }))}
          cols={4}
        />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary mb-3">How does it tend to show up?</p>
        <EmojiCardGrid
          options={PATTERN_EMOJIS}
          selected={form.symptom_pattern ? [form.symptom_pattern] : []}
          onChange={v => setForm(f => ({ ...f, symptom_pattern: v[0] ?? '' }))}
          cols={4}
        />
      </div>
    </div>
  )
}

// ─── Section 2 — Deeper dive ──────────────────────────────────────────────────

const HORMONAL_SYMPTOMS = [
  'PMS or PMDD', 'Irregular periods', 'Heavy bleeding', 'Mood swings',
  'Low libido', 'Unexplained weight gain', 'Night sweats', 'Hair loss',
]

const ENERGY_LOW_TIMES = [
  'On waking', 'Mid-morning', 'After lunch', 'Late afternoon', 'Evening', 'All day', 'Unpredictable',
]

const COGNITIVE_SYMPTOMS = [
  'Difficulty concentrating', 'Poor memory', 'Mental fatigue', 'Word-finding difficulty',
  'Slow processing', 'Overwhelmed by tasks', 'Brain fog after eating',
]

function Section2({ form, setForm }: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>> }) {
  const branch = detectPrimarySystem(form.primary_concerns)

  if (branch === 'digestive') {
    return (
      <div className="space-y-7">
        <SectionHeader section={2} name="Deeper dive" heading="Let's explore what's happening in more detail." subtitle="Your answers here help us identify patterns." />
        <div>
          <p className="text-sm font-medium text-text-primary mb-3">Do you experience bloating?</p>
          <BooleanCards
            value={form.gi_bloating}
            onChange={v => setForm(f => ({ ...f, gi_bloating: v }))}
            yesLabel="Yes" noLabel="Not really"
            yesSub="It's an issue for me" noSub="Not a significant problem"
          />
        </div>
        {form.gi_bloating === true && (
          <div className="space-y-6" style={{ animation: 'fadeSlideIn 200ms ease-out' }}>
            <div>
              <p className="text-sm font-medium text-text-primary mb-3">When does it happen?</p>
              <TimingSelector
                value={form.gi_timing}
                onChange={v => setForm(f => ({ ...f, gi_timing: v }))}
                context="digestive"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary mb-3">How severe is it on a bad day?</p>
              <IntakeVisualScale
                value={form.gi_severity}
                onChange={v => setForm(f => ({ ...f, gi_severity: v }))}
              />
            </div>
          </div>
        )}
      </div>
    )
  }

  if (branch === 'hormonal') {
    return (
      <div className="space-y-7">
        <SectionHeader section={2} name="Deeper dive" heading="Let's look at hormonal patterns more closely." subtitle="You only need to share what you're comfortable with." />
        <div>
          <p className="text-sm font-medium text-text-primary mb-3">Which of these do you experience?</p>
          <BigChipCloud
            options={HORMONAL_SYMPTOMS}
            selected={form.hormonal_symptoms}
            onChange={v => setForm(f => ({ ...f, hormonal_symptoms: v }))}
          />
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary mb-3">Do your symptoms follow a cycle pattern?</p>
          <CyclePatternSelector
            value={form.cycle_patterns}
            onChange={v => setForm(f => ({ ...f, cycle_patterns: v }))}
          />
        </div>
      </div>
    )
  }

  if (branch === 'energy') {
    return (
      <div className="space-y-7">
        <SectionHeader section={2} name="Deeper dive" heading="Tell us more about your energy." subtitle="This helps us identify the likely pattern driving it." />
        <div>
          <p className="text-sm font-medium text-text-primary mb-3">When is your energy typically lowest?</p>
          <BigChipCloud
            options={ENERGY_LOW_TIMES}
            selected={form.energy_low_times}
            onChange={v => setForm(f => ({ ...f, energy_low_times: v }))}
          />
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary mb-3">Which pattern describes your energy across the day?</p>
          <EnergyCurveSelector
            value={form.energy_curve || null}
            onChange={v => setForm(f => ({ ...f, energy_curve: v }))}
          />
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary mb-3">How severe is the fatigue on a bad day?</p>
          <IntakeVisualScale
            value={form.energy_severity}
            onChange={v => setForm(f => ({ ...f, energy_severity: v }))}
          />
        </div>
      </div>
    )
  }

  if (branch === 'cognitive') {
    return (
      <div className="space-y-7">
        <SectionHeader section={2} name="Deeper dive" heading="Let's look at the cognitive picture." subtitle="Select everything that resonates." />
        <div>
          <BigChipCloud
            options={COGNITIVE_SYMPTOMS}
            selected={form.hormonal_symptoms}
            onChange={v => setForm(f => ({ ...f, hormonal_symptoms: v }))}
          />
        </div>
      </div>
    )
  }

  // General fallback
  return (
    <div className="space-y-7">
      <SectionHeader section={2} name="Deeper dive" heading="A little more about what you're experiencing." subtitle="Share what feels most relevant." />
      <div>
        <p className="text-sm font-medium text-text-primary mb-3">Which body systems feel most affected?</p>
        <BigChipCloud
          options={['Digestive', 'Hormonal', 'Energy & metabolism', 'Cognitive', 'Musculoskeletal', 'Skin', 'Immune', 'Cardiovascular', 'Nervous system']}
          selected={form.systems_reviewed}
          onChange={v => setForm(f => ({ ...f, systems_reviewed: v }))}
        />
      </div>
    </div>
  )
}

// ─── Section 3 — Timeline ─────────────────────────────────────────────────────

const LAST_WELL_EMOJIS: EmojiOption[] = [
  { key: 'last_year',       icon: '📅', label: 'In the last year' },
  { key: '1_3_years',       icon: '🗓', label: '1–3 years ago'    },
  { key: '3_5_years',       icon: '📆', label: '3–5 years ago'    },
  { key: 'over_5_years',    icon: '🕰', label: 'More than 5 years ago' },
  { key: 'not_sure',        icon: '💭', label: 'Not sure I ever have' },
]

function Section3({ form, setForm }: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>> }) {
  return (
    <div className="space-y-7">
      <SectionHeader section={3} name="Timeline" heading="When did things change?" subtitle="Sometimes understanding when is as revealing as what." />
      <AcknowledgementBanner text="Sometimes understanding when things changed is as important as what changed. Take your time with this — it can feel heavy to look back." />
      <div>
        <p className="text-sm font-medium text-text-primary mb-3">When did you last feel genuinely well?</p>
        <EmojiCardGrid
          options={LAST_WELL_EMOJIS}
          selected={form.timeline_last_well ? [form.timeline_last_well] : []}
          onChange={v => setForm(f => ({ ...f, timeline_last_well: v[0] ?? '' }))}
          cols={5}
        />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary mb-2">What was happening around then?</p>
        <p className="text-xs text-text-muted mb-3">e.g. a stressful period, a virus, a life change, or nothing obvious</p>
        <WarmTextarea
          value={form.timeline_trigger}
          onChange={v => setForm(f => ({ ...f, timeline_trigger: v }))}
          placeholder="e.g. A really stressful period at work. I had a virus and never quite recovered. It came on gradually with no clear trigger."
          rows={5}
        />
      </div>
    </div>
  )
}

// ─── Section 4 — Daily life ───────────────────────────────────────────────────

const EXERCISE_EMOJIS: EmojiOption[] = [
  { key: 'rarely',   icon: '🛋', label: 'Rarely'    },
  { key: '1_2x',     icon: '🚶', label: '1–2×/wk'   },
  { key: '3_4x',     icon: '🏃', label: '3–4×/wk'   },
  { key: 'daily',    icon: '💪', label: 'Daily'      },
]

const DIET_OPTIONS = [
  'Balanced / varied', 'Mostly whole foods', 'Plant-based', 'Gluten-free',
  'Dairy-free', 'Keto or low-carb', 'Intermittent fasting',
  'No clear pattern', 'Lots of processed food',
]

function Section4({ form, setForm }: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>> }) {
  return (
    <div className="space-y-8">
      <SectionHeader section={4} name="Daily life" heading="How you live day to day." subtitle="Small details here can reveal big patterns." />
      <AcknowledgementBanner text="You're doing really well. This is exactly the kind of information that makes a real difference." />
      <div>
        <p className="text-sm font-medium text-text-primary mb-3">How much sleep do you get?</p>
        <MoonSelector
          value={form.sleep_hours}
          onChange={v => setForm(f => ({ ...f, sleep_hours: v }))}
        />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary mb-3">How would you rate the quality of that sleep?</p>
        <NamedFiveDot
          value={form.sleep_quality}
          onChange={v => setForm(f => ({ ...f, sleep_quality: v }))}
          labels={['Terrible', 'Poor', 'Fair', 'Good', 'Excellent']}
        />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary mb-3">What is your typical stress level?</p>
        <NamedFiveDot
          value={form.stress_level}
          onChange={v => setForm(f => ({ ...f, stress_level: v }))}
          labels={['Very low', 'Low', 'Moderate', 'High', 'Very high']}
        />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary mb-3">How would you rate your day-to-day energy?</p>
        <NamedFiveDot
          value={form.energy_level}
          onChange={v => setForm(f => ({ ...f, energy_level: v }))}
          labels={['Depleted', 'Low', 'Moderate', 'Good', 'Excellent']}
        />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary mb-3">How often do you exercise?</p>
        <EmojiCardGrid
          options={EXERCISE_EMOJIS}
          selected={form.exercise_frequency ? [form.exercise_frequency] : []}
          onChange={v => setForm(f => ({ ...f, exercise_frequency: v[0] ?? '' }))}
          cols={4}
        />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary mb-3">What best describes your diet?</p>
        <BigChipCloud
          options={DIET_OPTIONS}
          selected={form.diet_description ? [form.diet_description] : []}
          onChange={v => setForm(f => ({ ...f, diet_description: v[0] ?? '' }))}
          multi={false}
        />
      </div>
    </div>
  )
}

// ─── Section 5 — Medical ──────────────────────────────────────────────────────

const CONDITION_PRESETS = [
  'Hypothyroidism', 'IBS', 'PCOS', 'Anxiety', 'Depression',
  'Endometriosis', 'Fibromyalgia', 'Autoimmune condition', 'Diabetes', 'Coeliac disease',
]

const SUPPLEMENT_PRESETS = [
  'Vitamin D', 'Magnesium', 'Omega-3', 'B12', 'Iron', 'Probiotics', 'Ashwagandha', 'Zinc',
]

const FAMILY_HISTORY_OPTIONS = [
  'Thyroid disease', 'Type 2 diabetes', 'Heart disease', 'Autoimmune conditions',
  'Cancer', 'Mental health conditions', 'Hormonal conditions', 'Gut disease',
]

const PRACTITIONER_OPTIONS = [
  'GP', 'Nutritionist', 'Naturopath', 'Acupuncturist',
  'Therapist', 'Osteopath', 'Chiropractor', 'Functional medicine doctor', 'Other',
]

function Section5({ form, setForm }: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>> }) {
  const isDigestive = detectPrimarySystem(form.primary_concerns) === 'digestive'
  return (
    <div className="space-y-7">
      <SectionHeader section={5} name="Medical" heading="Your health background." subtitle="Share only what you feel comfortable with — everything here is optional." />
      <AcknowledgementBanner text="Now some background — share only what you feel comfortable with. Everything here is entirely optional and completely private." />
      <div>
        <p className="text-sm font-medium text-text-primary mb-2">Any existing diagnoses or conditions?</p>
        <TagInput
          value={form.diagnosed_conditions}
          onChange={v => setForm(f => ({ ...f, diagnosed_conditions: v }))}
          placeholder="Add a condition and press Enter"
          presets={CONDITION_PRESETS}
        />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary mb-2">Current medications</p>
        <div className="bg-[#F8F1E4] border border-[#D4B07A] rounded-lg px-3 py-2 mb-2 flex items-center gap-2">
          <span className="text-xs text-[#633806]">🔒 Encrypted · Never shared without consent</span>
        </div>
        <WarmTextarea value={form.current_medications} onChange={v => setForm(f => ({ ...f, current_medications: v }))} placeholder="e.g. Levothyroxine 50mcg, oral contraceptive pill…" rows={2} />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary mb-2">Current supplements</p>
        <TagInput value={form.current_supplements.split(',').map(s => s.trim()).filter(Boolean)} onChange={v => setForm(f => ({ ...f, current_supplements: v.join(', ') }))} placeholder="Add supplement and press Enter" presets={SUPPLEMENT_PRESETS} />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary mb-2">Practitioners you&apos;ve worked with</p>
        <BigChipCloud options={PRACTITIONER_OPTIONS} selected={form.practitioner_types} onChange={v => setForm(f => ({ ...f, practitioner_types: v }))} />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary mb-2">Treatments or approaches you&apos;ve tried</p>
        <WarmTextarea value={form.past_treatments} onChange={v => setForm(f => ({ ...f, past_treatments: v }))} placeholder="e.g. Elimination diet, acupuncture, CBT…" rows={2} />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary mb-2">Family health history</p>
        <BigChipCloud options={FAMILY_HISTORY_OPTIONS} selected={form.family_history} onChange={v => setForm(f => ({ ...f, family_history: v }))} />
      </div>
      {isDigestive && (
        <div>
          <p className="text-sm font-medium text-text-primary mb-3">Bowel pattern — which type most resembles yours?</p>
          <BristolStoolSelector value={form.gi_stool_type} onChange={v => setForm(f => ({ ...f, gi_stool_type: v }))} />
        </div>
      )}
    </div>
  )
}

// ─── Section 6 — Mind & emotion ───────────────────────────────────────────────

const SUPPORTED_EMOJIS: EmojiOption[] = [
  { key: 'supported',  icon: '🤝', label: 'Well supported' },
  { key: 'mixed',      icon: '🌥', label: 'Mixed'          },
  { key: 'not_really', icon: '😶', label: 'Not really'     },
  { key: 'alone',      icon: '🔇', label: 'Alone'          },
]

function Section6({ form, setForm }: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>> }) {
  const unsupported = ['not_really', 'alone'].includes(form.psychosocial_supported)
  return (
    <div className="space-y-7">
      <div className="bg-[#F8F1E4] border border-[#D4B07A] rounded-2xl p-6 mb-6">
        <h2 className="font-display italic text-[22px] font-light text-[#633806] mb-3">Often the most important layer.</h2>
        <p className="text-sm text-[#633806] leading-relaxed">
          The emotional and psychological dimensions of health are frequently overlooked in conventional medicine. We believe they are central to the picture. This section is entirely optional.
        </p>
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary mb-2">How has this affected your daily life?</p>
        <WarmTextarea value={form.psychosocial_impact} onChange={v => setForm(f => ({ ...f, psychosocial_impact: v }))} placeholder="e.g. I've had to reduce my hours at work, it affects my relationships…" rows={4} />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary mb-2">What worries you most about your health right now?</p>
        <WarmTextarea value={form.psychosocial_worry} onChange={v => setForm(f => ({ ...f, psychosocial_worry: v }))} placeholder="e.g. That it will get worse. That no one can find the cause…" rows={4} />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary mb-3">Do you feel supported?</p>
        <EmojiCardGrid
          options={SUPPORTED_EMOJIS}
          selected={form.psychosocial_supported ? [form.psychosocial_supported] : []}
          onChange={v => setForm(f => ({ ...f, psychosocial_supported: v[0] ?? '' }))}
          cols={4}
        />
        {unsupported && (
          <div className="bg-[#F8F1E4] rounded-xl px-4 py-3 mt-3">
            <p className="text-sm italic text-[#633806] font-display">
              Finding the right support is one of the most important steps — and exactly why NI exists.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Section 7 — Goals ────────────────────────────────────────────────────────

const GOAL_OPTIONS = [
  'More consistent energy', 'Better sleep quality', 'Reduce inflammation',
  'Understand my lab results', 'Lose weight sustainably', 'Improve mood',
  'Reduce medication dependency', 'Better gut health', 'Clearer skin',
  'Improve fertility', 'Reduce pain', 'Better hormonal balance',
  'More mental clarity', 'Something else',
]

const TIMELINE_EMOJIS: EmojiOption[] = [
  { key: 'months',    icon: '⚡', label: 'In months'      },
  { key: 'year',      icon: '🌱', label: 'Within a year'  },
  { key: 'long_term', icon: '🏔', label: 'Long-term'      },
  { key: 'not_sure',  icon: '💭', label: 'Not sure yet'   },
]

function Section7({ form, setForm }: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>> }) {
  return (
    <div className="space-y-7">
      <SectionHeader section={7} name="Goals" heading="What does getting well look like for you?" subtitle="Let's finish by looking forward." />
      <AcknowledgementBanner text="You've been incredibly open — thank you. Let's finish by looking forward." />
      <div>
        <p className="text-sm font-medium text-text-primary mb-3">What do you most want to achieve?</p>
        <BigChipCloud options={GOAL_OPTIONS} selected={form.health_goals} onChange={v => setForm(f => ({ ...f, health_goals: v }))} />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary mb-3">What timeframe feels realistic to you?</p>
        <EmojiCardGrid options={TIMELINE_EMOJIS} selected={form.timeline_expectation ? [form.timeline_expectation] : []} onChange={v => setForm(f => ({ ...f, timeline_expectation: v[0] ?? '' }))} cols={4} />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary mb-2">What has got in the way before? <span className="text-text-muted font-normal">(optional)</span></p>
        <WarmTextarea value={form.biggest_barrier} onChange={v => setForm(f => ({ ...f, biggest_barrier: v }))} placeholder="e.g. Cost, not knowing where to start, lack of time, conflicting advice…" rows={3} />
      </div>
    </div>
  )
}

// ─── Section 8 — Readiness ────────────────────────────────────────────────────

const TIME_EMOJIS: EmojiOption[] = [
  { key: 'few_mins', icon: '⏱', label: 'A few mins/day'  },
  { key: '20_30',    icon: '🕐', label: '20–30 mins'      },
  { key: 'hours',    icon: '📆', label: 'Hours per week'  },
  { key: 'all_in',   icon: '💪', label: 'All in'          },
]

const BUDGET_EMOJIS: EmojiOption[] = [
  { key: 'tight',    icon: '💷', label: 'Tight right now' },
  { key: 'some',     icon: '💳', label: 'Some flexibility' },
  { key: 'flexible', icon: '💰', label: 'Flexible'         },
]

const CHANGE_EMOJIS: EmojiOption[] = [
  { key: 'small_steps',   icon: '🌱', label: 'Small steps'     },
  { key: 'with_guidance', icon: '🔄', label: 'With guidance'    },
  { key: 'all_in',        icon: '⚡', label: 'All in'           },
  { key: 'not_sure',      icon: '💭', label: 'Not sure'         },
]

function Section8({ form, setForm }: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>> }) {
  return (
    <div className="space-y-7">
      <SectionHeader section={8} name="Readiness" heading="Three honest questions." subtitle="What's realistic for you right now?" />
      <div>
        <p className="text-sm font-medium text-text-primary mb-3">How much time could you realistically invest in your health each day?</p>
        <EmojiCardGrid options={TIME_EMOJIS} selected={form.readiness_time ? [form.readiness_time] : []} onChange={v => setForm(f => ({ ...f, readiness_time: v[0] ?? '' }))} cols={4} />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary mb-3">How would you describe your health budget right now?</p>
        <EmojiCardGrid options={BUDGET_EMOJIS} selected={form.readiness_budget ? [form.readiness_budget] : []} onChange={v => setForm(f => ({ ...f, readiness_budget: v[0] ?? '' }))} cols={3} />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary mb-3">How ready do you feel to make changes?</p>
        <EmojiCardGrid options={CHANGE_EMOJIS} selected={form.readiness_change ? [form.readiness_change] : []} onChange={v => setForm(f => ({ ...f, readiness_change: v[0] ?? '' }))} cols={4} />
      </div>
    </div>
  )
}

// ─── Section 9 — Consent & complete ──────────────────────────────────────────

const COMPLETE_CHECKS = [
  'Your story & main concerns',
  'A deeper look at key symptoms',
  'Your timeline',
  'Daily life & lifestyle',
  'Medical background',
  'Mind & emotional health',
  'Your goals',
  'Your readiness',
]

function Section9({ consent, setConsent }: { consent: boolean; setConsent: (v: boolean) => void }) {
  return (
    <div className="space-y-7">
      <div className="bg-[#F8F1E4] border border-[#D4B07A] rounded-2xl p-7">
        <h2 className="font-display text-[28px] font-light text-[#633806] mb-4 leading-tight">
          You&apos;ve done something important today.
        </h2>
        <p className="text-sm text-[#633806] leading-relaxed">
          Most people spend years managing symptoms without ever sitting down to look at the full picture.
          You&apos;ve just done that. We&apos;re now going to make sense of everything you&apos;ve shared.
        </p>
      </div>
      <div>
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">What you&apos;ve covered</p>
        <div className="space-y-2">
          {COMPLETE_CHECKS.map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-[#B8935A] flex items-center justify-center flex-shrink-0">
                <span className="text-text-inverted text-[10px]">✓</span>
              </div>
              <span className="text-sm text-text-primary">{item}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-surface-muted border border-border-default rounded-xl p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-2">AI analysis consent</h3>
        <p className="text-xs text-text-secondary leading-relaxed mb-4">
          Natural Intelligence will use the information you&apos;ve provided — along with any lab report data and root cause analysis results — to generate a personalised health synopsis using Claude (by Anthropic).
          This synopsis is for informational purposes only and does not constitute medical advice.
        </p>
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-[#B8935A] accent-[#B8935A]"
          />
          <span className="text-sm text-text-primary leading-relaxed">
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
  const TOTAL   = 10  // sections 0–9
  const initial = Math.min((existing?.completed_sections as number | undefined) ?? 0, TOTAL - 1)

  const [section,  setSection]  = useState<number>(initial)
  const [form,     setForm]     = useState<FormState>(() => initialState(existing))
  const [consent,  setConsent]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [opacity,  setOpacity]  = useState(1)

  function transition(fn: () => void) {
    setOpacity(0)
    setTimeout(() => {
      fn()
      setOpacity(1)
    }, 160)
  }

  const handleNext = useCallback(async () => {
    if (section >= TOTAL - 1) return
    setSaving(true)
    setError(null)
    try {
      await saveIntakeSection(getSectionData(form, section + 1), section + 1)
      transition(() => setSection(s => s + 1))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }, [form, section])

  const handleBack = useCallback(() => {
    if (section <= 0) return
    setError(null)
    transition(() => setSection(s => s - 1))
  }, [section])

  const handleSubmit = useCallback(async () => {
    if (!consent) {
      setError('Please give your consent to AI analysis to continue.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await saveIntakeSection(getSectionData(form, 9), 9)
      await completeIntake({ consent_to_ai_analysis: true, consent_given_at: new Date().toISOString() })
      router.push('/dashboard/synopsis')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setSaving(false)
    }
  }, [consent, form, router])

  const isSection0  = section === 0
  const isLastSection = section === TOTAL - 1
  const canBeginFromArrival = isSection0 && form.arrival_emotion !== ''

  return (
    <div className="max-w-2xl mx-auto">
      {/* Inline fade-in CSS */}
      <style>{`@keyframes fadeSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }`}</style>

      {/* Journey map */}
      {!isSection0 && <JourneyMap current={section} />}

      {/* Acknowledgement banner for section 1+ (based on arrival emotion) */}
      {section === 1 && form.arrival_emotion && (
        <AcknowledgementBanner text={arrivalAck(form.arrival_emotion)} />
      )}

      {/* Section content with fade transition */}
      <div
        style={{ opacity, transition: 'opacity 160ms ease-out' }}
        className="rounded-2xl border border-border-default bg-surface-raised p-6 mb-6"
      >
        {section === 0 && <Section0 form={form} setForm={setForm} />}
        {section === 1 && <Section1 form={form} setForm={setForm} />}
        {section === 2 && <Section2 form={form} setForm={setForm} />}
        {section === 3 && <Section3 form={form} setForm={setForm} />}
        {section === 4 && <Section4 form={form} setForm={setForm} />}
        {section === 5 && <Section5 form={form} setForm={setForm} />}
        {section === 6 && <Section6 form={form} setForm={setForm} />}
        {section === 7 && <Section7 form={form} setForm={setForm} />}
        {section === 8 && <Section8 form={form} setForm={setForm} />}
        {section === 9 && <Section9 consent={consent} setConsent={setConsent} />}
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {/* Navigation */}
      <div className="flex items-center justify-between gap-4">
        {!isSection0 ? (
          <button type="button" onClick={handleBack} disabled={saving}
            className="px-4 py-2.5 rounded-xl border border-border-default text-sm font-medium text-text-secondary hover:bg-surface-muted transition-colors disabled:opacity-50"
          >← Back</button>
        ) : <div />}

        {isSection0 ? (
          <button type="button" onClick={handleNext}
            disabled={!canBeginFromArrival || saving}
            className={`w-full py-4 rounded-xl text-sm font-medium transition-all ${
              canBeginFromArrival
                ? 'bg-[#B8935A] text-text-inverted hover:bg-[#9E7A47]'
                : 'bg-[#B8935A] text-text-inverted opacity-40 cursor-not-allowed'
            }`}
          >{saving ? 'Saving…' : 'Begin →'}</button>
        ) : isLastSection ? (
          <button type="button" onClick={handleSubmit} disabled={saving || !consent}
            className="flex-1 py-4 rounded-xl bg-[#B8935A] text-text-inverted text-sm font-medium transition-all hover:bg-[#9E7A47] disabled:opacity-50"
          >{saving ? 'Generating synopsis…' : 'Generate my health synopsis →'}</button>
        ) : (
          <button type="button" onClick={handleNext} disabled={saving}
            className="px-8 py-2.5 rounded-xl bg-[#B8935A] text-text-inverted text-sm font-medium transition-colors hover:bg-[#9E7A47] disabled:opacity-50"
          >{saving ? 'Saving…' : 'Next →'}</button>
        )}
      </div>

      {!isSection0 && (
        <p className="text-xs text-text-muted text-center mt-4">
          Your progress is saved automatically as you move between sections.
        </p>
      )}
    </div>
  )
}
