# Intake Architecture State — Q2 2026

**Status:** End of Sprint 16.3 (Tier 1 complete)  
**Audience:** Senior engineer onboarding — assumes no prior context  
**Last updated:** 2026-05-05  
**Commit baseline:** `7cb2ac2` (fix care tsconfig — current HEAD)

---

## Contents

1. [End-to-end intake flow](#1-end-to-end-intake-flow)
2. [Current sections, fields, and components](#2-current-sections-fields-and-components)
3. [Storage layer](#3-storage-layer)
4. [Rule engines](#4-rule-engines)
5. [Active flags](#5-active-flags)
6. [Remaining weaknesses](#6-remaining-weaknesses)
7. [Recommended next sprint](#7-recommended-next-sprint)

---

## 1. End-to-end intake flow

### Auth gate and entry route

`apps/web/app/dashboard/intake/page.tsx` is the server component entry point. It calls `createServerSupabaseClient().auth.getUser()`. If no authenticated user, it redirects to `/auth/login`. Authenticated users proceed.

The server component performs one additional database read before rendering: it fetches the most recent row from `intake_responses` (the legacy per-section JSON table) for the member, ordered descending by `created_at`. This row — or `null` if none exists — is passed as the `existing` prop to `<IntakeForm>`. The purpose of this read is to initialise the section cursor (`existing?.completed_sections`), which is used as the starting section number before `useIntakeAnswers` hydrates from the newer `intake_answers` table.

This means the page still depends on `intake_responses` for the initial server render. Removing this dependency is blocked by the incomplete migration off the legacy write path (see §3 and §6.1).

### Session bootstrap (`getOrCreateIntakeSession`)

`useIntakeAnswers` (the central hook, at `apps/web/app/dashboard/intake/hooks/useIntakeAnswers.ts`) calls `getOrCreateIntakeSession(supabase, memberId)` on mount. This function (`packages/db/src/intake/getOrCreateIntakeSession.ts`) queries `intake_sessions` for an existing row with `status = 'in_progress'` for the member. If found, it returns it. If not, it inserts a new row with `status = 'in_progress'` and returns it.

The returned `sessionId` (a UUID) is stored in hook state and used as the foreign key for all subsequent writes to `intake_answers`. If this call fails — network error, RLS block, etc. — the hook sets `isHydrating = false` and falls back to local-only operation: the form works but no per-question answers are persisted until the session is established.

### FormState hydration on mount

Once `sessionId` is set, the hook queries `intake_answers` for all rows matching that session:

```
supabase.from('intake_answers')
  .select('question_id, answer, section_id')
  .eq('session_id', sessionId)
```

Each returned row is matched against `keyof FormState` (the guard is `qid in initialForm`). Unknown `question_id` values are skipped with a `console.warn`. Known fields are applied as a patch to the form state via `setForm(prev => ({ ...prev, ...patch }))`. The `resumeSection` value is computed as the highest `parseInt(section_id)` seen across all returned rows.

After hydration completes, `IntakeForm.tsx` has a `useEffect` that jumps the section cursor to `resumeSection` if it exceeds the initial cursor from `existing?.completed_sections`. This means: if a user answered questions in Section 4 in a previous session, the form will re-open at Section 4.

What is **not** restored: `gi_timing`, `energy_low_times`, and other `string[]` fields that were added to `initialState()` with hardcoded `[]` defaults rather than reading from the hydration patch. This is because `initialState` uses specific extractor functions (`arr`, `str`, `num`, `bol`) that read from `existing` (the legacy `intake_responses` row), not from the per-question answers. In practice, string arrays saved via `setAnswer` will hydrate correctly because the hydration patch covers them. The gap is that `initialState` is populated from the legacy row while hydration is in flight — there is a brief window where the form may show stale defaults.

### Rule evaluation

Every time `form` state changes, `IntakeForm.tsx` re-evaluates the UI branching engine:

```typescript
// IntakeForm.tsx line 1396–1400
const ruleResult = useMemo(
  () => evaluateRules(form as unknown as Record<string, unknown>, BRANCHING_RULES),
  [form],
)
```

`evaluateRules` is a pure function (no side effects, no async). It normalises the answer map, evaluates all 11 rules in `BRANCHING_RULES`, resolves exclusive conflicts by priority, and returns a `RuleEvaluation` with `{ activeSections, activeSubBranches, flags, trace }`.

The component derives `section2Branch` from `ruleResult.activeSubBranches['section2']`. This controls which sub-branch of Section 2 renders (`digestive | hormonal | energy | cognitive | general`). It also derives `isDigestive` for the Bristol Stool selector in Section 5.

### Save status indicator

When `setAnswer` is called, `useIntakeAnswers` fires `saveIntakeAnswer(supabase, input)` as a fire-and-forget promise. A pending counter tracks in-flight saves via a `useRef`. The status indicator has an 800ms debounce: the "Saving…" state only appears if a save is still in flight 800ms after it was dispatched. This prevents the indicator from flickering on fast saves.

Three states: `'idle'` (default and post-success), `'saving'` (visible after 800ms debounce), `'error'` (on catch). On error, the last failed input is stashed in `lastInput.current`. The "Retry" link in the UI calls `retryLastSave()`, which replays the stashed input. Only the most recent failed save can be retried — if multiple answers fail in sequence, only the last one is retried.

### Section navigation

**`handleNext`** (`IntakeForm.tsx` line 1253): saves the current section's data to `intake_responses` via the server action `saveIntakeSection`, then advances the section cursor. The data passed to `saveIntakeSection` comes from `getSectionData(form, section + 1, section2Branch)` — note the `+1` offset: when on section `N`, the function fetches data for case `N+1`. This is a 1-indexed numbering convention: `getSectionData(form, 1)` returns section-0 data (arrival emotion), `getSectionData(form, 2)` returns section-1 data (primary concerns), etc. This is debt; see §6.1.

**`handleSubmit`** (section 9): saves final section data to `intake_responses`, calls `completeIntake()` which marks the session complete (via `intake_responses.is_complete = true`) and fires `generateHealthSynopsis(memberId)` as a non-blocking promise. Navigation then pushes to `/dashboard/synopsis`.

### Submission and synopsis trigger

`completeIntake` (`actions.ts`) writes to `intake_responses` with `is_complete: true` and hardcoded `completed_sections: 6` — a bug; there are 9 user-facing sections (see §6.1). It then calls `generateHealthSynopsis` fire-and-forget.

`generateHealthSynopsis` reads `intake_responses`, `rootfinder_results`, `biomarker_results`, and `profiles`, builds a prompt, calls Claude via the Anthropic SDK (model `claude-opus-4-5`), and writes the result to `ai_summaries`. Critically, it reads from `intake_responses` using the **old field names** from the Sprint 16 schema (`chief_complaints`, `complaint_duration`, `diet_type`, etc.), not the field names that the current intake form writes (`primary_concerns`, `concern_duration`, `diet_description`, etc.). The degree of schema mismatch and how much useful data reaches the synopsis prompt is unknown without querying the live DB. See §6.6.

### Dual-write

The intake form currently writes answers to **two separate tables** through two separate code paths:

| Write | Code path | Table | Trigger |
|-------|-----------|-------|---------|
| Per-question, per-keystroke | `setAnswer → fireSave → saveIntakeAnswer` | `intake_answers` | Every field change (onChange for structured inputs; onBlur for textareas) |
| Per-section blob | `handleNext → saveIntakeSection` | `intake_responses` | Section boundary (user clicks Next) |

`useIntakeAnswers.ts` line 184 contains the TODO marking the intended migration:

```typescript
// TODO(post-16.2): drop dual-write to legacy intake_responses once the
// synopsis pipeline reads exclusively from intake_answers.
```

The dual-write is incomplete: `saveIntakeSection` fires at section boundaries, but the synopsis pipeline (`generateHealthSynopsis`) reads exclusively from `intake_responses`. Until the synopsis is rewritten to read from `intake_answers`, the legacy write path cannot be removed.

### Sequence diagram

```
User input (onChange / onBlur)
  │
  ▼
setAnswer(questionId, value, sectionNumber, meta?)
  │
  ├─► setForm(prev => ({ ...prev, [questionId]: value }))   ← optimistic, synchronous
  │                                                           re-renders form immediately
  │
  └─► fireSave(input)                                        ← async, fire-and-forget
        │
        ├─► saveIntakeAnswer(supabase, input)
        │     └─► UPSERT intake_answers ON CONFLICT(session_id, question_id)
        │
        └─► pendingCount tracking → setSaveStatus('saving' after 800ms | 'idle' | 'error')

        [After write completes or fails]
        └─► form.* re-read by useMemo → evaluateRules(form, BRANCHING_RULES)
              └─► RuleEvaluation → section2Branch → render Section 2 sub-branch

User clicks "Next"
  │
  ▼
handleNext()
  └─► saveIntakeSection(getSectionData(form, section+1, ...), section+1)   ← server action
        └─► UPSERT intake_responses (legacy blob, old field names)
  └─► setSection(s => s + 1)

User reaches Section 9, checks consent, clicks "Generate"
  │
  ▼
handleSubmit()
  └─► saveIntakeSection(section 9 data, 9)
  └─► completeIntake({ consent_to_ai_analysis: true, ... })
        └─► UPDATE intake_responses SET is_complete = true
        └─► generateHealthSynopsis(memberId)  ← fire-and-forget
              └─► SELECT intake_responses WHERE is_complete = true
              └─► SELECT rootfinder_results, biomarker_results, profiles
              └─► Anthropic claude-opus-4-5 API call
              └─► INSERT ai_summaries
  └─► router.push('/dashboard/synopsis')
```

---

## 2. Current sections, fields, and components

The form has 10 sections (numbered 0–9). Section 0 is the arrival screen, Section 9 is the consent and complete screen. The `JOURNEY_NODES` labels are: Arrival, Your story, Deeper dive, Timeline, Daily life, Medical, Mind, Goals, Readiness, Complete.

**Sprint 16.3 Tier 1 additions are marked ★.**

---

### Section 0 — Arrival

**Purpose:** Establish emotional tone and context before clinical questions begin.  
**Conditional rendering:** Always shown first.  
**Adaptive branches:** None.

| questionId | Prompt (truncated 60 chars) | Component | FormState type | section_id | mappedSystems |
|---|---|---|---|---|---|
| `arrival_emotion` | How are you feeling arriving here today? | EmojiCardGrid (single-select, 5 options) | `string` | `'0'` | — |

---

### Section 1 — Your story

**Purpose:** Capture the member's primary concerns, duration, symptom pattern, and baseline severity.  
**Conditional rendering:** Always shown.  
**Adaptive branches:** None. Answers here feed `primary_concerns` into rule evaluation, which determines the Section 2 sub-branch.

| questionId | Prompt (truncated 60 chars) | Component | FormState type | section_id | mappedSystems |
|---|---|---|---|---|---|
| `primary_concerns` | What's been on your mind most lately? | BigChipCloud (multi) | `string[]` | `'1'` | — |
| `concern_duration` | How long has this been going on? | EmojiCardGrid (single) | `string` | `'1'` | — |
| `symptom_pattern` | How does it tend to show up? | WordChipRow (single) | `string` | `'1'` | — |
| `concern_severity_baseline` ★ | How much is this affecting your daily life? | IntakeVisualScale (1–10) | `number \| null` | `'1'` | — |
| `aggravating_factors` ★ | Is there anything that tends to make this worse? | WarmTextarea (onBlur persist) | `string` | `'1'` | — |
| `relieving_factors` ★ | Is there anything that tends to help or ease it? | WarmTextarea (onBlur persist) | `string` | `'1'` | — |

`concern_severity_baseline` is independent of per-system severity scores (`gi_severity`, `energy_severity`). It must never be averaged or merged with those. It reflects global daily-life impact, not symptom intensity.

---

### Section 2 — Deeper dive

**Purpose:** Gather system-specific detail based on the member's primary concerns.  
**Conditional rendering:** Always shown.  
**Adaptive branches:** `evaluateRules` determines which sub-branch renders. Exactly one of five branches is shown at a time (exclusive priority resolution):

| Sub-branch | Rule | Priority | Trigger needles |
|---|---|---|---|
| `digestive` | `sb_digestive` | 40 | bloat, digest, gut, bowel, constipat, diarrh, reflux, heartburn, colon, stomach, tum, nausea, abdomen |
| `hormonal` | `sb_hormonal` | 30 | hormonal, pcos, oestrogen, estrogen, progesterone, menstrual, menopause, perimenopause, endometriosis, thyroid, period, cycle issue |
| `energy` | `sb_energy` | 20 | tired, fatigue, exhaust, energy, wired but tired, crashing |
| `cognitive` | `sb_cognitive` | 10 | brain fog, focus, memory, concentrat, foggy, sluggish thinking |
| `general` | *(fallback)* | — | No matching concerns |

When multiple concerns match multiple sub-branches, the highest-priority rule wins. For example, a member selecting both "Digestive issues" and "Always tired" gets the digestive sub-branch.

**Sub-branch: digestive**

| questionId | Prompt | Component | FormState type | section_id | mappedSystems |
|---|---|---|---|---|---|
| `gi_bloating` | Do you experience bloating? | BooleanCards | `boolean \| null` | `'2'` | `['gastrointestinal']` |
| `gi_timing` | When does it happen? *(shown if gi_bloating = true)* | TimingSelector | `string[]` | `'2'` | `['gastrointestinal']` |
| `gi_severity` | How severe is it on a bad day? *(shown if gi_bloating = true)* | IntakeVisualScale | `number \| null` | `'2'` | `['gastrointestinal']` |
| `food_symptom_link` ★ | Do any foods seem to trigger or worsen your symptoms? | BigChipCloud (presets) + TagInput (custom) | `FoodSymptomLink` | `'2'` | `['gastrointestinal']` |
| `gi_stool_frequency` ★ | How often do you have a bowel movement? | NumberStepper (0–8, default 1) | `number \| null` | `'2'` | `['gastrointestinal']` |

`food_symptom_link` is a structured object `{ presets: string[], custom: string[] }`. It is never null. Empty arrays mean no food-symptom link noticed. Presets are stored in original case ("Gluten / wheat") for chip selection comparison; the rule engine normalises to lowercase before evaluation.

**Sub-branch: hormonal**

| questionId | Prompt | Component | FormState type | section_id | mappedSystems |
|---|---|---|---|---|---|
| `hormonal_symptoms` | Which of these do you experience? | BigChipCloud (multi) | `string[]` | `'2'` | `['hormonal']` |
| `cycle_patterns` | Do your symptoms follow a cycle pattern? | CyclePatternSelector | `string[]` | `'2'` | `['hormonal']` |
| `menstrual_status` ★ | What best describes your current menstrual status? | WordChipRow (single) | `string` | `'2'` | `['hormonal']` |
| `menstrual_cycle_length` ★ | What is your typical cycle length? *(gated)* | NumberStepper (21–45, default 28) | `number \| null` | `'2'` | `['hormonal']` |
| `menstrual_flow_heaviness` ★ | How would you describe your typical flow? *(gated)* | NamedFiveDot (Light→Flooding) | `number \| null` | `'2'` | `['hormonal']` |

`menstrual_cycle_length` and `menstrual_flow_heaviness` are gated by `showCycleQuestions`, a derived boolean: `menstrual_status !== '' && !MENSTRUAL_GATE_EXCLUDED.has(menstrual_status)`. The excluded set is `{ prefer_not_to_say, post_menopause, surgical_menopause, never_menstruated }`. This gate is computed once and referenced in both render sites (not inlined).

**Sub-branch: energy**

| questionId | Prompt | Component | FormState type | section_id | mappedSystems |
|---|---|---|---|---|---|
| `energy_low_times` | When is your energy typically lowest? | BigChipCloud (multi) | `string[]` | `'2'` | `['metabolic']` |
| `energy_curve` | Which pattern describes your energy across the day? | EnergyCurveSelector | `string` | `'2'` | `['metabolic']` |
| `energy_severity` | How severe is the fatigue on a bad day? | IntakeVisualScale | `number \| null` | `'2'` | `['metabolic']` |
| `post_exertional_worsening` ★ | Do you feel noticeably worse the day after physical or mental exertion? | BooleanCards | `boolean \| null` | `'2'` | `['metabolic']` |

If `post_exertional_worsening === true`, an AcknowledgementBanner renders inline below the cards.

**Sub-branch: cognitive**

| questionId | Prompt | Component | FormState type | section_id | mappedSystems |
|---|---|---|---|---|---|
| `hormonal_symptoms` | *(reused as cognitive_symptoms — known tech debt)* | BigChipCloud (multi) | `string[]` | `'2'` | `['neurological']` |

This sub-branch uses `form.hormonal_symptoms` as its store for cognitive symptoms. There is no separate `cognitive_symptoms` field in FormState. This is a naming collision that will cause data confusion if a member lands in both the hormonal and cognitive branches across separate sessions (the field would reflect whichever branch was last shown). See §6.2.

**Sub-branch: general**

| questionId | Prompt | Component | FormState type | section_id | mappedSystems |
|---|---|---|---|---|---|
| `systems_reviewed` | Which body systems feel most affected? | BigChipCloud (multi) | `string[]` | `'2'` | — |

---

### Section 3 — Timeline

**Purpose:** Establish when the member last felt well and any possible trigger events.  
**Conditional rendering:** Always shown.

| questionId | Prompt | Component | FormState type | section_id | mappedSystems |
|---|---|---|---|---|---|
| `timeline_last_well` | When did you last feel genuinely well? | EmojiCardGrid (single, 5 options) | `string` | `'3'` | — |
| `timeline_trigger` | What was happening around then? | WarmTextarea (onBlur persist) | `string` | `'3'` | — |

---

### Section 4 — Daily life

**Purpose:** Capture lifestyle baseline: sleep, stress, energy, exercise, diet, and substance intake.  
**Conditional rendering:** Always shown.

| questionId | Prompt | Component | FormState type | section_id | mappedSystems |
|---|---|---|---|---|---|
| `sleep_hours` | How much sleep do you get? | NumberStepper (0–12, default 7) | `number \| null` | `'4'` | — |
| `sleep_quality` | How would you rate the quality of that sleep? | NamedFiveDot (Terrible→Excellent) | `number \| null` | `'4'` | — |
| `stress_level` | What is your typical stress level? | NamedFiveDot (Very low→Very high) | `number \| null` | `'4'` | — |
| `energy_level` | How would you rate your day-to-day energy? | NamedFiveDot (Depleted→Excellent) | `number \| null` | `'4'` | — |
| `exercise_frequency` | How often do you exercise? | EmojiCardGrid (single) | `string` | `'4'` | — |
| `diet_description` | What best describes your diet? | BigChipCloud (single) | `string` | `'4'` | — |
| `caffeine_intake` ★ | How much caffeine do you typically have? | WordChipRow (single: none/low/moderate/high) | `string` | `'4'` | — |
| `alcohol_intake` ★ | How much alcohol do you typically have? | WordChipRow (single: none/low/moderate/high) | `string` | `'4'` | — |

`caffeine_intake` and `alcohol_intake` store one of four enum values: `'none' | 'low' | 'moderate' | 'high'`. Empty string means unanswered.

---

### Section 5 — Medical

**Purpose:** Capture medical history, current medications, supplements, practitioners, and family history.  
**Conditional rendering:** Always shown. The Bristol Stool selector (`gi_stool_type`) is conditionally rendered only when `isDigestive` (i.e., Section 2 is in the digestive branch).

| questionId | Prompt | Component | FormState type | section_id | mappedSystems |
|---|---|---|---|---|---|
| `diagnosed_conditions` | Any existing diagnoses or conditions? | TagInput + preset chips | `string[]` | `'5'` | — |
| `current_medications` | Current medications | WarmTextarea (onBlur persist) | `string` | `'5'` | — |
| `current_supplements` | Current supplements | TagInput + preset chips | `string` (comma-joined) | `'5'` | — |
| `practitioner_types` | Practitioners you've worked with | BigChipCloud (multi) | `string[]` | `'5'` | — |
| `past_treatments` | Treatments or approaches you've tried | WarmTextarea (onBlur persist) | `string` | `'5'` | — |
| `family_history` | Family health history | BigChipCloud (multi) | `string[]` | `'5'` | — |
| `gi_stool_type` | Bowel pattern — which type most resembles yours? *(digestive only)* | BristolStoolSelector | `number \| null` | `'5'` | `['gastrointestinal']` |

`current_supplements` is stored as a comma-joined string in FormState but displayed and edited as a tag list. This inconsistency is tech debt.

---

### Section 6 — Mind & emotion

**Purpose:** Psychosocial context — impact, worry, and perceived support.  
**Conditional rendering:** Always shown. Framed as entirely optional.

| questionId | Prompt | Component | FormState type | section_id | mappedSystems |
|---|---|---|---|---|---|
| `psychosocial_impact` | How has this affected your daily life? | WarmTextarea (onBlur persist) | `string` | `'6'` | — |
| `psychosocial_worry` | What worries you most about your health right now? | WarmTextarea (onBlur persist) | `string` | `'6'` | — |
| `psychosocial_supported` | Do you feel supported? | EmojiCardGrid (single, 4 options) | `string` | `'6'` | — |

`psychosocial_supported` is stored as a key (`supported | mixed | not_really | alone`). The `getSectionData` for section 7 converts it to a boolean (`false` for `alone` or `not_really`, `true` otherwise, `null` if empty). This coercion lives in `getSectionData`, not in the component — another mapping debt.

---

### Section 7 — Goals

**Purpose:** Capture what the member wants to achieve and their timeline expectations.  
**Conditional rendering:** Always shown.

| questionId | Prompt | Component | FormState type | section_id | mappedSystems |
|---|---|---|---|---|---|
| `health_goals` | What do you most want to achieve? | BigChipCloud (multi) | `string[]` | `'7'` | — |
| `timeline_expectation` | What timeframe feels realistic to you? | EmojiCardGrid (single) | `string` | `'7'` | — |
| `biggest_barrier` | What has got in the way before? | WarmTextarea (onBlur persist) | `string` | `'7'` | — |

---

### Section 8 — Readiness

**Purpose:** Assess the member's capacity for engagement: time, budget, and motivation to change.  
**Conditional rendering:** Always shown.

| questionId | Prompt | Component | FormState type | section_id | mappedSystems |
|---|---|---|---|---|---|
| `readiness_time` | How much time could you realistically invest? | EmojiCardGrid (single) | `string` | `'8'` | — |
| `readiness_budget` | How would you describe your health budget? | EmojiCardGrid (single) | `string` | `'8'` | — |
| `readiness_change` | How ready do you feel to make changes? | EmojiCardGrid (single) | `string` | `'8'` | — |

---

### Section 9 — Consent & complete

**Purpose:** Obtain explicit AI analysis consent and trigger synopsis generation.  
**Conditional rendering:** Always shown last. No clinical questions — consent checkbox only.

No `questionId` fields. Local state only: `consent: boolean`. On submit, consent metadata is written to `intake_responses.consent_to_ai_analysis` and `intake_responses.consent_given_at`.

---

### Consolidated FormState (canonical schema reference)

`apps/web/app/dashboard/intake/types.ts`

```typescript
export interface FoodSymptomLink {
  presets: string[]  // preset chips, original case, e.g. "Gluten / wheat"
  custom:  string[]  // free-text entries, trimmed + lowercased
}

export interface FormState {
  // ── alphabetical ─────────────────────────────────────────────────
  aggravating_factors:       string                // ★ Sprint 16.3 Tier 1
  alcohol_intake:            string                // ★ Sprint 16.3 Tier 1 — enum 'none'|'low'|'moderate'|'high'; ''=unanswered
  arrival_emotion:           string
  biggest_barrier:           string
  caffeine_intake:           string                // ★ Sprint 16.3 Tier 1 — enum 'none'|'low'|'moderate'|'high'
  concern_duration:          string
  concern_severity_baseline: number | null         // ★ Sprint 16.3 Tier 1 — global impact, NOT per-system severity
  current_medications:       string
  current_supplements:       string                // comma-joined; displayed as tag list
  cycle_patterns:            string[]
  diagnosed_conditions:      string[]
  diet_description:          string
  energy_curve:              string
  energy_level:              number | null
  energy_low_times:          string[]
  energy_severity:           number | null
  exercise_frequency:        string
  family_history:            string[]
  food_symptom_link:         FoodSymptomLink       // ★ Sprint 16.3 Tier 1 — never null; {} = no link
  gi_bloating:               boolean | null
  gi_severity:               number | null
  gi_stool_frequency:        number | null         // ★ Sprint 16.3 Tier 1
  gi_stool_type:             number | null         // Bristol type 1–7
  gi_timing:                 string[]
  health_goals:              string[]
  hormonal_symptoms:         string[]              // ⚠ reused for cognitive symptoms in cognitive branch
  menstrual_cycle_length:    number | null         // ★ Sprint 16.3 Tier 1 — gated by showCycleQuestions
  menstrual_flow_heaviness:  number | null         // ★ Sprint 16.3 Tier 1 — gated by showCycleQuestions
  menstrual_status:          string                // ★ Sprint 16.3 Tier 1 — 8 options
  past_treatments:           string
  post_exertional_worsening: boolean | null        // ★ Sprint 16.3 Tier 1
  practitioner_types:        string[]
  primary_concerns:          string[]
  psychosocial_impact:       string
  psychosocial_supported:    string
  psychosocial_worry:        string
  readiness_budget:          string
  readiness_change:          string
  readiness_time:            string
  relieving_factors:         string                // ★ Sprint 16.3 Tier 1
  sleep_hours:               number | null
  sleep_quality:             number | null
  stress_level:              number | null
  surgeries_or_injuries:     string
  symptom_pattern:           string
  systems_reviewed:          string[]
  timeline_expectation:      string
  timeline_last_well:        string
  timeline_trigger:          string
}
// Total fields: 48 (11 added in Sprint 16.3 Tier 1)
```

---

## 3. Storage layer

### `intake_sessions`

**Status:** Active — written and read.  
**Purpose:** One row per intake attempt. Links all per-question answers via `session_id`. Supports the "completed session → new session" flow (a member who finishes and restarts gets a new `in_progress` session, leaving the old one as `completed`).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `member_id` | uuid FK → `profiles.id` | NOT NULL |
| `status` | text | `'in_progress' \| 'completed'` |
| `current_section` | text | null — populated by `questionBank.ts` flow (not current main flow) |
| `visible_question_ids` | text[] | null — scaffolded for question-bank renderer |
| `answered_question_ids` | text[] | null — scaffolded for question-bank renderer |
| `completion_percentage` | numeric | null — not computed by current code |
| `red_flag_count` | numeric | null — not computed by current code |
| `primary_system` | text | null — not written by current code |
| `arrival_emotion` | text | null — not written by current code |
| `started_at` | timestamptz | null |
| `completed_at` | timestamptz | null — not set on completion |
| `created_at` | timestamptz | default `now()` |
| `updated_at` | timestamptz | managed by `handle_updated_at` trigger |

**RLS:** Members can read and write only their own rows (`member_id = auth.uid()`). Service-role bypasses RLS (used in smoke tests).

**Indexes:** Primary key on `id`. Likely an index on `(member_id, status)` — not confirmed from source; inferred from query pattern.

**Triggers:** `handle_updated_at` updates `updated_at` on every modification.

**Write paths:** `getOrCreateIntakeSession` — inserts on session creation, reads on return visit. No other code writes to this table.

**Read paths:** `getOrCreateIntakeSession` (SELECT), `useIntakeAnswers` hydration (via session bootstrap result, not a direct query on this table). Smoke tests read for validation.

**Orphaned columns:** `current_section`, `visible_question_ids`, `answered_question_ids`, `completion_percentage`, `red_flag_count`, `primary_system`, `arrival_emotion`, `completed_at` — all null in every row written by the current system. These were designed for the `questionBank.ts`-driven renderer (see §3, `intake_symptom_details`).

---

### `intake_answers`

**Status:** Active — the primary per-question answer store.  
**Purpose:** One row per (session, question). UPSERT semantics: re-answering a question updates the existing row. Supports full resume/hydration from any device. The intended long-term canonical store for all intake data.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `session_id` | uuid FK → `intake_sessions.id` | NOT NULL |
| `member_id` | uuid FK → `profiles.id` | NOT NULL — denormalised for RLS |
| `question_id` | text NOT NULL | Matches `keyof FormState` |
| `section_id` | text NOT NULL | String representation of section number (`'0'`–`'9'`) |
| `answer` | jsonb | Any value: string, number, boolean, array, object |
| `clinical_objective` | text | null — descriptive label, e.g. `'intake_severity_baseline'` |
| `mapped_systems` | text[] | null — e.g. `['gastrointestinal']` |
| `mapped_hypotheses` | text[] | null — reserved for future clinical scoring |
| `answered_at` | timestamptz | Default `now()` on insert |
| `updated_at` | timestamptz | Managed by `handle_updated_at` trigger |

**Unique constraint:** `(session_id, question_id)` — enforces one-row-per-question-per-session and enables the UPSERT.

**RLS:** Members can read and write only rows where `member_id = auth.uid()`. Unauthenticated callers see zero rows (confirmed in C4.1 smoke test: step 6).

**Triggers:** `handle_updated_at` — advances `updated_at` on every UPDATE.

**Write paths:** `saveIntakeAnswer` (browser client, called from `useIntakeAnswers.fireSave` on every field change).

**Read paths:** `useIntakeAnswers` hydration (SELECT by `session_id`). Smoke tests (SELECT for validation). The synopsis pipeline does **not** read from this table.

**Current row count:** Unknown — query `SELECT COUNT(*) FROM intake_answers` against the live DB at next access.

---

### `intake_responses` (legacy)

**Status:** Active (currently the synopsis pipeline's only intake data source) but planned for deprecation.  
**Purpose:** One row per member. A flat JSON blob written at each section boundary. Created in Sprint 16 using the original intake field naming convention. The synopsis pipeline (`generateHealthSynopsis`) reads exclusively from this table.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `member_id` | uuid FK → `profiles.id` | NOT NULL |
| `chief_complaints` | text[] | Old name — current form writes `primary_concerns` |
| `complaint_duration` | text | Old name — current form writes `concern_duration` |
| `complaint_severity` | text/int | Not written by current form at all |
| `existing_conditions` | text[] | Old name — current form writes `diagnosed_conditions` |
| `current_medications` | text | Name matches ✓ |
| `current_supplements` | text | Name matches ✓ |
| `previous_practitioners` | text[] | Old name — current form writes `practitioner_types` |
| `previous_treatments` | text | Old name — current form writes `past_treatments` |
| `diet_type` | text | Old name — current form writes `diet_description` |
| `exercise_frequency` | text | Name matches ✓ |
| `sleep_hours` | numeric | Name matches ✓ |
| `stress_level` | numeric | Name matches ✓ |
| `alcohol_frequency` | text | Old name — current form writes `alcohol_intake` (also different enum) |
| `smoking_status` | text | No corresponding field in current form |
| `energy_level` | numeric | Name matches ✓ |
| `mood_level` | numeric | No corresponding field in current form |
| `digestion_level` | numeric | No corresponding field in current form |
| `cognitive_level` | numeric | No corresponding field in current form |
| `family_history` | text | Current form writes `family_history` (text[]) — type mismatch likely |
| `health_goals` | text[] | Name matches ✓ |
| `additional_notes` | text | No corresponding field in current form |
| `consent_to_ai_analysis` | boolean | Written by `completeIntake` ✓ |
| `consent_given_at` | timestamptz | Written by `completeIntake` ✓ |
| `completed_sections` | int | Written at section boundaries; hardcoded to `6` on final submit (bug) |
| `is_complete` | boolean | Set to `true` by `completeIntake` |
| `created_at` | timestamptz | Default `now()` |
| `updated_at` | timestamptz | Managed by `handle_updated_at` trigger |

**The field-name mismatch is this system's most critical active bug.** The synopsis prompt builder in `generateHealthSynopsis` reads `chief_complaints`, `complaint_duration`, `diet_type`, `previous_practitioners`, etc. The current `saveIntakeSection` writes `primary_concerns`, `concern_duration`, `diet_description`, `practitioner_types`, etc. The columns that actually match between the two sides are: `current_medications`, `current_supplements`, `exercise_frequency`, `sleep_hours`, `stress_level`, `energy_level`, `health_goals`, `consent_to_ai_analysis`, `consent_given_at`. Everything else is likely null in the synopsis prompt. This requires immediate verification against the live DB schema to understand which columns were added to accommodate the new field names.

**RLS:** Members can read their own rows. `saveIntakeSection` uses the server Supabase client (respects auth). `generateHealthSynopsis` uses the admin client (bypasses RLS).

**Write paths:** `saveIntakeSection` (server action, called at every section boundary), `completeIntake` (server action, called on final submit).

**Read paths:** `page.tsx` server component (reads `completed_sections` for initial cursor), `generateHealthSynopsis` (reads all fields for synopsis prompt).

---

### Scaffolded tables — no current write paths

The three tables below exist in the live database schema. They are referenced in comments and type definitions in `clinicalScoringRules.ts` but have no active write path in the current codebase.

**`intake_flags`**  
Purpose: Intended to store flagged answers from the clinical scoring engine — rows corresponding to `FlagSpec` objects produced by `evaluateAnswer()` in `clinicalScoringRules.ts`. Example: a Bristol type-7 answer would produce a `flag: { severity: 'important', type: 'advise_gp', ... }` record here.  
Blocks activation: `evaluateAnswer()` is never called by any live code path. The flags it produces are returned as in-memory `RuleResult[]` objects but nothing consumes or persists them.  
Recommendation: Keep. The schema and type definitions are correct. Activation requires wiring `evaluateAnswer` into the save path (e.g., called server-side after `saveIntakeAnswer`).

**`intake_hypothesis_scores`**  
Purpose: Intended to store incremental score adjustments (`ScoreAdjustment[]`) from the clinical scoring engine — how much each answer raises or lowers the probability weight of each clinical hypothesis (e.g., `gut_dysbiosis +2`, `food_intolerance +1`). The 10 hypothesis keys are defined in `clinicalScoringRules.ts`.  
Blocks activation: Same as `intake_flags` — no code calls `evaluateAnswer` and persists its `adjustments` output.  
Recommendation: Keep. Activating it is the prerequisite for the synopsis pipeline reading from structured clinical scores rather than raw intake fields.

**`intake_symptom_details`**  
Purpose: Unclear from source. Referenced alongside `intake_flags` and `intake_hypothesis_scores` in `clinicalScoringRules.ts` comment block. No type definition, no schema in migration files, no write path, no read path.  
Recommendation: Investigate. If it was created for the `questionBank.ts`-driven renderer (which is also scaffolded and unused — see §6.2), it may be dead weight. Requires a live DB schema inspection before deciding whether to keep or drop.

---

### Storage diagram

```
browser (useIntakeAnswers hook)
  │
  ├─► getOrCreateIntakeSession(supabase, memberId)
  │     └─► SELECT/INSERT intake_sessions
  │           └─► returns sessionId
  │
  ├─► hydration: SELECT intake_answers WHERE session_id = sessionId
  │     └─► patches FormState, sets resumeSection
  │
  └─► setAnswer → fireSave → saveIntakeAnswer(supabase, input)
        └─► UPSERT intake_answers (session_id, question_id)
              [synopsis pipeline does NOT read this table]

server action (handleNext / handleSubmit)
  └─► saveIntakeSection(sectionData, sectionNumber)
        └─► SELECT/UPDATE/INSERT intake_responses (legacy blob)

server action (handleSubmit only)
  └─► completeIntake({ consent_to_ai_analysis, consent_given_at })
        └─► UPDATE intake_responses SET is_complete = true
        └─► generateHealthSynopsis(memberId) [fire-and-forget]
              └─► SELECT intake_responses WHERE is_complete = true
              └─► SELECT rootfinder_results (last 5)
              └─► SELECT biomarker_results (last 20)
              └─► SELECT profiles
              └─► Anthropic claude-opus-4-5 API call
              └─► UPDATE ai_summaries SET is_current = false (previous)
              └─► INSERT ai_summaries (new synopsis)

not connected (scaffolded):
  intake_flags             ← evaluateAnswer() result never persisted
  intake_hypothesis_scores ← ScoreAdjustment[] never persisted
  intake_symptom_details   ← no write path found
```

---

## 4. Rule engines

Two rule engines exist in the codebase. They serve different purposes, live in different packages, and are deliberately not connected to each other.

---

### Engine 1 — `evaluateRules` (UI branching)

**File:** `packages/db/src/intake/evaluateRules.ts`  
**Purpose:** Determine which form sections and sub-branches are active based on current answers. Controls rendering only — has no clinical interpretation role.

**Type schema** (from `packages/db/src/intake/types.ts`):

```typescript
type RuleOperator = 'eq' | 'in' | 'gte' | 'lte' | 'contains'
type ActivationType = 'section' | 'subBranch' | 'flag'

interface RuleCondition {
  questionId: string
  op:         RuleOperator
  value:      any
}

interface RuleActivation {
  type:    ActivationType
  target:  string
  reason?: string
}

interface Rule {
  id:        string
  when:      RuleCondition
  activates: RuleActivation
  priority:  number    // higher wins in exclusive group; spread: 40/30/20/10
  exclusive: boolean   // if true, only highest-priority rule per group activates
}

interface RuleEvaluation {
  activeSections:    string[]
  activeSubBranches: Record<string, string[]>
  flags:             string[]
  trace:             RuleTraceEntry[]
}

interface RuleTraceEntry {
  ruleId:          string
  fired:           boolean
  suppressedBy?:   string
  reason?:         string
  matchedAgainst?: any
}
```

**Evaluator signature:**
```typescript
function evaluateRules(answers: AnswerMap, rules: Rule[]): RuleEvaluation
```

**Called from:** `IntakeForm.tsx` line 1396–1400, inside a `useMemo` that re-runs on every `form` state change. This means the engine runs on every keystroke for text fields (via optimistic `setForm` in `setAnswer`). The engine is synchronous and takes negligible CPU time on 11 rules — this is not a performance concern currently.

**Output drives:** `section2Branch` (which Section 2 sub-branch renders), `isDigestive` (Bristol Stool selector visibility in Section 5), and `flags` (captured in `ruleResult.flags` but not currently surfaced to the UI beyond the dev debug overlay).

**Pure function? Side effects? Async?** Fully pure. No side effects, no async, no globals, no DOM access. The comment at the top of the file: "No DB, no async, no React, no globals — same input always yields same output."

**Current rule count: 11**

| Rule ID | Condition | Type | Priority | Exclusive |
|---|---|---|---|---|
| `sb_digestive` | `primary_concerns` contains digestive keywords | subBranch `section2/digestive` | 40 | true |
| `sb_hormonal` | `primary_concerns` contains hormonal keywords | subBranch `section2/hormonal` | 30 | true |
| `sb_energy` | `primary_concerns` contains energy keywords | subBranch `section2/energy` | 20 | true |
| `sb_cognitive` | `primary_concerns` contains cognitive keywords | subBranch `section2/cognitive` | 10 | true |
| `sb_urinary` | `primary_concerns` contains urinary keywords | subBranch `systems/urinary` | 10 | false |
| `flag_severity` | `severity_now` ≥ 8 | flag `red_flag_severity` | 40 | false |
| `flag_severity_high` ★ | `concern_severity_baseline` ≥ 8 | flag `flag_severity_high` | 40 | false |
| `flag_post_exertional_pattern` ★ | `post_exertional_worsening` = true | flag `flag_post_exertional_pattern` | 40 | false |
| `flag_menstrual_flow_high` ★ | `menstrual_flow_heaviness` ≥ 5 | flag `flag_menstrual_flow_high` | 40 | false |

Note: `flag_severity` fires on `severity_now` — a questionId that does not currently exist in `FormState`. This rule never fires in the current form. It appears to be a leftover from an earlier schema and is dead code. See §6.2.

`sb_urinary` produces `activeSubBranches['systems'] = ['urinary']`. Nothing in `IntakeForm.tsx` reads `ruleResult.activeSubBranches['systems']`. This rule fires but its output is unused. See §6.2.

---

### Engine 2 — `evaluateAnswer` (clinical scoring)

**File:** `apps/web/app/dashboard/intake/clinicalScoringRules.ts`  
**Purpose:** Map individual answers to hypothesis score adjustments and clinical flags. Designed to inform which clinical hypotheses are most likely for a given member and flag answers requiring practitioner review.

**Type schema:**

```typescript
type HypothesisKey =
  | 'gut_dysbiosis' | 'low_stomach_acid' | 'sibo' | 'food_intolerance'
  | 'blood_sugar_instability' | 'hpa_axis_stress' | 'nervous_system_dysregulation'
  | 'mitochondrial_dysfunction' | 'sex_hormone_imbalance' | 'thyroid_pattern'

type FlagSeverity = 'info' | 'important' | 'urgent'
type FlagType = 'advise_gp' | 'red_flag' | 'clinical_note'

interface ScoreAdjustment { hypothesis: HypothesisKey; delta: number }
interface FlagSpec { severity: FlagSeverity; type: FlagType; message: string; recommendedAction: string }

interface Rule {
  id: string
  questionId: string
  description: string
  matches: (answer: unknown) => boolean
  scoreAdjustments?: ScoreAdjustment[]
  flag?: FlagSpec
}

interface RuleResult {
  ruleId: string; questionId: string
  adjustments: ScoreAdjustment[]
  flag: FlagSpec | null
}
```

**Evaluator signature:**
```typescript
function evaluateAnswer(questionId: string, answer: unknown): RuleResult[]
```

**Called from:** Nowhere in the current live codebase. `evaluateAnswer` is exported but has no caller. The `RULES` array and `BODY_MAP_SYSTEM_WEIGHTS` mapping are defined but not consumed. This engine exists as a designed but unconnected component.

**Output drives:** Nothing currently. Intended to drive `intake_hypothesis_scores` and `intake_flags` writes (see §3 scaffolded tables).

**Pure function? Side effects? Async?** Fully pure. Predicate-based (`matches: (answer: unknown) => boolean`) rather than operator-based.

**Current rule count: 11**

| Rule ID | QuestionId | Condition | Drives hypotheses | Flag? |
|---|---|---|---|---|
| `bristol_type_1_2` | `gi_stool_type` | type ≤ 2 (constipation) | gut_dysbiosis +2, low_stomach_acid +1 | No |
| `bristol_type_5_6` | `gi_stool_type` | type 5–6 (loose) | gut_dysbiosis +2, sibo +1, food_intolerance +1 | No |
| `bristol_type_7_frequent` | `gi_stool_type` | type 7 (liquid) | gut_dysbiosis +3, sibo +2, food_intolerance +2 | advise_gp |
| `urine_red_brown` | `hydration_colour` | value = 'red_brown' | — | advise_gp |
| `energy_curve_afternoon_crash` | `energy_curve_pattern` | value = 'afternoon_crash' | blood_sugar_instability +3 | No |
| `energy_curve_morning_low` | `energy_curve_pattern` | value = 'morning_low' | hpa_axis_stress +3 | No |
| `energy_curve_evening_wired` | `energy_curve_pattern` | value = 'evening_wired' | hpa_axis_stress +2, nervous_system_dysregulation +2 | No |
| `energy_curve_all_day_fatigue` | `energy_curve_pattern` | value = 'all_day_fatigue' | mitochondrial_dysfunction +3 | No |
| `cycle_irregular` | `cycle_symptom_pattern` | values includes 'irregular' | thyroid_pattern +2, sex_hormone_imbalance +2 | No |
| `cycle_heavy_pre` | `cycle_symptom_pattern` | includes heavy_bleeding AND pre_period | sex_hormone_imbalance +4 | No |
| `cycle_mid_cycle` | `cycle_symptom_pattern` | includes 'mid_cycle' | sex_hormone_imbalance +2 | No |
| `timing_low_acid_pattern` | `gi_symptom_timing` | includes before_meals AND immediately_after | low_stomach_acid +2, sibo +1 | No |
| `timing_dysbiosis_pattern` | `gi_symptom_timing` | includes 1_2hrs_after or 3_4hrs_after | gut_dysbiosis +2, sibo +1 | No |

`BODY_MAP_SYSTEM_WEIGHTS` is also defined — a mapping from body region (e.g., `upper_abdomen: { digestive: 3 }`) to system weights. It was designed to be used when scoring body-map answers. Nothing reads it.

---

### How the two engines relate

The engines are deliberately separate. The file-level comment in `branchingRules.ts` states explicitly: "DO NOT mix with clinicalScoringRules.ts — different concern, different pipeline."

Engine 1 (`evaluateRules`) is a UI decision system: it runs in the browser on every answer change and determines which form sections and sub-branches appear. It is synchronous, client-side, and has no knowledge of clinical hypotheses.

Engine 2 (`evaluateAnswer`) is a clinical scoring system: it was designed to run server-side after each answer is persisted, accumulate hypothesis scores, and write clinical flags to dedicated tables. It is not yet wired into any live path.

There is no planned merge. Engine 1 will continue to control UI branching. Engine 2, when activated, would run server-side in the write path of `saveIntakeAnswer`. The contract between them: none currently, because Engine 2 has no callers. The intended contract is: Engine 1's output determines what the user sees; Engine 2's output determines what the synopsis sees (replacing the current raw-field dump from `intake_responses`).

---

### Operator support matrix

| Engine / system | Operators supported | Notes |
|---|---|---|
| `evaluateRules` (Engine 1) | `eq`, `in`, `gte`, `lte`, `contains` | `contains` works on both strings (substring) and arrays (any element contains substring) |
| `evaluateAnswer` (Engine 2) | Arbitrary predicates (`(answer: unknown) => boolean`) | No operator taxonomy; each rule is ad-hoc JavaScript |
| `questionBank.ts` `ShowIfCondition` | `includes`, `equals`, `not_equals`, `exists`, `gte`, `lte` | Used by `IntakeQuestionRenderer.tsx` which is itself unused |

**Is operator vocabulary divergence debt that needs consolidation?** Yes, but not urgently. The three operator vocabularies exist because the three systems were designed at different times and for different callers:

- Engine 1 uses a serialisable operator enum — essential because rules are data (defined in `branchingRules.ts`) and must be testable without instantiating functions.
- Engine 2 uses function predicates — a shortcut that makes rules expressive but untestable without calling them, and not serialisable to DB storage.
- `questionBank.ts` uses a string enum that partially overlaps with Engine 1 but is for a different evaluator context.

Consolidation should happen when Engine 2 is activated. The recommendation: adopt the Engine 1 operator model for Engine 2 rules to make them serialisable, DB-storable, and consistently testable. `questionBank.ts` is scaffolding that may be dropped entirely before it's ever used at scale.

---

## 5. Active flags

Flags are string identifiers emitted by `evaluateRules` into `ruleResult.flags`. They are captured in memory during form rendering and accessible via the dev debug overlay (`?debug=rules`). No flag is currently routed to a practitioner queue, displayed to the member, or written to `intake_flags`.

### Safety flags (potential red-flag patterns)

| Flag ID | Trigger | Who acts on it | Status |
|---|---|---|---|
| `red_flag_severity` | `severity_now` ≥ 8 | Nobody | **Dead rule** — `severity_now` is not a field in FormState. This flag can never fire. The rule should be removed or its `questionId` corrected. |
| `flag_severity_high` | `concern_severity_baseline` ≥ 8 | Nobody currently | Captured; no downstream consumer. Intended for practitioner routing. |
| `flag_post_exertional_pattern` | `post_exertional_worsening` = true | Nobody currently | Captured; no downstream consumer. Pattern may indicate ME/CFS or similar — requires clinical routing. |
| `flag_menstrual_flow_high` | `menstrual_flow_heaviness` ≥ 5 (Flooding) | Nobody currently | Captured; no downstream consumer. Heavy menstrual flow at this level warrants practitioner review. |

### Pattern flags (informational routing)

None currently defined. The clinical scoring engine (`evaluateAnswer`) produces flags of type `advise_gp` and `clinical_note`, but those rules are not yet connected to `evaluateRules` and are not emitted into `ruleResult.flags`.

### Scoring flags (hypothesis weight contributors)

None currently emitted by `evaluateRules`. The clinical scoring engine's `ScoreAdjustment[]` output has no live write path.

### Summary

All four currently active flags (`red_flag_severity`, `flag_severity_high`, `flag_post_exertional_pattern`, `flag_menstrual_flow_high`) are captured-but-unused. `red_flag_severity` is additionally dead (its trigger question doesn't exist). The three Tier 1 flags are intentionally captured ahead of the practitioner routing infrastructure being built.

This is not a crisis — capturing first and routing later is a reasonable sequencing. But the 60-day clock on "captured-but-unused" starts now. If practitioners are promised red-flag routing and it doesn't materialise, members with `flag_post_exertional_pattern` or `flag_menstrual_flow_high` get no benefit from those answers.

---

## 6. Remaining weaknesses

### 6.1 Storage debt

**Weakness:** `intake_responses` is the canonical source for synopsis generation, but its column names no longer match what `saveIntakeSection` writes. The intake form evolved to use `primary_concerns`, `concern_duration`, `diet_description`, etc., while the synopsis prompt builder reads `chief_complaints`, `complaint_duration`, `diet_type`, etc.  
**Risk:** The synopsis is likely receiving null for most intake fields. The AI-generated health synopsis may be producing low-quality output with incomplete data, undermining the product's core value proposition. This is unverified without querying the live DB, but the code analysis strongly suggests it.  
**Remediation:** Medium. Verify live DB schema columns. Either: (a) map column names in `getSectionData` to old schema, or (b) rewrite `generateHealthSynopsis` to read from `intake_answers` with a column-aware query — the latter is the correct long-term direction.

---

**Weakness:** `completeIntake` hardcodes `completed_sections: 6` on final submission.  
**Risk:** The field will never reflect actual completion (9 sections). Resume logic uses this field as its initial cursor — a completed member who re-opens the form will be dropped at section 6, not section 9.  
**Remediation:** Small. Change to `completed_sections: 9` (or derive from actual section count).

---

**Weakness:** The `getSectionData` offset pattern (`getSectionData(form, section + 1, ...)` called when leaving section `N`) means section data is stored under the wrong sectionNumber in `intake_responses`. Section 0's data is stored as sectionNumber 1, section 1's data as sectionNumber 2, etc.  
**Risk:** Any code that interprets `completed_sections` as a section index will be off-by-one. This already affects the `page.tsx` initial cursor computation.  
**Remediation:** Small. Fix by passing `section` (not `section + 1`) and adjusting `getSectionData` case numbering. Blocked only by migration testing caution.

---

**Weakness:** `current_supplements` is stored as a comma-joined string in `FormState` and in `intake_responses`, but rendered and edited as a tag array via `TagInput`. The conversion happens inline in Section 5's `onChange` handler.  
**Risk:** Commas in supplement names will corrupt the round-trip. The field is also inconsistent with `diagnosed_conditions` (stored as `string[]`).  
**Remediation:** Small. Change `current_supplements` to `string[]` in FormState and update the initial hydration and `getSectionData` accordingly.

---

**Weakness:** `intake_sessions` has 8 null-always columns (`current_section`, `visible_question_ids`, `answered_question_ids`, `completion_percentage`, `red_flag_count`, `primary_system`, `arrival_emotion`, `completed_at`) that were designed for a question-bank-driven renderer that was never deployed.  
**Risk:** Schema clutter; potential confusion for anyone querying the table.  
**Remediation:** Small (migration). Audit these columns, then drop them or mark with a deprecation comment.

### 6.2 Engine debt

**Weakness:** `evaluateAnswer` (Engine 2) has 11 clinical scoring rules and no caller. `intake_flags` and `intake_hypothesis_scores` have no write path. The clinical scoring layer is fully designed and tested conceptually, but contributes nothing to the running product.  
**Risk:** Clinical hypotheses are never scored. The synopsis operates without any structured clinical signal. The two scaffolded tables accumulate zero rows indefinitely.  
**Remediation:** Medium. Wire `evaluateAnswer` into the `saveIntakeAnswer` server path. Write results to `intake_hypothesis_scores` and `intake_flags`. Requires a server-side caller (Edge Function or server action wrapper).

---

**Weakness:** `flag_severity` in `BRANCHING_RULES` fires on `questionId: 'severity_now'`, which is not a field in `FormState`. This rule can never fire.  
**Risk:** None to the user; the rule is silently dead. But it occupies a slot in BRANCHING_RULES and generates confusion for anyone reading the rule set.  
**Remediation:** Small. Remove the rule or fix the `questionId` to `concern_severity_baseline` (which already has `flag_severity_high`).

---

**Weakness:** `sb_urinary` fires when `primary_concerns` contains urinary keywords, producing `activeSubBranches['systems'] = ['urinary']`. No code in `IntakeForm.tsx` reads `ruleResult.activeSubBranches['systems']`. The rule fires, is traced, but drives no UI change.  
**Risk:** Low. The rule is harmless and tests pass. But it represents logic that exists only as a trace artefact, not as a rendered UI element.  
**Remediation:** Small. Either: (a) add a urinary section to the form, or (b) document the rule as reserved and add a test asserting no section renders for it.

---

**Weakness:** The cognitive sub-branch uses `form.hormonal_symptoms` as its data store (`questionId: 'hormonal_symptoms'` is passed to `clinicalObjective: 'cognitive_assessment'`). There is no separate `cognitive_symptoms` field.  
**Risk:** A member whose concern is hormonal *and* whose second session lands in the cognitive branch will have `hormonal_symptoms` contain cognitive symptom selections. The field name is semantically wrong. Downstream scoring that keys on `mappedSystems: ['neurological']` will work, but the FormState field name is misleading.  
**Remediation:** Small. Add `cognitive_symptoms: string[]` to FormState, update Section 2 cognitive branch render site.

---

**Weakness:** Engine 2 uses function predicates (`matches: (answer: unknown) => boolean`) rather than a serialisable operator model. Rules cannot be stored in a database, diffed meaningfully, or tested without executing JavaScript.  
**Risk:** As the rule count grows, testability and auditability degrade. Rules cannot be edited by non-engineers.  
**Remediation:** Medium. Adopt the Engine 1 operator model for Engine 2 when wiring the clinical scoring path.

### 6.3 Test infrastructure debt

**Weakness:** `useIntakeAnswers.test.tsx` uses an `INITIAL_FORM` object that predates Sprint 16.3 Tier 1. The object is missing all 11 new fields (`concern_severity_baseline`, `aggravating_factors`, `relieving_factors`, `food_symptom_link`, `gi_stool_frequency`, `post_exertional_worsening`, `menstrual_status`, `menstrual_cycle_length`, `menstrual_flow_heaviness`, `caffeine_intake`, `alcohol_intake`). The web app's `tsconfig.json` excludes `*.test.tsx` files from type-checking, so this mismatch is invisible to the CI type gate.  
**Risk:** If/when RTL tests are activated, the test file will either fail to compile or produce misleading results (the hook will receive an incomplete FormState and the unknown-field guard in hydration will skip legitimate new questions).  
**Remediation:** Small. Update `INITIAL_FORM` to include all current `FormState` fields.

---

**Weakness:** The mock in `useIntakeAnswers.test.tsx` targets `@natural-intelligence/db` (`vi.mock('@natural-intelligence/db', ...)`), but the actual import in `useIntakeAnswers.ts` uses `@natural-intelligence/db/intake`. The mock will never intercept the actual import.  
**Risk:** When tests are run (requires adding `@testing-library/react` to web devDependencies), all tests that assert on `saveIntakeAnswer` call counts will silently fail — the spy records no calls.  
**Remediation:** Small. Fix the mock path.

---

**Weakness:** There is no React Testing Library configuration in `apps/web`. The `useIntakeAnswers.test.tsx` file cannot be executed. 5 `saveStatus` transition tests and 3 core hook tests are documented but unrunnable.  
**Risk:** The hook's stateful logic — debounce, retry, pending counter — has no automated test coverage. The 117 passing tests in `packages/db` cover the engine and persistence layer, not the hook.  
**Remediation:** Medium. Add `@testing-library/react`, configure vitest for the web app, fix the mock path (above), and run.

---

**Weakness:** The 8-step manual smoke test for the live Supabase DB (`scripts/smoke_c3_persistence.ts`) uses two hardcoded member UUIDs (`87f1bb3a...`, `01048cd3...`). If those profile rows are deleted, the smoke test will fail at the session insert step (FK constraint on `member_id → profiles.id`).  
**Risk:** Low day-to-day; high after a dev DB reset or profile cleanup.  
**Remediation:** Small. Replace with a test-user fixture that is created and cleaned up within the test run.

### 6.4 UX / regulatory voice debt

**Weakness:** `clinicalScoringRules.ts` contains rule `descriptions` that use clinical terminology: "Constipation pattern (Bristol types 1–2)", "Liquid stool pattern (Bristol type 7) — flags for GP review", "Low stomach acid / SIBO pattern". These descriptions are not currently surfaced in the UI, but they exist in the codebase and could be inadvertently exposed (e.g., in a debug overlay or admin panel).  
**Risk:** Regulatory. "SIBO pattern" and "Low stomach acid" are diagnostic phrasings. If surfaced to members, they could constitute diagnostic language under UK/EU health regulations.  
**Remediation:** Small. Audit all `description` fields in `clinicalScoringRules.ts` and replace with clinician-internal phrasing that is not intended for member display.

---

**Weakness:** The `IntakeQuestionRenderer.tsx` component (used by the `questionBank.ts` flow, which is itself unused) has not been audited for `ni-muted-emoji / ni-muted-emoji-active` treatment. Its emoji rendering uses raw emoji spans without the desaturation classes.  
**Risk:** Low currently (the component is never rendered). Medium if the question-bank flow is activated.  
**Remediation:** Small (when activating the component).

---

**Weakness:** The Anthropic system prompt in `generateHealthSynopsis` says "clinical health intelligence analyst" and "synthesise a member's health data". The phrase "clinical" combined with "synthesise" in an AI context may warrant legal review under the UK's Medical Devices Regulations and the EU AI Act (high-risk AI in health).  
**Risk:** Regulatory risk is not quantifiable without legal input. Not an immediate blocker.  
**Remediation:** Medium (legal review). Flag for review before scaling.

### 6.5 Sensitivity / inclusion debt

**Weakness:** Section 2's urinary sub-branch is defined in `BRANCHING_RULES` (`sb_urinary`) but is never rendered. There is no urinary section UI. Members who report urinary symptoms as their primary concern receive the `general` fallback branch (since `sb_urinary` is not exclusive and doesn't compete with the four exclusive section2 branches).  
**Risk:** Members with urinary concerns get a generic response with no specific follow-up questions.  
**Remediation:** Medium. Add a `systems/urinary` sub-branch rendering path to Section 2.

---

**Weakness:** Section 6 (Mind & emotion) is framed as "entirely optional" in copy but is always shown as a navigation step. There is no mechanism for a member to skip it without opening the section.  
**Risk:** Members who find psychosocial questions distressing have no opt-out path at the navigation level.  
**Remediation:** Small. Add a "Skip this section" button with appropriate labelling.

---

**Weakness:** The menstrual status options include `never_menstruated` as a discrete option. For non-binary members or those who have had gender-affirming care, the framing of Section 2's hormonal branch and the `menstrual_status` options may not be inclusive. There is no "not applicable" option in the hormonal symptoms chip cloud.  
**Risk:** Members may feel the form makes assumptions about their biology. Low severity currently given the option set is reasonably broad.  
**Remediation:** Small. Add "None of these" to hormonal symptoms chip cloud. Review hormonal branch copy for biology-neutral phrasing.

### 6.6 Synopsis / interpretive debt

**Weakness:** As described in §3, `generateHealthSynopsis` reads from `intake_responses` using old field names that don't match what the current intake form writes. The synopsis prompt is likely operating with most intake fields null.  
**Risk:** High. The synopsis is the product's primary output. A synopsis generated from incomplete data undermines member trust and clinical utility.  
**Remediation:** Medium. Verify live DB schema. Rewrite `generateHealthSynopsis` to read from `intake_answers` using `question_id` lookups instead of column names — this is more robust and eliminates the schema-coupling problem.

---

**Weakness:** `mapped_hypotheses` is a column in `intake_answers` with `null` in every row currently. No question's `persist()` call passes a `mappedHypotheses` value. The column exists but carries no data.  
**Risk:** Low in isolation. The clinical scoring engine will eventually need this populated. No engine currently reads it.  
**Remediation:** Small. Define `mappedHypotheses` values for questions where hypothesis mapping is known (e.g., `gi_stool_type` → `['gut_dysbiosis', 'food_intolerance']`) and populate them in `persist()` calls.

---

**Weakness:** The 10 hypothesis keys (`gut_dysbiosis`, `low_stomach_acid`, `sibo`, `food_intolerance`, `blood_sugar_instability`, `hpa_axis_stress`, `nervous_system_dysregulation`, `mitochondrial_dysfunction`, `sex_hormone_imbalance`, `thyroid_pattern`) exist as a type in `clinicalScoringRules.ts` but have no scoring weights assigned to most new Sprint 16.3 fields. Questions like `concern_severity_baseline`, `food_symptom_link`, `menstrual_flow_heaviness`, and `post_exertional_worsening` have no scoring rules in Engine 2.  
**Risk:** Medium. As the form grows, the gap between "captured" and "scored" fields widens. The synopsis receives richer input but the clinical engine doesn't benefit.  
**Remediation:** Medium. Write Engine 2 rules for Sprint 16.3 Tier 1 fields as part of the next clinical expansion sprint.

### 6.7 Practitioner workflow debt

**Weakness:** No flag is currently routed to a practitioner queue, review interface, or notification system. Three flags (`flag_severity_high`, `flag_post_exertional_pattern`, `flag_menstrual_flow_high`) fire in the UI engine and go nowhere beyond `ruleResult.flags` in memory.  
**Risk:** Members who report high severity, post-exertional worsening, or heavy menstrual flow receive no different experience than members who don't. The platform captures signals it never acts on.  
**Remediation:** Large. Requires: (a) a practitioner-facing review queue, (b) a route from flag capture to a write in `intake_flags`, (c) triage logic that determines which flags warrant which action, (d) notification infrastructure.

---

**Weakness:** The `care` app exists as a separate Next.js application in the monorepo and passes typecheck. Its purpose (presumably practitioner-facing) is unclear from the source. It has no visible intake-related routes or components beyond what comes from the shared DB package.  
**Risk:** Unknown. If `care` is intended to become the practitioner interface, it has no scaffolding for intake data display.  
**Remediation:** Requires scoping. This is an architectural conversation before any implementation.

### 6.8 Other

**Weakness:** `page.tsx` passes `existing as any` to `IntakeForm`. TypeScript's `as any` cast at line 24 suppresses the type mismatch between `intake_responses` column shape and `IntakeForm`'s `existing: Record<string, unknown>` prop. The actual type of `existing` (the legacy intake_responses row) is not declared anywhere in the web app.  
**Risk:** Low. The `existing` prop is only used in `initialState()`, which extracts fields defensively. But changes to `intake_responses` schema will not produce compile errors.  
**Remediation:** Small. Create a typed `IntakeResponseRow` interface matching the live schema and use it in `page.tsx`.

---

**Weakness:** The `questionBank.ts` file (9 questions, 3 sections) and `IntakeQuestionRenderer.tsx` (full component renderer) are neither used nor imported by `IntakeForm.tsx`. They represent a parallel, data-driven approach to form rendering that was built but never deployed. They add ~300 LOC of dead code to the web app.  
**Risk:** Low. They don't affect runtime. They do create confusion for new engineers who will wonder whether `IntakeQuestionRenderer` is the intended rendering path.  
**Remediation:** Small. Either delete them or document them clearly as the future intended architecture and mark them with a `// NOT YET INTEGRATED` header.

---

## 7. Recommended next sprint

### Sprint recommendation: Synopsis Pipeline Repair + Clinical Engine Activation

**One-line summary:** Wire `evaluateAnswer` (Engine 2) into the save path, fix the `intake_responses` schema mismatch, and make the synopsis read from structured clinical scores — turning the AI-generated output from a best-effort text dump into a data-grounded clinical narrative.

---

### Scope (5 deliverables)

1. **Verify and fix the `intake_responses` field-name mismatch.** Query the live DB schema. Map `getSectionData` output keys to the columns `generateHealthSynopsis` reads. Either update `getSectionData` to write the old column names, or update the synopsis reader. This is the minimum viable fix to make the current synopsis meaningful.

2. **Wire `evaluateAnswer` into the `saveIntakeAnswer` server path.** After each answer is persisted, call `evaluateAnswer(questionId, answer)` server-side and write `ScoreAdjustment[]` results to `intake_hypothesis_scores` and `FlagSpec` results to `intake_flags`. Requires a server-side caller — either a Supabase Edge Function triggered on `intake_answers` insert, or a server action wrapper around `saveIntakeAnswer`.

3. **Rewrite `generateHealthSynopsis` to read from `intake_answers` and `intake_hypothesis_scores`.** Replace the brittle `intake_responses` column-name query with a query that reads all `intake_answers` for the session, hydrates a structured data object, and incorporates the hypothesis scores from `intake_hypothesis_scores`. The synopsis prompt becomes richer and schema-change-resilient.

4. **Add Engine 2 rules for Sprint 16.3 Tier 1 fields.** Write clinical scoring rules for `concern_severity_baseline`, `food_symptom_link`, `post_exertional_worsening`, `menstrual_flow_heaviness`, `caffeine_intake`, `alcohol_intake`, `gi_stool_frequency`. These are captured but unscored.

5. **Route active flags to `intake_flags` and surface to practitioner.** Write the three Tier 1 flags (`flag_severity_high`, `flag_post_exertional_pattern`, `flag_menstrual_flow_high`) to `intake_flags` when they fire. Build a minimal practitioner view in the `care` app that lists flagged sessions needing review. This is a small surface, not a full practitioner workflow.

---

### Out of scope

- Tier 2 or Tier 3 CNM clinical capture (new intake questions)
- Follow-up form or `client_cases` longitudinal table
- Practitioner matching or recommendation engine
- Any changes to `evaluateRules` (Engine 1) or `BRANCHING_RULES`
- Member-facing flag display
- `questionBank.ts` / `IntakeQuestionRenderer.tsx` activation
- RTL test infrastructure setup (valid debt, but a separate setup sprint)

---

### Why this sprint, not the alternatives

**Alternative (a): Tier 2/Tier 3 CNM expansion (more clinical capture)**  
More questions extend a form that currently produces a synopsis from incomplete data. Adding Tier 2 urinary questions, cognitive depth questions, or immune system questions before fixing the synopsis pipeline means capturing more data that the AI never sees. The return on Tier 2 capture is near zero until the synopsis reads from `intake_answers`. Tier 2 comes after the pipeline is fixed.

**Alternative (b): Follow-up form + `client_cases` longitudinal table**  
The longitudinal record is the right long-term architecture. But a longitudinal table's value depends on having a reliable baseline intake record to compare against. If the baseline synopsis is generated from mismatched field names, the "before" state of the longitudinal record is unreliable. Fix the foundation before building on top of it.

**The chosen sprint addresses the most critical active bug** (synopsis field mismatch), connects the longest-standing scaffolded component (Engine 2), and produces a practitioner signal path (flag routing to `intake_flags`) that has been "captured-but-unused" since Sprint 16.3. It directly serves the strategic direction: AI-native operating system with an 80/20 AI-human split requires the AI output to be grounded in structured clinical scores, not raw field dumps.

---

### Architectural prerequisites already in place

- `intake_answers` table and UPSERT path — live and tested (117 tests, C4.1 smoke)
- `intake_hypothesis_scores` and `intake_flags` tables — scaffolded in live DB, schemas designed
- Engine 2 (`evaluateAnswer`) — fully designed, 13 rules, 10 hypothesis keys, not yet called
- `packages/db/src/intake/` barrel export — ready to export Engine 2 after activation
- `ai_summaries` table — live, `generateHealthSynopsis` already writes to it

### New architectural pieces this sprint would introduce

- Server-side Engine 2 caller (Edge Function or server action) — new component
- `intake_hypothesis_scores` write path — activating an existing table
- `intake_flags` write path — activating an existing table
- Synopsis reader that queries `intake_answers` by `question_id` — replaces raw column read
- Minimal practitioner view in `apps/care` — first functional use of the care app

---

### Risks and gates

| Gate | Stop condition |
|---|---|
| **G1** (before any code): Live DB schema audit | If `intake_responses` has been updated to include new column names, the field-mismatch bug may not exist as described. Audit first; adjust deliverable 1 scope accordingly. |
| **G2** (before wiring Engine 2): Confirm `intake_hypothesis_scores` and `intake_flags` schema against live DB | These tables were designed during Sprint 16.2. Schema drift may have occurred. Validate columns before writing. |
| **G3** (after deliverable 2): Run C4.1 smoke suite + Engine 2 unit tests | Engine 2 activation must not regress the existing 117 tests. Add Engine 2 tests before calling it activated. |
| **G4** (after deliverable 3): Side-by-side synopsis quality comparison | Generate synopsis for a test member using the old path (intake_responses column read) and the new path (intake_answers + hypothesis scores). If quality does not improve, the new read path has a bug — investigate before shipping. |
| **G5** (before practitioner view): Confirm `apps/care` auth gate and RLS for intake data | The care app currently passes typecheck but has no practitioner-specific auth flow confirmed. Do not display member data without confirming RLS isolation. |

---

### Rough effort estimate

- LOC: 200–350 new lines across server actions, Edge Function scaffold, synopsis rewrite, Engine 2 wiring
- Phase count: 4–5 phases (similar cadence to Sprint 16.3 Tier 1)
- Test additions: ~20–30 new unit tests (Engine 2 rules, synopsis query logic, flag write path)
- Migrations: 0 new tables; 1 potential column-name correction in `intake_responses` (deliverable 1)
