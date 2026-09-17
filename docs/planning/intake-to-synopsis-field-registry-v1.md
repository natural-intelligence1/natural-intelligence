# Intake-to-Synopsis Field Registry v1 (16 Sep 2026)

KR approved the Intake-to-Synopsis Field Mapping v1 and authorised this
build **as a branch-only product/structure build** — not a live
practitioner-data release. This document is the human-readable companion to
the code registry at `packages/db/src/intakeV2/fieldRegistry.ts`.

## 1. Approved architecture

| Source | Role |
|---|---|
| `account_profile` | Live identity source — asked ONCE at onboarding |
| `care_profile` | Live health/care context — asked only if missing |
| `case_snapshot` | Frozen point-in-time case context at submission (derived) |
| `intake_v2` | Client-reported factual health story |
| `practitioner_call_sheet` | Verification, missing details, safety acknowledgement, physical observations |
| `practitioner_analysis` | Separate manual Analysis & Plan area — practitioner-authored only |
| safety block | Derived ONLY from clinician-owned `safety_capture` metadata; raw answers displayed; no triage/risk/referral/test suggestion by NI |

Core product rule (the firewall): NI software collects, organises, stores,
displays back and structures facts. It does not diagnose, infer root cause,
rank likelihood, score risk, triage, recommend anything (products, amounts,
regimens, plans), pre-fill practitioner analysis, or provide clinical
decision support. Static safety text is allowed; safety answers are
surfaced for practitioner review only.

## 2. Ask-once model

- `profile.*` (legal name, preferred name, DOB, email, phone, address) and
  `care_profile.*` (sex, reproductive pathway, household, children,
  occupation, height, weight) are asked once, outside the intake.
- The intake shows them read-only on "Confirm your details" and never
  re-asks them (`v2ConfirmOnlyFields()`; enforced by test — no
  intake-sourced field may carry a `profile.`/`care_profile.` id).
- Email/phone/address are operational: `exportExcluded`, no synopsis
  destination, and the case-snapshot builder does not copy them into the
  practitioner-facing frozen profile.

## 3. case_snapshot model

Pure builder `buildCaseSnapshot()` (`caseSnapshot.ts`): freezes
`{ profile_frozen, care_profile_frozen, intake_frozen, submitted_at }` and
derives `age_derived` (whole years) and `bmi_derived` (number to 1 dp).
**Numbers only — no label, category, band or interpretation of either.**
The result is deep-frozen (point-in-time record cannot be rewritten).

**Persistence status: NOT persisted.** The current schema has no
`case_snapshot` table; per the approved decision the builder is pure and
NO migration was created or applied. If KR later authorises persistence, it
arrives as its own reviewed migration through the standing migration
process.

## 4. Field registry (summary)

384 fields across 18 domains, exact approved IDs
(`packages/db/src/intakeV2/fieldRegistry.ts`):

| Domain | Fields | Notes |
|---|---|---|
| identity (`profile.*`) | 6 | ask-once; 3 operational/export-excluded |
| care context (`care_profile.*`) | 7 | ask-once |
| case snapshot | 5 | derived |
| care in place | 14 | uploads placeholder-only |
| concerns | 14 | moderate depth; `missing_prompt` → call sheet |
| diagnoses | 8 | all attributed/reported; documents placeholder-only |
| medications | 11 | incl. `practitioner.medications.interaction_review` (call sheet only) |
| supplements | 11 | brand as written; never validated/promoted |
| family | 144 | 9 relatives × 16 categories; `mental_health` sensitive |
| early life | 12 | all skippable/"if known" |
| systems | 60 | 12 systems × 5 fields; `missing_prompt` → call sheet |
| reproductive | 19 | routed; all sensitive AND skippable; gentle wording |
| food | 25 | mode supports diary OR good/average/difficult day |
| lifestyle | 17 | incl. `faith_cultural_practices` (accommodation only) |
| timeline | 7 | suggestions only from client-entered facts, client-confirmed |
| observation | 7 | practitioner-only; photo = future module |
| safety | 6 | derived from clinician metadata only |
| analysis | 11 | practitioner-authored; empty by default |

Intake-writable fields (source `intake_v2`, not practitioner-only, not
derived): **328**. Every field carries label, domain, source, synopsis
destination (or explicit null), and the flags `askOnce / repeatable /
sensitive / skippable / practitionerOnly / derived / exportExcluded /
placeholderOnly / callSheet`.

## 5. Synopsis destinations (approved 13-section order)

`V2_SYNOPSIS_SECTIONS` — (1) Safety answers for practitioner review,
(2) Case snapshot, (3) Presenting concerns, (4) Diagnoses/investigations/
referrals (as reported), (5) Health timeline, (6) Medication & supplements,
(7) Family history, (8) Early life & past health, (9) Systems review,
(10) Physical observations, (11) Food, drink & kitchen reality,
(12) Lifestyle & environmental context, (13) Analysis & Plan — a SEPARATE
TAB. Tests pin the order and confirm every registry destination exists and
every section has fields.

## 6. Practitioner call-sheet destinations

`callSheet: true` fields: concern and per-system `missing_prompt`
(derived prompts — never conclusions), `practitioner.medications.
interaction_review`, all `practitioner.observation.*`, plus the existing
call-sheet scaffold (`callSheet.ts`) with its digging trees. Verification,
corrections and safety acknowledgement live practitioner-side.

## 7. Analysis & Plan firewall

All 11 `practitioner.analysis.*` fields are `practitionerOnly`, sourced
`practitioner_analysis`, land only on the separate tab, and are excluded
from `v2IntakeWritableFields()` (test-enforced). NI never pre-fills,
suggests or drafts them. **If any AI assistance is ever proposed for this
tab, work stops for Legal/MHRA review.**

## 8. Safety display model

- Title: “Safety answers for practitioner review”.
- Boundary text: “Natural Intelligence surfaces reported answers for
  practitioner review. It does not assess risk, rank urgency or make
  referral decisions.”
- Derivation: `deriveV2SafetyReviewItems()` intersects answers with the
  clinician-owned `safety_capture`/`safetyOptions` registry metadata only.
  Output fields are exactly: source question id, raw answer (verbatim,
  complete), matched options, captured-at, and a practitioner-owned review
  status starting `unreviewed` (test pins the exact key set — no rank,
  urgency, referral or triage concept can exist).
- Empty state: “No safety-review answers are currently available from the
  approved trigger set.”
- Pending referrals/investigations and allergies may surface here ONLY if
  clinician-approved metadata exists for them (none does today — so they
  do not).
- Gold, neutral, first in the synopsis. The practitioner adjudicates.

## 9. Provenance convention (global)

Four states: `client_reported / practitioner_verified / corrected /
missing` (`provenance.ts`, test-pinned). The original client answer is
preserved verbatim; `correctFact()` records the correction BESIDE it with
actor and time and can never overwrite the original (test-enforced).
Export rule: factual sections appear in export/print with provenance;
operational profile fields are excluded from practitioner export unless
explicitly authorised.

## 10. Sprint 3 live-data dependency (do not bypass)

Practitioner Synopsis V2 will eventually consume real client health data.
Live wiring must use the approved Sprint 3-compatible data-access model —
consent enforcement, the de-identification/review-pack boundary and the
`client_cases` access controls — and live rendering of real cases requires
clinician sign-off and KR authorisation. Until then both previews render
the synthetic fixture only (`apps/admin/.../preview/_careV2/fixtures.ts`).

## 11. Clinician / solicitor review items

1. Clinician: the `safety_capture`/`safetyOptions` trigger set (owned by
   the clinical team; the only source of safety surfacing).
2. Clinician: whether pending referrals/investigations and reported
   allergies should join the approved trigger set (metadata change, not
   code logic).
3. Clinician + solicitor: reproductive chapter wording (incl. the
   pregnancy-loss line), family mental-health why-we-ask, GP-contact
   permission wording.
4. Solicitor: export/print rule (operational-field exclusion) and the
   case-snapshot retention framing before any persistence migration.
5. Clinician sign-off required before ANY real case renders in Synopsis V2.

## 12. Not built / deferred (by decision)

- Uploads & documents: placeholder/spec only — storage, retention and
  legal handling not yet authorised; never auto-parsed.
- Observation photo capture: future module (storage/retention/legal first).
- `case_snapshot` DB persistence: no table, no migration — pure builder only.
- Live data wiring, assignment, practitioner access: separate authorised
  tasks (Sprint 3 model).
- Body map, food-photo capture: earlier deferred items, unchanged.
- 0052 remains locked; 0055 remains file-only.

## 13. Sign-off record (17 Sep 2026 — display-only; statuses change only through governance)

The same panel renders at the foot of both admin branch previews
(`/route-map/preview/intake-v2`, `/route-map/preview/synopsis-v2`). No
approval is collected through those pages; a status changes only when the
named party records it. Nothing below implies an approval that has not
been explicitly recorded.

| Party | Current status | Required sign-off |
|---|---|---|
| A. KR / Founder / Product Owner | **Not yet approved** | Intake flow and UX; synopsis structure and density; safety block placement/tone; ask-once/profile-confirmation model; food diary vs good/average/difficult-day UX; timeline centrepiece |
| B. Clinical Reviewer / Lead Practitioner Reviewer | **Not yet reviewed** | safety_capture trigger set; system symptom option sets; reproductive questions; family mental-health wording; missing-information prompts; practitioner call-sheet prompts; physical observation fields |
| C. Solicitor / Legal-Governance Reviewer | **Architecture approved — GREEN (18 Sep 2026)**; full wording review of the complete question set OUTSTANDING; seven controls required before live-data activation (see §14) | Approved: intake architecture; practitioner factual summary architecture; current SaMD/MHRA boundary; static safety model; practitioner-authored Analysis & Plan separation. Still to review: complete question-set wording (sensitive fields, GP-contact permission, export wording) |
| D. Data Protection / Governance | **Not yet reviewed** | Data minimisation; frozen case_snapshot scope; profile vs case data split; withdrawal/restriction behaviour; retention handling; audit trail |
| E. Technical / Code | **Built as synthetic branch preview only** | Evidence: branch `care-v2-preview-synthetic`; registry/mapping/preview commits with 55/55 intakeV2 tests, type-check/lint/build passing; controlled-language sweep clean (negations/attributed IDs only); no real or anonymised data; no assignment/0052/0055/pricing changes; no migrations; main and production untouched |

Status scales — A: Not yet approved → Approved for visual direction →
Approved for Code build → Approved for merge → Approved for live-data use.
B: Not yet reviewed → Reviewed with changes → Clinically approved for
synthetic preview → Clinically approved for live-data use. C: Not yet
reviewed → Reviewed with changes → Approved for synthetic preview →
Approved for live-data use. D: Not yet reviewed → Approved for internal
synthetic preview → Approved for live-data processing.

**F. Final release gate:** Not approved for live-data use until KR,
clinical reviewer, solicitor/legal-governance reviewer and technical
verifier have all signed off. Live-data wiring requires separate KR
authorisation and the approved Sprint 3-compatible data-access model.

## 14. Solicitor ruling — architecture approved (18 Sep 2026)

Recorded in `docs/governance/solicitor-rulings-2026-09.md`. Architecture
(intake, factual synopsis, SaMD/MHRA boundary, static safety model,
Analysis & Plan separation) is APPROVED — GREEN. **Seven controls are
required before live-data activation** — each becomes a build/process item
on the live-data gate, in addition to the Sprint 3 dependency in §10:

1. Field-purpose / lawful-basis / retention metadata on the field registry
   (extend `V2FieldDef` when the live-data task is authorised).
2. "Not continuously monitored" / emergency wording on client surfaces.
3. Safeguarding SOP (operational).
4. Summary provenance/audit metadata.
5. Student access/audit controls.
6. Practitioner-only Analysis & Plan enforced at the data layer.
7. Legal/MHRA change-control gate on changes to these surfaces.

Outstanding: full wording review of the complete question set —
architecture approval does not clear question copy for real-client use.
