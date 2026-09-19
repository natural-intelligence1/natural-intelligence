# Sprint 4 — Practitioner Onboarding & Credentialing (19 Sep 2026)

Goal: a practitioner can be admitted, classified, credential-captured,
admin-verified and OBJECTIVELY determined eligible or ineligible for case
assignment, through ONE authoritative path. Capture ≠ verification.

Sprint 5 (data-access hardening / de-identification) and Sprint 6 (Care
Team live wiring) are NOT started. 0052 remains locked; 0046/0048 access
rules untouched; 0055 untouched.

## Reused architecture (no parallel practitioner system)

| Existing | Sprint 4 use |
|---|---|
| `practitioners.category` (0051) | The three classes: `regulated_clinician` = Regulated Healthcare Professional · `voluntary_registered` = Accredited Practitioner · `unregistered` = NI Verified Practitioner. No student class — student/trainee is the supervised training status in the intakeV2 governance guards. |
| Lifecycle `status` (0034) | pending_review → approved → active → suspended → archived; eligibility requires `active` + `is_active`. |
| 0051 agreement machinery | Immutable versions, one current per class (partial unique index + immutability trigger), RPC-only acceptance, id+version+sha256-exact-text verification. Consumed unchanged; ready for the three real documents (being prepared separately — wording NOT invented; synthetic versions in tests only). |
| 0051 credential capture | insurance provider/policy/expiry, registration body/number, dbs_status, dbs_checked_at. |
| `primary_professions` | Modality display set maps onto it (16 modalities recorded in `SPRINT4_MODALITIES`); class is never inferred from modality. |
| `case_practitioner_work` + `client_practitioner_links` | The two assignment surfaces the gate protects. |

## New (migration 0056 — FILE ONLY, NOT APPLIED)

`supabase/migrations/0056_practitioner_credentialing_gate.sql`:

- practitioners: `registration_status`, `insurance_evidence_ref`,
  `qualification_evidence_ref`, `credentials_verification_status`
  (unverified/verified/rejected, default unverified) + verified_by/at,
  `indemnity_required` (default true), `scope_of_practice`,
  `scope_status` (none/submitted/approved/revoked) + approved_by/at; DBS
  CHECK extended with `required` ('clear' remains the verified-good state).
- `practitioner_has_current_acceptance(uuid)` — the 0051 gate check for an
  arbitrary practitioner (current agreement for their class, matching
  version AND sha256 of the exact current body).
- **`practitioner_assignment_eligibility(uuid)`** — THE authoritative
  function: fail-closed named reasons for lifecycle, class, agreement,
  credential verification, indemnity (missing OR expired — hard control),
  registration currency (registered classes), DBS, scope.
- **BEFORE INSERT triggers** on `case_practitioner_work` AND
  `client_practitioner_links` → `RAISE EXCEPTION 'practitioner not
  assignable: …'`. Triggers fire for every role including service_role —
  the UI cannot bypass this, and neither can any server code.
- Post-apply assertions + revert block documented in the file.

## One eligibility path (no duplicated UI logic)

- DB: the 0056 function + triggers (authoritative).
- Server: `assertPractitionerAssignable` (packages/db credentialing) is
  called by `assignWork` (and therefore `assignCaseForReview` /
  `routeIntakeAssignment`) and `createClientPractitionerLink` — it
  surfaces the named reasons; pre-0056 it is a no-op so current
  (assignment-flag-off) behaviour is unchanged and the trigger remains the
  gate from the moment 0056 applies.
- Admin UI: the practitioner detail page's new Credentialing panel shows
  the RPC verdict verbatim; it never computes its own.
- Pure mirror `evaluatePractitionerEligibility` exists for tests/display
  only.

## Negative test matrix (A–F)

Pure layer (always runs — PASSING): A no acceptance · B/C obsolete
version / hash mismatch (collapse to the same fail-closed acceptance
check; exercised separately at DB level) · D unverified · E indemnity
expired AND missing (plus the not-required exemption) · F fully eligible
passes · lifecycle/class/registration/DBS/scope each refuse independently.

DB layer (ARMED, self-skipping until 0056 is applied — the 0051-armed
pattern): A/D fresh practitioner refused by the trigger · E everything
valid EXCEPT expired indemnity → INSERT refused with `indemnity_expired`
(the closure-gate proof) · B superseded version refused · C wrong text
hash refused · F fully eligible synthetic practitioner insert SUCCEEDS,
then cleaned up. Verified against the live DB pre-0056: the suite
self-skips cleanly (gate probe).

## Closure status — SPRINT 4 CLOSED (19 Sep 2026)

KR authorised and 0056 was applied to the shared Supabase project
(yftxzvdrxnhwpcnsrktn) at 2026-09-19 ~19:57 UTC. Post-apply assertions
1-4 passed by SQL (A1 unknown-id refusal; A4 existing rows untouched,
INSERT-only triggers); assertion 5 = the armed suite: **14/14 PASSED**
against the live database — A no-acceptance refused, B superseded
version refused, C wrong hash refused, D unverified refused, **E expired
required indemnity refused by the BEFORE INSERT trigger (the closure
proof)**, F fully eligible synthetic practitioner succeeded, and BOTH
surfaces (case_practitioner_work AND client_practitioner_links) refuse
ineligible inserts. All synthetic rows (users, practitioner, case, work,
acceptances, the synthetic test agreement) deleted; baseline restored
(3 pre-existing work rows untouched).

## Outstanding externally

- The three real practitioner agreement documents (solicitor) — the 0051
  machinery consumes them as new versions without redesign; every
  practitioner then re-accepts (version+hash gate).
- KR authorisation to apply 0056.
