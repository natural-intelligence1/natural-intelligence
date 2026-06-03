# Sprint B — Intake Intelligence Remediation — Report v2 (expanded scope)

**Date:** 2026-06-03
**Supersedes:** `sprint-b-intelligence-remediation-report.md` (the narrow v1
run). This v2 covers the founder-expanded scope: full synopsis signal
activation, the `scoreHypotheses()` replacement design, and the
resume-hydration fix — plus the v1 deliverables (PEM ungate, energy timing
wiring, field repair, dead-engine archive).

**Commits (this expanded run, on top of the v1 chain):**
`67582ad` synopsis signal enrichment · `<design>` scoreHypotheses design ·
`8c53dc8` resume fix (build-failed, superseded) · `fe16f8e` resume fix
(clean). All on `origin/main`.

---

## Findings

1. **The synopsis was blind to most collected signals — even after the v1
   field-name repair.** v1 fixed the synopsis reading *non-existent* columns.
   But it still never queried `intake_answers` at all, so the entire Tier A
   answer set (PEM, severity baseline, energy timing, aggravating/relieving
   factors) was invisible to it. Several `intake_responses` signals
   (`symptom_pattern`, `timeline_trigger`, `psychosocial_worry`) were also
   present but unused.

2. **PEM was wired everywhere except the synopsis.** After Task 1/2,
   `post_exertional_worsening` fed the body story, practitioner workspace, and
   What We Heard — but not the synopsis. The single most discriminating
   fatigue/Long-COVID signal was absent from the member-facing summary.

3. **The dead scoring engine's real problem was schema drift, not just
   disconnection.** Its `questionId`s (`energy_curve_pattern`,
   `gi_symptom_timing`, `cycle_symptom_pattern`, `hydration_colour`) never
   matched the live form. Any replacement must be guarded against this.

4. **A pre-existing intake-page crash (P0-class) — root-caused.**
   `/dashboard/intake` threw `current_supplements.split is not a function` and
   the dashboard error boundary swallowed the whole page. Cause: Section 5's
   supplements TagInput persists an **array** to `intake_answers`, while
   FormState types the field as a comma-joined **string** and Section 5 reads
   it with `.split(',')`. On resume, `useIntakeAnswers` hydrated the array over
   the string → crash. Affects any returning user who edited supplements via
   the chip input and resumes to/after the Medical section. **Untouched by the
   five tasks** — surfaced in v1, fixed in this run under the approved
   resume-hydration item.

5. **Process miss (owned).** My first resume-fix commit (`8c53dc8`) shipped a
   TypeScript error because my verify command piped `pnpm type-check` through
   `tail`, masking the non-zero exit. Vercel's build caught it (deploy → ERROR,
   never served; production stayed on the last-good deploy). Superseded by
   `fe16f8e` after re-verifying with **unmasked exit codes**. Lesson applied:
   exit codes are checked directly, never through a pipe.

---

## Decisions taken

- **Task 2 path (founder-decided):** read `energy_low_times` / `energy_curve`
  from `intake_answers` (they are not `intake_responses` columns), no
  migration, no duplication. Resume hydration fixed generically.
- **Synopsis enrichment scope:** activate existing signals only — no new
  intake questions — ranked by decision impact. Added the high-value set;
  deliberately omitted low-signal fields (`arrival_emotion`, granular
  gi/hormonal detail) to avoid prompt bloat.
- **`scoreHypotheses()` shape:** surfaces **patterns** (confidence +
  supporting/contradicting signals + missing info + contradictions), **not**
  named hypothesis scores. Practitioners own hypotheses; NI surfaces patterns.
  Implementation deferred to Phase D.0; this run delivers the contract + field
  mapping + a schema-drift guard-test spec.
- **Resume-hydration fix:** generic coercion (array → joined string for any
  string-typed FormState field), not a one-off `current_supplements` patch.
- **Crash remediation vs scope:** in v1 the crash was surfaced, not fixed
  (outside the five tasks). The founder's expanded brief explicitly approved
  the resume-hydration fix, so it was fixed here.

---

## Signals activated this run

**Now consumed by the synopsis (were collected but unused):**

| Signal | Source | Tier |
|---|---|---|
| `post_exertional_worsening` (PEM) | intake_answers | A |
| `energy_low_times` + `energy_curve` (via `buildEnergyTimingBlock`) | intake_answers | A |
| `concern_severity_baseline` | intake_answers | A |
| `symptom_pattern` (trajectory) | intake_responses | B |
| `timeline_trigger` (what changed) | intake_responses | A |
| `aggravating_factors` / `relieving_factors` | intake_answers | B |
| `psychosocial_worry` | intake_responses | B |

**Already activated in v1 (recap):** PEM ungated to Chapter 3 (universal);
energy timing → What We Heard + body story + workspace; synopsis/body-story
field names repaired; dead engine archived.

**Live verification this run:**
- Synopsis regenerated post-enrichment opens by acknowledging the signature
  question and now grounds in `diagnosed_conditions` (hypothyroidism + iron
  deficiency) — data it was previously blind to.
- Resume-hydration fix: `/dashboard/intake` loads cleanly with
  `current_supplements` stored as an array (the exact prior crash trigger) —
  **no data normalisation needed**, the code coerces it.

---

## Remaining gaps

1. **Energy timing on the synopsis is verified by construction, not by a
   regenerated-synopsis DOM capture** — the enrichment deploy + a fresh
   regen with energy data seeded would close this; low risk (same block the
   body story uses).
2. **What We Heard energy bullet** still lacks a live Chapter-5 DOM capture
   (the intake form-driver can't synthetically traverse Chapter 4's multi-step
   Daily Life). Verified by construction + green build.
3. **`scoreHypotheses()` is design-only** — no pattern engine runs yet; the
   synopsis/body story still reason from raw signals, not from a pattern
   summary. That is the Phase D.0 prize.
4. **Temporal correlation across domains** (gut↔mood, sleep↔mood ordering)
   remains uncaptured and unmodelled — Phase D.1.
5. **Recovery-time and functional-loss-trajectory signals** (remediation doc
   §5, near-term) are not yet added — they need a small migration and were
   explicitly out of this run.
6. **The supplements data-shape inconsistency at the source** (TagInput writes
   an array to `intake_answers` while the string lives in `intake_responses`)
   is now *tolerated* by the hydration guard, but the dual-shape persistence
   is still a smell worth normalising at the write side in a later pass.

---

## Recommended next priorities

1. **Phase D.0 — build `scoreHypotheses()`** per `scoreHypotheses-design.md`.
   Highest leverage: it turns the now-activated signals into surfaced patterns
   for What We Heard, both AI prompts, and a practitioner "Patterns" panel.
   Includes the schema-drift guard test so the old failure can't recur.
2. **Near-term schema sprint** (remediation doc §5): functional-loss
   trajectory, recovery-time-after-exertion, infection-onset structured flag —
   each is high decision-impact and converts free text to structured input.
3. **Normalise supplements persistence** at the write side (store a string in
   both tables, or an array in both) so the hydration guard becomes
   belt-and-braces rather than load-bearing.
4. **Wire `buildPatternBlock()`** (once D.0 lands) into body story + synopsis,
   replacing ad-hoc raw-signal listing with the pattern summary.
5. **Backfill live DOM captures** for the two by-construction smokes (energy
   bullet in What We Heard; energy timing in the regenerated synopsis) when a
   reliable way to drive the intake form is available.

---

## Build state (final, unmasked exit codes)

| Check | Exit |
|---|---|
| web type-check | 0 |
| web build | 0 |
| web lint | 0 (pre-existing warnings only) |
| care type-check | 0 |
| care build | 0 |
| care lint | 0 |
| db test | 0 (213 passing) |

Production: `fe16f8e` READY on `natural-intelligence.uk`; intake page loads
with the previously-crashing array data. All work on `origin/main`.
