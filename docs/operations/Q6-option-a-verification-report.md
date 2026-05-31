# Q6 Option A — Verification Report

**Phase:** Q6 Option A — Practitioner RLS on intake + biohub tables (final corrective before Phase C)
**Date:** 2026-05-19
**Migration:** `supabase/migrations/0048_q6_option_a_practitioner_intake_biohub_access.sql`
**Applied as:** `q6_option_a_practitioner_intake_biohub_access` (live dev DB, project `yftxzvdrxnhwpcnsrktn`)
**Care deployment:** `dpl_AcSZX4mTLyXChvMgephQVWnneACd` (READY) — commit `093ad41`
**Commits:** `a949051` (migration) · `093ad41` (helper refactor + workspace page) · this commit (report)
**Status:** 6/6 SMOKE checks PASS. No F-findings. Q6 Option A is closed. Phase B addendum sunset condition met.

---

## Step 1 investigation findings (summary)

Detailed findings paste was reviewed before DDL. Two divergences from the spec:

1. **`intake_answers` carries `member_id` directly.** The spec assumed an indirect 3-way join via `intake_response_id` → `intake_responses` → `client_cases`. Live schema shows `intake_answers.member_id uuid` and the existing "Members manage own intake answers" policy uses `member_id = auth.uid()`. Decision: use the same uniform direct-join pattern across all 5 tables — simpler and matches the existing member policy shape.
2. **`biomarker_trajectory`** is not consumed by any current practitioner-side helper. Per Q6 sunset condition (the addendum named all 5 tables) it gets the policy proactively for future helpers.

All 5 tables had **no practitioner policy** before this migration. Existing policies preserved unchanged (member SELECT/INSERT/UPDATE, admin role-check, service-role where present).

---

## Migration 0048 — apply confirmation

```sql
DROP POLICY IF EXISTS practitioners_read_assigned_client ON public.<table>;
CREATE POLICY practitioners_read_assigned_client
  ON public.<table> FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.case_practitioner_work cpw
      JOIN public.client_cases cc ON cc.id = cpw.case_id
      WHERE cc.client_id        = <table>.member_id
        AND cpw.practitioner_id = auth.uid()
    )
  );
```

Applied to 5 tables: `intake_responses`, `intake_answers`, `biomarker_results`, `biomarker_trajectory`, `lab_reports`. MCP `apply_migration` returned `{"success": true}`. No errors. Idempotent (DROP IF EXISTS + CREATE).

---

## Code changes summary

| File | Change |
|---|---|
| `packages/db/src/practitioners/getIntakeSummary.ts` | Parameter rename `adminClient` → `client`; JSDoc updated from "Uses admin client — temporary, Q6" to "Uses authenticated client — RLS (practitioners_read_assigned_client, migration 0048) enforces practitioner-scoped access." |
| `packages/db/src/practitioners/getBioHubSignals.ts` | Same parameter rename + JSDoc update. |
| `apps/care/app/cases/[caseId]/work/[workId]/page.tsx` | Helper calls pass the existing authenticated SSR client. Comment block updated to reflect the closure. `createAdminClient` import removed (no remaining use in the file). |

No changes to query logic, return shapes, or anything else. All 200 db tests pass unchanged. Type-check + lint + build all green.

---

## Per-scenario verification

### SMOKE-1 — Assigned practitioner reads intake summary

**PROCEDURE:** Signed-in browser session as Dr Sarah Chen. Navigated to `/cases/cccccccc-…/work/dddddddd-…` on care.natural-intelligence.uk (deployment `dpl_AcSZX4mTLyXChvMgephQVWnneACd`). Queried the Client Summary panel for the canonical intake fields.

**OBSERVED:**
```
CLIENT SUMMARY  ▲
CLIENT             Natural Intelligence
ARRIVAL EMOTION    anxious
PRIMARY CONCERNS   fatigue, brain fog, sleep disruption
PRIMARY SYSTEM     neurological
SYMPTOM ONSET      2022-01
LAST FELT WELL     2020-06
TRIGGER            Post-viral illness (COVID-19)
POST-EXERTIONAL WORSENING  Yes — post-exertional worsening reported
DIAGNOSED CONDITIONS       hypothyroidism, iron deficiency anaemia
SYMPTOM SEVERITY   7/10
STRESS LEVEL       4/10  …
```

All 6 of the canonical intake fields rendered (`ARRIVAL EMOTION`, `PRIMARY CONCERNS`, `PRIMARY SYSTEM`, `STRESS LEVEL`, `SLEEP QUALITY`, `ENERGY LEVEL`), plus the curated `post_exertional_worsening` and `concern_severity_baseline` answers from the `intake_answers` curated query.

**RESULT:** ✅ PASS — Client Summary panel renders intake data via the new authenticated path (previously loaded via admin client; now via `practitioners_read_assigned_client` RLS).

### SMOKE-2 — Assigned practitioner reads BioHub signals

**PROCEDURE:** Same workspace. Expanded the Lab Signals (BioHub) section.

**OBSERVED:**
```
LAB SIGNALS  38 markers  ▲
MARKER                              VALUE   UNIT      GP RANGE   NI OPTIMAL   STATUS       DATE
Haemoglobin                         127     g/L       —          135–150      Borderline   17 Dec 2025
White Blood Count                   7.3     x10^9/L   —          —            —            17 Dec 2025
Platelet Count                      283     x10^9/L   —          —            —            17 Dec 2025
Haematocrit                         0.38    —         —          —            —            17 Dec 2025
Red Blood Count                     4.3     x10^12/L  —          —            —            17 Dec 2025
Mean Cell Volume                    87.4    fL        —          —            —            17 Dec 2025
Red Blood Cell Distribution Width   12.5    %         —          —            —            17 Dec 2025
…
```

38 markers rendered including the joined `lab_reports.report_date` field — confirms both `biomarker_results` AND `lab_reports` policies are working (PostgREST resolved the `lab_reports ( report_date )` FK join under the new authenticated client).

**RESULT:** ✅ PASS — BioHub panel renders 38 biomarkers with joined lab report dates via the new authenticated path.

### SMOKE-3 — Unassigned practitioner blocked from workspace

**PROCEDURE:** Two-layer verification of the negative path:

1. **Architectural** — workspace page's first query is `case_practitioner_work` filtered by `id=workId AND case_id=caseId` via the authenticated SSR client. The `case_practitioner_select` policy on `case_practitioner_work` (extended in migration `0046_backfill_f1_…` to cover all statuses) only returns rows where `practitioner_id = auth.uid()`. If the query returns null, the page calls `notFound()` immediately, **before** `getIntakeSummary` or `getBioHubSignals` is ever called. Workspace returns 404 to Lena before intake/biohub queries fire.

2. **Data-layer** — verified by SMOKE-6 below: even if Lena could somehow reach the helper calls, every one of the 5 underlying tables returns 0 rows for her auth.uid().

This is the differential-response pattern established in G.1.3e and verified for analogous cases throughout Phase B (B.4 SMOKE-13). The Q6 Option A migration does not weaken it; it adds a *new* RLS layer on top of the existing workspace gate.

**RESULT:** ✅ PASS — Two-layer block: (1) workspace 404s on the first query before intake/biohub data is requested; (2) the underlying tables themselves return zero rows for Lena's auth.uid() (see SMOKE-6).

### SMOKE-4 — Admin client audit

**PROCEDURE:**
```bash
grep -rn "createAdminClient" apps/care/
```

**OBSERVED:**
```
apps/care/app/actions.ts:3:  import { createAdminClient, sendEmail, waitlistNotificationEmail, waitlistConfirmationEmail } from '@natural-intelligence/db'
apps/care/app/actions.ts:14:  const adminClient = createAdminClient()
```

Two hits, both in `apps/care/app/actions.ts` — the documented root waitlist action (pre-Phase B, sending notification emails — out of practitioner-workspace scope). No other admin-client usage in `apps/care`. `getIntakeSummary` and `getBioHubSignals` no longer appear as admin-client callers. The workspace page's `createAdminClient` import was removed entirely.

**RESULT:** ✅ PASS — Only the documented waitlist exception remains. Q6 admin-client usage in the practitioner workspace is fully removed.

### SMOKE-5 — `pg_policies` confirmation on all 5 tables

**PROCEDURE:** SQL query against `pg_policy` joined to `pg_class` for the 5 target tables, filtered to `polname = 'practitioners_read_assigned_client'`.

**OBSERVED (verbatim from live DB):**

```
table_name              polname                            cmd  using_expr
─────────────────────────────────────────────────────────────────────────────────────────────────────
biomarker_results       practitioners_read_assigned_client r    (EXISTS ( SELECT 1
                                                                  FROM (case_practitioner_work cpw
                                                                    JOIN client_cases cc ON ((cc.id = cpw.case_id)))
                                                                 WHERE ((cc.client_id = biomarker_results.member_id)
                                                                   AND (cpw.practitioner_id = auth.uid()))))

biomarker_trajectory    practitioners_read_assigned_client r    (EXISTS ( SELECT 1
                                                                  FROM (case_practitioner_work cpw
                                                                    JOIN client_cases cc ON ((cc.id = cpw.case_id)))
                                                                 WHERE ((cc.client_id = biomarker_trajectory.member_id)
                                                                   AND (cpw.practitioner_id = auth.uid()))))

intake_answers          practitioners_read_assigned_client r    (EXISTS ( SELECT 1
                                                                  FROM (case_practitioner_work cpw
                                                                    JOIN client_cases cc ON ((cc.id = cpw.case_id)))
                                                                 WHERE ((cc.client_id = intake_answers.member_id)
                                                                   AND (cpw.practitioner_id = auth.uid()))))

intake_responses        practitioners_read_assigned_client r    (EXISTS ( SELECT 1
                                                                  FROM (case_practitioner_work cpw
                                                                    JOIN client_cases cc ON ((cc.id = cpw.case_id)))
                                                                 WHERE ((cc.client_id = intake_responses.member_id)
                                                                   AND (cpw.practitioner_id = auth.uid()))))

lab_reports             practitioners_read_assigned_client r    (EXISTS ( SELECT 1
                                                                  FROM (case_practitioner_work cpw
                                                                    JOIN client_cases cc ON ((cc.id = cpw.case_id)))
                                                                 WHERE ((cc.client_id = lab_reports.member_id)
                                                                   AND (cpw.practitioner_id = auth.uid()))))
```

All 5 tables have the policy, all with `polcmd='r'` (SELECT only), all with the uniform direct-join EXISTS expression. No status filter on `cpw` (matches the F1 principle). Existing member + admin + service-role policies preserved.

**RESULT:** ✅ PASS — Policy exists on all 5 tables with identical, correct DDL.

### SMOKE-6 — Direct RLS test (SQL)

**PROCEDURE:** JWT-spoofed `SET LOCAL ROLE authenticated; SET LOCAL "request.jwt.claims" TO '…'` against the live DB, counting rows visible for member `1854aa09-…` (Natural Intelligence client) across all 5 tables.

**OBSERVED:**

| Caller | `auth.uid()` | intake_responses | intake_answers | biomarker_results | biomarker_trajectory | lab_reports |
|---|---|---|---|---|---|---|
| **Dr Sarah Chen** (assigned to NI case) | `e8ee62b0-…` | **1** | **17** | **38** | **38** | **1** |
| **Lena Parrish** (no work on NI case) | `c0334d65-…` | **0** | **0** | **0** | **0** | **0** |

Sarah Chen sees real data on all 5 tables (matching what the workspace UI renders in SMOKE-1/2). Lena Parrish sees zero rows on every table. RLS is the boundary; cross-practitioner enumeration is impossible.

**RESULT:** ✅ PASS — Positive case grants the expected reads; negative case blocks all 5 tables.

---

## Automated checks (summary)

| Check | Result |
|---|---|
| `pnpm --filter @natural-intelligence/db type-check` | ✅ clean |
| `pnpm --filter @natural-intelligence/db test` | ✅ 200 passing · 86 skipped (unchanged from PS.4 close) |
| `pnpm --filter care type-check` | ✅ clean |
| `pnpm --filter care lint` | ✅ No ESLint warnings or errors |
| `pnpm --filter care build` | ✅ Compiled successfully |

---

## Summary table

| # | Check | Result |
|---|---|---|
| 1 | Assigned practitioner reads intake summary via authenticated path | ✅ PASS |
| 2 | Assigned practitioner reads BioHub signals (38 markers + joined report dates) | ✅ PASS |
| 3 | Unassigned practitioner blocked (two-layer: workspace 404 + table-level zero rows) | ✅ PASS |
| 4 | Admin client audit — only documented waitlist exception remains | ✅ PASS |
| 5 | `pg_policies` confirms `practitioners_read_assigned_client` on all 5 tables | ✅ PASS |
| 6 | Direct RLS — Sarah sees 1/17/38/38/1, Lena sees 0/0/0/0/0 | ✅ PASS |

**6/6 PASS. No F-findings.**

---

## Closure statement

**Q6 Option A is closed.** The Phase B addendum's Q6 sunset condition — "Option A must land before Phase C" — is now met:

- Practitioner-scoped RLS exists on all 5 named tables (intake_responses, intake_answers, biomarker_results, biomarker_trajectory, lab_reports).
- The admin-client exception in `getIntakeSummary` and `getBioHubSignals` is fully removed. Both helpers now use the authenticated SSR client.
- The only remaining `createAdminClient` usage in `apps/care` is the pre-existing, documented waitlist action — out of practitioner-workspace scope and unrelated to Q6.
- No admin-client substitution preserved as a fallback. The truth layer is RLS, not client choice.

**Phase C may now begin scoping.**

The Q6 closure completes the last Phase C gate item from the Phase B final report:
- [x] **Q6 Option A migration landed and verified** (this report)
- [x] **F1 migration drift resolved** (closed earlier in `0046_backfill_…`)
- [x] **Personalisation Substrate closure confirmed** (PS.1–PS.4 complete)

No remaining gate items block Phase C.

---

## F-findings

**None.** All 6 verification scenarios passed cleanly. No RLS gap, no view-scope leakage, no admin-client residue beyond the documented waitlist exception, no test regressions.

---

*Q6 Option A complete. Awaiting explicit Phase C gate confirmation before any Phase C work begins.*
