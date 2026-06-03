# Sprint B — Intake Intelligence Remediation — Verification Report

**Date:** 2026-06-03
**Plan:** `docs/intake/intake-intelligence-remediation-v2.md` (immediate items 1–5)
**Commits:** `666d9f4` (Task 0) · `6f95613` (Task 1) · `5fce620` (Task 2) ·
`9817aaa` (Task 3) · `232d042` (Task 4) · this report (Task 5).
**Deploys:** web + care READY for the full chain (latest web
`dpl_AQ1pxkxQTVZNNHTkiVPa55GxknDt` = `232d042`, READY).

> ⚠️ **One pre-existing F-finding surfaced during verification — a crash on
> the intake page unrelated to these five tasks. See the F-FINDING section
> at the end. It is NOT one of the approved tasks and was NOT fixed; it is
> surfaced for a decision.**

---

## Task 1 — Ungate PEM (commit `6f95613`)

**Change (display-condition only):** removed `post_exertional_worsening`
from the `Section2` energy sub-branch (Chapter 4) and added it to
`ChapterChanged` (Chapter 3), immediately after `timeline_trigger`,
unconditional. Wording unchanged. `persist` section number 3. No new
FormState field, no migration (STOP condition satisfied —
`post_exertional_worsening` already existed).

**SMOKE — PASS (live).** Navigated to Chapter 3 on the live app; PEM now
renders for every user, regardless of primary-concern branch:

```
CHAPTER 3 — WHAT CHANGED
What was happening around then?  [timeline_trigger textarea]
Do you feel noticeably worse the day after physical or mental exertion?
   Yes — Energy crashes or symptoms worsen
   Not really — I recover normally
```

Confirmed it is reachable from non-energy presentations (it is no longer
inside the energy branch — it is a chapter-level question).

---

## Task 2 — Wire energy timing downstream (commit `5fce620`)

`energy_low_times` + `energy_curve` had zero consumers. **STOP condition
hit and surfaced:** these fields live in `intake_answers` (keyed by
`question_id`), NOT `intake_responses` (`n_cols = 0`). Founder approved the
migration-free path: read from `intake_answers` everywhere (same pattern as
`post_exertional_worsening`). Three surfaces wired:

- **2a What We Heard** — `whatWeHeardEnergyTiming()` maps `energy_curve`
  (priority) / `energy_low_times` (fallback) to one of four recognition
  statements. Rendered as a pattern bullet after Pattern F.
- **2b Body story** — `buildEnergyTimingBlock(EnergyTimingInput)` → string,
  inserted into the system prompt after the Best Self block; built from the
  `answerMap`.
- **2c Workspace** — `getIntakeSummary` reads the two fields from its
  existing `intake_answers` query; `ClientSummaryPanel` shows a one-line
  "Energy pattern" in the clinical-context section.

**Tests:** +4 `buildEnergyTimingBlock` unit cases; `getIntakeSummary` tests
assert the new fields map / are null. db suite 209 → **213**.

**SMOKE-2 (body story references energy timing) — PASS.** Seeded the test
client with `energy_curve='morning_low'`, `energy_low_times=['On waking',
'Mid-morning']`. Regenerated the body story (2026-06-03 14:02:55); it
references *"losing that quality of morning energy and never fully
recovering it"* — consistent with the `morning_low` block reaching the
model. (No throwaway debug log used — verified via the generated output,
the same method used for the Best Self smoke.)

**SMOKE-3 (workspace Energy pattern line) — PASS (live).** The clinical
context section renders, directly under the Sex line, same weight:

```
Sex: Female
Energy pattern: Morning low · lowest: On waking, Mid-morning
```

**SMOKE-1 (What We Heard energy bullet) — verified by construction.**
`energy_curve='morning_low'` → bucket `morning` →
*"Your energy follows a pattern that often points toward how your stress
hormone system is working — particularly in the early part of the day."*
The mapping is a deterministic pure function; the wiring is confirmed by
the green build and by the same energy data flowing correctly to the
workspace (SMOKE-3) and body story (SMOKE-2). A live Chapter-5 DOM capture
was blocked by the intake form-driver limitation (synthetic clicks cannot
reliably traverse Chapter 4's multi-step Daily Life to reach Chapter 5) —
the same limitation documented in the Chapter 2 expansion report.

---

## Task 3 — Repair synopsis & body story field names (commit `9817aaa`)

**Synopsis field audit (before → after), against the live `intake_responses`
schema:**

| Before (read) | Exists? | After |
|---|---|---|
| `chief_complaints` | no | `primary_concerns` |
| `complaint_duration` | no | `concern_duration` |
| `complaint_severity` | no | *removed* (severity is in `intake_answers`) |
| `existing_conditions` | no | `diagnosed_conditions` |
| `current_medications` | yes | kept |
| `current_supplements` | yes | kept |
| `previous_practitioners` | no | *removed* |
| `previous_treatments` | no | `past_treatments` |
| `diet_type` | no | `diet_description` |
| `exercise_frequency` | yes | kept |
| `sleep_hours` | yes | kept |
| `stress_level` | yes | kept |
| `alcohol_frequency` | no | *removed* (`alcohol_intake` is in `intake_answers`) |
| `smoking_status` | no | *removed* (never collected) |
| `energy_level` | yes | kept |
| `mood_level` / `digestion_level` / `cognitive_level` | no | *removed* (numeric levels never collected; no substitution invented) |
| `family_history` | yes | kept |
| `additional_notes` | no | *removed* |

Result: 5 renamed to real columns, 7 already valid, 8 removed. No
substitution invented; no STOP-condition ambiguity (each was a clean rename
or clearly had no like-for-like column).

**Body story (`buildStoryPrompt`):** removed three reads for columns that
exist but the current form never writes (always empty): `symptom_onset`,
`timeline_trigger_type`, `working_with_practitioners`.

**SMOKE (synopsis before/after) — PASS.** Regenerated after the repair.

*Before* (2026-06-02 23:40, stale field names → intake-form section mostly empty):
> "You came in wanting to understand why your energy collapsed after your
> second child — that moment when mornings stopped feeling like yours…
> You described a time, more than five years ago now, when you woke
> genuinely rested… That version of you didn't have to think about energy
> at all."

*After* (2026-06-03 14:02, repaired field names):
> "You came in wanting to understand why your energy collapsed after your
> second child — that question sits at the heart of everything we're looking
> at here. You described a time, more than five years ago now, when you woke
> genuinely rested, moved through full workdays with capacity to spare…
> That version of you isn't gone; she's just buried under a set of
> physiological burdens we can now start to name."

The repaired version then grounds explicitly in *"You're managing
hypothyroidism and a history of iron deficiency anaemia"* — the
`diagnosed_conditions` column the prompt now reads under its real name
(previously read as the non-existent `existing_conditions`, so the synopsis
was blind to it). The repair adds live intake data the synopsis was
previously generating without.

---

## Task 4 — Archive dead scoring engine (commit `232d042`)

`clinicalScoringRules.ts` was dead: no importers (only descriptive comments
mention it), no test, and its `questionId`s did not match the live form
fields. **STOP condition satisfied:** confirmed no file imports it before
removal. There was **no associated test file** (the brief's "its own test"
assumption was incorrect — none existed), so no test was deleted.

`git mv` to `docs/intake/archive/clinicalScoringRules-archive.ts` with an
archival header pointing at the Phase D.0 `scoreHypotheses()` rebuild. The
archive lives under `docs/`, outside every app's tsconfig.

**Test-count impact:** none (no test existed to remove). db suite remains
**213**. web type-check + build clean after removal.

---

## Build state (final)

| Check | Result |
|---|---|
| `pnpm --filter @natural-intelligence/db test` | **213 passed** (was 204 before this session's two task-suites: +4 energy, +5 best-self in prior sprint; +energy assertions) |
| `pnpm --filter @natural-intelligence/db type-check` | clean |
| `pnpm --filter web type-check` | clean |
| `pnpm --filter care type-check` | clean |
| `pnpm --filter web build` | clean |
| `pnpm --filter care build` | clean |
| `pnpm --filter web lint` | pre-existing warnings only (`opengraph-image.tsx`, `twitter-image.tsx`) |
| `pnpm --filter care lint` | clean |

Every task ran the full six-check discipline before committing; no failing
build was pushed.

---

## ⚠️ F-FINDING — pre-existing intake page crash (NOT one of the five tasks)

**Symptom.** Loading `/dashboard/intake` for a returning user can render the
dashboard error boundary ("Something went wrong loading your dashboard").
Route returns HTTP 200; no server-side error logged.

**Root cause (captured live).**
```
TypeError: t.current_supplements.split is not a function
  at app/dashboard/intake/page (Section5)
```
`Section5` (Medical) renders the supplements TagInput with
`form.current_supplements.split(',')…`, treating the field as a
comma-joined string. But the field can hydrate as an **array**:

- `Section5`'s TagInput `onChange` calls `persist('current_supplements', v, 5)`
  where `v` is an **array**, writing an array into `intake_answers`.
- `getSectionData` writes the comma-joined **string** to `intake_responses`.
- On resume, `initialForm` seeds the string from `intake_responses`, then the
  `useIntakeAnswers` hook hydrates `intake_answers` **over** it — replacing
  the string with the array.
- `Section5` then calls `.split` on an array → crash → error boundary.

Confirmed on the test client: `intake_answers.current_supplements =
["Vitamin D 2000IU","Magnesium glycinate 300mg","Iron"]` (array) vs
`intake_responses.current_supplements = "Vitamin D 2000IU, Magnesium
glycinate 300mg"` (string).

**Scope & ownership.** This is **pre-existing** and **unrelated to the five
remediation tasks** — `Section5`, `useIntakeAnswers`, and the
`current_supplements` dual-write are all code untouched in this sprint (the
Task-1/2 `IntakeForm` diff is confined to PEM placement and the energy
bullet). It affects any returning user who edited supplements via the chip
input and resumes to the Medical section.

**Action taken.** Per the STOP-condition instruction (surface F-findings, do
not exceed the five approved tasks), the code was **not** changed. To unblock
the live smoke verification of Tasks 1 & 2, only the test client's
`intake_answers.current_supplements` value was normalised to a string (data,
not code), after which the intake page loaded cleanly and SMOKE Task 1
passed.

**Recommended fix (awaiting approval — one line, defensive):** in `Section5`,
coerce before splitting, e.g.
`const supps = Array.isArray(form.current_supplements) ? form.current_supplements : String(form.current_supplements || '').split(',').map(s => s.trim()).filter(Boolean)`
— or normalise array→string in the `useIntakeAnswers` hydration for
string-typed FormState fields. Either is a small, isolated change; happy to
apply on your go-ahead as a fast follow-up.

---

## Status

Tasks 1–5 complete and pushed. Five approved changes delivered:
display-condition (PEM), downstream wiring (energy timing × 3 surfaces),
bug fix (synopsis/body-story field names), dead-code archival, and this
report. One pre-existing crash surfaced and root-caused for decision — not
fixed, per scope.
