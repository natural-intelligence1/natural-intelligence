# Solicitor Rulings — September 2026 (CQC · De-identification · MHRA/SaMD)

Recorded verbatim in substance from counsel's responses (12–13 Sep 2026).
These are standing constraints on product, copy and build order.

## CQC (approved position)

NI does not carry any regulated activity in its current operating model. NI
is presently designed to operate outside CQC registration. CQC is a
change-control boundary only: future professions, modalities, reserved
activities, clinical pathways or care-delivery changes must be reviewed for
CQC/regulatory implications — through governance and with solicitor review —
before activation, never activated first and assessed after.

## De-identification

Practitioner-facing outputs are PSEUDONYMOUS personal data unless
demonstrably anonymous — treat them under GDPR accordingly. NI retains
attribution and audit internally (the admin-only `review_pack_audit` table
in Sprint 3). GDPR duties (lawful basis, rights, security, minimisation)
remain in full for pseudonymous data.

## MHRA / SaMD

- **RootFinder** is outside SaMD only on the softened specification: broad
  educational symptom grouping ONLY. It must not show confidence figures,
  diagnosis, dysfunction/root-cause conclusions, protocol or treatment
  suggestions, prediction, or individualised triage. (Implemented 13 Sep:
  unranked alphabetical broad themes, display-layer theme labels, no
  confidence, no protocol links, boundary copy.)
- **BioHub** is outside SaMD only for extracting, organising and displaying
  the uploaded report's own values with the LABORATORY'S OWN reference
  intervals. NI-selected functional ranges are borderline and NOT cleared —
  they are held back from the self-serve display (implemented 13 Sep; the
  pipeline still stores them, display-gated pending review). Where a report
  carries no interval: "No laboratory interval found", never an NI
  substitute.
- **Claims change intended purpose.** Wording alone can bring a tool into
  SaMD scope.

### STOP / REVIEW triggers

Functional ranges · root-cause wording · confidence scores · protocol
suggestions · treatment guidance · dosage · risk scoring · red-flag triage ·
practitioner-facing clinical decision support. Any of these requires
Legal/MHRA review BEFORE build or enablement.

### Hard product rule

No NI self-serve health tool may infer, calculate, rank, predict, detect,
diagnose, monitor or assess disease/physiological dysfunction; determine
individual clinical risk/urgency; recommend/select treatment, supplements,
protocols or doses; generate personalised care plans; or provide
practitioner-facing clinical decision support — without Legal/MHRA review
before build or enablement.

The claims rule applies to: UI copy · output labels · scoring · knowledge-
base changes · prompts/system instructions · marketing · onboarding ·
pricing-page claims · practitioner-facing functionality.

## Held back pending Legal/MHRA review (flagged 13 Sep 2026)

- **DailyPath** (protocol library, protocol templates, adherence): protocol
  suggestion surfaces are a STOP trigger and were not covered by the
  RootFinder/BioHub ruling. Not changed; requires its own review.
- **AI Synopsis + Body Story pipelines**: AI-generated synthesis over intake,
  labs and pattern outputs — not covered by the ruling; system prompts still
  contain root-cause synthesis language. Requires its own review. (Runs on
  intake completion — noted in the open-intake founder ruling.)
- **BioHub functional-range display**: hidden from self-serve; any
  reinstatement (or practitioner-facing display) needs clearance.
