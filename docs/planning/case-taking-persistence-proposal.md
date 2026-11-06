# Case-taking persistence — audit and proposal

**Status: PROPOSAL. Nothing here is implemented. No migration has been written.**

Raised 5 Nov 2026 under the Founder's mid-sprint architecture correction.
Expanded 6 Nov 2026 to the 20-point specification the Founder requested, after a
second read-only audit of the live database. The expansion **changed the design**
in three places, because the audit found existing architecture the first draft
had not mirrored:

1. Versioning now follows `member_protocols` exactly — `version` + `supersedes`
   + `signed_at`/`signed_by`, not a `revision` integer. The Protocol model
   already defines NI's "signed version is immutable, amendment supersedes it"
   semantics, and the direction was to align with it, not restate it.
2. The RLS anchor is named **`can_access_case_care_profile(p_case_id)`**. The
   first draft called it `can_access_care_profile_for_case(case_id)`, which is
   not a function that exists.
3. History attaches to `case_contributions` by **extending** that table with a
   question key, rather than relying on a join the table cannot support.

---

## 1. Audit — what already exists

Read-only inspection of the live database (`yftxzvdrxnhwpcnsrktn`) and of every
server action in `apps/care` and `apps/web`.

### 1.1 Client intake — COMPLETE. Reuse as-is; no schema change.

The production autosave the correction describes — edit → debounce →
authenticated server write → RLS → acknowledgement → subtle "Saved" — is
already built, and **verified against the live schema**:

| Piece | Where | Verified |
|---|---|---|
| Session + position | `intake_sessions` (`status`, `current_section`, `visible_question_ids`, `answered_question_ids`, `completion_percentage`) | columns present |
| Per-answer draft | `intake_answers` (`answer jsonb`, `section_id`, `answered_at`, `updated_at`) | columns present |
| Upsert key | `intake_answers_session_id_question_id_key` — `UNIQUE (session_id, question_id)` | **live unique index** |
| `updated_at` maintenance | trigger `intake_answers_set_updated_at` → `handle_updated_at()` | **live trigger** |
| Authenticated write | `saveV2Answer()` — upsert (`intakeV2/flow.ts`) | — |
| Rehydrate on return | `loadV2Answers()` | — |
| Debounce / ordering / retry | `createV2AutosaveQueue()` — shipped, unit-tested | — |

`UNIQUE (session_id, question_id)` is the precedent the case-taking answer table
copies, rather than inventing a key shape.

### 1.2 Practitioner case-taking — NOT COVERED

Six needs. Two can be met by existing tables, four cannot.

| Need | Existing candidate | Verdict |
|---|---|---|
| Consultation answers (current value) | `intake_answers` | **NOT SUITABLE.** Keyed on `member_id` — it is a *client* self-serve session. Writing practitioner-taken answers there would make the client the author of the practitioner's words, the precise confusion provenance exists to prevent. |
| Per-question history | `case_contributions` | **EXTEND.** Right shape, and already append-only *in the database* (trigger `trg_block_contribution_rewrite` → `block_contribution_rewrite()`, raising `check_violation` on any rewrite of `content`, `author_id`, `kind`, `case_id`, `created_at`). But it has **no question key**, so "History · n changes" for one question cannot be queried. |
| Observations | `case_contributions.kind` | **REUSE** for committed observations; the in-progress draft needs somewhere to live (§2.3). |
| Safety (Annex 1) answers | — | **GAP. No safety table exists anywhere in the schema.** |
| Section progress | — | **GAP** (derivable once answers exist). |
| Current consultation position | — | **GAP.** |

Inspected and rejected as draft stores, with reasons:

- `case_analysis_plan` — `(case_id, section, content, author_id, created_at)`; append-only free text, no per-question key, no update path.
- `case_events` — append-only log, `event_type` + `source_table`/`source_id` + `event_payload jsonb`. Correct for lifecycle *transitions*; wrong for a mutable working value.
- `case_practitioner_work` — the work **item** lifecycle (`status`, `assignment_source`, `started_at`, `completed_at`, `escalated_at`, `declined_at`, `cancelled_at`, `notes`). Holds no answers. This is where a consultation's *assignment* status belongs, and a case-taking session should hang off it.
- `reasoning_traces` / `reasoning_trace_entries` — AI reasoning output, visibility-scoped. Not practitioner capture.

### 1.3 The signing model already exists — mirror it

`member_protocols` is NI's canonical "signed version" table. The audit found
**three live triggers and a uniqueness rule** that together already define the
semantics the Founder has asked for:

| Mechanism | What it does |
|---|---|
| `UNIQUE (supersedes) WHERE supersedes IS NOT NULL` | a version may be superseded by at most one successor — a clean linear chain, no forks |
| `trg_protocol_signature_authority` → `enforce_protocol_signature_authority()` | on INSERT/UPDATE that sets a signature: signer must equal `auth.uid()`, case must be linked, signer must hold an **active `lead`** row in `case_team_roles`, and `practitioner_eligibility(auth.uid(),'lead').eligible` must be true. Raises `insufficient_privilege`. |
| `trg_signed_protocol_immutability` → `enforce_signed_protocol_immutability()` | once `signed_at` is set, content/version/signature columns are frozen; raises `check_violation` with *"create a revision instead"*. `status` and `updated_at` stay movable. |
| `trg_forbid_signed_protocol_delete` → `forbid_signed_protocol_delete()` | a signed version cannot be deleted, only superseded |

Two details matter for the design and are deliberately preserved:

- `enforce_protocol_signature_authority()` begins `if auth.uid() is null then return new; end if;` — it **permits service-role writes**. That is by design: the trigger gates end-user sessions, and `intakeV2/protocolSigning.ts` gates service-role callers in application code. Two layers, different jobs. Case-taking sign-off needs **both**, for the same reason.
- "Immutable" means *content and signature* frozen, not the whole row. Lifecycle status may still move after sign-off.

### 1.4 The access function — exact signature

```sql
public.can_access_case_care_profile(p_case_id uuid) RETURNS boolean  -- SECURITY DEFINER
```

It refuses unless **all** hold: `auth.uid()` is present; an unended
`client_practitioner_links` row joins caller to the case's client; an unended
`case_team_roles` row gives the caller a role on the case;
`practitioner_eligibility(auth.uid(), <the role actually held>).eligible` is
true; `has_practitioner_access_consent(client, caller)` is true; and a
`student` additionally has a supervisor holding a non-student role on the case.

Anchoring case-taking to this function means **consent and role-specific
eligibility gate case-taking automatically**, and any future tightening of that
function tightens case-taking with it.

Observed today: `client_practitioner_links` holds **0 rows**, so this function
currently returns false for every practitioner on every case.

### 1.5 Encrypted / offline draft architecture — none exists

The correction asked for this to be reported if found. It does not exist. The
only matches for `encrypt` / `offline` / `IndexedDB` across `apps/` and
`packages/` are prose in `apps/web/app/legal/privacy/page.tsx`. There is no
approved offline or client-side-encrypted draft mechanism to reuse.

### 1.6 Consequence, already applied

The browser-local Cockpit draft store that had been started was **deleted
unwired** (`apps/care/components/cockpit/cockpitDraft.ts`). Capture stays in
page state and the chrome reads **"Held in this session only"** — which is true,
and is not a placeholder for "saving".

---

## 2. Proposal

Two new tables, one extended column set, zero new access logic, zero new
vocabulary.

### 2.1 `case_taking_sessions` — lifecycle, authority, position, version

One row per **version** of a case-taking record.

| Column | Type | Note |
|---|---|---|
| `id` | `uuid` PK default `gen_random_uuid()` | |
| `case_id` | `uuid NOT NULL` → `client_cases(id)` | the RLS anchor |
| `practitioner_id` | `uuid NOT NULL` → `practitioners(id)` | who is taking the case |
| `work_id` | `uuid NULL` → `case_practitioner_work(id)` | the assignment this fulfils, where one exists |
| `version` | `integer NOT NULL DEFAULT 1` | mirrors `member_protocols.version` |
| `supersedes` | `uuid NULL` → `case_taking_sessions(id)` | mirrors `member_protocols.supersedes` |
| `state` | `text NOT NULL DEFAULT 'in_progress'` | CHECK ∈ `CASE_TAKING_STATES` |
| `current_position` | `text NULL` | resume bookmark, e.g. `digestion:2` |
| `submitted_by` / `submitted_at` | `uuid` / `timestamptz` | non-Lead hand-over |
| `review_started_at` | `timestamptz` | entry to `lead_review` |
| `ready_at` | `timestamptz` | entry to `ready_for_sign_off` |
| `signed_off_by` / `signed_off_at` | `uuid` / `timestamptz` | set once; mirrors `signed_by`/`signed_at` |
| `created_at` / `updated_at` | `timestamptz NOT NULL DEFAULT now()` | `updated_at` via the existing `handle_updated_at()` |

Keys:

```sql
UNIQUE (supersedes) WHERE supersedes IS NOT NULL              -- linear chain, mirrors member_protocols
UNIQUE (case_id, practitioner_id) WHERE signed_off_at IS NULL -- at most one open draft
```

The second index is what makes "return exactly where you left off"
unambiguous: there is never a choice of which draft to resume.

`state` mirrors `CASE_TAKING_STATES` in
`packages/db/src/cockpit/caseTaking.ts` exactly — `in_progress`,
`submitted_to_lead`, `lead_review`, `ready_for_sign_off`, `signed_off`. The
state machine, its transitions, its refusal codes and its authority rules are
**already built and tested there** (44 tests). This table persists what that
module already decides; it adds no new vocabulary.

### 2.2 `case_taking_answers` — the autosave target (current working value)

One row per `(session_id, question_id)`. **Mutable by upsert** — this is
explicitly the working draft, and saying so is what makes mutability correct
here rather than a loss of audit.

| Column | Type | Note |
|---|---|---|
| `id` | `uuid` PK | |
| `session_id` | `uuid NOT NULL` → `case_taking_sessions(id)` ON DELETE CASCADE | |
| `case_id` | `uuid NOT NULL` | denormalised so RLS needs no join |
| `question_id` | `text NOT NULL` | registry id, e.g. `v2.digestion.stool_form` |
| `section_id` | `text NOT NULL` | progress becomes a count, not a column |
| `entry_kind` | `text NOT NULL DEFAULT 'answer'` | CHECK ∈ `answer`, `observation`, `safety` |
| `value` | `jsonb NOT NULL` | |
| `provenance` | `text NOT NULL` | CHECK against the existing `V2_PROVENANCE_STATES` |
| `asked_at` | `timestamptz NULL` | **set only by an explicit ask.** See the CHECK below. |
| `actor_id` | `uuid NOT NULL` | attribution is not optional |
| `actor_case_role` | `text NOT NULL` | CHECK ∈ `lead`, `care_team`, `student` — `case_team_roles.team_role`, never a link role |
| `created_at` / `updated_at` | `timestamptz NOT NULL DEFAULT now()` | |

```sql
UNIQUE (session_id, question_id)          -- mirrors intake_answers exactly
CHECK (entry_kind <> 'safety' OR asked_at IS NOT NULL)
```

That CHECK is the Founder's rule *"do not allow reading a safety item to mark it
asked"* enforced **in the database**, not merely in the interface. A safety
entry cannot exist without an explicit ask timestamp, so no render path, no
prefetch and no default can manufacture one.

**Why mutable here and append-only elsewhere.** Autosave fires roughly once per
900 ms of typing per question. Appending a row per keystroke batch would turn
one sentence into dozens of rows and make the audit harder to read, not easier.
So the draft is one row that moves, and the audit chain goes to
`case_contributions` on the discrete acts that actually matter.

### 2.3 Observations and history — extend `case_contributions`, do not duplicate it

`case_contributions` is already the right table, already append-only at the
database level, and already carries `team_role`, `profession`, `client_confirmed`
and `supervisor_verified_by/at`. It is missing only a key.

**EXTEND** (two nullable columns, one index):

```sql
ALTER TABLE public.case_contributions
  ADD COLUMN question_id text NULL,
  ADD COLUMN session_id  uuid NULL REFERENCES public.case_taking_sessions(id);

CREATE INDEX case_contributions_case_question_idx
  ON public.case_contributions (case_id, question_id, created_at DESC);
```

`question_id` stays nullable because a case-level contribution legitimately has
no question. The existing `block_contribution_rewrite()` trigger must be
extended to freeze the two new columns as well — otherwise the append-only
guarantee would have a hole in exactly the columns the history view reads.
**That is a change to a live governance function and needs explicit approval.**

This gives both halves of the locked UX decision:

- **Current working value** — one indexed row read from `case_taking_answers`.
- **History · n changes** — `count(*)` / list from `case_contributions` filtered on `(case_id, question_id)`, newest first. No event replay. Nothing overwritten.

Observations:

- **Committed** observation → a `case_contributions` row (`kind='observation'`), append-only, attributed.
- **In progress** observation → a `case_taking_answers` row with `entry_kind='observation'` and `question_id = 'obs:<uuid>'`, so a half-typed observation survives a closed laptop. On commit it is written to `case_contributions` and the draft row deleted in the same transaction.

Amendments after sign-off use the same mechanism as the Protocol: a new session
row, `version + 1`, `supersedes` = the signed row's id, answers copied forward
as the starting working values. The signed version is never touched.

### 2.4 RLS — reuse, do not restate

Both new tables, every command:

```sql
ALTER TABLE public.case_taking_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY case_taking_sessions_access ON public.case_taking_sessions
  FOR ALL TO authenticated
  USING      (public.can_access_case_care_profile(case_id))
  WITH CHECK (public.can_access_case_care_profile(case_id));

-- identically for case_taking_answers, on its denormalised case_id
```

No new access logic and no second opinion about who may see a case. Consent,
role-specific eligibility and the student-supervision rule all arrive for free,
because that one function already enforces them (§1.4).

### 2.5 Triggers — because the interface is not an authority

Mirroring `member_protocols` one-for-one:

1. **`enforce_case_taking_signature_authority()`** — BEFORE INSERT OR UPDATE on `case_taking_sessions`. When a signature is being set: `signed_off_by` must equal `auth.uid()`; the caller must hold an **active `lead`** row in `case_team_roles` for the case; `practitioner_eligibility(auth.uid(),'lead').eligible` must be true. Raises `insufficient_privilege`. Returns early when `auth.uid()` is null, exactly as the Protocol trigger does — service-role callers are gated in application code instead (§2.6).
2. **`enforce_signed_case_taking_immutability()`** — BEFORE UPDATE on `case_taking_sessions`. Once `signed_off_at` is set, freeze `case_id`, `practitioner_id`, `version`, `supersedes`, `signed_off_by`, `signed_off_at`, `current_position`. Raises `check_violation`: *"this version is signed off — create an amendment instead."*
3. **`forbid_signed_case_taking_delete()`** — BEFORE DELETE on `case_taking_sessions`. A signed version cannot be deleted, only superseded.
4. **`freeze_answers_after_sign_off()`** — BEFORE INSERT OR UPDATE OR DELETE on `case_taking_answers`. Raises `check_violation` when the parent session's `state` is `signed_off`. This is the one trigger with no Protocol counterpart, because the Protocol keeps its content in the signed row itself.

Plus `handle_updated_at()` on both tables, reusing the existing function.

### 2.6 Application-layer guard — `authoriseCaseTakingSignOff`

A sibling of `authoriseProtocolSigning`, following the same proven shape: a pure
decision function plus an `assert…` throwing form, delegating eligibility to the
live database function and treating its verdict as final. It exists for the same
stated reason the Protocol guard exists: *"service-role callers bypass RLS by
design — so being server-side must never, on its own, be sufficient to sign."*

It must **not** be `authoriseProtocolSigning` itself. Conflating them would mean
either that taking a case commits you to a treatment plan, or that a plan can be
signed by whoever wrote the notes. Signing off a case-taking record asserts
*"this is a faithful record of the consultation"*; signing a Protocol asserts
*"this is my clinical plan"*. Different claims, different authority, same
machinery.

### 2.7 What this does NOT include

- No change to `intake_answers`, `intake_sessions`, `case_events`, `case_practitioner_work`, `member_protocols`, `case_analysis_plan`.
- No change to the Question Graph, the field registry, canonical field semantics, Annex 1 rules, or any approved wording.
- No canonical-record write. These tables hold case-taking. Resolving an answer onto a canonical field still waits on an approved Question → Concept(+variant) → Field mapping. **This proposal does not unblock that and must not be read as doing so.**
- No new eligibility, consent or access logic of any kind.

---

## 3. Autosave, retry and conflict semantics

### 3.1 The write path

```
EDIT → 900 ms debounce (createV2AutosaveQueue, reused unchanged)
     → authenticated server action saveCaseTakingAnswer()
     → upsert ON CONFLICT (session_id, question_id)
     → RLS: can_access_case_care_profile(case_id)
     → acknowledgement
     → "Saved"
```

No Save button. No Save-and-continue. No Cancel. No Exit.
`saveCaseTakingAnswer()` mirrors `saveV2Answer()` and is the only write path.

### 3.2 States shown to the practitioner

| State | Shown | When |
|---|---|---|
| `saving` | `Saving…` | a flush is in flight |
| `saved` | `Saved` | the server acknowledged |
| `error` | **`Not saved — retrying`**, and once retries are exhausted **`Not saved. Do not close this page.`** | the flush failed |

The failure state is quiet but unmistakable, and it never reads "Saved". The
Founder's rule — *do not let the practitioner believe work is saved when it is
not* — is the reason the indicator has a third state at all.

### 3.3 Retry

Reuses `createV2AutosaveQueue`'s existing behaviour: a serialised flush chain,
and a failed batch requeued so **newer edits win** over the retry of an older
value. Added on top: bounded exponential backoff (1 s, 2 s, 4 s, 8 s, capped at
30 s) rather than a tight loop, and the error state persists until a flush
actually succeeds.

### 3.4 Offline

The queue keeps accumulating in memory and the indicator stays in its failure
state. **Nothing is written to browser storage** — that is the whole point of
the correction: real health content does not get persisted locally for
convenience. The honest consequence is that a long offline spell with the tab
closed loses the unsaved delta, and the practitioner is told so plainly rather
than reassured falsely.

### 3.5 Browser close with pending writes

Two layers:

1. A `visibilitychange` / `pagehide` flush, already implemented for the client story, gives the in-flight batch its best chance to land.
2. If the queue is still non-empty, `beforeunload` sets `returnValue`, so the browser shows its own "leave site?" prompt. That is the one unavoidable interruption, and it is the browser's, not a modal of ours.

### 3.6 Server conflict

Per-question last-writer-wins, which is correct because the partial unique index
guarantees **one open session per practitioner per case**, so two tabs are the
same session and the same person. `updated_at` is returned on every
acknowledgement; if the server's `updated_at` is newer than the value the client
last sent, the client refreshes that question from the server rather than
overwriting it. No merge dialog.

Two *different* practitioners cannot collide on one draft: each has their own
session row, by that index.

### 3.7 Stale session

If the session has moved to `signed_off` beneath the practitioner — the Lead
signed off while a care-team member still had the tab open — the next write is
refused by `freeze_answers_after_sign_off()`. The Cockpit already handles this
in the interface (`refuseIfFrozen`), and would surface: *"This version was
signed off. Your change was not saved. Use Amend to start a new version."* The
edit stays in the field so it can be carried into the amendment; it is not
silently dropped.

If RLS begins refusing because eligibility, consent or the care-team role lapsed
mid-consultation, the write fails closed and the practitioner is told access has
changed. It is not retried indefinitely against a closed door.

### 3.8 Autosave is not sign-off

Stated explicitly because it is the easiest thing to get wrong. Autosave writes
a **draft**. It sets no `signed_off_at`, creates no `case_contributions` row,
writes nothing to the canonical record, and asserts no professional adoption.
Sign-off is a separate, deliberate, Lead-only act, gated by §2.5 trigger 1 and
§2.6.

---

## 4. Reuse / extend / not-suitable matrix

| Table or mechanism | Verdict | Reasoning |
|---|---|---|
| `can_access_case_care_profile(p_case_id)` | **REUSED** unchanged | sole access authority for both new tables |
| `practitioner_eligibility(id, role)` | **REUSED** unchanged | sole eligibility authority; the sign-off trigger calls it with `'lead'` |
| `handle_updated_at()` | **REUSED** unchanged | `updated_at` on both new tables |
| `case_practitioner_work` | **REUSED** unchanged | assignment lifecycle; sessions reference it via `work_id` |
| `case_events` | **REUSED** unchanged | lifecycle transitions, via existing `source_table`/`source_id` |
| Protocol version/signing model (`member_protocols` + its 3 triggers) | **REUSED as the pattern**, table untouched | `version`/`supersedes`/`signed_*` shape and all three trigger roles copied |
| `intakeV2/protocolSigning.ts` | **REUSED as the pattern**, module untouched | guard shape for §2.6; must not be called for case-taking |
| `createV2AutosaveQueue()` | **REUSED** unchanged | debounce, ordering, requeue |
| `intake_sessions` | **NOT SUITABLE** | client-owned, `member_id`-keyed |
| `intake_answers` | **NOT SUITABLE** as a store; **REUSED as the key pattern** | client-owned; its `UNIQUE (session_id, question_id)` is copied |
| `case_contributions` | **EXTENDED** — `+question_id`, `+session_id`, `+index`, trigger widened | right table for append-only history; lacks a question key |
| `case_analysis_plan` | **NOT SUITABLE** | append-only free text, no per-question key |
| `reasoning_traces` | **NOT SUITABLE** | AI output, not practitioner capture |
| Safety / Annex 1 store | **DOES NOT EXIST** | met by `entry_kind='safety'` + the `asked_at` CHECK |

No second audit system is created: `case_contributions` serves that role, which
is what the direction required.

---

## 5. Exact schema requirement

One migration, **`0066`**, containing only:

1. `CREATE TABLE case_taking_sessions` + 2 unique indexes + RLS policy + 3 triggers + `handle_updated_at`.
2. `CREATE TABLE case_taking_answers` + 1 unique index + 1 CHECK + RLS policy + 1 trigger + `handle_updated_at`.
3. `ALTER TABLE case_contributions ADD COLUMN question_id, session_id` + 1 index.
4. `CREATE OR REPLACE FUNCTION block_contribution_rewrite()` widened to freeze the two new columns.

Item 4 is the only change to anything already live. It is additive — it makes
the append-only guarantee stricter, never looser — but it rewrites a governance
function and so is called out separately for approval rather than bundled.

Nothing else requires a schema change. In particular the **client** intake
autosave needs none: it is already complete.

Sequencing:

1. Founder review of this proposal.
2. On approval, write `0066` and test it against PGlite as 0064/0065 were. **Not applied** until a separate release decision.
3. Wire the Cockpit: the queue exists and the state machine exists, so the UI change is swapping `useState` for the session plus the server action.
4. Only then does the Cockpit indicator become "Saved" — earned, because by then it will be true.

Until step 2 is approved the Cockpit continues to say *Held in this session
only*, and no practitioner-captured health content is written anywhere.
