'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { saveIntakeSection, completeIntake } from './actions'
import IntakeVisualScale    from './components/IntakeVisualScale'
import BristolStoolSelector from './components/BristolStoolSelector'
import TimingSelector       from './components/TimingSelector'
import EnergyCurveSelector  from './components/EnergyCurveSelector'
import CyclePatternSelector from './components/CyclePatternSelector'
import NumberStepper        from './components/NumberStepper'
import { createClient }                  from '@natural-intelligence/db/client'
import { evaluateRules, BRANCHING_RULES } from '@natural-intelligence/db/intake'
import { useIntakeAnswers } from './hooks/useIntakeAnswers'
import type { FormState, PersistMeta, PersistFn } from './types'

// ─── Sprint B Phase 1 — Chapter framework ────────────────────────────────────
//
// Six-moment journey replacing the prior 10-section linear flow:
//   Chapter 0 — Arrival             (tone-set)
//   Chapter 1 — Your Story          (context + intention)
//   Chapter 2 — Your Best           (temporal anchor — backward)
//   Chapter 3 — What Changed        (temporal pivot)
//   Chapter 4 — Where You Are Now   (current symptoms + life + medical + mind)
//   Chapter 5 — What We Heard       (rule-generated reflection + consent)
//
// The internal step counter (0–11) maps to chapters via chapterForSection().
// Chapter 4 contains multiple internal steps (Deeper dive / Daily life /
// Medical / Mind / Goals stub / Readiness stub) — the journey map shows
// chapter-level progress only.
//
// Step → chapter mapping:
//   step 0  → chapter 0   Arrival
//   step 1  → chapter 1   Your Story
//   step 2  → chapter 2   Your Best        (timeline_last_well — moved from old Section 3)
//   step 3  → chapter 3   What Changed     (timeline_trigger — moved from old Section 3)
//   step 4  → chapter 4   Deeper dive      (old Section 2)
//   step 5  → chapter 4   Daily life       (old Section 4)
//   step 6  → chapter 4   Medical          (old Section 5)
//   step 7  → chapter 4   Mind             (old Section 6)
//   step 8  → chapter 4   Goals stub       (old Section 7 — mostly empty after deletions)
//   step 9  → chapter 4   Readiness stub   (old Section 8 — mostly empty after deletions)
//   step 10 → chapter 5   What We Heard + consent (old Section 9, reframed)
//
// Editorial copy below — chapter titles, purpose statements, transition
// copy — drafted in the Sprint B architecture document §4–5 and approved
// by founder for Phase 1 substrate use. Content rewrite is Phase 2.

interface ChapterDef {
  id:         number
  title:      string
  purpose:    string      // shown at chapter start
  transition: string      // shown when entering this chapter from the previous one (empty for chapter 0)
}

const CHAPTERS: ChapterDef[] = [
  {
    id:    0,
    title: 'Arrival',
    purpose:    "Before we start, just one question: how are you feeling, arriving here? There's no wrong answer. We ask because it changes how we want to talk to you.",
    transition: '',
  },
  {
    id:    1,
    title: 'Your Story',
    purpose:    "This part is about you, not your symptoms. Who you are, and what you'd most want to understand about what's happening. The rest of the intake builds from here.",
    transition: 'Thank you for telling us. Let’s start with you.',
  },
  {
    id:    2,
    title: 'Your Best',
    purpose:    "Most people remember a time they felt well, even if it was a while ago. We're going to look at that — not because it's painful, but because what was different then often tells us more than what's different now.",
    transition: 'You’ve given us the frame. Now we’d like to look backwards before we look at where you are now — back to the last time you remember feeling well.',
  },
  {
    id:    3,
    title: 'What Changed',
    purpose:    "Now the harder part. When things shifted, what was happening in your life. Sometimes there's a clear trigger. Sometimes there isn't. Either is useful.",
    transition: 'We’d like to understand what was happening around then — and what shifted.',
  },
  {
    id:    4,
    title: 'Where You Are Now',
    purpose:    "The fullest part of the intake. We'll ask about your body, your sleep, your food, your environment, your relationships, your stress, and your medical history. Take your time. Skip anything that feels uncertain — we'd rather have an honest gap than a guess.",
    transition: 'That’s the part of the picture that takes the most. You’ve done it. The next part is more practical — your body, your life, your medical history.',
  },
  {
    id:    5,
    title: 'What We Heard',
    purpose:    "A short reflection of what you've shared. Not a diagnosis. Not a verdict. Just our way of showing we were listening.",
    transition: 'You’ve shared everything we’d want to know to start. Before you finish, we want to show you what we heard.',
  },
]

// Map internal step index (0–10) → chapter id (0–5). Steps 4–9 all sit
// inside chapter 4. The "isChapterStart" check uses this to render the
// transition + chapter intro only at chapter boundaries (not on every step).
export function chapterForStep(step: number): number {
  if (step <= 0) return 0
  if (step === 1) return 1
  if (step === 2) return 2
  if (step === 3) return 3
  if (step >= 4 && step <= 9) return 4
  return 5
}

// True when the step is the first step of a new chapter — used to gate
// chapter transition + intro rendering.
function isChapterStart(step: number): boolean {
  return step === 0 || step === 1 || step === 2 || step === 3 || step === 4 || step === 10
}

const TOTAL_STEPS = 11   // steps 0–10

// 5 chapter dots (Chapter 0 Arrival rendered as a small prefix dot; chapters
// 1–5 as numbered dots). Replaces the prior 10-node JOURNEY_NODES map.
function JourneyMap({ step }: { step: number }) {
  const currentChapter = chapterForStep(step)
  // Show chapters 1–5 as the main dots; chapter 0 (Arrival) is implicit
  // and not shown in the map (the user is already past it once the map
  // first appears — see render guard in IntakeForm).
  const chapters = CHAPTERS.filter(c => c.id >= 1)
  return (
    <div className="flex items-center justify-center mb-10 gap-3" aria-label="Intake progress">
      {chapters.map((chapter, i) => {
        const done    = currentChapter > chapter.id
        const current = currentChapter === chapter.id
        return (
          <div key={chapter.id} className="flex items-center gap-3">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`w-3 h-3 rounded-full transition-all ${
                  done    ? 'bg-[#B8935A]'
                  : current ? 'bg-[#0E0D0B] ring-2 ring-[#B8935A]/30 ring-offset-2 ring-offset-surface-base'
                  : 'bg-border-default'
                }`}
                aria-current={current ? 'step' : undefined}
              />
              <span className={`text-[10px] uppercase tracking-[0.08em] transition-colors ${
                current ? 'text-[#0E0D0B] font-medium' : 'text-text-muted'
              }`}>
                {chapter.title}
              </span>
            </div>
            {i < chapters.length - 1 && (
              <div className={`h-px w-6 transition-all ${
                done ? 'bg-[#B8935A]' : 'bg-border-default'
              }`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// Chapter intro — title + purpose, shown at the first step of each chapter.
function ChapterIntro({ chapter }: { chapter: ChapterDef }) {
  return (
    <div className="mb-8">
      <p className="text-[10px] uppercase tracking-[0.14em] text-[#B8935A] font-medium mb-2">
        Chapter {chapter.id} — {chapter.title}
      </p>
      <p className="text-sm italic text-text-secondary leading-relaxed">
        {chapter.purpose}
      </p>
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────
// Preserved for back-compat with existing Section components (slotted as-is
// per Sprint B Phase 1 "substrate first, content second" approach). The
// "name" subtitle no longer references the deprecated JOURNEY_NODES count —
// it now references the chapter the section sits within.

function SectionHeader({
  name, heading, subtitle,
}: { section?: number; name: string; heading: string; subtitle: string }) {
  // B1-F1 — Sprint B closure. Suppress the chapter pill here when the
  // section sits at a chapter start (name begins with "Chapter "), because
  // ChapterIntro already renders that pill above. Mid-chapter sections
  // (name="Deeper dive", "Daily life", "Medical" etc.) keep their pill.
  const suppressNamePill = /^chapter\s/i.test(name)
  return (
    <div className="mb-6">
      {!suppressNamePill && (
        <p className="text-[10px] uppercase tracking-[0.14em] text-[#B8935A] font-medium mb-2">
          {name}
        </p>
      )}
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
// B2: token-aligned selected/hover/default states.
// B7: emoji wrapped in ni-muted-emoji / ni-muted-emoji-active for consistent
//     desaturated register across all card grids.
// className prop: overrides grid layout class when responsive behaviour is
//   needed (e.g. arrival emotion grid — B5).

interface EmojiOption { key: string; icon: string; label: string; sub?: string }

function EmojiCardGrid({
  options, selected, onChange, cols = 4, single = true, className,
}: {
  options:    EmojiOption[]
  selected:   string[]
  onChange:   (v: string[]) => void
  cols?:      number
  single?:    boolean
  className?: string
}) {
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
  const wrapperClass = className ?? (gridClass[cols] ?? 'flex flex-wrap gap-2')
  return (
    <div className={wrapperClass}>
      {options.map(({ key, icon, label, sub }) => {
        const sel = selected.includes(key)
        return (
          <button key={key} type="button" onClick={() => toggle(key)}
            className={`flex flex-col items-center gap-3 rounded-lg border px-5 py-5 cursor-pointer transition-all text-center ${
              sel
                ? 'bg-brand-ultra border-brand-default text-text-brand shadow-sm'
                : 'bg-surface-raised border-border-default text-text-primary hover:border-brand-default hover:bg-brand-ultra/40'
            }`}
          >
            {/* B7: ni-muted-emoji / ni-muted-emoji-active on every emoji */}
            <span className={sel ? 'ni-muted-emoji-active' : 'ni-muted-emoji'} style={{ fontSize: 32, lineHeight: 1 }} aria-hidden="true">{icon}</span>
            <span className="text-sm font-medium leading-tight">{label}</span>
            {sub && <span className="text-xs text-text-muted leading-tight">{sub}</span>}
          </button>
        )
      })}
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
// onBlur fires with the current value — used by persist calls (not per-keystroke).

function WarmTextarea({
  value, onChange, onBlur, placeholder, rows = 4,
}: {
  value:        string
  onChange:     (v: string) => void
  onBlur?:      (v: string) => void
  placeholder?: string
  rows?:        number
}) {
  return (
    <textarea value={value} rows={rows}
      onChange={e => onChange(e.target.value)}
      onBlur={onBlur ? e => onBlur(e.target.value) : undefined}
      placeholder={placeholder}
      className="w-full px-4 py-3 rounded-xl border border-border-default bg-surface-base text-text-primary placeholder:text-text-placeholder text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#B8935A] focus:border-transparent transition-colors resize-none"
    />
  )
}

// ─── Form state ───────────────────────────────────────────────────────────────
// FormState interface lives in ./types.ts — imported at the top of this file.

function initialState(
  e: Record<string, unknown> | null,
  biologicalSex: 'male' | 'female' | null,
  religion: FormState['religion'],
  religiousContentPreference: FormState['religious_content_preference'],
): FormState {
  const arr = (k: string) => (e?.[k] as string[] | null) ?? []
  const str = (k: string) => (e?.[k] as string | null) ?? ''
  const num = (k: string) => (e?.[k] as number | null) ?? null
  const bol = (k: string) => (e?.[k] as boolean | null) ?? null
  // R4: FoodSymptomLink is never null — default to empty arrays
  const fsl = (k: string): import('./types').FoodSymptomLink => {
    const raw = e?.[k] as { presets?: string[]; custom?: string[] } | null
    return {
      presets: raw?.presets ?? [],
      custom:  raw?.custom  ?? [],
    }
  }
  return {
    arrival_emotion:           str('arrival_emotion'),
    // Sourced from user_personalisation (not intake_responses) — passed in
    // from the server page. Persistence on change writes back via the
    // authenticated client (member up_member_update RLS).
    biological_sex:            biologicalSex,
    // Sprint B Phase 1 — signature question. Read from intake_responses if
    // present (resume case); else empty string.
    most_want_to_understand:   str('most_want_to_understand'),
    // Sprint B Phase 1 — PS.1 substrate. Read from user_personalisation via
    // the server page; passed in as initial props (resume / pre-fill case).
    religion:                  religion,
    religious_content_preference: religiousContentPreference,
    primary_concerns:          arr('primary_concerns'),
    concern_duration:          str('concern_duration'),
    symptom_pattern:           str('symptom_pattern'),
    // Sprint 16.3 Tier 1 — Section 1
    concern_severity_baseline: num('concern_severity_baseline'),
    aggravating_factors:       str('aggravating_factors'),
    relieving_factors:         str('relieving_factors'),
    systems_reviewed:          arr('systems_reviewed'),
    gi_bloating:               bol('gi_bloating') as boolean | null,
    gi_timing:                 [],
    gi_severity:               null,
    gi_stool_type:             null,
    // Sprint 16.3 Tier 1 — Section 2 digestive
    food_symptom_link:         fsl('food_symptom_link'),
    gi_stool_frequency:        null,
    energy_low_times:          [],
    energy_curve:              '',
    energy_severity:           null,
    // Sprint 16.3 Tier 1 — Section 2 energy
    post_exertional_worsening: null,
    // Sprint 16.3 Tier 1 — Section 2 hormonal (items 6–8)
    menstrual_status:          str('menstrual_status'),
    menstrual_cycle_length:    null,
    menstrual_flow_heaviness:  null,
    hormonal_symptoms:         [],
    cycle_patterns:            [],
    timeline_last_well:        str('timeline_last_well'),
    timeline_trigger:          str('timeline_trigger'),
    sleep_hours:               num('sleep_hours'),
    sleep_quality:             num('sleep_quality'),
    stress_level:              num('stress_level'),
    energy_level:              num('energy_level'),
    exercise_frequency:        str('exercise_frequency'),
    diet_description:          str('diet_description'),
    // Sprint 16.3 Tier 1 — Section 4
    caffeine_intake:           str('caffeine_intake'),
    alcohol_intake:            str('alcohol_intake'),
    diagnosed_conditions:      arr('diagnosed_conditions'),
    current_medications:       str('current_medications'),
    current_supplements:       str('current_supplements'),
    past_treatments:           str('past_treatments'),
    // Sprint B Phase 1 deletions: practitioner_types, surgeries_or_injuries,
    // health_goals, timeline_expectation, biggest_barrier, readiness_time,
    // readiness_change all removed from FormState. Existing column data
    // preserved in the DB (no DROP COLUMN); rows simply stop writing them.
    family_history:            arr('family_history'),
    psychosocial_impact:       str('psychosocial_impact'),
    psychosocial_worry:        str('psychosocial_worry'),
    psychosocial_supported:    '',
    readiness_budget:          str('readiness_budget'),
  }
}

// detectPrimarySystem deleted in C5 — replaced by evaluateRules + BRANCHING_RULES.
// getSectionData now receives the derived primarySystem from the caller.

// Sprint B Phase 1 — getSectionData renumbered for the new 11-step flow.
// Called by handleNext as getSectionData(form, currentStep + 1, ...) — i.e.
// the case argument is the destination step. Each case flushes the fields
// that were captured in the step we are leaving.
//   case 1  ← after step 0  (Arrival)         flushes arrival_emotion
//   case 2  ← after step 1  (Your Story)      flushes story fields + signature
//   case 3  ← after step 2  (Your Best)       flushes timeline_last_well
//   case 4  ← after step 3  (What Changed)    flushes timeline_trigger
//   case 5  ← after step 4  (Deeper dive)     flushes systems_reviewed + primary_system
//   case 6  ← after step 5  (Daily life)
//   case 7  ← after step 6  (Medical)
//   case 8  ← after step 7  (Mind)
//   case 9  ← after step 8  (Goals stub)      ← shrinks after Phase 1 deletions
//   case 10 ← after step 9  (Readiness stub)  ← shrinks after Phase 1 deletions
function getSectionData(f: FormState, s: number, primarySystem: string): Record<string, unknown> {
  switch (s) {
    case 1: return { arrival_emotion: f.arrival_emotion || null }
    case 2: return {
      primary_concerns:        f.primary_concerns,
      concern_duration:        f.concern_duration || null,
      symptom_pattern:         f.symptom_pattern || null,
      primary_system:          primarySystem,
      // Sprint B Phase 1 — signature question lives on intake_responses
      most_want_to_understand: f.most_want_to_understand || null,
    }
    case 3: return { timeline_last_well: f.timeline_last_well || null }
    case 4: return { timeline_trigger:   f.timeline_trigger   || null }
    case 5: return { systems_reviewed:   f.systems_reviewed,   primary_system: primarySystem }
    case 6: return { sleep_hours: f.sleep_hours, sleep_quality: f.sleep_quality, stress_level: f.stress_level, energy_level: f.energy_level, exercise_frequency: f.exercise_frequency || null, diet_description: f.diet_description || null }
    case 7: return {
      // Sprint B Phase 1 — practitioner_types + surgeries_or_injuries removed.
      diagnosed_conditions: f.diagnosed_conditions,
      current_medications:  f.current_medications || null,
      current_supplements:  f.current_supplements || null,
      past_treatments:      f.past_treatments || null,
      family_history:       f.family_history,
    }
    case 8: return { psychosocial_impact: f.psychosocial_impact || null, psychosocial_worry: f.psychosocial_worry || null, psychosocial_supported: f.psychosocial_supported ? ['alone', 'not_really'].includes(f.psychosocial_supported) ? false : true : null }
    // Sprint B Phase 1 — case 9 (Goals stub) is now empty after the
    // health_goals / timeline_expectation / biggest_barrier deletions.
    // Returns {} so the section transition still saves completed_sections.
    case 9: return {}
    // Sprint B Phase 1 — case 10 (Readiness stub): readiness_time and
    // readiness_change removed; only readiness_budget remains for now
    // (architecture §10 recommends moving to onboarding later).
    case 10: return { readiness_budget: f.readiness_budget || null }
    default: return {}
  }
}

// ─── Sprint 16.3 Tier 1 constants ────────────────────────────────────────────

// Item 4: food trigger presets (Section 2 digestive)
const FOOD_TRIGGER_PRESETS = [
  'Gluten / wheat', 'Dairy', 'Eggs', 'Onion or garlic',
  'Legumes / beans', 'High-sugar foods', 'Spicy food',
  'Fatty foods', 'Alcohol', 'Coffee / caffeine',
]

// Items 10–11: R6 enum options for caffeine + alcohol (Section 4)
// Stored value = key ('none'|'low'|'moderate'|'high'). Labels are user-visible only.
const INTAKE_LEVELS: { key: string; label: string }[] = [
  { key: 'none',     label: 'None'     },
  { key: 'low',      label: 'Low'      },
  { key: 'moderate', label: 'Moderate' },
  { key: 'high',     label: 'High'     },
]

// Item 6: menstrual status options (Step 2.2; perimenopause removed, on_hrt/on_ocp split)
const MENSTRUAL_STATUS_OPTIONS: { key: string; label: string }[] = [
  { key: 'regular_cycles',       label: 'Regular cycles'        },
  { key: 'irregular',            label: 'Irregular cycles'      },
  { key: 'post_menopause',       label: 'Post-menopause'        },
  { key: 'surgical_menopause',   label: 'Surgical menopause'    },
  { key: 'on_hrt',               label: 'On HRT'                },
  { key: 'on_ocp',               label: 'On the pill (OCP)'     },
  { key: 'never_menstruated',    label: 'Never menstruated'     },
  { key: 'prefer_not_to_say',    label: 'Prefer not to say'     },
]

// Items 7–8: gating — shown only when menstrual_status is NOT in excluded set (R3).
// Single computed boolean; referenced in both render sites (not inlined twice).
const MENSTRUAL_GATE_EXCLUDED = new Set([
  'prefer_not_to_say', 'post_menopause', 'surgical_menopause', 'never_menstruated',
])

// Item 8: flow heaviness labels for NamedFiveDot (1–5 → Light → Flooding)
const FLOW_HEAVINESS_LABELS = ['Light', 'Moderate', 'Heavy', 'Very heavy', 'Flooding']

// ─── Arrival emotion acknowledgements ─────────────────────────────────────────
// B6: approved copy only. No praise, no therapy-speak.

function arrivalAck(emotion: string): string {
  switch (emotion) {
    case 'frustrated': return 'Thank you — that helps us understand where you are right now. We\'ll take this step by step.'
    case 'worried':    return 'We\'ll take this step by step. If anything feels uncertain, choose the closest option — you can refine it later.'
    case 'hopeful':    return 'Thank you — that helps us understand where to begin. We\'ll take this step by step.'
    case 'curious':    return 'Thank you — that helps us understand the pattern more clearly.'
    case 'exhausted':  return 'We\'ll take this step by step. There\'s no need to rush — take as much time as you need.'
    default:           return 'We\'ll take this step by step.'
  }
}

// ─── Section 0 — Arrival ──────────────────────────────────────────────────────
// B5: sentence labels — value enums (keys) unchanged.

const ARRIVAL_EMOTIONS: EmojiOption[] = [
  { key: 'hopeful',    icon: '😌', label: "I'm looking for clarity and progress" },
  { key: 'frustrated', icon: '😤', label: "I feel stuck and want answers"         },
  { key: 'worried',    icon: '😟', label: "I'm concerned about what's happening"  },
  { key: 'curious',    icon: '🤔', label: "I want to understand my patterns"      },
  { key: 'exhausted',  icon: '😞', label: "I feel drained and need support"       },
]

function Section0({
  form, setForm, persist,
}: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>>; persist: PersistFn }) {
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
        {/* B5: responsive grid — single at xs, 2-col at sm, 5-col at md+.
              min-h-32 (8rem / 128px) is the closest token-aligned spacing to 130px. */}
        <EmojiCardGrid
          options={ARRIVAL_EMOTIONS}
          selected={form.arrival_emotion ? [form.arrival_emotion] : []}
          onChange={v => persist('arrival_emotion', v[0] ?? '', 0, { clinicalObjective: 'tone_baseline' })}
          cols={5}
          single={true}
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 [&>button]:min-h-32"
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

// B3: word-only chip data — ambiguous graph emoji (📈 📉 〰 📍) removed.
// Plain sentence labels carry the meaning without directional glyphs.
const PATTERN_WORDS: { key: string; label: string }[] = [
  { key: 'always',     label: 'Constant — always there'    },
  { key: 'comes_goes', label: 'Comes and goes in waves'    },
  { key: 'improving',  label: 'Slowly improving'           },
  { key: 'worsening',  label: 'Gradually worsening'        },
]

// Word-only chip row — no icons, no glyphs. Token-aligned card styling.
function WordChipRow({
  options, selected, onChange,
}: { options: { key: string; label: string }[]; selected: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(({ key, label }) => {
        const sel = selected === key
        return (
          <button key={key} type="button" onClick={() => onChange(sel ? '' : key)}
            className={`px-4 py-2.5 rounded-lg border text-sm transition-all cursor-pointer ${
              sel
                ? 'bg-brand-ultra border-brand-default text-text-brand shadow-sm font-medium'
                : 'bg-surface-raised border-border-default text-text-primary hover:border-brand-default hover:bg-brand-ultra/40'
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

// Sprint B Phase 1 — religion enum options for the optional question.
const RELIGION_OPTIONS: { key: FormState['religion']; label: string }[] = [
  { key: 'muslim',            label: 'Muslim'             },
  { key: 'christian',         label: 'Christian'          },
  { key: 'jewish',            label: 'Jewish'             },
  { key: 'hindu',             label: 'Hindu'              },
  { key: 'buddhist',          label: 'Buddhist'           },
  { key: 'sikh',              label: 'Sikh'               },
  { key: 'secular',           label: 'Secular'            },
  { key: 'other',             label: 'Other'              },
  { key: 'prefer_not_to_say', label: 'Prefer not to say'  },
]

function Section1({
  form, setForm, persist, setBiologicalSex, setReligion, setReligiousContentPreference,
}: {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  persist: PersistFn
  setBiologicalSex:               (v: 'male' | 'female') => void
  setReligion:                    (v: FormState['religion']) => void
  setReligiousContentPreference:  (v: FormState['religious_content_preference']) => void
}) {
  return (
    <div className="space-y-8">
      {/* Sprint B Phase 2 — Chapter 1 opening copy. Frames the chapter as
          identity + invitation (Tier A narrative) without duplicating the
          ChapterIntro purpose above. The chip-cloud caption that used to live
          here ("Select everything that resonates") has moved to its proper
          home above the primary_concerns chip cloud below. */}
      <SectionHeader name="Chapter 1 — Your Story" heading="Tell us a little about you, and what brought you here." subtitle="Take it slow. Skip anything you'd rather not answer." />

      {/* Decision 4 — biological_sex captured before the hormonal branch.
          Drives sex-specific question visibility downstream. Stored on
          user_personalisation, not intake_responses.
          Sprint B Phase 1 — caption locked per founder approval. */}
      <div>
        <p className="text-sm font-medium text-text-primary mb-2">
          Biological sex
        </p>
        <p className="text-xs text-text-muted mb-3">
          We use this to ensure health information and reference ranges are
          interpreted correctly.
        </p>
        <WordChipRow
          options={[
            { key: 'female', label: 'Female' },
            { key: 'male',   label: 'Male'   },
          ]}
          selected={form.biological_sex ?? ''}
          onChange={v => { if (v === 'female' || v === 'male') setBiologicalSex(v) }}
        />
      </div>

      {/* Sprint B Phase 1 — signature question. The "this is different" moment.
          Quoted verbatim in practitioner workspace, body story opening, and
          synopsis opening (HARD DEPENDENCY satisfied by commits 2b511ce +
          ff55895). Optional — absence is itself signal. */}
      <div>
        <p className="text-sm font-medium text-text-primary mb-2">
          If we get this right, what would you most want to understand about
          what&apos;s happening to you?
        </p>
        <p className="text-xs text-text-muted mb-3">
          Most intake forms skip this. We don&apos;t — what you came here to
          understand shapes everything we do next.
        </p>
        <WarmTextarea
          value={form.most_want_to_understand}
          onChange={v => setForm(f => ({ ...f, most_want_to_understand: v }))}
          onBlur={v => persist('most_want_to_understand', v, 1, { clinicalObjective: 'signature_intent' })}
          placeholder="There's no right answer. It might be a question you've been carrying. Something that doesn't add up. A thing you can't explain. Or just where you'd like to feel different."
          rows={4}
        />
      </div>

      {/* Sprint B Phase 1 — religion (optional). PS.1 substrate field; written
          to user_personalisation. Frames AI synopsis tone. Default is
          prefer_not_to_say. */}
      <div>
        <p className="text-sm font-medium text-text-primary mb-2">
          Religion <span className="text-text-muted font-normal">(optional)</span>
        </p>
        <p className="text-xs text-text-muted mb-3">
          We ask so we can frame your synopsis in a way that feels right to you.
          We default to secular framing; you can opt into other framings if
          you&apos;d like.
        </p>
        <WordChipRow
          options={RELIGION_OPTIONS.map(o => ({ key: o.key, label: o.label }))}
          selected={form.religion}
          onChange={v => {
            if (RELIGION_OPTIONS.some(o => o.key === v)) setReligion(v as FormState['religion'])
          }}
        />
      </div>

      {/* Sprint B Phase 1 — religious_content_preference. Conditional on
          religion='muslim' (v1 — other religions have no framed content yet).
          Per architectural rule: Islamic framing renders IFF religion='muslim'
          AND religious_content_preference='show'. Default is 'hide'. */}
      {form.religion === 'muslim' && (
        <div style={{ animation: 'fadeSlideIn 200ms ease-out' }}>
          <p className="text-sm font-medium text-text-primary mb-2">
            Would you like Islamic framing in your synopsis?
          </p>
          <p className="text-xs text-text-muted mb-3">
            We can reference Islamic concepts (such as ihsan or amanah) where
            they enrich clinical reflection. Clinical recommendations stay
            evidence-based either way.
          </p>
          <WordChipRow
            options={[
              { key: 'show', label: 'Yes, show this framing' },
              { key: 'hide', label: 'No, keep it secular'    },
            ]}
            selected={form.religious_content_preference}
            onChange={v => {
              if (v === 'show' || v === 'hide') setReligiousContentPreference(v)
            }}
          />
        </div>
      )}

      {/* Sprint B Phase 2 — primary_concerns prompt + helper. Previously the
          BigChipCloud inherited its meaning by proximity to the SectionHeader,
          which read as a chip caption from the top of the chapter. Tier A
          signal per the intelligence architecture (B5 — primary concerns) —
          frame as invitation, not categorisation. */}
      <div>
        <p className="text-sm font-medium text-text-primary mb-2">
          What&apos;s been on your mind most?
        </p>
        <p className="text-xs text-text-muted mb-3">
          Pick anything that feels true. You can pick more than one.
        </p>
        <BigChipCloud
          options={PRIMARY_CONCERNS}
          selected={form.primary_concerns}
          onChange={v => persist('primary_concerns', v, 1, { clinicalObjective: 'concern_identification' })}
        />
      </div>
      <div>
        {/* Sprint B Phase 2 — concern_duration warm rewrite. Same chip set,
            warmer surface. "With you" recognises the experience has been
            carried; "going on" was functional but cold. */}
        <p className="text-sm font-medium text-text-primary mb-3">How long has this been with you?</p>
        <EmojiCardGrid
          options={DURATION_EMOJIS}
          selected={form.concern_duration ? [form.concern_duration] : []}
          onChange={v => persist('concern_duration', v[0] ?? '', 1, { clinicalObjective: 'symptom_chronology' })}
          cols={4}
        />
      </div>
      <div>
        {/* Sprint B Phase 2 — symptom_pattern. "Day to day" anchors the
            answer to lived experience and matches the chip labels (constant /
            comes and goes / improving / worsening), all of which describe
            daily texture. */}
        <p className="text-sm font-medium text-text-primary mb-3">How does it tend to show up day to day?</p>
        <WordChipRow
          options={PATTERN_WORDS}
          selected={form.symptom_pattern}
          onChange={v => persist('symptom_pattern', v, 1, { clinicalObjective: 'symptom_pattern' })}
        />
      </div>

      {/* Sprint B Phase 2 — concern_severity_baseline (Tier A: B3 symptom
          severity). "Shape your day" inverts the register — the experience
          becomes a description of life, not an assessment of pathology.
          (R2: independent of per-system severities.) */}
      <div>
        <p className="text-sm font-medium text-text-primary mb-3">
          How much does this shape your day right now?
        </p>
        <IntakeVisualScale
          value={form.concern_severity_baseline}
          onChange={v => persist('concern_severity_baseline', v, 1, { clinicalObjective: 'intake_severity_baseline' })}
        />
      </div>

      {/* Sprint B Phase 2 — aggravating_factors. Drops the "Is there anything
          that…" hedge that makes the user feel they need to justify having an
          answer. Placeholder shifts from "e.g." catalog to first-person
          observation, modelling the kind of answer the system wants and
          explicitly inviting guesses. (R7: persist on onBlur, not onChange.) */}
      <div>
        <p className="text-sm font-medium text-text-primary mb-2">
          What tends to make it worse, if anything?{' '}
          <span className="text-text-muted font-normal">(optional)</span>
        </p>
        <WarmTextarea
          value={form.aggravating_factors}
          onChange={v => setForm(f => ({ ...f, aggravating_factors: v }))}
          onBlur={v => persist('aggravating_factors', v, 1, { clinicalObjective: 'aggravating_factor_capture' })}
          placeholder="Maybe after eating. Maybe when you're stressed. Maybe evenings. Whatever you've noticed — even a guess is useful."
          rows={3}
        />
      </div>

      {/* Sprint B Phase 2 — relieving_factors. Same direct-prompt + modelled-
          placeholder pattern as aggravating_factors. "Lighter" carries
          qualitative meaning rather than clinical "relief". (R7.) */}
      <div>
        <p className="text-sm font-medium text-text-primary mb-2">
          What tends to help, if anything?{' '}
          <span className="text-text-muted font-normal">(optional)</span>
        </p>
        <WarmTextarea
          value={form.relieving_factors}
          onChange={v => setForm(f => ({ ...f, relieving_factors: v }))}
          onBlur={v => persist('relieving_factors', v, 1, { clinicalObjective: 'relieving_factor_capture' })}
          placeholder="Rest. Heat. Avoiding particular foods. Time alone. Anything you've noticed makes it lighter."
          rows={3}
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

type Section2Branch = 'digestive' | 'hormonal' | 'energy' | 'cognitive' | 'general'

function Section2({
  branch, form, setForm, persist,
}: {
  branch:  Section2Branch
  form:    FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  persist: PersistFn
}) {
  if (branch === 'digestive') {
    return (
      <div className="space-y-7">
        <SectionHeader section={2} name="Deeper dive" heading="Let's explore what's happening in more detail." subtitle="Your answers here help us identify patterns." />
        <div>
          <p className="text-sm font-medium text-text-primary mb-3">Do you experience bloating?</p>
          <BooleanCards
            value={form.gi_bloating}
            onChange={v => persist('gi_bloating', v, 2, { clinicalObjective: 'gi_assessment', mappedSystems: ['gastrointestinal'] })}
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
                onChange={v => persist('gi_timing', v, 2, { clinicalObjective: 'gi_timing', mappedSystems: ['gastrointestinal'] })}
                context="digestive"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary mb-3">How severe is it on a bad day?</p>
              <IntakeVisualScale
                value={form.gi_severity}
                onChange={v => persist('gi_severity', v, 2, { clinicalObjective: 'severity_assessment', mappedSystems: ['gastrointestinal'] })}
              />
            </div>
          </div>
        )}

        {/* Item 4 — Food-symptom link (R4: FoodSymptomLink shape, never null) */}
        <div>
          <p className="text-sm font-medium text-text-primary mb-2">
            Do any foods seem to trigger or worsen your symptoms?{' '}
            <span className="text-text-muted font-normal">(optional)</span>
          </p>
          <p className="text-xs text-text-muted mb-3">Select any that apply, or add your own below.</p>
          <BigChipCloud
            options={FOOD_TRIGGER_PRESETS}
            selected={form.food_symptom_link.presets}
            onChange={v => persist('food_symptom_link', { ...form.food_symptom_link, presets: v }, 2, {
              clinicalObjective: 'food_symptom_association_capture',
              mappedSystems: ['gastrointestinal'],
            })}
          />
          <div className="mt-3">
            <TagInput
              value={form.food_symptom_link.custom}
              onChange={v => persist('food_symptom_link', { ...form.food_symptom_link, custom: v }, 2, {
                clinicalObjective: 'food_symptom_association_capture',
                mappedSystems: ['gastrointestinal'],
              })}
              placeholder="Add another trigger and press Enter"
            />
          </div>
        </div>

        {/* Item 5 — Stool frequency (R7: NumberStepper → persist onChange) */}
        <div>
          <p className="text-sm font-medium text-text-primary mb-3">
            On average, how often do you have a bowel movement?
          </p>
          <NumberStepper
            value={form.gi_stool_frequency}
            onChange={v => persist('gi_stool_frequency', v, 2, {
              clinicalObjective: 'bowel_frequency_capture',
              mappedSystems: ['gastrointestinal'],
            })}
            min={0}
            max={8}
            default={1}
            unit="times per day"
          />
        </div>
      </div>
    )
  }

  if (branch === 'hormonal') {
    // Decision 4 — menstrual section gated on biological_sex='female' from
    // user_personalisation, NOT on menstrual_status. Stops the prior trust-
    // breaking case where a male user picking "Hormonal symptoms" saw
    // menstrual options. The hormonal_symptoms chip cloud and cycle_patterns
    // selector stay sex-agnostic for now (Section 2 hormonal still applies to
    // any sex with hormonal concerns — e.g., low testosterone, thyroid).
    const isFemale = form.biological_sex === 'female'

    // R3 derived gate, now sex-conditional: cycle length + flow heaviness
    // questions appear only when the user is female AND has selected a
    // non-excluded menstrual status.
    const showCycleQuestions = (
      isFemale &&
      form.menstrual_status !== '' &&
      !MENSTRUAL_GATE_EXCLUDED.has(form.menstrual_status)
    )
    return (
      <div className="space-y-7">
        <SectionHeader section={2} name="Deeper dive" heading="Let's look at hormonal patterns more closely." subtitle="You only need to share what you're comfortable with." />
        <div>
          <p className="text-sm font-medium text-text-primary mb-3">Which of these do you experience?</p>
          <BigChipCloud
            options={HORMONAL_SYMPTOMS}
            selected={form.hormonal_symptoms}
            onChange={v => persist('hormonal_symptoms', v, 2, { clinicalObjective: 'hormonal_assessment', mappedSystems: ['hormonal'] })}
          />
        </div>

        {/* cycle_patterns — female-only (cycles are inherently menstrual context) */}
        {isFemale && (
          <div>
            <p className="text-sm font-medium text-text-primary mb-3">Do your symptoms follow a cycle pattern?</p>
            <CyclePatternSelector
              value={form.cycle_patterns}
              onChange={v => persist('cycle_patterns', v, 2, { clinicalObjective: 'cycle_pattern', mappedSystems: ['hormonal'] })}
            />
          </div>
        )}

        {/* Item 6 — Menstrual status (WordChipRow single-select, sensitivity-aware)
            Decision 4 — gated on biological_sex='female'. */}
        {isFemale && (
          <div>
            <p className="text-sm font-medium text-text-primary mb-2">
              What best describes your current menstrual status?{' '}
              <span className="text-text-muted font-normal">(optional)</span>
            </p>
            <WordChipRow
              options={MENSTRUAL_STATUS_OPTIONS}
              selected={form.menstrual_status}
              onChange={v => persist('menstrual_status', v, 2, {
                clinicalObjective: 'menstrual_status_capture',
                mappedSystems: ['hormonal'],
              })}
            />
          </div>
        )}

        {/* Items 7 + 8 — gated by showCycleQuestions (sex + menstrual_status) */}
        {showCycleQuestions && (
          <div className="space-y-6" style={{ animation: 'fadeSlideIn 200ms ease-out' }}>
            {/* Item 7 — Cycle length (NumberStepper 21–45 default 28) */}
            <div>
              <p className="text-sm font-medium text-text-primary mb-3">
                What is your typical cycle length?
              </p>
              <NumberStepper
                value={form.menstrual_cycle_length}
                onChange={v => persist('menstrual_cycle_length', v, 2, {
                  clinicalObjective: 'cycle_length_capture',
                  mappedSystems: ['hormonal'],
                })}
                min={21}
                max={45}
                default={28}
                unit="days"
              />
            </div>

            {/* Item 8 — Flow heaviness (NamedFiveDot, labels: Light → Flooding) */}
            <div>
              <p className="text-sm font-medium text-text-primary mb-3">
                How would you describe your typical flow?
              </p>
              <NamedFiveDot
                value={form.menstrual_flow_heaviness}
                onChange={v => persist('menstrual_flow_heaviness', v, 2, {
                  clinicalObjective: 'menstrual_flow_capture',
                  mappedSystems: ['hormonal'],
                })}
                labels={FLOW_HEAVINESS_LABELS}
              />
            </div>
          </div>
        )}
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
            onChange={v => persist('energy_low_times', v, 2, { clinicalObjective: 'energy_pattern', mappedSystems: ['metabolic'] })}
          />
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary mb-3">Which pattern describes your energy across the day?</p>
          <EnergyCurveSelector
            value={form.energy_curve || null}
            onChange={v => persist('energy_curve', v, 2, { clinicalObjective: 'energy_curve', mappedSystems: ['metabolic'] })}
          />
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary mb-3">How severe is the fatigue on a bad day?</p>
          <IntakeVisualScale
            value={form.energy_severity}
            onChange={v => persist('energy_severity', v, 2, { clinicalObjective: 'severity_assessment', mappedSystems: ['metabolic'] })}
          />
        </div>

        {/* Item 9 — Post-exertional worsening (R5: exact prompt; R7: BooleanCards → onChange) */}
        <div>
          <p className="text-sm font-medium text-text-primary mb-3">
            Do you feel noticeably worse the day after physical or mental exertion?
          </p>
          <BooleanCards
            value={form.post_exertional_worsening}
            onChange={v => persist('post_exertional_worsening', v, 2, {
              clinicalObjective: 'post_exertional_pattern',
              mappedSystems: ['metabolic'],
            })}
            yesLabel="Yes"
            noLabel="Not really"
            yesSub="Energy crashes or symptoms worsen"
            noSub="I recover normally"
          />
          {form.post_exertional_worsening === true && (
            <div className="mt-4" style={{ animation: 'fadeSlideIn 200ms ease-out' }}>
              <AcknowledgementBanner text="This pattern is worth noting — it can point to specific physiological mechanisms worth exploring with a practitioner." />
            </div>
          )}
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
            onChange={v => persist('hormonal_symptoms', v, 2, { clinicalObjective: 'cognitive_assessment', mappedSystems: ['neurological'] })}
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
          onChange={v => persist('systems_reviewed', v, 2, { clinicalObjective: 'systems_overview' })}
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

// Sprint B Phase 1 — old Section 3 (Timeline) split into two chapters:
//   ChapterBest    (step 2) — timeline_last_well  → Chapter 2 "Your Best"
//   ChapterChanged (step 3) — timeline_trigger    → Chapter 3 "What Changed"
// The split serves the temporal arc of the journey (backward anchor →
// pivot). Content slotted as-is per Phase 1 spec; per-question rewrites
// (the new "what was different back then" narrative q, the comparative
// sleep/energy/mood "back then" questions) are Phase 2.

function ChapterBest({
  form, setForm, persist,
}: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>>; persist: PersistFn }) {
  void setForm
  return (
    <div className="space-y-7">
      <SectionHeader name="Chapter 2 — Your Best" heading="When did you last feel well?" subtitle="Sometimes understanding when is as revealing as what." />
      <AcknowledgementBanner text="Some details may take you back through your health history. Take your time." />
      <div>
        <p className="text-sm font-medium text-text-primary mb-3">When did you last feel genuinely well?</p>
        <EmojiCardGrid
          options={LAST_WELL_EMOJIS}
          selected={form.timeline_last_well ? [form.timeline_last_well] : []}
          onChange={v => persist('timeline_last_well', v[0] ?? '', 2, { clinicalObjective: 'symptom_onset' })}
          cols={5}
        />
      </div>
    </div>
  )
}

function ChapterChanged({
  form, setForm, persist,
}: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>>; persist: PersistFn }) {
  return (
    <div className="space-y-7">
      <SectionHeader name="Chapter 3 — What Changed" heading="What was happening around then?" subtitle="e.g. a stressful period, a virus, a life change, or nothing obvious." />
      <div>
        <p className="text-sm font-medium text-text-primary mb-2">In your own words.</p>
        <p className="text-xs text-text-muted mb-3">There&apos;s no right answer — even &ldquo;nothing obvious&rdquo; is useful.</p>
        <WarmTextarea
          value={form.timeline_trigger}
          onChange={v => setForm(f => ({ ...f, timeline_trigger: v }))}
          onBlur={v => persist('timeline_trigger', v, 3, { clinicalObjective: 'potential_trigger' })}
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

function Section4({
  form, setForm, persist,
}: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>>; persist: PersistFn }) {
  return (
    <div className="space-y-8">
      <SectionHeader section={4} name="Daily life" heading="How you live day to day." subtitle="Small details here can reveal big patterns." />
      <AcknowledgementBanner text="This information helps build a fuller picture of what may be influencing your health." />
      <div>
        <p className="text-sm font-medium text-text-primary mb-3">How much sleep do you get?</p>
        {/* B4: NumberStepper replaces MoonSelector — [−] 7 hours [+] */}
        <NumberStepper
          value={form.sleep_hours}
          onChange={v => persist('sleep_hours', v, 4, { clinicalObjective: 'sleep_quantity' })}
          min={0}
          max={12}
          default={7}
          unit="hours"
        />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary mb-3">How would you rate the quality of that sleep?</p>
        <NamedFiveDot
          value={form.sleep_quality}
          onChange={v => persist('sleep_quality', v, 4, { clinicalObjective: 'sleep_quality' })}
          labels={['Terrible', 'Poor', 'Fair', 'Good', 'Excellent']}
        />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary mb-3">What is your typical stress level?</p>
        <NamedFiveDot
          value={form.stress_level}
          onChange={v => persist('stress_level', v, 4, { clinicalObjective: 'stress_assessment' })}
          labels={['Very low', 'Low', 'Moderate', 'High', 'Very high']}
        />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary mb-3">How would you rate your day-to-day energy?</p>
        <NamedFiveDot
          value={form.energy_level}
          onChange={v => persist('energy_level', v, 4, { clinicalObjective: 'energy_baseline' })}
          labels={['Depleted', 'Low', 'Moderate', 'Good', 'Excellent']}
        />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary mb-3">How often do you exercise?</p>
        <EmojiCardGrid
          options={EXERCISE_EMOJIS}
          selected={form.exercise_frequency ? [form.exercise_frequency] : []}
          onChange={v => persist('exercise_frequency', v[0] ?? '', 4, { clinicalObjective: 'lifestyle_activity' })}
          cols={4}
        />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary mb-3">What best describes your diet?</p>
        <BigChipCloud
          options={DIET_OPTIONS}
          selected={form.diet_description ? [form.diet_description] : []}
          onChange={v => persist('diet_description', v[0] ?? '', 4, { clinicalObjective: 'dietary_pattern' })}
          multi={false}
        />
      </div>

      {/* Item 10 — Caffeine intake (R6: enum 'none'|'low'|'moderate'|'high'; R7: WordChipRow → onChange) */}
      <div>
        <p className="text-sm font-medium text-text-primary mb-3">How much caffeine do you typically have?</p>
        <WordChipRow
          options={INTAKE_LEVELS}
          selected={form.caffeine_intake}
          onChange={v => persist('caffeine_intake', v, 4, { clinicalObjective: 'caffeine_intake_capture' })}
        />
      </div>

      {/* Item 11 — Alcohol intake (R6: same enum; R7: WordChipRow → onChange) */}
      <div>
        <p className="text-sm font-medium text-text-primary mb-3">How much alcohol do you typically have?</p>
        <WordChipRow
          options={INTAKE_LEVELS}
          selected={form.alcohol_intake}
          onChange={v => persist('alcohol_intake', v, 4, { clinicalObjective: 'alcohol_intake_capture' })}
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

// PRACTITIONER_OPTIONS removed — Sprint B Phase 1 deletion (practitioner_types).

function Section5({
  form, setForm, persist, isDigestive,
}: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>>; persist: PersistFn; isDigestive: boolean }) {
  return (
    <div className="space-y-7">
      <SectionHeader section={5} name="Medical" heading="Your health background." subtitle="Share only what you feel comfortable with — everything here is optional." />
      <AcknowledgementBanner text="If anything feels uncertain, choose the closest option — you can refine it later." />
      <div>
        <p className="text-sm font-medium text-text-primary mb-2">Any existing diagnoses or conditions?</p>
        <TagInput
          value={form.diagnosed_conditions}
          onChange={v => persist('diagnosed_conditions', v, 5, { clinicalObjective: 'medical_history' })}
          placeholder="Add a condition and press Enter"
          presets={CONDITION_PRESETS}
        />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary mb-2">Current medications</p>
        <WarmTextarea
          value={form.current_medications}
          onChange={v => setForm(f => ({ ...f, current_medications: v }))}
          onBlur={v => persist('current_medications', v, 5, { clinicalObjective: 'medication_list' })}
          placeholder="e.g. Levothyroxine 50mcg, oral contraceptive pill…"
          rows={2}
        />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary mb-2">Current supplements</p>
        <TagInput
          value={form.current_supplements.split(',').map(s => s.trim()).filter(Boolean)}
          onChange={v => {
            // current_supplements: FormState stores comma-joined string; persist receives array
            setForm(f => ({ ...f, current_supplements: v.join(', ') }))
            persist('current_supplements', v, 5, { clinicalObjective: 'supplement_list' })
          }}
          placeholder="Add supplement and press Enter"
          presets={SUPPLEMENT_PRESETS}
        />
      </div>
      {/* Sprint B Phase 1 deletion — practitioner_types chip cloud removed.
          Architecture §11: "Names types of practitioner without outcomes,
          helpfulness, or what was learned. A list of practitioner types tells
          the practitioner nothing actionable." */}
      <div>
        <p className="text-sm font-medium text-text-primary mb-2">Treatments or approaches you&apos;ve tried</p>
        <WarmTextarea
          value={form.past_treatments}
          onChange={v => setForm(f => ({ ...f, past_treatments: v }))}
          onBlur={v => persist('past_treatments', v, 5, { clinicalObjective: 'treatment_history' })}
          placeholder="e.g. Elimination diet, acupuncture, CBT…"
          rows={2}
        />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary mb-2">Family health history</p>
        <BigChipCloud
          options={FAMILY_HISTORY_OPTIONS}
          selected={form.family_history}
          onChange={v => persist('family_history', v, 5, { clinicalObjective: 'family_history' })}
        />
      </div>
      {isDigestive && (
        <div>
          <p className="text-sm font-medium text-text-primary mb-3">Bowel pattern — which type most resembles yours?</p>
          <BristolStoolSelector
            value={form.gi_stool_type}
            onChange={v => persist('gi_stool_type', v, 5, { clinicalObjective: 'stool_form_assessment', mappedSystems: ['gastrointestinal'] })}
          />
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

function Section6({
  form, setForm, persist,
}: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>>; persist: PersistFn }) {
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
        <WarmTextarea
          value={form.psychosocial_impact}
          onChange={v => setForm(f => ({ ...f, psychosocial_impact: v }))}
          onBlur={v => persist('psychosocial_impact', v, 6, { clinicalObjective: 'psychosocial_impact' })}
          placeholder="e.g. I've had to reduce my hours at work, it affects my relationships…"
          rows={4}
        />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary mb-2">What worries you most about your health right now?</p>
        <WarmTextarea
          value={form.psychosocial_worry}
          onChange={v => setForm(f => ({ ...f, psychosocial_worry: v }))}
          onBlur={v => persist('psychosocial_worry', v, 6, { clinicalObjective: 'psychosocial_worry' })}
          placeholder="e.g. That it will get worse. That no one can find the cause…"
          rows={4}
        />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary mb-3">Do you feel supported?</p>
        <EmojiCardGrid
          options={SUPPORTED_EMOJIS}
          selected={form.psychosocial_supported ? [form.psychosocial_supported] : []}
          onChange={v => persist('psychosocial_supported', v[0] ?? '', 6, { clinicalObjective: 'social_support' })}
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

// Sprint B Phase 1 — Section 7 (Goals) is now a placeholder pass-through
// after the deletion of health_goals, timeline_expectation, and
// biggest_barrier. The chapter framework still includes this step inside
// Chapter 4; Phase 2 may either remove the step entirely or repopulate it
// with rewritten content (architecture §10–§13).
function Section7() {
  return (
    <div className="space-y-7">
      <SectionHeader name="Chapter 4 — Where You Are Now" heading="Almost done with the body and life picture." subtitle="One more short step and we'll show you what we heard." />
      <p className="text-sm text-text-secondary leading-relaxed">
        You&apos;ve shared most of what we&apos;d want to know. Keep going — the next page is brief, and the one after that is our reflection back to you.
      </p>
    </div>
  )
}

// ─── Section 8 — Readiness ────────────────────────────────────────────────────
// Sprint B Phase 1 — readiness_time and readiness_change deleted (per
// founder approval; philosophy is "infer, don't ask"). readiness_budget
// retained for now as the sole question; architecture §10 recommends
// moving to onboarding in a later phase.

const BUDGET_EMOJIS: EmojiOption[] = [
  { key: 'tight',    icon: '💷', label: 'Tight right now' },
  { key: 'some',     icon: '💳', label: 'Some flexibility' },
  { key: 'flexible', icon: '💰', label: 'Flexible'         },
]

function Section8({
  form, persist,
}: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>>; persist: PersistFn }) {
  return (
    <div className="space-y-7">
      <SectionHeader name="Chapter 4 — Where You Are Now" heading="One last question." subtitle="What's realistic for you right now?" />
      <div>
        <p className="text-sm font-medium text-text-primary mb-3">How would you describe your health budget right now?</p>
        <EmojiCardGrid
          options={BUDGET_EMOJIS}
          selected={form.readiness_budget ? [form.readiness_budget] : []}
          onChange={v => persist('readiness_budget', v[0] ?? '', 8, { clinicalObjective: 'readiness_budget' })}
          cols={3}
        />
      </div>
    </div>
  )
}

// ─── Sprint B Phase 1 — What We Heard pattern → copy mapping ─────────────────
//
// Rule-based (NOT AI-generated) per architecture §9. Each flag from the
// branching engine maps to a single observation sentence. Maximum 3 bullets
// rendered (architecture §9). Copy register:
//   • Address user in second person, present tense
//   • Quote the user back where possible
//   • NEVER use: symptoms / condition / syndrome / diagnose / suggest /
//                indicate / possibly / "you may have"
//   • USE: mentioned, noticed, said, fit a pattern, worth a closer look
//
// Block 2 returns empty list when no flags fire — better silent than padded.

const WHAT_WE_HEARD_FLAG_COPY: Record<string, string> = {
  flag_severity_high:             "You said this is affecting your daily life heavily — that's worth flagging.",
  flag_post_exertional_pattern:   "You mentioned feeling worse the day after exertion — that's a pattern worth examining specifically.",
  flag_menstrual_flow_high:       "You mentioned very heavy menstrual flow — that's worth a clinical conversation.",
}

function whatWeHeardBullets(flags: string[]): string[] {
  // Up to 3 bullets, in flag-priority order they fire.
  return flags
    .map(f => WHAT_WE_HEARD_FLAG_COPY[f])
    .filter((s): s is string => typeof s === 'string')
    .slice(0, 3)
}

// Format the temporal-arc sentence from intake_responses fields. Returns
// empty string when neither field is populated — block omitted cleanly.
function whatWeHeardTemporalArc(timelineLastWell: string, timelineTrigger: string): string {
  const LAST_WELL_LABEL: Record<string, string> = {
    last_year:    'in the last year',
    '1_3_years':  '1–3 years ago',
    '3_5_years':  '3–5 years ago',
    over_5_years: 'more than 5 years ago',
    not_sure:     'a long time ago',
  }
  const whenLabel = LAST_WELL_LABEL[timelineLastWell] ?? ''
  const hasTrigger = timelineTrigger.trim().length > 0
  if (!whenLabel && !hasTrigger) return ''
  if (whenLabel && hasTrigger) {
    return `You said you last felt well ${whenLabel}, and that things shifted around then.`
  }
  if (whenLabel) {
    return `You said you last felt well ${whenLabel}.`
  }
  return "You shared what was happening when things shifted."
}

// ─── Section 9 — What We Heard + consent (Sprint B Phase 1) ──────────────────

// Sprint B Phase 1 — Chapter 5 (What We Heard) replaces the prior
// congratulatory header + 8-item checklist with a rule-generated 3-block
// reflection. Per architecture §9: NOT AI-generated (rules only), warm/
// intelligent/not-clinical register, no diagnosis language. Followed by
// the consent gate (unchanged in mechanism, kept as the explicit ask).

function Section9({
  consent, setConsent, flags, timelineLastWell, timelineTrigger,
}: {
  consent:          boolean
  setConsent:       (v: boolean) => void
  flags:            string[]
  timelineLastWell: string
  timelineTrigger:  string
}) {
  // Block 1 — the temporal arc, one sentence. Omitted if neither field
  // was answered.
  const arc = whatWeHeardTemporalArc(timelineLastWell, timelineTrigger)

  // Block 2 — up to 3 pattern bullets. Empty list when nothing fires.
  const bullets = whatWeHeardBullets(flags)

  return (
    <div className="space-y-7">
      {/* Block header — quiet, not a "results" headline.
          B1-F1 — the "Chapter 5 — What We Heard" pill is rendered above by
          ChapterIntro (gated on isChapterStart). Suppressed here to avoid
          the duplicate that the inline pill produced. */}
      <div>
        <h2 className="font-display text-2xl font-light text-text-primary leading-snug mb-1">
          A short reflection.
        </h2>
        <p className="text-sm italic text-text-secondary">
          Not a diagnosis. Not a verdict. Just our way of showing we were listening.
        </p>
      </div>

      {/* Block 1 — temporal arc */}
      {arc && (
        <p className="text-base text-text-primary leading-relaxed">
          {arc}
        </p>
      )}

      {/* Block 2 — pattern bullets (max 3). Silent when no flags fire. */}
      {bullets.length > 0 && (
        <div>
          <p className="text-xs font-medium text-text-muted uppercase tracking-[0.08em] mb-3">
            What we noticed
          </p>
          <ul className="space-y-2">
            {bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="text-[#B8935A] mt-1 flex-shrink-0">•</span>
                <span className="text-sm text-text-primary leading-relaxed">{b}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Block 3 — what happens next */}
      <p className="text-sm text-text-secondary leading-relaxed">
        Your full picture goes to a practitioner with your synopsis. We&apos;ll begin generating that now.
      </p>

      {/* Consent — explicit ask, framed after the reflection (not before). */}
      <div className="bg-surface-muted border border-border-default rounded-xl p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-2">AI analysis consent</h3>
        <p className="text-xs text-text-secondary leading-relaxed mb-4">
          Natural Intelligence will use the information you&apos;ve provided — along with any lab report data and root cause analysis results — to generate a personalised health synopsis using AI.
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
  memberId,
  initialBiologicalSex,
  initialReligion,
  initialReligiousContentPreference,
}: {
  existing:                          Record<string, unknown> | null
  memberId:                          string
  initialBiologicalSex:              'male' | 'female' | null
  initialReligion:                   FormState['religion']
  initialReligiousContentPreference: FormState['religious_content_preference']
}) {
  const router  = useRouter()
  // Sprint B Phase 1 — 11 steps (0–10) mapping to 6 chapters via chapterForStep().
  const TOTAL   = TOTAL_STEPS  // 11 steps total: 0..10
  const initial = Math.min((existing?.completed_sections as number | undefined) ?? 0, TOTAL - 1)

  const [section,   setSection]   = useState<number>(initial)
  const [consent,   setConsent]   = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [opacity,   setOpacity]   = useState(1)

  // C4.2 — browser Supabase client (created once, passed to hook)
  const supabase = useMemo(() => createClient(), [])

  // C4.2 — useIntakeAnswers: session bootstrap + per-answer dual-write + hydration
  const {
    form,
    setForm,
    setAnswer,
    isHydrating,
    hydrationError,
    resumeSection,
    saveStatus,
    retryLastSave,
  } = useIntakeAnswers({
    supabase, memberId,
    initialForm: initialState(existing, initialBiologicalSex, initialReligion, initialReligiousContentPreference),
  })

  // Decision 4 — persist biological_sex directly to user_personalisation.
  // Member up_member_update RLS allows the user to update their own row.
  // We update form state immediately for responsive branching, then write
  // through to the substrate (best-effort — failure leaves the in-form
  // answer in place so the user can still progress; a settings UI later
  // can let them correct).
  async function setBiologicalSex(value: 'male' | 'female') {
    setForm(f => ({ ...f, biological_sex: value }))
    try {
      // Same 'as profiles' cast trick used elsewhere — user_personalisation
      // is not in the generated Database types yet.
      const { error } = await supabase
        .from('user_personalisation' as 'profiles')
        .update({ biological_sex: value } as never)
        .eq('id' as 'id', memberId)
      if (error) {
        console.error('[IntakeForm] biological_sex persist failed:', error.message)
      }
    } catch (err) {
      // Soft fail — keep the answer in form state so branching works
      // even if the persistence call had a transient issue.
      console.error('[IntakeForm] biological_sex persist exception:', err)
    }
  }

  // Sprint B Phase 1 — religion + religious_content_preference persistence.
  // Same pattern as setBiologicalSex: write to user_personalisation via the
  // authenticated client (member up_member_update RLS). Soft-fails so the
  // form continues to work if the persistence call hiccups.
  async function setReligion(value: FormState['religion']) {
    setForm(f => ({
      ...f,
      religion: value,
      // If the user backs off muslim, force preference to 'hide' to keep
      // the PS gate (religion='muslim' AND preference='show') correct.
      religious_content_preference: value === 'muslim' ? f.religious_content_preference : 'hide',
    }))
    try {
      const payload: { religion: string; religious_content_preference?: 'hide' } =
        value === 'muslim'
          ? { religion: value }
          : { religion: value, religious_content_preference: 'hide' }
      const { error } = await supabase
        .from('user_personalisation' as 'profiles')
        .update(payload as never)
        .eq('id' as 'id', memberId)
      if (error) console.error('[IntakeForm] religion persist failed:', error.message)
    } catch (err) {
      console.error('[IntakeForm] religion persist exception:', err)
    }
  }

  async function setReligiousContentPreference(value: FormState['religious_content_preference']) {
    setForm(f => ({ ...f, religious_content_preference: value }))
    try {
      const { error } = await supabase
        .from('user_personalisation' as 'profiles')
        .update({ religious_content_preference: value } as never)
        .eq('id' as 'id', memberId)
      if (error) console.error('[IntakeForm] preference persist failed:', error.message)
    } catch (err) {
      console.error('[IntakeForm] preference persist exception:', err)
    }
  }

  // C4.3 — jump to the furthest answered section once hydration completes
  useEffect(() => {
    if (!isHydrating && resumeSection > initial) {
      setSection(resumeSection)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrating])

  // C5.2 Step B — reactive rule evaluation (replaces detectPrimarySystem)
  const ruleResult = useMemo(
    () => evaluateRules(form as unknown as Record<string, unknown>, BRANCHING_RULES),
    [form],
  )

  // C5.2 Step C — derive section2 sub-branch from rule evaluation
  const section2Branch = useMemo<Section2Branch>(() => {
    const active = ruleResult.activeSubBranches['section2'] ?? []
    if (active.length === 0) return 'general'
    return active[0] as Section2Branch
  }, [ruleResult])

  // isDigestive derived from engine for Section5 Bristol Stool selector
  const isDigestive = section2Branch === 'digestive'

  // C5.4 — dev rule-trace inspector (dev + ?debug=rules only)
  const searchParams = useSearchParams()
  const showDebug    = process.env.NODE_ENV === 'development' && searchParams?.get('debug') === 'rules'

  function transition(fn: () => void) {
    setOpacity(0)
    setTimeout(() => {
      fn()
      setOpacity(1)
    }, 160)
  }

  // C3.4 Step 3 — saveIntakeSection stays unchanged (legacy write at section boundary)
  const handleNext = useCallback(async () => {
    if (section >= TOTAL - 1) return
    setSaving(true)
    setError(null)
    try {
      await saveIntakeSection(getSectionData(form, section + 1, section2Branch), section + 1)
      transition(() => setSection(s => s + 1))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }, [form, section, section2Branch])

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
      // Sprint B Phase 1 — was case 9 in the old 10-section flow; final
      // case is now 10 in the new 11-step (Chapter 5) flow.
      await saveIntakeSection(getSectionData(form, 10, section2Branch), 10)
      await completeIntake({ consent_to_ai_analysis: true, consent_given_at: new Date().toISOString() })
      router.push('/dashboard/synopsis')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setSaving(false)
    }
  }, [consent, form, router, section2Branch])

  const isSection0  = section === 0
  const isLastSection = section === TOTAL - 1
  const canBeginFromArrival = isSection0 && form.arrival_emotion !== ''

  return (
    <div className="max-w-2xl mx-auto">
      {/* Inline fade-in CSS */}
      <style>{`@keyframes fadeSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }`}</style>

      {/* Journey map */}
      {!isSection0 && <JourneyMap step={section} />}

      {/* Acknowledgement banner for section 1+ (based on arrival emotion) */}
      {section === 1 && form.arrival_emotion && (
        <AcknowledgementBanner text={arrivalAck(form.arrival_emotion)} />
      )}

      {/* Hydration error — quiet inline notice, never blocks the form */}
      {hydrationError && (
        <p className="text-xs text-text-muted mb-3 text-center">{hydrationError}</p>
      )}

      {/* Section content with fade transition */}
      <div
        style={{ opacity: isHydrating ? 0.4 : opacity, transition: 'opacity 160ms ease-out' }}
        className="rounded-2xl border border-border-default bg-surface-raised p-6 mb-6"
      >
        {/* Chapter transition copy — shown at the first step of each new
            chapter (except Chapter 0 which has no preceding chapter). */}
        {isChapterStart(section) && section > 0 && CHAPTERS[chapterForStep(section)]?.transition && (
          <div className="border-l-4 border-[#B8935A] bg-[#F8F1E4] px-5 py-4 rounded-r-xl mb-6">
            <p className="font-display italic text-base text-[#633806] leading-relaxed">
              {CHAPTERS[chapterForStep(section)].transition}
            </p>
          </div>
        )}

        {/* Chapter intro — shown at the first step of each chapter. */}
        {isChapterStart(section) && section !== 0 && (
          <ChapterIntro chapter={CHAPTERS[chapterForStep(section)]} />
        )}

        {/* Sprint B Phase 1 — step→chapter mapping:
              step 0  = Chapter 0  (Arrival)         → Section0
              step 1  = Chapter 1  (Your Story)      → Section1
              step 2  = Chapter 2  (Your Best)       → ChapterBest (timeline_last_well)
              step 3  = Chapter 3  (What Changed)    → ChapterChanged (timeline_trigger)
              step 4  = Chapter 4  Deeper dive       → Section2 (branched)
              step 5  = Chapter 4  Daily life        → Section4
              step 6  = Chapter 4  Medical           → Section5
              step 7  = Chapter 4  Mind              → Section6
              step 8  = Chapter 4  Goals stub        → Section7 (will shrink after Phase 1 deletions)
              step 9  = Chapter 4  Readiness stub    → Section8 (will shrink after Phase 1 deletions)
              step 10 = Chapter 5  What We Heard     → Section9 + consent */}
        {section === 0  && <Section0       form={form} setForm={setForm} persist={setAnswer} />}
        {section === 1  && <Section1
          form={form} setForm={setForm} persist={setAnswer}
          setBiologicalSex={setBiologicalSex}
          setReligion={setReligion}
          setReligiousContentPreference={setReligiousContentPreference}
        />}
        {section === 2  && <ChapterBest    form={form} setForm={setForm} persist={setAnswer} />}
        {section === 3  && <ChapterChanged form={form} setForm={setForm} persist={setAnswer} />}
        {section === 4  && <Section2       branch={section2Branch} form={form} setForm={setForm} persist={setAnswer} />}
        {section === 5  && <Section4       form={form} setForm={setForm} persist={setAnswer} />}
        {section === 6  && <Section5       form={form} setForm={setForm} persist={setAnswer} isDigestive={isDigestive} />}
        {section === 7  && <Section6       form={form} setForm={setForm} persist={setAnswer} />}
        {section === 8  && <Section7 />}
        {section === 9  && <Section8       form={form} setForm={setForm} persist={setAnswer} />}
        {section === 10 && <Section9
          consent={consent} setConsent={setConsent}
          flags={ruleResult.flags}
          timelineLastWell={form.timeline_last_well}
          timelineTrigger={form.timeline_trigger}
        />}
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
          {saveStatus === 'saving' && (
            <span className="italic text-text-secondary">Saving…</span>
          )}
          {saveStatus === 'error' && (
            <span className="text-red-500">
              Not saved ·{' '}
              <button type="button" onClick={retryLastSave} className="underline hover:no-underline">Retry</button>
            </span>
          )}
          {saveStatus === 'idle' && (
            <>
              Your progress is saved automatically.{' '}
              {/* Sprint B Phase 1 — explicit Save & resume affordance. The
                  auto-save mechanism (useIntakeAnswers) already persists
                  per-answer to intake_answers + per-section to
                  intake_responses; this link simply makes the "close and
                  come back" option visible from every chapter past Arrival.
                  When the user returns to /dashboard/intake, the resume
                  logic jumps them to their furthest-answered step. */}
              <a href="/dashboard" className="underline hover:no-underline text-text-secondary">
                Save and continue later
              </a>
            </>
          )}
        </p>
      )}

      {/* C5.4 — dev rule-trace inspector: visible only in dev + ?debug=rules */}
      {showDebug && (
        <div className="fixed bottom-4 right-4 max-w-sm max-h-96 overflow-auto rounded border border-border-default bg-surface-raised text-xs p-3 z-50 shadow-lg">
          <p className="font-semibold mb-2 text-text-primary">Rule trace</p>
          <p className="text-text-secondary mb-1">
            <span className="text-text-muted">activeSections: </span>
            {JSON.stringify(ruleResult.activeSections)}
          </p>
          <p className="text-text-secondary mb-1">
            <span className="text-text-muted">activeSubBranches: </span>
            {JSON.stringify(ruleResult.activeSubBranches)}
          </p>
          <p className="text-text-secondary mb-2">
            <span className="text-text-muted">flags: </span>
            {JSON.stringify(ruleResult.flags)}
          </p>
          <div className="space-y-1 border-t border-border-default pt-2">
            {ruleResult.trace.map(t => (
              <div key={t.ruleId} className="text-text-muted leading-snug">
                <span className={t.fired ? 'text-text-primary' : ''}>{t.fired ? '✓' : '✗'} {t.ruleId}</span>
                {t.suppressedBy && <span className="text-text-placeholder"> (suppressed by {t.suppressedBy})</span>}
                {t.reason && <span> — {t.reason}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
