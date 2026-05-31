# Intake Journey Architecture

**Status:** Architecture only — no code, no schema, no migrations. One document.
**Date:** 2026-05-19
**Sprint:** B — Intake Journey Architecture (follows the intake audit `fed7572` and Tier 1 founder decisions `bb3016d` / `d3172f5` / `ce0f52e`)
**Scope:** Redesign the intake from a collection of sections into a coherent journey.

**Editorial bar (decided, not in scope to re-litigate):** Every question must either improve clinical accuracy OR make the user feel more understood. If it does neither, it should not exist.

**Emotional outcome target (in order):** understood → curious → safe to be honest. Not: alarmed, diagnosed, judged.

**Register:** guided reflection, not medical assessment.

**Intake purpose:** surface dysfunction patterns. Root causes are inferred later. Health trajectory is tracked by the CCR over time. Intake creates the *starting picture*.

---

## 1. Recommended chapter structure

The proposed five-chapter model in the brief is a strong starting point but doesn't earn its narrative shape. Three structural approaches were evaluated against five criteria (see §15) — the recommendation is **temporal-led with thematic content inside temporal frames** (approach C: Hybrid-leaning-Timeline).

The recommended structure is **six moments, not five chapters**:

| # | Name | Type | What it does |
|---|---|---|---|
| 0 | **Arrival** | Tone-set | Single emotional check-in. Preserves the current Section 0 — it works. |
| 1 | **Your Story** | Context + intention | Who you are. Why you're here. What you most want to understand. Captures life-chapter context. *(Includes the "This is different" moment — see §16.)* |
| 2 | **Your Best** | Temporal anchor — backward | When you last felt well. What was different about your life then. The "before" of the story. |
| 3 | **What Changed** | Temporal pivot | The bridge. What shifted, when, and what was happening then. Captures the trigger arc. |
| 4 | **Where You Are Now** | Thematic content inside the current temporal frame | Current symptoms (body systems), current life (sleep, food, environment, stress, work, relationships), current medical context. The clinical density lives here. |
| 5 | **What We Heard** | Closing reflection | Rule-generated. Lightweight synthesis. No diagnosis, no alarm. "We were listening." |

### Why this differs from the proposed model

The brief proposed: Your Story → Your Best → Your Body → Your Life → What We Heard. That structure separates Body and Life into two chapters. The evidence in §15 (and clinical reality) is that dysfunction patterns emerge **across** body and life simultaneously — they aren't separable into different chapters without losing the very pattern the intake exists to surface. Sleep, food, stress, environment, and relationships are *modulators of body symptoms*, not parallel concerns to them. Treating them as separate chapters fragments the picture the intake is supposed to create.

**Folding Body + Life into a single "Where You Are Now"** chapter:
- Lets the intake render symptom → modulator pairs together (e.g., "you mentioned brain fog — when does it tend to be worst?" → leads naturally into sleep / food / stress questions about the same window)
- Stops the intake from feeling like a checklist of categories
- Reduces section count from 5 to 4 substantive chapters (Story / Best / Changed / Now) + closing reflection — easier to complete, easier to remember being in

**Adding "What Changed" as a distinct chapter** (rather than rolling it into Your Best or Your Story) gives the temporal pivot its own moment. This is the chapter where the practitioner gets the most signal per question, and where the user often feels most heard — the moment of "yes, that was when". Worth its own framing.

The order of chapters maps to a natural narrative arc — opening (who) → past (best) → pivot (change) → present (now) → reflection (what we heard) — that mirrors how people actually tell health stories.

---

## 2. Emotional arc of the full intake journey

| Chapter | START emotion | END emotion | Transition moment should produce |
|---|---|---|---|
| **0 — Arrival** | uncertain, slightly braced | acknowledged ("ok, this isn't going to be a form") | trust-set — *"I think this might be different"* |
| **1 — Your Story** | curious, beginning to open | seen — the user has named what they want to understand | recognition — *"they actually read what I said"* |
| **2 — Your Best** | reflective, sometimes sad ("when did I last feel well?") | tender, focused — a memory has surfaced | gentle pivot — *"there was a time when this wasn't like this"* |
| **3 — What Changed** | searching, sometimes raw | clearer — having articulated the turning point | clarity — *"I've never said this out loud before"* |
| **4 — Where You Are Now** | grounded — the story has a frame now | thorough — has shared what's relevant without exhaustion | competence — *"I've described this properly"* |
| **5 — What We Heard** | wondering what NI made of all this | met — the reflection lands as confirmation, not surprise | confidence — *"they got it"* |

**Critical transitions:**

- **0 → 1**: must shift the user from "checking-in mode" to "telling mode". The first Chapter 1 question carries this weight.
- **2 → 3**: emotional load is heaviest here. The "What Changed" chapter follows a backward look — it asks the user to articulate the pivot. Brief acknowledgement copy at the transition is essential.
- **4 → 5**: must close the loop. The user has given a lot; the synthesis must land as a thank-you, not a verdict.

**Emotional safety design:**

Every chapter has at least one optional question and at least one "you only need to share what you're comfortable with" framing. The intake should never feel like it's testing the user's willingness to disclose. Disclosure is invited, not extracted.

---

## 3. Clinical arc

What signal each chapter captures, and what each contributes downstream.

| Chapter | Clinical signal | Practitioner workspace contribution | AI generation contribution |
|---|---|---|---|
| **0 — Arrival** | Tone baseline (emotional state at intake) | Single header annotation — "Arrived feeling: anxious" | Tone calibration in body story narration |
| **1 — Your Story** | Why-seeking-help framing; life-chapter context; biological sex; primary concerns; chronicity; severity baseline; what user wants to understand | Top-of-panel narrative summary; primary concerns; biological_sex sets clinical frame | Sets the "frame" for both body story and synopsis — the user's own words about what they want to understand are quoted back |
| **2 — Your Best** | Temporal anchor (when last well + what was different); resilience signal (does the user have an articulated "well" reference); narrative depth (proxy for health literacy) | "Last felt well: ~2020. Life then: full-time work, regular exercise, partner support." Two-line summary. | Anchors AI-generated narrative — body story uses "the version of you that was sleeping through the night in 2020" as a return-to reference |
| **3 — What Changed** | Trigger arc (when / what / context); functional medicine "T" (Triggers); narrative of the pivot | Timeline block with date + trigger + context. The strongest single block for practitioner pattern recognition. | "Your symptoms began around [date] after [trigger]" — the explicit cause-effect arc the body story narrates |
| **4 — Where You Are Now** | Body systems under stress; current lifestyle modulators; medical context; sex-specific clinical content; environmental exposures; stress structure | Multiple panels populated: client summary, BioHub-adjacent fields, medications, current stressors, sleep window. | Provides the present-tense clinical inventory the body story interprets |
| **5 — What We Heard** | Pattern recognition output (rule-generated); confidence signals (which patterns are firm vs tentative) | Not contributed to workspace — this is for the user. | Becomes the framing the synopsis and body story confirm or extend |

**The temporal arc is the practitioner's interpretive frame.** Reading the workspace top-to-bottom, the practitioner sees: who → past anchor → pivot → present → patterns. This is how functional medicine ATM is supposed to flow (Antecedents in Chapter 1 + 2, Triggers in Chapter 3, Mediators in Chapter 4). The intake structure maps to the clinical model without anyone having to say so.

---

## 4. Purpose statement for each chapter

Plain-language, as if explaining to the user.

**Chapter 0 — Arrival**
*"Before we start, just one question: how are you feeling, arriving here? There's no wrong answer. We ask because it changes how we want to talk to you."*

**Chapter 1 — Your Story**
*"This part is about you, not your symptoms. Who you are, what chapter of your life you're in, and what you'd most want to understand about what's happening to you. The rest of the intake builds from here."*

**Chapter 2 — Your Best**
*"Most people remember a time they felt well, even if it was a while ago. We're going to look at that — not because it's painful, but because what was different then often tells us more than what's different now."*

**Chapter 3 — What Changed**
*"Now the harder part. When things shifted, what was happening in your life. Sometimes there's a clear trigger. Sometimes there isn't. Either is useful — we just want to know what you remember."*

**Chapter 4 — Where You Are Now**
*"The fullest part of the intake. We'll ask about your body, your sleep, your food, your environment, your relationships, your stress, and your medical history. Take your time. Skip anything that feels uncertain — we'd rather have an honest gap than a guess."*

**Chapter 5 — What We Heard**
*"A short reflection of what you've shared. Not a diagnosis. Not a verdict. Just our way of showing we were listening — and pointing at what we'd want a practitioner to look at first."*

---

## 5. Chapter transition copy suggestions

What the user reads as they move between chapters. All copy is editorial draft — not final wording.

**0 → 1: from Arrival to Your Story**
> *"Thank you for telling us. Let's start with you."*

Soft. Names that the user has given something already. Reframes "starting" not as "beginning the form" but as "beginning with the person".

**1 → 2: from Your Story to Your Best**
> *"You've given us the frame. Now we'd like to look backwards before we look at where you are now — back to the last time you remember feeling well."*

Signals the temporal pivot. Acknowledges the user has set up the picture; the platform is now using it.

**2 → 3: from Your Best to What Changed**
> *"You said you last felt well around [year from previous answer]. We'd like to understand what was happening around then — and what shifted."*

Personalised with the user's own answer. The user sees: "they read what I wrote". This single transition does more than any banner.

**3 → 4: from What Changed to Where You Are Now**
> *"That's the part of the picture that takes the most. You've done it. The next part is more practical — your body, your life, your medical history. Skip anything that feels uncertain."*

Acknowledges the emotional weight of What Changed. Lowers the stakes for the longest chapter.

**4 → 5: from Where You Are Now to What We Heard**
> *"You've shared everything we'd want to know to start. Before you finish, we want to show you what we heard — not a verdict, just confirmation that we were paying attention."*

Closes the asymmetric give. The user has given a lot; the platform owes a return.

---

## 6. "Why we ask this" opportunities

A brief framing sentence belongs above intrusive or counter-intuitive questions — not above every question (noise). The bar: would a thoughtful person ask "why are they asking this?" — and if so, can a single sentence answer it?

| Question / section | "Why we ask" sentence |
|---|---|
| **Biological sex** (Chapter 1) | *"We ask because biological sex changes how the body responds to symptoms, medications, and reference ranges. We capture this once."* (already added in `d3172f5`) |
| **Religion** (Chapter 1, optional) | *"We ask so we can frame your synopsis in a way that feels right to you. We default to secular framing; you can opt into other framings if you'd like."* |
| **What you most want to understand** (Chapter 1) | *"Most intake forms skip this. We don't, because what you came here to understand shapes everything we do next."* |
| **When you last felt well** (Chapter 2) | *"This is sometimes a difficult question. Take your time — even a rough memory is useful."* |
| **What was different about your life then** (Chapter 2) | No banner needed — the question itself does the work. |
| **What was happening around then** (Chapter 3) | *"Sometimes there's a clear trigger — an illness, a loss, a change. Sometimes it's nothing in particular. Either is useful."* |
| **Environmental exposure section** (Chapter 4) | *"Where we live and work shapes our health more than most clinicians ask about. A few quick questions here."* |
| **Social connection section** (Chapter 4) | *"How connected we feel turns out to be a meaningful clinical signal. We ask gently."* |
| **Medications timeline** (Chapter 4) | *"For each medication, knowing when you started it and why is often more useful than the dose."* |
| **Family health pattern** (Chapter 4) | *"Family patterns can sometimes point at things worth knowing — though they're rarely the whole story."* |
| **Section 6 / Mind & Emotion overlay** (current intake) | The current "Often the most important layer" framing is too declarative — it asserts a clinical judgement the user may not share. Replace with a lighter touch: *"This section is optional. The emotional dimensions of health are often worth knowing about, but you only need to share what you're comfortable with."* |

**Anti-pattern:** banners above *every* question. The framings above are deliberately rare — they appear at moments where they're earned. Otherwise they become noise and the form feels like it's explaining itself constantly.

---

## 7. Best Self Baseline design (Chapter 2)

The single chapter most likely to produce the "this is different" feeling. It is also a clinical instrument — when answered well, it gives the practitioner a reference state the rest of the intake is measured against.

### Question flow

1. **"When did you last feel genuinely well?"**
   - UI: same emoji card grid currently used for `timeline_last_well` (last_year / 1_3_years / 3_5_years / over_5_years / not_sure)
   - Stored as the current `timeline_last_well` field
   - Required to advance the chapter

2. **"What was different about your life back then?"** *(the new question — the heart of the chapter)*
   - UI: WarmTextarea, rows=5, placeholder: *"e.g. I had more time. The kids were younger. I hadn't started the new job. Anything you remember being different — physical, emotional, or just life-shape."*
   - Optional but visually inviting
   - This is the question that does the work — it transforms `timeline_last_well` from a data point into a memory

3. **"How were you sleeping back then?"** *(structured comparison)*
   - UI: 3 emoji options (Better than now / About the same / Worse than now)
   - Quick, comparative, low-friction

4. **"How was your energy?"** (same UI)

5. **"How was your mood?"** (same UI)

These three comparative questions are the clinical instrument. Each gives the practitioner a delta — not an absolute. "Better than now" + "About the same" + "Worse than now" across the three dimensions is more informative than asking the user to rate each on a 1–5 scale.

6. **"Is there a single thing from back then you'd most want to get back?"** *(optional closer)*
   - UI: short text input (one line)
   - Captures intent in the user's own words

### What it captures

- Temporal anchor (the "before" of the story)
- Comparative state across three domains (sleep / energy / mood) → trajectory signal
- Resilience signal (does the user have an articulated reference state? Some users say "I don't think I ever have" — that's also a clinical signal)
- Narrative depth (the freetext answer length and content is a proxy for health literacy and articulation — both useful inputs to AI prompt framing without being asked directly)
- The user's own words about what they want to recover — quoted back in the body story

### How it feeds downstream

- **Practitioner workspace**: top of the Client Summary panel, a two-line summary — *"Last felt well: ~2020. Wants to get back to: regular sleep and walking with their partner."* High signal, low real-estate.
- **Body story narration**: explicit "we'll measure progress against the version of you that was [back-then state]" anchor. The body story isn't generic — it's measured against a personal baseline.
- **Synopsis**: opening paragraph can reference the temporal anchor when present.
- **Future progress tracking** (CCR): the baseline becomes the comparator for follow-up intakes and trajectory monitoring.

### What it deliberately does not do

- It does **not** ask for a year/date. "Last year / 1–3 years ago / 3–5 years ago / over 5 / not sure" is precise enough. Asking for an exact year creates a precision the data doesn't warrant.
- It does **not** score "wellness" on a scale. The comparative framing is the instrument.
- It does **not** ask "what age were you?" — that's a different question with different sensitivity.

---

## 8. Life Chapters design

How users describe their life in chapters. **Recommended v1: a single structured question; richer mechanisms deferred.**

### v1 question (in Chapter 1)

**"What chapter of your life are you in right now?"**

UI: single-select chip cloud with a free-text "Other" option. Suggested chips (editorial draft):

- *Building / establishing*
- *Settling*
- *Caring for others*
- *Recovering or rebuilding*
- *Transitioning*
- *Slowing down*
- *Survival mode*
- *Other (write your own)*

These chips are deliberately oblique — they're not life stages (parent / professional / retired) and they're not symptoms (anxious / overwhelmed). They're a *register* the user identifies with. "Survival mode" is included intentionally — it's the chapter many people who come to NI are in, and naming it gives permission.

### What it captures

- Self-identified life context — a single tag that frames everything else
- Implicit readiness signal (someone in "Survival mode" has different bandwidth than someone in "Settling")
- An identity marker the user chose for themselves

### How the platform uses it

- **Practitioner workspace**: appears in the Client Summary header as a small subtitle — *"In their own words, currently: Caring for others."* Subtle, not foregrounded.
- **AI generation context**: passed to body story + synopsis builders as a tone parameter. A user in "Recovering or rebuilding" gets a body story that acknowledges the recovery arc; a user in "Survival mode" gets one that prioritises one-thing-at-a-time framing.
- **Inferred readiness** (per the "infer, don't ask" philosophy): "Survival mode" + "Caring for others" together imply limited bandwidth — the body story leads with the most actionable single thing, not a five-point plan. This replaces the direct `readiness_*` questions for v1.

### Future evolution (out of v1 scope)

Richer mechanisms — adding chapters as named eras with date ranges, tagging symptoms to eras — are powerful but require UI machinery (timeline editor) that doesn't justify v1 build. The single-chip version captures 80% of the signal with 5% of the cost. Defer the eras-with-symptoms mechanism to a future intake content phase.

---

## 9. "What We Heard" closing reflection design

A lightweight synthesis at the end of the intake. **Not** the body story, **not** the synopsis. A shorter, simpler reflection — the platform's way of saying *"we were listening."*

### Structure

Three short blocks, in order:

**Block 1 — The temporal arc** (one sentence)
> *"You shared that you last felt well around [last_well year], and that things shifted [after / around] [trigger from Chapter 3]."*

Generated from `timeline_last_well` + `timeline_trigger`. No AI. Pure template.

**Block 2 — What we noticed** (up to three short bullets)
- Each bullet corresponds to a rule-detected pattern
- Patterns come from the existing `branchingRules.ts` flag system (severity_high, post_exertional_pattern, menstrual_flow_high) plus new patterns introduced for Chapter 4 (chronotype mismatch, environmental load, social isolation)
- Format: *"You mentioned X — that's worth taking a closer look at."*
- Never: *"You may have X" / "This suggests X"* — no clinical claims
- If zero patterns detected, this block is omitted entirely — better silent than padded

**Block 3 — What happens next** (one sentence)
> *"Your full picture goes to a practitioner with your synopsis. We'll begin generating that now."*

Calm, direct. Sets expectation without urgency.

### Which patterns are detected and how

Pattern detection is **rule-based, not AI-generated** (per the brief). Detection happens at intake completion, in code, with no model call.

Patterns from existing rules:
- `flag_severity_high` (`concern_severity_baseline >= 8`) → *"You said this is affecting your daily life heavily — that's worth flagging."*
- `flag_post_exertional_pattern` (post-exertional worsening = true) → *"You mentioned feeling worse the day after exertion — that's a pattern worth examining specifically."*
- `flag_menstrual_flow_high` (`menstrual_flow_heaviness >= 5`) → *"You mentioned very heavy menstrual flow — that's worth a clinical conversation."*

New rule patterns (would land in `branchingRules.ts` during implementation):
- **Temporal correlation** — when `timeline_last_well` + `timeline_trigger` overlap with a chronic-onset symptom pattern → *"You said things shifted around [X] — and the symptoms you're describing fit a slow-onset pattern. The timing is worth flagging."*
- **Sleep + energy mismatch** — short sleep + low energy + afternoon-crash energy curve → *"The way your energy moves across the day fits a pattern that's worth looking at."*
- **Multi-system load** — three or more body systems with active symptoms → *"You mentioned changes across [system count] body systems — that's the kind of pattern that often points at something underneath."*
- **Environmental load** — multiple environmental exposures + chronic symptoms → *"A few of the things you mentioned about your environment may be worth looking at together."*

Patterns are written as **observations**, never as **conclusions**. The copy is constrained by a style guide (no clinical terminology, no diagnoses, no "you may have", no "this suggests").

### Copy register

Warm, intelligent, not clinical. Specifically:

- Address the user in second person, present tense.
- Quote the user back where possible — *"You said you last felt well around 2020"*.
- Never use words like: *symptoms, condition, syndrome, diagnose, suggest, indicate, possibly*.
- Use words like: *mentioned, noticed, said, fit a pattern, worth a closer look*.
- Maximum 60 words per block. Maximum 200 words total.
- No bullets in blocks 1 and 3. Bullets only in block 2 (and only when patterns are detected).

### What it deliberately is not

- **Not a diagnosis.** No clinical claims.
- **Not the body story.** That comes later, AI-generated, longer, narrative.
- **Not the synopsis.** That's a practitioner-facing summary, structured differently.
- **Not a teaser for upgrades.** No "upgrade to see more" framing.
- **Not adaptive.** Same structure for every user — only the content varies.

### Architectural placement

Renders after Chapter 4 submit, before Section 9's consent screen. Replaces the current Section 9 congratulatory header. Consent then follows on the same page, framed as: *"To generate your full body story and synopsis, we need your consent to use AI processing."* Consent is a meaningful gate when it follows a reflection that proves the platform was listening — it currently follows a generic checklist that doesn't earn the ask.

---

## 10. Mapping of existing questions into chapters

For each current question, where it belongs (or what should happen to it).

| Current question | Chapter / action | Notes |
|---|---|---|
| `arrival_emotion` | **Chapter 0** | Keep as-is |
| `biological_sex` (newly added in `d3172f5`) | **Chapter 1** | Keep position — already at top of Section 1 |
| `primary_concerns` | **Chapter 4** | Move from Story to Where You Are Now. The opening shouldn't lead with "what's wrong" — it leads with "who you are". |
| `concern_duration` | **Merge** into Chapter 3 timeline | Currently asked as standalone duration; the chronology is better captured by the What Changed chapter as part of a single temporal narrative |
| `symptom_pattern` (always / comes & goes / improving / worsening) | **Chapter 4** | Keep, but rendered against current symptoms specifically |
| `concern_severity_baseline` (0–10 visual) | **Chapter 4** | Keep |
| `aggravating_factors` (warm textarea) | **Chapter 4** | Keep |
| `relieving_factors` (warm textarea) | **Chapter 4** | Keep |
| `gi_bloating` + dependents | **Chapter 4** | Stay as Section 2 digestive sub-block content |
| `food_symptom_link` | **Chapter 4** | Keep |
| `gi_stool_frequency` | **Chapter 4** | Keep |
| `hormonal_symptoms`, `cycle_patterns`, `menstrual_status`, `menstrual_cycle_length`, `menstrual_flow_heaviness` | **Chapter 4** | Already gated on biological_sex per `d3172f5`. Keep |
| `energy_low_times`, `energy_curve`, `energy_severity` | **Chapter 4** | Keep; consider merging severity into a single severity_now reading |
| `post_exertional_worsening` | **Chapter 4** | Keep |
| `timeline_last_well` | **Chapter 2** | Move from current Section 3 (Timeline) to Chapter 2 (Your Best). Same question, new home. |
| `timeline_trigger` (warm textarea) | **Chapter 3** | Move from current Section 3 to Chapter 3. New home: the heart of What Changed |
| `sleep_hours` | **Chapter 4** | Keep |
| `sleep_quality` | **Chapter 4** | Keep |
| `stress_level` (5-dot) | **Chapter 4** | Keep, but augment with the new structured `current_stressors` chip cloud — see §12 |
| `energy_level` (5-dot) | **Chapter 4** | Keep — **but merge with `energy_severity` (visual scale)** — see §12. Two energy ratings is one too many. |
| `exercise_frequency` | **Chapter 4** | Keep |
| `diet_description` | **Chapter 4** | Keep |
| `caffeine_intake` | **Chapter 4** | Keep |
| `alcohol_intake` | **Chapter 4** | Keep |
| `diagnosed_conditions` | **Chapter 4** | Keep |
| `current_medications` | **Chapter 4** | Keep (banner removed in `bb3016d`); consider rewriting to capture per-medication context — see §13 |
| `current_supplements` | **Chapter 4** | Keep |
| `practitioner_types` (chip cloud) | **Delete** | See §11 |
| `past_treatments` (warm textarea) | **Rewrite** — see §13 | Currently low-signal; reframable |
| `family_history` (8-option chip cloud) | **Rewrite** — see §13 | Currently generic; needs per-condition context to be useful |
| `surgeries_or_injuries` (in storage type, no UI) | **Delete from storage** | Field exists in `FormState` but no UI captures it. Either build it or remove it. Recommend remove. |
| `psychosocial_impact` (warm textarea) | **Chapter 4** | Keep; revisit position (currently buried in Section 6) |
| `psychosocial_worry` (warm textarea) | **Chapter 1** | Move: the user's worry belongs near *what they want to understand*. It frames the rest of the intake. **Note safety pathway implications per D2 — see §14.** |
| `psychosocial_supported` (4-option emoji) | **Rewrite** — see §13 | Insufficient for clinical signal; needs structured replacement |
| `health_goals` (14-option chip cloud) | **Delete** | See §11 |
| `timeline_expectation` (4 emoji) | **Delete** | See §11 |
| `biggest_barrier` (warm textarea) | **Delete** | See §11 |
| `readiness_time` | **Delete** | See §11 — per philosophy "infer, don't ask" |
| `readiness_budget` | **Keep but move to onboarding** | Factual constraint, not psychological inference — belongs in account context, not health intake |
| `readiness_change` | **Delete** | See §11 |
| `consent_to_ai_analysis` | **Chapter 5** | Reframed — see §9 |

### New questions added by the journey design

- *"What would you most want to understand about what's happening to you?"* (Chapter 1, warm textarea) — the "this is different" moment, see §16
- *"What chapter of your life are you in right now?"* (Chapter 1, chip cloud) — Life Chapters question, see §8
- *"What was different about your life back then?"* (Chapter 2, warm textarea) — Best Self Baseline narrative, see §7
- *"How were you sleeping back then?"* + *"How was your energy?"* + *"How was your mood?"* (Chapter 2, 3 quick comparatives) — see §7
- *"Is there a single thing from back then you'd most want to get back?"* (Chapter 2, optional one-liner) — see §7
- *"Religion"* (Chapter 1, optional dropdown) — PS.1 substrate
- *"Religious content preference"* (Chapter 1, conditional on religion='muslim') — PS.1 substrate
- *"Bedtime"* and *"Wake time"* (Chapter 4) — chronotype derivation, see audit §3.2
- *"Current stressors"* (Chapter 4, multi-select chip cloud) — structured stress context, see audit §2.1
- *"How has your weight changed in the past year?"* (Chapter 4, single chip) — metabolic trajectory
- *Environmental subsection* (Chapter 4, 3–4 questions) — occupation, residential, smoking history, mould exposure
- *"How connected do you feel to people around you?"* + *"Do you have someone you can talk to honestly about hard things?"* (Chapter 4, replacing `psychosocial_supported`) — social-connection module

### Net delta

Removed: ~7 questions (practitioner_types, past_treatments as currently shaped, health_goals as gigantic chip cloud, timeline_expectation, biggest_barrier, readiness_time, readiness_change, surgeries_or_injuries-from-storage).

Added: ~14 questions (life chapter, what-most-want-to-understand, what-was-different, 3 comparatives + optional closer for Best Self, biological-sex framing strengthened, religion + preference, bedtime + wake time, current stressors, weight trajectory, environmental ~3, social connection ~2).

Net: roughly the same question count. Substantially different shape.

---

## 11. Questions recommended for deletion

Against the editorial principle: *improve clinical accuracy OR make the user feel more understood. Otherwise it doesn't belong.*

| Question | Why it fails the bar |
|---|---|
| `practitioner_types` (chip cloud listing GP, Naturopath, Acupuncturist, etc.) | Names *types* of practitioner without outcomes, helpfulness, or what was learned. A list of types tells the practitioner nothing actionable. Either capture context per practitioner (heavy) or remove. **Recommend remove for v1.** |
| `health_goals` (14-option chip cloud) | A goal list of pre-defined chips like "More consistent energy" / "Better sleep quality" / "Clearer skin" is a wellness-quiz artefact. It captures what the user thinks they should want, not what they actually need. The same signal emerges from "what would you most want to understand" + the body system questions. **Remove the chip cloud; the new free-text question replaces it.** |
| `timeline_expectation` (4-emoji: months / year / long_term / not_sure) | Asks the user to predict their own treatment timeline — a question they can't honestly answer. The platform shouldn't outsource clinical timeline estimation to the patient. **Remove.** |
| `biggest_barrier` (warm textarea, marked optional) | Comes at fatigue point. The intent (understand what's blocked progress before) is good, but the question is too generic — most users either skip or write something generic-back. **Remove; if needed, the question can be implicit in the medications + past_treatments narrative.** |
| `readiness_time` ("few mins/day" / "20–30 mins" / "hours/week" / "all in") | Per philosophy "infer, don't ask" — and the chip options pretend at precision the user can't honestly give. **Remove.** |
| `readiness_change` ("small steps" / "with guidance" / "all in" / "not sure") | Same problem — directly asking a behaviour-change question is the *wrong instrument* for predicting behaviour change. Inferred from life chapter + free-text answer depth. **Remove.** |
| `surgeries_or_injuries` (exists in FormState type, no UI) | Stored field with no capture. Either build the UI or drop the field. **Drop the field for v1.** |

`readiness_budget` is **kept but moved** — factual constraint, belongs in account/billing context, not health intake.

`past_treatments` is **rewritten not deleted** — see §13.

`family_history` is **rewritten not deleted** — see §13.

---

## 12. Questions recommended for merging

| Merge target | Current state | Why merge |
|---|---|---|
| `energy_level` (5-dot) + `energy_severity` (0–10 visual) | Two energy ratings in the same intake. `energy_level` rates day-to-day baseline; `energy_severity` rates "on a bad day". | A single question with a clearer frame — *"In a typical week, how would you describe your energy?"* (5-dot scale) — does the job. The bad-day reading is captured indirectly by `aggravating_factors` ("what makes it worse"). Drop `energy_severity`. |
| `gi_severity` + `concern_severity_baseline` | Two severity readings, different scopes. | Keep `concern_severity_baseline` (overall life impact, broadly applicable). Drop `gi_severity` (digestive-specific severity adds little when combined with bowel frequency + stool form + bloating Y/N). |
| `stress_level` (5-dot) + new `current_stressors` chip cloud | Currently `stress_level` is just a 5-dot. The recommendation is to add the chip cloud (audit §2.1). | Render together as a single question block: *"What's your stress like right now, and what's it about?"* — 5-dot above, chip cloud below. Two answers, one moment. |
| `concern_duration` + `timeline_last_well` + `timeline_trigger` | Three temporal references currently in three separate sections | All three belong in Chapter 2 + Chapter 3. The merge isn't into a single question — it's into a single chapter arc (Your Best + What Changed) so the temporal narrative reads coherently. |

---

## 13. Questions recommended for rewriting

| Current | Recommended | Rationale |
|---|---|---|
| `family_history` chip cloud (8 generic conditions) | Keep chips, but add per-checked: a single dropdown ("Parent / Sibling / Grandparent / Other relative") and an optional age-of-onset note. Plus one open question: *"Is there a health pattern that runs in your family that you've thought about?"* | A list of conditions without relationship or onset is generic. Adding relationship + age-of-onset transforms it into family-pattern signal. The open question catches what the chips miss. |
| `past_treatments` warm textarea | Replace with: *"Have you tried something for this before that helped? What was it?"* + *"Have you tried something that didn't help (or made things worse)? What was it?"* | Two specific questions outperform one generic recall question. Each one is shorter to answer and gives the practitioner a usable signal (what worked / what didn't). |
| `psychosocial_supported` (4-emoji: supported / mixed / not really / alone) | Replace with two questions:<br>1. *"How connected do you feel to people in your life right now?"* (5-dot: Very disconnected → Very connected)<br>2. *"Do you have someone you can talk to honestly about hard things?"* (Yes / Sometimes / Not really) | Four emojis can't differentiate "supported by family vs isolated in a new city". A loneliness proxy + a confiding-relationship question is the standard structure clinically. |
| `current_medications` (single warm textarea) | Keep textarea for v1, but add a follow-up question for the most recent change: *"Have any medications started, stopped, or changed in the past 6 months? If so, which and roughly when?"* | A list captures inventory. A delta captures recent change, which is high-signal for symptom-onset correlation. Per-medication "when started / why" remains a future content phase (per audit §2.1) — this is the smallest useful step now. |
| `arrival_emotion` chip labels (currently sentence labels like "I'm looking for clarity and progress") | Keep the sentence form, but tighten one: *"I feel stuck and want answers"* — currently good, keep. *"I'm concerned about what's happening"* — too close to *"alarmed"* which is the emotion the platform should be helping the user move away from, not naming. Consider *"I want to understand what's happening"*. | Editorial — the labels set the user's frame. "Concerned" is a slightly weaker invitation than "wanting to understand". |
| Section 6 banner (current intake): *"Often the most important layer. The emotional and psychological dimensions of health are frequently overlooked in conventional medicine. We believe they are central to the picture."* | Replace with: *"This section is optional. If you'd like to share more about how this has affected you emotionally, here is the space — but you don't have to."* | The current banner pre-judges the user's relationship to their symptoms. A user whose health story is genuinely about their gut may experience the banner as the platform telling them what their problem really is. The replacement is invitational without asserting. |
| `psychosocial_worry` (warm textarea) | Reframe and move to Chapter 1, near *"what would you most want to understand"*. New wording: *"Is there something specific you're worried about? You can say."* | The current placement (Section 6) buries the most important emotional context behind 5 sections of structural questions. Moving the worry question up turns it from a late check-in into part of the framing. **Safety pathway implications per Decision 2 — see §14.** |
| `psychosocial_impact` (*"How has this affected your daily life?"*) | Keep wording, but reframe placement and pair with one new short question: *"Is there something you've stopped doing because of how you've been feeling?"* | The "stopped doing" question is more concrete and elicits richer answers than the general impact question. Both belong in Chapter 4. |

---

## 14. Open founder decisions before implementation

Categorised. Do not guess on these.

### A. Clinical philosophy decisions

1. **`psychosocial_worry` move to Chapter 1.** This places a disclosure-eliciting question near the front of the intake. Per Decision 2 (suicidality / risk pathway out of scope), the safety signposting mechanism does not yet exist. **Question:** does moving this question forward require the signposting mechanism to land first? Or does the intake stay safe enough without it for v1?
2. **The "what would you most want to understand" question.** This is the proposed "this is different" moment (§16). It's also a question with no structured answer. Does this require AI-generated quote-back in the body story to feel like the platform actually used it? If so, the architecture has a dependency chain (intake → body story prompt change) that needs sequencing.
3. **Three Best Self comparative questions (sleep / energy / mood "back then").** Asking the user to rate their *past* state has clinical value (the delta is informative) but also asks them to remember in a structured way. Is this a clinically appropriate ask, or is it asking for too much precision about the past?
4. **Life Chapter chip options.** The proposed chips include "Survival mode" — a deliberately raw label. Is this the right register? Alternatives: drop it entirely; soften to "Just getting through"; keep as-is.
5. **Three-bullet maximum in "What We Heard" Block 2.** Why three? Because more than three feels like a list of findings (clinical claim register); two feels arbitrary. **Question:** is this the right cap, or should it be one-or-two for warmth, or up-to-five for thoroughness?
6. **Rule-based vs AI-generated for "What We Heard".** The brief specifies rule-based. The architecture follows that. **Confirm**: rule-based even when the rule's output would be phrased awkwardly for a specific user? (e.g., "You mentioned very heavy menstrual flow" — true and clinically right, but a different register from the previous chapters.)

### B. Content / editorial decisions

7. **Arrival emotion label rewrites** (§13). Specifically: "I'm concerned about what's happening" → "I want to understand what's happening". Approve / amend / reject?
8. **Section 6 banner replacement** (§13). Approve / amend?
9. **Religion question framing**. The framing in §6 ("We ask so we can frame your synopsis…") — approved tone or rework?
10. **Chapter transition copy** (§5). Approve as draft or rewrite?
11. **"What We Heard" copy constraints** (no words like *symptoms / condition / suggest*). Approve as a guideline, or formalise as a style guide?

### C. UX and sequencing decisions

12. **Chapter count and ordering.** Architecture recommends 0 (Arrival) + 4 substantive chapters + 5 (What We Heard). Final approval needed before implementation.
13. **Best Self placement before Where You Are Now.** Some users (in pain right now) may find the backward look harder than the forward look. Is the order right, or should "Where You Are Now" come first, then "Your Best" as the anchor for what to recover toward?
14. **Life Chapter question placement.** Chapter 1 (proposed) or Chapter 0 (immediately after arrival emotion)?
15. **Journey map redesign.** Current 10-node journey map at the top is heavy. Replace with chapter dots (5 dots), with current chapter highlighted? Approve approach.
16. **Save-and-resume affordance.** Per audit §5.3.14. Confirm whether to add explicit "Save and come back" button visible from every chapter.
17. **Skip-section affordance.** Per audit §5.3.15. For Chapters 3 and 4 specifically (heaviest), should there be a "Skip this chapter for now, finish later" pathway?

### D. Personalisation decisions

18. **Religion question presence in Chapter 1.** PS.1 substrate exists; intake hasn't asked. The architecture proposes adding it here. Confirm.
19. **Religious content preference conditional placement.** Below religion question, conditional on `religion='muslim'`. Confirm.
20. **`biological_sex` framing.** Currently captioned (added in `d3172f5`). The framing wording is the working draft; founder approval to lock it.

### E. Data / safety decisions

21. **`psychosocial_worry` safety pathway.** Per Decision 2, the signposting mechanism is flagged as a future safety feature. **Question:** is the architecture allowed to move `psychosocial_worry` to Chapter 1 *before* the signposting mechanism exists, or must signposting land first?
22. **`current_medications` storage banner.** Banner is now gone (`bb3016d`). Should anything replace it? Recommendation: no banner — the consent flow in Chapter 5 covers it.
23. **Free-text retention policy** (per audit §5.5.23). Open. Does not block implementation but should be answered before external practitioners join.
24. **"Private / not for AI" toggle on sensitive questions** (per audit §5.5.24). Out of v1 scope unless the founder wants it included.

### F. Implementation sequencing decisions

25. **Phasing of the redesign.** Three options:
    - **Big bang** — implement all of Sprint B in one phase, ship together. Pro: coherent. Con: high risk, long phase.
    - **Chapter-by-chapter** — implement Chapter 0 → 1 → 2 → 3 → 4 → 5 in sequence, each its own phase. Pro: incremental. Con: intake feels inconsistent during transition.
    - **Substrate first, content second** — implement the journey framework (chapters, transitions, journey map, What We Heard mechanism) first with current content slotted in, then rewrite content chapter by chapter. Pro: visual transformation visible immediately, content evolves under it. Con: substrate may need rework if content reveals architectural gaps.

    **Recommend Substrate first, content second.** Decision needed.

26. **What We Heard pattern library.** The new rules (temporal correlation, sleep+energy mismatch, multi-system load, environmental load) need to be drafted as `branchingRules.ts` entries. Founder review of the pattern set before each is implemented?

27. **Sprint B scope:** does it include "What We Heard" mechanism in code, or is that a separate Sprint C? Architecturally they're one design; for implementation, they could split.

---

## 15. Journey architecture evaluation

Three approaches were evaluated against five criteria. **Pressure-tested honestly — the chapter-driven model is not the default.**

### Approach A — Chapter-driven (the brief's starting proposal)

Your Story → Your Best → Your Body → Your Life → What We Heard.

| Criterion | Score | Reasoning |
|---|---|---|
| Pattern discovery | **Medium** | Body and Life are separated, so the practitioner has to assemble patterns across chapters mentally. Sleep affects digestion; food affects mood; stress affects sleep. Putting them in different chapters separates what the body integrates. |
| Practitioner reasoning | **Medium-High** | Familiar shape — practitioners can read by chapter. But the body-then-life ordering doesn't match ATM (Antecedents → Triggers → Mediators); Mediators are scattered across Body and Life chapters. |
| User engagement | **High** | Familiar progression. Users understand it immediately. |
| Emotional safety | **High** | Predictable, easy to anticipate what's coming. |
| Completion rates | **High** | Lowest cognitive friction. |

**Verdict:** safe and reasonable, but doesn't *earn* the "this is different" feeling. Feels like a well-designed health form. Misses the platform's core differentiator.

### Approach B — Timeline-driven

When life was good → What changed → What happened next → Where you are now → What we heard.

| Criterion | Score | Reasoning |
|---|---|---|
| Pattern discovery | **High** | Temporal correlation is the primary pattern in functional medicine. Asking the intake to surface temporal patterns by *being temporally organised* is structural alignment. |
| Practitioner reasoning | **High** | Maps cleanly to ATM. The practitioner reads top-to-bottom and gets Antecedents → Triggers → Mediators → Current state in the order they'd already reason. |
| User engagement | **High** | Closer to how people actually remember health. The "before children / after burnout / since moving" frame is genuinely how people structure their own narrative. |
| Emotional safety | **Medium** | Higher emotional load. The "when life was good" anchor is sometimes painful. The "what changed" pivot can be raw. Needs careful framing. |
| Completion rates | **Medium** | More cognitively demanding than chip-clicking. Risk of "I don't remember" abandonment in early temporal sections — narrative is harder than checkbox. |

**Verdict:** stronger clinically, riskier for completion. The "I don't remember" failure mode is real — some users genuinely don't have a clear "when did things change" answer, and a timeline-led intake may make them feel like they're failing at the platform's structure.

### Approach C — Hybrid (recommended)

Temporal scaffolding + thematic content inside temporal frames.

Story (context) → Best (past anchor, temporal) → Changed (pivot, temporal) → Now (present, thematic) → What We Heard.

| Criterion | Score | Reasoning |
|---|---|---|
| Pattern discovery | **High** | Temporal arc captured in Chapters 2–3 (Best + Changed); thematic depth captured in Chapter 4 (Now). Practitioner gets both the temporal frame and the present-state inventory. |
| Practitioner reasoning | **High** | Reads as ATM-shaped. The structure mirrors how an experienced clinician thinks through a case. |
| User engagement | **High** | Temporal opening earns the "this is different" feeling. Thematic Chapter 4 keeps the cognitive cost lower for the longest section (clear categories, familiar inputs). |
| Emotional safety | **High** | The hardest temporal asks (Best, Changed) are early — when emotional bandwidth is highest. Chapter 4's familiar checkbox-style content gives a cognitive rest after the narrative chapters. The What We Heard close turns the asymmetric give into a confirmed exchange. |
| Completion rates | **Medium-High** | Higher than pure timeline (Chapter 4 thematic depth is achievable even when memory fails); slightly lower than pure chapter-driven (the Best + Changed chapters are heavier). Net: probably 85–90% of pure A. |

**Verdict — recommended.** The hybrid earns the differentiator (temporal opening) without losing the practitioner-readable density (thematic Chapter 4). It uses each structural approach where each is strongest: temporal for narrative, thematic for inventory.

### Why the hybrid was chosen over pure A

The pure chapter-driven approach is the *safe* choice. It's also the choice that produces an intake that feels like a *better* health form — not a *different* one. The platform's strategic positioning ("this is different from anything I've been asked before") requires structural divergence from standard health intakes. The hybrid earns that divergence at acceptable cost.

The chapter-driven model is what an internal team would propose if asked to make the current intake better. The temporal hybrid is what an external clinician would propose if asked to design an intake that surfaces dysfunction patterns.

### Why the hybrid was chosen over pure B

Pure timeline-driven loses too much completion. The 10–15% of users who don't have a clear temporal narrative — chronic-from-childhood, idiopathic onset, "I've always been like this" — would feel structurally rejected by a fully temporal intake. The hybrid lets those users move through Chapters 2–3 quickly ("not sure" is always a valid answer) and lands them in the present-tense Chapter 4 where they have answers.

The hybrid also gives the platform optionality. As the intake content matures, individual chapters can lean further temporal or further thematic without restructuring. Pure A or pure B locks the structure.

---

## 16. The "This is different" moment

The first moment where a user should think: *"This is different from anything I've been asked before."*

**Proposed moment: a new question in Chapter 1, immediately after the user picks their primary concerns won't be primary concerns — it's earlier.**

The proposed question, placed as the *second* question of Chapter 1 (after biological_sex, before primary_concerns):

**"If we get this right, what would you most want to understand about what's happening to you?"**

UI: WarmTextarea, rows=4, placeholder: *"There's no right answer. It might be a question you've been carrying. Something that doesn't add up. A thing you've not been able to explain. Or just where you'd like to feel different."*

### Why this creates the feeling

- It's the question every patient wishes their doctor would ask but never does. Conventional health intakes ask "what are your symptoms?" — a clinician's question. The proposed question asks "what do you want to understand?" — a person's question.
- It privileges the user's *agency in the question*, not their *compliance with the form*.
- It is unanswerable badly. Anything the user writes is useful — even "I don't know" is signal.
- It cannot be back-filled by a doctor or summarised by a chart. It exists only in the user's own words.
- It signals what NI is, not what NI does. NI is the platform that asks this first.

### What makes it different from conventional health intake questions

| Conventional | NI |
|---|---|
| *"What are your symptoms?"* | *"What would you most want to understand?"* |
| *"What brings you in today?"* | (above, but the difference is profound) |
| *"What are your goals?"* | (the proposed question replaces the wellness-quiz goal-list with the user's own framing) |
| *"On a scale of 1–10…"* | (this is the first question in the intake that asks for *meaning*, not measurement) |

The conventional questions all share an assumption: the patient knows their condition, knows their goal, knows the symptoms — and the form is just collecting structured data on what they already understand. The NI question makes the opposite assumption: the user is here because they *don't* understand, and the intake's first job is to honour that.

### What it signals about NI

- NI is the platform that asks you what *you* want to know — before asking what's wrong.
- NI's value isn't faster diagnosis. It's the help to understand.
- NI begins with you, not with your body.
- The intake is a conversation, not an interrogation.

### Use of the answer downstream

The user's answer is quoted back, verbatim, in three places:

1. **Top of the practitioner workspace** — under the client name: *"In their own words, what they want to understand: [verbatim answer]."* Read first by every practitioner reading the case.
2. **Opening sentence of the body story narrative** — *"You said you wanted to understand [verbatim or paraphrase]. Here's how we'd start."*
3. **Opening sentence of the synopsis** — same.

The user wrote one sentence about what they came for. NI uses it as the spine of everything it gives back.

### Secondary "this is different" moments

Once the proposed question lands, two existing-question rewrites become secondary differentiation moments:

- **Chapter 2: *"What was different about your life back then?"*** — comes second. Asks the user to surface what they may not have articulated to themselves.
- **Chapter 5: *"What We Heard"*** — comes last. The first health platform that reflects back what it heard, without verdict.

The first moment converts the user from form-filler to story-teller. The second deepens the conversation. The third closes the loop.

### If no new question is added

If the founder decides not to add a new question, the strongest existing candidate is **the proposed new wording for Chapter 2's *"What was different about your life back then?"*** This already exists in the design (§7). It's a strong moment, but it comes 30% into the intake — and the platform doesn't get a second chance at the first impression. The earlier the differentiating moment, the more it shapes the user's reading of everything after.

**Architectural recommendation: add the new Chapter 1 question. It is the highest-leverage single change in this entire architecture.**

---

*Intake journey architecture complete. No code changed, no schema touched, no questions modified. Awaiting founder review of §14 (open decisions) and §16 (the "this is different" moment) before any implementation begins.*
