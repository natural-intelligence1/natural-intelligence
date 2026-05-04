# Sprint 16.3 — Tier 1 Implementation Plan

**Status:** Plan only. No code has been written.  
**Scope:** 11 atomic items across Sections 1, 2 (digestive / hormonal / energy), and 4.  
**Hard gates:** No new components · No new sections · No diagnostic wording · No EmojiCardGrid for quantification inputs.

---

## Item 1 — Section 1: Severity baseline

**One-line summary:** Capture how much the presenting concern affects daily life on a 0–10 scale.

**Target section / insertion point**  
Section 1, after `symptom_pattern` (WordChipRow). Anchor in code:
```tsx
// existing — last question in Section 1
<WordChipRow options={PATTERN_WORDS} selected={form.symptom_pattern} ... />
// ← item 1 inserts here
```

**Prompt copy**  
"How much is this affecting your daily life right now?"  
Sub-label (below scale): left anchor "Not at all" · right anchor "Completely"

**Component:** `IntakeVisualScale` (existing — already used for `gi_severity` and `energy_severity`)

**question_id:** `concern_severity_baseline`

**FormState key / type / default:** `concern_severity_baseline: number | null` / `null`

**Answer JSON shape:** `number` (0–10) · example: `7`

**clinical_objective:** `"intake_severity_baseline"`

**mapped_systems:** `[]` — cross-system; synopsis routes based on branch context

**mapped_hypotheses:** `[]` — severity is a modifier, not a hypothesis selector

**Branching / scoring rule required:**
```typescript
{
  id:        'flag_high_severity',
  when:      { questionId: 'concern_severity_baseline', op: 'gte', value: 8 },
  activates: { type: 'flag', target: 'flag_high_severity',
               reason: 'High impact on daily life reported — worth discussing with a practitioner' },
  priority:  40,
  exclusive: false,
}
```
Flag name `flag_high_severity` follows safety-flag naming. Priority 40, non-exclusive (fires additively alongside existing `flag_severity` for `severity_now`). No conflict — different questionId.

**Conditional rendering:** Always visible in Section 1.

**Acknowledgement copy:** none

**Estimated effort:**
| Category | LOC |
|---|---|
| FormState | 1 |
| Component site | 5 |
| Rules | 9 |
| Tests | 6 |
| **Total** | **21** |

---

## Item 2 — Section 1: Aggravating factors

**One-line summary:** Free-text capture of what tends to worsen the presenting concern.

**Target section / insertion point**  
Section 1, after `concern_severity_baseline` (item 1). Anchor:
```tsx
// item 1 — IntakeVisualScale for concern_severity_baseline
// ← item 2 inserts here
```

**Prompt copy**  
"Is there anything that tends to make this worse?" *(optional)*

**Component:** `WarmTextarea` (existing — `onBlur` persist pattern)

**question_id:** `aggravating_factors`

**FormState key / type / default:** `aggravating_factors: string` / `''`

**Answer JSON shape:** `string` · example: `"Worse after eating and when stressed"`

**clinical_objective:** `"aggravating_factor_capture"`

**mapped_systems:** `[]`

**mapped_hypotheses:** `[]`

**Branching / scoring rule required:** none

**Conditional rendering:** Always visible in Section 1.

**Acknowledgement copy:** none

**Estimated effort:**
| Category | LOC |
|---|---|
| FormState | 1 |
| Component site | 7 |
| Rules | 0 |
| Tests | 2 |
| **Total** | **10** |

---

## Item 3 — Section 1: Relieving factors

**One-line summary:** Free-text capture of what tends to ease the presenting concern.

**Target section / insertion point**  
Section 1, directly after `aggravating_factors` (item 2).

**Prompt copy**  
"Is there anything that tends to help or ease it?" *(optional)*

**Component:** `WarmTextarea`

**question_id:** `relieving_factors`

**FormState key / type / default:** `relieving_factors: string` / `''`

**Answer JSON shape:** `string` · example: `"Rest and avoiding wheat"`

**clinical_objective:** `"relieving_factor_capture"`

**mapped_systems:** `[]`

**mapped_hypotheses:** `[]`

**Branching / scoring rule required:** none

**Conditional rendering:** Always visible in Section 1.

**Acknowledgement copy:** none

**Estimated effort:**
| Category | LOC |
|---|---|
| FormState | 1 |
| Component site | 7 |
| Rules | 0 |
| Tests | 2 |
| **Total** | **10** |

---

## Item 4 — Section 2 digestive: Food–symptom association

**One-line summary:** Capture whether foods affect gut symptoms; if yes, which foods.

> **Note:** Item 4 requires two FormState fields (`food_symptom_link` + `food_triggers`). Both are part of a single clinical question. Counted as one atomic item because the second field only exists when the first is `true`.

**Target section / insertion point**  
Section 2 / digestive branch, after the existing bloating → timing → severity block. Anchor:
```tsx
// existing — last conditional in digestive branch
{form.gi_bloating === true && (
  <div>...<IntakeVisualScale .../></div>  // gi_severity
)}
// ← item 4 inserts here
```

**Prompt copy (part A — BooleanCards)**  
"Do you notice your symptoms changing after eating?"

Labels: Yes — "Certain foods seem to affect it" · No — "I haven't noticed a link"

**Prompt copy (part B — BigChipCloud, conditional)**  
"Which foods tend to trigger or worsen it?" *(select all that apply)*

Preset options: Gluten / wheat · Dairy · Eggs · Onion or garlic · Legumes · High-sugar foods · Spicy food · Fatty foods · Alcohol · Coffee · I'm not sure which ones

**Component (part A):** `BooleanCards` (existing)  
**Component (part B):** `BigChipCloud` with `multi={true}` (existing) — renders only when `food_symptom_link === true`

**question_id (A):** `food_symptom_link`  
**question_id (B):** `food_triggers`

**FormState:**
- `food_symptom_link: boolean | null` / `null`
- `food_triggers: string[]` / `[]`

**Answer JSON shape:**
- `food_symptom_link`: `boolean` · example: `true`
- `food_triggers`: `string[]` · example: `["Gluten / wheat", "Dairy"]`

**clinical_objective (A):** `"food_symptom_association_capture"`  
**clinical_objective (B):** `"food_trigger_capture"`

**mapped_systems:** `["gastrointestinal"]`

**mapped_hypotheses:** `["food_sensitivity_pattern", "histamine_load_pattern", "microbiome_pattern"]`  
*(internal labels only — never user-visible)*

**Branching / scoring rule required:** none — data captured for synopsis routing, no UI branching needed

**Conditional rendering:**  
- Both parts: only rendered when `section2Branch === 'digestive'`
- Part B (BigChipCloud): additionally conditional on `form.food_symptom_link === true`

**Acknowledgement copy:** none

**Estimated effort:**
| Category | LOC |
|---|---|
| FormState | 2 |
| Component site | 18 |
| Rules | 0 |
| Tests | 4 |
| **Total** | **24** |

---

## Item 5 — Section 2 digestive: Stool frequency

**One-line summary:** Direct count of typical daily bowel movements.

**Target section / insertion point**  
Section 2 / digestive, after item 4 (food–symptom block). Final question in the digestive branch.

**Prompt copy**  
"How many times a day do you typically open your bowels?"

**Component:** `NumberStepper` (existing) — `min={0}` `max={8}` `default={1}` `unit="times per day"`

**question_id:** `gi_stool_frequency`

**FormState key / type / default:** `gi_stool_frequency: number | null` / `null`

**Answer JSON shape:** `number` · example: `2`

**clinical_objective:** `"bowel_frequency_capture"`

**mapped_systems:** `["gastrointestinal"]`

**mapped_hypotheses:** `["bowel_motility_pattern", "constipation_pattern", "accelerated_transit_pattern"]`

**Branching / scoring rule required:** none

**Conditional rendering:** Only when `section2Branch === 'digestive'`

**Acknowledgement copy:** none

**Estimated effort:**
| Category | LOC |
|---|---|
| FormState | 1 |
| Component site | 5 |
| Rules | 0 |
| Tests | 2 |
| **Total** | **8** |

---

## Item 6 — Section 2 hormonal: Menstrual / hormonal status

**One-line summary:** Establish current menstrual status to gate items 7 and 8 and contextualise hormonal patterns.

> **Sensitivity note:** This question asks about physiological menstrual status, not gender identity. All options are available regardless of how the user identifies. See Sensitivity Check (Summary D).

**Target section / insertion point**  
Section 2 / hormonal branch, **before** the existing `hormonal_symptoms` BigChipCloud. Anchor:
```tsx
// existing — first question in hormonal branch
<BigChipCloud options={HORMONAL_SYMPTOMS} selected={form.hormonal_symptoms} ... />
// ← item 6 inserts before this
```

**Prompt copy**  
"Which of these best describes your current menstrual status?"

Sub-text (below prompt, italic): *This question is optional — selecting 'Prefer not to say' will skip the next two questions.*

**Component:** `WordChipRow` (existing) — single-select with separate key/label pairs

Options (key → display label):
| Key | Label |
|-----|-------|
| `regular_cycles` | Regular cycles |
| `irregular_cycles` | Irregular cycles |
| `perimenopause` | Perimenopause |
| `post_menopause` | Post-menopause |
| `surgical_menopause` | Surgical menopause |
| `hormonal_contraception` | On hormonal contraception |
| `never_menstruated` | Have never menstruated |
| `prefer_not_to_say` | Prefer not to say |

**question_id:** `menstrual_status`

**FormState key / type / default:** `menstrual_status: string` / `''`

**Answer JSON shape:** `string` (one of the keys above) · example: `"irregular_cycles"`

**clinical_objective:** `"menstrual_status_capture"`

**mapped_systems:** `["endocrine", "reproductive"]`

**mapped_hypotheses:** `["hormonal_pattern", "perimenopause_pattern", "cycle_regularity_pattern"]`

**Branching / scoring rule required:** none — gating of items 7+8 is handled by JSX conditional rendering on `form.menstrual_status`, not by the rule engine

**Conditional rendering:** Only when `section2Branch === 'hormonal'`

**Acknowledgement copy:** none

**Estimated effort:**
| Category | LOC |
|---|---|
| FormState | 1 |
| Component site | 14 |
| Rules | 0 |
| Tests | 4 |
| **Total** | **19** |

---

## Item 7 — Section 2 hormonal: Cycle length

**One-line summary:** Capture typical cycle length in days.

**Target section / insertion point**  
Section 2 / hormonal, after `menstrual_status` (item 6) and before the existing `hormonal_symptoms` block.

**Prompt copy**  
"How long is your typical cycle, from the first day of one period to the first day of the next?"

**Component:** `NumberStepper` — `min={14}` `max={60}` `default={28}` `unit="days"`

**question_id:** `cycle_length_days`

**FormState key / type / default:** `cycle_length_days: number | null` / `null`

**Answer JSON shape:** `number` · example: `28`

**clinical_objective:** `"menstrual_cycle_length_capture"`

**mapped_systems:** `["endocrine", "reproductive"]`

**mapped_hypotheses:** `["cycle_length_pattern", "anovulation_pattern", "short_cycle_pattern"]`

**Branching / scoring rule required:** none

**Conditional rendering:**  
Only when `section2Branch === 'hormonal'` **AND** `menstrual_status` is not one of: `['post_menopause', 'surgical_menopause', 'prefer_not_to_say', 'never_menstruated', '']`

Rendered for: `regular_cycles`, `irregular_cycles`, `perimenopause`, `hormonal_contraception`

**Acknowledgement copy:** none

**Estimated effort:**
| Category | LOC |
|---|---|
| FormState | 1 |
| Component site | 9 |
| Rules | 0 |
| Tests | 3 |
| **Total** | **13** |

---

## Item 8 — Section 2 hormonal: Flow heaviness

**One-line summary:** 5-point scale for menstrual flow, with a practitioner-review flag at maximum.

**Target section / insertion point**  
Section 2 / hormonal, after `cycle_length_days` (item 7) and before the existing `hormonal_symptoms` block. Same conditional gate as item 7.

**Prompt copy**  
"How would you describe your flow on your heaviest day?"

**Component:** `NamedFiveDot` (existing) — `labels={['Very light', 'Light', 'Moderate', 'Heavy', 'Very heavy']}` — `value={form.menstrual_flow_heaviness}`

**question_id:** `menstrual_flow_heaviness`

**FormState key / type / default:** `menstrual_flow_heaviness: number | null` / `null`

**Answer JSON shape:** `number` (1–5) · example: `4`

**clinical_objective:** `"menstrual_flow_capture"`

**mapped_systems:** `["endocrine", "reproductive"]`

**mapped_hypotheses:** `["heavy_flow_pattern", "progesterone_pattern", "uterine_pattern"]`

**Branching / scoring rule required:**
```typescript
{
  id:        'flag_flow_review',
  when:      { questionId: 'menstrual_flow_heaviness', op: 'gte', value: 5 },
  activates: { type: 'flag', target: 'flag_flow_review',
               reason: 'Very heavy flow reported — worth discussing with a practitioner' },
  priority:  40,
  exclusive: false,
}
```
Flag fires only at score 5 ("Very heavy") since `max=5` and `gte:5` is equivalent to `eq:5`.

**Conditional rendering:** Identical gate to item 7 — same `menstrual_status` exclusions apply.

**Acknowledgement copy:** none

**Estimated effort:**
| Category | LOC |
|---|---|
| FormState | 1 |
| Component site | 9 |
| Rules | 9 |
| Tests | 4 |
| **Total** | **23** |

---

## Item 9 — Section 2 energy: Post-exertional worsening

**One-line summary:** Binary question capturing whether physical activity causes disproportionate next-day worsening, with a practitioner-review flag and acknowledgement.

**Target section / insertion point**  
Section 2 / energy, after the existing `energy_severity` IntakeVisualScale. Final question in the energy branch. Anchor:
```tsx
// existing — last question in energy branch
<IntakeVisualScale value={form.energy_severity} ... />
// ← item 9 inserts here
```

**Prompt copy**  
"Do you tend to feel significantly worse the day after physical activity?"

Labels (BooleanCards):
- Yes — "Yes, often" · sub: "I struggle to recover after exertion"  
- No — "No" · sub: "I recover within a day as expected"

**Component:** `BooleanCards` (existing)

**question_id:** `post_exertional_worsening`

**FormState key / type / default:** `post_exertional_worsening: boolean | null` / `null`

**Answer JSON shape:** `boolean` · example: `true`

**clinical_objective:** `"post_exertion_pattern_capture"`

**mapped_systems:** `["nervous", "immune", "metabolic"]`

**mapped_hypotheses:** `["pem_pattern", "deconditioning_pattern", "autonomic_pattern"]`  
*(All internal labels — never user-visible. "pem_pattern" is a hypothesis label, not a diagnosis.)*

**Branching / scoring rule required:**
```typescript
{
  id:        'flag_post_exertion_review',
  when:      { questionId: 'post_exertional_worsening', op: 'eq', value: true },
  activates: { type: 'flag', target: 'flag_post_exertion_review',
               reason: 'Post-exertional worsening pattern reported — worth discussing with a practitioner' },
  priority:  40,
  exclusive: false,
}
```

**Conditional rendering:** Only when `section2Branch === 'energy'`

**Acknowledgement copy:**  
Renders immediately below the BooleanCards when `form.post_exertional_worsening === true`:

> "Thank you — that's worth capturing. This pattern is one your practitioner will want to explore with you."

*(AcknowledgementBanner component, existing styling)*

**Estimated effort:**
| Category | LOC |
|---|---|
| FormState | 1 |
| Component site | 14 |
| Rules | 9 |
| Tests | 4 |
| **Total** | **28** |

---

## Item 10 — Section 4: Caffeine intake

**One-line summary:** Ordinal categorical capture of daily caffeinated drink consumption.

**Target section / insertion point**  
Section 4, after the existing `diet_description` BigChipCloud. Anchor:
```tsx
// existing — last question in Section 4
<BigChipCloud options={DIET_OPTIONS} selected={...} multi={false} ... />
// ← item 10 inserts here
```

**Prompt copy**  
"How many caffeinated drinks do you have on a typical day?"

**Component:** `WordChipRow` (existing) — NOT EmojiCardGrid

Options (key → label):
| Key | Label |
|-----|-------|
| `none` | None |
| `1_2` | 1–2 |
| `3_4` | 3–4 |
| `5_plus` | 5 or more |

**question_id:** `caffeine_intake`

**FormState key / type / default:** `caffeine_intake: string` / `''`

**Answer JSON shape:** `string` · example: `"3_4"`

**clinical_objective:** `"caffeine_intake_capture"`

**mapped_systems:** `["nervous", "endocrine", "cardiovascular"]`

**mapped_hypotheses:** `["adrenal_load_pattern", "sleep_disruption_pattern"]`

**Branching / scoring rule required:** none

**Conditional rendering:** Always visible in Section 4.

**Acknowledgement copy:** none

**Estimated effort:**
| Category | LOC |
|---|---|
| FormState | 1 |
| Component site | 6 |
| Rules | 0 |
| Tests | 2 |
| **Total** | **9** |

---

## Item 11 — Section 4: Alcohol intake

**One-line summary:** Ordinal categorical capture of weekly alcohol consumption.

**Target section / insertion point**  
Section 4, directly after `caffeine_intake` (item 10).

**Prompt copy**  
"How many alcoholic drinks do you have in a typical week?"

**Component:** `WordChipRow` (existing) — NOT EmojiCardGrid

Options (key → label):
| Key | Label |
|-----|-------|
| `none` | None |
| `1_7` | 1–7 |
| `8_14` | 8–14 |
| `15_plus` | 15 or more |

**question_id:** `alcohol_intake`

**FormState key / type / default:** `alcohol_intake: string` / `''`

**Answer JSON shape:** `string` · example: `"1_7"`

**clinical_objective:** `"alcohol_intake_capture"`

**mapped_systems:** `["hepatic", "gastrointestinal", "endocrine"]`

**mapped_hypotheses:** `["liver_load_pattern", "hormonal_disruptor_pattern", "gut_microbiome_pattern"]`

**Branching / scoring rule required:** none

**Conditional rendering:** Always visible in Section 4.

**Acknowledgement copy:** none

**Estimated effort:**
| Category | LOC |
|---|---|
| FormState | 1 |
| Component site | 6 |
| Rules | 0 |
| Tests | 2 |
| **Total** | **9** |

---

## FormState mapping table

Canonical source of truth for the FormState patch in Phase 3.

| question_id | FormState key | TypeScript type | Default value |
|---|---|---|---|
| `concern_severity_baseline` | `concern_severity_baseline` | `number \| null` | `null` |
| `aggravating_factors` | `aggravating_factors` | `string` | `''` |
| `relieving_factors` | `relieving_factors` | `string` | `''` |
| `food_symptom_link` | `food_symptom_link` | `boolean \| null` | `null` |
| `food_triggers` | `food_triggers` | `string[]` | `[]` |
| `gi_stool_frequency` | `gi_stool_frequency` | `number \| null` | `null` |
| `menstrual_status` | `menstrual_status` | `string` | `''` |
| `cycle_length_days` | `cycle_length_days` | `number \| null` | `null` |
| `menstrual_flow_heaviness` | `menstrual_flow_heaviness` | `number \| null` | `null` |
| `post_exertional_worsening` | `post_exertional_worsening` | `boolean \| null` | `null` |
| `caffeine_intake` | `caffeine_intake` | `string` | `''` |
| `alcohol_intake` | `alcohol_intake` | `string` | `''` |

**Note:** Item 4 introduces two FormState fields (11 items → 12 new fields). The secondary field `food_triggers` is conditional on `food_symptom_link === true` and shares item 4's clinical context.

---

## Summary A — Combined effort estimate

| Item | FormState | Component | Rules | Tests | Total |
|---|---|---|---|---|---|
| 1 Severity baseline | 1 | 5 | 9 | 6 | 21 |
| 2 Aggravating | 1 | 7 | 0 | 2 | 10 |
| 3 Relieving | 1 | 7 | 0 | 2 | 10 |
| 4 Food–symptom | 2 | 18 | 0 | 4 | 24 |
| 5 Stool frequency | 1 | 5 | 0 | 2 | 8 |
| 6 Menstrual status | 1 | 14 | 0 | 4 | 19 |
| 7 Cycle length | 1 | 9 | 0 | 3 | 13 |
| 8 Flow heaviness | 1 | 9 | 9 | 4 | 23 |
| 9 Post-exertional | 1 | 14 | 9 | 4 | 28 |
| 10 Caffeine | 1 | 6 | 0 | 2 | 9 |
| 11 Alcohol | 1 | 6 | 0 | 2 | 9 |
| **Totals** | **11** | **100** | **27** | **35** | **174** |

**174 LOC total — well under the 800 LOC ceiling. ✓**  
Single commit is acceptable (≤ 400 LOC), but see Summary E for recommended split.

---

## Summary B — Rules inventory

Three new rules. All non-exclusive (fire additively; priority irrelevant for conflict resolution but maintained for documentation consistency).

| Rule ID | questionId | Op | Value | Flag target | Priority | Exclusive |
|---|---|---|---|---|---|---|
| `flag_high_severity` | `concern_severity_baseline` | `gte` | `8` | `flag_high_severity` | 40 | false |
| `flag_flow_review` | `menstrual_flow_heaviness` | `gte` | `5` | `flag_flow_review` | 40 | false |
| `flag_post_exertion_review` | `post_exertional_worsening` | `eq` | `true` | `flag_post_exertion_review` | 40 | false |

**Priority spread check:**

| Priority | Existing rules | New rules |
|---|---|---|
| 40 | `sb_digestive` (excl), `flag_severity` (non-excl) | `flag_high_severity`, `flag_flow_review`, `flag_post_exertion_review` (all non-excl) |
| 30 | `sb_hormonal` (excl) | — |
| 20 | `sb_energy` (excl) | — |
| 10 | `sb_cognitive` (excl), `sb_urinary` (non-excl) | — |

- No exclusive rules added → no exclusive conflict possible. ✓
- New non-exclusive rules all at p40 (safety tier), consistent with existing `flag_severity`. ✓
- Exclusive sub-branch spread (40/30/20/10) preserved untouched. ✓
- Room for future tiers: p50+ (escalation), p15 (between energy and cognitive), p25 (between hormonal and energy). ✓

---

## Summary C — Wording compliance check

Four diagnostic-language phrases from the C6 plan rationale. None appear in any user-visible or stored field in this plan.

| Original phrase (C6 plan) | Tier 1 replacement | Location |
|---|---|---|
| "IBS/SIBO differentiation" | `"microbiome_pattern"` / `"bowel_motility_pattern"` | `mapped_hypotheses` (internal) |
| "ME/CFS vs adrenal fatigue" | `"post_exertion_pattern_capture"` / `"pem_pattern"` | `clinical_objective` / `mapped_hypotheses` |
| "PCOS vs thyroid" | `"hormonal_pattern"` / `"cycle_regularity_pattern"` | `mapped_hypotheses` |
| "GAD/depression" | out of scope for Tier 1 | n/a |

**Additional phrases reviewed and confirmed absent from user-visible / stored text:**

| Category | Confirmed absent |
|---|---|
| Rule `reason` strings | No disease names in any reason string |
| `clinical_objective` values | No "screen", "diagnose", "detect", or condition names |
| Prompt copy | No disease names in any prompt |
| Acknowledgement copy | "worth exploring with a practitioner" / "worth discussing with a practitioner" — pattern-language only |
| `mapped_hypotheses` | Contains internal pattern labels ("pem_pattern", "heavy_flow_pattern") — internal field only, never user-visible |

**Wording compliance: PASS for all 11 items. ✓**

---

## Summary D — Sensitivity check (items 6, 7, 8)

**(a) Trans and non-binary users**  
The question asks about "menstrual status" — a physiological state, not gender identity. The option set includes "Have never menstruated" (covers trans men who have not menstruated, those with relevant medical history) and "Prefer not to say" (universal escape). No gender is assumed, inferred, or required. ✓

**(b) Prefer-not-to-say gating**  
`prefer_not_to_say` is a valid option in item 6. When selected:
- Item 7 (cycle length): **not rendered** — JSX gate: `!['post_menopause', 'surgical_menopause', 'prefer_not_to_say', 'never_menstruated', ''].includes(form.menstrual_status)`
- Item 8 (flow heaviness): **not rendered** — same gate
- No data stored for items 7 and 8 if not rendered ✓

**(c) Post-menopausal and surgical-menopause gating**  
Both `post_menopause` and `surgical_menopause` are in the exclusion list for items 7 and 8. Neither cycle length nor flow heaviness is rendered for these statuses. ✓

**(d) No automatic gender inference**  
`menstrual_status` is explicitly asked and stored from user input only. No other FormState field, branching rule, or UI logic infers or assigns `menstrual_status` from any other answer (name, age, primary_concerns, etc.). ✓

**Additional gate: `never_menstruated`**  
Also excluded from items 7+8 (no cycle to report). Not required by the spec but clinically essential and included.

**Full gate condition for items 7 and 8 in JSX:**
```tsx
const showCycleQuestions =
  form.menstrual_status !== '' &&
  !['post_menopause', 'surgical_menopause', 'prefer_not_to_say', 'never_menstruated']
    .includes(form.menstrual_status)
```

**Sensitivity check: PASS for all 4 criteria. ✓**

No item in 6/7/8 requires a new component to satisfy sensitivity rules — all constraints are satisfiable with existing components and JSX conditional logic.

---

## Summary E — Sequencing recommendation

Total LOC is 174, which is ≤ 400. A single commit is technically acceptable. However, items 6/7/8 involve sensitive clinical content (menstrual / hormonal status) that warrants a separate review gate.

**Recommendation: two commits.**

**Commit 1 — Non-hormonal items (items 1, 2, 3, 4, 5, 9, 10, 11)**

| Items | Sections | LOC |
|---|---|---|
| 1 Severity, 2 Aggravating, 3 Relieving | Section 1 | 41 |
| 4 Food–symptom, 5 Stool frequency | Section 2 / digestive | 32 |
| 9 Post-exertional | Section 2 / energy | 28 |
| 10 Caffeine, 11 Alcohol | Section 4 | 18 |
| **Total** | | **119 LOC** |

**Commit 2 — Hormonal items (items 6, 7, 8)**

| Items | Section | LOC |
|---|---|---|
| 6 Menstrual status, 7 Cycle length, 8 Flow heaviness | Section 2 / hormonal | 55 |
| **Total** | | **55 LOC** |

Rationale: Commit 2 is self-contained, can be reviewed independently with sensitivity focus, and can be reverted without affecting Commit 1.

---

## Summary F — Component grammar audit

Confirms every item uses an allowed component. Specifically confirms items 10 and 11 do NOT use EmojiCardGrid.

| Item | Component used | Category | EmojiCardGrid? |
|---|---|---|---|
| 1 Severity baseline | `IntakeVisualScale` | Severity scale | No ✓ |
| 2 Aggravating factors | `WarmTextarea` | Free text | No ✓ |
| 3 Relieving factors | `WarmTextarea` | Free text | No ✓ |
| 4a Food–symptom link | `BooleanCards` | Binary | No ✓ |
| 4b Food triggers | `BigChipCloud` | Multi-select tags | No ✓ |
| 5 Stool frequency | `NumberStepper` | Direct count | No ✓ |
| 6 Menstrual status | `WordChipRow` | Ordinal categorical | No ✓ |
| 7 Cycle length | `NumberStepper` | Direct count | No ✓ |
| 8 Flow heaviness | `NamedFiveDot` | 5-point scale | No ✓ |
| 9 Post-exertional | `BooleanCards` | Binary | No ✓ |
| **10 Caffeine intake** | **`WordChipRow`** | **Ordinal categorical** | **No ✓** |
| **11 Alcohol intake** | **`WordChipRow`** | **Ordinal categorical** | **No ✓** |

**EmojiCardGrid is not used for any behavioural quantification input. ✓**  
`WordChipRow` is used for all ordinal categorical quantities (items 6, 10, 11) as specified.

---

*End of plan. No implementation code has been written or modified.*  
*All items implementable with existing components — no Tier 2 escalations required.*
