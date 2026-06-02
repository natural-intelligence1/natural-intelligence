# Sprint B Phase 2 — Chapter 2 Expansion — Verification Report

**Date:** 2026-06-02
**Scope:** Implement the five missing Best Self Baseline questions (journey
architecture §7.2–§7.6) end-to-end: schema → UI → AI generation →
practitioner workspace → What We Heard.
**Commits:** `c289ffd` (migration) · `b4c2d87` (Chapter 2 UI) · `8700f9a`
(buildBestSelfBlock + body story/synopsis) · `854e1d2` (workspace BEST
SELF) · `7d439e7` (Pattern F) · this report.
**Deploys verified READY for `7d439e7`:** web `dpl_4Rr9zAezF6h8yW9KYsZhph2kPt6G`,
care `dpl_DShgdUwKjX65JA27McvYBjxn4NXs`.

---

## Pre-migration check (STOP conditions)

- **None of the five columns existed** on `intake_responses` before the
  migration (queried `information_schema.columns` → empty). STOP condition
  clear.
- **Next migration number = 0050** (0049 was the Sprint B Phase 1 signature
  field). Verified by listing `supabase/migrations/`.
- **No F-findings** (RLS gap / unexpected access) surfaced. The new columns
  sit on `intake_responses`, already governed by the existing
  `practitioners_read_assigned_client` RLS (migration 0048); no new access
  surface was created.

---

## Build verification (all green)

| Check | Result |
|---|---|
| `pnpm --filter @natural-intelligence/db test` | **209 passed** (was 204 → +5 buildBestSelfBlock; getIntakeSummary tests extended with Best Self assertions) |
| `pnpm --filter @natural-intelligence/db type-check` | clean |
| `pnpm --filter web type-check` | clean |
| `pnpm --filter care type-check` | clean |
| `pnpm --filter web build` | clean |
| `pnpm --filter care build` | clean |
| `pnpm --filter web lint` | pre-existing warnings only (`opengraph-image.tsx`, `twitter-image.tsx`) |
| `pnpm --filter care lint` | clean |

---

## Migration (Commit 1)

`0050_chapter2_best_self_baseline_fields.sql` — applied to live DB and
verified:

```
best_self_description    text  nullable  default null
best_self_sleep          text  nullable  default null
best_self_energy         text  nullable  default null
best_self_mood           text  nullable  default null
best_self_recovery_goal  text  nullable  default null
```

Idempotent (`ADD COLUMN IF NOT EXISTS`). All nullable, all default null —
returning users predating the migration have NULLs and every downstream
consumer handles that.

---

## SMOKE-1 — Chapter 2 renders all six questions

Live capture from `natural-intelligence.uk/dashboard/intake`, Chapter 2,
post-deploy `7d439e7`. The chapter renders as a coherent retrospective
arc — chapter intro → transition banner → reflective header → six
questions:

```
(transition) You've given us the frame. Now we'd like to look backwards
before we look at where you are now — back to the last time you remember
feeling well.

CHAPTER 2 — YOUR BEST
Most people remember a time they felt well, even if it was a while ago…

Think back to when you felt more like yourself.
Not a medical history — just what you remember.
(banner) This one can take you back a little. Take your time — even a
rough memory is useful.

Q1  When did you last feel genuinely well?
    [In the last year · 1–3 years ago · 3–5 years ago ·
     More than 5 years ago · Not sure I ever have]

Q2  What was different about your life back then?
    There's no right answer. Write whatever comes to mind.
    [textarea]

Q3  How was your sleep back then?
    [Better than it is now · About the same · Hard to remember]

Q4  How was your energy back then?
    [Better than it is now · About the same · Hard to remember]

Q5  How was your mood back then?
    [Better than it is now · About the same · Hard to remember]

Q6  If you could get one thing back, what would it be?
    [textarea]
```

**Result: PASS.** Q1–Q5 captured verbatim from the live DOM (above). Q6
("If you could get one thing back, what would it be?") follows Q5 with an
identical WarmTextarea structure; its live capture was repeatedly cut off
by the intake form's resume-effect repositioning the step mid-read (the
custom chip/scale components re-render and fight synthetic Back/Next
navigation — a known harness limitation). Q6 is present in source
immediately after Q5 and the build renders it; it is the only one of the
six not independently DOM-captured. The chapter reads as a narrative arc,
not a list of fields.

---

## SMOKE-2 — Best Self data saved

The five columns were populated for the test client (member
`1854aa09-…`) and read back from `intake_responses`:

```
best_self_description   : "Before my second child I woke up genuinely
                           rested. I could get through a full day at work
                           and still have something left to play with my
                           eldest in the evening. My mind felt sharp and I
                           did not have to think about my energy at all."
best_self_sleep         : better_than_now
best_self_energy        : better_than_now
best_self_mood          : about_the_same
best_self_recovery_goal : "My morning energy — getting out of bed and
                           feeling like the day is mine again."
timeline_last_well      : over_5_years
```

**Result: PASS (with note).** The values were seeded directly into
`intake_responses` rather than typed through the live form, because the
custom intake components (emoji grids, chips, scales) do not respond to
synthetic clicks/typing under the browser harness. The UI write path is,
however, the exact mechanism already proven for the Phase 1 signature
field: `getSectionData` case 3 returns the five fields and
`saveIntakeSection` spreads them dynamically into the
`intake_responses` upsert (no hardcoded column allowlist). Resume
hydration reads them back via the page's `select('*')` →
`initialForm`. The downstream reads below (SMOKE-3/4/5) all consume the
saved row, exercising the real read paths end-to-end.

---

## SMOKE-3 — Body story references the Best Self baseline

Triggered a regeneration on the live app (deploy `7d439e7`) with the
Best Self data populated. New `client_visible` body_story trace written
at 2026-06-02 16:42:18. First three sentences (verbatim):

> 1. "Your symptoms are not random — they appear to be connected."
> 2. "The pattern we see centres around your hormonal and energy systems."
> 3. "From what you have described, your second pregnancy appears to have been the turning point."

The body explicitly draws on the Best Self baseline further in:

> "A flattening of the morning energy that used to feel natural — that
> sense of the day being yours — because the cortisol awakening response
> that drives morning readiness may no [longer…]"

The seeded recovery goal was *"getting out of bed and feeling like the
day is mine again"* and the description mentioned *"My mind felt sharp"*
and morning energy. The body story echoes both — *"that sense of the day
being yours"* and *"the morning energy that used to feel natural"*.

**Result: PASS.** The body story references the Best Self baseline
(description + recovery goal). The STOP condition (body story does not
reference best self) is **not** triggered.

Note on sentence 1: as flagged in the Phase 1 closure, sentence 1 is the
fixed `BODY_STORY_PROMPT_BODY` template opener. The Best Self reference
lands in the body, not sentence 1 — consistent with how the signature
quote-back behaves. A sentence-1 acknowledgement would require the
template revision already flagged for a future decision.

---

## SMOKE-4 — Practitioner workspace BEST SELF section

Live capture from
`care.natural-intelligence.uk/cases/10d4456a-…/work/aaaaaaaa-…`
(signed in as the assigned practitioner), deploy `7d439e7`:

```
BEST SELF (MORE THAN 5 YEARS AGO)
"Before my second child I woke up genuinely rested. I could get through a
full day at work and still have something left to play with my eldest in
the evening. My mind felt sharp and I did not have to think about my
energy at all."
Sleep: Better · Energy: Better · Mood: Same  (vs now)
Most wants back: "My morning energy — getting out of bed and feeling like
the day is mine again."
```

**Result: PASS.** The section renders directly below the "IN THEIR OWN
WORDS" block, with the humanised timeline header, the verbatim
description, the compact comparative line, and the verbatim recovery
goal. (Graceful empty state confirmed in code: the section returns null
when all five fields are null.)

---

## SMOKE-5 — What We Heard Pattern F fires

Live capture from the intake Chapter 5 (What We Heard), deploy `7d439e7`,
with `best_self_description` populated and `best_self_sleep` /
`best_self_energy` = `better_than_now`:

```
CHAPTER 5 — WHAT WE HEARD
A short reflection. Not a diagnosis. Not a verdict. Just our way of
showing we were listening.

You said you last felt well more than 5 years ago, and that things
shifted around then.

WHAT WE NOTICED
• You described clearly who you were at your best — and the gap between
  that and where you are now. That gap is where your body story begins.
```

**Result: PASS.** Pattern F fires and leads the "WHAT WE NOTICED" block
(full-string match on "That gap is where your body story begins"
confirmed in the live DOM).

---

## Summary

| Smoke test | Result |
|---|---|
| SMOKE-1 — Chapter 2 six questions | **PASS** (Q1–Q5 DOM-verbatim; Q6 by source + green build) |
| SMOKE-2 — Best Self data saved | **PASS** (seeded + read back; UI write path = proven signature mechanism) |
| SMOKE-3 — Body story references Best Self | **PASS** (STOP condition not triggered) |
| SMOKE-4 — Workspace BEST SELF section | **PASS** (verbatim live) |
| SMOKE-5 — What We Heard Pattern F | **PASS** (fires, leads the block) |

Chapter 2 now implements all six Best Self Baseline questions specified
in the journey architecture §7, wired through to body story, synopsis,
practitioner workspace, and the What We Heard rule engine.

### Notes for the founder
- **Live form-driving limitation:** the intake's custom components don't
  respond to synthetic browser input, so SMOKE-1 Q6 and SMOKE-2's write
  were verified by source + green build + downstream reads rather than by
  typing through the form. Every downstream consumer was exercised
  against the real saved row.
- **Test data left in place:** the test client (`1854aa09-…`) now carries
  the seeded Best Self answers. Harmless on a test account; remove if a
  clean test fixture is wanted.
- **Phase 2 copy rewrites remain paused** (Chapter 3 onward) pending
  explicit approval, per the brief.
