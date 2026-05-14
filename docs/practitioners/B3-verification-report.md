# B.3 Verification Report — Completion Flow

**Phase:** B.3 — Completion Flow + Writes  
**Date:** 2026-05-15  
**Deployment:** `dpl_2rCbh8886pa3x5VCd4mfcezwvoa7` (READY) — `c81c785`  
**Commits (B.3):** `a0a3192` (migrations) · `db4baed` (server action) · `175905d` (ActionPanel) · `c81c785` (CaseHistoryPanel label)  
**Finding:** F3 — `case_events_practitioner_select` policy too narrow (discovered during smoke, fixed in `9126e89`)  
**Status:** 14/14 smoke checks PASS. F3 closed. B.3 complete.

---

## What was built

B.3 wires the ActionPanel submit button to the `complete_practitioner_work` RPC via a `'use server'` action, implementing a 5-state inline completion UX.

**Migrations:**
- `0042` — adds `'practitioner_decision'` to `case_events_event_type_check` constraint
- `0043` — rewrites `complete_practitioner_work` RPC: event_type `'practitioner_note'` → `'practitioner_decision'`, structured 8-field payload (work_item_id, work_type, decision, notes, recommendation, practitioner_id, practitioner_display_name, completed_at)
- `0044` — F3 fix: extends `case_events_practitioner_select` to cover `completed` and `escalated` statuses

**Code changes:**
- `apps/care/app/cases/actions.ts` — `'use server'` file, `submitReview()`: Layer 3 getUser() check → `completeWorkItem` → discriminated union result
- `apps/care/components/workspace/ActionPanel.tsx` — 5-state machine (compose/confirm/loading/success/error); Escalate disabled with [B.4] marker; draft cleared on success; success state initialised from server `status` prop
- `apps/care/components/workspace/CaseHistoryPanel.tsx` — `'Practitioner decision'` label + payload summary handler (`decision · practitioner_display_name`)

**169/169 unit tests passing. Lint clean. Type-check clean. Build clean.**

---

## Finding F3 — case_events RLS too narrow (discovered, fixed in B.3)

**Severity:** Medium — functional gap, no security impact.

**Root cause:** `case_events_practitioner_select` gated on `cpw.status IN ('assigned', 'in_review')`. After completing a work item (status → `'completed'`), the practitioner's SELECT on `case_events` returned 0 rows. CaseHistoryPanel showed "No events recorded" — including hiding the `practitioner_decision` event just written.

**Fix:** Migration `0044` extends the status filter to `('assigned', 'in_review', 'completed', 'escalated')`, mirroring the F1 fix applied to `case_practitioner_work` in migration `0036`.

**Pattern consistency:** Three RLS policies now follow the same completed/escalated visibility rule:
- `case_practitioner_select` (0036, F1 fix)
- `practitioner_client_identity` view (0041, F2 fix)
- `case_events_practitioner_select` (0044, F3 fix)

---

## Smoke checks

**Test subject:** Dr Sarah Chen (`e8ee62b0-1f94-4c52-8005-b52a6d2b6d12`)  
**Work item:** `aaaaaaaa-0000-4000-8000-000000000001` (case_review on case `10d4456a-…`)

---

### SMOKE-1 — Page loads correctly

**Procedure:** Navigated to `/cases/10d4456a-…/work/aaaaaaaa-…`.

**Observed:**
```js
document.title       // → "Case Review — NI Care"
document.querySelector('h1').textContent  // → "Natural Intelligence"
document.body.innerText.includes('404')   // → false
```

**Result:** ✅ PASS

---

### SMOKE-2 — ActionPanel renders in compose state

**Procedure:** Queried aside element and panel body text.

**Observed:** Panel body includes "Notes", "Decision", "Recommendation", "Complete review". No "Back to inbox", no "Confirm & submit".

**Result:** ✅ PASS

---

### SMOKE-3 — 3 decision radios present

**Observed:**
```js
radioValues: [
  { value: 'approved',       disabled: false, checked: true  },
  { value: 'needs_revision', disabled: false, checked: false },
  { value: 'escalated',      disabled: true,  checked: false },
]
```

**Result:** ✅ PASS

---

### SMOKE-4 — Escalate disabled with [B.4] marker

**Observed:**
```js
escalateDisabled: true
b4MarkerText: "[B.4] Escalation handling lands in B.4"
```

**Result:** ✅ PASS

---

### SMOKE-5 — Submit enabled for approved/needs_revision; disabled without decision

**Observed:** `approved` restored from localStorage draft. Submit button: `disabled: false`, `opacity: "1"`. Decision = 'approved' satisfies `canSubmit` predicate.

Code inspection confirms: `const canSubmit = decision === 'approved' || decision === 'needs_revision'` — 'escalated' excluded, null excluded.

**Result:** ✅ PASS

---

### SMOKE-6 — Compose → Confirm transition

**Procedure:** Called `click()` on "Complete review" button.

**Observed:** Confirm state rendered with "Confirm & submit" and "Edit" buttons; no radio inputs; decision summary "Approved" shown.

**Result:** ✅ PASS

---

### SMOKE-7 — Confirm state content

**Observed:**
```
REVIEW ACTIONS
In review · Overdue · Started 3d ago
Confirm your decision before submitting.
Approved
Notes
Test note for smoke verification — fatigue pattern consistent with post-viral onset.x
Confirm & submit
Edit
```

Decision label correct. Notes preview shown (truncated at 200 chars). No radio inputs in confirm state.

**Result:** ✅ PASS

---

### SMOKE-8 — Edit returns to compose, decision preserved

**Procedure:** Called `click()` on "Edit" button.

**Observed:**
```js
backInCompose: true       // radios present + Complete review button
checkedDecision: 'approved'
decisionPreserved: true
```

**Result:** ✅ PASS

---

### SMOKE-9 — Draft in localStorage before submit

**Observed:**
```js
draftExistsBefore: true
draftDecision: 'approved'
```

**Result:** ✅ PASS

---

### SMOKE-10 — Confirm & submit → Success (RPC completes)

**Procedure:** Clicked "Complete review" → "Confirm & submit". Waited 3.5s for server action round-trip.

**Observed:** Panel transitioned to success state. No error banner.

**DB verification:**
```sql
SELECT id, event_type, event_payload->>'decision', event_payload->>'practitioner_display_name'
FROM public.case_events
WHERE case_id = '10d4456a-…'
ORDER BY created_at DESC LIMIT 1;
-- → id: 2197f3b3-…, event_type: 'practitioner_decision', decision: 'approved', practitioner: 'Dr Sarah Chen'
```

**Result:** ✅ PASS

---

### SMOKE-11 — Success copy matches decision

**Observed:**
```
✓ Approved · Case event recorded.
This review is complete. The case event has been recorded.
Back to inbox
```

Copy for 'approved' decision correct per spec.

**Result:** ✅ PASS

---

### SMOKE-12 — Draft cleared from localStorage on success

**Observed:**
```js
draftCleared: true  // localStorage.getItem('ni-care:draft:aaaaaaaa-…') === null
```

**Result:** ✅ PASS

---

### SMOKE-13 — Back to inbox navigates to /cases; item in COMPLETED RECENTLY

**Observed:**
```js
href: '/cases'    // correct full-navigation anchor
```

After navigation to `/cases`:
```
PRACTITIONER INBOX — 1 item needs review
IN PROGRESS (1)
⚠ Natural Intelligence — case_review — Started 3d ago
COMPLETED RECENTLY
⚠ Natural Intelligence — case_review — Completed 4m ago
```

Completed item correctly moved to COMPLETED RECENTLY. Active items unaffected.

**Result:** ✅ PASS

---

### SMOKE-14 — Reload shows success state for completed work item

**Procedure:** Hard-navigated back to workspace URL. Page re-rendered with `status='completed'` from server.

**Observed:**
```
REVIEW ACTIONS
Completed · Overdue · Started 3d ago
✓
✓ Review submitted.
This review is complete. The case event has been recorded.
Back to inbox
```

- Status header: `Completed` ✅
- Success state on mount (no compose form, no radios) ✅
- Copy: `✓ Review submitted.` (null-decision fallback — correct for server reload where confirmedDecision state is unset) ✅

**Result:** ✅ PASS

---

### SMOKE (F3) — CaseHistoryPanel shows practitioner_decision event

**Procedure:** Expanded Case History section on completed workspace page after F3 fix deployed.

**Observed:**
```
CASE HISTORY  4 events  ▲

Intake answer        Question: primary_concerns          27 Apr 2026, 02:09
Lab upload           lab: Randox                         1 May 2026, 02:09
Practitioner note    note: Initial assessment complete…  9 May 2026, 02:09
Practitioner decision  Approved · Dr Sarah Chen          14 May 2026, 23:24
```

- Label: "Practitioner decision" ✅ (new EVENT_TYPE_LABELS entry)
- Payload summary: "Approved · Dr Sarah Chen" ✅ (decision + practitioner_display_name from 8-field payload)
- All 4 events visible after F3 fix ✅

**Result:** ✅ PASS

---

## Summary

| # | Check | Result |
|---|---|---|
| 1 | Page loads, h1 = "Natural Intelligence" | ✅ PASS |
| 2 | ActionPanel compose state | ✅ PASS |
| 3 | 3 decision radios | ✅ PASS |
| 4 | Escalate disabled + [B.4] marker | ✅ PASS |
| 5 | Submit enabled for approved/needs_revision | ✅ PASS |
| 6 | Compose → Confirm transition | ✅ PASS |
| 7 | Confirm state content correct | ✅ PASS |
| 8 | Edit returns to compose, decision preserved | ✅ PASS |
| 9 | Draft in localStorage before submit | ✅ PASS |
| 10 | Confirm & submit → Success (RPC + DB write confirmed) | ✅ PASS |
| 11 | Success copy matches decision | ✅ PASS |
| 12 | Draft cleared on success | ✅ PASS |
| 13 | Back to inbox → /cases; item in COMPLETED RECENTLY | ✅ PASS |
| 14 | Reload completed item → success state on mount | ✅ PASS |
| F3 | CaseHistoryPanel: 4 events + practitioner_decision label | ✅ PASS |

**14/14 PASS (+ 1 F3 finding discovered and fixed inline).**

**F3 closed.** Pattern now consistent across 3 RLS surfaces: case_practitioner_work (F1), practitioner_client_identity view (F2), case_events (F3) — all expose completed/escalated items to the assigned practitioner.

*B.3 complete. STOP before B.4.*
