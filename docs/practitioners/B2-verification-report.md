# B.2 Verification Report

**Phase:** B.2 — Case Review Workspace (read-only)  
**Date:** 2026-05-11  
**Commits:** 6b978b0 · 1e8f8f0 · ce279d0  
**Status:** All automated checks passed. Smoke tests pending (manual, with live DB). No new unresolved findings.

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

## Smoke tests (manual procedure)

### SMOKE-1: Workspace loads with all five panels

**Procedure:** Sign in as a test practitioner. Land on inbox, tap a work item. Confirm full workspace renders.  
**Expected:** Three-column layout — nav rail · five panels · action panel. Client name in Cormorant Garamond workspace header. Two panels expanded (Client Summary, Reasoning Trace), three collapsed (Case History, BioHub, Prior Reviews).  
**Result:** *(pending)*

### SMOKE-2: startWorkItem guard

**Procedure:** Open a workspace for a work item with `status = 'assigned'`. Query DB.  
**Expected:** Status transitions to `in_review`, `started_at` stamped. Open same workspace again — status stays `in_review`, `started_at` unchanged.  
**Result:** *(pending)*

### SMOKE-3: Hypothesis Board in main column

**Procedure:** Open workspace for a case with a reasoning trace. Confirm Hypothesis Board placement.  
**Expected:** Hypothesis Board appears in the main content column, above the Reasoning Timeline. Right column contains only the action panel — no Hypothesis Board in sidebar.  
**Result:** *(pending)*

### SMOKE-4: Action panel sticky on scroll

**Procedure:** Open a workspace with multiple panels expanded. Scroll down the main column.  
**Expected:** Action panel remains visible and fixed while main column scrolls. Metadata line (status · due date · started) visible at all times.  
**Result:** *(pending)*

### SMOKE-5: Draft saves to localStorage and survives reload

**Procedure:** Type notes in the action panel. Wait > 500ms. Reload the page.  
**Expected:** Notes pre-populated from localStorage. Decision and recommendation also restored if set.  
**Result:** *(pending)*

### SMOKE-6: Multi-tab conflict banner

**Procedure:** Open same work item in two tabs. Type in tab 2. Wait 500ms. Click the notes textarea in tab 1.  
**Expected:** Amber banner: "This case is open in another tab — edits may conflict." Banner dismisses on next keystroke in tab 1.  
**Result:** *(pending)*

### SMOKE-7: Degraded draft mode

**Procedure:** Open workspace in private browsing (localStorage unavailable).  
**Expected:** Persistent amber banner above notes: "Draft saving unavailable. Notes will be lost if you navigate away." Notes still composable, held in React state.  
**Result:** *(pending)*

### SMOKE-8: Submit button disabled

**Procedure:** Open workspace. Observe action panel. Select a decision. Click submit button.  
**Expected:** Submit button visible but inert — `opacity: 0.5`, `cursor: not-allowed`. Small "[B.3]" label below. No network request fires regardless of decision selection.  
**Result:** *(pending)*

### SMOKE-9: RLS isolation — practitioner B cannot access A's workspace

**Procedure:** Sign in as practitioner B. Navigate directly to `/cases/[caseId]/work/[workId]` where workId belongs to practitioner A.  
**Expected:** 404 (notFound — RLS returns null for the work item query).  
**Result:** *(pending)*

### SMOKE-10: Legacy reasoning route unchanged

**Procedure:** Navigate to `/cases/[caseId]/reasoning`.  
**Expected:** Existing reasoning page renders identically. Hypothesis Board in right sidebar (original layout preserved — workspace layout change is workspace-only, addendum S4).  
**Result:** *(pending)*

### SMOKE-11: Cormorant client name assessment

**Procedure:** Open workspace. Evaluate visual register of Cormorant Garamond client name in context of surrounding data.  
**Expected:** Name reads as a humanising anchor without feeling disconnected. If it feels editorial/disconnected from the clinical data density, STOP and surface per the stop condition.  
**Result:** *(pending)*

### SMOKE-12: Empty panel states

**Procedure:** Open workspace for a case with no intake data, no lab uploads, no case events, no prior reviews.  
**Expected:** ClientSummaryPanel: "No intake data recorded for this client." BioHubSignalsPanel: collapsed header with "No lab data" — no expand affordance. CaseHistoryPanel: collapsed with "No events recorded". PriorReviewsPanel: collapsed with "No prior reviews".  
**Result:** *(pending)*

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

## Findings

No unexpected exceptions surfaced during B.2 implementation. The Q6 admin-client pattern (getIntakeSummary, getBioHubSignals) was planned and documented. No new F-series findings to report.

---

## What B.2 does not include (out of scope confirmed)

- Completion RPC call — B.3
- Escalation flow — B.4  
- Confirmation step in action panel — B.3
- Post-submission state / draft clearing — B.3
- Option A RLS migration — pre-Phase C
- Removal of legacy `/cases/[caseId]/reasoning` route — post-B.4 cleanup

---

*B.2 automated checks complete. Smoke tests pending. Awaiting approval before B.3 begins.*
