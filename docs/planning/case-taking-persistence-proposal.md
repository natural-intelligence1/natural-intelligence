# Case-taking persistence — audit and proposal

**Status: PROPOSAL. Nothing in here is implemented and no migration has been written.**
Raised 5 Nov 2026 under the Founder's mid-sprint architecture correction, which
required the existing persistence architecture to be inspected and reused before
any Cockpit draft store was built, and a design proposed rather than invented if
none fitted.

---

## 1. What already exists — the audit

Read-only inspection of the live database (62 public tables, all RLS-enabled)
and of every server action in `apps/care` and `apps/web`.

### Client intake — COMPLETE. Reuse it; no schema change.

The production autosave the correction describes — edit → debounce →
authenticated server write → RLS → acknowledgement → subtle "Saved" — is
already built for client intake:

| Piece | Where |
|---|---|
| Session + position | `intake_sessions` — `status`, `current_section`, `visible_question_ids`, `answered_question_ids`, `completion_percentage` |
| Per-answer draft | `intake_answers` — one row per `(session_id, question_id)`, `answer jsonb`, `answered_at`, `updated_at` |
| Authenticated write | `saveV2Answer()` — upsert (`intakeV2/flow.ts`) |
| Rehydrate on return | `loadV2Answers()` |
| Session lifecycle | `getOrCreateV2Session()`, `completeV2Session()` |
| Debounce / ordering / retry | `createV2AutosaveQueue()` — shipped and unit-tested |
| V1 equivalent, already wired | `useIntakeAnswers.ts` → `saveIntakeAnswer()`, with hydrate-on-mount |

**Exact resume needs no new column.** `intake_sessions.current_section` is a
text column already namespaced by version — `getOrCreateV2Session` writes
`'v2:arrival'` and finds the V2 session with `like 'v2%'`. A screen-level
bookmark fits the same convention as `'v2:<sectionId>:<screen>'` and still
matches that predicate.

Better still, the resume point is *derivable* from `intake_answers` — the first
screen holding an unanswered question — which is more robust than a stored
bookmark, because it stays correct when a branch opens or closes under the
client. A stored bookmark can point at a screen that no longer exists; a
derived one cannot.

### Practitioner case-taking — NOT COVERED. Six needs, four gaps.

| Need | Existing candidate | Verdict |
|---|---|---|
| Consultation answers | `intake_answers` | **Gap.** It belongs to a *client* intake session keyed on `member_id`. A practitioner-taken case is not a client self-serve session, and bending one into the other would conflate who authored what — the exact thing provenance exists to prevent. |
| Practitioner amendments | `case_contributions` (live since 0057) | **Partial.** Correct shape for the purpose: `case_id`, `author_id`, `team_role`, `profession`, `kind`, `content`, `source`, `client_confirmed`, `supervisor_verified_by/at`. Append-only, so it cannot be a mutable draft. 0 rows; `careRecord/contract.ts` records "no UI writes to it yet". |
| Observations | `case_contributions.kind` | **Partial.** Same table, same limitation. |
| Question state | — | **Gap.** |
| Section progress | — | **Gap.** |
| Current consultation position | — | **Gap.** |

Also inspected and rejected as draft stores, with reasons:

- `case_analysis_plan` — `(case_id, section, content, author_id)`, append-only free text. No per-question key and no update path.
- `case_events` — append-only event log with a jsonb payload. Right for lifecycle *transitions*, wrong for a mutable working value.
- `case_practitioner_work` — the work **item** lifecycle (`status`, `started_at`, `completed_at`, `escalated_at`, `declined_at`, `notes`). This is where a consultation's assignment status belongs, and a case-taking session should hang off it. It holds no answers.
- `reasoning_traces` / `reasoning_trace_entries` — AI reasoning output, visibility-scoped. Not practitioner capture.

### Encrypted / offline draft architecture — none exists

The correction asked for this to be reported if found. It does not exist. The
only matches for `encrypt` / `offline` / `IndexedDB` across `apps/` and
`packages/` are prose in `apps/web/app/legal/privacy/page.tsx`. There is no
approved offline or client-side-encrypted draft mechanism to reuse.

### Consequence, applied immediately

The browser-local Cockpit draft store that had been started was **deleted
unwired** (`apps/care/components/cockpit/cockpitDraft.ts`). Capture stays in
page state, and the chrome now reads **"Held in this session only"** — which is
true, and which is not a placeholder for "saving". Had it shipped, a preview
convenience would have become the production persistence mechanism for
practitioner-captured health content by default.

---

## 2. Proposal — two tables, maximum reuse

Smallest design that meets the six needs. Deliberately reuses the access
function, the provenance vocabulary, the append-only audit table and the
eligibility spine rather than restating any of them.

### 2.1 `case_taking_sessions` — lifecycle and position

One row per `(case_id, practitioner_id, revision)`.

| Column | Type | Note |
|---|---|---|
| `id` | uuid pk | |
| `case_id` | uuid not null → `client_cases` | RLS anchor |
| `practitioner_id` | uuid not null → `practitioners` | who is taking the case |
| `work_id` | uuid null → `case_practitioner_work` | the assignment this fulfils, where there is one |
| `revision` | int not null default 1 | an amendment after sign-off increments it |
| `state` | text not null | CHECK in `in_progress`, `submitted_to_lead`, `lead_review`, `ready_for_sign_off`, `signed_off` |
| `current_position` | text null | the resume bookmark, e.g. `digestion:2` |
| `submitted_by` / `submitted_at` | uuid / timestamptz | hand-over to the Lead |
| `signed_off_by` / `signed_off_at` | uuid / timestamptz | set once, on sign-off |
| `created_at` / `updated_at` | timestamptz not null | |

`UNIQUE (case_id, practitioner_id, revision)`.

The state machine, its transitions, its refusal codes and its authority rules
are **already built and tested** in `packages/db/src/cockpit/caseTaking.ts`
(44 tests). This table persists what that module already decides; it adds no
new vocabulary. `state` mirrors `CASE_TAKING_STATES` exactly.

### 2.2 `case_taking_answers` — the autosave target

One row per `(session_id, question_id)`. **Mutable by upsert** — this is
explicitly the working draft, and saying so is what makes mutability correct
here rather than a loss of audit.

| Column | Type | Note |
|---|---|---|
| `id` | uuid pk | |
| `session_id` | uuid not null → `case_taking_sessions` | |
| `case_id` | uuid not null → `client_cases` | denormalised so RLS needs no join |
| `question_id` | text not null | the registry id, e.g. `v2.digestion.stool_form` |
| `section_id` | text not null | section progress is then a count, not a column |
| `value` | jsonb not null | |
| `provenance` | text not null | CHECK against the existing `V2_PROVENANCE_STATES` |
| `actor_id` | uuid not null | attribution is not optional |
| `actor_case_role` | text not null | CHECK in `lead`, `care_team`, `student` — `case_team_roles.team_role`, never a link role |
| `updated_at` | timestamptz not null | |

`UNIQUE (session_id, question_id)`.

**Why mutable here and append-only elsewhere.** Autosave fires roughly once per
900 ms of typing per question. Appending a row each time would turn one
sentence into dozens of rows and make the audit trail harder to read, not
easier. So the draft is one row that moves, and the **audit chain goes to
`case_contributions`**, append-only, on the discrete acts that actually matter:
Verify, Amend, Add observation, Mark unconfirmed, Not asked, Declined. Those
are deliberate provenance decisions, not keystrokes. That is also precisely
what `case_contributions` was built for — `careRecord/contract.ts` states the
invariant: *"A practitioner addition NEVER overwrites what the client said."*

Section progress and question state are then derived, not stored: progress is
`count(*) group by section_id`, and question state is the row's `provenance`.
Two fewer columns to keep in step with the truth.

### 2.3 RLS — reuse, do not restate

Both tables, every command, scoped by:

```sql
using (public.can_access_care_profile_for_case(case_id))
```

— that is, the same `can_access_case_care_profile(case_id)` that 0064 made
role-aware and that 0065 pointed `case_events` at. No new access logic, no
second opinion about who may see a case, and anything that tightens that
function tightens these tables with it.

### 2.4 Two triggers, because the UI is not an authority

The UI already refuses these. The UI is not where authority belongs.

1. **Frozen after sign-off.** `BEFORE INSERT OR UPDATE` on
   `case_taking_answers`: raise `check_violation` when the parent session's
   state is `signed_off`. A signed version cannot be edited even by a caller
   that bypasses the interface.

2. **Only the Lead signs off.** `BEFORE UPDATE` on `case_taking_sessions`: when
   `state` becomes `signed_off`, require that `signed_off_by` equals the acting
   practitioner **and** that `practitioner_eligibility(signed_off_by, 'lead')`
   returns eligible. This reuses the 0064 spine rather than asking the question
   again, so a practitioner who loses Lead eligibility cannot sign off through
   any path.

Note the deliberate separation: this is the **case-taking record**, not a
Protocol. Protocol signing keeps its own canonical guard in
`intakeV2/protocolSigning.ts`. Conflating them would mean either that taking a
case commits you to a plan, or that a plan can be signed by whoever wrote the
notes.

### 2.5 What this does NOT include

- No change to `intake_answers`, `intake_sessions`, `case_contributions`, `case_events` or `case_practitioner_work`.
- No change to the Question Graph, the field registry, canonical field semantics, Annex 1, or any approved wording.
- No canonical-record write. These tables hold case-taking; resolving an answer onto a canonical field still waits on an approved Question → Concept(+variant) → Field mapping. **This proposal does not unblock that and must not be read as doing so.**

---

## 3. Sequencing

1. Founder review of this proposal.
2. On approval, one migration (`0066`) creating the two tables, their RLS and their two triggers, built and tested against PGlite as 0064/0065 were, and **not applied** until a separate release decision.
3. Wire the Cockpit to it: the autosave queue already exists and the state machine already exists, so the UI change is swapping `useState` for the session plus a server action.
4. Only then does the Cockpit indicator become "Saved" — earned, because by then it will be true.

Until step 2 is approved, the Cockpit continues to say *Held in this session
only*, and no practitioner-captured health content is written anywhere.
