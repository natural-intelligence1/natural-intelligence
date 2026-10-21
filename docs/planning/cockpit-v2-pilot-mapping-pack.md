# Pilot Mapping Review Pack — Consultation Cockpit V2

**GENERATED FROM CODE.** Produced by `packages/db/src/cockpit/__genpack.ts` from the live
`PILOT_MAPPING_PACK`, so it cannot drift from what the cockpit actually does. Regenerate rather
than edit by hand.

Pilot domains: Digestion · Energy, hormones & metabolism · Sleep

## 1. The gate

| | |
|---|---|
| Pilot questions | 6 |
| Mapping entries | 6 (every pilot question covered) |
| **APPROVED** | **0** |
| NEEDS_REVIEW | 3 |
| CANDIDATE | 0 |
| UNMAPPED | 3 |
| REJECTED | 0 |
| **Canonical writes permitted** | **NONE — all blocked** |

No canonical persistence occurs until a mapping reaches APPROVED. `canPersistCanonically()` is
the single gate; it has no override argument.

## 2. Read this before approving anything

### Question → Concept is many-to-one

All three mapped questions resolve to the SAME concept `intake.systems.*.symptoms`. The concept
layer collapses the enumerated `system` dimension to `*`, so Digestion, Sleep and Energy share
one concept and are distinguished only by its VARIANT. Anything downstream that groups by
concept and ignores the variant would merge three body systems into one. The FIELD ids stay
distinct, so the canonical destination is unambiguous — it is the concept layer that is lossy.

### Section ids and system keys do not match

| Intake section | Field-registry system key | Same? |
|---|---|---|
| `digestion` | `digestive` | no |
| `sleep` | `sleep` | yes |
| `energy_metabolic` | `energy_endocrine` | no |

Two of three differ, and "metabolism" and "endocrine" are not synonyms. Every mapping crossing
this boundary carries a rationale for that reason.

## 3. The entries

### `v2.digestion.noticed` — NEEDS_REVIEW

- **Section** — digestion (Digestion)
- **Concept** — `intake.systems.*.symptoms`
- **Canonical field(s)** — `intake.systems.digestive.symptoms`
- **Capture owner** — client
- **Provenance** — client_reported, or practitioner_verified once confirmed in consultation
- **Write rule** — Selected chips are stored as a value list, verbatim. Red-flag selections ALSO raise a safety review item; they are never removed from, or re-worded inside, the stored list. "None of these" writes intake.systems.digestive.none_reported instead, and must not be stored as a symptom.
- **Proposed by** — explicit_registry_metadata
- **Rationale** — Section "digestion" maps to system key "digestive" — the names differ, so this crosses the boundary described in pilot.ts and should be confirmed rather than assumed. The field is also the right destination for the red-flag options, which carry clinical weight: a reviewer should confirm that storing them in the ordinary symptom list, with the safety item raised alongside, is what NI intends.
- **Gap** — Awaiting Founder approval. No canonical write until APPROVED.

### `v2.digestion.bowel_frequency` — UNMAPPED

- **Section** — digestion (Digestion)
- **Concept** — _none — no destination field to resolve one from_
- **Canonical field(s)** — _none_
- **Capture owner** — client
- **Provenance** — client_reported
- **Proposed by** — none
- **Rationale** — intake.systems.digestive.frequency is "how often (light)" — how often the SYMPTOM occurs. How often the bowels open is a different quantity with a different option set. Writing one into the other would corrupt both readings, so no candidate is proposed.
- **Gap** — Needs a new canonical field, e.g. a digestive bowel-habit frequency. Registry decision.

### `v2.digestion.stool_form` — UNMAPPED

- **Section** — digestion (Digestion)
- **Concept** — _none — no destination field to resolve one from_
- **Canonical field(s)** — _none_
- **Capture owner** — client
- **Provenance** — client_reported
- **Proposed by** — none
- **Rationale** — No stool-form field exists anywhere in the registry, and none of the systems bundle fields carries an ordinal scale. There is nothing to map to.
- **Gap** — Needs a new canonical field for stool form. Registry decision.

### `v2.energy.noticed` — NEEDS_REVIEW

- **Section** — energy_metabolic (Energy, hormones & metabolism)
- **Concept** — `intake.systems.*.symptoms`
- **Canonical field(s)** — `intake.systems.energy_endocrine.symptoms`
- **Capture owner** — client
- **Provenance** — client_reported, or practitioner_verified once confirmed in consultation
- **Write rule** — As for digestion: verbatim value list; "None of these" writes .none_reported; red-flag selections also raise a safety item without altering the stored list.
- **Proposed by** — explicit_registry_metadata
- **Rationale** — Section "energy_metabolic" maps to system key "energy_endocrine" — the names differ substantially, and "metabolism" and "endocrine" are not synonyms. This is the least obvious of the three translations and most needs a human decision.
- **Gap** — Awaiting Founder approval. No canonical write until APPROVED.

### `v2.sleep.noticed` — NEEDS_REVIEW

- **Section** — sleep (Sleep)
- **Concept** — `intake.systems.*.symptoms`
- **Canonical field(s)** — `intake.systems.sleep.symptoms`
- **Capture owner** — client
- **Provenance** — client_reported, or practitioner_verified once confirmed in consultation
- **Write rule** — As for digestion. Note the two night-sweats options are distinct values — "Night sweats" and "Night sweats that soak the bedding" — and only the second is an approved red flag. They must not be merged.
- **Proposed by** — explicit_registry_metadata
- **Rationale** — Section and system key agree here ("sleep"), so the destination is not in doubt. It is NEEDS_REVIEW rather than CANDIDATE because of the night-sweats distinction: a mapping that collapsed the two values would destroy the red flag.

### `v2.sleep.hours` — UNMAPPED

- **Section** — sleep (Sleep)
- **Concept** — _none — no destination field to resolve one from_
- **Canonical field(s)** — _none_
- **Capture owner** — client
- **Provenance** — client_reported
- **Proposed by** — none
- **Rationale** — No sleep-duration field exists. intake.systems.sleep.frequency is symptom frequency, not hours slept, and the banded options ("Under 5", "It varies wildly") do not fit it.
- **Gap** — Needs a new canonical field for typical sleep duration. Registry decision.

## 4. Questions needing a NEW canonical field

These were left UNMAPPED rather than force-fitted into a field that means something else.
Each needs a registry decision, which is not a mapping decision.

- **`v2.digestion.bowel_frequency`** — Needs a new canonical field, e.g. a digestive bowel-habit frequency. Registry decision.
  - intake.systems.digestive.frequency is "how often (light)" — how often the SYMPTOM occurs. How often the bowels open is a different quantity with a different option set. Writing one into the other would corrupt both readings, so no candidate is proposed.
- **`v2.digestion.stool_form`** — Needs a new canonical field for stool form. Registry decision.
  - No stool-form field exists anywhere in the registry, and none of the systems bundle fields carries an ordinal scale. There is nothing to map to.
- **`v2.sleep.hours`** — Needs a new canonical field for typical sleep duration. Registry decision.
  - No sleep-duration field exists. intake.systems.sleep.frequency is symptom frequency, not hours slept, and the banded options ("Under 5", "It varies wildly") do not fit it.

## 5. Digging edges (explicit, not derived from showIf)

5 edges · 4 safety-linked · 14 targets
(2 reuse an approved registry question, 12 are
practitioner prompts) · 0 targets have a canonical destination.

### `dig.digestion.bowel_habit_change`

- **Source** — `v2.digestion.noticed`
- **Trigger (verbatim approved options)** — “A change in your usual bowel habit”
- **Safety linked** — true
- **Review status** — needs_human_review
- **Version** — `cockpit-digging.v1-pilot` · **Source of content** — ni_pilot_draft
- **Rationale** — A change in usual bowel habit is an approved red-flag option. The branch gathers the factual detail a reviewer needs; it does not assess what the change means.
- **Targets**
  1. prompt: “Ask when the change began, and what it changed from and to.”
     - required: true · counts towards sufficiency: true
     - unsure: record_unsure_and_flag_clarification
     - canonical field(s): none
     - When it started and what changed are the two facts a reviewing clinician will ask for first.
  2. registry question `v2.digestion.bowel_frequency`
     - required: true · counts towards sufficiency: true
     - unsure: record_unsure_and_continue
     - canonical field(s): none
     - An approved question already asks this. Reuse it rather than invent a prompt.
  3. registry question `v2.digestion.stool_form`
     - required: false · counts towards sufficiency: true
     - unsure: record_unsure_and_continue
     - canonical field(s): none
  4. prompt: “Ask whether anything else changed at the same time — diet, medicines, travel, stress.”
     - required: false · counts towards sufficiency: false
     - unsure: record_unsure_and_continue
     - canonical field(s): none
     - Context, not sufficiency. Useful but its absence should not hold the branch open.

### `dig.digestion.blood_in_stool`

- **Source** — `v2.digestion.noticed`
- **Trigger (verbatim approved options)** — “Blood in the stool” OR “Black, tar-like stool”
- **Safety linked** — true
- **Review status** — needs_human_review
- **Version** — `cockpit-digging.v1-pilot` · **Source of content** — ni_pilot_draft
- **Rationale** — Both trigger values are approved red flags. Digging gathers detail for the human review that is already open; it never substitutes for it and cannot close it.
- **Targets**
  1. prompt: “Ask how long it has been happening, and whether it is still happening now.”
     - required: true · counts towards sufficiency: true
     - unsure: record_unsure_and_flag_clarification
     - canonical field(s): none
  2. prompt: “Ask what they have actually seen — colour, and whether it is mixed through or on the surface.”
     - required: true · counts towards sufficiency: true
     - unsure: record_unsure_and_flag_clarification
     - canonical field(s): none
     - Record the observation in the client's own terms. Do not interpret it here.
  3. prompt: “Ask whether they have already shown this to a GP or other clinician, and what was said.”
     - required: true · counts towards sufficiency: true
     - unsure: record_unsure_and_continue
     - canonical field(s): none
     - Whether it is already in medical hands changes what NI should do next, and is a fact, not a judgement.

### `dig.digestion.reflux_pattern`

- **Source** — `v2.digestion.noticed`
- **Trigger (verbatim approved options)** — “Heartburn or reflux”
- **Safety linked** — false
- **Review status** — clear
- **Version** — `cockpit-digging.v1-pilot` · **Source of content** — ni_pilot_draft
- **Rationale** — An ordinary non-safety branch, included so the pilot shows digging that is not red-flag driven.
- **Targets**
  1. prompt: “Ask when it happens — after meals, lying down, at night.”
     - required: true · counts towards sufficiency: true
     - unsure: record_unsure_and_continue
     - canonical field(s): none
  2. prompt: “Ask what they take for it, if anything, and how often.”
     - required: true · counts towards sufficiency: true
     - unsure: record_unsure_and_continue
     - canonical field(s): none
     - Regular acid suppression is relevant to digestion and to nutrient status. Factual capture only.

### `dig.sleep.night_sweats_soaking`

- **Source** — `v2.sleep.noticed`
- **Trigger (verbatim approved options)** — “Night sweats that soak the bedding”
- **Safety linked** — true
- **Review status** — needs_human_review
- **Version** — `cockpit-digging.v1-pilot` · **Source of content** — ni_pilot_draft
- **Rationale** — Soaking night sweats is the approved red flag; ordinary "Night sweats" is NOT and must not trigger this branch. The two option values are distinct and stay distinct.
- **Targets**
  1. prompt: “Ask how long this has been happening, and how many nights in a usual week.”
     - required: true · counts towards sufficiency: true
     - unsure: record_unsure_and_flag_clarification
     - canonical field(s): none
  2. prompt: “Ask whether weight, appetite or temperature have changed over the same period.”
     - required: true · counts towards sufficiency: true
     - unsure: record_unsure_and_continue
     - canonical field(s): none
     - These are facts a reviewer will want alongside the sweats. Asking them together is not NI drawing a link — the record states what was asked and answered, nothing more.

### `dig.energy.unintended_weight_loss`

- **Source** — `v2.energy.noticed`
- **Trigger (verbatim approved options)** — “Weight going down without trying”
- **Safety linked** — true
- **Review status** — needs_human_review
- **Version** — `cockpit-digging.v1-pilot` · **Source of content** — ni_pilot_draft
- **Rationale** — Approved red-flag option. The branch records the quantity and the timeframe, and assesses nothing.
- **Targets**
  1. prompt: “Ask how much weight, over how long, and how they know.”
     - required: true · counts towards sufficiency: true
     - unsure: record_unsure_and_flag_clarification
     - canonical field(s): none
     - "How they know" matters: a measured change and an impression are different facts.
  2. prompt: “Ask whether appetite, eating pattern or activity have changed.”
     - required: true · counts towards sufficiency: true
     - unsure: record_unsure_and_continue
     - canonical field(s): none
  3. prompt: “Ask whether a clinician is already aware of the weight change.”
     - required: false · counts towards sufficiency: false
     - unsure: record_unsure_and_continue
     - canonical field(s): none

## 6. Approved safety content used

Annex 1 present in repository: **false**.

Missing: Annex 1 approved wording, Rule 7, Rule 9, Rule 26.

Only reference found: docs/planning/connected-care-v4-delta-map.md — "36 items on the current NI sheet map to Annex 1"

Used instead: safetyOptions metadata on the approved V2 registry questions — clinician-owned, already in the repo

Consequence: Red-flag BEHAVIOUR is implemented and demonstrable. Annex rule IDENTIFIERS and any Annex-specific wording are absent, and no substitute has been written. Every review item carries a null annexRuleId.

3 red-flag questions carrying 7 approved red-flag values:

| Question | Section | Red-flag value (verbatim) | Offers an explicit "not sure"? |
|---|---|---|---|
| `v2.digestion.noticed` | digestion | Blood in the stool | false |
| `v2.digestion.noticed` | digestion | Black, tar-like stool | false |
| `v2.digestion.noticed` | digestion | Difficulty swallowing | false |
| `v2.digestion.noticed` | digestion | A change in your usual bowel habit | false |
| `v2.sleep.noticed` | sleep | Night sweats that soak the bedding | false |
| `v2.energy.noticed` | energy_metabolic | Weight going down without trying | false |
| `v2.energy.noticed` | energy_metabolic | Swelling at the front of the neck | false |

None of the three pilot red-flag questions is a yes/no/not-sure question — all are multi-select.
The locked rule is therefore implemented in its general form: selecting an approved red-flag
value raises human review, AND an uncertain answer to a question carrying red flags raises it
too. The literal Yes/Not-sure shape lives at `v2.mood.safety` (Mood & stress), outside the pilot.

