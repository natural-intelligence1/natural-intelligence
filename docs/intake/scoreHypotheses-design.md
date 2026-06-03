# `scoreHypotheses()` — Replacement Design (Phase D.0)

**Type:** Design specification (no implementation in this sprint)
**Status:** Approved design; implementation gated to Phase D.0
**Replaces:** `docs/intake/archive/clinicalScoringRules-archive.ts` (archived —
field names did not match the live schema, no consumer, never invoked)
**Source principles:** `docs/intake/intake-intelligence-remediation-v2.md` (§4)
and `docs/intake/intake-intelligence-architecture.md` (Part 1 signal hierarchy,
Part 2 interview trees)

---

## 1. What changed from the old engine, and why

The archived `clinicalScoringRules.ts` produced **named hypothesis scores**
(`dysbiosis: 7.2`, `adrenal: 5.1`) keyed off `questionId`s that **did not
exist** in the live form (`energy_curve_pattern` vs the real `energy_curve`,
`gi_symptom_timing` vs `gi_timing`, `cycle_symptom_pattern` vs `cycle_patterns`,
`hydration_colour` — no such field). It was imported nowhere and never ran.

Two problems, one structural and one product:

1. **Structural:** it scored against field names that were never collected, so
   even if wired it would have produced near-zero signal.
2. **Product (founder decision):** NI must **not** become a functional-medicine
   score system. Forcing clinical reasoning into pre-defined buckets removes
   practitioner judgement from where it belongs.

The replacement surfaces **patterns**, not scores. Practitioners own the
hypotheses; NI surfaces the patterns, how confident they are, what's missing,
and where signals contradict.

---

## 2. Public contract (pure, testable)

```ts
// All inputs are READ from the two intake tables and merged into one map.
// No DB access inside the function — the caller assembles `signals` so the
// function stays pure and unit-testable with plain objects.

export interface IntakeSignals {
  // intake_responses
  primary_concerns?:        string[] | null
  symptom_pattern?:         string | null   // always|comes_goes|improving|worsening
  concern_duration?:        string | null   // weeks|months|over_a_year|most_my_life
  timeline_last_well?:      string | null   // last_year|1_3_years|3_5_years|over_5_years|not_sure
  timeline_trigger?:        string | null   // free text ("post-viral", "bereavement", …)
  primary_system?:          string | null
  diagnosed_conditions?:    string[] | null
  current_medications?:     string | null
  current_supplements?:     string | null
  family_history?:          string[] | null
  diet_description?:        string | null
  sleep_hours?:             number | null
  sleep_quality?:           number | null   // 1–5
  stress_level?:            number | null   // 1–5
  energy_level?:            number | null   // 1–5
  exercise_frequency?:      string | null
  psychosocial_worry?:      string | null
  psychosocial_supported?:  string | null
  // Best Self Baseline (Sprint B Phase 2)
  best_self_sleep?:         string | null   // better_than_now|about_the_same|not_sure
  best_self_energy?:        string | null
  best_self_mood?:          string | null

  // intake_answers (keyed by question_id — NOT in intake_responses)
  concern_severity_baseline?: number | null   // 0–10
  post_exertional_worsening?: boolean | null   // PEM — Tier A
  energy_low_times?:          string[] | null  // On waking|Mid-morning|After lunch|…
  energy_curve?:              string | null    // morning_low|afternoon_crash|evening_wired|all_day_fatigue|fluctuating|generally_good
  aggravating_factors?:       string | null
  relieving_factors?:         string | null
  food_symptom_link?:         { presets: string[]; custom: string[] } | null
  gi_bloating?:               boolean | null
  gi_timing?:                 string[] | null
  gi_stool_frequency?:        number | null
  gi_stool_type?:             number | null    // Bristol 1–7
  hormonal_symptoms?:         string[] | null
  cycle_patterns?:            string[] | null
  menstrual_flow_heaviness?:  number | null    // 1–5
}

export type SignalConfidence = 'high' | 'medium' | 'low'

export interface PatternSignal {
  /** Human label, e.g. "Post-viral / dysautonomia pattern". NOT a score. */
  name:                 string
  /** 0–1 — strength of agreement among the signals pointing this way. */
  confidence:           number
  /** Field=value pairs that support this pattern (auditable). */
  supportingSignals:    string[]
  /** Field=value pairs that argue against it. */
  contradictingSignals: string[]
}

export interface PatternSummary {
  patterns:         PatternSignal[]   // sorted by confidence desc
  /** Tier A/B fields that are unanswered AND would meaningfully move a
   *  pattern if known. Drives "what to ask next" + practitioner "missing". */
  missingSignals:   string[]
  /** Where signals point in different directions (surfaced, never resolved). */
  contradictions:   string[]
  /** How complete the discriminating data is overall. */
  signalConfidence: SignalConfidence
}

export function scoreHypotheses(signals: IntakeSignals): PatternSummary
```

Note what the return type deliberately **omits**: there is no
`Record<HypothesisName, number>`. No `dysbiosisScore`. The output is patterns
with confidence + provenance, plus the meta-signals (missing, contradictions,
overall confidence) that let a practitioner judge.

---

## 3. Pattern catalogue — mapped to REAL field names

Each pattern lists the discriminating signals from the live schema. Confidence
is the fraction of that pattern's supporting signals that are present and
positive, damped by any contradicting signals. (Exact weights tuned in Phase
D.0; the mapping below is the contract.)

### P1 — Post-viral / dysautonomia (Tier A — highest discriminating value)
| Signal (real field) | Supports when |
|---|---|
| `post_exertional_worsening` | `=== true` (the single strongest discriminator) |
| `timeline_trigger` | matches /virus|covid|infection|flu|glandular|post.?viral/i |
| `energy_curve` | `fluctuating` (variable, crash-after-effort) |
| `primary_concerns` / cognitive | contains brain fog / focus / memory |
| `concern_duration` | `over_a_year` (chronic, non-resolving) |
**Contradicts:** `post_exertional_worsening === false` with `energy_curve = generally_good`.
**Why it leads:** a positive PEM changes the entire clinical approach (pacing,
no graded exercise). This is why Task 1 ungated PEM to Chapter 3.

### P2 — HPA-axis dysregulation (Tier A)
| Signal | Supports when |
|---|---|
| `energy_curve` | `morning_low` (worst on waking) OR `evening_wired` (tired-but-wired) |
| `energy_low_times` | includes "On waking" / "Mid-morning" |
| `sleep_quality` | low (≤2) despite adequate `sleep_hours` (≥7) → non-restorative |
| `stress_level` | high (≥4) OR `timeline_trigger` matches /bereavement|stress|burnout|caregiv/i |
| `psychosocial_supported` | `alone` / `not_really` |
**Contradicts:** `energy_curve = afternoon_crash` (points to P5 instead).

### P3 — Thyroid pattern (Tier A/B)
| Signal | Supports when |
|---|---|
| `diagnosed_conditions` | contains hypothyroid / thyroid / Hashimoto |
| `current_medications` | matches /levothyroxine|thyroxine|liothyronine/i |
| `hormonal_symptoms` | cold intolerance / hair loss / weight gain |
| `timeline_trigger` | postpartum (/second child|after.*birth|postpartum/i) |
| `energy_curve` | `all_day_fatigue` |
**Contradicts:** none strong; co-occurs with P4 frequently (flag as concurrent).

### P4 — Iron / haematological depletion (Tier A/B)
| Signal | Supports when |
|---|---|
| `diagnosed_conditions` | contains anaemia / iron deficiency |
| `menstrual_flow_heaviness` | `=== 5` (flooding) or ≥4 |
| `timeline_trigger` | postpartum |
| `family_history` | (weak) |
| `energy_curve` | `all_day_fatigue` |
**Note:** P3 + P4 + postpartum co-occurring is the canonical compound picture
(the test client). The engine should surface them as concurrent, not pick one.

### P5 — Blood-sugar / circadian instability (Tier B)
| Signal | Supports when |
|---|---|
| `energy_curve` | `afternoon_crash` |
| `energy_low_times` | includes "After lunch" / "Late afternoon" |
| `diet_description` | high-processed / `No clear pattern` |
**Contradicts:** `energy_curve = morning_low` (→ P2).

### P6 — Mitochondrial / metabolic (Tier B)
| Signal | Supports when |
|---|---|
| `energy_curve` | `all_day_fatigue` (consistent low) |
| `post_exertional_worsening` | `=== true` |
| `concern_duration` | `most_my_life` / `over_a_year` |
| `exercise_frequency` | `rarely` |

### P7 — Gut dysbiosis / GI (Tier B)
| Signal | Supports when |
|---|---|
| `primary_concerns` | digestive / bloating / bowel |
| `gi_bloating` | `=== true` |
| `food_symptom_link` | non-empty presets/custom |
| `timeline_trigger` | matches /antibiotic|food poisoning|gastro/i |
| `gi_stool_type` | Bristol ≤2 (constipation) or ≥6 (loose) |

### P8 — Sex-hormone imbalance (Tier B)
| Signal | Supports when |
|---|---|
| `cycle_patterns` | symptoms follow the cycle |
| `hormonal_symptoms` | PMS / irregular / mood swings |
| `menstrual_flow_heaviness` | ≥4 |
| `primary_concerns` | hormonal |

### P9 — Nervous-system dysregulation (Tier B)
| Signal | Supports when |
|---|---|
| `energy_curve` | `evening_wired` (tired but wired) |
| `stress_level` | ≥4 |
| `sleep_quality` | ≤2 |
| `psychosocial_worry` | non-empty (rumination signal) |

---

## 4. The three meta-signals

### `missingSignals`
A Tier A/B field is "missing" when it is null/empty **and** at least one
candidate pattern depends on it. Examples:
- `post_exertional_worsening` null while fatigue/cognitive concerns present →
  *"PEM status unknown — would change P1/P6"*.
- `energy_curve` null while energy is a primary concern →
  *"Energy timing unknown — would separate P2/P5"*.
- `menstrual_flow_heaviness` null for a female client with hormonal concerns.

This list is the engine's contribution to **what to ask next** (Phase D.1
adaptive intake) and to the practitioner's **"missing information"** panel.

### `contradictions`
Surfaced, never resolved. Examples:
- `energy_curve = morning_low` (P2) **and** `afternoon_crash` cannot both hold —
  but if `energy_low_times` lists both "On waking" and "After lunch", flag a
  mixed pattern rather than forcing one.
- `post_exertional_worsening = false` but client reports crashing-after-effort
  in `aggravating_factors` free text → flag the inconsistency for the
  practitioner.

### `signalConfidence` (overall)
`high` / `medium` / `low` based on how many discriminating fields across the
*candidate* patterns are answered:
- `high` — the Tier A discriminators for the leading patterns are all present
  (PEM answered, energy timing answered, severity answered, trigger present).
- `medium` — leading pattern supported but key discriminators missing.
- `low` — sparse intake; patterns are tentative. The synopsis/body story should
  hedge accordingly.

---

## 5. How the output is consumed (Phase D.0 wiring — not this sprint)

- **What We Heard:** the top 1 pattern (if `confidence ≥ threshold`) → an
  existing-style recognition bullet. Never a named diagnosis.
- **Body story prompt:** a `buildPatternBlock(summary)` context block (same
  shape as `buildEnergyTimingBlock` / `buildBestSelfBlock`) listing the leading
  patterns + supporting signals, instructing the model to weave them in.
- **Synopsis prompt:** same block.
- **Practitioner workspace:** a "Patterns" panel — pattern name, confidence,
  supporting/contradicting signals, and the missing-information list. This is
  the highest-value surface: it shows the practitioner NI's reasoning and lets
  them override.

---

## 6. Testability

Pure function, plain-object input → deterministic output. Phase D.0 test plan:
- **Golden fixtures** per pattern (one IntakeSignals object that should yield
  each P1–P9 as the leading pattern).
- **Compound fixture** (P3+P4+postpartum) → both surface, neither suppresses
  the other.
- **Contradiction fixtures** → `contradictions` non-empty.
- **Sparse fixture** → `signalConfidence: 'low'`, large `missingSignals`.
- **Field-name guard test** — every field referenced by the engine must exist
  in `IntakeSignals` (a typed lookup table) so the schema drift that killed the
  old engine cannot recur silently.

---

## 7. Explicitly out of scope (Phase D.1+)

- Temporal correlation across domains (gut↔mood, sleep↔mood ordering).
- Adaptive Chapter 4 (questions that change based on the running pattern set).
- Confidence thresholds tuned against real outcome data.

This document defines the contract and the field mapping. Implementation,
weight tuning, and wiring are Phase D.0.
