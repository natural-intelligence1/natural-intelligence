# B.4 Verification Report — Escalation Flow + Admin Handoff

**Phase:** B.4 — Escalation Flow + Admin Handoff (final sub-phase of Phase B)
**Date:** 2026-05-18
**Deployment:** `dpl_6aC2hur7fsbW1RHHM3ZfxQDRB6cR` (READY) — `312c9ad`
**Commits (B.4):** `f743dc6` (RPC migration 0045) · `312c9ad` (ActionPanel + CaseHistoryPanel)
**Status:** 16/16 smoke checks PASS. No findings. B.4 complete. Phase B closed.

---

## What was built

### Database (migration 0045)
- `complete_practitioner_work` RPC extended for the escalation path:
  - `case_practitioner_work.status` → `'escalated'` (CASE expression on `p_decision`)
  - `client_cases.escalation_required` → `true` (new — only when escalating)
  - `completed_at`, `output_event_id`, `notes` stamped regardless
  - All three writes atomic in the same `SECURITY DEFINER` transaction
  - Layer 2 check unchanged: `practitioner_id = auth.uid()` + `status IN ('assigned','in_review') FOR UPDATE`

### Care app (ActionPanel + CaseHistoryPanel)
- Escalate radio is selectable (no [B.4] marker)
- Escalation compose mode (active when `decision === 'escalated'`):
  - Notes label changes to **"Escalation reason"** with red asterisk; required
  - Submit gated on non-empty reason (separate from `canSubmit` for approved/needs_revision)
  - 5 shortcut buttons render above the textarea: `Senior practitioner / Specialist referral / GP letter / Urgent safety / Other`
  - Helper text `"Provide an escalation reason to submit."` shown when empty
  - Submit button text/colour: `"Escalate for admin review"` / amber `#D97706`
- Shortcut prefix semantics (addendum S6):
  - Empty + click `[X]` → `"[X] "`
  - Free text + click `[X]` (no existing prefix) → `"[X] <text>"`
  - Click `[Y]` when prefix exists → replaces `[X]` with `[Y]`, preserves rest
  - Click `[Other]` → clears any prefix
- Confirm state (escalation-specific):
  - Copy: `"You are about to escalate this case for admin review."`
  - Amber visual treatment on decision badge and primary button
  - Buttons: `"Confirm and submit"` + `"Back to edit"`
- Success state (escalation-specific):
  - `"↑ Escalated · Flagged for admin review."`
  - Subcopy: `"An admin will pick this case up for review."`
  - `Back to inbox` link
- Reload after escalation (`status === 'escalated'` from server) renders success
  state directly via `status` prop (Option A — no event fetch)
- CaseHistoryPanel: payload summary for escalated decisions reads `"↑ Escalated · <name>"`

### Pre-implementation findings (resolved before any code)
1. RPC needed both status and `escalation_required` flag changes (the latter was never touched in any prior migration). → addressed in 0045.
2. `listWorkForInbox` already binned escalated items correctly into the Escalated section — **no change needed**.
3. ActionPanel success initialisation needed to include `'escalated'` (it was `=== 'completed'` only) — addressed in code rewrite.
4. Success copy needed an escalated branch (existing helper handled only approved/needs_revision/null) — addressed.
5. Reload copy: derive from `status` prop (Option A approved) — no event fetch added.

---

## Automated checks

| Check | Result |
|---|---|
| `pnpm --filter care type-check` | ✅ clean |
| `pnpm --filter care lint` | ✅ no ESLint warnings or errors |
| `pnpm --filter @natural-intelligence/db test` | ✅ 169 passed, 69 skipped (no regressions) |
| `pnpm --filter care build` | ✅ workspace route 4.15 → 4.75 kB |

No new admin-client exceptions introduced. No new RLS surfaces; the F3 fix from B.3 already covered the `case_events_practitioner_select` policy for `'escalated'`.

---

## Smoke checks

**Test subjects:**
- Dr Sarah Chen (practitioner A): `e8ee62b0-1f94-4c52-8005-b52a6d2b6d12`
- Lena Parrish (practitioner B): `c0334d65-2bde-4bca-aa0c-1d5cd33a1e18`
- Work item under test: `dddddddd-0000-4000-8000-000000000004` (case `cccccccc-...`, `case_review`, `in_review` at start)

---

### SMOKE-1 — Escalate radio is selectable

**Procedure:** Loaded workspace. Inspected DOM.

**Observed:**
```js
radioCount: 3
escalateExists: true
escalateDisabled: false
b4MarkerInBody: false
```

**Result:** ✅ PASS — no [B.4] placeholder; radio enables.

---

### SMOKE-2 — Reason field is required

**Procedure:** Clicked Escalate radio. Inspected submit button + helper.

**Observed:**
```
submitText:            "Escalate for admin review"
submitDisabled:        true
submitOpacity:         "0.5"
submitBg:              "rgb(217, 119, 6)"   (amber)
helperText:            "Provide an escalation reason to submit."
escalationReasonLabel: true                  ("Escalation reason *")
shortcutCount:         5
shortcutLabels:        ["Senior practitioner","Specialist referral","GP letter","Urgent safety","Other"]
```

**Result:** ✅ PASS

---

### SMOKE-3 — Shortcut buttons append/replace/clear correctly

**Procedure:** Cleared reason. Ran 5-step interaction sequence.

**Observed:**
| Step | Reason value |
|---|---|
| empty + click `[Senior practitioner]` | `"[Senior practitioner] "` (trailing space) |
| append `"needs hormone review"` | `"[Senior practitioner] needs hormone review"` |
| click `[Specialist referral]` (replace) | `"[Specialist referral] needs hormone review"` |
| click `[Other]` (clear) | `"needs hormone review"` |
| click `[GP letter]` (prepend) | `"[GP letter] needs hormone review"` |

**Result:** ✅ PASS — all 5 cases match spec exactly.

---

### SMOKE-4 — Confirm state has escalation-specific copy

**Procedure:** With reason `"[GP letter] needs hormone review"`, clicked `Escalate for admin review`.

**Observed:**
```
REVIEW ACTIONS
In review · Overdue · Started 7d ago

You are about to escalate this case for admin review.

↑ Escalated
Escalation reason
[GP letter] needs hormone review
[Confirm and submit] [Back to edit]
```

**Result:** ✅ PASS — escalation copy, ↑ marker, amber decision badge, reason preview, both buttons.

---

### SMOKE-5 — Back to edit returns to compose with reason preserved

**Procedure:** Clicked `Back to edit` from confirm state.

**Observed:**
```js
backInCompose:     true
reasonPreserved:   "[GP letter] needs hormone review"
decisionPreserved: true  // escalated radio still checked
```

**Result:** ✅ PASS

---

### SMOKE-6 — Full escalation submit (Compose → Confirm → Loading → Success)

**Procedure:** Re-entered confirm. Clicked `Confirm and submit`. Waited 4s.

**Observed:**
```
REVIEW ACTIONS
In review · Overdue · Started 7d ago
↑
↑ Escalated · Flagged for admin review.
An admin will pick this case up for review.
Back to inbox  → href "/cases"
```
```js
draftExistedBefore:     true
draftClearedAfterSubmit: true   // localStorage.getItem(key) === null
hasError:               false
```

**Result:** ✅ PASS — RPC succeeded, success copy correct, draft cleared, back-to-inbox link present.

---

### SMOKE-7 — Inbox section binning

**Procedure:** Navigated to `/cases`.

**Observed:**
```
PRACTITIONER INBOX — All reviews complete

NEEDS REVIEW
No assigned work. New cases will appear here…

ESCALATED (1)
⚠ Natural Intelligence — case_review — Awaiting admin

COMPLETED RECENTLY
⚠ Natural Intelligence — case_review — Completed 3d ago
```

The just-escalated item appears in **ESCALATED**, NOT in Completed Recently. The previously-completed B.3 item is still in Completed Recently. No In Progress section (correct, all in_review items have been resolved).

**Result:** ✅ PASS

---

### SMOKE-8 — Workspace reload post-escalation (State 4 / read-only)

**Procedure:** Hard-navigated back to workspace URL.

**Observed:**
```
REVIEW ACTIONS
Escalated · Overdue · Started 7d ago
↑
↑ Escalated · Flagged for admin review.
An admin will pick this case up for review.
Back to inbox
```
```js
statusBadge:         "Escalated · Overdue · Started 7d ago"
successCopyOnReload: true
noComposeForm:       true   // no textarea
noRadios:            true
hasBackToInbox:      true
```

**Result:** ✅ PASS — Status badge updated to `Escalated`; success state on mount; no submit form. Option A (status-prop-derived copy) confirmed.

---

### SMOKE-9 — case_event payload

**Query:**
```sql
SELECT event_type, source_table, source_id, event_payload
  FROM public.case_events
 WHERE case_id = 'cccccccc-0000-4000-8000-000000000003'
   AND event_payload->>'decision' = 'escalated'
 ORDER BY created_at DESC LIMIT 1;
```

**Observed:**
```json
{
  "event_type": "practitioner_decision",
  "source_table": "case_practitioner_work",
  "source_id": "dddddddd-0000-4000-8000-000000000004",
  "event_payload": {
    "notes": "[GP letter] needs hormone review",
    "decision": "escalated",
    "work_type": "case_review",
    "completed_at": "2026-05-18T19:33:52.721714+00:00",
    "work_item_id": "dddddddd-0000-4000-8000-000000000004",
    "recommendation": "",
    "practitioner_id": "e8ee62b0-1f94-4c52-8005-b52a6d2b6d12",
    "practitioner_display_name": "Dr Sarah Chen"
  }
}
```

All 8 payload fields present per B.3 spec, with `decision='escalated'` and `notes` containing the shortcut-prefixed reason.

**Result:** ✅ PASS

---

### SMOKE-10 — `client_cases.escalation_required` flag

**Observed:**
```
case_id              | escalation_required
cccccccc-…-000000003 | true
```

**Result:** ✅ PASS — flag set atomically with the work-item update by migration 0045's new `IF p_decision = 'escalated' THEN UPDATE client_cases…` block.

---

### SMOKE-11 — Work item status and completion stamping

**Observed:**
```
work_id              | dddddddd-…-000000004
status               | escalated
completed_at         | 2026-05-18 19:33:52.721714+00
output_event_id      | c7deafc3-8f42-4a81-addf-985931d92188
notes                | [GP letter] needs hormone review
```

**Result:** ✅ PASS — `status='escalated'` (not `'completed'`), `completed_at` populated, `output_event_id` points at the case_event row from SMOKE-9.

---

### SMOKE-12 — CaseHistoryPanel renders escalation event

**Procedure:** Expanded Case History on the reloaded workspace.

**Observed:**
```
CASE HISTORY  1 event  ▲

Practitioner decision   ↑ Escalated · Dr Sarah Chen   18 May 2026, 19:33
```

**Result:** ✅ PASS — `Practitioner decision` event type label + `↑ Escalated · Dr Sarah Chen` payload summary (combining `decision` and `practitioner_display_name` from the 8-field payload).

---

### SMOKE-13 — Authorisation Layer 1 (RLS)

**Procedure:**
```sql
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"c0334d65-…","role":"authenticated"}';
SELECT auth.uid()::text AS lena_uid,
       COUNT(*)::text   AS rows_visible
  FROM public.case_practitioner_work
 WHERE id = 'dddddddd-0000-4000-8000-000000000004';
ROLLBACK;
```

**Observed:**
```
lena_uid:     c0334d65-2bde-4bca-aa0c-1d5cd33a1e18
rows_visible: 0
```

**Result:** ✅ PASS — `case_practitioner_select` RLS hides Sarah Chen's escalated work from Lena.

---

### SMOKE-14 — Authorisation Layer 2 (RPC)

**Procedure:** To isolate Layer 2 from the status guard, inserted a temporary `in_review` work item assigned to Sarah Chen, then attempted to escalate it as Lena. Rolled back at end.

```sql
BEGIN;
INSERT INTO public.case_practitioner_work (id, case_id, practitioner_id, work_type, status, …)
VALUES ('99999999-…-000099', 'cccccccc-…-000003', 'e8ee62b0-… (Sarah)', 'case_review', 'in_review', …);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"c0334d65-… (Lena)","role":"authenticated"}';

SELECT public.complete_practitioner_work('99999999-…-000099', 'escalated', 'attack', '');
ROLLBACK;
```

**Observed:**
```
ERROR:  P0001: Work item not found or not in a completable state
CONTEXT:  PL/pgSQL function complete_practitioner_work(uuid,text,text,text) line 21 at RAISE
```

The RPC's `SELECT … FOR UPDATE` finds zero rows for `id = … AND practitioner_id = auth.uid()` because Lena's `auth.uid()` is `c0334d65-…` but the row's `practitioner_id` is `e8ee62b0-…`. The `IF NOT FOUND THEN RAISE EXCEPTION` then fires.

**Result:** ✅ PASS — Layer 2 isolated and verified.

---

### SMOKE-15 — Authorisation Layer 3 (server action)

**Evidence by code inspection** of `apps/care/app/cases/actions.ts`:

| Line | Mechanism | Effect |
|---|---|---|
| 22 | `submitReview(workItemId, decision, notes, recommendation)` | No `practitioner_id` parameter — client cannot spoof identity. |
| 28 | `const supabase = createServerSupabaseClient()` | SSR client bound to the caller's request cookies. Uses *the caller's* session, not any client-supplied identity. |
| 33 | `await supabase.auth.getUser()` | Validates the JWT with Supabase Auth (not local decode). Catches revoked sessions before any DB round-trip. |
| 34–36 | `if (authError \|\| !user) return { ok: false, code: 'auth', … }` | No session → immediate auth-error return. |
| 39 | `await completeWorkItem(supabase, { workId, decision, notes, recommendation })` | Passes the *same* cookie-bound SSR client to the RPC helper. Inside the RPC, `auth.uid()` therefore returns the caller's actual id. |

Result of this construction: if Lena (logged in) POSTs to `submitReview` with Sarah Chen's `workItemId`, the RPC call runs in Lena's auth context, and Layer 2 (SMOKE-14) rejects with the same `'Work item not found or not in a completable state'` exception. The server action's `try/catch` then returns `{ ok: false, code: 'error' }` to her client.

**Result:** ✅ PASS — Layer 3 is structurally sound: no client-trusted identity field, server-validated session, and the resulting RPC call inherits Layer 2's protection.

---

### SMOKE-16 — Admin query for escalated work

**Query:**
```sql
SELECT cw.id, cw.status, cw.case_id, cc.escalation_required
  FROM public.case_practitioner_work cw
  JOIN public.client_cases cc ON cc.id = cw.case_id
 WHERE cw.status = 'escalated';
```

**Observed:**
```
work_id              | status     | case_id              | escalation_required
dddddddd-…-000000004 | escalated  | cccccccc-…-000000003 | true
```

The escalated work from SMOKE-6 surfaces in the admin-context SQL with the linked `escalation_required` flag.

**Result:** ✅ PASS — admin SQL queries return the expected row. No admin UI work in B.4 (out of scope per spec).

---

## Summary

| # | Check | Result |
|---|---|---|
| 1 | Escalate radio is selectable, no [B.4] marker | ✅ PASS |
| 2 | Reason field required (submit disabled + helper text) | ✅ PASS |
| 3 | Shortcut prefix append/replace/clear semantics (5/5 cases) | ✅ PASS |
| 4 | Confirm state escalation-specific copy + amber treatment | ✅ PASS |
| 5 | Back to edit returns to compose, reason+decision preserved | ✅ PASS |
| 6 | Full submit → Success ("↑ Escalated · Flagged for admin review.") | ✅ PASS |
| 7 | Inbox bins escalated to Escalated section, not Completed Recently | ✅ PASS |
| 8 | Reload renders State 4 read-only with "Escalated" status badge | ✅ PASS |
| 9 | case_event payload has all 8 fields, decision='escalated' | ✅ PASS |
| 10 | `client_cases.escalation_required = true` | ✅ PASS |
| 11 | `work_item.status = 'escalated'`, completed_at populated | ✅ PASS |
| 12 | CaseHistoryPanel renders `↑ Escalated · Dr Sarah Chen` | ✅ PASS |
| 13 | Layer 1 RLS — practitioner B sees 0 rows | ✅ PASS |
| 14 | Layer 2 RPC — practitioner B raises 'Work item not found…' | ✅ PASS |
| 15 | Layer 3 server action — no spoofable identity; structural proof | ✅ PASS |
| 16 | Admin SQL surfaces escalated work + escalation_required flag | ✅ PASS |

**16/16 PASS. No findings. No new admin-client exceptions. No new RLS policies created (B.3's F3 fix already covered case_events for `'escalated'` status).**

---

## Phase B closure

B.1 (Inbox) · B.2 (Workspace) · B.3 (Completion) · B.4 (Escalation) all complete.

The full practitioner loop now works end-to-end against live data:
> assigned/in_review → review workspace → approved | needs_revision | escalated → case_event audit row + inbox section transition + (for escalation) `escalation_required` flag → admin can query.

*B.4 complete. Awaiting explicit approval before Phase B closure work or Phase C scoping.*
