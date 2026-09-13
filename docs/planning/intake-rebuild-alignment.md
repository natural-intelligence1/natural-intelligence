# Intake Rebuild Alignment Note — Appendix A vs Current Intake

Prepared 13 September 2026 against Appendix A
(`ni-intake-build-instruction.md`, copied alongside this note). This is an
ALIGNMENT NOTE ONLY — nothing from Appendix A was built. Build begins only
after the specification (Appendix A §7 deliverables) is produced and KR
approves it.

## 1. What Appendix A requires (summary)

One question at a time or tight groups; progressive disclosure (detail only
when warranted); mobile-first; save on every step with resume; honest
progress with time estimates; every non-essential question skippable;
inline "why we ask"; the client's own words FIRST, checkboxes after; visual
components (body map, unlabelled stool illustrations, draggable timeline,
photo food diary, visual frequency scales); warmth and lay language written
fresh in NI's voice (no external form wording); the FULL naturopathic
case-history domain inventory (§3 A–M: identity/context, existing medical
care + GP-contact consent, granular independently-withdrawable consents,
medication, supplements, family history, tests/diagnoses + upload, the
presenting concern in their own words, early life history, all twelve body
systems, food (3-day photo diary, frequencies, drinks, kitchen reality),
life/lifestyle, and a practitioner-entered-only physical observation layer);
Layer 3 (all clinical interpretation) is practitioner-only behind the LRP
gate — never automated.

## 2. Current intake vs Appendix A

**Already captured (partially):** arrival emotion; primary concerns
(chips + free text); primary system; stress/sleep/energy scales; diet
description (one free-text field); medications, supplements, diagnosed
conditions (single free-text/list fields); symptom onset + timeline
last-well/trigger; some branched section-2 detail per primary system; cycle
patterns (hormonal branch); best-self baseline; most-want-to-understand;
post-exertional worsening + concern severity (intake_answers); biological
sex/religion via personalisation.

**Missing entirely:** identity/context block (DOB, address, relationship,
children, occupation, height/weight, how they found NI); GP details and the
GP-contact consent; granular consent-at-start (Sprint 3 has the model — the
current form has one AI tick at the END); per-item structured medication/
supplement capture (dose, since-when, who advised, topicals); family health
history; recent tests + report upload inside intake; early life/past health;
most of the twelve body systems at Appendix A depth (urinary, breathing,
heart, skin, immune, musculoskeletal are absent or token); the 3-day photo
food diary, frequency grids, drinks quantities, kitchen reality; life
section (exercise detail, smoking, drugs, caring, faith/fasting practices —
religion is captured but not routine impact); read-back/edit/export/delete;
practitioner consultation layer (Layer 2).

**Asked badly today (per Appendix A standards):** six long wall-of-fields
sections rather than one-question-at-a-time; consent at the end, not the
start; free-text single boxes where structured per-item capture is needed;
"high/medium/low"-style scales instead of visual ones; no save-on-every-step
guarantee (section-level saves only); no skip affordances or "why we ask";
desktop-shaped forms.

**Stored where today:** `intake_responses` (one wide row per member),
`intake_answers` (+`intake_sessions`) keyed by question_key, personalisation
in `user_personalisation`; completion consent fields sit ON
`intake_responses`; AI outputs in `ai_summaries`/reasoning tables.

**Migration/discard strategy (position, §4 below).**

## 3. SaMD check

Appendix A's own §2 matches counsel's ruling exactly. The rebuilt intake may
only COLLECT · ORGANISE · STORE · DISPLAY BACK · STRUCTURE FOR PRACTITIONER.
It must not score, infer, rank, predict, diagnose, identify root causes,
suggest protocols, recommend supplements/diet/treatment, or triage
individual risk — and the language ban applies to all copy, labels, help
text, onboarding, emails and system prompts. **Current-intake gaps against
this bar (to fix in the rebuild, softened where display-facing on 13 Sep):**
the completion pipeline feeds AI synthesis (held for review); branching is
fine (progressive disclosure ≠ inference) but any future branch must never
surface a mechanism/cause label; static safety information is permitted and
should be added (emergency wording exists at intake-unavailable state only).

## 4. Data migration position

- Existing `intake_responses`/`intake_answers` records CANNOT be cleanly
  migrated into the Appendix A model — the old capture is too coarse
  (single free-text boxes vs per-item structures; missing domains). Forcing
  them in would fabricate structure the client never gave.
- **Recommended position:** keep existing records as READ-ONLY LEGACY intake
  (visible to the member as their own record and to a future practitioner
  view as "legacy intake, pre-rebuild"), version the new schema from day one
  (`intake_version` on every record; legacy = v1, Appendix A build = v2),
  and invite existing members to complete the new intake rather than
  auto-migrating. Partial old records remain read-only; nothing is silently
  discarded (deletion only via the rights channel).
- New schema must version records explicitly so a future v3 never repeats
  this problem.

## 5. Future build sequence (for KR approval — not started)

1. Specification (Appendix A §7: section/question map, question copy,
   conditional logic, visual component spec, mobile wireframes, save/resume
   behaviour, consent screens, data model, SaMD compliance statement,
   build handoff) — Orchestrator; KR approves.
2. Data model + versioning migration (v2 tables/columns; legacy v1 frozen).
3. Consent-at-start implementation (aligned with Sprint 3 consent model —
   same purposes + GP-contact consent added as a new purpose).
4. Section map + progressive logic engine.
5. Question copy (fresh, NI voice, UK English) — clinician sanity pass.
6. Visual components (body map, stool illustrations, timeline, frequency
   scales) — design pass.
7. Save/resume on every step; skip/return affordances; progress truth.
8. Uploads (test reports, food photos) with storage/retention rules.
9. Read-back/edit/export/delete surface (client); organised case view
   (practitioner, Layer 2 entry, behind LRP gate).
10. Testing (unit, RLS, mobile), clinician + solicitor review of the built
    form, KR sign-off, staged rollout, legacy-intake read-only cutover.

Assumptions flagged: GP-contact consent becomes an eighth consent purpose;
the practitioner Layer 2 view lands with/after Sprint 3's LRP gate work;
photo uploads need a storage/retention decision before build step 8.
