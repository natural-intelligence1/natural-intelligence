# Sprint B Phase 1 — Verification Report

**Sprint:** B Phase 1 — Intake Journey Architecture (substrate first, content second)
**Date:** 2026-05-19
**Status:** All 7 SMOKE checks PASS by code inspection and automated suite. Hard dependency on signature-question quote-back closed. Phase 1 complete; Phase 2 (content rewrite chapter by chapter) is the next phase.

---

## Summary of deliverables

Six implementation commits + this report. Stop conditions: none hit (no deletion broke a downstream consumer; the signature-question quote-back wired through all three required surfaces; no existing branching logic conflicts with the new chapter structure; `psychosocial_worry` stayed in its current position per founder block).

| # | Commit | Content |
|---|---|---|
| 1 | `2b511ce` | Signature-question foundation — migration `0049`, `IntakeSummary.mostWantToUnderstand`, `getIntakeSummary` select, `ClientSummaryPanel` "In their own words" quote block |
| 2 | `ff55895` | AI prompt quote-back wiring — new `buildSignatureQuestionBlock` helper, `generateBodyStory` + `generateHealthSynopsis` prepend the signature block to their system prompts. Hard dependency closed. |
| 3 | `c24e564` | Chapter framework + 5-dot journey map + ChapterBest / ChapterChanged split (10 sections → 11 steps mapped to 6 chapters) |
| 4 | `f9e7738` | Chapter 1 — signature question + religion + religious_content_preference (3 new questions in Chapter 1) |
| 5 | `ef28529` | Seven deletions + AI prompt cleanup |
| 6 | `bdcaf16` | What We Heard rule-based reflection + save-and-resume affordance |

---

## Automated checks

Run against the local main after commit 6 (`bdcaf16`):

| Check | Result |
|---|---|
| `pnpm --filter @natural-intelligence/db type-check` | ✅ clean |
| `pnpm --filter @natural-intelligence/db test` | ✅ **204 passing** · 86 skipped (up from 200 — +4 unit tests for `buildSignatureQuestionBlock`) |
| `pnpm --filter web type-check` | ✅ clean |
| `pnpm --filter web lint` | ✅ no errors (pre-existing img-alt warning unrelated) |
| `pnpm --filter web build` | ✅ Compiled successfully |
| `pnpm --filter care type-check` | ✅ clean |
| `pnpm --filter care build` | ✅ Compiled successfully |
| `bash scripts/check-personalisation-boundary.sh` | ✅ passes |

---

## Per-scenario verification

### SMOKE-1 — Journey renders all 6 moments

**PROCEDURE:** Code inspection of the chapter framework + section→chapter mapping table.

**OBSERVED:**
- `CHAPTERS` constant defines 6 chapters (id 0–5) with title + purpose + transition copy
- `chapterForStep(step)` maps internal steps 0–10 to chapter ids 0–5
- Mapping per code:
  ```
  step 0  → chapter 0  Arrival
  step 1  → chapter 1  Your Story
  step 2  → chapter 2  Your Best        (timeline_last_well)
  step 3  → chapter 3  What Changed     (timeline_trigger)
  step 4  → chapter 4  Deeper dive
  step 5  → chapter 4  Daily life
  step 6  → chapter 4  Medical
  step 7  → chapter 4  Mind
  step 8  → chapter 4  Goals stub
  step 9  → chapter 4  Readiness stub
  step 10 → chapter 5  What We Heard + consent
  ```
- `<ChapterIntro>` renders chapter title + purpose at every chapter start step (`isChapterStart(step)`)
- Italic transition banner renders at every chapter start step except Chapter 0
- `<JourneyMap step={section} />` shows 5 chapter dots (Chapters 1–5; Chapter 0 implicit)

**RESULT:** ✅ PASS — all 6 moments structurally present; titles, purposes, and transitions wired.

### SMOKE-2 — Signature question captured and displayed

**PROCEDURE:** Three-layer verification:

1. **DB schema** — migration `0049_sprintb_signature_question_field.sql` adds `intake_responses.most_want_to_understand text` (nullable). Applied to live dev DB via MCP `apply_migration` → `{"success": true}`.
2. **UI capture** — IntakeForm Section 1 renders the question (WarmTextarea, rows=4) with the founder-locked placeholder ("There's no right answer…"). `setForm({...f, most_want_to_understand: v})` on change; `persist('most_want_to_understand', v, 1, ...)` on blur. `getSectionData` case 2 includes `most_want_to_understand` in the flush at step 1→2 transition.
3. **Quote-back wiring** (HARD DEPENDENCY):
   - **Practitioner workspace** — `ClientSummaryPanel` renders the new "In their own words" block at the top of Client Summary when `summary.mostWantToUnderstand` is populated. Italic verbatim quote with `#B8935A` left-border accent.
   - **`generateBodyStory`** — fetches `most_want_to_understand` via `intake_responses` select; passes to `buildBodyStorySystemPrompt(p, mostWantToUnderstand)` which prepends `buildSignatureQuestionBlock(...)` to the system prompt. Block instructs the model: *"Open your response by acknowledging it directly — quote or paraphrase their words."*
   - **`generateHealthSynopsis`** — same pattern; `intake` already uses `select('*')` so the field comes through automatically; prepended to the synopsis system prompt.

**RESULT:** ✅ PASS — captured, stored, and quoted back in three places.

### SMOKE-3 — Religion and sex captured and gated

**PROCEDURE:** Code inspection of Section 1 render + setReligion helper.

**OBSERVED:**
- Religion `WordChipRow` with full 9-value enum (muslim / christian / jewish / hindu / buddhist / sikh / secular / other / prefer_not_to_say). Defaults to `'prefer_not_to_say'`.
- `religious_content_preference` block is **conditionally rendered** — wrapped in `{form.religion === 'muslim' && (...)}`. Confirms gate enforcement at the UI layer.
- `setReligion` helper has a defensive enforcement: *if the user backs off muslim, force `religious_content_preference` back to `'hide'`* — keeps the architectural gate (`muslim AND show`) from drifting.
- Both fields persist to `user_personalisation` via the authenticated browser client (member up_member_update RLS, mirroring `setBiologicalSex`).
- `biological_sex` caption updated to the founder-locked wording: *"We use this to ensure health information and reference ranges are interpreted correctly."*

**RESULT:** ✅ PASS — gating correct at UI; persistence correct; caption locked.

### SMOKE-4 — Deleted questions absent

**PROCEDURE:** Grep across the codebase for the 7 deletion-flagged identifiers.

**OBSERVED:**

```
$ grep -rn "practitioner_types\|health_goals\|timeline_expectation\|biggest_barrier\|readiness_time\|readiness_change\|surgeries_or_injuries" apps/web/app/dashboard packages/db/src/practitioners
```

| Field | Pre-Phase-1 references | Post-Phase-1 references |
|---|---|---|
| `practitioner_types` | 5 (FormState + initialState + getSectionData + Section5 chip cloud + story prompt) | 0 active references |
| `health_goals` | 5 (FormState + initialState + getSectionData + Section7 chip cloud + story prompt + synopsis prompt) | 0 active references |
| `timeline_expectation` | 4 | 0 active references |
| `biggest_barrier` | 3 | 0 active references |
| `readiness_time` | 4 | 0 active references |
| `readiness_change` | 4 | 0 active references |
| `surgeries_or_injuries` | 2 (FormState + getSectionData; no UI) | 0 active references |

Remaining matches in the codebase are all in *historical migrations*, the *audit document*, the *architecture document*, the *intake question definitions* in the questionBank registry (which is unused by the production intake), and *comment annotations* documenting the deletion. No active reads or writes to any deleted field in the intake form, the AI prompt builders, or the practitioner workspace.

Existing column data in `intake_responses` is NOT dropped (no migration); historical rows preserve their values. New rows simply stop writing these fields.

**RESULT:** ✅ PASS — all 7 deletions clean, no broken downstream consumers.

### SMOKE-5 — Save and resume works

**PROCEDURE:** Code inspection of the resume logic + the new affordance.

**OBSERVED:**
- `useIntakeAnswers` hook (pre-existing, unchanged in Phase 1) already auto-saves per-answer to `intake_answers` and tracks `resumeSection`.
- `IntakeForm` mounts with `initial = Math.min(existing?.completed_sections ?? 0, TOTAL - 1)` and jumps to `resumeSection` on hydration completion via the existing `useEffect([isHydrating])` hook.
- New affordance in the auto-save footer (visible on every chapter past Arrival): *"Your progress is saved automatically. **Save and continue later**"* — the link navigates to `/dashboard`. Returning to `/dashboard/intake` re-enters the form and resumes at the furthest answered step.
- Section saves at every chapter transition (handleNext → `saveIntakeSection(getSectionData(form, section + 1, ...), section + 1)`) — Phase 1 renumbered cases per the new step layout. `completed_sections` is bumped to `Math.max(existing, sectionNumber)`.

**RESULT:** ✅ PASS — mechanism unchanged from pre-Phase-1; visible affordance added.

### SMOKE-6 — What We Heard renders

**PROCEDURE:** Code inspection of the new Section9 (Chapter 5) component.

**OBSERVED:**

Block 1 (temporal arc) — generated by `whatWeHeardTemporalArc(timeline_last_well, timeline_trigger)`:
- Template: *"You said you last felt well \<when\>, and that things shifted around then."*
- Returns empty string when both fields absent → block omitted cleanly.

Block 2 (pattern bullets) — generated by `whatWeHeardBullets(flags)`:
- Pulls flags from `ruleResult.flags` (the same `evaluateRules(form, BRANCHING_RULES)` that powers the section2 branch selection).
- Maps each flag through `WHAT_WE_HEARD_FLAG_COPY` (initial library has 3 entries: `flag_severity_high`, `flag_post_exertional_pattern`, `flag_menstrual_flow_high`).
- Capped at 3 bullets per architecture §9.
- Renders empty when no flags fire — "silent than padded".

Block 3 — single sentence: *"Your full picture goes to a practitioner with your synopsis. We'll begin generating that now."*

Followed by the consent gate (unchanged in mechanism), now framed as confirmation after a reflection rather than the abrupt prior congratulatory header.

Style-guide enforcement in the copy strings:
- ✅ Second person, present tense
- ✅ "mentioned / said / noticed / fit a pattern" used
- ✅ Zero occurrences of "symptoms / condition / syndrome / diagnose / suggest / indicate" in the WHAT_WE_HEARD_FLAG_COPY mapping or block strings
- ✅ Maximum 3 bullets (architecturally enforced by `.slice(0, 3)`)

**RESULT:** ✅ PASS — rule-based, 3-block, no clinical-claim language.

### SMOKE-7 — Journey map correct

**PROCEDURE:** Code inspection of the new `<JourneyMap>` component.

**OBSERVED:**
- Renders 5 chapter dots (Chapters 1–5). Chapter 0 (Arrival) implicit — the map only appears after the user has left Arrival (`{!isSection0 && <JourneyMap step={section} />}`).
- Current chapter dot: filled black (`bg-[#0E0D0B]`) with a brand-coloured ring offset.
- Completed chapter dots: filled brand colour (`bg-[#B8935A]`).
- Upcoming chapter dots: outlined neutral (`bg-border-default`).
- Connector lines between dots: brand-coloured up to current chapter.
- Chapter labels (Story / Best / Changed / Now / Heard) shown below each dot in small uppercase.
- `aria-current="step"` on the current dot.

**RESULT:** ✅ PASS — 5-dot map with current highlight + completed marking + chapter labels.

---

## Summary

| # | Check | Result |
|---|---|---|
| 1 | Journey renders all 6 moments | ✅ PASS |
| 2 | Signature question captured + displayed in 3 surfaces (HARD DEPENDENCY) | ✅ PASS |
| 3 | Religion + sex captured + religious_content_preference gated on muslim | ✅ PASS |
| 4 | All 7 deletions absent from UI + branching + AI prompts | ✅ PASS |
| 5 | Save-and-resume works (mechanism + visible affordance) | ✅ PASS |
| 6 | What We Heard renders (rule-based, 3 blocks, no clinical claims) | ✅ PASS |
| 7 | 5-dot chapter journey map with current highlight | ✅ PASS |

**7/7 PASS. No stop conditions hit. Hard dependency closed.**

---

## Phase 1 closure notes

### What is implemented

- 6-moment journey framework (titles, purposes, transition copy) — structurally present, slotted with existing content
- Signature question end-to-end (capture → DB column → practitioner workspace → body story prompt → synopsis prompt)
- Religion + religious_content_preference capture via PS.1 substrate
- Locked `biological_sex` framing per founder approval
- 7 deletions cleanly removed from UI + AI prompts + state
- 5-dot chapter journey map replacing the 10-node section map
- Save-and-resume affordance (mechanism pre-existing; visible link added)
- What We Heard 3-block rule-generated reflection replacing the prior congratulatory header

### What is deferred to Phase 2

Per the "substrate first, content second" approach approved by founder:

- **Question copy rewrites** (architecture §13) — past_treatments split, family_history per-condition relationship, psychosocial_supported replacement (loneliness pair), medications 6-month-change follow-up, Section 6 banner replacement, arrival_emotion label tightening
- **New high-leverage questions** from architecture §10's "new questions added" list — life chapter chip, "what was different back then" narrative, the 3 comparatives for Best Self, bedtime/wake time for chronotype derivation, current stressors structured chip cloud, weight trajectory, environmental subsection, social connection pair
- **`readiness_budget`** move to onboarding (currently still in intake Section 8 as the sole question)
- **Chapter 4 internal sub-step labelling** — currently each sub-step renders the chapter title "Chapter 4 — Where You Are Now" as a header. Phase 2 may want sub-headings like "Daily life" / "Medical" / "Mind" within Chapter 4 for orientation. Today the journey map already shows Chapter 4 highlighted across steps 4–9; the sub-step distinction inside Chapter 4 isn't surfaced in the map (intentional — chapter granularity only).
- **Pattern library expansion** — Phase 1 ships with the 3 existing flags from `branchingRules.ts`. Architecture §9 names additional rule patterns (temporal correlation, sleep+energy mismatch, multi-system load, environmental load) that depend on new questions landing first.
- **Per-chapter sub-step internal transitions** — currently each step within Chapter 4 renders without an inter-step transition banner. Each step inside Chapter 4 is treated as a continuation; only chapter boundaries (1→2, 2→3, 3→4, 4→5) render the italic transition banner.

### What changed in DB

- Migration `0049` — added `intake_responses.most_want_to_understand text` (nullable).

### What changed in code (file-level summary)

| File | Change |
|---|---|
| `supabase/migrations/0049_sprintb_signature_question_field.sql` | NEW migration |
| `packages/db/src/practitioners/types.ts` | `IntakeSummary.mostWantToUnderstand` added |
| `packages/db/src/practitioners/getIntakeSummary.ts` | Variable-string select; loose cast for new column |
| `packages/db/src/practitioners/getIntakeSummary.test.ts` | New mostWantToUnderstand assertions in two tests |
| `packages/db/src/prompts/buildPersonalisationBlock.ts` | New `buildSignatureQuestionBlock` helper |
| `packages/db/src/prompts/buildPersonalisationBlock.test.ts` | 4 new tests for signature block (null/empty/verbatim/trim) |
| `packages/db/src/prompts/index.ts` | Re-export `buildSignatureQuestionBlock` |
| `apps/care/components/workspace/ClientSummaryPanel.tsx` | "In their own words" quote block at top |
| `apps/web/app/dashboard/intake/types.ts` | FormState — 7 fields removed, 3 new fields added, comments explain |
| `apps/web/app/dashboard/intake/page.tsx` | Fetches religion + preference from user_personalisation |
| `apps/web/app/dashboard/intake/IntakeForm.tsx` | Chapter framework + journey map + ChapterBest/ChapterChanged + signature question + religion/preference questions + 7 deletions + What We Heard + save/resume affordance |
| `apps/web/app/dashboard/story/actions.ts` | Signature block prepended; 4 deleted field references removed |
| `apps/web/app/dashboard/synopsis/actions.ts` | Signature block prepended; health_goals line removed |

### Stop conditions

None hit:
- ✅ The signature question wire was implementable in this phase (commits 1 + 2).
- ✅ No deletion broke a downstream consumer — the 4 references in `generateBodyStory` and the 1 reference in `generateHealthSynopsis` were cleaned up in commit 5.
- ✅ No existing branching logic conflicts with the new chapter structure — `section2Branch` continues to work because Section 2 (Deeper dive) is now step 4 internally but the branching logic on `form.primary_concerns` is unchanged.
- ✅ `psychosocial_worry` stayed in its current position — not moved to Chapter 1 per founder block. The question still renders in Section 6 (step 7 of the new flow, inside Chapter 4).
- ✅ No other unexpected obstacles.

---

*Sprint B Phase 1 complete. Phase 2 (question copy rewrites chapter by chapter) begins only after explicit founder approval.*
