# Sprint 5 — Practitioner Data-Access / De-identification (19 Sep 2026)

Principle enforced throughout: application-layer controls do not count as
the security gate — every critical assertion below is proven at the
database/RLS/RPC layer, with synthetic records through the REAL
pack-generation path. No real client data.

## 1. Precondition map (verified live before any change)

- **0051 APPLIED** (migration history `20260913061409`); its objects
  verified live: pack tables + policies ("Practitioners read packs for
  their work" active-statuses-only; audit table admin-only),
  `withdraw_own_consent`, `accept_current_agreement` /
  `has_accepted_current_agreement`, consent purpose constraints.
- **0052 LOCKED/UNAPPLIED**, and the live schema matches exactly what it
  expects to change: the five 0048 `practitioners_read_assigned_client`
  SELECT policies exist on intake_responses, intake_answers,
  biomarker_results, biomarker_trajectory, lab_reports; the 0046
  `case_practitioner_select` policy exists on client_cases; BOTH
  owner-rights views (`practitioner_client_identity`,
  `practitioner_client_personalisation`) still carry the practitioner
  work-history branch; `practitioner_case_index` does not exist yet.
- Consent gate: `assertSynopsisSharingPermitted` — fail-closed
  `hasActiveConsent('deidentified_synopsis_sharing')` +
  `isProcessingBlocked` (restriction / erasure / withdrawal).
- Pack-mode flag: `PRACTITIONER_REVIEW_PACKS_ENABLED` (default OFF, exact
  'true'), read by the workspace page, reasoning page and inbox.
- Practitioner read paths (repo-wide): every identified read in the care
  app lives in ONE file — `cases/[caseId]/work/[workId]/page.tsx` — and
  every one sits BELOW the pack-mode early return.

## 2. Pack-mode controlled test (flag-on in the TEST PROCESS only — no env
   or real-client change): `packModeE2E.test.ts`, 5/5 live

Synthetic member (consent seeded) + 0056-eligible synthetic practitioner
with an ACTIVE work item; RICH synthetic intake salted with
quasi-identifiers; then the REAL `generateAndStoreReviewPack`:

- generation reads the identified intake server-side (service role), only
  AFTER the fail-closed consent gate;
- default-deny de-identifier runs (suppressedCount > 0; narrative fields
  absent as keys);
- stored output is the de-identified pack (safe columns only);
- audit row written on admin-only `review_pack_audit` (source linkage,
  suppressed/transformed fields, generated_by);
- regeneration → version 2, version 1 byte-untouched (never edited);
- consent withdrawal via the member's own `withdraw_own_consent` RPC →
  further generation throws Blocked;
- practitioner retrieves via RLS (`getReviewPackForCase`); a stranger
  practitioner gets nothing.

## 3. Raw-intake fallback audit — NONE FOUND

- Workspace page: pack mode early-returns; missing pack → explicit
  blocked state in `ReviewPackWorkView` (renders props only; fetches
  nothing); comment and behaviour agree: no fallback.
- Reasoning page: pack mode 404s without active work and shows an
  explicit unavailable state instead of the trace (trace is generated
  from identified intake and is not pack-safe — correctly withheld).
- Inbox (`listWorkForInbox`): pack mode lists active work only,
  de-identified.
- The identified reads below the flag are the LEGACY MODE (not a
  fallback — pack-missing never routes to them), and they die at the DB
  layer the moment 0052 drops the 0048/0046 policies (0052's own note
  marks the helpers dead code in the same window).

## 4. Adversarial de-identification review — PASSED, with findings

Salt planted across every field class (name, email, phone, occupation
"lighthouse keeper on Flat Holm island", household composition, location
+ postcode, rare event, named clinician + practice, date, upload
filename, unique fact combinations). Assertions prove NONE of it — nor
any distinctive fragment — appears in the stored practitioner-readable
pack. Mechanism: allow-list by TYPE AND SHAPE (numbers/booleans checked
by primitive type; enum-expected strings and tag lists pass through the
≤3-word/≤30-char token rule; med/supplement/condition lists reduced to
≤4-word/≤40-char items with identifier-scrub, else '[item withheld]');
ALL prose narrative (diet description, timelines, most-want-to-
understand, Best Self) suppressed outright; anything unlisted suppressed.

Quasi-identifiers that CAN remain, by design (documented for the
solicitor's pseudonymity position — the pack is pseudonymous personal
data, never claimed anonymous): short concern tokens (e.g. "fatigue"),
1–5 scores, short duration phrases ("about two years ago"), short
medication/supplement names, the pseudonym itself. Combination risk is
bounded by the token caps; free text that cannot be safely reduced is
default-denied rather than shipped. No AI interpretation anywhere.

## 5. 0052 pre-apply assessment — READY

Read against the live schema: it (a) NARROWS legacy access by DROPPING
the five 0048 policies and the 0046 policy (not layering over them);
(b) touches no unrelated table; (c) preserves member-own, admin and
service-role operations (member/admin policies untouched; service role
bypasses RLS); (d) replaces identified surfaces with the column-scoped
active-only `practitioner_case_index` view and removes the practitioner
branch from both identity/personalisation views (self + admin only);
(e) exactly supports pack-only practitioner access. Six armed negative
tests already sit in `rls/negative.test.ts` waiting to prove it
post-apply, plus five post-apply assertions in the migration file.

## 6. Founder hard stop — status

A. 0051 applied + assertions verified live ✅
B. Pack mode tested flag-on (real generation, controlled test env) ✅
C. No raw-intake fallback remains ✅
D. Synthetic generated pack passes adversarial de-identification ✅

**READY FOR KR 0052 AUTHORISATION.** 0052 remains locked; steps 7–9
(apply, 0046/0048 narrowing, post-apply attack tests) await KR's separate
authorisation. Fixture note: work-item fixtures now require 0056-eligible
synthetic practitioners (`makePractitionerAssignable` helper) — Sprint 4
and 5 test layers compose.

## 7. SPRINT 5 CLOSED (19 Sep 2026)

KR founder authorisation received; **0052 APPLIED** to the shared Supabase
project (yftxzvdrxnhwpcnsrktn) — file byte-identical to the reviewed
version (sha256 814369754906b2b7…, last commit 10acbd8), applied after
0056 in the migration history. Results, all proven at the DB layer:

- **Five in-migration assertions PASS** by live inspection: client_cases
  SELECT policies = `client_cases_member_select` only; the case-index
  view exposes exactly id/status/case_complexity_score/
  escalation_required/created_at (no client_id, no primary_concern);
  active-only status list with no 'completed'; both identity/
  personalisation views self-or-admin with no work-history branch.
- **LEGACY ACCESS PROVABLY GONE**: zero `practitioners_read_assigned_client`
  policies remain (was 5); zero `case_practitioner_select` on
  client_cases (was 1). Not layered over — dropped.
- **Six armed 0052 tests ran with ZERO skips and passed**, plus the new
  post-0052 ATTACK MATRIX (rls/attack0052.test.ts) A–J all passed with
  real DB identities: active-work practitioner gets zero rows from every
  raw source table and from profiles/identity/personalisation views and
  client_cases; cross-member pack unreadable; cancelled work removes pack
  AND case-index access; withdrawal blocks regeneration; anonymous reads
  nothing anywhere; admin/service and member-self access intact; positive
  control — active work grants ONLY the pack + the five-column case index.
- **Pack-mode re-verified post-apply**: packModeE2E 5/5 again (generation,
  adversarial de-id, RLS retrieval, immutable regeneration, withdrawal).
- **Cleanup verified by SQL**: work rows at the pre-existing baseline 3,
  0 synthetic cases/packs/audits/agreements/acceptances/users/intakes.
  No real client content read, modified, printed or logged.

0055 remains unapplied. Sprint 6 (Care Team live wiring) NOT started.
