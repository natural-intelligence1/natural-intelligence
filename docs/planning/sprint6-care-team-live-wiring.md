# Sprint 6 — Care Team Live Wiring (19 Sep 2026)

Workflow kept exactly as approved: ADMIN ASSIGNS → CLIENT APPROVES →
PRACTITIONER CONTRIBUTES → LEAD COORDINATES. No matching, no
recommendations, no orchestration engine, no permission maze.

## 0. Pre-flight — case-index signals (investigated before building)

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

## 1. Architecture reused (no parallel model)

`client_practitioner_links` (0038 — its existing `lead` role and
`ended_at` lifecycle ARE the Care Team lifecycle), `case_practitioner_work`,
the Sprint 4 eligibility trigger (0056 — already fires on links INSERT, so
every Care Team assignment inherits the agreement/credential/indemnity/
scope/lifecycle gate with zero new logic), the 0051 consent machinery,
and the Care Team V1 model/guards (labels, approval wording version,
student rules). Role mapping: Lead Responsible Practitioner = `lead`;
Care Team Practitioner = `specialist` (existing value); Student
Practitioner = `student` (the one new role value). Team role stays
separate from practitioner class (practitioners.category) and modality.

## 2. Migration 0057_care_team_live_wiring.sql — FILE ONLY, NOT APPLIED

Plain English: makes the four-step workflow real and fail-closed in the
database. Contents: `student` role + `supervisor_id` on links (+ CHECK);
ONE active Lead per client via partial unique index; trigger refusing a
Category 3 (NI Verified) lead and any student without an actively-linked
supervisor; client approval as the EXISTING consent machinery (new
granular purpose `practitioner_access` scoped by new
`context_practitioner_id`, withdrawable via the extended
`withdraw_own_consent`); fail-closed `has_practitioner_access_consent`;
pseudonymous `practitioner_assigned_clients` view (assignment AND consent
required; NO client identity columns — Sprint 5 stands); append-only
`case_contributions` (attributed; rewrite-blocking trigger for every
role); authoritative `case_analysis_plan` (trigger refuses service-role/
AI/admin/automated/intake/synopsis writes — auth.uid() NULL — and
students; only an authenticated practitioner with active consented
non-student involvement authors; append-only); `care_plan_coordination` +
RPC-only two-step release gate (active still-0056-eligible Lead records a
coordination review, then releases; workflow state only — the software
never judges the plan); practitioner_case_index recreated WITHOUT
case_complexity_score. Post-apply assertions + revert block in-file.

## 3. Health-profile access position

No identified practitioner-care surface is introduced. Deeper access
remains EXACTLY the Sprint 5 model: de-identified review packs + the
minimal case index. If live Care Team operation is later judged to need
an identified practitioner surface, that is a STOP-and-report requirement
for KR — nothing here weakens Sprint 5.

## 4. Tests staged

careTeamLive.test.ts — the full break-the-rule matrix A–M as an ARMED
live suite (self-skips until 0057 applies; verified self-skipping against
the live DB): unassigned invisible (A); assigned-without-approval
invisible and write-refused (B); withdrawal ends future access with audit
retained (C, inside M); expired indemnity refused (D — Sprint 4 gate);
second active Lead refused (E); Category 3 sole Lead refused (F); student
without active supervisor refused (G); student Analysis & Plan write
refused (H); admin/service write refused (I); AI/system write refused
(J — same NULL-auth service path, labelled); cross-client reads empty
(K); release without recorded coordination review refused (L); and the
FULL SYNTHETIC END-TO-END PATHWAY (M): assign eligible Lead + team member
+ supervised student → client approves via consent machinery →
practitioner sees only assigned clients (pseudonymous) → attributed
contributions (append-only proven, including a service-role rewrite
refusal) → student contributes under supervision → Lead authors Analysis
& Plan → coordination review → release succeeds → withdrawal → cleanup.

## 5. Flags & gates

PRACTITIONER_REVIEW_PACKS_ENABLED remains OFF in production (untouched).
Sprint 6 closure ≠ go-live: real-client activation still requires KR
approval, clinical review, Data Protection/governance review, the
technical/RLS gates, and Care Team live-wiring authorisation — recorded,
each.

## 6. Status

**SPRINT 6 READY FOR KR CARE TEAM MIGRATION AUTHORISATION** — everything
is built and staged; the founder stop holds before 0057 touches the
shared database. On authorisation: apply 0057 → run the 8 in-file
assertions → run the armed A–M matrix (zero skips) → Sprint 6 closes.
