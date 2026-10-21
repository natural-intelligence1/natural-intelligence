# Pilot Mapping Review Pack — Consultation Cockpit V2

**GENERATED FROM CODE.** Produced by `packages/db/src/cockpit/genpack.ts` from the live
domain objects, so it cannot drift from what the cockpit does. Regenerate rather than edit.

Pilot domains: Digestion · Energy, hormones & metabolism · Sleep

---

## 1. The gate

| | |
|---|---|
| Canonical fields in the registry | **387** |
| Concepts | 204 |
| Pilot questions | 6 |
| Mapping entries | 6 (every pilot question covered) |
| **APPROVED** | **0** |
| NEEDS_REVIEW | 6 |
| CANDIDATE | 0 |
| UNMAPPED | 0 |
| REJECTED | 0 |
| Entries carrying a concept VARIANT | 6 |
| **Canonical writes permitted** | **NONE — all blocked** |

`canPersistCanonically()` is the single gate. It takes no override argument.

## 2. Product section ↔ canonical system key

An explicit translation table, **not** a synonym rule and not a derivation. Every mapping
below names its own destination independently.

| Product section | Canonical system key | |
|---|---|---|
| Digestion (`digestion`) | `digestive` | Different word, same system. Recorded so nothing has to guess. |
| Sleep (`sleep`) | `sleep` | The one case where the two agree. Still recorded, so agreement is a fact and not a coincidence relied upon. |
| Energy & metabolism (`energy_metabolic`) | `energy_endocrine` | The least safe translation in the pilot. "Metabolism" and "endocrine" are not synonyms, and this key is correct for the SYSTEMS BUNDLE only. It must not be applied to every question in the product section: Annex 1 places unexplained weight loss under "URINARY & METABOLIC". Each question names its own destination in this pack. |

## 3. Concept identity = concept id + variant

The concept layer collapses enumerated dimensions to `*`, so three body systems share
`intake.systems.*.symptoms`. **The concept id alone is not a semantic identity.** A reference
to a parameterised concept is invalid without its variant, and equality compares both.

The concept TEMPLATE model is unchanged — the count did not rise by cloning the generic
concept into twelve per-system copies.

## 4. The mapping entries

### `v2.digestion.noticed` — **NEEDS_REVIEW**

| Field | Value |
|---|---|
| Question ID | `v2.digestion.noticed` |
| Displayed question | Select anything you have noticed with your digestion |
| Section | Digestion (`digestion`) |
| Concept ID | `intake.systems.*.symptoms` |
| Concept variant | `digestive` |
| Concept reference | intake.systems.*.symptoms (variant: digestive) |
| Proposed canonical field(s) | `intake.systems.digestive.symptoms` |
| Answer type | `multichip` |
| Transformation / write rule | Selected chips stored as a verbatim value list. "None of these" writes intake.systems.digestive.none_reported instead and must never be stored as a symptom. Chips that satisfy an Annex rule (Rule 7 "Blood in the stool", Rule 9 "Black, tar-like stool") stay in this list unchanged AND satisfy the approved safety question — the safety answer is recorded on its own node, not by editing this list. |
| Capture owner | client |
| Provenance behaviour | client_reported; practitioner_verified once confirmed in consultation |
| Rationale | Destination is unambiguous (digestive). It is NEEDS_REVIEW because the chip list now carries values that feed approved Annex safety nodes, and a reviewer should confirm that storing them here verbatim, with the safety fact held separately, is what NI intends. |
| Proposed by | explicit_registry_metadata |
| **Current status** | **NEEDS_REVIEW** |
| Gap | Awaiting Founder approval. No canonical write until APPROVED. |

### `v2.digestion.bowel_frequency` — **NEEDS_REVIEW**

| Field | Value |
|---|---|
| Question ID | `v2.digestion.bowel_frequency` |
| Displayed question | How often do your bowels usually open? |
| Section | Digestion (`digestion`) |
| Concept ID | `intake.systems.*.bowel_frequency` |
| Concept variant | `digestive` |
| Concept reference | intake.systems.*.bowel_frequency (variant: digestive) |
| Proposed canonical field(s) | `intake.systems.digestive.bowel_frequency` |
| Answer type | `select` |
| Transformation / write rule | Single selected band stored verbatim as the approved option label ("One to three times a day"). No numeric conversion — the bands are not evenly spaced and a number would imply a precision the client did not give. |
| Capture owner | client |
| Provenance behaviour | client_reported; practitioner_verified once confirmed in consultation |
| Rationale | Field authorised by the Founder specifically for this fact. It must NOT go to intake.systems.digestive.frequency, which is symptom frequency; that refusal is what produced the new field. |
| Proposed by | founder_authorised_field |
| **Current status** | **NEEDS_REVIEW** |
| Gap | Awaiting Founder approval of the MAPPING. The field now exists; approving a field is not approving a mapping. |

### `v2.digestion.stool_form` — **NEEDS_REVIEW**

| Field | Value |
|---|---|
| Question ID | `v2.digestion.stool_form` |
| Displayed question | Which picture looks most like your usual stool? |
| Section | Digestion (`digestion`) |
| Concept ID | `intake.systems.*.stool_form` |
| Concept variant | `digestive` |
| Concept reference | intake.systems.*.stool_form (variant: digestive) |
| Proposed canonical field(s) | `intake.systems.digestive.stool_form` |
| Answer type | `stool_form` |
| Transformation / write rule | Selected form stored verbatim as the approved option label ("Smooth and soft"). The picture-scale interaction is a presentation of the same options when the intake UX reaches that stage; it must not introduce a numeric scale into the stored value. |
| Capture owner | client |
| Provenance behaviour | client_reported; practitioner_verified once confirmed in consultation |
| Rationale | Field authorised by the Founder. Nothing in the registry previously held stool form, so no existing field could take it without changing its meaning. |
| Proposed by | founder_authorised_field |
| **Current status** | **NEEDS_REVIEW** |
| Gap | Awaiting Founder approval of the MAPPING. |

### `v2.energy.noticed` — **NEEDS_REVIEW**

| Field | Value |
|---|---|
| Question ID | `v2.energy.noticed` |
| Displayed question | Anything you have noticed with energy, appetite or temperature? |
| Section | Energy & metabolism (`energy_metabolic`) |
| Concept ID | `intake.systems.*.symptoms` |
| Concept variant | `energy_endocrine` |
| Concept reference | intake.systems.*.symptoms (variant: energy_endocrine) |
| Proposed canonical field(s) | `intake.systems.energy_endocrine.symptoms` |
| Answer type | `multichip` |
| Transformation / write rule | As for digestion: verbatim value list; "None of these" writes .none_reported. "Weight going down without trying" stays in this list AND makes Annex Rule 26 relevant — it does NOT answer it, because Rule 26 needs a quantity and a timeframe this chip has not got. |
| Capture owner | client |
| Provenance behaviour | client_reported; practitioner_verified once confirmed in consultation |
| Rationale | The riskiest destination in the pack. energy_endocrine is right for the systems BUNDLE, but this question mixes energy, appetite, thirst, urinary frequency, weight and thyroid in one chip list, and Annex 1 files unexplained weight loss under "URINARY & METABOLIC". A reviewer should decide whether the whole list belongs in one endocrine field or whether some values need their own destinations. |
| Proposed by | explicit_registry_metadata |
| **Current status** | **NEEDS_REVIEW** |
| Gap | Awaiting Founder approval. Destination genuinely in doubt for part of the option list. |

### `v2.sleep.noticed` — **NEEDS_REVIEW**

| Field | Value |
|---|---|
| Question ID | `v2.sleep.noticed` |
| Displayed question | Anything you have noticed about your sleep? |
| Section | Sleep (`sleep`) |
| Concept ID | `intake.systems.*.symptoms` |
| Concept variant | `sleep` |
| Concept reference | intake.systems.*.symptoms (variant: sleep) |
| Proposed canonical field(s) | `intake.systems.sleep.symptoms` |
| Answer type | `multichip` |
| Transformation / write rule | Verbatim value list. The two night-sweats options — "Night sweats" and "Night sweats that soak the bedding" — are DISTINCT values and must never be merged; only the second is a safety value. "None of these" writes .none_reported. |
| Capture owner | client |
| Provenance behaviour | client_reported; practitioner_verified once confirmed in consultation |
| Rationale | Section and canonical key agree, so the destination is not in doubt. NEEDS_REVIEW because a mapping that collapsed the two night-sweats values would destroy a safety signal. |
| Proposed by | explicit_registry_metadata |
| **Current status** | **NEEDS_REVIEW** |
| Gap | Awaiting Founder approval. No canonical write until APPROVED. |

### `v2.sleep.hours` — **NEEDS_REVIEW**

| Field | Value |
|---|---|
| Question ID | `v2.sleep.hours` |
| Displayed question | Roughly how many hours do you sleep most nights? |
| Section | Sleep (`sleep`) |
| Concept ID | `intake.systems.*.typical_sleep_duration_hours` |
| Concept variant | `sleep` |
| Concept reference | intake.systems.*.typical_sleep_duration_hours (variant: sleep) |
| Proposed canonical field(s) | `intake.systems.sleep.typical_sleep_duration_hours` |
| Answer type | `select` |
| Transformation / write rule | Selected band stored verbatim as the approved option label ("5–6", "It varies wildly"). "It varies wildly" is a real answer and must be stored as given, not discarded for being non-numeric and not averaged into a number. |
| Capture owner | client |
| Provenance behaviour | client_reported; practitioner_verified once confirmed in consultation |
| Rationale | Field authorised by the Founder. It must NOT overload intake.systems.sleep.frequency, which is symptom frequency and whose option set does not fit banded hours. |
| Proposed by | founder_authorised_field |
| **Current status** | **NEEDS_REVIEW** |
| Gap | Awaiting Founder approval of the MAPPING. |

## 5. Annex 1 — the authoritative safety source

NI Intake V4 — Clinical Validation Reply, 2026-10-03, Annex 1

Clinical validation: **CLOSED — APPROVED WITH AMENDMENTS** · 37
approved rules · 7, 9, 26 supplied for this pilot.

Each approved rule is an **explicit safety question node** with a YES / NO / NOT SURE answer.
It is never a chip hidden inside a symptom multi-select.

### Rule 7 — Any rectal bleeding (adult)

- **Annex domain** — DIGESTION
- **Approved question (verbatim)** — “Have you noticed blood in or on your stools, or when you wipe?”
- **Trigger** — YES
- **NOT SURE** — NEEDS HUMAN REVIEW
- **Notice** — END
- **Asked once in** — GIT: Diarrhoea · GIT: Mucus/blood · GIT: Frequency/stool
- **Pilot sections** — digestion
- **Quantified trigger** — false
- **System answer links**
  - `v2.digestion.noticed` / “Blood in the stool” → **satisfies_yes**
    - Reporting blood in the stool IS blood in or on the stools. The approved question is broader (it also covers blood on wiping), but a narrower positive still answers YES. Its ABSENCE answers nothing, because wiping was never asked about.
  - `v2.digestion.noticed` / “Mucus in the stool” → **establishes_relevance**
    - Mucus is not blood. It puts the client in the GIT: Mucus/blood stream where Rule 7 is asked, and nothing more.
- **Absence can satisfy NO** — false (structural; not settable)

### Rule 9 — Black, tarry stools; vomiting blood or coffee-ground material

- **Annex domain** — DIGESTION
- **Approved question (verbatim)** — “Have your stools been black and sticky like tar, or have you vomited blood or something like coffee grounds?”
- **Trigger** — YES TO EITHER
- **NOT SURE** — NEEDS HUMAN REVIEW
- **Notice** — NOW
- **Asked once in** — GIT: Diarrhoea · GIT: Nausea/vomiting · GIT: Mucus/blood
- **Pilot sections** — digestion
- **Quantified trigger** — false
- **System answer links**
  - `v2.digestion.noticed` / “Black, tar-like stool” → **satisfies_yes**
    - This is the first limb of the approved question, in the client's own selection. YES to either limb is the trigger, so one limb answered affirmatively answers the question.
  - `v2.digestion.noticed` / “Vomiting” → **establishes_relevance**
    - Vomiting is NOT vomiting blood or coffee-ground material. Treating it as the second limb would invent a report the client did not make. It establishes relevance only.
- **Absence can satisfy NO** — false (structural; not settable)

### Rule 26 — Unexplained weight loss

- **Annex domain** — URINARY & METABOLIC
- **Approved question (verbatim)** — “Have you lost weight without trying? How much, and over how long?”
- **Trigger** — Unintentional loss AND either 5% or more over 6–12 months, or noticeable unexplained loss over weeks
- **NOT SURE** — NEEDS HUMAN REVIEW
- **Notice** — END
- **Asked once in** — Endocrine: Weight · Endocrine: Fatigue · Endocrine: Frequent urination
- **Pilot sections** — energy_metabolic
- **Quantified trigger** — true
- **System answer links**
  - `v2.energy.noticed` / “Weight going down without trying” → **establishes_relevance**
    - Deliberately NOT satisfies_yes. The approved trigger needs a quantity and a timeframe, and the chip carries neither. Treating it as a YES would either raise a review the threshold does not support, or record a trigger NI cannot evidence.
- **Absence can satisfy NO** — false (structural; not settable)

### Follow-up detail captured on every YES / NOT SURE

- When did it start?
- How often?
- Is it still happening?
- Have you seen a GP, or had tests? When?
- Any associated pain or discomfort?

None of it triggers review. The review is already open by the time it is asked.

### Safety values with no Annex rule supplied for this pilot

Carried, not dropped — losing a safety signal is worse than carrying an unlabelled one.
They raise review and are marked `rule_not_supplied_for_pilot`, never as approved wording.

- `v2.digestion.noticed` (digestion) — “Difficulty swallowing”
- `v2.digestion.noticed` (digestion) — “A change in your usual bowel habit”
- `v2.sleep.noticed` (sleep) — “Night sweats that soak the bedding”
- `v2.energy.noticed` (energy_metabolic) — “Weight going down without trying”
- `v2.energy.noticed` (energy_metabolic) — “Swelling at the front of the neck”

Approved nodes in the pilot: Rule 7, Rule 9, Rule 26.

## 6. Digging edges (explicit, not derived from showIf)

5 edges · 4 safety-linked · 14 targets
(2 reuse an approved registry question, 12 are
practitioner prompts) · 0 targets have a canonical destination.

### `dig.digestion.bowel_habit_change`

- **Source** — `v2.digestion.noticed`
- **Trigger (verbatim approved options)** — “A change in your usual bowel habit”
- **Safety linked** — true · **Review status** — needs_human_review
- **Version** — `cockpit-digging.v1-pilot` · **Content source** — ni_pilot_draft
- **Rationale** — A change in usual bowel habit is an approved red-flag option. The branch gathers the factual detail a reviewer needs; it does not assess what the change means.
- **Targets**
  1. prompt: “Ask when the change began, and what it changed from and to.”
     - required: true · sufficiency: true · unsure: record_unsure_and_flag_clarification
     - When it started and what changed are the two facts a reviewing clinician will ask for first.
  2. registry question `v2.digestion.bowel_frequency`
     - required: true · sufficiency: true · unsure: record_unsure_and_continue
     - An approved question already asks this. Reuse it rather than invent a prompt.
  3. registry question `v2.digestion.stool_form`
     - required: false · sufficiency: true · unsure: record_unsure_and_continue
  4. prompt: “Ask whether anything else changed at the same time — diet, medicines, travel, stress.”
     - required: false · sufficiency: false · unsure: record_unsure_and_continue
     - Context, not sufficiency. Useful but its absence should not hold the branch open.

### `dig.digestion.blood_in_stool`

- **Source** — `v2.digestion.noticed`
- **Trigger (verbatim approved options)** — “Blood in the stool” OR “Black, tar-like stool”
- **Safety linked** — true · **Review status** — needs_human_review
- **Version** — `cockpit-digging.v1-pilot` · **Content source** — ni_pilot_draft
- **Rationale** — Both trigger values are approved red flags. Digging gathers detail for the human review that is already open; it never substitutes for it and cannot close it.
- **Targets**
  1. prompt: “Ask how long it has been happening, and whether it is still happening now.”
     - required: true · sufficiency: true · unsure: record_unsure_and_flag_clarification
  2. prompt: “Ask what they have actually seen — colour, and whether it is mixed through or on the surface.”
     - required: true · sufficiency: true · unsure: record_unsure_and_flag_clarification
     - Record the observation in the client's own terms. Do not interpret it here.
  3. prompt: “Ask whether they have already shown this to a GP or other clinician, and what was said.”
     - required: true · sufficiency: true · unsure: record_unsure_and_continue
     - Whether it is already in medical hands changes what NI should do next, and is a fact, not a judgement.

### `dig.digestion.reflux_pattern`

- **Source** — `v2.digestion.noticed`
- **Trigger (verbatim approved options)** — “Heartburn or reflux”
- **Safety linked** — false · **Review status** — clear
- **Version** — `cockpit-digging.v1-pilot` · **Content source** — ni_pilot_draft
- **Rationale** — An ordinary non-safety branch, included so the pilot shows digging that is not red-flag driven.
- **Targets**
  1. prompt: “Ask when it happens — after meals, lying down, at night.”
     - required: true · sufficiency: true · unsure: record_unsure_and_continue
  2. prompt: “Ask what they take for it, if anything, and how often.”
     - required: true · sufficiency: true · unsure: record_unsure_and_continue
     - Regular acid suppression is relevant to digestion and to nutrient status. Factual capture only.

### `dig.sleep.night_sweats_soaking`

- **Source** — `v2.sleep.noticed`
- **Trigger (verbatim approved options)** — “Night sweats that soak the bedding”
- **Safety linked** — true · **Review status** — needs_human_review
- **Version** — `cockpit-digging.v1-pilot` · **Content source** — ni_pilot_draft
- **Rationale** — Soaking night sweats is the approved red flag; ordinary "Night sweats" is NOT and must not trigger this branch. The two option values are distinct and stay distinct.
- **Targets**
  1. prompt: “Ask how long this has been happening, and how many nights in a usual week.”
     - required: true · sufficiency: true · unsure: record_unsure_and_flag_clarification
  2. prompt: “Ask whether weight, appetite or temperature have changed over the same period.”
     - required: true · sufficiency: true · unsure: record_unsure_and_continue
     - These are facts a reviewer will want alongside the sweats. Asking them together is not NI drawing a link — the record states what was asked and answered, nothing more.

### `dig.energy.unintended_weight_loss`

- **Source** — `v2.energy.noticed`
- **Trigger (verbatim approved options)** — “Weight going down without trying”
- **Safety linked** — true · **Review status** — needs_human_review
- **Version** — `cockpit-digging.v1-pilot` · **Content source** — ni_pilot_draft
- **Rationale** — Approved red-flag option. The branch records the quantity and the timeframe, and assesses nothing.
- **Targets**
  1. prompt: “Ask how much weight, over how long, and how they know.”
     - required: true · sufficiency: true · unsure: record_unsure_and_flag_clarification
     - "How they know" matters: a measured change and an impression are different facts.
  2. prompt: “Ask whether appetite, eating pattern or activity have changed.”
     - required: true · sufficiency: true · unsure: record_unsure_and_continue
  3. prompt: “Ask whether a clinician is already aware of the weight change.”
     - required: false · sufficiency: false · unsure: record_unsure_and_continue

## 7. What the Founder is being asked to approve

All 6 entries are **NEEDS_REVIEW** and none may be written.
Approving a FIELD (done) is not approving a MAPPING (outstanding).

Sections covered: Digestion, Energy, hormones & metabolism, Sleep.

