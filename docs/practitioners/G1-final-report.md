# G.1 — Practitioner Module: Final Report

**Sprint:** G.1 — Practitioner Module (G.1.1 through G.1.3f)  
**Completed:** 2026-05-09  
**Environment:** Dev (Supabase project `yftxzvdrxnhwpcnsrktn`) + local Next.js monorepo  
**Branch:** `main` (pushed to `origin/main` at commit `778dfc3`)

---

## 1. Scope

The G.1 sprint delivered the full practitioner module: database schema, RLS policies, TypeScript helper library, Care app integration, Admin app integration, and end-to-end verified security. It spans sixteen commits from `f3a7a23` through `778dfc3`.

---

## 2. Deliverables

### 2.1 Database (Supabase — project `yftxzvdrxnhwpcnsrktn`)

| Object | Description |
|--------|-------------|
| `practitioners` table | Full practitioner lifecycle — identity, specialty, licensing, intake/onboarding status, audit timestamps (`accepted_at`, `activated_at`, `ended_at`), `is_directory_ready` flag |
| `practitioners_directory` view | Public-facing view exposing only active + `is_directory_ready=true` rows; strips private columns (`website_url`, `linkedin_url`, `notes`, `is_test_data`). PostgREST returns error 42703 on private column requests. |
| `case_practitioner_work` table | Tracks assignment of practitioners to cases; drives RLS on `client_cases` |
| `client_practitioner_links` table | Three-table principle: `client_id`, `practitioner_id`, `link_type`; `cpl_practitioner_select_active` RLS hides ended links |
| `complete_practitioner_work()` RPC | Atomically marks work rows as complete |
| `case_practitioner_select` RLS policy | `EXISTS (SELECT 1 FROM case_practitioner_work WHERE case_id = client_cases.id AND practitioner_id = auth.uid() AND status IN ('assigned', 'in_review'))` |
| `cpl_practitioner_select_active` RLS policy | `practitioner_id = auth.uid() AND ended_at IS NULL` |

### 2.2 TypeScript Helper Library (`packages/db/src/practitioners/`)

| Helper | Purpose |
|--------|---------|
| `getPractitioner(supabase, practitionerId)` | Fetch single practitioner record; validates no forbidden fields |
| `getClientTeam(supabase, clientId)` | Fetch client's active practitioner team via `client_practitioner_links` |
| `getPractitionerTrace(supabase, caseId)` | Fetch reasoning trace + entries for a case |
| `assertNoForbiddenFields(obj)` | Runtime guard — throws if any private column appears in a query result |
| `WorkDecision` enum | `assigned \| in_review \| complete \| rejected` |
| Domain enums | `PractitionerStatus`, `PractitionerSpecialty`, `LicenseType` |

Unit tests: **126 passed, 34 skipped** (integration tests requiring live DB), **0 failed** (`pnpm --filter @natural-intelligence/db exec vitest run`).

### 2.3 Care App (`apps/care/`)

| Route | Description |
|-------|-------------|
| `/` | Practitioner landing + waitlist form (public) |
| `/waitlist` | Waitlist confirmation page |
| `/auth/signin` | Practitioner sign-in (Supabase Auth) |
| `/auth/callback` | OAuth/magic link callback handler |
| `/cases` | Active cases list — RLS-scoped to signed-in practitioner |
| `/cases/[caseId]/reasoning` | Reasoning trace view — RLS-scoped; 404 on unassigned case |
| Middleware | Validates `sb-*-auth-token` cookie; redirects unauthenticated requests to `/auth/signin` |

### 2.4 Admin App (`apps/admin/`)

Practitioners list and detail pages; application review workflow.

### 2.5 Runbooks (`docs/practitioners/`)

- `practitioner-lifecycle-runbook.md` — practitioner onboarding, activation, deactivation
- `client-practitioner-link-runbook.md` — link creation, handoff, expiry
- `g1.3e-verification-report.md` — full manual verification audit trail (441 lines)

---

## 3. Security Audit — G.1.3e Findings and Fixes

Three files were audited for service-role client misuse (V.6 anti-pattern). Two release-blocker bugs were found and fixed before the verification suite could pass.

### Finding 1 — `apps/care/app/cases/page.tsx` (FIXED)

**Bug:** `createAdminClient()` (service-role, bypasses RLS) queried `client_cases` with no practitioner filter. Every active practitioner saw all cases in the database.

**Fix:** Replaced with `createServerSupabaseClient()`. The `case_practitioner_select` RLS policy scopes results automatically — no application-level filter needed.

**Commit:** `98cb4d3`

### Finding 2 — `apps/care/app/cases/[caseId]/reasoning/page.tsx` (FIXED)

**Bug:** Same V.6 pattern. Any active practitioner could navigate to `/cases/<arbitrary-uuid>/reasoning` and view reasoning traces for cases they were not assigned to.

**Fix:** Replaced with `createServerSupabaseClient()` for both the `client_cases` load and the `getPractitionerTrace()` call. When RLS returns zero rows for an unassigned case, `.single()` returns PGRST116 → existing `if (caseErr || !clientCase) return notFound()` check fires → 404. No differential-response leak (identical response for "not found" and "not accessible").

**Commit:** `89e7954`

### Finding 3 — `apps/care/app/actions.ts` (NO FIX NEEDED)

`submitWaitlist` uses `createAdminClient()`. Assessed as legitimate: endpoint is invoked anonymously (public waitlist form, `member_id: null`), operation is append-only insert to `support_requests`, no privacy boundary to enforce, no read-back. Code comment added documenting rationale.

**Commit:** `89e7954`

---

## 4. G.1.3f Integration Suite Results

All checks run against commit `778dfc3` before push.

### 4.1 Typecheck

```
pnpm --filter @natural-intelligence/db typecheck    → 0 errors
pnpm --filter web typecheck                         → 0 errors
pnpm --filter care typecheck                        → 0 errors
pnpm --filter admin typecheck                       → 0 errors
```

### 4.2 Unit Tests

```
pnpm --filter @natural-intelligence/db exec vitest run

 ✓ packages/db/src/...  (126 tests)
   • 126 passed
   •  34 skipped  (integration tests requiring live DB)
   •   0 failed
```

### 4.3 Production Builds

**web:**
```
Route (app)                              Size     First Load JS
┌ ○ /                                    ...
ƒ Middleware                             79.3 kB
✓ Compiled successfully
```

**care:**
```
Route (app)                              Size     First Load JS
├ ƒ /cases                    188 B   96 kB
└ ƒ /cases/[caseId]/reasoning 188 B   96 kB
ƒ Middleware                  79 kB
✓ Compiled successfully
```

**admin:**
```
Route (app)                              Size     First Load JS
┌ ƒ /                                    148 B          87.3 kB
├ ƒ /applications                        186 B            96 kB
├ ƒ /practitioners                       186 B            96 kB
...
ƒ Middleware                             78.8 kB
✓ Compiled successfully
```

### 4.4 Lint

```
pnpm lint  (turbo run lint across 6 packages)

care:lint:   ✔ No ESLint warnings or errors
admin:lint:  ✔ No ESLint warnings or errors
web:lint:    2 warnings in app/opengraph-image.tsx and app/twitter-image.tsx
             (no-img-element, alt-text — pre-existing, unrelated to G.1 changes)

Tasks: 3 successful, 3 total
```

### 4.5 Final Security Greps

**`grep -rn "createAdminClient|SERVICE_ROLE_KEY|service_role" apps/care/app/`**

```
apps/care/app/actions.ts:3:  import { createAdminClient, ... }
apps/care/app/actions.ts:14: const adminClient = createAdminClient()
```

→ Only remaining use is `submitWaitlist` in `actions.ts` — documented as legitimate (Finding 3 above). No other care app source file uses service-role.

**`grep -rn ": any| as any|<any>" packages/db/src/practitioners/`**

```
(no matches)
```

**`grep -rn "as unknown as" packages/db/src/practitioners/`**

```
packages/db/src/practitioners/getClientTeam.test.ts:41    (test file)
packages/db/src/practitioners/getClientTeam.test.ts:94    (test file)
packages/db/src/practitioners/getPractitioner.test.ts:29  (test file)
packages/db/src/practitioners/getPractitioner.test.ts:43  (test file)
```

→ All matches in `.test.ts` files only (mock object casting). Zero production code matches.

---

## 5. Commit Log (G.1 Sprint)

| Commit | Message |
|--------|---------|
| `f3a7a23` | feat(db): rebuild practitioners table with full lifecycle, audit fields, public directory view |
| `527ff86` | feat(db): create case_practitioner_work table and complete_practitioner_work() RPC |
| `b59d366` | feat(db): extend client_cases.status check constraint with draft and intake_complete |
| `c9a979e` | feat(db): add practitioner SELECT policies on case tables (RLS care extensions) |
| `bba1635` | feat(db): create client_practitioner_links table with three-table principle |
| `6ac6fc3` | fix(types+admin+web): update all apps for new practitioners schema |
| `01d0c40` | fix(care): add force-dynamic to cases page to prevent prerender error |
| `403f44a` | docs(practitioners): G.1.3b pre-verification — identity model and directory view privacy |
| `7861517` | feat(practitioners): helper module — identity, work, links typed via WorkDecision and domain enums |
| `1e99076` | feat(care): practitioner middleware + 5 calm state pages |
| `948a429` | fix(care): remove service-role from middleware; use anon+cookies for all lookups |
| `f51ee87` | docs(runbooks): practitioner lifecycle and client-practitioner link operations |
| `98cb4d3` | fix(care): use authenticated session + RLS for cases list |
| `89e7954` | fix(care): use authenticated session + RLS for reasoning page; document legitimate service-role use in waitlist |
| `76e4a96` | docs(practitioners): G.1.3e re-run after fixes + Tests 7-12 observed results |
| `778dfc3` | feat(ui): brand lockup on care landing; story page intro reflection block |

---

## 6. RLS Policy Summary

All data access in the Care app is governed by RLS. No application-level filters substitute for or duplicate policy logic.

| Policy | Table | Condition |
|--------|-------|-----------|
| `case_practitioner_select` | `client_cases` | `EXISTS (SELECT 1 FROM case_practitioner_work WHERE case_id = id AND practitioner_id = auth.uid() AND status IN ('assigned', 'in_review'))` |
| `cpl_practitioner_select_active` | `client_practitioner_links` | `practitioner_id = auth.uid() AND ended_at IS NULL` |
| `practitioners_directory` view | `practitioners` | `status = 'active' AND is_directory_ready = true` (view filter, not policy) |

---

## 7. Known Limitations (v1)

| Item | Status |
|------|--------|
| Email uniqueness on `practitioners` | Not enforced at DB level in v1; enforced by Supabase Auth on sign-up |
| `support_requests` anon INSERT policy | Not present; `submitWaitlist` uses service-role as documented workaround |
| Web app lint warnings (`opengraph-image.tsx`, `twitter-image.tsx`) | Pre-existing; not related to G.1 |
| 34 skipped integration tests | Require seeded live DB; run manually against dev Supabase when needed |

---

## 8. Verification Status

| Test | Description | Result |
|------|-------------|--------|
| T1 | Public landing page loads without auth | ✅ PASS |
| T2 | Waitlist submit inserts to `support_requests` + sends emails | ✅ PASS |
| T3 | Unauthenticated `/cases` → redirect to `/auth/signin` | ✅ PASS |
| T4 | Sign-in with valid practitioner credentials → `/cases` | ✅ PASS |
| T5 | Cases list shows only assigned cases for practitioner A | ✅ PASS |
| T6a | Practitioner B cannot see Practitioner A's cases in list | ✅ PASS (after fix `98cb4d3`) |
| T6b | Practitioner B direct-navigating to A's case UUID → 404 | ✅ PASS (after fix `89e7954`) |
| T7 | Reasoning page loads for assigned case | ✅ PASS |
| T8 | Reasoning page 404 for unassigned case (no differential response) | ✅ PASS |
| T9 | `practitioners_directory` view excludes private columns | ✅ PASS |
| T10 | Ended `client_practitioner_link` hidden from practitioner | ✅ PASS |
| T11 | Admin app practitioners list renders | ✅ PASS |
| T12 | Waitlist confirmation page renders | ✅ PASS |

All 13 test cases (including T6a and T6b as separate cases) passed. Two release-blocker bugs identified and corrected during verification.

---

## 9. Sign-off

G.1 is complete. All deliverables are committed, all tests pass, all builds are clean, and the full audit trail is documented in `docs/practitioners/g1.3e-verification-report.md`.

The branch is live at `origin/main` (commit `778dfc3`).
