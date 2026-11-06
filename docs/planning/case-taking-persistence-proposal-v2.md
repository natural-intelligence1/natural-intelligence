# Case-taking persistence — REVISED proposal (V2)

**Status: PROPOSAL. Migration 0066 NOT written. No schema applied.**
Mission 19, 6 November 2026. Supersedes
[`case-taking-persistence-proposal.md`](./case-taking-persistence-proposal.md).

Every signature quoted below was read from the live database, not from memory.

## What changed from V1, and why

| V1 | Ruling | V2 |
|---|---|---|
| `UNIQUE (case_id, practitioner_id) WHERE signed_off_at IS NULL` | **NOT APPROVED** — a case-taking record is a shared case artefact, and the Lead must not acquire a second practitioner-owned session | Session is the **consultation artefact**. Uniqueness is `(case_id, consultation_seq) WHERE signed_off_at IS NULL`. `practitioner_id` is **gone** from the session |
| `work_id → case_practitioner_work` | Do not misuse practitioner-specific work ownership as a consultation identifier; do not create assignment artefacts | **Removed.** A case-taking session needs no work item to exist |
| One case ⇒ one case-taking exercise | Wrong — initial, follow-ups, reopened sections, later episodes | `consultation_seq` + `consultation_kind` on the session |
| `question_id = 'obs:<uuid>'` for observations | Overloads a canonical Question Graph identifier with an object type | `entry_kind` + `entry_id` + nullable `question_id` |
| Safety identified by question only | Annex-driven capture must keep its canonical safety identity | `annex_rule_id` alongside `question_id` |
| Last-writer-wins per question | Not acceptable when two authorised practitioners can touch one shared draft | Optimistic concurrency on a `revision` token |
| Sign-off might inherit `sole_unregistered_lead` | Keep Protocol signing rules separate | Authority = **active Lead case role + `practitioner_eligibility(…, 'lead')`**, nothing more |

---

## 1. Consultation / episode identity

### 1.1 Does a canonical consultation concept already exist? — **No.**

Searched every public table matching case / consult / episode / appointment /
session / work / visit / encounter / protocol. The full candidate set is:

`case_analysis_plan` · `case_contributions` · `case_events` ·
`case_practitioner_work` · `case_team_roles` · `client_cases` ·
`intake_sessions` · `member_protocols` · `protocol_items` ·
`protocol_templates`

**There is no consultation, episode, appointment or encounter table.** The two
that look closest are not it:

- **`client_cases`** — `(id, client_id, status, primary_concern, case_complexity_score, escalation_required, created_at, updated_at)`. This is the **case**: the whole relationship. It has no notion of a single consultation, and `getOrCreateClientCase` deliberately returns the one active case per client. Using it as the consultation identifier would collapse every follow-up into one record.
- **`case_practitioner_work`** — `(case_id, practitioner_id, work_type, status, assigned_by, assignment_source, due_at, assigned_at, started_at, completed_at, escalated_at, decline_reason, cancelled_at, output_event_id, notes, …)`. This is **one practitioner's assigned task**: it is keyed to a practitioner, carries `assignment_source` and `assigned_by`, and creating a row is itself an assignment artefact. It is precisely the "practitioner-specific work ownership" that must not be pressed into service here. It is also governed by `INTAKE_ASSIGNMENT_ENABLED`, which must stay off.

**So: none fits. A clean consultation identifier is required.**

### 1.2 Proposed identifier — on the session, not a new table

A case-taking session **is** the record of one consultation, so the identity
lives on it:

```sql
case_id          uuid NOT NULL REFERENCES public.client_cases(id) ON DELETE CASCADE,
consultation_seq integer NOT NULL,          -- 1, 2, 3… within the case
consultation_kind text NOT NULL
  CHECK (consultation_kind IN ('initial','follow_up','review','reopened')),
```

Identity of the artefact = **`(case_id, consultation_seq)`**. Versions of that
artefact share the pair and differ by `version`.

No speculative `case_consultations` table is proposed. If NI later needs
appointment times, attendees, duration or billing per consultation, these two
columns lift out into that table and the session gains a FK — a mechanical
change. Adding the table now would be inventing structure for requirements
that do not exist yet.

**Open point for the Founder:** `consultation_seq` is allocated by the
application (`max(seq)+1` for the case) rather than by a sequence, because it
must restart per case. The partial unique index in §6 makes a race fail loudly
rather than silently create a duplicate consultation.

---

## 2. `case_taking_sessions` — revised columns

```sql
CREATE TABLE public.case_taking_sessions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Case + consultation identity (§1.2)
  case_id            uuid NOT NULL REFERENCES public.client_cases(id) ON DELETE CASCADE,
  consultation_seq   integer NOT NULL,
  consultation_kind  text NOT NULL
                       CHECK (consultation_kind IN ('initial','follow_up','review','reopened')),

  -- Attribution, NOT ownership. Who opened this artefact; it does not confer
  -- exclusive rights and does not gate who may continue it.
  started_by         uuid NOT NULL REFERENCES public.practitioners(id),

  -- Workflow state — the five values already defined and unit-tested in
  -- packages/db/src/intakeV2/caseTaking.ts (CASE_TAKING_STATES).
  state              text NOT NULL DEFAULT 'in_progress'
                       CHECK (state IN ('in_progress','submitted_to_lead',
                                        'lead_review','ready_for_sign_off','signed_off')),

  -- Resume position. Opaque to the database.
  current_position   text,

  -- Submission / review transitions (§5)
  submitted_by       uuid REFERENCES public.practitioners(id),
  submitted_at       timestamptz,
  review_started_by  uuid REFERENCES public.practitioners(id),
  review_started_at  timestamptz,
  ready_at           timestamptz,

  -- Sign-off. Authority enforced by trigger (§8.1).
  signed_off_by      uuid REFERENCES public.practitioners(id),
  signed_off_at      timestamptz,

  -- Versioning — mirrors member_protocols exactly.
  version            integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  supersedes         uuid REFERENCES public.case_taking_sessions(id),

  -- Optimistic concurrency (§7)
  revision           integer NOT NULL DEFAULT 1,

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  -- A signature is both columns or neither.
  CONSTRAINT case_taking_signoff_complete
    CHECK ((signed_off_by IS NULL) = (signed_off_at IS NULL)),
  -- state = signed_off and the signature must agree.
  CONSTRAINT case_taking_signoff_state
    CHECK ((state = 'signed_off') = (signed_off_at IS NOT NULL)),
  -- Version 1 starts a chain; every later version supersedes exactly one.
  CONSTRAINT case_taking_version_chain
    CHECK ((version = 1 AND supersedes IS NULL) OR (version > 1 AND supersedes IS NOT NULL))
);
```

**`practitioner_id` is deliberately absent.** Practitioner attribution lives on
`started_by`, on the transition columns, on `case_taking_answers.updated_by`,
and on `case_contributions.author_id` — never on the artefact as a whole.

---

## 3. Session / version ownership

There is no owner. Authority to touch a session comes from the case, resolved
by the existing access function, plus role checks at the two moments that
matter:

| Action | Who | Enforced by |
|---|---|---|
| Open a session | any practitioner with case access | RLS (§9) |
| Edit answers while `signed_off_at IS NULL` | any practitioner with case access | RLS |
| Submit to Lead | the submitting practitioner | app + state CHECK |
| Take up review | active Lead | app guard (§8.2) |
| **Sign off** | active Lead with `'lead'` eligibility | **trigger** (§8.1) + app guard |
| Edit after sign-off | nobody | trigger (§8.3) |
| Amend | active Lead, by creating version n+1 | RLS + §6 indexes |

This is what makes the Founder's handoff requirement work: the Lead reviews and
signs **the same row**, because no row is anyone's private draft.

---

## 4. `case_taking_answers` — current state, observations, safety

```sql
CREATE TABLE public.case_taking_answers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid NOT NULL REFERENCES public.case_taking_sessions(id) ON DELETE CASCADE,

  -- Entry identity, replacing the rejected 'obs:<uuid>' overload.
  entry_kind    text NOT NULL CHECK (entry_kind IN ('answer','observation','safety')),
  entry_id      uuid NOT NULL DEFAULT gen_random_uuid(),

  -- Canonical Question Graph identity. NULL only for free-standing observations.
  question_id   text,
  section_id    text,

  -- Canonical safety identity, for Annex-driven capture.
  annex_rule_id text,

  -- The current working value. jsonb so a scale, a multi-select and free text
  -- all land in one column, exactly as intake_answers already does.
  value         jsonb,
  provenance    text,              -- V2_PROVENANCE_STATES, e.g. practitioner_verified

  -- Safety: set ONLY when the practitioner actually asked.
  asked_at      timestamptz,

  -- Attribution of the current value.
  updated_by    uuid NOT NULL REFERENCES public.practitioners(id),

  -- Optimistic concurrency (§7)
  revision      integer NOT NULL DEFAULT 1,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  -- An answer (safety or not) answers a question; an observation does not.
  CONSTRAINT case_taking_entry_question_shape CHECK (
    (entry_kind IN ('answer','safety') AND question_id IS NOT NULL)
    OR (entry_kind = 'observation' AND question_id IS NULL)
  ),

  -- THE SAFETY INVARIANT. Rendering, prefetching or reading a safety item can
  -- never mark it asked, because a safety row cannot exist without an explicit
  -- asked_at. Enforced in the database so no interface mistake can bypass it.
  CONSTRAINT case_taking_safety_requires_asked
    CHECK (entry_kind <> 'safety' OR asked_at IS NOT NULL),

  -- annex_rule_id is meaningful only for safety capture.
  CONSTRAINT case_taking_annex_scope
    CHECK (annex_rule_id IS NULL OR entry_kind = 'safety')
);
```

### The exact keys requested

```sql
-- ONE CURRENT ANSWER per (session version, canonical question).
-- Observations are excluded by the WHERE, so a question may carry its single
-- answer AND any number of observations.
CREATE UNIQUE INDEX case_taking_one_current_answer_idx
  ON public.case_taking_answers (session_id, question_id)
  WHERE entry_kind IN ('answer','safety');

-- Every entry, including each observation, is individually addressable —
-- this is what the autosave and the history link write against.
CREATE UNIQUE INDEX case_taking_entry_identity_idx
  ON public.case_taking_answers (session_id, entry_id);
```

The `entry_kind IN ('answer','safety')` list is written out rather than
`<> 'observation'` on purpose: a future fourth kind must be considered
explicitly, not inherit the uniqueness by accident.

---

## 5. Submission / Lead-review / sign-off transitions

Non-Lead: `in_progress → submitted_to_lead → lead_review → signed_off`
Lead: `in_progress → ready_for_sign_off → signed_off`

| From | To | Actor | Sets |
|---|---|---|---|
| `in_progress` | `submitted_to_lead` | non-Lead contributor | `submitted_by`, `submitted_at` |
| `in_progress` | `ready_for_sign_off` | active Lead | `ready_at` |
| `submitted_to_lead` | `lead_review` | active Lead | `review_started_by`, `review_started_at` |
| `lead_review` | `in_progress` | active Lead (returning it for more work) | — |
| `lead_review` | `ready_for_sign_off` | active Lead | `ready_at` |
| `ready_for_sign_off` | `signed_off` | active Lead + `'lead'` eligibility | `signed_off_by`, `signed_off_at` |
| `signed_off` | — | nobody | frozen (§8.3) |

Transitions are validated in the write API against the existing
`CASE_TAKING_STATES` constant; the CHECK constraints above stop the two
states that must never disagree with the signature.

---

## 6. Indexes

```sql
-- THE REVISED UNIQUENESS RULE. One open (unsigned) version per consultation.
-- This is what makes "another authorised practitioner continues" resolve to
-- the SAME artefact instead of creating a second private draft, and it is the
-- replacement for the rejected per-practitioner key.
CREATE UNIQUE INDEX case_taking_one_open_version_idx
  ON public.case_taking_sessions (case_id, consultation_seq)
  WHERE signed_off_at IS NULL;

-- Version numbers are unique within a consultation.
CREATE UNIQUE INDEX case_taking_version_idx
  ON public.case_taking_sessions (case_id, consultation_seq, version);

-- The amendment chain stays linear — mirrors member_protocols one-for-one.
CREATE UNIQUE INDEX case_taking_supersedes_idx
  ON public.case_taking_sessions (supersedes)
  WHERE supersedes IS NOT NULL;

-- Cockpit list: the practitioner's open work across cases.
CREATE INDEX case_taking_sessions_case_state_idx
  ON public.case_taking_sessions (case_id, state, consultation_seq DESC);

-- Fast CURRENT STATE read: one indexed scan per section.
CREATE INDEX case_taking_answers_session_section_idx
  ON public.case_taking_answers (session_id, section_id);
```

### Proof the uniqueness rule supports every required behaviour

| Requirement | How |
|---|---|
| One practitioner starts | INSERT version 1, `signed_off_at NULL`, `consultation_seq = n` |
| Another authorised practitioner continues | Writes to the **same row** — nothing keys on practitioner, and `case_taking_one_open_version_idx` guarantees there is only one open version to find |
| Non-Lead submits | State transition on the shared row |
| Lead reviews same artefact | Same row — the Lead acquires no second session, because a second open row for that `(case_id, consultation_seq)` is refused by the index |
| Lead signs same artefact | Sets `signed_off_by/at` on the same row |
| Signed version immutable | §8.3 freeze trigger |
| Later amendment creates successor | New row, `version + 1`, `supersedes` = signed row, `signed_off_at NULL`. Permitted because the predecessor is now signed and so no longer occupies the partial index |
| One case, many case-taking exercises | `consultation_seq + 1` starts an independent chain; initial / follow-ups / reopened / later episodes coexist |

The amendment case is worth spelling out: the partial index keys on
`(case_id, consultation_seq)` **where unsigned**. A signed row drops out of the
index, which is exactly what frees the slot for version n+1 — and also why two
unsigned amendments of the same consultation cannot coexist.

---

## 7. Concurrency — optimistic, no locks

Two authorised practitioners can hold the same shared draft open, so
last-writer-wins is not acceptable.

**Mechanism: a `revision` token supplied with every write.**

```sql
UPDATE public.case_taking_answers
   SET value = $value, provenance = $provenance,
       revision = revision + 1, updated_at = now(), updated_by = $actor
 WHERE session_id = $session AND entry_id = $entry AND revision = $expected
RETURNING revision, updated_at, updated_by;
```

- **Zero rows returned ⇒ stale.** Someone else moved the value on. The server returns `{ conflict: true, current: <row> }`; the client refreshes that one field and shows it changed. No modal, no lock, no checkout.
- **Match ⇒ accepted**, and the new `revision` is returned in the acknowledgement for the next write.
- **New entry** inserts at `revision = 1`. A unique violation on `case_taking_one_current_answer_idx` means another practitioner created that answer first, which is reported as the same conflict with the existing row.
- **Session-level transitions** use the identical pattern against `case_taking_sessions.revision`, so two Leads cannot both sign or both submit.

Reconciliation is per field, not per form, so one stale field never discards a
practitioner's other work.

### Save states shown

`Saving…` · `Saved` · `Not saved — retrying` · `Not saved. Do not close this page.`

No `Save`, `Save and continue`, `Cancel` or `Exit`. **No health data in
localStorage** — a pending unsaved delta stays in memory only, and the honest
cost is that a long offline spell with the tab closed loses that delta, which
is why the fourth state exists rather than a reassuring one.

Autosave sets no `signed_off_at`, writes no contribution and asserts no
adoption. **Autosave is not sign-off.**

---

## 8. Immutability and authority triggers

### 8.1 `enforce_case_taking_signoff_authority()` — BEFORE INSERT OR UPDATE

The rule the Founder specified is **already written and live** as
`enforce_protocol_signature_authority()`. Read from the database, it performs
exactly two authority checks:

```sql
-- active Lead case role
if not exists (
  select 1 from public.case_team_roles
   where case_id = new.case_id and practitioner_id = auth.uid()
     and team_role = 'lead' and ended_at is null
) then raise exception … end if;

-- role-specific eligibility
select e.eligible into v_eligible
  from public.practitioner_eligibility(auth.uid(), 'lead') e;
if v_eligible is not true then raise exception … end if;
```

So the case-taking trigger is a **structural copy** of it, against
`signed_off_at` / `signed_off_by` instead of `signed_at` / `signed_by`, plus
the same `signed_by = auth.uid()` rule (you may only sign as yourself).

**Nothing is added.** In particular `sole_unregistered_lead` is *not* carried
over — it lives in application code (`packages/db/src/intakeV2/protocolSigning.ts`),
not in this trigger, and per Founder decision it stays Protocol-only. Case-taking
sign-off asserts *"this is the reviewed record of the consultation"*, not
*"I professionally adopt this treatment Protocol"*.

### 8.2 Application guard — `authoriseCaseTakingSignOff()`

Required because `enforce_protocol_signature_authority()` contains:

```sql
if auth.uid() is null then
  return new;
end if;
```

Service-role callers have no `auth.uid()`, so the trigger waves them through
**by design** — RLS and these triggers are end-user controls. The copy will
inherit that gap, so the same two checks are also made in application code,
mirroring `authoriseProtocolSigning`. Being server-side must never, on its
own, be sufficient to sign.

### 8.3 `freeze_case_taking_after_sign_off()` — BEFORE UPDATE OR DELETE

Mirrors `enforce_signed_protocol_immutability()` and
`forbid_signed_protocol_delete()`:

- once `OLD.signed_off_at IS NOT NULL`, every column change is refused with *"create an amendment instead"*;
- DELETE of a signed session is refused;
- answers belonging to a signed session are refused on UPDATE and DELETE.

### 8.4 `handle_updated_at()` — reused unchanged on both tables.

---

## 9. RLS

Both tables, `ENABLE ROW LEVEL SECURITY`, one policy each, anchored on the
existing SECURITY DEFINER function — exact signature confirmed as
`public.can_access_case_care_profile(p_case_id uuid) → boolean`:

```sql
CREATE POLICY case_taking_sessions_access ON public.case_taking_sessions
  FOR ALL TO authenticated
  USING      (public.can_access_case_care_profile(case_id))
  WITH CHECK (public.can_access_case_care_profile(case_id));

CREATE POLICY case_taking_answers_access ON public.case_taking_answers
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.case_taking_sessions s
     WHERE s.id = case_taking_answers.session_id
       AND public.can_access_case_care_profile(s.case_id)))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.case_taking_sessions s
     WHERE s.id = case_taking_answers.session_id
       AND public.can_access_case_care_profile(s.case_id)));
```

Nothing about consent, case-team membership, student supervision or
practitioner eligibility is restated here. It all arrives through that one
function, which is the point — a second copy of the access rule is a second
thing to get wrong.

**Note:** with `client_practitioner_links` currently at 0 rows,
`can_access_case_care_profile` returns false for every practitioner on every
case. These policies will correctly deny everything until real care
relationships exist.

---

## 10. `case_contributions` extension — minimum linkage

No second audit system. `case_contributions` is already append-only at the
database level via `block_contribution_rewrite()` and already carries
`author_id`, `team_role`, `profession`, `kind`, `content`, `source`
(default `'consultation'`), `client_confirmed` and the supervisor-verification
pair. What it lacks is any way to say *which question* a contribution concerns.

```sql
ALTER TABLE public.case_contributions
  ADD COLUMN session_id  uuid NULL REFERENCES public.case_taking_sessions(id),
  ADD COLUMN entry_id    uuid NULL,
  ADD COLUMN question_id text NULL;

-- "History · n changes" for one entry, newest first.
CREATE INDEX case_contributions_entry_history_idx
  ON public.case_contributions (entry_id, created_at DESC)
  WHERE entry_id IS NOT NULL;

-- The same question's history across versions and consultations.
CREATE INDEX case_contributions_case_question_idx
  ON public.case_contributions (case_id, question_id, created_at DESC)
  WHERE question_id IS NOT NULL;
```

Why each of the three, since the Founder asked for the minimum:

- **`entry_id`** — the only thing that identifies one observation, which has no `question_id` at all. Also the direct key for the UI's per-field history.
- **`question_id`** — an amendment creates a **new** session version with **new** `entry_id`s, so `entry_id` alone cannot show a question's history across an amendment. This is what makes the history survive versioning.
- **`session_id`** — *strictly derivable* through `entry_id → case_taking_answers.session_id`, so this is the one column the Founder could cut. It is proposed because "everything that changed in version 2" is a single indexed read with it, and a two-step query without it. **Flagged as optional.**

All three are nullable, so every existing row and every non-case-taking
contribution is unaffected.

### The one change to live governance code

```sql
CREATE OR REPLACE FUNCTION public.block_contribution_rewrite() …
```

The live body freezes `content`, `author_id`, `kind`, `case_id` and
`created_at`. It must gain exactly three clauses so the new columns are frozen
too — otherwise history could be silently re-pointed at a different question:

```sql
  OR NEW.session_id  IS DISTINCT FROM OLD.session_id
  OR NEW.entry_id    IS DISTINCT FROM OLD.entry_id
  OR NEW.question_id IS DISTINCT FROM OLD.question_id
```

This is **additive** — it makes append-only stricter, never looser — but it
rewrites a live governance function, so it is called out separately rather
than bundled.

---

## 11. Exact migration scope, when authorised

Migration `0066` — **not written**:

1. `CREATE TABLE case_taking_sessions` + CHECKs + 4 indexes + RLS + 3 triggers.
2. `CREATE TABLE case_taking_answers` + CHECKs + 3 indexes + RLS + 2 triggers.
3. `ALTER TABLE case_contributions` — 3 nullable columns + 2 partial indexes.
4. `CREATE OR REPLACE FUNCTION block_contribution_rewrite()` — the three added clauses. **The only change to anything already live.**

No existing table is dropped, renamed or re-keyed. No existing policy is
altered. No existing data is migrated.

---

## 12. Founder decisions still open

1. **Approve or reject the revised uniqueness rule** `(case_id, consultation_seq) WHERE signed_off_at IS NULL`.
2. **`consultation_seq` on the session vs a `case_consultations` table.** V2 proposes the former; the latter is the right call only if consultations need their own attributes now.
3. **Is `session_id` on `case_contributions` worth it?** Derivable; proposed for query cost (§10).
4. **Who may open a follow-up consultation** — any practitioner with case access, or the Lead only? Not assumed either way.
5. **`consultation_kind` value list** — `initial / follow_up / review / reopened` is a proposal, not a canonical taxonomy. If these become canonical values they belong wherever `CASE_TAKING_STATES` lives.
