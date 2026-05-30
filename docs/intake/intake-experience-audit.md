# Intake Experience Audit

**Status:** Design audit — no implementation, no migrations, no code
**Date:** 2026-05-19
**Scope:** All current intake material — question definitions, branching, scoring, storage, UI, completion flow
**Reference philosophy (decided, not in scope for re-litigation):**
- Dominant purpose: surface dysfunction patterns
- Emotional arc: seen → curious → safe to be honest
- Infer (don't ask): urgency, complexity, readiness, resilience, literacy
- Register: guided reflection, not medical assessment
- Selective real-time insight at chapter transitions
- Selective question framing on intrusive topics
- Editorial bar: every question improves clinical accuracy OR makes the user feel more understood; nothing else

---

## 1. Current state

### 1.1 Architectural shape (preface)

The intake has **two coexisting question systems**:

1. **`apps/web/app/dashboard/intake/questionBank.ts`** — a Question registry abstraction with `showIf` branching, education tips, input-type enums. **9 questions total across 5 sections.** Designed to be the canonical question store; ended up unused except as a stub.
2. **`apps/web/app/dashboard/intake/IntakeForm.tsx`** — a 1,575-line component with **9 hard-coded sections (Section0–Section9)**, each rendering its own bespoke layout. Every question lives inline as JSX. This is the actual production intake.

For this audit, "the intake" means `IntakeForm.tsx`. The questionBank registry is noted as architectural debt but not in the audit's clinical scope.

### 1.2 Section inventory

10 sections (0–9). Estimated total time (median user): 18–28 minutes. Journey map at the top shows 10 nodes.

| § | Label (journey map) | Purpose | Questions | Estimated time | Notes |
|---|---|---|---|---|---|
| 0 | Arrival | Tone-set + emotion baseline | 1 (`arrival_emotion`) | 30 sec | Single emoji card grid; gates "Begin" button |
| 1 | Your story | Concern identification + chronology + severity baseline + aggravators/relievers | 6 | 3–4 min | Driving section — answers here power section2 sub-branch competition |
| 2 | Deeper dive | Branched sub-section by primary concern | varies (3–6 depending on branch) | 3–5 min | 5 branches: digestive / hormonal / energy / cognitive / general |
| 3 | Timeline | "When did things change?" + trigger narrative | 2 | 2–3 min | Single warm textarea is the most narrative q in the whole intake |
| 4 | Daily life | Sleep / stress / energy / exercise / diet / caffeine / alcohol | 8 | 3–4 min | Mix of NumberStepper + NamedFiveDot + EmojiCardGrid + WordChipRow |
| 5 | Medical | Diagnoses / medications / supplements / practitioners / past treatments / family history (+ Bristol if digestive) | 7 (or 8) | 4–6 min | **Longest section**. Highest fatigue risk. |
| 6 | Mind | Psychosocial impact + worry + support | 3 | 2–3 min | Opens with editorial banner ("Often the most important layer"); 2 long textareas |
| 7 | Goals | What does getting well look like + timeline + barriers | 3 | 1–2 min | |
| 8 | Readiness | Time + budget + change | 3 | 1 min | All emoji cards; directly asks readiness rather than inferring |
| 9 | Complete | Consent + summary checklist | 1 (consent checkbox) | 1 min | Triggers generateHealthSynopsis + generateBodyStory fire-and-forget |

### 1.3 Question inventory (full list, by section)

**Section 0 — Arrival** (1 question)
- `arrival_emotion` — single-select emoji (hopeful / frustrated / worried / curious / exhausted). Clinical objective: `tone_baseline`.

**Section 1 — Your story** (6 questions)
- `primary_concerns` — multi-select chip cloud, 12 presets + "Something else". Drives section2 branch.
- `concern_duration` — single emoji (weeks / months / over_a_year / most_my_life).
- `symptom_pattern` — single word chip (always / comes_goes / improving / worsening).
- `concern_severity_baseline` — IntakeVisualScale 0–10.
- `aggravating_factors` — WarmTextarea (optional, free-text).
- `relieving_factors` — WarmTextarea (optional, free-text).

**Section 2 — Deeper dive** (branched)

*Digestive* (5):
- `gi_bloating` — Boolean cards. → If true, shows:
  - `gi_timing` — TimingSelector (chip multi).
  - `gi_severity` — IntakeVisualScale 0–10.
- `food_symptom_link` — preset chip cloud + free-text tag input (optional, `{ presets: [], custom: [] }`).
- `gi_stool_frequency` — NumberStepper 0–8 (default 1).

*Hormonal* (3 + 2 gated):
- `hormonal_symptoms` — multi-select chip cloud, 8 presets.
- `cycle_patterns` — CyclePatternSelector.
- `menstrual_status` — WordChipRow single-select (regular / irregular / post-menopause / surgical / on_hrt / on_ocp / never_menstruated / prefer_not_to_say).
- *Gated by `menstrual_status` not in {prefer_not_to_say, post_menopause, surgical_menopause, never_menstruated}:*
  - `menstrual_cycle_length` — NumberStepper 21–45 (default 28).
  - `menstrual_flow_heaviness` — NamedFiveDot (Light → Flooding).

*Energy* (4):
- `energy_low_times` — multi-select chip cloud (7 options: On waking / Mid-morning / After lunch / Late afternoon / Evening / All day / Unpredictable).
- `energy_curve` — EnergyCurveSelector (single).
- `energy_severity` — IntakeVisualScale 0–10.
- `post_exertional_worsening` — Boolean cards. → If true, shows `AcknowledgementBanner` (no further questions).

*Cognitive* (1):
- `hormonal_symptoms` — chip cloud, 7 cognitive presets. ⚠️ **Bug**: writes to `form.hormonal_symptoms` (field reuse).

*General* (1):
- `systems_reviewed` — chip cloud, 9 system options.

**Section 3 — Timeline** (2 questions)
- `timeline_last_well` — single emoji (last_year / 1_3_years / 3_5_years / over_5_years / not_sure).
- `timeline_trigger` — WarmTextarea, long-form (rows=5).

**Section 4 — Daily life** (8 questions)
- `sleep_hours` — NumberStepper 0–12.
- `sleep_quality` — NamedFiveDot (Terrible → Excellent).
- `stress_level` — NamedFiveDot (Very low → Very high).
- `energy_level` — NamedFiveDot (Depleted → Excellent).
- `exercise_frequency` — single emoji (rarely / 1_2x / 3_4x / daily).
- `diet_description` — single chip cloud (9 options).
- `caffeine_intake` — WordChipRow (none / low / moderate / high).
- `alcohol_intake` — WordChipRow (none / low / moderate / high).

**Section 5 — Medical** (7 questions; 8 if digestive)
- `diagnosed_conditions` — TagInput with 10 presets.
- `current_medications` — WarmTextarea (banner: "🔒 Encrypted · Never shared without consent").
- `current_supplements` — TagInput with 8 presets (stored as comma-joined string).
- `practitioner_types` — chip cloud (9 options).
- `past_treatments` — WarmTextarea.
- `family_history` — chip cloud (8 options).
- *If digestive branch:* `gi_stool_type` — BristolStoolSelector.

**Section 6 — Mind & emotion** (3 questions)
- `psychosocial_impact` — WarmTextarea (rows=4).
- `psychosocial_worry` — WarmTextarea (rows=4).
- `psychosocial_supported` — single emoji (supported / mixed / not_really / alone). If "not_really" or "alone": shows italic banner.

**Section 7 — Goals** (3 questions)
- `health_goals` — chip cloud (14 options).
- `timeline_expectation` — single emoji (months / year / long_term / not_sure).
- `biggest_barrier` — WarmTextarea (optional).

**Section 8 — Readiness** (3 questions)
- `readiness_time` — single emoji (few_mins / 20_30 / hours / all_in).
- `readiness_budget` — single emoji (tight / some / flexible).
- `readiness_change` — single emoji (small_steps / with_guidance / all_in / not_sure).

**Section 9 — Complete** (1 question)
- `consent_to_ai_analysis` — checkbox. Required to submit.

**Total questions (assuming most-common digestive branch):** ~42. **Some users (general branch):** ~38.

### 1.4 Branching inventory

**Section 2 sub-branch competition** (`branchingRules.ts`, exclusive at priority 40/30/20/10):
- `sb_digestive` (40) — primary_concerns contains bloat|digest|gut|bowel|constipat|diarrh|reflux|heartburn|colon|stomach|tum|nausea|abdomen
- `sb_hormonal` (30) — primary_concerns contains hormonal|pcos|oestrogen|estrogen|progesterone|menstrual|menopause|perimenopause|endometriosis|thyroid|period|cycle issue
- `sb_energy` (20) — primary_concerns contains tired|fatigue|exhaust|energy|wired but tired|crashing
- `sb_cognitive` (10) — primary_concerns contains brain fog|focus|memory|concentrat|foggy|sluggish thinking

If none fire → `general` branch.

**Additive (non-exclusive):**
- `sb_urinary` (10) — primary_concerns contains urin|bladder|kidney → `systems/urinary` (not consumed anywhere in current UI; appears to be substrate-only).

**Within Section 2:**
- Digestive: `gi_bloating = true` → reveal `gi_timing` + `gi_severity`.
- Hormonal: `menstrual_status` not in {prefer_not_to_say, post_menopause, surgical_menopause, never_menstruated} → reveal `menstrual_cycle_length` + `menstrual_flow_heaviness`.
- Energy: `post_exertional_worsening = true` → reveal AcknowledgementBanner (no further question).

**Within Section 5:**
- `section2Branch === 'digestive'` → reveal Bristol Stool selector.

**Within Section 6:**
- `psychosocial_supported in {not_really, alone}` → reveal italic support banner.

**No other dynamic branching exists.** Sections 0, 1, 3, 4, 7, 8, 9 are linear.

### 1.5 Scoring inventory

**Branching flags** (`branchingRules.ts`, additive priority 40):
- `flag_severity` — `severity_now >= 8` (legacy — not currently emitted by any UI input).
- `flag_severity_high` — `concern_severity_baseline >= 8`.
- `flag_post_exertional_pattern` — `post_exertional_worsening = true`.
- `flag_menstrual_flow_high` — `menstrual_flow_heaviness >= 5`.

**Clinical hypothesis scoring** (`clinicalScoringRules.ts`, 10 hypotheses, 12 rules):

| Hypothesis | Rules contributing |
|---|---|
| `gut_dysbiosis` | bristol_type_1_2 (+2), bristol_type_5_6 (+2), bristol_type_7_frequent (+3), timing_dysbiosis_pattern (+2) |
| `low_stomach_acid` | bristol_type_1_2 (+1), timing_low_acid_pattern (+2) |
| `sibo` | bristol_type_5_6 (+1), bristol_type_7_frequent (+2), timing_low_acid_pattern (+1), timing_dysbiosis_pattern (+1) |
| `food_intolerance` | bristol_type_5_6 (+1), bristol_type_7_frequent (+2) |
| `blood_sugar_instability` | energy_curve_afternoon_crash (+3) |
| `hpa_axis_stress` | energy_curve_morning_low (+3), energy_curve_evening_wired (+2) |
| `nervous_system_dysregulation` | energy_curve_evening_wired (+2) |
| `mitochondrial_dysfunction` | energy_curve_all_day_fatigue (+3) |
| `sex_hormone_imbalance` | cycle_irregular (+2), cycle_heavy_pre (+4), cycle_mid_cycle (+2) |
| `thyroid_pattern` | cycle_irregular (+2) |

Clinical-pathway flags (`advise_gp`):
- `bristol_type_7_frequent` — frequent liquid stools.
- `urine_red_brown` — red/brown urine (note: `hydration_colour` question exists in `questionBank.ts` registry but **is not rendered** by IntakeForm — this rule cannot fire today).

**Body-map system weights** (`clinicalScoringRules.ts`) — declared but not rendered (`symptom_body_location` lives in registry, not in IntakeForm).

### 1.6 Storage model (recap)

Three tables (verified live earlier in the Personalisation audit):

- **`intake_responses`** (53 columns) — structured per-member summary row. Updated at each section boundary via `saveIntakeSection`. Holds: arrival_emotion, primary_concerns, concern_duration, symptom_pattern, primary_system, all Section 4–8 fields, consent, `completed_sections`, `is_complete`.
- **`intake_answers`** (per question event) — generic `(member_id, question_id, answer jsonb, clinical_objective, mapped_systems, mapped_hypotheses, answered_at)`. Written by `useIntakeAnswers` hook dual-write on every answer.
- **`intake_sessions`** — session state (`visible_question_ids`, `answered_question_ids`, `completion_percentage`, `red_flag_count`, `primary_system`).
- **`user_personalisation`** (PS.1) — biological_sex, religion, religious_content_preference, clinical_notes_on_sex. **Currently filled with defaults for every user; intake does not populate any of these fields.**

### 1.7 Completion flow

`Section9` shows a congratulatory header ("You've done something important today"), a checklist of 8 covered sections, and a consent checkbox. On submit → `saveIntakeSection(section=9)` → `completeIntake({consent})` (sets `is_complete = true`, `completed_sections = 6` — **note: hardcoded to 6 even though there are 10 sections; this is a latent bug**) → fire-and-forget `generateHealthSynopsis()` + `generateBodyStory()` → redirect to `/dashboard/synopsis`.

No "what happens next" preview before submitting. The journey ends abruptly at consent.

### 1.8 Missing-data inventory (clinical domains the intake does not touch)

Listed by domain. Each is a substantive gap.

- **Biological sex** — substrate exists (PS.1), not asked.
- **Religion + content preference** — substrate exists (PS.1), not asked.
- **Date of birth / age** — not captured anywhere.
- **Chronotype / circadian phase** — sleep hours + quality only; nothing on bedtime, wake time, consistency.
- **Light exposure** — none.
- **Shift work / irregular schedule history** — none.
- **Occupational exposure** — none (occupation not asked).
- **Residential environment** — none (urban / rural / mould history / water source).
- **Smoking history** — none (alcohol + caffeine present, smoking absent).
- **Pregnancies / reproductive history** — none for women beyond menstrual status.
- **Reproductive history for men** — none.
- **Early-life / childhood health** — none.
- **ACE-style adversity** — none.
- **Travel / infection history** — covered loosely under `timeline_trigger` free-text, never asked structurally.
- **Medication timeline** — list only, no "when started" or "why prescribed".
- **Weight history / trajectory** — none.
- **Between-meal patterns / fasting tolerance** — none.
- **Daily structure** — no "what does a typical day look like" anchor.
- **Social connection structure** — only `psychosocial_supported` 4-option emoji; no close-tie count, frequency of contact, or loneliness proxy.
- **"Health at your best" comparative anchor** — `timeline_last_well` asks *when*, never *what was different*.

### 1.9 Weak / low-signal questions (editorial flags)

| Question | Why weak |
|---|---|
| `family_history` (chip cloud, 8 generic conditions) | No relationship, no age of onset, no narrative. Generic tick-box. Likely low downstream use. |
| `practitioner_types` (chip cloud) | Names practitioner *types*, never asks outcomes, helpfulness, or what they learned. List-only. |
| `past_treatments` (free text) | Asks user to recall years of treatments without structure. High burden, variable signal. |
| `gi_severity` + `concern_severity_baseline` + `energy_severity` | Three different "severity" visual scales in the same intake. Conceptually distinct but visually identical — user can't tell why being asked twice. |
| `energy_level` (NamedFiveDot) AND `energy_severity` (IntakeVisualScale) | Both rate energy. One is for general baseline; one is for "bad day". Overlap likely confuses users. |
| `psychosocial_supported` (4 options) | Too coarse for social-connection signal. 4 emoji can't differentiate "supported by family vs alone in city". |
| `readiness_time` / `readiness_budget` / `readiness_change` | Asked directly. Per the decided philosophy ("Infer, don't ask: readiness to change") these should be inferred from answer-shape, not surveyed. |
| `psychosocial_worry` (free text) | Open-ended; risk of disclosure of suicidality without a risk-pathway. Currently no escalation flow. |
| `biggest_barrier` (free text) | Worthwhile but easily skipped (marked optional, comes at fatigue point). |
| Cognitive branch reuses `hormonal_symptoms` storage field | Code bug — not a clinical issue but breaks any practitioner trying to read cognitive answers from the structured store. |

### 1.10 Likely fatigue / drop-off points

- **Section 5 Medical** — heaviest. Diagnoses + medications + supplements + practitioners + past treatments + family history + Bristol (if digestive) = 7–8 questions in a row, several of them recall-heavy free-text or long preset lists. Likely highest drop-off zone.
- **Section 2 hormonal** — if user picks "regular_cycles" or "irregular" they get cycle length + flow heaviness immediately. ~5 questions chained.
- **Section 6 Mind & emotion** — two long textareas back-to-back after a "this is the most important layer" framing. Heavy emotional ask immediately after Section 5's medical load.
- **Sections 7 + 8** — 6 emoji-grid questions in a row at the end. Probably tolerated because they're easy, but could feel mechanical after the depth of Section 6.

### 1.11 Questions with no downstream use

Cross-referenced against AI prompt fields (`generateBodyStory`, `generateHealthSynopsis`) and practitioner workspace (`getIntakeSummary`, `ClientSummaryPanel`):

- `aggravating_factors`, `relieving_factors` — stored in `intake_responses`, **not surfaced in the practitioner Client Summary panel**, not in the AI prompt builders. Captured but unread.
- `food_symptom_link` — stored in `intake_answers` only, **not in `intake_responses`**, not surfaced anywhere.
- `gi_stool_frequency`, `menstrual_cycle_length`, `menstrual_flow_heaviness` — stored, not surfaced in workspace panel.
- `hormonal_symptoms`, `cycle_patterns`, `energy_low_times`, `energy_curve` — same.
- `psychosocial_worry`, `psychosocial_impact` — surfaced via `intake_responses` to AI prompts but **not in workspace panel**.
- `readiness_time`, `readiness_budget`, `readiness_change` — collected, **never read**. The hypotheses they're meant to inform are not built yet.
- `biggest_barrier` — same.
- `family_history` — surfaced in AI prompt; not in workspace panel.
- `practitioner_types` — same.
- `surgeries_or_injuries` field exists in storage type but **no UI captures it** (not rendered in IntakeForm).

**Roughly 40% of captured fields are not read by any downstream consumer** as of this audit. Most are read by AI generation only; very few make it into the practitioner workspace.

---

## 2. Gap analysis

Domains referenced as general clinical concepts; no proprietary institutional content reproduced.

### 2.1 Domain-by-domain table

| Domain | Current state | Ideal state | Recommendation |
|---|---|---|---|
| **Antecedents (ATM)** | Family history as enum tick-box; no childhood, no early-life context | Childhood health (broad strokes), family pattern with age-of-onset, generational themes (energy / hormonal / mood), early-life major stressors | Add a brief "Earlier in life" subsection (3–4 light-touch questions). Reframe `family_history` as narrative or scoped per-condition |
| **Triggers (ATM)** | `timeline_trigger` warm textarea | Same plus optional structured triggers (infection / surgery / pregnancy / loss / move / job change / accident / diagnosis) | Add a "Did any of these happen around that time?" chip cloud below `timeline_trigger`. Keep the textarea as the open invitation |
| **Mediators (ATM)** | Aggravating / relieving factors free-text; lifestyle in Section 4 | Same + explicit "what makes a good day" anchor; "what does a flare look like" | Add 1 question per side: "What's a good day look like for you?" / "What's a bad day look like?" — both narrative, both short |
| **Circadian biology** | Sleep hours + sleep quality only | Bedtime, wake time, consistency, weekend shift, chronotype, light exposure (morning sunlight Y/N), shift work history | Add 2 questions: bedtime range (chip), wake time range (chip). Compute chronotype from these. Add 1 q: shift work history. **No need to ask chronotype directly — derive and surface** |
| **Stress physiology** | 1–5 scale + free-text `psychosocial_worry` | Current stressors enum (work / family / financial / health / loss / change / chronic illness in family / other) + acute vs chronic toggle | Add 1 multi-select chip cloud for current stressor categories — gives structured context to the 1–5 stress rating |
| **Metabolic health** | `energy_curve`, caffeine, alcohol, diet description | Add weight trajectory (stable / gained / lost in past year), between-meal hunger pattern, energy after meals, fasting tolerance | Add 2 light questions: "How has your weight changed in the past year?" + "How do you feel between meals?" |
| **Environmental health** | None | Occupation (broad category), residential environment, smoking history (current/ex/never), mould exposure history (Y/N "ever lived somewhere with visible mould"), known chemical exposures | Add 1 short subsection ("About your environment") with 3–4 questions. Frame each: "We ask because…" |
| **Behaviour change readiness** | Asked directly (3 questions in Section 8) | Inferred from answer-shape across the whole intake | **Remove** `readiness_change` (it's the only one that pretends to predict behaviour). Keep `readiness_time` and `readiness_budget` — those are factual constraints, not psychological inference targets |
| **Social connection** | `psychosocial_supported` 4-emoji single-select | UCLA-style 3-item loneliness proxy + 1 q on weekly close contact, plus structural ("Do you live alone?") | Replace `psychosocial_supported` with 2 questions: a loneliness proxy + a structural one. Drop the emoji format here — this is a clinical signal, not an emotional check-in |
| **Family pattern** | Tick-box enum (8 generic conditions) | Tick-boxes + per-tick "Who?" (e.g., "Parent / Sibling / Grandparent") + age-of-onset if known + 1 narrative question | Keep enum, add a per-checked relationship dropdown. Add one open question: "Is there a health pattern that runs in your family that you've thought about?" |
| **Medication narrative** | List + supplements list | List + per-medication "when did you start this?" + "why was it prescribed?" + "how do you feel on it?" | Add per-medication follow-up. **Cost:** form complexity. **Benefit:** transforms a list into a clinical history. Worth piloting on a subset first. |
| **"Health at your best"** | `timeline_last_well` asks when, never what | When + "what was different about your life then?" narrative | Add a single warm textarea immediately after `timeline_last_well`: "What was different about your life back then?" — pure invitation to reflect |
| **Sex-specific clinical content** | `menstrual_status` gates cycle questions; nothing gates anything else | `biological_sex` should drive: menstrual visibility, male-pattern questions, reference-range framing | **Capture biological_sex (PS.1 substrate ready)**. Gate menstrual section on `biological_sex = 'female'` rather than `menstrual_status`. Add male-pattern parallel (libido / morning erections / strength changes) |
| **Reproductive history (broader)** | None for women beyond menstrual_status | Pregnancies (count), miscarriages (count), live births, hormonal contraceptive history (timeline) | Defer to a content phase. High clinical value but emotionally heavy — needs careful framing. Note for backlog. |
| **Early-life adversity** | None | ACE-style 3–5 question subset, optional, with explicit framing | **Founder question** — see §5 |
| **Self-harm / suicidality risk pathway** | Currently no question asks, no escalation flow | Either avoid the topic structurally, OR ask one screening q + have an escalation pathway | **Founder question** — see §5 |

### 2.2 Specific domain checks (per spec)

- **Does the intake capture chronotype?** No — only sleep hours and quality. Recommend: derive from bedtime + wake time questions, surface as discovery moment (see §3).
- **Does the intake capture social connectedness?** Partially — 4-option emoji `psychosocial_supported`. Insufficient for clinical signal.
- **Does the intake capture environmental toxicity exposure?** No — entirely absent. High-leverage gap for an integrative platform.
- **Does the intake capture medication narrative vs list?** List only. The text field accepts comma-separated medication names. No structured timeline, no "why prescribed", no "how feeling on it".
- **Does the intake capture "health at your best" vs current?** Half — captures when (`timeline_last_well`) but not what (no narrative follow-up).
- **Does the intake surface readiness to change implicitly?** No — it asks directly via three emoji grids in Section 8, which contradicts the decided philosophy. Implicit signals (answer length, narrative depth, optional-field completion rate) exist in the data but aren't used.

---

## 3. Wow moment opportunities

Rated High / Medium / Low. Not implementing — surfacing.

### 3.1 Real-time chapter-transition AI observation — **High**

After Section 3 (Timeline) and Section 5 (Medical), a brief AI-generated observation surfaces — one or two sentences grounded in what was just shared.

Example after Timeline: *"You mentioned the COVID infection and a really stressful period at work happening around the same time. That kind of compounded onset is something we'll want your practitioner to look at carefully — it can shape what we focus on first."*

Why high impact: the user pauses, reads, feels read. Confirms the platform was listening. Encourages honesty in the next section. Risks: latency (synchronous AI call adds 2–4 sec to a section transition), hallucination (must be tightly scoped). Mitigate by: pre-warmed model + structured prompt + character ceiling + secular framing default.

### 3.2 Chronotype discovery moment — **High**

Derive chronotype from bedtime/wake time/energy curve, surface as discovery (not as another question).

Example: *"Your bedtime, wake time, and energy pattern fit what's often called an 'evening' chronotype. About 30% of adults fit this profile. We'll factor this in when we look at your sleep — it changes what 'good sleep hygiene' means for you."*

Why high: the user feels seen by a fact about themselves they may never have known. Discovery > data entry.

### 3.3 Family pattern recognition — **Medium**

When `family_history` + per-condition relationships are entered, surface: *"You mentioned thyroid issues in your mother and energy issues in your father. We'll note that pattern for the picture your practitioner gets."*

Why medium: clinically interesting but depends on per-condition relationship capture happening first. Without that depth, this risks generic.

### 3.4 Life-event health correlation surfacing — **High**

When `timeline_trigger` is filled and timeline_last_well + symptom onset overlap, surface: *"You said you last felt well around [year], and you mentioned [trigger] happening then. That kind of timing match is worth flagging — your practitioner will look at it specifically."*

Why high: it's exactly what an attentive clinician would say. Cheap to do (no AI required — pure pattern match).

### 3.5 "At your best vs now" framing — **High**

After `timeline_last_well`, the warm textarea "What was different about your life then?" is itself a wow moment. No real-time AI needed; the framing alone elicits reflection.

Why high: pure editorial. Transforms a clinical question into reflection. Zero engineering cost.

### 3.6 Adaptive depth on positive answers — **Medium**

When user picks "comes_goes" for symptom pattern, follow up with: *"Can you remember the last good stretch?"* (optional textarea).

Why medium: makes the form feel responsive. But adaptive follow-up is a new mechanism — needs design care to avoid feeling pushy.

### 3.7 Explaining the clinical why on intrusive topics — **Medium**

Already partially done (Section 6 banner). Extend to: environmental exposure, social connection, medication "why prescribed?", chronotype/bedtime.

Why medium: builds trust, but unnecessary on most questions. Save for the genuinely intrusive ones — otherwise it becomes noise.

### 3.8 Curated mid-section reflection — **Low**

Showing a summary every 3 sections risks feeling patronising and gamified. The chapter-transition variant (§3.1) is the better expression of this intent. Recommend not pursuing this separately.

### 3.9 "You are not alone" moment — **Medium** (when authentic)

After certain pattern matches (post-exertional worsening, severe fatigue + brain fog, chronic loneliness signal), a brief acknowledgement: *"What you're describing fits a pattern many other people deal with — and one that's clinically actionable. You're not alone in it."*

Why medium: high risk of feeling performative if mis-applied. Reserve for the strongest patterns; never use generically.

---

## 4. Personalisation review

PS.1–PS.4 substrate exists; the intake does not yet populate any of the three personalisation fields.

### 4.1 `biological_sex`

**Current state:** Not asked anywhere. Every member's `user_personalisation.biological_sex` is `NULL` (set by `handle_new_user()` trigger to `NULL` default).

**Consequence:** The Sprint 16.3 menstrual_flow_heaviness branching rule fires for everyone who picks "regular_cycles" or "irregular" in `menstrual_status` — including male users who pick those (the form doesn't prevent it). The branching is currently gated on `menstrual_status`, not on sex.

**Recommendation:** Add `biological_sex` as the first question of a new Section 0' (demographics) — or as the very first question of Section 1, before `primary_concerns`. Required (cannot skip; PS design decided). Two-option binary (`male` / `female`). The form's existing `menstrual_status` question should then be gated on `biological_sex = 'female'`.

**Knock-on:** male-pattern questions don't exist today. The current intake has no male-specific section. Founder decision needed — see §5.

### 4.2 `religion`

**Current state:** Not asked anywhere. Defaulted to `'prefer_not_to_say'`.

**Recommendation:** Optional. Single dropdown. Full 9-value enum from PS.1 (muslim / christian / jewish / hindu / buddhist / sikh / secular / prefer_not_to_say / other). Skip behaviour: stores `prefer_not_to_say`. 

**Right moment to ask:** With `biological_sex` in the demographics section. Asking it early means downstream content (AI synopsis, body story) renders correctly framed from the first reading — without re-renders or "we'll personalise this later" experiences.

**Framing:** Neutral, single sentence above the question: *"We ask so we can frame your synopsis in a way that feels right to you. We default to secular framing; you can opt into other framings if you'd like."*

### 4.3 `religious_content_preference`

**Current state:** Not asked. Defaulted to `'hide'`.

**Recommendation:** Conditionally shown only if `religion = 'muslim'` (v1 — other religions not yet authored). Required choice if shown (per PS.1 spec). Two options: "Yes, show this framing" / "No, keep it secular".

**Fallback when religion is selected but preference is skipped:** Stored as `'hide'`. The architectural gate `religion = 'muslim' AND religious_content_preference = 'show'` then evaluates to false → secular framing rendered. Fail-safe to secular.

### 4.4 Architectural rule remains intact

Confirmed by reading the substrate code and audit findings: Islamic framing renders **if and only if** both conditions hold:

1. `user_personalisation.religion = 'muslim'`
2. `user_personalisation.religious_content_preference = 'show'`

The public experience (any marketing route outside `/dashboard`) remains secular by construction — `PersonalisationProvider` is not mounted there, the CI grep enforces import boundaries, and the boundary was verified live in PS.3 SMOKE-8 with zero religion-related strings in the public marketing HTML.

Whatever the redesigned intake captures, it cannot change this rule. The intake is one input to the substrate; the substrate's boundary holds independently.

---

## 5. Founder questions

Decisions needed before redesign starts. Categorised.

### 5.1 Clinical philosophy

1. **ACE-style early-life adversity** — capture or not? Strong clinical value, especially for chronic fatigue / chronic pain / immune patterns. Risk: activating for users. Options: (a) include with explicit framing, (b) defer entirely, (c) offer as opt-in deeper-dive after completion.
2. **Reproductive history (women)** — pregnancies / miscarriages / live births / hormonal contraceptive history. High clinical value. Emotionally heavy. Include in v1 intake? Defer? Offer optionally?
3. **Self-harm / suicidality risk pathway** — currently the form doesn't ask, but `psychosocial_worry` is open free-text where disclosures could appear. Do we add a screening question + escalation pathway, or stay deliberately silent and rely on practitioner review?
4. **Male-pattern reproductive / hormonal section** — current intake has no male-specific equivalent of the menstrual section. Add (libido / morning erections / strength changes / mood patterns)? Defer? Skip entirely?
5. **Childhood health** — broad-strokes capture (e.g., "How was your health as a child?" + 3 chip options). Worth including, or out of scope for v1?

### 5.2 Content decisions

6. **Section 6 framing** — *"Often the most important layer. The emotional and psychological dimensions of health are frequently overlooked in conventional medicine."* Is this approved copy, or does it pre-judge the user's relationship to their symptoms? Some users may not feel mind/emotion is "the most important layer" of their case and could feel led.
7. **`practitioner_types`** — keep as chip list, replace with structured ("Have you worked with one? What did you learn? Was it helpful?"), or remove?
8. **`family_history`** — keep as is (enum tick-box), deepen (per-condition relationship + age of onset), or replace with narrative?
9. **`past_treatments`** — keep as warm textarea, structure it, or remove?
10. **Editorial tone of the AcknowledgementBanner system** — current bannered acks ("Some details may take you back…") read as tonally consistent. Worth a single pass to make sure none feel performative once the redesign settles.

### 5.3 UX and sequencing

11. **Demographics placement** — where does the new `biological_sex` + `religion` capture go?
    - Option A: New Section 0' (demographics) before Section 0 (arrival emotion). Pro: clean. Con: starts the experience with a form.
    - Option B: Folded into Section 4 (Daily life). Pro: keeps the warm opener. Con: late capture means menstrual gating doesn't work cleanly.
    - Option C: Sub-section at the very top of Section 1 (Your story). Pro: warm opener preserved, sex available before branching. Con: mixes registration-feel with story-feel.
    - **Recommendation: Option C** if we want it early; Option A if we accept a clinical-feel demographics opener.
12. **Journey map (10 nodes at the top)** — reduce for cognitive load, keep, redesign? 10 numbered chips is a lot of visual scaffolding.
13. **Section 9 (Complete + consent)** — currently shows BEFORE generation. The user clicks "Generate my health synopsis →" then is redirected to a synopsis-generating page. Consider: a "what happens next" preview, or moving consent into onboarding (one-time, separate from intake completion).
14. **"Save and resume later" affordance** — auto-save exists but there's no explicit "I'll come back to this" affordance. Adding one might increase completion rates for emotionally heavy sections.
15. **Skip section** — should there be an affordance to skip a whole section (especially Mind & emotion, Medical) and complete it later, without losing the rest?

### 5.4 Personalisation decisions

16. **Confirm: `biological_sex` required, no skip.** Per PS.1 design. Confirm in intake context — or is "prefer not to say" a third option?
17. **Confirm: religion optional, defaults `'prefer_not_to_say'`.** Yes per PS.1; just reconfirm.
18. **Confirm: `religious_content_preference` conditional on `religion='muslim'` only in v1.** Per PS.1 — other religions don't yet have framing content.
19. **Should menstrual section gate on `biological_sex = 'female'` instead of `menstrual_status`?** Strongly recommend yes — the current gate is a code-shape artefact, not a clinical decision. Need to confirm.
20. **Male-pattern hormonal/reproductive questions** — same as §5.1.4. Confirm scope.
21. **Should AI generation contexts gain access to the existing demographic fields (date of birth, age) if we add them?** Per PS.4 the substrate is built around `biological_sex` + `religion` + preference; adding age would extend the architecture. Founder direction needed before adding.

### 5.5 Data retention / sensitivity

22. **The "🔒 Encrypted · Never shared without consent" banner above the medications field.** Is this accurate? Currently the field is stored in plaintext in `intake_responses`. The banner sets an expectation we may not be meeting. Either: (a) implement encryption-at-rest for this column, (b) remove the banner, (c) reword it to "Stored securely · Never shared without consent" which is true.
23. **Free-text fields (`psychosocial_worry`, `aggravating_factors`, `past_treatments`, `timeline_trigger`, `psychosocial_impact`, `biggest_barrier`)** — searchable by admins? Practitioners? Retention period? Currently no retention or search policy stated.
24. **"Private / not for AI" toggle** — should the user be able to answer a question privately (for their record + for practitioner review only) and have it excluded from AI generation? Useful for sensitive disclosures.
25. **`current_medications` column** — single text field. If a user lists 8 medications in free text, the AI prompt receives all 8 verbatim. Should we move to structured medication capture (one row per med) so AI can be selective?
26. **Suicidality / risk disclosures in free-text** — per §5.1.3, what's the operational pathway?

---

## 6. Recommended intake roadmap (redesign sequence only)

Sequence, not implementation. Each step is a stand-alone decision-gated phase.

1. **IX.0 — Founder decisions.** Resolve the questions in §5. Without these, redesign cannot start cleanly.

2. **IX.1 — Demographics capture (smallest possible change).** Add `biological_sex` + `religion` + `religious_content_preference` capture at the chosen placement (§5.3.11). Wire to `user_personalisation` via the existing PS.1 helpers. Gate menstrual section on `biological_sex = 'female'`. **One commit, no other redesign work.** Lets the platform start populating real personalisation values immediately.

3. **IX.2 — Question pruning.** Remove or rework the low-signal questions surfaced in §1.9 — `practitioner_types`, `family_history` as enum, `readiness_change` (per the "infer, don't ask" philosophy), the cognitive branch bug, the unused `surgeries_or_injuries` storage field. Don't add anything yet; reduce noise first.

4. **IX.3 — Editorial pass.** Tighten copy across all sections against the "feels read, not surveyed" bar. Specifically: Section 6 framing (per §5.2.6), banner tone consistency, the medications "🔒" claim, the journey map labels.

5. **IX.4 — High-leverage additions.** Add the genuine gap-fillers from §2.1:
   - Bedtime + wake time + consistency (chronotype derivation; no chronotype question asked directly)
   - Current stressors structured chip cloud
   - Weight trajectory (single chip)
   - Environmental subsection (occupation, residential, smoking, mould)
   - Per-medication "when started / why / how feeling" (consider piloting)
   - Reframed family history (per-condition relationship + 1 narrative)
   - "At your best — what was different?" textarea after timeline_last_well
   - Replace `psychosocial_supported` with a 2-question social-connection module

6. **IX.5 — Wow moments — substrate.** Build the chapter-transition AI observation infrastructure (after IX.4's data is captured). Wire the chronotype derivation + life-event correlation pattern matches. Both can land without authoring new clinical content — they're shape-only.

7. **IX.6 — Male-pattern section.** If approved in §5.1.4 and §5.4.20, add a parallel hormonal/reproductive section gated on `biological_sex = 'male'`.

8. **IX.7 — Reproductive history (women).** If approved in §5.1.2, add the deeper reproductive subsection with explicit framing. Likely the most emotionally complex piece.

9. **IX.8 — Risk pathway.** If approved in §5.1.3, add the screening question + escalation flow.

10. **IX.9 — Save & resume + skip-section UX.** If approved in §5.3.14 and §5.3.15. Improves completion on heavy sections.

11. **IX.10 — Final review.** Single editorial + clinical pass over the redesigned intake end-to-end. Confirm every question still meets the bar from the decided philosophy.

12. **IX.11 — Closure report.** Mirroring the Phase B / Personalisation Substrate / Q6 pattern.

**Total: 12 sequenced phases, each gated, each producing a single coherent change.** Most are small. IX.4 (gap-fillers) is the largest and may decompose further once founder direction lands.

---

*Intake audit complete. No code changed, no schema touched. Awaiting founder decisions on §5 before any redesign begins.*
