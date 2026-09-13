# Founder Ruling — Intake Opens to All Users (13 September 2026)

**Decision (KR, Founder):** the client health intake opens to all
authenticated users before Sprint 3 (consent-at-start, rights channel,
de-identified practitioner access) is merged or its migrations applied. This
is a deliberate founder decision, recorded here — not a technical accident.

## Mechanism

- The ONLY switch is `INTAKE_COLLECTION_ENABLED=true` on the web app (the
  designed kill-switch, exact-string semantics). No allowlist, no other flag.
- The temporary single-account preview (allowlist code on branch
  `single-account-intake-preview`, env var `INTAKE_PREVIEW_ALLOWLIST_EMAILS`,
  DB migration 0053) is retired: the deployed code contains no allowlist,
  migration 0054 reverts 0053, and the env var should be deleted.
- `INTAKE_ASSIGNMENT_ENABLED` stays **off**: no practitioner routing, no case
  assignment, no `client_cases` / `case_practitioner_work` creation from
  intake, and therefore no practitioner visibility of anything collected.

## Consequences knowingly accepted

1. NI collects special category (health) data from real users before the
   Sprint 3 safety floor is merged/applied.
2. The current intake saves each section as it is completed — BEFORE the
   end-of-intake AI consent question. This ordering is known and stays
   imperfect until Sprint 3's consent-at-start gate lands.
3. Completion triggers the AI Synopsis and Body Story pipelines, writing to
   `ai_summaries` (and reasoning-trace tables for the Body Story). These
   pipelines are themselves flagged for Legal/MHRA review (see
   solicitor-rulings-2026-09.md) — that review remains outstanding.
4. Everything collected in this window must be DISCLOSED to the solicitor and
   clinician when their review of the Sprint 3 texts happens, and those
   members' consent evidence must be regularised (Sprint 3 backfill task).
5. This makes consent-at-start and the withdrawal/rights channel (Sprint 3)
   URGENT rather than optional — they are the remediation for 1–3.

## What completion writes (for the record)

`intake_responses` (one row per member: all section fields,
`consent_to_ai_analysis`, `consent_given_at`, `is_complete`),
`intake_answers` + `intake_sessions` (per-answer dual-writes),
`ai_summaries` (health_synopsis, body story) and `reasoning_traces`/
`reasoning_trace_entries` via the Body Story pipeline — all keyed to the
member's user id with timestamps. No `client_cases`, no
`case_practitioner_work`, no practitioner visibility while assignment stays
off.

## Replacement

The intake itself is ruled not fit for purpose and will be REBUILT to the
Appendix A specification (`ni-intake-build-instruction.md`, 13 Sep 2026) —
specification first, KR approval, then build. See
`docs/planning/intake-rebuild-alignment.md`.
