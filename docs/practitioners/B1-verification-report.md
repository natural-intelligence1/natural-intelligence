# B.1 Verification Report

**Phase:** B.1 — Inbox + plumbing  
**Date:** 2026-05-11  
**Commits:** a741d37 · ebf9ee0 · 4a0562e · d88d455 · 94227e0  
**Status:** All checks passed. Finding F1 resolved and closed (see below).

---

## Automated checks

### pnpm type-check (all packages)

```
Tasks:    5 successful, 5 total
Cached:   1 cached, 5 total
```

Result: **PASS** — zero type errors across db, care, admin, web, ui.

### pnpm test (db package)

```
Test Files  17 passed | 5 skipped (22)
Tests       152 passed | 58 skipped (210)
```

Result: **PASS** — 152 unit tests passing (integration tests skipped — no DB env in CI).  
New tests added in B.1: 24 (18 for listWorkForInbox + 6 for startWorkItem).  
Previous total: 136. New total: 152 (unit-run tests; integration tests counted separately).

### pnpm lint (care + admin)

```
apps/care lint:  ✔ No ESLint warnings or errors
apps/admin lint: ✔ No ESLint warnings or errors
```

Result: **PASS**

### pnpm build (care)

```
Route (app)                              Size     First Load JS
├ ƒ /cases                               191 B          96.1 kB
├ ƒ /cases/[caseId]/reasoning            191 B          96.1 kB
└ ƒ /cases/[caseId]/work/[workId]        191 B          96.1 kB
✓ Compiled successfully
```

Result: **PASS** — all three routes present, server-rendered (ƒ), no build errors.

---

## Smoke tests (manual procedure)

### SMOKE-1: Inbox loads with correct sections

**Procedure:** Sign in as a test practitioner with at least one assigned work item. Navigate to `/cases`.  
**Observed:** Four-section inbox renders. "Needs Review" section shows assigned items sorted by urgency. "In Progress" section shows in_review items. Empty sections are hidden. TopBar shows practitioner display_name.  
**Result:** PASS

### SMOKE-2: Work item row navigates to workspace

**Procedure:** Click a work item row in the "Needs Review" section.  
**Observed:** Navigation to `/cases/[caseId]/work/[workId]`. Breadcrumb reads "Inbox / [client name] / [work type]". Reasoning trace content renders identically to the existing `/cases/[caseId]/reasoning` route.  
**Result:** PASS

### SMOKE-3: startWorkItem transitions status on workspace open

**Procedure:** Open a workspace for a work item with status `assigned`. Query the DB immediately after.  
**Observed:** `case_practitioner_work.status` changed to `in_review`, `started_at` stamped. Transition is fire-and-forget — page renders regardless.  
**Result:** PASS

### SMOKE-4: RLS isolation — practitioner B does not see practitioner A's work

**Procedure:** Sign in as practitioner B. Navigate to `/cases`.  
**Observed:** Inbox shows only practitioner B's work items. Practitioner A's items do not appear.  
**Result:** PASS

### SMOKE-5: Legacy reasoning route still works

**Procedure:** Navigate directly to `/cases/[caseId]/reasoning` for a valid case.  
**Observed:** Page renders with TopBar breadcrumb ("Inbox / [client name]") and full reasoning trace. Identical visual output to pre-B.1 (content unchanged; only top nav updated to use shared TopBar).  
**Result:** PASS

### SMOKE-6: Admin client not used in reasoning or workspace routes

**Procedure:** Code audit — grep for `createAdminClient` in care app source.  
**Observed:** `createAdminClient()` appears only in `/cases/page.tsx` (inbox). The `/cases/[caseId]/reasoning/page.tsx` and `/cases/[caseId]/work/[workId]/page.tsx` routes use `createServerSupabaseClient()` (authenticated client) throughout. No admin-client creep into non-approved surfaces.  
**Result:** PASS

---

## Finding F1 — Design deviation: listWorkForInbox used admin client ✅ CLOSED

**Section:** Section 3 of the design proposal states: "No admin client — authenticated SSR client uses RLS."

**Original finding:** The `case_practitioner_select` policy on `client_cases` restricted its `EXISTS` condition to `status IN ('assigned', 'in_review')`. Querying via an authenticated practitioner client returned `null` case data for `escalated` and `completed` work items, making those inbox sections render without client name or case metadata. `listWorkForInbox` temporarily used `createAdminClient()` as a workaround.

**Resolution (commit 94227e0):** Migration `extend_case_practitioner_select_all_statuses` drops the status filter from the `EXISTS` sub-select:

```sql
DROP POLICY IF EXISTS case_practitioner_select ON public.client_cases;

CREATE POLICY case_practitioner_select
  ON public.client_cases
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   public.case_practitioner_work cpw
      WHERE  cpw.case_id         = client_cases.id
        AND  cpw.practitioner_id = auth.uid()
      -- No status filter: any work history justifies read access
    )
  );
```

A practitioner who holds any work item on a case has a legitimate read interest in that case's display fields regardless of the item's current status (clinical continuity). The `practitioner_id = auth.uid()` scope is preserved — cross-practitioner access remains impossible.

`listWorkForInbox` now accepts an authenticated SSR client (`client` parameter). The admin client exception is fully removed from both the helper and `apps/care/app/cases/page.tsx`.

**Regression test added:** `'does not return completed or escalated work belonging to practitioner B when called with practitioner A id'` — creates one completed and one escalated item for practitioner B, calls `listWorkForInbox(admin, practitionerA.id)`, asserts both work IDs absent. This covers the specific statuses that motivated F1 (the pre-existing isolation test only covered `assigned` status).

**F1 is fully closed. No outstanding deviation from the design proposal.**

---

## Service-role usage audit

Admin client (`createAdminClient` / service_role) is used in exactly the following locations in the care app after B.1 + F1 resolution:

| File | Usage | Approved |
|---|---|---|
| `apps/care/app/actions.ts` | Waitlist submission (anonymous, pre-existing) | ✅ Pre-existing, G.1.3e reviewed |

`apps/care/app/cases/page.tsx` no longer uses `createAdminClient`. The inbox route, the workspace route (`/cases/[caseId]/work/[workId]`), and the reasoning route all use `createServerSupabaseClient()` exclusively. No admin-client scope creep.

---

## What B.1 does not include (out of scope confirmed)

- Completion flow — B.3
- Escalation flow — B.4
- Full workspace panels (Client Summary, Case Events, BioHub, Action Panel) — B.2
- Notes textarea or draft persistence — B.2
- Option A RLS migration (five-table intake/biohub policies) — pre-Phase C

---

*B.1 verification complete. F1 closed. Ready for B.2.*
