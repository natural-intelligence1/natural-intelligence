# Phase B — Practitioner Operational UX: Design Proposal

**Status:** Proposal — awaiting approval before implementation  
**Date:** 2026-05-09  
**Author:** Design phase, V.8 closure  
**Scope:** apps/care operational surfaces; no schema changes; no new RLS beyond what G.1 delivered

---

## 1. Investigation Summary

### What exists today

**`/cases` page** (`apps/care/app/cases/page.tsx`)  
A server-rendered list of cases scoped by RLS: the `case_practitioner_select` policy returns only cases where the signed-in practitioner has an `assigned` or `in_review` work row. The page shows client name (initials avatar), primary concern, complexity score, escalation flag, and a link to the reasoning view. It sorts by `created_at` descending and caps at 50 rows.

Gap: This is a **case list**, not a **work list**. A practitioner may have multiple open work items on the same case (e.g., `case_review` + `safety_review`). The current page loses this structure — it would show the case once but the practitioner has two obligations. There is no urgency sorting, no due date visibility, no status differentiation (assigned vs. in-review vs. escalated), and no separation of completed work.

**`/cases/[caseId]/reasoning` page** (`apps/care/app/cases/[caseId]/reasoning/page.tsx`)  
A two-column workspace showing the Clinical Reasoning Trace. Left column: Case Snapshot (system counts) and Reasoning Timeline (all entries except `client_explanation`, colour-coded by type with confidence bars). Right sidebar: Hypothesis Board (extracted hypotheses with confidence) and a "Practitioner Actions" panel — six buttons (`Approve reasoning`, `Add comment`, `Request more data`, `Override hypothesis`, `Escalate`, `Approve protocol`) all rendered `disabled` with `opacity: 0.6` and a note "Practitioner actions are coming in Phase 2."

Reusable: the `EntryTypeBadge`, `ConfidenceBar`, `TimelineEntry`, `Section`, `SnapshotCard`, `StatPill`, and `ENTRY_TYPE_COLORS` / `AGENT_LABELS` constants are all reusable visual primitives. The data-fetching pattern (SSR, `getPractitionerTrace`, `createServerSupabaseClient`) is the right model.

Gap: No intake summary panel (derived from `intake_answers` / `intake_responses`). No longitudinal case events panel (`case_events` table). No BioHub signals panel. No previous practitioner work history. The action panel is entirely non-functional.

**Middleware** (`apps/care/middleware.ts`)  
Gates `/cases/*` routes. Checks auth, then queries `practitioners.status`. Redirects to appropriate holding pages for `pending_review`, `approved` (pending activation), `suspended`, `archived`. Only `active` practitioners pass through. This gate is complete and does not need modification.

**Layout and fonts** (`apps/care/app/layout.tsx`)  
DM Sans (`--font-dm-sans`) and Cormorant Garamond (`--font-display`) are already loaded. Same font stack as apps/web. The care app's globals.css and Tailwind config are separate from web — visual conventions can diverge if warranted.

**Practitioners package** (`packages/db/src/practitioners/`)  
Available helpers:
- `listAssignedWork(client, practitionerId, status?)` — returns `AssignedWork[]`, filterable by status
- `listAssignedCases(client, practitionerId)` — returns case rows for active work (no work-item metadata)
- `assignWork(client, input)` — admin-only; creates a work row
- `completeWorkItem(client, input)` — calls `complete_practitioner_work` RPC; takes `workId`, `decision`, `notes`, `recommendation`
- `getPractitioner(client, id)` — returns full practitioner row
- `createClientPractitionerLink`, `endClientPractitionerLink`, `listClientLinksForPractitioner`, `getClientTeam`

**CRT package** (`packages/db/src/crt/`)  
- `getPractitionerTrace(client, caseId)` — returns trace + all entries (all visibility levels)
- `getClientStory(client, memberId)` — returns client-facing story (Phase B doesn't use this directly)

**What is reusable vs. what needs replacing vs. what is missing**

| Element | Status |
|---|---|
| Middleware auth gate | ✅ Reusable as-is |
| Reasoning page visual primitives | ✅ Reusable — extract to shared components |
| `/cases` page data query | ❌ Replace — must query work items, not cases |
| Disabled action buttons | ❌ Replace — must become functional forms |
| Intake summary panel | ❌ Missing — needs query + component |
| Case events timeline | ❌ Missing — needs helper + component |
| BioHub signals panel | ❌ Missing — no helper exists; query direct |
| Previous work history panel | ❌ Missing — needs helper |
| Navigation / sidebar | ❌ Missing — current pages have no persistent chrome |
| Completion flow | ❌ Missing — no form, no server action |
| Escalation flow | ❌ Missing — subset of completion flow |
| Draft notes persistence | ❌ Missing — no state at all |

---

## 2. The Operational Loop

A practitioner's working session follows a six-stage loop. Understanding the loop as a narrative is necessary before designing surfaces — each surface must serve exactly the stage the practitioner is in, with minimum friction to advance to the next.

**Stage 1 — Arrive.** The practitioner signs in and lands on the Inbox. They see their obligations, sorted by urgency. Overdue items demand attention; new items are clearly distinguished from in-progress ones. The inbox answers one question: _what do I need to do today?_

**Stage 2 — Select.** The practitioner taps or clicks a work item. This begins a transition from "what needs doing" to "this specific case." The work item carries its type (`case_review`, `safety_review`, etc.) which shapes what they're expected to do in the workspace. State shifts from `assigned` to `in_review` at this moment — a write that happens immediately on opening the workspace.

**Stage 3 — Understand.** Inside the Case Review Workspace, the practitioner builds a picture. They read the client summary (intake-derived, no PII beyond name). They examine the AI reasoning trace. They check longitudinal context — what events has this case accumulated? They scan BioHub signals if labs exist. They look at previous practitioner work on this client. This stage is primarily reading. It may span multiple sessions. Draft notes accumulate here.

**Stage 4 — Form a view.** The practitioner has enough context. They know what they think. This is the moment the completion form comes into focus. They have drafted notes; now they select a decision and write a recommendation. The decision is constrained: `approved`, `needs_revision`, or `escalated`. Each path has a different next state.

**Stage 5 — Complete.** The practitioner submits. The `complete_practitioner_work` RPC fires: the work item is stamped `completed_at`, a `case_event` is written, the decision is recorded. The practitioner sees a confirmation and returns to the inbox. The completed item appears briefly in "Completed recently" before dropping out of view.

**Stage 6 — Handoff.** For `escalated` decisions, there is a brief additional moment: the practitioner records why they are escalating. This note is the handoff brief for whoever receives the case next (admin, specialist, lead practitioner). The escalation creates a `case_event` with escalation context; the inbox item moves to `Escalated` status; the case's `escalation_required` flag is set.

The loop then restarts at Stage 1. A practitioner working a full session will cycle through it several times, handling different work items at different stages.

**State handoffs between stages:**  
Stage 2→3: `status` write (`assigned` → `in_review`). Stage 4→5: RPC call, `case_event` created. Stage 5→6 (if escalated): escalation note recorded, flag set. All writes are server actions. The practitioner's in-progress drafting (Stage 3→4) is client-side state — not written to the DB until submission.

---

## 3. Surface 1 — Practitioner Inbox

### Purpose
The inbox is the practitioner's landing surface after sign-in. It is a **work item list**, not a case list. This distinction is fundamental: a single case may have two or more open work items, and each carries its own type, due date, and completion obligation.

### Layout

```
┌─── NI Care ─────────────────────────────────────────────────────────┐
│  ●  Inbox                          Sarah Wells  ·  active           │
│     4 items need review                                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  NEEDS REVIEW                                                  (3)  │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  ⚠  James Okafor             safety_review    Overdue 2d      │  │
│  │     Gut dysbiosis · complexity 4                              │  │
│  ├───────────────────────────────────────────────────────────────┤  │
│  │     Emma Clarke              case_review      Due tomorrow    │  │
│  │     Fatigue / hormonal · complexity 2                         │  │
│  ├───────────────────────────────────────────────────────────────┤  │
│  │     Priya Mehta              follow_up_review  Due in 3 days  │  │
│  │     Sleep disruption · complexity 1                           │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  IN PROGRESS                                                   (1)  │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  ◑  Maya Chen                case_review      Started 1h ago  │  │
│  │     Post-viral fatigue · complexity 3                         │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ESCALATED                                                     (1)  │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  ↑  Robert Kim               escalation_review  3 days ago    │  │
│  │     Complex autoimmune · awaiting admin assignment             │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  COMPLETED RECENTLY                                                 │
│     ✓  Ana Rodriguez            case_review      2 days ago        │
│     ✓  Tom Bell                 safety_review     4 days ago        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Sections and sorting logic

**Needs Review** — work items where `status = 'assigned'`. Sorted: overdue first (where `due_at < now()`), then by due date ascending, then by `assigned_at` ascending (oldest first). Each row shows: client name, work type, due date or overdue indicator, primary concern, complexity score.

**In Progress** — `status = 'in_review'`. Sorted by `started_at` descending (most recently opened first). These are cases the practitioner has entered but not yet submitted.

**Escalated** — `status = 'escalated'`. Read-only display. Sorted by completion descending. These are work items the practitioner escalated — they remain visible briefly as confirmation that the escalation was received, then recede.

**Completed Recently** — `status = 'completed'`, `completed_at > now() - 7 days`. Abbreviated rows (no due-date column, just name, type, completion date). Collapses or hides after 7 days.

### Urgency indicators

Three visual states:
- `⚠` Red tint on row, overdue label — when `due_at` is in the past
- Default — due date within the next 7 days shown as relative ("Due tomorrow", "Due in 3 days")
- No urgency indicator — when no `due_at` is set or deadline is > 7 days away

Work type labels are rendered as small, muted, monospace-adjacent type: `case_review`, `safety_review`, etc. They are not coloured or badged — the work type is informational, not an urgency signal.

### Empty states

- No assigned work: "You have no open work items. New cases will appear here when assigned." (No link — practitioner does not self-assign.)
- Inbox loads but RLS returns nothing: same message.
- Network error: "Couldn't load your inbox. Refresh to try again."

### Data fetched

A single query joining `case_practitioner_work` with `client_cases` (for `primary_concern`, `case_complexity_score`, `escalation_required`) and `profiles` via `client_id` (for `full_name`). Filter: `practitioner_id = current_user`. No admin client — authenticated SSR client uses RLS.

A new helper `listWorkForInbox` is required — see Section 7.

---

## 4. Surface 2 — Case Review Workspace

### Purpose
The workspace is where a practitioner builds their understanding of a case. It must hold a complete clinical picture without requiring the practitioner to navigate away. Every context panel exists within a single scrollable or tabbed view.

This is the surface that most directly determines practitioner time-to-decision. Every panel that requires a separate page load adds cognitive load and round-trip time. The design goal is to put everything on one surface, with a fixed action panel that is always in peripheral view.

### Layout — two-column

```
┌── [← Inbox]  Emma Clarke  ·  case_review  ·  Due tomorrow ────────┐
├───────────────────────────────────────┬────────────────────────────┤
│  MAIN CONTENT (scrollable)            │  ACTION PANEL (sticky)     │
│                                       │                            │
│  ── CLIENT SUMMARY ─────────────────  │  Notes                     │
│  Name · primary concern               │  ┌──────────────────────┐  │
│  Arrived: [emotion]                   │  │ (draft notes here)   │  │
│  Severity: 7/10 · Stress: 8/10        │  │                      │  │
│  Last felt well: 2 years ago          │  └──────────────────────┘  │
│  Key flags: [post-exertional ✓]       │  Saved locally             │
│                                       │                            │
│  ── REASONING TRACE ────────────────  │  ─────────────────────── │
│  [existing timeline component]        │  Decision                  │
│  [hypotheses in sidebar subset]       │  ○ Approved                │
│                                       │  ○ Needs revision          │
│  ── CASE EVENTS ────────────────────  │  ○ Escalate                │
│  [chronological log of inputs]        │                            │
│                                       │  Recommendation            │
│  ── BIOHUB SIGNALS ─────────────────  │  ┌──────────────────────┐  │
│  [lab results if present]             │  │                      │  │
│                                       │  └──────────────────────┘  │
│  ── PREVIOUS PRACTITIONER WORK ─────  │                            │
│  [prior decisions on this client]     │  [Submit decision]         │
│                                       │                            │
└───────────────────────────────────────┴────────────────────────────┘
```

### Panel specifications

**Client Summary**  
Derived from `intake_responses` and `intake_answers`. Shows: arrival emotion, primary concerns, severity impact (0-10), stress level (1-10), timeline (when symptoms started, last felt well, trigger if present), post-exertional worsening flag (highlighted if true), diet description, sleep quality, current medications/supplements. No intake answer text is shown verbatim — values are rendered as structured fields. This is a read-only summary, not a raw data dump.

Primary concern and name appear in the top header bar alongside the work type and due date — visible at all times regardless of scroll position.

**Reasoning Trace**  
The existing timeline component from the current reasoning page, reused directly. Hypothesis board moves from a right-side sidebar into the main column as a section above the timeline — the full timeline needs horizontal room. `client_explanation` entries are excluded (client-facing copy, not useful to practitioners).

Section nav anchor: "Reasoning"

**Case Events**  
A chronological log of `case_events` for this case. Rendered as a compact timeline: event type label, timestamp, and `event_payload` summary (one line). Types: `intake_answer`, `follow_up_answer`, `lab_upload`, `gp_record_upload`, `grocery_receipt`, `practitioner_note`, `protocol_update`. Shows what data has entered the case over time, giving longitudinal context the reasoning trace alone doesn't provide.

Empty state: "No additional events recorded for this case."  
Section nav anchor: "Case History"

**BioHub Signals**  
Queries the `biohub` tables (from sprint 9 / migration 0026) for any lab results associated with this client. If none: collapsed section with message "No lab data for this client." If present: each result row shows marker name, value, unit, date, reference range, and a simple in/out indicator. No interpretation — raw values only, practitioner applies clinical judgment.

This panel is gated: if the query returns zero rows, the section header renders as muted with a "None recorded" subline and no expand affordance.

Section nav anchor: "Lab Signals" (shown greyed out if empty)

**Previous Practitioner Work**  
Prior `case_practitioner_work` rows on this client's case, `status = 'completed'`. Shows: date completed, work type, decision, practitioner name (if different from current), notes summary (first 100 characters). Gives context on what was previously approved or escalated, and why.

This is different from the practitioner's current work item — it is historical audit context for clinical continuity.

Empty state: "No previous reviews on this case."  
Section nav anchor: "Prior Reviews"

**Action Panel (right sidebar, sticky)**  
Always visible regardless of which main-column section the practitioner is reading. Contains:
1. **Notes textarea** — free-text, character-uncapped, auto-saved to `localStorage` keyed by work item id. Label: "Notes · Saved locally" (muted, below textarea). Placeholder: "Clinical observations, questions, flags."
2. **Decision radio group** — three options: `Approved`, `Needs revision`, `Escalate`. No pre-selection (practitioner must actively choose). Selecting `Escalate` reveals the escalation reason field (see Surface 4).
3. **Recommendation textarea** — optional. Label: "Recommendation (optional)." Placeholder: "Guidance for protocol, follow-up, or next reviewer."
4. **Submit button** — `"Complete review"` (or `"Escalate case"` when escalation is selected). Disabled until a decision is selected. Single confirmation step inline (see Surface 3).

### Section navigation

A sticky left-edge nav rail (narrow, icon+label) anchors to the five main sections as the practitioner scrolls. On small viewports this collapses to a section dropdown at the top. The nav rail does not link to other cases — it is scoped to this workspace session. Back navigation is a breadcrumb in the top header bar: `← Inbox`.

### Work item status transition on open

When the workspace loads for a work item in `assigned` status, a server action fires immediately to transition it to `in_review` (update `started_at = now()`, `status = 'in_review'`). This is not a blocking operation — the workspace renders regardless; the status write is fire-and-forget. The inbox will reflect the updated status on next load.

No helper exists for this transition — a new `startWorkItem` helper is required (see Section 7).

---

## 5. Surface 3 — Completion Flow

### Purpose
The completion flow is the practitioner's act of closing a work item. It must be fast and low-friction. A practitioner who has done the cognitive work should not spend more than 10–15 seconds going from "I know what I think" to "submitted."

### Flow — inline, within the action panel

Completion does not navigate to a separate page. It happens within the right-side action panel of the Case Review Workspace.

**Step 1 — Compose.** The practitioner writes notes (optional but encouraged) and a recommendation (optional), selects a decision radio, and reads the Submit button.

**Step 2 — Confirm.** On clicking `"Complete review"`, the action panel transitions to a confirmation state — the form fields grey out, and a brief summary appears:

```
  ┌─ Confirm submission ───────────────────────────────┐
  │  Decision: Approved                                │
  │  Notes: 87 words                                   │
  │  Recommendation: recorded                          │
  │                                                    │
  │  [← Edit]               [Complete review →]        │
  └────────────────────────────────────────────────────┘
```

The confirmation step is retained (vs. a single-click submit) because:
- Decisions are consequential — they write a case_event and stamp the work item permanently.
- The three decisions have materially different downstream effects.
- A practitioner may have `needs_revision` partially written and accidentally click `Approved`.
- The confirm step adds ~3 seconds of delay — worth it at this consequence level.

**Step 3 — Submit.** The practitioner clicks `"Complete review →"`. A server action calls `completeWorkItem` (which calls the `complete_practitioner_work` RPC). The action panel transitions to a loading state (spinner, button disabled).

**Step 4 — Confirmation.** On success, the action panel renders:

```
  ┌─ Review complete ─────────────────────────────────┐
  │  ✓ Approved                                       │
  │  Case event recorded.                             │
  │                                                   │
  │  [← Back to inbox]                                │
  └───────────────────────────────────────────────────┘
```

The `localStorage` draft for this work item is cleared on success. The practitioner is not auto-redirected — they click "Back to inbox" explicitly. This gives them a moment to confirm the submission was received before leaving.

**Error handling.** If the RPC fails (network error, RLS violation, unexpected state), the action panel returns to the compose state with an error banner: "Something went wrong. Your notes are preserved — try again." The draft notes remain in `localStorage` and are not lost.

**Decision behaviours**

| Decision | RPC p_decision | Work status after | Next effect |
|---|---|---|---|
| `Approved` | `'approved'` | `completed` | Case event written; work item closed |
| `Needs revision` | `'needs_revision'` | `completed` | Case event written; signals AI re-generation may be needed |
| `Escalate` | `'escalated'` | `escalated` | Case event written; escalation note captured; `escalation_required = true` on case |

The `'needs_revision'` decision completes the work item. What happens to the case after a `needs_revision` decision (e.g., whether a new work item is auto-assigned, or whether admin is notified) is implementation-level detail for the RPC — not Phase B UI scope.

---

## 6. Surface 4 — Escalation Flow

### Purpose
Escalation is the practitioner's signal that this case exceeds their current scope or requires a different modality. It must be structured enough to give the next person context, but not so onerous that it creates friction around appropriate escalation.

### Design

Escalation is not a separate page. When the practitioner selects `"Escalate"` in the decision radio group, the action panel expands an escalation-specific section above the recommendation field:

```
  Decision:    ○ Approved  ○ Needs revision  ● Escalate

  Reason for escalation
  ┌────────────────────────────────────────────────────┐
  │ (required — select from list or write freely)      │
  │                                                    │
  └────────────────────────────────────────────────────┘

  Suggested next step (optional)
  ○ Assign to senior practitioner
  ○ Specialist referral needed
  ○ GP letter recommended
  ○ Urgent safety concern
  ○ Other (specify above)

  Recommendation
  ┌────────────────────────────────────────────────────┐
  │ (brief for next reviewer)                          │
  └────────────────────────────────────────────────────┘

  [← Edit]          [Escalate case →]
```

**Escalation reasons** are free-text (the `notes` field of the RPC). The four suggested next-step options are UI shortcuts that pre-fill the reason field — they are not a constrained enum in the DB. This is intentional: escalation reasons are diverse and constraining them prematurely creates form-filling overhead without clinical value.

The `Recommendation` field (already present in the completion flow) serves as the escalation brief — what the next reviewer needs to know immediately.

**Post-escalation state**  
The action panel confirms: "Case escalated." The inbox item moves to the `Escalated` section. The practitioner's work item remains visible in the inbox (Escalated section) for 7 days, then recedes. The `client_cases.escalation_required` flag is set — visible in the cases list and in the admin queue.

**Where the escalated work goes**  
The escalated work item has `status = 'escalated'`. It does not automatically create a new work item. Admin must review the escalation note and decide next assignment. This is the correct v1 behaviour — no automated matching logic, no new `escalated` work type auto-creation. The admin runbook covers this.

**What the practitioner sees after escalating**  
The action panel confirms with the same confirmation structure as completion. "Escalated. The case has been flagged for admin review." Single "← Back to inbox" button. No auto-redirect.

---

## 7. Data and Helpers Required

### Existing helpers Phase B consumes directly

| Helper | Used in | Note |
|---|---|---|
| `listAssignedWork(client, practitionerId, status?)` | Inbox | Pass multiple statuses: `['assigned','in_review','escalated','completed']` |
| `completeWorkItem(client, input)` | Completion / Escalation flow | Existing; needs authenticated client (not admin) |
| `getPractitionerTrace(client, caseId)` | Workspace — Reasoning panel | Existing; reused as-is |
| `getPractitioner(client, id)` | Layout header (practitioner name/status) | Existing |
| `listClientLinksForPractitioner(client, practitionerId)` | Not used directly in Phase B | N/A |

### New helpers required

**`listWorkForInbox(client, practitionerId)`**  
Returns work items joined with case and client data for inbox display. Needs: `case_practitioner_work.*`, `client_cases.primary_concern`, `client_cases.case_complexity_score`, `client_cases.escalation_required`, `profiles.full_name`. Single Supabase query with nested selects. Returns a typed `InboxWorkItem[]`.

**`startWorkItem(client, workId)`**  
Transitions a work item from `assigned` → `in_review`. Writes `started_at = now()`, `status = 'in_review'`. Called fire-and-forget when the workspace loads. Returns void. Uses authenticated client — practitioner must own the work item (RLS enforces this).

**`getWorkItemWithContext(client, workId)`**  
Returns a single work item row joined with case data (`primary_concern`, `case_complexity_score`, `escalation_required`, `status`) for workspace header rendering. Lightweight — not the full case, just what's needed to render the top bar and confirm the practitioner has access before loading the full workspace.

**`listCaseEvents(client, caseId)`**  
Returns `case_events` rows for a case, ordered by `created_at` ascending. Authenticated client — `case_events_practitioner_select` RLS policy enforces access. Renders as the Case History panel.

**`getPreviousPractitionerWork(client, caseId)`**  
Returns completed `case_practitioner_work` rows for a case, joined with `practitioners.display_name`, ordered by `completed_at` descending. Limit 10. Used for the Prior Reviews panel.

**`getIntakeSummary(client, memberId)`**  
Reads `intake_responses` (for top-level fields: `primary_concerns`, `primary_system`, `arrival_emotion`) and a curated subset of `intake_answers` for the Client Summary panel. Returns a structured `IntakeSummary` type. Uses admin client (intake data is not in practitioner RLS scope).

Note: `getIntakeSummary` requires an **admin client** because `intake_answers` and `intake_responses` are member-scoped tables — practitioners cannot read them via the standard authenticated client. This is an existing access pattern (analogous to how `generateBodyStory` uses `createAdminClient`). The workspace page is a server component; it can safely create an admin client on the server side.

**BioHub query (no helper wrapper for v1)**  
The biohub tables (`biohub_results` or equivalent from migration 0026) are queried directly in the workspace server component. If BioHub is not in practitioner RLS scope, an admin client is used. A typed inline query is sufficient for v1; a `getBioHubSignals(client, memberId)` helper can be extracted in B.2 if the query proves complex.

### New RLS policies required

None. The existing policies suffice:
- Practitioner reads `client_cases`: `case_practitioner_select` ✅
- Practitioner reads `reasoning_traces` / `reasoning_trace_entries`: `reasoning_traces_practitioner_select` / `reasoning_trace_entries_practitioner_select` ✅
- Practitioner reads `case_events`: `case_events_practitioner_select` ✅
- Practitioner reads/writes `case_practitioner_work`: existing `case_practitioner_work_practitioner_select` and service-role write (via RPC) ✅

The admin client is used for intake data and optionally BioHub — this is a server-side access pattern, not a new RLS policy.

---

## 8. State Management

### The problem
Phase B introduces meaningful transient state: draft notes, partially composed decisions, and the in-progress review session state. This state needs to survive accidental navigation (clicking "← Inbox" mid-review) and browser refreshes.

### Recommendation: localStorage, keyed by work item id

**Approach:** Draft notes and partially composed decisions are persisted to `localStorage` under the key `ni-care:draft:${workItemId}`. The workspace reads this on mount; the action panel writes on every keystroke (debounced 500ms). On successful submission, the draft is cleared.

**Why not in-memory (React state):**  
Lost on refresh and on navigation. A practitioner who reads five panels before composing their decision — 10–15 minutes of engagement — loses their draft if they accidentally hit back. Unacceptable.

**Why not server-side autosave (draft column):**  
Would require a new `draft_notes` column on `case_practitioner_work`, a new server action for autosave, and a debounced write queue. Adds schema complexity for v1. The failure mode (draft lost on device change or incognito mode) is the same edge case as localStorage on a different device. The upside — cross-device continuity — is not a real practitioner need in v1 (practitioners work on one device at a time). Defer to a later sprint if cross-device draft continuity becomes a requirement.

**Why not sessionStorage:**  
Lost on tab close, which is more likely than localStorage expiry. localStorage is correct here.

**Scope of what is stored:**
- `notes: string`
- `recommendation: string`
- `decision: 'approved' | 'needs_revision' | 'escalated' | null`
- `escalationReason: string`
- `lastSavedAt: ISO timestamp`

**Storage key collision:**  
Unlikely (work item ids are UUIDs) but the draft is scoped to work item id, not case id, to handle the case where a practitioner has two work items on the same case.

**localStorage availability:**  
The action panel is a client component. `localStorage` access is wrapped in a try/catch (private browsing restrictions). If unavailable, notes are held in React state only — practitioner is warned "Draft saving unavailable in this browser mode."

---

## 9. Real-time Considerations

### The question
Does the inbox need to update when admin assigns new work? Does the workspace need to update when reasoning traces are regenerated?

### Recommendation: manual refresh for v1

**Inbox:** A "Refresh" button in the inbox header (small, muted, top-right) plus a passive "Last updated: 2 min ago" timestamp. The practitioner clicks refresh when they expect new assignments. This is an internal tool used on desktop — the practitioner is not monitoring the inbox in real-time the way a consumer app user watches a feed.

**Workspace:** No real-time update needed. Reasoning traces are generated once on intake completion and may be regenerated by admin — but a practitioner mid-review should not have the content of the page silently change beneath them. If traces are regenerated, the workspace shows the most recent trace on next load. Stale-content risk is low.

**Why not Supabase Realtime channels:**  
Supabase Realtime is available in the stack. But adding client-side WebSocket subscriptions requires `use client` on a page that is currently fully server-rendered, plus connection lifecycle management, reconnect logic, and edge case handling (subscription lag, duplicate events). The marginal benefit in v1 — practitioners learning of new inbox items a few minutes sooner — does not justify the complexity.

**What triggers a natural refresh in practice:**  
- Practitioner completes a work item → redirects to inbox → inbox re-fetches (natural).
- Practitioner returns from workspace via "← Inbox" → inbox re-fetches (natural, because inbox is a server component with `force-dynamic`).

These two cases cover the vast majority of state changes a practitioner cares about. The manual refresh button covers the edge case of "was I just assigned something?"

Realtime inbox updates are deferred to a post-B sprint, gated on practitioner feedback about assignment lag being a genuine problem.

---

## 10. Information Architecture and Navigation

### Structure
```
/cases                          → Inbox (replaces current case list)
/cases/[caseId]/work/[workId]   → Case Review Workspace
/cases/[caseId]/work/[workId]/complete  → (not a separate page — inline)
```

The workspace route includes both `caseId` and `workId`. This is necessary because a practitioner may have two active work items on the same case (e.g., `case_review` and `safety_review`). The `caseId` provides the case context; the `workId` determines which work item is being completed. A URL that is only case-scoped cannot distinguish these.

### Persistent navigation

**Option rejected — left sidebar:** A persistent sidebar with inbox count, settings, and logout would add chrome to every page. The care app is focused — practitioners are here to do one thing. Persistent chrome is appropriate for multi-section dashboards; it is noise in a focused operational tool.

**Adopted — minimal top bar:**  
Every page in apps/care has a slim top bar (56px, matches the existing reasoning page nav):

- Left: contextual navigation — either `NI Care` (home / inbox link) or a breadcrumb trail: `NI Care → Inbox → Emma Clarke · case_review`
- Right: practitioner name + status indicator + sign-out link (collapsed to an avatar/initials on small screens)

The breadcrumb is the primary wayfinding. It is always correct — it reflects the actual navigation path. No sidebar required.

### Navigation flow

```
Sign in → Inbox → [tap work item] → Workspace
                                    ↓
                                    [complete] → Confirmation → Inbox
                                    [escalate] → Confirmation → Inbox
                                    [← Inbox]  → Inbox
```

There is no forward navigation beyond the workspace. The workspace is a terminal node. Practitioners do not navigate from workspace to workspace — they return to the inbox and select the next item.

### Breadcrumb construction

```
Inbox                      — on inbox page
← Inbox / Emma Clarke      — on workspace (client name + work type in subhead)
```

The full breadcrumb text: `← Inbox` (link) · separator · `Emma Clarke` (non-link) · `·` · `case_review` (muted, non-link).

---

## 11. Visual / Typographic Approach

### Current register
apps/care uses DM Sans as its primary typeface throughout. Cormorant Garamond is loaded (same as apps/web) but is not used in any current care page. The existing inline styles use a neutral, professional palette: `#1A1917` text, `#FAFAF9` background, `#8A8880` muted text, `#B8935A` accent (warm gold), `#E8E6E0` borders.

### Register for Phase B

The care app is a professional operational tool. Its register should differ from apps/web in one key dimension: **less editorial, more functional**.

apps/web uses Cormorant in italic for emotional moments ("Witness the signs within you") — these are designed to land on a client who may be anxious or uncertain. The practitioner has no equivalent emotional need from the UI. They are trained clinicians who want information quickly and accurately.

**Recommendation: DM Sans primary throughout apps/care. Cormorant Garamond reserved for one use only: the client's full name in the workspace header.**

The client name in the workspace header carries a specific weight — it is a reminder that behind the case data is a person. A single moment of Cormorant (regular, not italic, at ~24px) for the name creates a subtle register shift that practitioners will feel without being able to articulate. Everything else: DM Sans.

This approach:
- Maintains typographic consistency with the G.1 care app skeleton
- Preserves the brand family (both apps share the same type system)
- Does not introduce editorial moments into a clinical tool
- Creates one intentional moment of humanity in an otherwise data-dense surface

**Colour adjustments for Phase B:**  
The inbox urgency states require colour signals not present in the current palette:
- Overdue: `#FEF2F2` row background, `#DC2626` indicator — matches existing `escalation_required` treatment
- Due soon (≤ 24h): `#FFFBEB` row background, `#D97706` due-date text — amber register
- Completed / confirmed: `#F0FDF4` confirmation banner, `#15803D` check — matches existing `evidence_for` badge

All other colours are existing palette values. No new design tokens beyond these three urgency states.

**Density:** The inbox rows are denser than apps/web prose. 16px body text in apps/web vs. 14px in the inbox rows. The workspace panels use 15px for content, 11px for labels and metadata — matching the existing reasoning page conventions. This is correct for a data-dense professional tool.

---

## 12. Phasing

Phase B is too large for one sprint. Four sub-phases, each independently shippable and testable:

### B.1 — Inbox + plumbing (1 sprint)
**Delivers:** Working inbox page at `/cases` (replacing current case list). `listWorkForInbox` helper. `startWorkItem` helper. Top bar with breadcrumb. Middleware update to gate `/cases/[caseId]/work/[workId]` route.

**Gate:** A practitioner can sign in, see their assigned work sorted by urgency, and tap an item to enter the workspace (which loads the existing reasoning page for now).

**Does not include:** Completion flow, escalation flow, extended workspace panels.

**Why this first:** Inbox is the entry point. Nothing else is usable without it. Plumbing (route structure, `startWorkItem`, breadcrumb) established here is used by every subsequent sub-phase.

### B.2 — Case Review Workspace (1–2 sprints)
**Delivers:** Full workspace at `/cases/[caseId]/work/[workId]`. Client Summary panel (`getIntakeSummary` helper). Reasoning Trace panel (reused from existing page). Case History panel (`listCaseEvents` helper). BioHub Signals panel (inline query). Prior Reviews panel (`getPreviousPractitionerWork` helper). Action panel rendered — notes textarea with localStorage autosave, decision radio, submit button (disabled, not yet wired to RPC).

**Gate:** A practitioner can open a work item and read the full clinical picture across all five panels. Notes are drafted and survive refresh. Decision form is visible but submission is not yet wired.

**Does not include:** Completion RPC call. Escalation flow. Status transition on submit.

**Why before completion:** Practitioners should be able to review cases before submission is enabled. Allows QA of the clinical context panels independently.

### B.3 — Completion Flow + writes (1 sprint)
**Delivers:** Submit button wired to `completeWorkItem` server action. Confirmation step. Post-submission state. localStorage draft clearing. `approved` and `needs_revision` decision paths tested end-to-end. Work item status transitions validated. Case events written and visible in admin.

**Gate:** A practitioner can complete a review (approved or needs_revision), see the confirmation, return to inbox, and the work item appears in "Completed Recently." The case event is visible in the DB.

**Does not include:** Escalation path (separate sub-phase due to additional complexity).

### B.4 — Escalation Flow + admin handoff (1 sprint)
**Delivers:** `Escalate` decision path in the completion flow. Escalation reason field. Escalated work item in inbox (Escalated section). `client_cases.escalation_required` flag confirmed set. Admin visibility of escalated cases (admin app, out of care app scope — but the data must be queryable). Inbox "Escalated" section rendered.

**Gate:** A practitioner can escalate a case with a reason, see it confirmed in the Escalated section of their inbox, and admin can see the escalated case flag.

**After B.4:** Phase B is complete. Phase D (protocol layer) and other deferred features can proceed.

---

## 13. Out of Scope for Phase B

The following are explicitly out of scope and should not be built, designed, or mentioned in B.1–B.4 implementation briefs:

- **Protocol layer** — what the practitioner recommends to the client in terms of supplements, lifestyle, etc. (Phase D)
- **Practitioner-client messaging** — deferred per W7 decision; no in-app messaging
- **Client-facing practitioner directory** — separate sprint; not part of the operational loop
- **CareTeam Builder orchestration** — multi-practitioner coordination, specialist routing; deferred
- **Mobile-responsive optimisation** — the care app is a desktop-primary tool; responsive polish deferred to a dedicated sprint
- **Practitioner self-assignment** — work items are assigned by admin; practitioners do not pick their own cases in v1
- **Work item cancellation or decline UI** — these statuses exist in the DB but are admin operations; no practitioner-facing flow in Phase B
- **Automated complexity escalation** — `auto_complexity_threshold` assignment source exists; no UI needed in Phase B
- **Specialist consult flow** — `specialist_consult` work type exists; the completion flow handles it via the standard `approved`/`escalated` path in Phase B; dedicated specialist flow deferred
- **Notification / push alerts** — no email or push notification when new work is assigned; refresh-to-check in v1
- **Audit log viewer** — practitioners do not view their own audit trail in Phase B
- **Admin case management surfaces** — admin app (apps/admin) is separate; Phase B is care app only
- **PDF or print views of reasoning traces** — deferred

---

## 14. Open Questions for Discussion

These require strategic input before or during implementation. Phase B cannot fully close without answers to at least questions 1–3.

**Q1: Workspace URL structure — work item vs. case scoping**  
Proposed: `/cases/[caseId]/work/[workId]`. Alternative: `/work/[workId]` (flat, without caseId in URL). The flat structure is simpler but loses the caseId from the URL, making it harder to reconstruct context from a link. The nested structure exposes both IDs, enabling direct deep-links. Decision required before B.1 route setup.

**Q2: Multiple work items on the same case — what does the workspace show?**  
If a practitioner has a `case_review` and a `safety_review` open on the same case, the workspace at `/cases/[caseId]/work/[workId]` shows the work-item-specific action panel (which decision type? which notes draft?), but the case content panels (reasoning trace, events, BioHub) are identical. The case summary at the top should display the work type of the current work item. The action panel is scoped to the `workId`. This is the correct design — confirm before B.2 implementation.

**Q3: How verbose are practitioner notes expected to be?**  
This shapes the notes textarea height, character count display, and whether notes warrant a full-width panel vs. the sidebar placement. If notes are expected to be 1–3 sentences (quick flags), sidebar placement is fine. If they are 200–500 word clinical summaries, the textarea needs to be full-width and prominently positioned. Current design assumes a middle path: sidebar textarea, expandable on focus, no hard character limit. Confirm with practitioners before B.2.

**Q4: Does "Needs revision" generate any follow-up?**  
The `needs_revision` decision closes the current work item. It implies the AI reasoning should be regenerated or that admin should review. But no automated action follows in the current schema — it is purely a recorded decision. If `needs_revision` should trigger admin notification or a new work item, that logic belongs in the `complete_practitioner_work` RPC and must be specified before B.3.

**Q5: What is the practitioner's `display_name` source for the top-bar header?**  
`getPractitioner` returns the full practitioners row including `display_name`. The workspace should show the signed-in practitioner's name in the top bar. Confirm this is the correct field and that all active practitioners have it populated before B.1.

**Q6: BioHub RLS access for practitioners**  
The BioHub tables (migration 0026) may or may not have a practitioner-facing RLS policy. If they do not, the workspace must use an admin client for BioHub queries — which is acceptable (server component) but must be confirmed before B.2 builds the signals panel. If BioHub is not in practitioner RLS scope and an admin client is inappropriate in this context, the BioHub panel is removed from B.2 scope.

---

*End of Phase B Design Proposal.*  
*Awaiting approval before any implementation work begins.*

---

## Phase B Addendum — Review Resolutions

**Date:** 2026-05-09  
**Status:** Closes all open questions from Section 14; clarifies ambiguities in Sections 3–8, 12. The original proposal above is unchanged.

---

### Part 1 — Open Question Resolutions (Q1–Q6)

---

**Q1: Workspace URL structure — DECIDED**

`/cases/[caseId]/work/[workId]` is confirmed.

Rationale: the nested structure preserves `caseId` in the URL so that the workspace layout can read case context from params without a DB round-trip (used for breadcrumb, top-bar header, and RLS scope). It also enables clean deep-links — a URL pasted into a browser slot reconstructs the full context without ambiguity. The flat `/work/[workId]` alternative would require resolving `caseId` from the work item on every render, adding a query before the page can render.

Next.js layout nesting: the `cases/[caseId]/` segment will carry a layout that owns the breadcrumb and top-bar chrome; the `work/[workId]` segment renders the workspace content. B.1 sets up the route structure and layout shell even though the workspace content is not fully built until B.2.

---

**Q2: Multiple work items on the same case — DECIDED**

Confirmed design: when a practitioner has two open work items on the same case (e.g., `case_review` and `safety_review`), each has its own workspace URL, its own `localStorage` draft key (`ni-care:draft:${workItemId}`), and its own action panel state. The case content panels (Reasoning Trace, Case History, BioHub Signals, Prior Reviews) render identically for both — they are scoped to `caseId` and the case has not changed. The top-bar header displays the `work_type` of the current work item, not a generic "Case Review" label, so the practitioner knows which obligation they are addressing. No disambiguation UI is needed — the URL is the discriminator.

---

**Q3: Note verbosity — PROVISIONAL (v1 default confirmed)**

Sidebar textarea placement confirmed for B.2. Behaviour:
- Min-height 80px; grows vertically on focus up to 320px (CSS `resize: vertical`)
- No hard character limit
- Soft character count shown below the field once text exceeds 200 characters — orientation marker only, not a limit

Full-width notes are deferred to practitioner feedback after B.2 ships. If practitioners consistently write clinical summaries > 300 words, a layout variant with full-width notes (and the decision/recommendation fields stacked below) is the upgrade path.

---

**Q4: `needs_revision` — DECIDED**

`needs_revision` is a recorded decision only. The `complete_practitioner_work` RPC writes the decision and the case event. No automated action follows in Phase B: no admin notification, no AI re-generation trigger, no new work item created. The RPC is not modified for Phase B.

Any downstream automation triggered by `needs_revision` (e.g., queuing a new AI reasoning pass, notifying admin, auto-assigning a follow-up review) must be specced in a separate proposal. It belongs in Phase D or a dedicated process-automation sprint, not Phase B.

---

**Q5: `display_name` field — VERIFIED**

Query run against live DB (`yftxzvdrxnhwpcnsrktn`):

```sql
SELECT id, display_name, status
FROM practitioners
WHERE status = 'active' AND display_name IS NULL
```

**Result: 0 rows.** All active practitioners have `display_name` populated.

`practitioners.display_name` is the canonical source for the practitioner name in the care app top-bar header. No fallback to `profiles.full_name` required. `getPractitioner(client, id)` returns the full row including `display_name` and is the correct helper for layout-level practitioner identity.

---

**Q6: Intake and BioHub access pattern — DECIDED (Option B)**

**Investigation findings:**

`intake_answers` RLS policies (3 policies):
- `Members manage own intake answers` — `authenticated`, ALL, `member_id = auth.uid()`
- `Admins read all intake answers` — `authenticated`, SELECT, `profiles.role = 'admin'`
- `Service role manages intake answers` — `service_role`, ALL, `true`

`intake_responses` RLS policies (2 policies):
- `Members manage own intake` — `authenticated`, ALL, `member_id = auth.uid()`
- `Admins read all intake` — `authenticated`, SELECT, `profiles.role = 'admin'`
- *(No service_role policy — noted)*

BioHub-adjacent tables:
- `biomarker_results` — member SELECT (`member_id = auth.uid()`), member INSERT only. No admin policy, no service_role policy.
- `biomarker_trajectory` — member ALL + admin SELECT (`profiles.role = 'admin'`). No service_role policy.
- `lab_reports` — member SELECT/INSERT/UPDATE + admin ALL. No service_role policy.

**Key finding:** None of these tables have a practitioner-scoped policy. Practitioners are `authenticated` users but have `profiles.role != 'admin'`, so they pass neither the member condition (`member_id = auth.uid()` — they are not the client) nor the admin condition (`profiles.role = 'admin'`). A practitioner using a standard authenticated client has **zero RLS access** to intake data and biohub tables.

**Decision: Option B — admin client in server component.**

The workspace is a server component. The care app already has a `createAdminClient` pattern (established in G.1). Using it here is:

1. **Safe** — the admin client never reaches the browser. It is created inside a server action or server component, executes the query, and the result (a subset of fields, structured) is serialised to the client.
2. **Application-layer scoped** — every query in `getIntakeSummary` and the BioHub inline query is bound to the specific `memberId` / `clientId` derived from the authenticated practitioner's work item. The practitioner's authenticated session confirms they have a valid work item for that case before the admin client is used. The admin client is a read-only access path, not a write path.
3. **Consistent with existing patterns** — `generateBodyStory` and other CRT paths use admin client for exactly this reason.
4. **Migration-free** — Option A (adding practitioner-scoped policies to intake and biohub tables) would require writing cross-table join policies across 5+ tables, a new migration, and a verification sweep. That is not Phase B scope.

**Option A deferred.** Practitioner-scoped RLS on intake and biohub tables is the correct long-term security posture (G.1 principle: RLS as truth layer). It should be implemented as a dedicated migration in a post-Phase-B sprint, with explicit policy names, tested against the live DB, and verified via RLS unit tests. The deferred Option A migration should cover: `intake_responses`, `intake_answers`, `biomarker_results`, `biomarker_trajectory`, `lab_reports` — each with a `practitioners_read_assigned_client` policy using a sub-select on `client_practitioner_links`.

**Consequence for B.2 build:** `getIntakeSummary` and the BioHub inline query both use `createAdminClient()`. This must be documented in their JSDoc comments: `// Uses admin client — intake/biohub tables have no practitioner RLS policy (see Phase B Addendum Q6).`

---

### Part 2 — Section Clarifications

---

**S3 — Inbox**

**Completed Recently cap:** Capped at 5 rows, not unlimited within 7 days. When a 6th completion occurs within the rolling 7-day window, the oldest drops out. This prevents the section from growing disproportionately during high-throughput sessions and keeps the inbox scroll length predictable. The `listWorkForInbox` query applies `LIMIT 5` to the completed bucket specifically.

**Escalated section semantics:** The "Escalated" section shows work items **escalated by this practitioner** — not work items of type `escalation_review` assigned to this practitioner. These are the practitioner's own escalated submissions. The section exists to confirm to the practitioner that their escalation was received and is visible to admin. It is read-only, non-actionable, and sorted by `completed_at` descending. Escalation reviews assigned to this practitioner appear in **Needs Review**, not Escalated.

**Empty state copy (correction):** The original proposal reads "You have no open work items. New cases will appear here when assigned." Revised copy: "No assigned work. New cases will appear here when your next review is assigned." This removes the word "cases" (the inbox is a work list, not a case list) and removes the implied self-assignment invitation.

---

**S4 — Case Review Workspace**

**Default panel collapse state:** On workspace load, two panels render expanded and three render collapsed:

| Panel | Default state |
|---|---|
| Client Summary | Expanded |
| Reasoning Trace | Expanded |
| Case History | Collapsed — shows row count: "Case History · 4 events" |
| BioHub Signals | Collapsed — shows "No lab data" or row count if present |
| Prior Reviews | Collapsed — shows "Prior Reviews · 2 reviews" or "No prior reviews" |

Practitioners consistently need Summary + Reasoning on first open; the other panels are supporting context consulted selectively. Collapsed headers provide orientation without requiring scroll.

**Hypothesis Board layout change:** The Hypothesis Board was in the right sidebar in the existing `/cases/[caseId]/reasoning` page. In the workspace, it moves into the main content column as a section rendered *above* the timeline (as noted in Section 4 of the original proposal). The right column is exclusively the action panel — no secondary sidebar. B.2 must account for this layout difference when reusing the Hypothesis Board component.

**`in_review` status and re-open guard:** Once a work item has been transitioned to `in_review`, `startWorkItem` must not be called again on re-open. Guard: at workspace load, check the work item's current `status`. Call `startWorkItem` only if `status === 'assigned'`. If already `in_review`, `completed`, or `escalated`, skip the transition call entirely.

**Disabled Submit button treatment:** The Submit button is always rendered — it does not appear and disappear. When no decision is selected: `opacity: 0.5`, `cursor: not-allowed`, tooltip on hover: "Select a decision to continue." This pattern is consistent with standard form UX: practitioners see where the workflow ends before they begin, which reduces the cognitive cost of understanding the surface.

**Work item metadata in action panel:** A metadata line is rendered directly below the action panel header (above the Notes textarea):

```
Status: In review  ·  Due tomorrow  ·  Started 3h ago
```

Font: 11px, muted (`#8A8880`). Fields: `status` (humanised: "In review", "Assigned"), `due_at` (relative if within 7 days, absolute otherwise, omitted if null), `started_at` (relative, omitted if `assigned`). This gives the practitioner clock awareness without requiring a trip back to the inbox.

---

**S5 — Completion Flow**

**Session expiry during completion:** If the practitioner's session expires between workspace open and submission click, the server action returns a 401. The client catches this (in the server action's response handling) and redirects to:

```
/auth/sign-in?next=/cases/[caseId]/work/[workId]
```

Post-login, the `next` parameter returns them to the workspace URL. Their `localStorage` draft is preserved (session expiry does not touch `localStorage`). The confirmation step is repeated — the practitioner must re-click Submit after returning.

**Decision-specific confirmation copy:** The confirmation panel in Step 2 shows decision-specific language:

| Decision | Confirmation copy |
|---|---|
| `Approved` | "Decision: Approved · Case event will be recorded." |
| `Needs revision` | "Decision: Needs revision · Case event will be recorded. No automated action follows." |
| `Escalate` | "Decision: Escalate · Case flagged for admin review. Escalation note recorded." |

The `needs_revision` copy explicitly states "No automated action follows" — this sets practitioner expectations and prevents misuse of the decision as an implicit work-queue trigger.

---

**S6 — Escalation Flow**

**Shortcut interaction model:** The four "Suggested next step" options (Senior practitioner, Specialist referral, GP letter, Urgent safety concern) use **prefix-append**, not replace. Clicking a shortcut prepends `[Shortcut label] ` to the beginning of whatever is in the escalation reason textarea:

- If the field is empty: `[Urgent safety concern] ` is inserted and cursor positioned after it.
- If the field has text: `[Urgent safety concern] ` is prepended, existing text follows.

This allows practitioners to combine label + free text: `[Urgent safety concern] patient disclosed suicidal ideation on follow-up call`. Clicking two shortcuts accumulates both: `[Urgent safety concern] [Specialist referral needed] ...`. Practitioners can delete unwanted prefix labels manually.

Rationale: escalation reasons are rarely single-label. The shortcut is a starting point, not a terminal choice. Replace semantics would erase context the practitioner has already written.

---

**S8 — State Management**

**Multi-tab last-write-wins:** If the practitioner opens the same work item in two browser tabs, both tabs share the same `localStorage` key (`ni-care:draft:${workItemId}`). Writes from each tab overwrite the other. This is accepted for v1.

Detection and warning: on workspace mount, read the existing `lastSavedAt` from `localStorage`. Store this value as `mountTimeSavedAt`. On each focus event on the notes textarea, re-read `localStorage.lastSavedAt`. If the value is > 2 seconds newer than the current tab's last write timestamp (i.e., another tab has written since this tab last wrote), show a non-blocking amber banner: "This case is open in another tab — edits may conflict." The banner dismisses on next keystroke from the current tab.

**Degraded draft mode:** When `localStorage` is unavailable (private browsing, restrictive security policy), the action panel shows a persistent amber banner above the notes textarea: "Draft saving unavailable. Notes will be lost if you navigate away." The practitioner can still compose and submit — draft state is held in React state only. The `localStorage` access attempt is wrapped in a `try/catch`; if it throws, the component falls back to React state and sets `draftMode: 'degraded'`.

---

**S12 — B.1 Transition / Component Extraction**

The existing `/cases/[caseId]/reasoning/page.tsx` contains the following reusable visual primitives inline:
- `EntryTypeBadge`, `ConfidenceBar`, `TimelineEntry`, `Section`, `SnapshotCard`, `StatPill`
- `ENTRY_TYPE_COLORS`, `AGENT_LABELS` constants

Before B.2 builds the Reasoning Trace panel in the workspace, these must be extracted to `apps/care/components/reasoning/`. The reasoning page becomes a thin consumer of the extracted components. The workspace also consumes them.

This extraction is a **B.1 task**, even though it doesn't ship user-visible changes in B.1. Rationale: if it is deferred to B.2, B.2 has two concurrent concerns (build the workspace *and* refactor the reasoning page), which creates merge conflict risk and makes B.2 scope harder to estimate. Extract in B.1, where the only other file work is helpers and the inbox route — no risk of collision.

Extraction target: `apps/care/components/reasoning/index.ts` (barrel export). The existing reasoning page imports from the barrel.

---

### Part 3 — Pre-Implementation Verification

The following checks must pass before B.1 implementation begins. They are recorded here as acceptance criteria, not run during the design phase.

**Typecheck:**
```bash
pnpm typecheck
```
Expected: zero new errors across all packages. The design phase introduced no code changes — this is a baseline confirmation that the repo is clean before B.1 adds new files.

**Lint:**
```bash
pnpm lint --filter=care --filter=admin
```
Expected: zero new warnings or errors.

Both checks are to be run and recorded in the B.1 sprint opening commit message. If either fails, the failure must be resolved before B.1 implementation files are created.

---

*End of Phase B Addendum.*  
*B.1 implementation may begin after explicit approval of both the original proposal and this addendum.*
