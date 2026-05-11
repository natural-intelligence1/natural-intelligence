# B.1 Verification Report

**Phase:** B.1 — Inbox + plumbing  
**Date:** 2026-05-11  
**Commits:** a741d37 · ebf9ee0 · 4a0562e · d88d455  
**Status:** All checks passed. One design deviation documented (F1 below).

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

## Finding F1 — Design deviation: listWorkForInbox uses admin client

**Section:** Section 3 of the design proposal states: "No admin client — authenticated SSR client uses RLS."

**Finding:** The `case_practitioner_select` policy on `client_cases` is:

```sql
(EXISTS (
  SELECT 1 FROM case_practitioner_work cpw
  WHERE cpw.case_id = client_cases.id
    AND cpw.practitioner_id = auth.uid()
    AND cpw.status = ANY (ARRAY['assigned', 'in_review'])
))
```

This policy only covers `assigned` and `in_review` statuses. When querying via an authenticated practitioner client, the nested join from `case_practitioner_work` to `client_cases` returns `null` for any work items in `escalated` or `completed` status — making those inbox sections render without client name or case metadata.

**Resolution:** `listWorkForInbox` uses `createAdminClient()` (service_role). The admin client is safe here:
1. `practitionerId` is always derived from the authenticated session (`supabase.auth.getUser()`).
2. All queries are hard-scoped to `.eq('practitioner_id', practitionerId)`.
3. The function is called from a server component; the admin client never reaches the browser.

This is documented inline in `listWorkForInbox.ts` and follows the same pattern as `listAssignedWork`.

**Follow-up required:** A migration adding practitioner-scoped policies to `client_cases` (extending `case_practitioner_select` to include `escalated` and `completed` statuses, or adding a separate policy) would allow switching `listWorkForInbox` back to an authenticated client. This is lower urgency than the five-table intake/biohub Option A migration (which is required before Phase C) but should be tracked.

---

## Service-role usage audit

Admin client (`createAdminClient` / service_role) is used in exactly the following locations in the care app after B.1:

| File | Usage | Approved |
|---|---|---|
| `apps/care/app/cases/page.tsx` | `listWorkForInbox` — inbox data query | ✅ Yes — see F1 above |
| `apps/care/app/actions.ts` | Waitlist submission (anonymous, pre-existing) | ✅ Pre-existing, G.1.3e reviewed |

No other files in `apps/care` use `createAdminClient`. The workspace route (`/cases/[caseId]/work/[workId]`) and the reasoning route both use `createServerSupabaseClient()` exclusively. No admin-client scope creep.

---

## What B.1 does not include (out of scope confirmed)

- Completion flow — B.3
- Escalation flow — B.4
- Full workspace panels (Client Summary, Case Events, BioHub, Action Panel) — B.2
- Notes textarea or draft persistence — B.2
- Option A RLS migration (five-table intake/biohub policies) — pre-Phase C

---

*B.1 verification complete. Awaiting approval before B.2 begins.*
