# Phase 3 Close-Out Checklist (13 September 2026)

Sprint 3 branch: `sprint-3-safety-floor` @ `054969e` · main @ `be04a2c`.
Legend: SEQ = sequential (blocks the next step) · PAR = parallelisable.
HARD STOP = requires named human authorisation; Code cannot do it alone.

| # | Item | Owner | Prerequisites | SEQ/PAR | Rough duration | Hard stop? |
|---|------|-------|---------------|---------|----------------|------------|
| A | PA before-Draft-PR conditions — CLOSED with evidence (pa-conditions-closeout.md): six-blocker table, DB-gate table, self-skipping tests | Code (done) → PA acknowledges | — | done | done | no |
| B | PA before-merge conditions — evidence table prepared (fallback fails safe, no index inference, adversarial re-id tests, consent-before-read, enum/no-student); PA ticks them off | PA | A; Draft PR open | SEQ | 0.5–1 day PA time | no |
| C | Merge `sprint-3-safety-floor` → main | KR (click) after PA + review | B; Draft PR reviewed (KR/Orchestrator); 6 pre-existing test failures triaged or accepted | SEQ | minutes + review time | **HARD STOP (KR)** |
| D | Apply migration 0051 | KR authorises; Code applies + runs the 11 self-arming live tests as acceptance | C (or KR may authorise pre-merge); consent-row backfill plan for open-intake members | SEQ | 30 min incl. tests | **HARD STOP (KR)** |
| E | Test pack-mode flag-on (controlled session): workspace, inbox, reasoning; blocked states; no identity/concern/trace; inactive work denied | Code executes; KR/Orchestrator witnesses | D; PRACTITIONER_REVIEW_PACKS_ENABLED on in a controlled env | SEQ | 0.5 day | env change = **HARD STOP (KR)** |
| F | Apply migration 0052 + five post-apply assertions + 6 self-arming tests | KR authorises; Code applies | E passed | SEQ | 30 min incl. tests | **HARD STOP (KR)** |
| G | Solicitor advice additions — CQC position, de-identification, SaMD rulings + hard product rule recorded in governance; SaMD softening SHIPPED for RootFinder/BioHub; DailyPath + Synopsis/Body Story flagged for their own Legal/MHRA review | Code (done) → solicitor confirms record is faithful; solicitor/clinician review of all DRAFT Sprint 3 texts still OUTSTANDING | — | PAR with B–F | solicitor turnaround (days–weeks) | reviews are **HARD STOP (solicitor/clinician)** for real-client care use |
| H | Open-intake founder override — ruling recorded; allowlist retired (0054); INTAKE_COLLECTION_ENABLED=true; assignment stays off; collected-data disclosure queued for solicitor/clinician | KR (env+deploy clicks) + Code | 0054 applied; open-intake branch deployed | PAR | < 1 day | env change + deploy = **HARD STOP (KR)** — authorised 13 Sep |
| I | Appendix A intake rebuild — alignment note done; full specification next, then KR approval, then build | Orchestrator (spec) → KR (approve) → Code (build) | none for spec; build blocked on KR approval | PAR (spec) | spec days; build 2–4 weeks | build start = **HARD STOP (KR)** |

## What Code can close overnight (and largely has)
A (evidence), G (recording + RootFinder/BioHub softening), H (code, 0054,
docs; env/deploy clicks are KR's), I-alignment note, all test/bundle prep.

## What needs human/external input
PA tick-off (B); KR: merge, 0051, flag-on window, 0052, env/deploy clicks;
solicitor/clinician: DRAFT-text reviews, DailyPath + Synopsis/Body Story
MHRA reviews, disclosure of open-intake data; Orchestrator: Appendix A spec.

## Critical path
B → C → D → E → F (strictly sequential). G's solicitor/clinician reviews run
in parallel but gate REAL-CLIENT CARE use at the end.

## Longest pole
Solicitor/clinician review of the DRAFT texts (external turnaround) — start
it now; second-longest is the Appendix A specification + rebuild (I), which
is deliberately NOT on the Phase 3 critical path.

## Not Phase 3
The Appendix A intake rebuild itself (post-approval build), DailyPath and
Synopsis/Body Story MHRA remediation, pricing launch, payments/billing of
any kind, practitioner onboarding at scale, the profession/modality
activation gate (recorded future control).
