# Sprint B — Body Story Closure Gate — PASS

**Date:** 2026-06-03
**Purpose:** The final Sprint B stop-condition gate — a documented green for body
story generation against current code + current data, replacing "it worked in
remediation" with recorded evidence.

---

## Run parameters

| | |
|---|---|
| **Client** | `Natural Intelligence` — `1854aa09-d732-4627-af19-729ec18654d7` |
| **Commit generated against** | `fb29865` (production deploy `dpl_36KAH1EDYGiL55RXt3PBGKKyGSMj`, READY) |
| **Trigger** | "Regenerate story" on `natural-intelligence.uk/dashboard/story` at 2026-06-03 20:29:09Z (forced fresh — `generateBodyStory` demotes the prior `client_visible` trace and writes a new one) |
| **Fresh trace written** | 2026-06-03 20:30:42Z, `status=client_visible` |

## Pre-check (run BEFORE generation, so a clean run is unambiguous)

The client was confirmed to carry signal on all three remediation surfaces
before generating — a clean run against a thin client would prove nothing:

| Signal | Value (verbatim) |
|---|---|
| Signature (`most_want_to_understand`) | "I want to understand why my energy collapsed after my second child" |
| Best Self description | "Before my second child I woke up genuinely rested. I could get through a full day at work and still have something left to play with my eldest in the evening. My mind felt sharp and I did not have to think about my energy at all." |
| Best Self comparatives | sleep `better_than_now`, energy `better_than_now`, mood `about_the_same` |
| Best Self recovery goal | "My morning energy — getting out of bed and feeling like the day is mine again." |
| Energy timing | `energy_low_times = ["On waking","Mid-morning"]`, `energy_curve = morning_low` |
| Intake answers | 26 (≫ the `insufficient_data` threshold of 0); `is_complete = true` |

Both `buildBestSelfBlock` and `buildEnergyTimingBlock` produce non-empty output
for this client, so the prompt carried the enriched context.

---

## The three pass checks — all hold

### Check 1 — Valid narrative (not insufficient_data / error / degenerate) — PASS
A complete ~350-word narrative was generated. No `insufficient_data`, no error,
no empty/degenerate body.

### Check 2 — Signature answer surfaces in the opening — PASS
Opening paragraph, verbatim:

> "Your symptoms are not random — they appear to be connected.
>
> The pattern we see centres around your hormonal and energy systems.
>
> From the timing of everything — **your energy collapsing after your second
> child**, the worst mornings, the brain fog, the skin and joint changes — it
> looks like the demands of pregnancy and the post-partum period placed
> significant strain on your thyroid and your iron stores…"

The signature (*"why my energy collapsed after my second child"*) surfaces as a
near-verbatim paraphrase in the first content sentence of the opening — in the
opening, not buried in the body. (Sentence 1 — "Your symptoms are not random…"
— is the fixed `BODY_STORY_PROMPT_BODY` template opener; the signature lands at
the first non-template sentence, the documented behaviour. A strictly
sentence-1 acknowledgement remains the previously-flagged optional Phase-2
template revision, not a gate failure.)

### Check 3 — Narrative reflects the enriched signals — PASS
- **Energy timing** (`morning_low`) is pervasive, not incidental: *"the worst
  mornings"*; *"the effect is felt most sharply in the morning, when your body
  is coming out of an overnight fast"*; *"energy that only builds slowly through
  the morning"*; *"Brain fog … particularly early in the day"*; *"the window
  when your energy is already at its lowest"*. The model is reasoning from the
  morning-low energy curve throughout.
- **Best Self baseline** is explicit: *"the gap between how you feel on waking
  and how you felt before your second child can feel enormous"* — the before/
  after gap the baseline exists to create — and the narrative orbits the stated
  recovery goal (morning energy).
- Bonus: the prompt's other enriched signals also land — intermittent fasting
  (diet), brain fog (cognitive), skin/joint changes, thyroid + iron (diagnosed
  conditions), post-exertional recovery.

---

## Result

**GREEN — all three checks pass.** Body story generation is confirmed against
the current deployed code (`fb29865`) and current enriched data.

### Sprint B stop condition
With this gate green, the Sprint B stop condition is satisfied in full:
- **Body story** — confirmed (this document).
- **B1-F1 duplicated chapter header** — already done (`0d6f551` / `882c93f`).
- **Q6 SMOKE 1/2/3** — already passed (`docs/operations/Q6-option-a-verification-report.md`, 6/6 PASS).

Sprint B closes. Phase C (the invitation flow) unlocks — its gates were
"Q6 closed + Sprint B closed", both now satisfied.
