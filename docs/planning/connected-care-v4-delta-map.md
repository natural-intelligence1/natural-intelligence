# Connected Care V4 — delta map

**Branch:** `care-journey-v4-connected` · **Written:** 2026-10-06/08 (overnight build)
**Status:** working document. Nothing here is a commitment or a schedule.

The point of this table is to stop V4 being rebuilt from scratch. For each
capability the mission named, it records what **actually exists today**, what
can be **reused**, what the **genuine delta** is, and whether it was built in
this session. "Actual state" is what the code and the live schema say, not what
a roadmap says.

A standing correction that shaped several rows: **production `main` does not
contain the Sprint 4–6 application code** (`credentialing.ts`, `careTeamLive.ts`,
`fieldRegistry.ts`, `synopsisMapping.ts`, `governanceControls.ts`) even though
their **database migrations are applied**. Schema and application code are
therefore out of step in production, and several "exists" entries below mean
"exists on a branch", not "is live".

---

## 1. Intake

| Capability | Actual state | Reuse | Genuine delta | Built tonight |
|---|---|---|---|---|
| Intake question engine | V2 engine exists and is walkthrough-verified: `registry.ts`, `flow.ts`, show-if branching, autosave queue. Behind **two** flags, both off in production (`INTAKE_V2_ENABLED` + `INTAKE_COLLECTION_ENABLED`). | All of it. V4 is not a new engine. | None — V4 was never a replacement. The delta was that nothing *mapped* V2's sections onto a journey. | ✅ `journey.ts` — 10 canonical chapters, each declaring which V2 registry sections it contains, with `unmappedSections()` asserting complete coverage so a section cannot be silently orphaned. |
| Field registry | `fieldRegistry.ts` exists. Real field count **384**, reducing to ~180 real concepts. | All of it. | None. The "V4 needs 1,000 fields" framing was wrong. | — (established in the earlier reconciliation) |
| Branch lifecycle | Show-if branching existed, but a collapsed branch and an unasked question were indistinguishable from a negative answer. | The branching itself. | A branch needed a *lifecycle* and "never asked" needed to be a first-class state. | ✅ `branchLifecycle.ts` — `collapsed → activated → expanded → factually_sufficient → summarised`, `reopenBranch()` preserving answers, `wasNeverAsked()`. |
| Provenance | 4 states (`client_reported`, `practitioner_verified`, `corrected`, `missing`). | The four, unchanged and still first in order. | 4 states cannot distinguish "not asked" from "unanswered" from "declined", nor mark what NI organised vs what a practitioner concluded. | ✅ Extended to **11** states with `SYSTEM_SETTABLE_PROVENANCE` / `PRACTITIONER_ONLY_PROVENANCE`, so NI cannot set a clinical state. |

## 2. The factual record

| Capability | Actual state | Reuse | Genuine delta | Built tonight |
|---|---|---|---|---|
| Concern as the hub | Answers lived per-question. No object tied a concern to its timeline, influences and evidence. | The underlying answers. | The connective object itself. | ✅ `concerns.ts` — `ConcernCard` holding **references, not copies**, so a fact lives in one place; plus `deriveClarificationItems()`. |
| Timeline / influences (ATM) | Nothing. | — | Everything, and the hard part is refusing to infer. | ✅ `influences.ts` — `CAUSAL_CUES` vs `TEMPORAL_ONLY`; refuses with `timing_only` / `no_explicit_link` / `kind_not_supported_by_wording` rather than inventing a link the client did not state. |
| Health Story / Synopsis | `synopsisMapping.ts` mapped fields to sections; **no generator existed**. | The section mapping and its audit metadata. | The generator, and its two structural guarantees. | ✅ `synopsis.ts` — 11 sections, `SYNOPSIS_BUILDER_VERSION`. Filters out `practitioner_interpreted`; **never** emits "systems under stress". |
| Corrections | `V2Correction` existed — a correction sits beside the original, never over it. | All of it. | None. | — |
| Dated updates | Nothing. The submitted snapshot was frozen but later changes had nowhere to go. | `buildCaseSnapshot`'s deep freeze. | The update record and the review delta. | ✅ `updates.ts` — `DatedUpdate`, `buildSinceLastReview()`, and `describeSequence()` which reports order and refuses causation. |

## 3. Practitioner experience

| Capability | Actual state | Reuse | Genuine delta | Built tonight |
|---|---|---|---|---|
| Care team / Lead | **Applied** in 0057: `case_team_roles`, one active Lead per case enforced by partial index + trigger, `care_team_health_profile` view, SELECT-only grants. | All of it. | None at the data layer. | — |
| Identified practitioner workspace | **Returns `notFound()` in production**: `client_cases` has no practitioner SELECT policy. | — | A policy change, which is out of scope for an unauthorised overnight session. | ❌ Deliberately not attempted. |
| Call Sheet | Digging trees existed in `callSheet.ts` (9 trees, original NI wording). No assembly layer. | All 9 trees and `callSheetTreesForAnswers`. | Assembly: ordering, gap routing, safety-first, practitioner entries. | ✅ `callSheetBuilder.ts` — and the guarantee that **every emitted prompt is verbatim from a fixed table**, so NI composes no clinical prose about a client. |
| Case overview | Nothing journey-shaped. | — | The surface. | ✅ Preview `B` — "Since last review" as the hero, rendered by the real `buildSinceLastReview()` rather than hand-written markup. |

## 4. Protocol → day

| Capability | Actual state | Reuse | Genuine delta | Built tonight |
|---|---|---|---|---|
| Protocol signing/versioning | **Does not exist.** `member_protocols` has no version, signature, author or history column. `assigned_by` exists and is never written. A **client** creates their own protocol from a template. `apps/care` contains no protocol code at all. | `member_protocols` / `protocol_items` / `protocol_templates` as the base tables. | The entire signing and versioning contract. | ⚠️ UX contract demonstrated (preview `C`); migration **0059 prepared and NOT applied**. |
| DailyPath | **Broken in production.** Live `daily_adherence` has no `item_id`, but `dailypath/page.tsx:46,75,95` and `actions.ts:255` all depend on it. `0029` *declares* `item_id` but is a retrospective record of hand-made tables and says so — the live table diverged. | The surrounding DailyPath UI. | `item_id`, the unique constraint, and author/version on each action. | ⚠️ In 0059, **not applied**. Includes an explicit warning that a *partial* unique index may not satisfy PostgREST's `onConflict` inference — to be verified before anyone relies on it. |
| Nutrition | Scattered; no separation between what a client eats, what they believe, and what a practitioner advises. | — | The separation itself, enforced by types. | ✅ `nutrition.ts` — three non-interchangeable types; `practitionerAdvice()` refuses without both a named author **and** a protocol version. |
| Aims & outcomes | Nothing. | — | Both. | ✅ `therapeuticAim()` refuses predictive/promissory wording; outcome measures are client-rated or external record only, and `describeChange()` states two values without evaluating them. |

## 5. Safety

| Capability | Actual state | Reuse | Genuine delta | Built tonight |
|---|---|---|---|---|
| Safety capture | `deriveV2SafetyReviewItems` + `safetyOptions` on approved questions. Repo currently has **14** `safety_capture` questions. | All of it, untouched. | None at the rule layer. | — |
| Approved rule set | Clinical validation is **CLOSED / APPROVED WITH AMENDMENTS** (37 approved; "36 items on the current NI sheet map to Annex 1"). CV01–CV17 is **not** current status. | The approved reply document. | Reconciling 14 repo questions against the approved set — a content task needing clinical sign-off, not a code task. | ❌ Not attempted. Loading the older 36-rule candidate over a newer approved set was explicitly out of bounds. |
| Review workflow | Items were derived and surfaced, then **nothing**. `reviewStatus: 'unreviewed'` had no transitions. | The derived item, carried verbatim. | The whole workflow. | ✅ `safetyWorkflow.ts` — machinery only. `open` is the only state NI can create; a decision needs prior acknowledgement, a named reviewer and the practitioner's **own words**; an item cannot close without a recorded human decision; reopening preserves the prior decision. |

## 6. Known gaps left open on purpose

| Gap | Why it is still open |
|---|---|
| Migration 0059 unapplied | Applying migrations to shared databases was not authorised overnight. It is also unverified against the live catalogue — the Supabase MCP connection dropped mid-session, so its column lists come from the generated types, not a live `pg_catalog` read. |
| `0055_functional_ranges_source_metadata.sql` still unapplied | Pre-existing; untouched tonight. |
| Practitioner workspace `notFound()` | Needs an RLS policy change on `client_cases`. |
| Sprint 4–6 code absent from `main` | Needs a deliberate, reviewed promotion decision. Not a merge to run unattended. |
| `agreementGate.test.ts` (4 scenarios) | Never written — the app quit twice mid-write in an earlier session. Still outstanding. |
| The 3 agreement documents + prospectus pack | Located in the bundle's `supporting/` folder; deliberately not loaded as real content. |
| Under-18 handling | Left unencoded. "Permanently inactive" was explicitly not to be written as NI policy. |
| Rendered 320px / 200% accessibility pass | The previews sit behind admin auth; verification was static. One authenticated click from `/route-map` completes it. |
