# F2 Fix Verification Report

**Finding:** F2 — profiles RLS blocks client name read  
**Date:** 2026-05-14  
**Commits:** b6a6c9f (migration) · b0e13a8 (code)  
**Vercel deployment:** dpl_49tQGB8Ep4ABBKZzeKSxztg59kjx (READY)  
**Status:** All 7 checks PASS. F2 closed.

---

## What was fixed

F2 was identified in the B.2 smoke session: client name displayed as "Unknown" across the workspace header, breadcrumb, and inbox because the `profiles` table only allows `auth.uid() = id` SELECT (users reading their own row). Practitioners could not read client profile rows via FK join.

**Approach chosen:** SECURITY DEFINER view `public.practitioner_client_identity`, exposing only `(id, full_name, avatar_url, role)`. The view's WHERE clause is the access gate — no new policy added to the `profiles` table itself. Full-row SELECT on `profiles` was explicitly rejected: application-layer column projection is not a security boundary, and setting the precedent of "practitioners can read full profile rows" would make future decisions harder as sensitive client attributes are added.

**Migration:** `0041_f2_practitioner_client_identity_view`

**Code changes:**
- `packages/db/src/practitioners/listWorkForInbox.ts` — removed `profiles:client_id (full_name)` FK join; client names now batch-fetched from the view via `.in('id', clientIds)` after active + completed queries resolve
- `apps/care/app/cases/[caseId]/work/[workId]/page.tsx` — removed `profiles:client_id (full_name)` FK join from `client_cases` query; identity fetched via view in `Promise.allSettled`
- `packages/db/src/practitioners/listWorkForInbox.test.ts` — mock updated for three-call shape (active, completed, identity); test rows updated to use `client_id` instead of `profiles`

**169/169 unit tests passing. Lint clean. Type-check clean.**

---

## View definition

```sql
CREATE OR REPLACE VIEW public.practitioner_client_identity
WITH (security_invoker = false) AS
SELECT p.id, p.full_name, p.avatar_url, p.role
FROM public.profiles p
WHERE
  EXISTS (
    SELECT 1
    FROM public.case_practitioner_work cpw
    JOIN public.client_cases cc ON cc.id = cpw.case_id
    WHERE cc.client_id = p.id
      AND cpw.practitioner_id = auth.uid()
  )
  OR auth.uid() = p.id
  OR is_admin();

GRANT SELECT ON public.practitioner_client_identity TO authenticated;
```

Columns NOT exposed: `bio`, `onboarding_intent`, `heard_about`, `is_test_data`, `created_at`, `updated_at`, `onboarding_completed_at`.

No status filter on `case_practitioner_work` — practitioners retain identity visibility for clients on cases with any work status (assigned, in_review, completed, escalated), consistent with the F1 fix's spirit.

---

## Verification checks

Test subjects:
- **Dr Sarah Chen** (practitioner with `in_review` work on case `10d4456a...`): ID `e8ee62b0-1f94-4c52-8005-b52a6d2b6d12`
- **Lena Parrish** (practitioner with NO work on that client): ID `c0334d65-2bde-4bca-aa0c-1d5cd33a1e18`
- **Client "Natural Intelligence"**: ID `1854aa09-d732-4627-af19-729ec18654d7`

---

### Check 1 — Positive case (assigned practitioner reads client)

**Procedure:** Simulated view WHERE clause EXISTS subquery via `execute_sql`. Queried whether the EXISTS branch fires for Dr Sarah Chen on client `1854aa09-...`.

**Observed:**
```sql
SELECT EXISTS (
  SELECT 1 FROM case_practitioner_work cpw
  JOIN client_cases cc ON cc.id = cpw.case_id
  WHERE cc.client_id = '1854aa09-d732-4627-af19-729ec18654d7'
    AND cpw.practitioner_id = 'e8ee62b0-1f94-4c52-8005-b52a6d2b6d12'
) AS sarah_can_read_client;
-- Result: true
```

**Result:** ✅ PASS — practitioner with active work reads assigned client's identity.

---

### Check 2 — Negative case (unassigned practitioner blocked)

**Procedure:** Simulated view WHERE clause for Lena Parrish (`c0334d65-...`) on the same client. Lena has no work items on any case for client `1854aa09-...` (confirmed by pre-query).

**Observed:**
```sql
SELECT EXISTS (
  SELECT 1 FROM case_practitioner_work cpw
  JOIN client_cases cc ON cc.id = cpw.case_id
  WHERE cc.client_id = '1854aa09-d732-4627-af19-729ec18654d7'
    AND cpw.practitioner_id = 'c0334d65-2bde-4bca-aa0c-1d5cd33a1e18'
) AS lena_can_read_client;
-- Result: false
```

**Result:** ✅ PASS — unassigned practitioner cannot read client identity via the view.

---

### Check 3 — Negative case (arbitrary enumeration blocked)

**Procedure:** Simulated full view output for both Dr Sarah Chen and Lena Parrish — what profiles each would see across the entire `profiles` table.

**Observed — Dr Sarah Chen:**
```
id                                    full_name              role          access_path
1854aa09-d732-4627-af19-729ec18654d7  Natural Intelligence   admin         assigned-client
e8ee62b0-1f94-4c52-8005-b52a6d2b6d12  Dr Sarah Chen         practitioner  self
```
2 rows total: only her assigned client and herself.

**Observed — Lena Parrish:**
```
id                                    full_name     role          access_path
c0334d65-2bde-4bca-aa0c-1d5cd33a1e18  Lena Parrish  practitioner  self
```
1 row total: only herself.

**Result:** ✅ PASS — enumeration is properly restricted. No practitioner can read arbitrary profiles.

---

### Check 4 — F1 spirit preserved (completed work retains visibility)

**Procedure:** Inspected view definition. Verified no `status` filter on `case_practitioner_work` in the EXISTS clause. Dr Sarah Chen's work items (both `in_review`) confirmed `visible_via_view: true` via EXISTS subquery.

**Observed:** View WHERE clause: `EXISTS (SELECT 1 FROM case_practitioner_work cpw JOIN client_cases cc ... WHERE cc.client_id = p.id AND cpw.practitioner_id = auth.uid())` — no status predicate. Any work item (assigned, in_review, completed, escalated) satisfies the clause.

Note: No completed work items exist for Dr Sarah Chen in the smoke test data; verified by code inspection that the EXISTS clause contains no status filter.

**Result:** ✅ PASS (view definition inspection) — identity visibility persists across all work statuses.

---

### Check 5 — Regression (existing access paths unchanged)

**Procedure:**
1. Queried `profiles` table directly for client `1854aa09-...` row — confirmed row exists and is accessible via admin query (i.e., base table integrity intact).
2. Queried `profiles` for admin role rows — confirmed admin user accessible via `is_admin()` branch in view.
3. Queried `pg_policy` for all policies on `public.profiles`.

**Observed:**
```sql
-- Profile row accessible (base table integrity)
SELECT id, full_name, role FROM profiles WHERE id = '1854aa09-...';
-- Returns: { id, full_name: 'Natural Intelligence', role: 'admin' }

-- Policies on profiles (unchanged)
SELECT polname FROM pg_policy WHERE polrelid = 'public.profiles'::regclass;
-- Admin full access to profiles
-- Users can read own profile
-- Users can update own profile
```

**Result:** ✅ PASS — only the original 3 policies remain on `profiles`. No new policy was added. Members read their own profile via the existing `auth.uid() = id` policy. Admins access all profiles via `is_admin()` (both on the base table and through the view's OR branch).

---

### Check 6 — UI render: workspace

**Procedure:** Signed in as Dr Sarah Chen. Navigated to workspace `/cases/10d4456a-5cc7-4c48-a035-0d6ed134c7c9/work/aaaaaaaa-0000-4000-8000-000000000001`. Reloaded against the new deployment (`dpl_49tQGB8Ep4ABBKZzeKSxztg59kjx`). Queried `h1` text content and scanned body for "Unknown".

**Observed:**
```js
document.querySelector('h1').textContent  // → "Natural Intelligence"
document.body.innerText.includes('Unknown')  // → false
document.body.innerText.includes('Natural Intelligence')  // → true
```

**Result:** ✅ PASS — workspace header (Cormorant Garamond h1) renders "Natural Intelligence". "Unknown" absent. SMOKE-11 typographic assessment is now fully unblocked.

---

### Check 6 — UI render: inbox

**Procedure:** Navigated to `/cases` (inbox) as Dr Sarah Chen. Queried page text and scanned for "Unknown" / "Natural Intelligence".

**Observed:**
```
PRACTITIONER INBOX — 2 items need review
IN PROGRESS (2)
◑ Natural Intelligence — case_review — Started 2d ago
⚠ Natural Intelligence — case_review — Started 2d ago
```

`document.body.innerText.includes('Unknown')` → `false`  
`document.body.innerText.includes('Natural Intelligence')` → `true`

**Result:** ✅ PASS — all inbox rows show real client name. "Unknown" absent.

---

### Check 7 — No broad profiles SELECT policy created

**Procedure:** Queried `pg_policy` for all policies on `public.profiles` after migration.

**Observed:** Three policies — identical to pre-migration:
- `Admin full access to profiles`
- `Users can read own profile`
- `Users can update own profile`

No `practitioner_can_read_assigned_client_profiles` or any equivalent table-level SELECT policy was created. The view is the access boundary.

**Result:** ✅ PASS — profiles table policy set unchanged. No full-row SELECT policy granted to practitioners.

---

## Summary

| # | Check | Result |
|---|---|---|
| 1 | Positive case — assigned practitioner reads client | ✅ PASS |
| 2 | Negative — unassigned practitioner blocked | ✅ PASS |
| 3 | Enumeration — practitioners cannot read arbitrary profiles | ✅ PASS |
| 4 | F1 spirit — completed work retains visibility | ✅ PASS (definition inspection) |
| 5 | Regression — existing access paths unchanged | ✅ PASS |
| 6 | UI render — workspace header shows real name | ✅ PASS |
| 6 | UI render — inbox rows show real name | ✅ PASS |
| 7 | No broad profiles SELECT policy created | ✅ PASS |

**7/7 PASS. F2 closed. No new findings.**

**Broad profiles SELECT policy: NOT created.** The view is the boundary. Future column additions (e.g. `bio`) require an explicit DDL change to the view — the conversation happens at the schema level.

*F2 fix complete. Awaiting approval before B.3 begins.*
