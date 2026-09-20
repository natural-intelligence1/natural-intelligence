# Sprint 6 — Care Team Live Wiring (19–20 Sep 2026, REVISED)

Workflow kept exactly as approved: ADMIN ASSIGNS → CLIENT APPROVES →
PRACTITIONER CONTRIBUTES → LEAD COORDINATES. No matching, no
recommendations, no orchestration engine, no permission maze.

**Revision (20 Sep, per KR/Orchestrator review of the first staging):**
Issue 1 — Lead responsibility is **per CASE**, not per client; Issue 2 —
active care uses a purpose-built scoped **Active Care Health Profile**
surface, never restored raw-table SELECTs. Both are implemented in the
revised 0057 below. The first staging's per-client lead index and
links-level student role are gone.

## 0. Pre-flight — case-index signals (investigated before building; retained)

- **case_complexity_score**: defined in 0033 (CRT schema), `NOT NULL
  DEFAULT 0`. Repo-wide trace finds **no writer anywhere** — only reads
  (inbox, workspace header, the case-index view). Every live value is 0
  (verified by SQL across all cases). The related
  `assignment_source='auto_complexity_threshold'` CHECK option is equally
  unused. Verdict: a schema remnant named for an automated-complexity
  concept that NI's boundary prohibits and that was never built. The
  practitioner surface does not need it. **0057 removes it from
  practitioner_case_index**; the column itself is kept (inert, no data
  loss). No new score is invented.
- **escalation_required**: written ONLY by the 0045
  `complete_practitioner_work` RPC when a **human practitioner** chooses
  the escalation completion path. Manual/professional workflow state, not
  software-derived scoring. Practitioners genuinely need it (it is their
  own escalation signal). **Retained**, with this evidence.

## 1. Architecture map — CLIENT LEVEL vs CASE LEVEL

**CLIENT LEVEL** — "does this client have an approved relationship and an
active data-sharing approval with this practitioner?"

- Practitioner relationship: `client_practitioner_links` (0038,
  unchanged by 0057) — admin-created (`assigned_by_admin`), lifecycle via
  `ended_at`. Link `role` stays a relationship descriptor only; it no
  longer carries clinical case authority and never carries `student`.
- Access consent: `consent_records` purpose **`practitioner_access`**
  scoped by the new `context_practitioner_id` — versioned, timestamped,
  withdrawable via the extended `withdraw_own_consent`. NEVER a boolean.

**CASE LEVEL** — "what role does this practitioner hold on THIS case?"

- Practitioner assignment + Lead role + Care Team role + student
  participation/supervision: NEW slim table **`case_team_roles`**
  (case_id, practitioner_id, team_role `lead|care_team|student`,
  supervisor_id, assigned_by, started_at/ended_at). Why not
  `case_practitioner_work`: work rows are per-item TASKS
  (assigned→completed); a standing clinical role does not fit work
  semantics, so the smallest robust case-level primitive is this one role
  table — not a reshaping of the work log, not a generic platform.
  - **Exactly one active Lead per CASE**: partial unique index
    `uniq_active_lead_per_case (case_id) WHERE team_role='lead' AND
    ended_at IS NULL`. A second case for the same client may hold its own
    Lead; an ended Lead never blocks a successor.
  - Rules trigger on every INSERT/UPDATE (all roles incl. service):
    Sprint 4 eligibility reused (`practitioner_assignment_eligibility`),
    Category 3 cannot be the sole Lead, a student's supervisor must hold
    an active non-student role on the SAME case.
- Contributions: `case_contributions` (append-only, attributed).
- Coordination review + plan release: `care_plan_coordination` via the
  two Lead-only RPCs (per-case Lead check).

## 2. Two access modes (Issue 2)

**MODE 1 — pre-care review (unchanged, Sprint 5):** de-identified review
pack + minimal case index. 0057 creates NO policy on any raw source
table; practitioners still cannot SELECT intake_responses, intake_answers,
client_cases, profiles or lab tables directly.

**MODE 2 — active care team:** the ONE scoped view
**`care_team_health_profile`** (owner-rights, security_barrier; the WHERE
clause is `can_access_case_care_profile(case_id)`), readable only while
ALL hold:

1. active CLIENT-level relationship (link not ended);
2. active CASE role for the caller on that case (admin-assigned);
3. caller still passes Sprint 4 eligibility;
4. active client `practitioner_access` consent for THAT practitioner;
5. (students) active supervision on the same case.

Withdrawal, ending the relationship or ending the role each removes
future access immediately on its own. V1 is one standard bundle — no
field-by-field permission system.

**Exact fields exposed** (also exported as `CARE_HEALTH_PROFILE_FIELDS`):
case_id, case_status, presenting_concern, escalation_required (human-set),
client_full_name, biological_sex, and from the latest COMPLETED intake:
arrival_emotion, primary_concerns, primary_system, stress_level,
sleep_quality, energy_level, current_medications, current_supplements,
symptom_onset, diagnosed_conditions, timeline_last_well, timeline_trigger,
diet_description, most_want_to_understand.
**Explicitly NOT exposed:** email/phone (auth.users is never joined),
address (no such column), religion, religious_content_preference,
clinical_notes_on_sex, avatar/bio, credentials/login data, admin notes,
draft intakes, other cases, other clients, platform analytics. profiles
has no separate preferred-name column today; full_name is the single
identity field surfaced.

`practitioner_assigned_cases` lists the caller's own active consented
assignments (with client name — assignment AND consent already hold).

**Student model:** never inherits supervisor access; each gate is checked
for the student personally (own consent row, own active role, active
supervision). Narrower where it should be: students read the factual
bundle and contribute (attributed, supervisor-verifiable) but cannot read
or author Analysis & Plan (SELECT policy excludes students; author
trigger refuses them).

## 3. Migration 0057_care_team_live_wiring.sql — FILE ONLY, NOT APPLIED

Plain English: makes the four-step workflow real and fail-closed in the
database, at the right levels. Contents: `case_team_roles` + per-case
lead index + rules trigger (§1); consent purpose `practitioner_access` +
`context_practitioner_id` + extended `withdraw_own_consent` +
`has_practitioner_access_consent` (§2); `can_access_case_care_profile`
predicate (§3); `care_team_health_profile` + `practitioner_assigned_cases`
views (§4); append-only `case_contributions` with rewrite-blocking
trigger (§5); authoritative `case_analysis_plan` (NULL-auth/service/AI/
admin writes refused; students refused; append-only) (§6);
`care_plan_coordination` + the two per-case-Lead RPCs (§7);
practitioner_case_index recreated WITHOUT case_complexity_score (§8).
Post-apply assertions + revert block in-file. Entirely additive; live
links (0 rows) and work rows (3) untouched.

## 4. Tests staged — matrix A–U (armed)

careTeamLive.test.ts self-skips until 0057 applies (probe on
case_team_roles). A unassigned invisible (list, bundle, reads); B/P
assigned at both levels without approval → invisible, NO Health Profile,
writes refused; C/S withdrawal immediately removes list + bundle + writes
with audit retained; D expired indemnity refused at case-role insert
(Sprint 4 gate reused); E/N second active Lead on the SAME case refused
on the helper path AND raw service INSERT (uniq_active_lead_per_case);
N ended historical Lead never blocks a successor; O a different eligible
Lead on a separate case for the SAME client is allowed; F Category 3 sole
Lead refused; G student without a same-case active supervisor refused
(CHECK + trigger paths); Q approval via the existing consent machinery
opens EXACTLY the documented bundle (field-set equality asserted; no
email/phone/address/religion/clinical-notes keys); R the SAME fully
authorised practitioner still gets zero rows from intake_responses,
intake_answers, lab_reports, biomarker_results, client_cases, profiles
(Sprint 5 intact); K/U nothing of case B — list, contributions, bundle,
raw view rows; contribute-never-overwrite (peer UPDATE invisible,
service rewrite hits the append-only trigger); H/I/J analysis refusals
(NULL-auth service/AI/admin; student; uninvolved practitioner); student
scope (contributes + factual bundle, zero analysis rows); L release
without recorded coordination review refused; M full pathway — per-case
Lead coordinates then releases, and the OTHER case's Lead is refused on
this case; T ending the case assignment immediately removes the bundle.
All identities synthetic; suite self-cleans.

## 5. Flags & gates

PRACTITIONER_REVIEW_PACKS_ENABLED remains OFF in production (untouched).
Sprint 6 closure ≠ go-live: real-client activation still requires KR
approval, clinical review, Data Protection/governance review, the
technical/RLS gates, and Care Team live-wiring authorisation — recorded,
each.

## 6. Status

**SPRINT 6 REMAINS OPEN — awaiting KR re-authorisation of the corrected
0057 hash.** KR authorised application of hash `6db97b29…` (20 Sep); the
§1 pre-apply verification found that file could not apply as reviewed:
its §8 used `CREATE OR REPLACE VIEW` to remove `case_complexity_score`
from `practitioner_case_index`, which PostgreSQL refuses (view columns
cannot be removed or reordered in place) — the migration would have
aborted mid-file. Application was therefore STOPPED with the database
untouched. The corrected file switches §8 to `DROP VIEW` + `CREATE VIEW`
and restates privileges SELECT-only; the same verification also found the
live 0052 view is auto-updatable with Supabase default ALL grants to
authenticated (an eligible practitioner with an active work item could in
principle have written to client_cases through the owner-rights view — no
live exposure: zero links, packs flag OFF), so the recreation closes that
too, and both new 0057 views carry the same explicit SELECT-only grant
posture. On re-authorisation of the corrected hash: apply 0057 → in-file
assertions → armed A–U (zero skips) → types regeneration → cleanup →
Sprint 6 closes.
