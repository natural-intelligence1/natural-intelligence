# Intake V2 — Copyright-Clean Build Plan & Synthesis (14 Sep 2026)

Product framing: **NI Pre-Consultation Health Intake** — a guided
pre-consultation intake that gathers the client's factual health story,
organises it cleanly, and prepares the practitioner to take a better case.
Not a full clinical consultation; the full case is completed through the
practitioner call sheet and practitioner verification.

## 1. Existing build inventory (audited) and what is reused

| Existing work | Status | V2 treatment |
|---|---|---|
| Screen 1 consent gate (`IntakeConsentGate`, s3-draft-2 texts, pathway separation, withdrawal scope) | live | **Reused unchanged** — V2 imports the same component; no health answer saves before it passes |
| Consent enforcement (`hasAllConsents` fail-closed, REQUIRED_INTAKE_CONSENTS) | live | **Reused** in every V2 server action (guard order: collection flag → V2 flag → auth → consents) |
| Privacy & Data Controls + rights/withdrawal channel | live | untouched; linked from Screen 1 as before |
| Collection kill-switch (`INTAKE_COLLECTION_ENABLED`) | live | **Still governs V2** — V2 additionally needs its own flag |
| Assignment-off containment (`INTAKE_ASSIGNMENT_ENABLED`, routing consent gate) | live | untouched; V2 submission calls no routing, creates no cases/work |
| `intake_sessions` / `intake_answers` tables + upsert-per-answer write path | live | **Reused as storage** — zero schema change (see §5) |
| V1 intake route/form | live | **Untouched** — V2 lives at `/dashboard/intake-v2` behind `INTAKE_V2_ENABLED` (default OFF → 404) |
| SaMD softening (RootFinder/BioHub) | live | untouched |

## 2. What the current (V1) intake lacks — closed by V2

Identity/context block; GP details with a separate GP-contact permission;
structured per-item medication/supplement capture (dose-as-written, who
suggested it, topical vs oral); family history; early life; ten of the
twelve body systems at screening depth; respectful reproductive routing;
food diary/frequency/kitchen-reality/drinks; lifestyle incl. faith and
cultural practices; timeline; a read-back review before submission; skip-
and-return; one-group-per-screen mobile-first UX; honest time estimates.

## 3. V2 domain map

29 sections (`V2_SECTIONS`), 90+ registered questions (`V2_QUESTIONS`), all
original NI wording: arrival → about → care in place → concerns (own words
FIRST) → medical history → medication → supplements → family → early life →
systems overview → per-system screens (digestion, nervous, sleep,
mood/stress, energy/metabolic, reproductive [routed by pathway], immune,
breathing, urinary, heart, muscles/joints, skin) → food diary → food
frequency → eating habits/kitchen → drinks → lifestyle → timeline → review.
System detail screens appear ONLY when that system is selected in the
overview (progressive disclosure); typical path ≈ 10–15 minutes by the
per-section estimates shown to the user.

## 4. Practitioner call-sheet boundary

`callSheet.ts` is an INTERNAL scaffold only — no route, no practitioner
exposure. It maps positive client selections to symptom-specific original
digging trees (bloating, reflux, headache, dizziness, fatigue, joint pain,
urinary frequency, chest-pain safety capture, reproductive concern) plus a
factual shared frame. The `CallSheetEntry` shape keeps the client answer
immutable, records practitioner corrections ALONGSIDE it with
verification status, actor and timestamp, and flags missing information —
never clinical significance. All analysis and planning stay human.

## 5. Data strategy (no migration required)

- Sessions: `intake_sessions` rows with `current_section` prefixed `v2` —
  a V2 session can never collide with or complete a legacy V1 session.
- Answers: `intake_answers` upserts keyed `(session_id, question_id)` with
  `question_id` prefixed `v2.` and `section_id` `v2_<section>`; the answer
  JSON carries `{ value, v: <question version> }`.
- The question registry is the versioned source of truth: stable ids, a
  version per question, SaMD classification, service-path relevance,
  practitioner-view and summary mappings, conditional logic.
- Existing records: V1 rows are untouched, uncounted-in, and remain
  legacy-readable. No auto-migration, no transformation. Users with
  partial V1 records can simply be invited into V2 when it opens.
- No migration files were needed or created for V2.

## 6. SaMD / legal boundary (statement)

V2 collects, organises, stores, displays back and structures for a
practitioner — nothing else. There is no scoring, inference, ranking,
prediction, diagnosis, detection, triage, recommendation, plan generation
or decision support anywhere in the module; the registry test suite
enforces a banned-terms list over ALL user-facing copy and the call-sheet
prompts. Safety-relevant options are enumerated per question
(`safetyOptions`) and surface only as internal review structure
(`hasSafetyCaptureAnswers`, `V2SafetyCapture` labels); the client sees only
STATIC safety wording (111/GP/999), never a conditional risk output. The
mood section's sensitive question is skippable, explained, and paired with
static support lines only. Screen 1 legal flow is reused verbatim,
including the submission wording.

## 7. Phased plan (status)

0. Audit existing build — DONE (this doc §1).
1. Synthesis doc — DONE (this doc).
2. Question registry + validation tests — DONE (17 tests).
3. Flagged V2 client UI (`/dashboard/intake-v2`, `INTAKE_V2_ENABLED`) — DONE.
4. Storage — DONE via existing tables; no migration.
5. Practitioner call-sheet scaffold — DONE (module only, no exposure).
6. Tests/build — DONE (see test report). Screenshots pending an
   authenticated preview window (route is flag-gated + login-gated).

## 8. Risks

- The V2 UI ships flag-off; turning it on is a KR decision and should come
  with a walkthrough (screenshots/preview) first.
- Photo upload for the food diary and a tap-based body map are NOT in this
  pass (kept out to avoid new storage surface without a retention
  decision) — listed for KR as follow-ups.
- V1 remains the live intake until KR approves switchover; running both
  flags on simultaneously presents two intakes — the switchover plan
  (below) avoids that.

## 9. Items needing KR review

1. Walkthrough + approval of question copy and flow feel.
2. Switch-on decision: set `INTAKE_V2_ENABLED=true` and (separately)
   whether V1's route should then redirect to V2 or remain.
3. Food-photo upload + body map: approve as follow-up (needs
   storage/retention decision).
4. Practitioner call-sheet UI (the scaffold's surface) — belongs with the
   practitioner-workspace/LRP work, gated on 0052-era decisions.
5. Solicitor/clinician: review V2 question copy (especially reproductive,
   mood safety question, GP-contact permission wording) as part of the
   standing DRAFT-text review.
