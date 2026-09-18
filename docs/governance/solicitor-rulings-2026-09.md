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

## Ruling: Intake V2 + Practitioner Synopsis V2 architecture (18 Sep 2026)

**LEGAL SECOND PASS — GREEN.** **Architecture approved.**
**Live-data activation not yet approved.** (Relayed by KR; corrected
record 18 Sep 2026 — the ruling carries EIGHT mandatory implementation
controls, not seven as first recorded.)

Approved:
- Intake architecture (ask-once profile/care-profile, intake_v2 factual
  story, frozen case_snapshot model)
- Practitioner factual summary architecture (Synopsis V2, provenance model)
- Current SaMD/MHRA boundary (collect/organise/store/display/structure only)
- Static safety model (clinician-owned safety_capture metadata; raw answers
  surfaced for practitioner review; no assessment by NI)
- Practitioner-authored Analysis & Plan separation (separate tab, empty by
  default, never pre-filled)

**EIGHT mandatory implementation controls before activation** (each its own
gate item; none may be merged, skipped or traded off):

1. Field-purpose / data-minimisation metadata.
2. Clear "not continuously monitored / not for emergencies" wording.
3. Safeguarding / escalation SOP for serious information actually seen by NI.
4. Complete summary provenance / audit metadata.
5. Retention / deletion rules in the field registry.
6. Supervised/student access and audit controls.
7. Practitioner-only Analysis & Plan / sign-off.
8. Hard **LEGAL/MHRA REVIEW REQUIRED** change-control gate — its own
   governance gate, never combined with another control — before adding:
   confidence scores; NI-generated severity/risk scores; diagnostic or
   dysfunction labels; disease prediction; personalised red-flag triage;
   inferred causes/root causes; treatment recommendations; supplement
   recommendations; dosage guidance; ranked practitioner options;
   practitioner-facing clinical decision support; automated Analysis & Plan
   content; automatic care-plan generation; or claims that NI diagnoses,
   detects, predicts, treats, manages or recommends.

**Separate open legal-review item (NOT one of the eight controls):**
Full intake-question wording review outstanding — the exact wording of the
complete (~384-field) question set. Architecture approval does not clear
question copy for real-client use.

This ruling sits on top of, and does not relax, the standing Sprint 3
live-data dependency: consent enforcement, de-identification/review-pack
boundary and client_cases access controls remain required, as do clinician
sign-off and KR final authorisation, before any real case is processed or
rendered.

### Implementation record (18 Sep 2026, KR-authorised branch build)

The eight controls are implemented/modelled on branch
`care-v2-preview-synthetic` — full per-control status in
`docs/planning/intake-to-synopsis-field-registry-v1.md` §15. Code state
only: Article 6/9 bases and retention periods remain
`legal_review_required` / `retention_policy_pending` (nothing guessed);
the safeguarding SOP is DRAFT pending clinical + legal approval; student
and Analysis & Plan enforcement bind to the Sprint 3 live-data wiring.
The question-wording review pack for the separate outstanding item is at
`docs/legal/intake-v2-question-wording-review.md` (115 questions,
generated from the canonical registry). The solicitor-approved heading
“Safety-related information reported by client” is now in the code.
