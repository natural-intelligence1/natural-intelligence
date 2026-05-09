# V.8 Verification Sweep

**Date:** 2026-05-09  
**Scope:** Read-only. Six procedural checks against the V.8 closure report.  
**Outcome:** 3 PASS · 2 CONCERN · 1 FAIL

---

## CHECK 1 — Migration 0033 reproducibility

**PROCEDURE:**  
`supabase db reset` is not runnable in this environment — the Supabase CLI cannot be installed on Windows via pnpm (binary blocked; documented in project memory). Verification is by inspection of `supabase/migrations/0033_sprint17_crt_schema.sql`.

**OBSERVED:**

The migration uses the following DDL statement types:

| Statement | IF NOT EXISTS? | Idempotent? |
|---|---|---|
| `CREATE TABLE` | ✅ yes | ✅ yes |
| `CREATE INDEX` | ✅ yes | ✅ yes |
| `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` | n/a | ✅ yes (no-op if already enabled) |
| `CREATE TRIGGER` | ❌ no | ❌ fails on existing DB |
| `CREATE POLICY` | ❌ no | ❌ fails on existing DB |

Against a **fresh database** (the `supabase db reset` use case), all four CRT tables, their indexes, triggers, and RLS policies would be created cleanly — PostgreSQL has no pre-existing objects to conflict with. The table creation order is correct: `client_cases` → `case_events` → `reasoning_traces` → `reasoning_trace_entries` (each FK references a table created earlier in the file). The `set_updated_at()` function is a pre-existing helper from the earlier migration set.

The problem is the migration header claims: _"Written as IF NOT EXISTS throughout so it is safe to re-apply against a fresh or existing database."_ This is false for triggers and policies. Re-running against an existing DB (e.g., the live dev DB) would error on `CREATE TRIGGER trg_client_cases_updated_at` and all `CREATE POLICY` statements.

**RESULT: CONCERN**  
**Notes:** Migration applies cleanly to a fresh DB (the primary use case for `db reset`). The idempotency claim in the header overstates safety — triggers and policies would fail on re-application to an existing DB. The live DB was not affected because the tables were applied via MCP before the migration file was written. Corrective option: wrap triggers in `CREATE OR REPLACE TRIGGER` and policies in `DROP POLICY IF EXISTS ... ; CREATE POLICY ...` guards. Scope for a separate phase.

---

## CHECK 2 — M2 unique index data integrity

**PROCEDURE:**  
```sql
SELECT case_id, trace_type, COUNT(*)
FROM reasoning_traces
WHERE status = 'client_visible'
GROUP BY case_id, trace_type
HAVING COUNT(*) > 1;
```
Run against live dev DB (`yftxzvdrxnhwpcnsrktn`).

**OBSERVED:**  
```
(0 rows)
```

**RESULT: PASS**  
**Notes:** No duplicate `client_visible` traces existed at index creation time. The index was created cleanly. M2 constraint is live and enforcing.

---

## CHECK 3 — M1 timeout proxy accuracy

**PROCEDURE:**  
Code investigation of the `generateBodyStory` call chain and the `createReasoningTrace` status flow.

**OBSERVED:**

**Call site:**  
`apps/web/app/dashboard/intake/actions.ts` line 87:
```typescript
// Fire-and-forget: CRT body story generation (Sprint 17/18)
generateBodyStory(user.id).catch((err) => {
  console.error('[completeIntake] body story generation failed:', err)
})
```
Called synchronously (fire-and-forget) at the end of `completeIntake` — the same server action that writes the `intake_responses` row and marks `is_complete = true`. There is no queue, no retry scheduler, no delayed execution. The gap between `intake_responses.created_at` and `generateBodyStory` starting is 0–2 seconds (same request, next lines of code).

**Generating state:**  
`createReasoningTrace` inserts directly with `status: 'client_visible'` — there is no intermediate `generating` state row written at any point in `generateBodyStory`. Therefore no more accurate timestamp exists in the DB without a schema change.

**Timeout proxy assessment:**  
The 5-minute threshold uses `intake_responses.created_at` as a proxy for "generation started at." Given that generation begins within seconds of intake completion, the only scenario where the proxy gives a false positive (shows "failed" when generation is still running) is if Claude takes > 5 minutes to respond — which would itself be an error state worth surfacing. Normal Claude response time for this prompt is 10–30 seconds. The proxy is appropriate for v1.

**RESULT: PASS**  
**Notes:** No more accurate timestamp is available without writing a `generating` state row. The proxy introduces a theoretical false-positive window only in genuine timeout scenarios. Acceptable for v1; if a `generating` state is added in a future phase (Option A from the sprint brief), `reasoning_traces.created_at` would become the precise anchor.

---

## CHECK 4 — H1 integration tests exercised RLS

**PROCEDURE:**  
Loaded live DB credentials from `packages/db/.env.test.local` and ran the full test suite:
```
cd packages/db
set -a && source .env.test.local && set +a
pnpm test --reporter=verbose
```

**OBSERVED:**

```
Test Files  1 failed | 19 passed (20)
Tests       1 failed | 185 passed (186)
```

CRT-specific results:

| Test | Result |
|---|---|
| `getOrCreateClientCase — unit` (3 tests) | ✅ PASS |
| `getOrCreateClientCase — integration` (3 tests) | ✅ PASS |
| `createReasoningTrace — unit` (3 tests) | ✅ PASS |
| `createReasoningTrace — integration > creates a trace and returns a uuid` | ✅ PASS |
| `createReasoningTrace — integration > writes trace entries with correct fields` | ❌ **FAIL** |
| `createReasoningTrace — integration > creates a trace with no entries when entries array is empty` | ✅ PASS |
| `createReasoningTrace — integration > sets status to client_visible` | ✅ PASS |
| `getClientStory — unit` (2 tests) | ✅ PASS |
| `getClientStory — integration` (4 tests) | ✅ PASS |
| `getPractitionerTrace — unit` (2 tests) | ✅ PASS |
| `getPractitionerTrace — integration` (5 tests) | ✅ PASS |

**Failure detail:**
```
FAIL  src/crt/createReasoningTrace.test.ts > createReasoningTrace — integration
      > writes trace entries with correct fields

Unknown Error: duplicate key value violates unique constraint
  "idx_reasoning_traces_one_active_per_case_type"

Serialized Error: {
  code: '23505',
  details: 'Key (case_id, trace_type)=(5e08725a-..., intake_analysis) already exists.'
}
```

**Root cause:**  
The test's `beforeAll` inserts a `client_visible intake_analysis` trace for the shared `caseId`. The test `writes trace entries with correct fields` then calls `createReasoningTrace` a second time with `trace_type: 'intake_analysis'` for the same `caseId`. The M2 partial unique index — which is working correctly — blocks the second insert with a `23505` constraint violation.

This is a **test design flaw introduced in H1**, not a production code defect. The tests were written before M2 was applied to the live DB and were only verified with skipped integration tests (no live DB). When run against the real DB with M2 enforced, the conflict surfaces.

The M2 constraint is behaving exactly as intended. The test needs to use a distinct `trace_type` (e.g., `food_analysis`) for the second insert, or clean up the first trace before inserting a replacement.

**RESULT: FAIL**  
**Notes:** 25/26 CRT tests pass against the live DB. 1 test fails due to a conflict between the H1 test design and the M2 constraint. The constraint itself is correct. This requires a scoped fix to `createReasoningTrace.test.ts` — out of scope for this verification sweep.

---

## CHECK 5 — M3 logging payload safety

**PROCEDURE:**  
Read exact log payload shapes from `apps/web/app/dashboard/story/actions.ts`.

**OBSERVED:**

```typescript
// body_story.start
console.log(JSON.stringify({
  event:   'body_story.start',
  user_id: memberId,
}))

// body_story.insufficient_data
console.log(JSON.stringify({
  event:   'body_story.insufficient_data',
  user_id: memberId,
  reason:  'no_intake_answers',
}))

// body_story.success
console.log(JSON.stringify({
  event:         'body_story.success',
  user_id:       memberId,
  trace_id:      caseId,
  duration_ms:   Date.now() - startMs,
  input_tokens:  message.usage.input_tokens,
  output_tokens: message.usage.output_tokens,
}))

// body_story.failure
console.log(JSON.stringify({
  event:       'body_story.failure',
  user_id:     memberId,
  error_code:  errorCode,   // err.message or String(err)
  duration_ms: Date.now() - startMs,
}))
```

Fields present across all four events:

| Field | Type | Contains user/clinical content? |
|---|---|---|
| `event` | string literal | No |
| `user_id` | UUID string | No (identifier only) |
| `reason` | string literal `'no_intake_answers'` | No |
| `trace_id` | UUID string | No (identifier only) |
| `duration_ms` | number | No |
| `input_tokens` | number | No |
| `output_tokens` | number | No |
| `error_code` | `err.message` or `String(err)` | See note |

**Note on `error_code`:** In the failure path, `errorCode = err instanceof Error ? err.message : String(err)`. If Claude returns an error that echoes back the prompt or intake content in the message string (e.g., a custom error wrapping API response body), that content would appear in the log. The current error paths only throw on infrastructure failures (`ANTHROPIC_API_KEY not configured`, `Claude returned empty content`, `Claude response was not valid JSON: ...`). The JSON-parse error case includes `cleaned.slice(0, 200)` of Claude's raw response — which is model output, not user intake data. This is a low-severity edge case but worth noting.

**RESULT: PASS**  
**Notes:** No intake answers, story content, lab values, or clinical narrative in any log event. The `error_code` field in `body_story.failure` may include up to 200 characters of malformed Claude output in the JSON parse error path — this is model output, not user-supplied data, and only fires on error.

---

## CHECK 6 — H3/H4/H5 cleanup didn't shift the problem

**PROCEDURE:**  
```bash
grep -rn ": any| as any\b|<any>" \
  apps/web/app/dashboard/story \
  apps/care/app/cases \
  packages/db/src/crt

grep -rn "as unknown as" \
  apps/web/app/dashboard/story \
  apps/care/app/cases \
  packages/db/src/crt
```

**OBSERVED:**

`grep ": any | as any | <any>"` → **0 matches** in all three paths.

`grep "as unknown as"` → matches:

| File | Line | Content | Classification |
|---|---|---|---|
| `apps/care/app/cases/page.tsx` | 57 | `c.profiles as unknown as { full_name: string \| null } \| null` | Pre-existing; out of sprint scope |
| `apps/care/app/cases/[caseId]/reasoning/page.tsx` | 96 | `clientCase.profiles as unknown as { full_name: string \| null } \| null` | Pre-existing; out of sprint scope |
| `packages/db/src/crt/createReasoningTrace.test.ts` | 37, 69, 99 | `} as unknown as ReturnType<typeof createClient<Database>>` | Expected — mock client pattern |
| `packages/db/src/crt/getClientStory.test.ts` | 38, 61 | `} as unknown as ReturnType<typeof createClient<Database>>` | Expected — mock client pattern |
| `packages/db/src/crt/getOrCreateClientCase.test.ts` | 34, 56, 83 | `} as unknown as ReturnType<typeof createClient<Database>>` | Expected — mock client pattern |
| `packages/db/src/crt/getPractitionerTrace.test.ts` | 36, 57 | `} as unknown as ReturnType<typeof createClient<Database>>` | Expected — mock client pattern |

The two care app usages (`profiles as unknown as`) are the same pattern as H3 fixed in `getClientStory.ts` — they cast a Supabase join result that infers `Json` rather than the actual row shape. These are **pre-existing** and were not introduced by this sprint. They are outside the H3/H4/H5 scope (which targeted `packages/db/src/crt/` production files only). No new unsafe casts were introduced.

**RESULT: PASS**  
**Notes:** Zero `as any` hits. Test-file `as unknown as` usages are the standard mock-client pattern (correct). Two pre-existing `as unknown as` casts in care app are out of sprint scope but are candidates for a follow-up cleanup.

---

## Summary

| Check | Result | Action required |
|---|---|---|
| **1** — Migration 0033 reproducibility | **CONCERN** | Triggers and policies lack `IF NOT EXISTS` guards; header claim of full idempotency is inaccurate. Applies cleanly to fresh DB. Corrective migration needed before this file is used as a reset baseline. |
| **2** — M2 index data integrity | **PASS** | Zero pre-existing duplicates. Index created cleanly. |
| **3** — M1 timeout proxy accuracy | **PASS** | Fire-and-forget gap is 0–2s. No more accurate timestamp available. Proxy is appropriate for v1. |
| **4** — H1 integration tests exercised RLS | **FAIL** | 1 of 26 CRT tests fails against the live DB: `createReasoningTrace > writes trace entries with correct fields` violates the M2 unique index. Test design flaw — second `intake_analysis` insert needs a distinct `trace_type`. Requires a scoped corrective fix. |
| **5** — M3 logging payload safety | **PASS** | All log events contain only identifiers, timing, and token counts. Minor edge case noted in `error_code` (model output only, not user data). |
| **6** — H3/H4/H5 wider cleanup | **PASS** | Zero `as any` hits. Two pre-existing `as unknown as` in care app are out of scope. No regressions introduced. |

**Overall closure status:** V.8 is NOT fully closed. Two items require corrective work before sign-off:

1. **CHECK 4 (FAIL):** Fix `createReasoningTrace.test.ts` — use a distinct `trace_type` for the second integration test insert so it doesn't conflict with the M2 index. One test, one line change.
2. **CHECK 1 (CONCERN):** Add idempotency guards to migration 0033 for `CREATE TRIGGER` and `CREATE POLICY` statements, or retract the "safe against existing DB" claim in the header.

Awaiting explicit approval before corrective phase.
