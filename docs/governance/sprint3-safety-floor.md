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
- **B. `0052` is not applied until the practitioner workspace has been
  repointed at review packs and tested.** The repoint now exists in code
  behind `PRACTITIONER_REVIEW_PACKS_ENABLED` (default **off**, exact-string
  `"true"`), but "exists" is not "tested": applying `0052` first would remove
  the workspace's current read path while the replacement is still unverified.
- **C. The review-pack workspace mode must be tested (flag on, in a
  controlled session, against `0051` tables) before `0052` is applied.**
  The test must confirm: packs render for active work items; the blocked
  state renders when no pack exists; no identity, raw intake or case
  `primary_concern` free text appears anywhere in the pack-mode workspace;
  and cancelled/declined work grants no pack access.
- **D. No real-client use of any of this until clinician + solicitor review
  of all DRAFT texts and Founder sign-off.** This is independent of A–C:
  even with both migrations applied and both flags on, the intake
  kill-switches stay off and real clients stay out until the review-and-
  sign-off gate in the table above is passed.

## Build register (updated as the sprint lands)

See the Sprint 3 PR description for the authoritative list of what is done,
what is scaffolding, and what remains.
