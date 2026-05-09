# V.8 Closure Report — Bounded Stabilisation Sprint

**Date:** 2026-05-09  
**Branch:** `main`  
**Base commit:** `fa3a93e`  
**Final commit:** `903c1d8`

---

## Summary

All 10 open technical debt gaps from G.1 closed in 8 commits.  
Pre-existing C1 (intake branching rule smoke scaffold) and C2 (branching-rule parity tests) were already green before the sprint began.

---

## Gaps closed

### L1 — Practitioner disclaimer copy
**Commit:** `8d93e58`  
**File:** `apps/web/app/dashboard/story/page.tsx`  
**Before:** `A practitioner will review your case if needed.`  
**After:** `Some cases may be referred for practitioner review where additional judgement is needed.`  
Removes the implied promise of guaranteed human review.

---

### H2 — `@natural-intelligence/db/crt` subpath export
**Commit:** `952bbd7`  
**File:** `packages/db/package.json`  
Added `"./crt": "./src/crt/index.ts"` to the `exports` map. Updated all consumer imports in:
- `apps/web/app/dashboard/story/actions.ts`
- `apps/web/app/dashboard/story/page.tsx`
- `apps/care/app/cases/[caseId]/reasoning/page.tsx`

---

### H3 / H4 / H5 — Type safety in CRT module
**Commit:** `60217b8`

**H3** (`getClientStory.ts`): Removed `as unknown as` cast — `trace.created_at` was always directly accessible.

**H4** (`actions.ts`): Replaced `(intake as any)?.primary_concerns?.[0]` with typed access `intake?.primary_concerns?.[0] ?? undefined`.

**H5** (`getPractitionerTrace.ts`): Interface fields narrowed from `string` to union types (`AgentName`, `EntryType`, `Visibility`, `TraceType`, `TraceStatus`, `GeneratedBy`). Narrowing casts added at the DB boundary (justified by check constraints).

---

### M1 — Story page failure recovery (Option B)
**Commit:** `1cbfcdd`  
**File:** `apps/web/app/dashboard/story/page.tsx`  
**Approach:** Use `intake_responses.created_at` as generation-trigger timestamp proxy. If intake completed > 5 min ago and no `client_visible` trace exists, infer generation failure — no schema change required.

Added two distinct UI states:
- **Timed-out (failed):** "We couldn't put your story together this time." with a "Try again" button (no meta-refresh).
- **In-progress:** "Building your health story…" with `<meta http-equiv="refresh" content="10">` auto-poll.

---

### M2 — Partial unique index for idempotent story generation
**Commit:** `e6b6f13`  
**Migration:** `supabase/migrations/0040_v8_reasoning_traces_active_unique.sql`  
**Applied to live DB via MCP.**

```sql
CREATE UNIQUE INDEX idx_reasoning_traces_one_active_per_case_type
  ON public.reasoning_traces (case_id, trace_type)
  WHERE status = 'client_visible';
```

Prevents concurrent `generateBodyStory` calls from writing duplicate promoted traces. Allows multiple `draft` rows per case/type.

---

### M3 — Structured JSON observability logging
**Commit:** `ab10036`  
**File:** `apps/web/app/dashboard/story/actions.ts`  
Four structured log events emitted via `console.log(JSON.stringify({...}))` for Vercel log drain:
- `body_story.start` — memberId
- `body_story.insufficient_data` — memberId, reason
- `body_story.success` — memberId, traceId, duration_ms, input_tokens, output_tokens
- `body_story.failure` — memberId, error_code, duration_ms

---

### C4 — CRT schema migration DDL
**Commit:** `913130a`  
**File:** `supabase/migrations/0033_sprint17_crt_schema.sql`  
Replaced 38-line comment-only placeholder with complete `IF NOT EXISTS` DDL extracted from the live DB via `information_schema` and `pg_catalog`:

| Table | Columns | Indexes | Triggers | RLS policies |
|---|---|---|---|---|
| `client_cases` | 8 | 1 | `set_updated_at` | 3 |
| `case_events` | 7 | 1 | — | 3 |
| `reasoning_traces` | 8 | 1 | `set_updated_at` | 3 |
| `reasoning_trace_entries` | 13 | 3 | — | 3 |

Migration is idempotent; safe to apply against fresh or existing DB.

---

### H1 — CRT function test suite
**Commit:** `903c1d8`  
**Files:** `packages/db/src/crt/*.test.ts` (4 new files)

| File | Unit tests | Integration tests |
|---|---|---|
| `getOrCreateClientCase.test.ts` | 3 | 3 |
| `createReasoningTrace.test.ts` | 3 | 4 |
| `getClientStory.test.ts` | 2 | 4 |
| `getPractitionerTrace.test.ts` | 2 | 5 |

**Total new tests:** 26 (unit: 10, integration: 16)  
Integration tests `skipIf(!HAVE_DB)` — zero-config locally, run in CI with secrets.

---

## Final verification

| Check | Result |
|---|---|
| `pnpm type-check` (db) | ✅ 0 errors |
| `pnpm type-check` (web) | ✅ 0 errors |
| `pnpm type-check` (care) | ✅ 0 errors |
| `pnpm test` (db) | ✅ 136 passed, 50 skipped |
| `pnpm lint` | ✅ 0 errors (2 pre-existing warnings in OG image files, unrelated) |
| Live DB index | ✅ `idx_reasoning_traces_one_active_per_case_type` confirmed |
| `git push origin main` | ✅ `fa3a93e..903c1d8` |

---

## Test count delta

| Metric | Pre-sprint | Post-sprint |
|---|---|---|
| Test files | 16 | 20 |
| Tests passing | 110 | 136 |
| Tests skipped (integration) | 34 | 50 |

---

## Commit log

```
903c1d8  test(db): H1 — CRT function test suite (4 files, 26 new tests)
e6b6f13  fix(db): M2 — partial unique index for client_visible reasoning traces
913130a  docs(migrations): C4 — replace comment-only 0033 with real CRT DDL
ab10036  feat(observability): M3 — structured JSON logging in generateBodyStory
1cbfcdd  fix(ui): M1 — story page failure recovery via 5-min intake timestamp timeout
60217b8  fix(types): H3/H4/H5 — remove unsafe casts in CRT module
952bbd7  fix(db): H2 — add ./crt subpath export; update all consumer imports
8d93e58  fix(copy): L1 — practitioner review disclaimer more accurate
```
