# Sprint 3 — Platform Safety Floor

**Status:** in build (branch `sprint-3-safety-floor`) · **Started:** 2026-09-10 ·
**Owner:** Founder · **Gatekeepers:** clinician + solicitor + Founder

Nothing real touches the platform until this floor is built **and** reviewed. All
legal/clinical wording introduced in this sprint is
**DRAFT — requires solicitor/clinician review before real-client use.**

---

## Plan of Record correction (Phase 0)

The POR previously carried "RLS hardening — not started". Corrected ground truth
(verified by catalogue query, 2026-09-10):

- **RLS coverage is complete.** All 47 public tables have RLS enabled with at
  least one policy. There is no uncovered table.
- **Sprint 3 RLS work is therefore correctness, narrowing and testing** — not
  coverage: adversarial review of single-policy health tables, negative
  (cross-member / unauthorised-practitioner) tests, ratifying or closing the
  by-design member own-row write path, and narrowing the practitioner read
  grants that predate anonymisation (migration `0048`).
- **Anonymisation and RLS narrowing are one coupled workstream.** The `0048`
  practitioner grants to identified intake/BioHub rows must be narrowed **in the
  same motion** as the de-identified review-pack model ships — never a redaction
  layer on top of open raw access, and never revoked access with no review pack
  to replace it.

## Real-client-use gate (Phase 6)

Real clients remain **blocked** from platform intake, practitioner routing and
practitioner data access until every line below is signed:

| Gate item | State | Sign-off required |
|---|---|---|
| Consent-at-start (granular, versioned, before any health data saves) | Built this sprint — DRAFT wording | Solicitor |
| Consent withdrawal + client-rights request channel | Built this sprint (manual fulfilment) | Solicitor |
| Practitioner agreement (3 categories, versioned, post-approval acceptance) | Foundation built this sprint — DRAFT text | Solicitor |
| Insurance / registration / DBS capture | Foundation built this sprint | Founder + solicitor |
| De-identified practitioner review pack | Foundation built this sprint | Clinician |
| RLS narrowing of pre-anonymisation practitioner grants | Migration written, **not applied** | Founder (apply) + clinician |
| Negative RLS tests | Added this sprint | — |
| Clinician review of the whole floor | Not started | Clinician |
| Solicitor review of the whole floor | Not started | Solicitor |
| Founder approval to unblock | Not given | Founder |

Operational blocks that stay in place regardless: `INTAKE_COLLECTION_ENABLED`
and `INTAKE_ASSIGNMENT_ENABLED` remain default-off; the manual off-platform loop
carries its own separate consent/insurance/storage gate (POR §4).

## Migration discipline for this sprint

Migrations `0051`/`0052` are **committed as files only and are NOT applied** to
the database by this branch. The repo has a single (production) database, so
applying them is a production change requiring Founder authorisation after PR
review. Consequences, by design:

- New code reads/writes the new tables through loose clients and **degrades
  gracefully** (clear "not yet available" states) until the migrations are applied.
- The care-app agreement gate ships behind `PRACTITIONER_AGREEMENT_GATE`
  (default **off**, exact-string `"true"` to enable — same semantics as the
  intake kill-switches). The gate is FAIL-CLOSED and **cannot be enabled until
  agreements exist in the database**: publish the three DRAFT agreements via
  the controlled admin pathway (Dev tools → "Publish DRAFT practitioner
  agreements"), never via ad hoc SQL.
- `0052` (narrowing) must be applied together with the review-pack rollout, per
  the coupling rule above.

### Migration sequencing (unambiguous — overnight hardening)

The following order is mandatory. No step may be skipped or reordered.

- **A. `0051` is applied only after review.** Founder authorisation after PR
  review is required before `0051` touches the production database. Until
  then it is a file on the branch and nothing more.
- **B. `0052` is not applied until EVERY practitioner raw-access surface has
  been repointed and tested.** `0052` now removes practitioner SELECT on
  `client_cases` entirely (RLS cannot mask columns, so `primary_concern` and
  `client_id` could not otherwise be protected) and replaces it with the
  column-scoped `practitioner_case_index` view (operational fields only).
  The repointed surfaces — case workspace, practitioner inbox and reasoning
  page — all exist in code behind `PRACTITIONER_REVIEW_PACKS_ENABLED`
  (default **off**, exact-string `"true"`), but "exists" is not "tested":
  applying `0052` first would remove the current read paths while the
  replacements are still unverified.
- **C. The review-pack mode must be tested (flag on, in a controlled
  session, against `0051` tables) before `0052` is applied.** The test must
  confirm: packs render for active work items; the blocked state renders
  when no pack exists; no identity, raw intake, reasoning trace or case
  `primary_concern` free text appears anywhere in the pack-mode workspace,
  inbox or reasoning page; completed, cancelled and declined work grant no
  pack or case-index access; and the post-apply SQL assertions in the
  `0052` file all hold.
- **D. No real-client use of any of this until clinician + solicitor review
  of all DRAFT texts and Founder sign-off.** This is independent of A–C:
  even with both migrations applied and both flags on, the intake
  kill-switches stay off and real clients stay out until the review-and-
  sign-off gate in the table above is passed.
- **E. PA pass still required before merge/migration/deploy decisions.**
  Branch-local hardening is authorised; the decisions to merge this branch,
  apply 0051/0052 or deploy remain blocked until the PA pass is recorded.

### Standing decisions (final hardening, 13 Sep 2026)

- **Completed work grants no client-data access in de-identified mode.**
  The 0051 pack SELECT policy, the 0052 `practitioner_case_index` view and
  every pack-mode surface (workspace, inbox, reasoning) are active-work-only
  (`assigned`/`in_review`/`escalated`). Cancelled and declined work 404.
  Reintroducing `completed` requires a signed retention/continuity
  requirement plus an explicit `completed_at` time window, changed in
  review — never silently.
- **Pack mode is pseudonymous at the DATABASE level, not just the UI.**
  `0052` removes the practitioner work-history branch from the
  `practitioner_client_identity` (0041) and
  `practitioner_client_personalisation` (0047) owner-rights views — both
  previously served rows for ANY work history with no status filter. After
  `0052`, those views are self+admin only, and post-apply SQL assertions 4–5
  in the migration verify it. A future identified-care mode, if ever signed
  off, must arrive as a new, separately gated surface through governance —
  never by restoring these view branches.
- **Agreement texts are immutable at the DATABASE level.** A trigger on
  `practitioner_agreements` refuses in-place changes to category, version,
  title, body or created_at for every role; only `is_current` may change
  (controlled promotion/demotion). Changed wording is a new version row.
- **Reasoning traces are not pack-safe.** `getPractitionerTrace` returns AI
  reasoning generated from the identified record; pack mode never calls it
  and shows an explicit unavailable state until a de-identified reasoning
  surface exists.
- **Withdrawal purposes.** `withdraw_own_consent` accepts only the five
  granular purposes, validated server-side. `platform_terms` and
  `data_processing` cannot be withdrawn via the RPC: they go through the
  rights-request channel, where a `data_processing` withdrawal is enforced
  as a GLOBAL processing restriction.
- **LRP — Lead Responsible Practitioner (PA condition, manual loop).**
  Every practitioner-led case has exactly ONE active LRP at any time. A
  Category 3 (unregistered) practitioner cannot be sole LRP at launch.
  There is no practitioner category 4 and no "student" practitioner class —
  students and graduates are a community pathway, not a care-delivery role.
  Schema enforcement of the LRP model is NOT yet built: until it is, the
  manual operating loop must record the LRP explicitly in writing for every
  case, from case one, and any LRP change must be recorded the same way.
- **Future product control (PA condition, recorded for the roadmap).** The
  CQC/change-control boundary currently exists in governance text, not as a
  hard product control. Before any new modality, profession or care
  activity can be enabled, a profession/modality ACTIVATION GATE must be
  built into the product (a controlled allow-list, default-deny, with
  governance + solicitor review recorded per activation). Until that gate
  exists, no new modality or care activity may be switched on.
- **CQC (approved position).** NI does not carry any regulated activity in
  its current operating model. NI is presently designed to operate outside
  CQC registration. CQC is a change-control boundary only: future
  professions, modalities, reserved activities, clinical pathways or
  care-delivery changes must be reviewed for CQC/regulatory implications
  before activation — through governance and with solicitor review — never
  activated first and assessed after.

## Build register (updated as the sprint lands)

See the Sprint 3 PR description for the authoritative list of what is done,
what is scaffolding, and what remains.
