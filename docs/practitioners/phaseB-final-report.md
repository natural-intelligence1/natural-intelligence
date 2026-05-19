# Phase B Final Report — Practitioner Operational UX

**Sprint:** Phase B — Practitioner Operational UX
**Sub-phases:** B.1 Inbox → B.2 Workspace → B.3 Completion → B.4 Escalation
**Date opened:** 2026-05-08 (design proposal commit `28dd332`)
**Date closed:** 2026-05-18 (B.4 verification commit `41a8070`)
**Status:** Closed

---

## 1. The operational loop, delivered

Phase B turns the practitioner role from a schema-level construct into a working seat at the platform. Before B.1, a practitioner could be invited and given a row in the database, but had no path through the product. By the end of B.4 they can sign in, find their work, review the full clinical record of a case, record a structured decision, and either complete or hand off — entirely inside the care app, without any operational scaffolding.

The flow begins at `/cases`, a triaged inbox of the practitioner's own work items. Items are grouped into Needs Review · In Progress · Escalated · Completed Recently and sorted by urgency (overdue → due-soon → normal). Each row shows the client name, primary concern, work type, and a time-since label. Selecting a row opens the Case Review Workspace at `/cases/[caseId]/work/[workId]`, a three-column layout: section nav rail on the left, the case content panels in the middle, and a sticky Review Actions panel on the right.

The middle column presents the full case context: Client Summary (AI-summarised intake), Reasoning trace, Case History (timeline of `case_events`), Lab Signals (BioHub), and Prior Reviews. The action panel on the right is a five-state machine — Compose → Confirm → Loading → Success (with error → return-to-compose). Drafts persist in localStorage keyed by work ID. Multi-tab edits trigger an amber banner; degraded-storage environments fall back to a non-persistent compose mode.

Submitting a decision (approved / needs revision / escalated) writes a single `practitioner_decision` case_event with an eight-field payload (work_item_id, work_type, decision, notes, recommendation, practitioner_id, practitioner_display_name, completed_at). The work item transitions to `completed` for approved/needs-revision and to `escalated` for escalations, with `client_cases.escalation_required = true` raised atomically in the same SECURITY DEFINER transaction. The inbox rebins the item; reloading the workspace renders a read-only success view derived directly from the work item's `status` column — no event-fetch needed.

The escalation path has its own affordances: a required reason field, five shortcut prefix buttons (`Senior practitioner / Specialist referral / GP letter / Urgent safety / Other`) with append/replace/clear semantics for fast labelling, amber visual treatment to signal seriousness, and distinct confirm copy (*"You are about to escalate this case for admin review."*). Admin handoff for v1 is SQL-only: admins can query `case_practitioner_work` filtered by `status='escalated'` joined to `client_cases.escalation_required = true` to surface the queue. An admin UI is deferred to a Phase C-adjacent sprint.

Underneath this UX, three layers of authorisation defend every write: RLS on `case_practitioner_work` and `case_events` (Layer 1), the RPC's `WHERE id = p_work_id AND practitioner_id = auth.uid() AND status IN ('assigned','in_review') FOR UPDATE` check (Layer 2), and a `'use server'` action that performs a server-side `getUser()` and never accepts a client-supplied practitioner_id (Layer 3). All three were verified live by spoofing a second practitioner's JWT against another's work — zero rows visible, RPC raises, server action rejects on the same path.

---

## 2. Sub-phase commit log

### Design phase (pre-implementation)

| Commit | Title |
|---|---|
| `28dd332` | docs(practitioners): Phase B design proposal — practitioner operational UX |
| `60c2373` | docs(practitioners): Phase B addendum — open question decisions, access pattern, and section clarifications |
| `e0a0648` | docs(practitioners): tighten Q6 sunset condition — Option A required before Phase C |

### B.1 — Inbox

| Commit | Title |
|---|---|
| `a741d37` | feat(db): listWorkForInbox + startWorkItem helpers and tests |
| `ebf9ee0` | refactor(care): extract reasoning page into shared components + add TopBar |
| `4a0562e` | feat(care): /cases/[caseId]/work/[workId] workspace route (B.1) |
| `d88d455` | feat(care): replace /cases page with practitioner inbox |
| `c1345fd` | docs(practitioners): B.1 verification report |
| `94227e0` | fix(db/care): close F1 — extend case_practitioner_select, revert to authenticated client |
| `0f84d68` | docs: update B.1 verification report — F1 closed |

### B.2 — Workspace

| Commit | Title |
|---|---|
| `6b978b0` | feat(db): B.2.a — workspace helpers + tests |
| `1e8f8f0` | feat(care): B.2.b-f — workspace panel components, nav rail, action panel |
| `ce279d0` | feat(care): B.2.g — assemble full workspace route |
| `ab6b063` | docs(practitioners): B.2 verification report |
| `944e800` | docs(practitioners): B.2 smoke verification observed results |

### F2 corrective (between B.2 and B.3)

| Commit | Title |
|---|---|
| `b6a6c9f` | feat(db): add practitioner_client_identity view for assigned-client identity access (F2) |
| `b0e13a8` | refactor(care): use practitioner_client_identity view in inbox and workspace (F2) |
| `04f35fa` | docs(practitioners): F2 fix verification — practitioner_client_identity view |

### B.3 — Completion + writes

| Commit | Title |
|---|---|
| `a0a3192` | feat(db): extend case_events event_type constraint + update complete_practitioner_work RPC (B.3) |
| `db4baed` | feat(care): completion server action — submitReview with Layer 3 auth (B.3) |
| `175905d` | feat(care): ActionPanel 5-state completion machine — Compose→Confirm→Loading→Success (B.3) |
| `c81c785` | chore(care): CaseHistoryPanel label + payload summary for practitioner_decision events (B.3) |
| `9126e89` | fix(db): extend case_events_practitioner_select to cover completed/escalated work (F3) |
| `c067e35` | docs(practitioners): B.3 verification report — 14/14 PASS, F3 found and closed |

### B.4 — Escalation + admin handoff

| Commit | Title |
|---|---|
| `f743dc6` | feat(db): escalation path in complete_practitioner_work RPC (B.4) |
| `312c9ad` | feat(care): escalation flow in ActionPanel + ↑ marker in CaseHistoryPanel (B.4) |
| `41a8070` | docs(practitioners): B.4 verification report — 16/16 PASS, Phase B complete |

**Total Phase B commits: 24** (3 design + 7 B.1 + 5 B.2 + 3 F2 + 6 B.3 + 3 B.4)

---

## 3. Migrations applied (Phase B)

| Sub-phase | DB migration name | File in repo | Description |
|---|---|---|---|
| B.1 (F1 fix) | `extend_case_practitioner_select_all_statuses` (20260511010633) | **— not in repo —** | Drops the `status IN ('assigned','in_review')` filter from the `case_practitioner_select` policy on `client_cases`. Practitioners can read cases they hold work items for regardless of work status. |
| F2 fix | `0041_f2_practitioner_client_identity_view` | `supabase/migrations/0041_…sql` | Adds `practitioner_client_identity` SECURITY DEFINER view exposing `(id, full_name, avatar_url, role)` to practitioners holding work for the client. Access boundary is the view's WHERE clause, not a new `profiles` policy. |
| B.3 | `0042_b3_extend_case_events_event_type_check` | `supabase/migrations/0042_…sql` | Adds `'practitioner_decision'` to the `case_events_event_type_check` constraint. |
| B.3 | `0043_b3_update_complete_practitioner_work_rpc` | `supabase/migrations/0043_…sql` | Rewrites the RPC to write `event_type='practitioner_decision'` with the structured 8-field payload (incl. `practitioner_display_name` resolved inside SECURITY DEFINER). |
| F3 fix | `f3_extend_case_events_practitioner_select` (20260514232740) | `supabase/migrations/0044_f3_…sql` | Extends `case_events_practitioner_select` to cover `completed` and `escalated` statuses — mirroring the F1 fix on `case_practitioner_work`. |
| B.4 | `b4_escalation_path_in_complete_practitioner_work` (20260518183721) | `supabase/migrations/0045_b4_…sql` | Conditional `status = CASE WHEN p_decision='escalated' THEN 'escalated' ELSE 'completed' END`; atomically sets `client_cases.escalation_required = true` for escalations. |

### Migration drift — action item

The F1 fix migration is **applied to the DB but absent from the migrations directory**. The `0040` slot in `supabase/migrations/` was used for an unrelated V.8 fix (`0040_v8_reasoning_traces_active_unique.sql`), and the F1 migration `extend_case_practitioner_select_all_statuses` was applied directly via MCP `apply_migration` during the F1 corrective work without a corresponding numbered file being written.

**Effect:** `supabase db reset` from the current `supabase/migrations/` directory would produce a database without the F1 fix — practitioners would lose read access to `client_cases` rows joined to their completed/escalated work, breaking the Completed Recently and Escalated inbox sections.

**Recommended action before Phase C:** Backfill a numbered migration file (e.g. `0040b_f1_extend_case_practitioner_select_all_statuses.sql`) capturing the F1 policy DDL, so the migrations directory is reproducible. This is the only piece of drift; F3 and B.4 RPC migrations are both present.

---

## 4. Helpers added (Phase B)

All helpers exported from `@natural-intelligence/db/practitioners` via `packages/db/src/practitioners/index.ts`.

| Helper | Location | Sub-phase | Purpose |
|---|---|---|---|
| `listWorkForInbox` | `packages/db/src/practitioners/listWorkForInbox.ts` | B.1 | Returns all work items for a practitioner inbox (active + recently completed), with batch-fetched client identities. |
| `startWorkItem` | `packages/db/src/practitioners/startWorkItem.ts` | B.1 | Idempotent `assigned → in_review` transition fired when the practitioner opens a workspace. |
| `getIntakeSummary` | `packages/db/src/practitioners/getIntakeSummary.ts` | B.2 | Returns AI intake summary for a client (admin-client, Q6 exception). |
| `getCaseEvents` | `packages/db/src/practitioners/getCaseEvents.ts` | B.2 | Returns chronological case_events for a case (authenticated client; RLS = `case_events_practitioner_select`). |
| `getBioHubSignals` | `packages/db/src/practitioners/getBioHubSignals.ts` | B.2 | Returns recent biomarker results + trajectory (admin-client, Q6 exception). |
| `getPriorReviews` | `packages/db/src/practitioners/getPriorReviews.ts` | B.2 | Returns other practitioners' recent reviews on the same case (excluding the current work item). |
| `submitReview` (server action) | `apps/care/app/cases/actions.ts` | B.3 | `'use server'` action wrapping `completeWorkItem` with Layer 3 `getUser()` check and a discriminated-union result. |

Re-used from G.1 substrate without modification in Phase B: `assignWork`, `completeWorkItem`, `getPractitioner`, `getClientTeam`, `createClientPractitionerLink`, `endClientPractitionerLink`, `listClientLinksForPractitioner`, `updatePractitionerStatus`, `listAssignedCases`, `listAssignedWork`.

---

## 5. Findings surfaced and closed

### F1 — `case_practitioner_select` scoped only to active work

| | |
|---|---|
| **Surface** | `client_cases` RLS policy `case_practitioner_select` restricted EXISTS subquery to `status IN ('assigned','in_review')`. |
| **Disclosure** | B.1 verification — `listWorkForInbox` couldn't read `client_cases` joins for completed/escalated work without an admin client. |
| **Decision** | Source fix. The policy intent was over-narrow; a practitioner who holds *any* work item on a case has legitimate clinical-continuity interest in reading that case regardless of work status. |
| **Fix** | Migration `extend_case_practitioner_select_all_statuses` dropped the status filter (see drift note in §3). Code reverted to authenticated SSR client. |
| **Verification** | B.1 verification update (`0f84d68`) + integration test asserting practitioner A cannot see B's completed or escalated items (the cross-practitioner scope is still enforced by `practitioner_id = auth.uid()`). |

### F2 — `profiles` RLS blocked client identity reads

| | |
|---|---|
| **Surface** | Workspace header and inbox rows rendered "Unknown" because `profiles` only allowed `auth.uid() = id` SELECT. |
| **Disclosure** | B.2 smoke verification (`944e800`). |
| **Decision** | Source fix via column-scoped view, not a broader `profiles` policy. Explicit rejection of full-row SELECT: application-layer column projection is not a security boundary, and future sensitive client attributes (bio, religion, content preferences) must not be exposed by precedent. |
| **Fix** | Migration `0041_f2_practitioner_client_identity_view` introduces `practitioner_client_identity` SECURITY DEFINER view exposing only `(id, full_name, avatar_url, role)`. Code in `listWorkForInbox` and workspace page rewritten to fetch identity via the view. |
| **Verification** | `docs/practitioners/F2-fix-verification-report.md` — 7/7 checks PASS. UI renders real client name; arbitrary enumeration blocked. |

### F3 — `case_events_practitioner_select` scoped only to active work

| | |
|---|---|
| **Surface** | `CaseHistoryPanel` showed "No events recorded" on a freshly-completed workspace because the policy gated on `status IN ('assigned','in_review')`, hiding events the moment the work item became `completed` — including the `practitioner_decision` event the practitioner had just written. |
| **Disclosure** | B.3 smoke verification — discovered while validating that the case history reflected the new event. |
| **Decision** | Source fix, mirroring F1. Practitioners should retain case-history visibility after completion/escalation for continuity. |
| **Fix** | Migration `0044_f3_extend_case_events_practitioner_select` extends the policy to `('assigned','in_review','completed','escalated')`. |
| **Verification** | B.3 verification report — 14/14 PASS including a re-test of the CaseHistoryPanel showing the new `Practitioner decision · ↑ Escalated · <name>` row. |

### F4 — none surfaced

B.4 verification produced 16/16 PASS with no new findings. The escalation path's three auth layers all rejected the cross-practitioner attack scenario without exposing any gap.

### Standing position on temporary workarounds

**Zero documented temporary workarounds remain open from Phase B.** All three findings (F1, F2, F3) were closed at source — the RLS policies and view definition now express the intended access semantics directly, with no admin-client substitution preserved as a fallback. The only admin-client usage in Phase B (`getIntakeSummary`, `getBioHubSignals`) is the documented Q6 exception, scoped to intake and biohub tables that have no practitioner RLS yet — sunsetted before Phase C.

---

## 6. Deferred items

Three items are deliberately deferred from Phase B with explicit sunset conditions or scheduling.

### Q6 Option A — practitioner-scoped RLS on intake/BioHub tables

**Tables affected:** `intake_responses`, `intake_answers`, `biomarker_results`, `biomarker_trajectory`, `lab_reports`.

**Current state:** Practitioners read these via admin-client helpers (`getIntakeSummary`, `getBioHubSignals`) because no practitioner RLS policy exists. The admin client is constructed inside the workspace page only after authenticated RLS confirms work-item ownership, and `memberId` is derived from the confirmed row — never from URL params.

**Sunset:** MUST land before Phase C (external practitioner onboarding). Internal practitioners and the controlled deployment surface make the admin-client exception tolerable for v1; external practitioners change the risk profile and require true practitioner-scoped RLS.

**Status:** Deferred, scheduled before Phase C.

### Legacy `/cases/[caseId]/reasoning` route

**Current state:** `apps/care/app/cases/[caseId]/reasoning/page.tsx` still exists alongside the new workspace route. The workspace route fully replaces its function, but the legacy route was preserved during the transition. One `as unknown as` cast for `profiles.full_name` remains on line 29 (pre-existing, would be removed with the route).

**Why deferred:** Removing the route is a small mechanical cleanup that benefits from being done after Phase B sign-off, not during it. It also lets us verify nothing in admin tooling or external documentation still links to the legacy URL before deletion.

**Status:** Deferred, scheduled as a small post-Phase-B cleanup sprint.

### Admin UI for escalated cases

**Current state:** Escalated work is queryable via SQL (`SELECT cw.id, cw.status, cw.case_id, cc.escalation_required FROM case_practitioner_work cw JOIN client_cases cc ON cc.id = cw.case_id WHERE cw.status = 'escalated';`). The `is_admin()` policies cover this access. No admin UI surfaces it.

**Why deferred:** v1 escalation volume is expected to be low and admin response can be SQL-driven until the queue grows. UI design for the escalation handoff is intertwined with the Phase C admin tooling work; bundling them avoids two UI passes.

**Status:** Deferred, scheduled in Phase C-adjacent work.

---

## 7. Test count progression

| | Count |
|---|---|
| `packages/db` tests before Phase B | 152 |
| `packages/db` tests after Phase B | **169 passed · 69 skipped (238 total)** |
| Net new tests | **+17 passing** |

Breakdown by sub-phase (passing tests added):
- **B.1** — `listWorkForInbox` (19 tests incl. computeUrgency unit + mocked-client + integration) and `startWorkItem` (6 tests) introduced as new files; ~16 of the new passing tests landed in B.1.
- **B.2** — `getIntakeSummary` (8), `getCaseEvents` (6), `getBioHubSignals` (6), `getPriorReviews` (7) — most are integration tests that skip without DB credentials.
- **B.3** — listWorkForInbox.test.ts mock rewritten for the 3-call shape (active + completed + identity view); no net new file.
- **B.4** — no new helpers; tests unchanged.

`apps/care` has no test infrastructure; the `applyEscalationPrefix` semantics (B.4) were verified by smoke tests against the live UI rather than unit-tested locally.

---

## 8. Integration suite final state

All checks against `41a8070` on `main`:

| Check | Result |
|---|---|
| `pnpm --filter @natural-intelligence/db test` | ✅ 169 passed · 69 skipped (238 total) |
| `pnpm --filter care type-check` | ✅ clean |
| `pnpm --filter admin type-check` | ✅ clean |
| `pnpm --filter care lint` | ✅ No ESLint warnings or errors |
| `pnpm --filter admin lint` | ✅ No ESLint warnings or errors |
| `pnpm --filter web lint` | ✅ no errors (info notice only) |
| `pnpm --filter care build` | ✅ Compiled successfully |
| `pnpm --filter admin build` | ✅ Compiled successfully |
| `pnpm --filter web build` | ✅ Compiled successfully |

### Greps

**Admin-client usage in care app:**
- `apps/care/app/cases/[caseId]/work/[workId]/page.tsx` — documented Q6 exception (`getIntakeSummary`, `getBioHubSignals`)
- `apps/care/app/actions.ts` — pre-existing root waitlist action (out of Phase B scope)

No new admin-client exceptions introduced by Phase B beyond the documented Q6 scope. In particular, `apps/care/app/cases/actions.ts` (the B.3 `submitReview` server action) uses **only** `createServerSupabaseClient()` — the practitioner's own SSR session.

**`as any` / `as unknown as` in `apps/care/app/cases/` and new helpers:**
- `apps/care/app/cases/[caseId]/work/[workId]/page.tsx:123` — `identityResult.value.data as unknown as { full_name: string | null; avatar_url: string | null } | null` — the `practitioner_client_identity` view is not yet in the generated types; documented.
- `apps/care/app/cases/[caseId]/reasoning/page.tsx:29` — `clientCase.profiles as unknown as { full_name: string | null } | null` — pre-existing on the legacy route, will be removed with the route per §6.

No new `as any` casts. No service-role usage anywhere in the care app outside the documented exceptions.

---

## 9. What Phase B enables

Phase B delivers a complete practitioner operational loop on top of G.1's identity and RLS substrate. Practitioners can now meaningfully operate the platform without scaffolding workarounds: inbox-driven work assignment, a full case review workspace with intake / reasoning / case history / lab signals / prior reviews, structured decision recording with localStorage drafts and explicit confirmation, and a distinct escalation handoff path that flags cases for admin attention. The CCR (Care Continuity Record) now contains real practitioner workflow history — `case_events` rows with structured `practitioner_decision` payloads — that downstream phases (Phase D protocol layer, admin tooling, future continuity surfaces) can read and reason over.

---

## 10. Standing rules reaffirmed

Patterns the project should continue to apply, validated repeatedly during Phase B:

- **Verification reports use PROCEDURE / OBSERVED / RESULT** with literal observed values (DOM snippets, DB rows, exception messages) — not paraphrased.
- **Surface-before-implement discipline.** B.4's pre-flight findings (RPC needed two changes not one; `listWorkForInbox` needed no change; ActionPanel success-init needed `'escalated'`; success copy needed an escalated branch; reload copy needed a status-prop derivation) are the strongest example. Surfacing each before writing code shortened the implementation by an order of magnitude and avoided rework.
- **In-line F-finding closure at source.** F1, F2, F3 were each closed by a corrective migration committed *during* the sub-phase that surfaced them, not deferred to a follow-up backlog. Zero standing workarounds at Phase B close.
- **Forward-compatible signature design.** B.3 accepted `'escalated'` in the decision enum even though B.4 wasn't started, so B.4 needed only RPC body changes — no constraint migration, no signature break.
- **RLS is the truth layer.** Admin-client usage requires explicit justification (Q6) and a sunset condition (before Phase C). When the truth layer is wrong (F1, F3), the fix is the policy, not the client choice.
- **Three-layer auth defence on write endpoints.** RLS (Layer 1) + RPC internal check with `FOR UPDATE` (Layer 2) + server-action `getUser()` with no client-trusted identity field (Layer 3). All three exercised and verified live in B.4.
- **Column-scoped views as access boundaries** when a table's row-level access can't be narrowed without exposing sensitive columns (F2 pattern). Future sensitive client attributes go in new tables or behind their own views; never in `profiles`.
- **Cross-model review at architecturally consequential decisions** — the F2 view-vs-policy decision is the clearest case, where the easy fix (broad profiles SELECT) was explicitly rejected for the structurally correct one.

---

## 11. Phase C gate conditions

Before Phase C (external practitioner invitation flow) begins:

### Required
- [ ] **Q6 Option A migration landed and verified.** Practitioner-scoped RLS on `intake_responses`, `intake_answers`, `biomarker_results`, `biomarker_trajectory`, `lab_reports`. Admin-client exception removed from `getIntakeSummary` and `getBioHubSignals` once policies are in place.
- [ ] **Phase B closure report committed.** (This document.)
- [ ] **F1 migration drift resolved.** Backfill the F1 fix as a numbered file in `supabase/migrations/` so `supabase db reset` produces a reproducible state (see §3 drift note).
- [ ] **Personalisation Substrate phase scoped and implemented.** `biological_sex`, `religion`, `religious_content_preference`, content-gating pattern, dynamic intake branching — see §12 roadmap. External practitioners interact with personalisation-shaped content, so the substrate must exist first.

### Recommended
- [ ] Legacy `/cases/[caseId]/reasoning` route removed (small cleanup; resolves one pre-existing `as unknown as` cast).
- [ ] Small cleanup of accumulated minor TODOs across the care app.

---

## 12. Roadmap forward

Directional, not committed.

1. **Next — Personalisation Substrate (small, bounded phase)**
   - `biological_sex` (intake field; content gating for sex-specific clinical content)
   - `religion` (intake field; optional)
   - `religious_content_preference` (intake field; optional gate for religiously-framed interpretation)
   - Dynamic intake branching pattern
   - Conditional content rendering substrate
   - Public UI remains secular by default

2. **Then — Q6 Option A migration**
   - Practitioner-scoped RLS on intake/BioHub tables; admin-client exception retired.

3. **Then — Phase C — Invitation flow + external practitioner onboarding**
   - External practitioner invitation, vetting, activation
   - Onboarding journey for newly-activated practitioners
   - Admin tooling surfaces around vetting queue

4. **Then — Phase D — Protocol layer**
   - CNM clinical synthesis structures
   - Protocol authoring and orchestration
   - Reads from Phase B's `practitioner_decision` event substrate

5. **Then — Phase E (directory) and Phase F (CareTeam Builder)** as previously sketched.

---

*Phase B closed. Awaiting explicit approval before Personalisation Substrate scoping begins.*

---

## F1 Migration Drift — Closed

**Date:** 2026-05-19
**Migration:** `supabase/migrations/0046_backfill_f1_case_practitioner_select_all_statuses.sql`
**Applied as:** `backfill_f1_case_practitioner_select_all_statuses` (live dev DB)
**Commits:** `991c2e9` (migration) · this commit (report update)

The Phase C gate item flagged in §3 and §11 — *"F1 migration drift resolved: backfill the F1 fix as a numbered file in supabase/migrations/"* — is now closed.

### PROCEDURE / OBSERVED / RESULT

#### Step 1 — Investigate live policy state

**Procedure:** Queried `pg_policy` for every policy named `case_practitioner_select` across all tables, plus searched `supabase/migrations/` for the file that introduced the pre-F1 policy.

**Observed:**
- Exactly one policy named `case_practitioner_select` exists in live, on `public.client_cases` (not `case_practitioner_work` as the original Phase C gate text suggested).
- Live USING expression:
  ```sql
  (EXISTS ( SELECT 1
     FROM case_practitioner_work cpw
    WHERE ((cpw.case_id = client_cases.id) AND (cpw.practitioner_id = auth.uid()))))
  ```
- Origin file: `supabase/migrations/0037_g1_rls_care_extensions.sql` line 10 — created the pre-F1 version with `AND cpw.status IN ('assigned','in_review')` appended.
- Next available migration slot: `0046`.

**Result:** Surfaced two corrections to the spec body before writing: target table is `client_cases`, not `case_practitioner_work`; USING expression is an EXISTS subquery (the spec's `practitioner_id = auth.uid()` would not parse against `client_cases`). Stopped and surfaced to the user; corrected body approved.

#### Step 2 — Apply the backfill migration

**Procedure:** Applied `0046_backfill_f1_case_practitioner_select_all_statuses.sql` to the live dev DB via Supabase MCP `apply_migration`. The migration uses `DROP POLICY IF EXISTS … CREATE POLICY …` so it succeeds whether or not the policy already exists.

**Observed:** `{"success": true}` from `apply_migration`.

**Result:** ✅ Applied without error.

#### Step 3 — Verify live policy state matches expected

**Procedure:** Re-queried `pg_policy` for the policy on `public.client_cases`.

**Observed:**
```
table_name:    client_cases
policy_name:   case_practitioner_select
command:       r (SELECT)
roles:         {authenticated}
using_expr:    (EXISTS ( SELECT 1
                  FROM case_practitioner_work cpw
                 WHERE ((cpw.case_id = client_cases.id) AND (cpw.practitioner_id = auth.uid()))))
```

**Result:** ✅ USING expression matches the live state from Step 1 exactly. No status filter on `cpw`. Drop+recreate produced the same policy that was present before — F1 fix preserved.

#### Step 3.b — Inbox visibility regression test (Dr Sarah Chen)

**Procedure:**
1. SQL: queried `client_cases` as Dr Sarah Chen (`e8ee62b0-…`) via JWT-spoofed authenticated session for both her cases (`10d4456a-…` with completed work, `cccccccc-…` with escalated work).
2. UI: navigated to `/cases` as Dr Sarah Chen against live deployment.

**Observed:**

SQL:
```
auth_uid:        e8ee62b0-1f94-4c52-8005-b52a6d2b6d12
visible_cases:   2
case_ids:        10d4456a-5cc7-4c48-a035-0d6ed134c7c9,
                 cccccccc-0000-4000-8000-000000000003
```

UI:
```
PRACTITIONER INBOX — All reviews complete

NEEDS REVIEW
No assigned work. New cases will appear here when your next review is assigned.

ESCALATED (1)
⚠ Natural Intelligence — case_review — Awaiting admin

COMPLETED RECENTLY
⚠ Natural Intelligence — case_review — Completed 4d ago
```

**Result:** ✅ Both sections render with the work items they previously contained. F1 fix preserved through the drop+recreate.

#### Step 4 — Negative test (Lena Parrish)

**Procedure:** Queried `client_cases` as Lena Parrish (`c0334d65-…`) via JWT-spoofed authenticated session for both of Dr Sarah Chen's cases.

**Observed:**
```
auth_uid:               c0334d65-2bde-4bca-aa0c-1d5cd33a1e18
visible_sarah_cases:    0
```

**Result:** ✅ Cross-practitioner scope still enforced. Lena cannot see Dr Sarah Chen's cases.

#### Step 5 — Verification suite

| Check | Result |
|---|---|
| `pnpm --filter @natural-intelligence/db test` | ✅ 169 passed · 69 skipped (238 total) — unchanged from Phase B close |
| `pnpm --filter care type-check` | ✅ clean |
| `pnpm --filter care build` | ✅ Compiled successfully |
| `pnpm --filter care lint` | ✅ No ESLint warnings or errors |

### Phase C gate update

The F1 drift backfill required-item from §11 is now closed:

- [x] **F1 migration drift resolved.** Migration `0046_backfill_f1_case_practitioner_select_all_statuses.sql` captures the live policy state verbatim. `supabase db reset` from the current `supabase/migrations/` directory now produces a DB with the F1 fix in place; Completed Recently and Escalated inbox sections will render correctly on a fresh deploy.

Remaining Phase C gate items unchanged:
- [ ] Q6 Option A migration landed and verified
- [ ] Personalisation Substrate phase scoped and implemented

*F1 drift closure complete. No other drift addressed (deliberate per scope). Awaiting explicit approval before any forward work.*
