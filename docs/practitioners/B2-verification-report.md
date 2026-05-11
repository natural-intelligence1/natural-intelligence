# B.2 Verification Report

**Phase:** B.2 — Case Review Workspace (read-only)  
**Date:** 2026-05-11  
**Commits:** 6b978b0 · 1e8f8f0 · ce279d0  
**Status:** All automated checks passed. Smoke tests complete. One new finding (F2).

---

## Automated checks

### pnpm type-check (all packages)

```
Tasks:    5 successful, 5 total
Cached:   4 cached, 5 total
```

Result: **PASS** — zero type errors across db, care, admin, web, ui.

### pnpm test (db package)

```
Test Files  21 passed | 5 skipped (26)
Tests       169 passed | 69 skipped (238)
```

Result: **PASS** — 169 unit tests passing.  
Previous total: 152 (B.1). New tests added: 17 (across 4 new helper test files).

| Helper | Unit tests | Integration tests (skipped without DB) |
|---|---|---|
| `getIntakeSummary` | 5 | 3 |
| `getCaseEvents` | 4 | 2 |
| `getBioHubSignals` | 4 | 2 |
| `getPriorReviews` | 4 | 3 |

### pnpm lint (care + admin)

```
apps/care lint:  ✔ No ESLint warnings or errors
apps/admin lint: ✔ No ESLint warnings or errors
```

Result: **PASS**

### pnpm build (care)

```
Route (app)                              Size     First Load JS
├ ƒ /cases                               188 B           96 kB
├ ƒ /cases/[caseId]/reasoning            188 B           96 kB
└ ƒ /cases/[caseId]/work/[workId]        3.11 kB         99 kB
✓ Compiled successfully
```

Result: **PASS** — workspace route grew from 191 B (B.1 stub) to 3.11 kB (client components: CollapsibleSection, SectionNavRail, ActionPanel). All three routes remain dynamic (ƒ).

---

## Smoke tests (live session — 2026-05-11)

**Session:** Signed in as Dr Sarah Chen (`dr-sarah-chen-1777591453482@showcase.internal`).  
**Workspace URL:** `/cases/10d4456a-5cc7-4c48-a035-0d6ed134c7c9/work/aaaaaaaa-0000-4000-8000-000000000001`  
**Pre-requisite note:** Production Vercel deployment was missing all three Supabase env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`). These were added and a redeploy triggered (dpl_DPqTRcvhv7eAFEMMKiEWrjGrrTs6, Ready in 59s) before the smoke session began.

---

### SMOKE-1: Workspace loads with all five panels

**Procedure:** Signed in as Dr Sarah Chen. Navigated to workspace URL.  
**Observed:** `title="Case Review — NI Care"`. Three-column layout rendered — nav rail (Client Summary · Reasoning · Case History · Lab Signals · Prior Reviews), main content column with all five panels, action panel sticky on right. ClientSummaryPanel and ReasoningTracePanel expanded; CaseHistoryPanel, BioHubSignalsPanel, PriorReviewsPanel collapsed by default. Client name in workspace header renders as "Unknown" — **see F2**.  
**Result:** **PASS** — workspace structure correct. F2 noted (profiles RLS blocks client name read).

---

### SMOKE-2: startWorkItem guard

**Procedure:** Opened workspace for work item with `status = 'assigned'`. Queried DB. Reloaded workspace. Queried DB again.  
**Observed:**
- First load: action panel metadata showed "Assigned · Due tomorrow". DB query confirmed `status = 'in_review'`, `started_at = '2026-05-11 04:44:35.736+00'`.
- Second load (same URL): action panel showed "In review · Due tomorrow · Started 4m ago". DB query confirmed `started_at` unchanged.  
**Result:** **PASS** — transition fires on first open, idempotent on subsequent opens.

---

### SMOKE-3: Hypothesis Board in main column

**Procedure:** Read full workspace page text.  
**Observed:** Page text order: HYPOTHESIS BOARD (with 4 ranked hypotheses) → REASONING TIMELINE (entries). Hypothesis Board is rendered above the timeline in the main content column. Action panel (aside) contains only the review form — no Hypothesis Board content.  
**Result:** **PASS** — Hypothesis Board in main column above timeline. Right column is action panel only (addendum S4 layout confirmed).

---

### SMOKE-4: Action panel sticky on scroll

**Procedure:** Queried computed CSS on the `<aside>` element.  
**Observed:** `position: sticky, top: 72px`. Element is `alignSelf: flex-start` — sticks to top of viewport on scroll while main column scrolls independently.  
**Result:** **PASS** — sticky position confirmed by computed style.

---

### SMOKE-5: Draft saves to localStorage and survives reload

**Procedure:** Typed notes via programmatic input event. Waited > 500ms. Checked localStorage. Reloaded workspace. Read notes textarea value.  
**Observed:**
- localStorage key `ni-care:draft:aaaaaaaa-0000-4000-8000-000000000001` populated after 500ms debounce: `{ notes: "Test note for smoke verification...", decision: null, recommendation: "", lastSavedAt: "2026-05-11T04:50:33.450Z" }`.
- After reload: notes textarea pre-populated with saved value.  
**Result:** **PASS** — 500ms debounced save confirmed. Survives page reload.

---

### SMOKE-6: Multi-tab conflict banner

**Procedure:** Opened workspace in tab 2. Simulated tab 2 writing localStorage with a timestamp 5s in the future. Dispatched `focusin` event on notes textarea in tab 1. Checked for amber banner. Then dispatched input event (keystroke simulation) and rechecked.  
**Observed:**
- After `focusin` dispatch: `document.body.innerText.includes('open in another tab') === true`. Banner text confirmed: "This case is open in another tab — edits may conflict."
- After keystroke: `document.body.innerText.includes('open in another tab') === false`. Banner dismissed.  
**Result:** **PASS** — multi-tab detection working. Banner dismisses on keystroke.

---

### SMOKE-7: Degraded draft mode

**Procedure:** `isLocalStorageAvailable()` returns `true` in a standard browser session — private browsing cannot be directly simulated programmatically.  
**Observed:** Verified by code inspection. `ActionPanel.tsx` lines 116–120: `useEffect` on mount calls `isLocalStorageAvailable()`; if false, `setDraftMode('degraded')`. Lines 208–213: when `draftMode === 'degraded'`, persistent amber banner renders: "Draft saving unavailable. Notes will be lost if you navigate away." `scheduleSave` is a no-op when degraded. Notes composable in React state only.  
**Result:** **PASS (by code inspection)** — degraded mode branch is present and correct. Not directly exercisable in standard browser session without private browsing.

---

### SMOKE-8: Submit button disabled

**Procedure:** Inspected submit button computed style. Selected "Approved" decision. Attempted button click. Re-checked disabled state.  
**Observed:** `{ disabled: true, opacity: "0.5", cursor: "not-allowed", text: "Complete review" }`. After selecting "Approved" and clicking: still `{ disabled: true, opacity: "0.5" }`. Label below button: "[B.3] Submission wired in next phase".  
**Result:** **PASS** — button is inert regardless of decision selection. No network request fired.

---

### SMOKE-9: RLS isolation — practitioner B cannot access A's workspace

**Procedure:** Signed in as Marcus Obi in tab 2. Navigated directly to Dr Sarah Chen's workspace URL (`workId = aaaaaaaa-0000-4000-8000-000000000001`).  
**Observed:** Tab 2 title changed to "404: This page could not be found." — `notFound()` returned by workspace page because RLS query on `case_practitioner_work` returned null for Marcus Obi's session.  
**Result:** **PASS** — RLS isolation confirmed. Cross-practitioner workspace access blocked.

---

### SMOKE-10: Legacy reasoning route unchanged

**Procedure:** Navigated to `/cases/10d4456a-5cc7-4c48-a035-0d6ed134c7c9/reasoning` as Dr Sarah Chen.  
**Observed:** Page rendered with title "Clinical Reasoning — NI Care". Full reasoning timeline visible with all 4 hypotheses, evidence entries, and decision. Hypothesis Board appears after the timeline entries (original right-sidebar/secondary-column position). No action panel present (correct — this is the legacy read-only route). No regression from B.2 workspace changes.  
**Result:** **PASS** — legacy reasoning route renders identically. Workspace-only layout changes are isolated.

---

### SMOKE-11: Cormorant client name assessment

**Procedure:** Navigated to workspace. Queried computed style on `<h1>`.  
**Observed:** `fontFamily: "__Cormorant_Garamond_16bb0c, __Cormorant_Garamond_Fallback_16bb0c"`, `fontSize: "28px"`, `fontWeight: "400"`, `color: "rgb(26, 25, 23)"`. Text content: "Unknown" (due to F2 — profiles RLS blocks practitioner from reading client name).  
**Typographic assessment:** Cormorant Garamond is correctly applied and scoped to the single h1 element only. Visual register with real client name data cannot be fully assessed until F2 is resolved. The "Unknown" fallback reads as a data gap rather than a disconnected editorial moment. No stop condition triggered.  
**Result:** **PASS (implementation)** — font correctly applied. Full humanising-anchor assessment deferred pending F2 fix.

---

### SMOKE-12: Empty panel states

**Procedure:** Created a fresh case (`cccccccc-0000-4000-8000-000000000003`) with no case events, no prior reviews, and no reasoning trace. Opened workspace for this case.  
**Observed:**
- **ClientSummaryPanel:** Showed intake data (member has existing intake_responses from seeded data — `getIntakeSummary` is member-scoped, not case-scoped). Empty state ("No intake data recorded for this client.") not directly exercised; verified by code inspection — returned when `getIntakeSummary` returns `null`.
- **ReasoningTracePanel:** ✅ Rendered: "No reasoning trace generated yet. A trace is generated automatically when the member completes their health intake."
- **CaseHistoryPanel:** ✅ Collapsed header with "No events recorded" — no content visible, panel non-expandable.
- **BioHubSignalsPanel:** Showed 38 markers (member has biomarker data — `getBioHubSignals` is member-scoped). Empty state ("No lab data" with suppressed expand affordance) not directly exercised; verified by code inspection — `emptyState` prop passed when `signals.length === 0`.
- **PriorReviewsPanel:** ✅ Collapsed header with "No prior reviews".  
**Result:** **PASS (3/5 directly, 2/5 by code inspection)** — case-scoped panels (history, prior reviews, reasoning trace) show correct empty states. Member-scoped panels (intake, biohub) share data across cases by design; empty states verified by code inspection.

---

## Findings

### Finding F2 — profiles RLS blocks client name read ⚠️ NEW

**Observed:** Client name displays as "Unknown" across the workspace header, breadcrumb, and legacy reasoning route.

**Root cause:** The `profiles` table has a single SELECT policy: `Users can read own profile` (`auth.uid() = id`). When the workspace server component queries:
```sql
SELECT ... profiles:client_id (full_name) FROM client_cases WHERE id = $caseId
```
…the authenticated client (Dr Sarah Chen) cannot read the client's profile row because `auth.uid() (Sarah's ID) ≠ client_id (member's ID)`. The join returns `null`, and `fullName = profile?.full_name ?? 'Unknown'`.

**Impact:** Client name is absent from workspace header and breadcrumb. SMOKE-11 typographic assessment is limited.

**Fix:** Add a practitioner-scoped SELECT policy on `profiles`:
```sql
CREATE POLICY practitioner_can_read_assigned_client_profiles
  ON public.profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.case_practitioner_work cpw
      JOIN public.client_cases cc ON cc.id = cpw.case_id
      WHERE cc.client_id = profiles.id
        AND cpw.practitioner_id = auth.uid()
    )
  );
```

**Severity:** Medium — display regression only, no data or security impact. Admin client is not needed (this is a legitimate practitioner display need). Scheduled for B.3 pre-implementation migration.

---

## Pre-production finding: missing Vercel env vars

Three Supabase env vars were absent from the Vercel project at the start of smoke testing, causing `MIDDLEWARE_INVOCATION_FAILED` on all `/cases` routes. Added before smoke session:

| Var | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public — Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public (publishable key) |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret — required by `createAdminClient()` in workspace page |

Redeploy `dpl_DPqTRcvhv7eAFEMMKiEWrjGrrTs6` triggered and reached READY before smoke session began. This is a deployment configuration gap, not a code finding — not F-series.

---

## Admin-client usage audit

After B.2, `createAdminClient` is used in the following locations in the care app:

| File | Usage | Approved |
|---|---|---|
| `apps/care/app/cases/[caseId]/work/[workId]/page.tsx` | `getIntakeSummary` + `getBioHubSignals` | ✅ Q6 exception — no practitioner RLS on intake/biohub tables |
| `apps/care/app/actions.ts` | Waitlist submission (anonymous, pre-existing) | ✅ Pre-existing, G.1.3e reviewed |

`apps/care/app/cases/page.tsx` (inbox) — authenticated client only (F1 resolved in B.1).

**Admin client scope note:** The workspace page creates `adminClient` only after the authenticated client has verified work item ownership via RLS. `memberId` is derived from the case row returned by the authenticated query — not from URL params or any user-controllable input. Both admin queries are hard-scoped to that `memberId`. The admin client never reaches the browser (server component only).

This matches the Q6 exception documented in the Phase B Addendum and the B.1 verification report.

---

## What B.2 does not include (out of scope confirmed)

- Completion RPC call — B.3
- Escalation flow — B.4  
- Confirmation step in action panel — B.3
- Post-submission state / draft clearing — B.3
- Option A RLS migration — pre-Phase C
- Removal of legacy `/cases/[caseId]/reasoning` route — post-B.4 cleanup

---

## B.2 smoke test summary

| # | Test | Result |
|---|---|---|
| SMOKE-1 | Workspace loads with all five panels | ✅ PASS (F2 noted) |
| SMOKE-2 | startWorkItem guard | ✅ PASS |
| SMOKE-3 | Hypothesis Board in main column | ✅ PASS |
| SMOKE-4 | Action panel sticky on scroll | ✅ PASS |
| SMOKE-5 | Draft saves to localStorage and survives reload | ✅ PASS |
| SMOKE-6 | Multi-tab conflict banner | ✅ PASS |
| SMOKE-7 | Degraded draft mode | ✅ PASS (code inspection) |
| SMOKE-8 | Submit button disabled | ✅ PASS |
| SMOKE-9 | RLS isolation — practitioner B cannot access A's workspace | ✅ PASS |
| SMOKE-10 | Legacy reasoning route unchanged | ✅ PASS |
| SMOKE-11 | Cormorant client name assessment | ✅ PASS (implementation; full assessment deferred — F2) |
| SMOKE-12 | Empty panel states | ✅ PASS (3/5 live, 2/5 code inspection) |

**12/12 PASS. One finding: F2 (profiles RLS — medium severity, display-only, no security impact). Scheduled for B.3 pre-implementation.**

*B.2 complete. Awaiting approval before B.3 begins.*
