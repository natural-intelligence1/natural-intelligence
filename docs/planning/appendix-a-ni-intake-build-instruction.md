# ORCHESTRATOR — BUILD THE NI HEALTH INTAKE

Founder instruction, 13 September 2026. Design and specification first; Code builds after KR approves.

---

## 1. What this is

NI's current intake is not fit for purpose. Build a replacement that captures **everything a full naturopathic case history needs**, delivered so that a client completing it alone, with no practitioner in the room, is guided rather than buried.

**Two audiences, one form:**
- A **self-serve client** who has never seen a case-history form
- A **practitioner** who needs a complete, structured case to work from

It must serve both without becoming two products.

**Section 3 is the complete clinical domain inventory NI requires.** It is the specification. Everything in it must be captured somewhere in the finished form. Reorganise freely; do not drop anything.

⚠️ **Write every question from scratch, in NI's own voice, for a lay reader.** Do not source question wording, section titles or table layouts from any existing case-history form, college material or professional body template. Clinical domains and symptom vocabulary are common professional ground; the phrasing must be ours. Where a conventional form presents a clinical checklist, NI asks a human question.

---

## 2. 🔴 THE SaMD LINE — the hardest constraint

Counsel ruled on 12 September 2026. This governs the entire build.

### The form MAY

**COLLECT · ORGANISE · STORE · DISPLAY BACK · STRUCTURE FOR A PRACTITIONER**

### The form MAY NOT

- **Infer, calculate, rank, predict, detect, diagnose, monitor or assess** a disease or physiological dysfunction
- **Determine individual clinical risk or urgency**
- **Recommend or select** treatment, supplements, protocols or doses
- **Generate personalised treatment or care plans**
- **Provide practitioner-facing clinical decision support**

### The three layers — and where the line falls

| Layer | What it is | Who does it |
|---|---|---|
| **1 · Client collection** | Everything the client can tell us themselves | The client, self-serve. **BUILD THIS.** |
| **2 · Consultation collection** | What emerges in conversation, plus physical observation | The practitioner, in consultation. **BUILD THIS.** |
| **3 · Clinical interpretation** | Case synopsis, hypothesis, underlying factors, systems requiring support, therapeutic aims, nutritional assessment, the plan, supplement decisions | **THE PRACTITIONER. DO NOT AUTOMATE ANY PART OF LAYER 3.** |

**Layer 3 lives in the practitioner workspace, behind the Lead Responsible Practitioner gate.** The software hands the practitioner an organised case. It never hands them a conclusion.

### Specifically forbidden in the client-facing form

- No scoring of any kind — no severity index, no "your gut score is 6/10"
- No confidence figures
- No pattern naming — no physiological mechanisms, no "underlying driver", no cause attribution
- No supplement or dietary suggestions generated from answers
- No individualised triage. **Static safety information is permitted and encouraged**; evaluating someone's answers and telling them their risk level is not.

### Language ban

**diagnose · diagnosis · detect · predict · prognosis · monitor · treat · treatment · manage · prevent · clinical risk · likely condition · root cause · recommend · prescription · dose · dosage**

— or wording of substantially the same meaning, wherever it describes what the software does. Applies to **UI copy, output labels, help text, onboarding, emails and system prompts**, not only code.

---

## 3. THE DOMAIN INVENTORY — nothing here may be lost

### A. Identity and context
Name · date of birth · age · sex, and separately how they wish to be addressed · address · phone · email · relationship status · children and ages · occupation and working pattern · height · weight · how they came to NI

### B. Medical care already in place
GP name, practice, address, telephone · **explicit permission to contact the GP, captured as its own consent** · any other practitioners currently consulted, conventional or complementary

### C. Consent and terms
Separate, independently withdrawable consents — never one blanket tick:
- NI holding the health record
- Sharing a de-identified case summary with a reviewing practitioner
- AI-assisted organisation of their information
- Retention beyond the current care episode
- Contacting their GP

**Must state plainly:** what naturopathic support is and is not · that it does not replace medical care · that the client remains responsible for raising concerns with their GP · that they should tell their practitioner about all medication and supplements · what to do in an emergency

### D. Medication, current and past
Per item: name · what it is for · amount taken · started when · how often · any effects they have noticed
**Plus:** hormonal contraception, current or previous

### E. Supplements and natural remedies
Per item: name and brand · what it is for · amount · started when · how often · **whether someone advised it or they chose it themselves** · include anything applied to the skin

### F. Family health history
Mother · father · maternal grandmother · maternal grandfather · paternal grandmother · paternal grandfather · brothers · sisters
Conditions, prompted toward what matters — cancer, diabetes, heart conditions, autoimmune conditions, mental health

### G. Recent tests and existing diagnoses
Anything tested in the last six months · any formally diagnosed condition, and when · **the ability to upload a report**

### H. What brought them here
Their main concern, **in their own words, first** · when it began · how long it has gone on · what they believe caused it · where in the body · what it feels like · anything previously diagnosed · what has already been tried · what eases it · what worsens it · whether it is changing · what else accompanies it · **and: what would a good outcome look like for you?**

Then: is there anything else?

### I. Early life and past health
Birth and infancy · childhood illnesses · vaccinations and any reactions · recurrent illness as a child · diagnoses and medication in early years · surgery · significant injury or accident · significant illness in adulthood

### J. Body systems — every one, none dropped

**Digestion** — reflux, breath, bloating, burping, loose stools, constipation, how often bowels open, stool form (illustrated, never named as a clinical scale), abdominal pain, urgency, wind, foods that provoke a reaction, mucus or blood

**Nervous system and mood** — headache, migraine, visual disturbance, dizziness, vertigo, weakness, fainting, seizures, mood changes, anxiety, low mood, memory, concentration, pins and needles, numbness, ringing in the ears

**Sleep** — hours · time taken to fall asleep · waking in the night · how they feel on waking · vivid or disturbing dreams · irregular patterns · night sweats

**Stress** — work and personal load · how they cope · what sets it off · what it affects

**Hormonal and metabolic** — energy across the day, blood sugar swings, cravings, passing water often, unusual thirst, weight change, fatigue, temperature regulation, thyroid-related symptoms, swelling at the neck

**Reproductive** — branched by sex, asked with care:
*Female:* cycle length and regularity · bleeding · periods · pregnancies and outcomes · symptoms before a period · infections or thrush · menopause symptoms · libido · fertility concerns
*Male:* children · libido · fertility concerns · passing water often or incompletely · erectile difficulty
Both: sexual health history — **clearly skippable, with a line explaining why it is asked**

**Immune** — known allergies · suspected intolerances · how quickly wounds heal · asthma · eczema · swollen glands · hives · frequent infections · cold sores · autoimmune conditions · recent vaccinations and any reactions

**Breathing** — asthma · wheeze · chest infections · catarrh down the throat · mucus · sinus trouble · breathlessness · tonsils · ear infections · persistent cough · dry throat

**Urinary** — frequency · urgency · burning · blood · loin pain · difficulty · colour · smell · water infections

**Heart and circulation** — chest pain · breathlessness · palpitations · swelling · fainting · varicose veins · cold hands and feet · known blood pressure · known cholesterol

**Muscles and joints** — pain · stiffness · swelling · back and neck · injuries · spasms · cramps · how they recover after exertion

**Skin** — acne · dry · oily · eczema · contact reactions · psoriasis · fungal problems · sensitivity · rashes · itching · **what they put on their skin, by brand**

### K. Food
**A real food diary**, not a recall question. Three days, structured by meal, with photograph upload.

**How often they eat:** fruit · vegetables · greens specifically · dairy · refined foods · gluten-containing foods · beans and pulses · animal protein · plant protein · fish · sweets and sugary foods · tinned and frozen · takeaway and pre-packaged

**Also:** eating pattern — omnivore, vegetarian, vegan, halal, other · restrictions and why · foods that provoke a physical reaction · dislikes and aversions · **when, where and how they eat** — speed, chewing, eating on the move, eating under stress, portion size, skipped meals

**Drinks** — water, alcohol, caffeine, herbal teas, juices, sugary drinks. Quantities, not yes or no.

**Kitchen reality** — who cooks · how they cook · batch cooking · whether they want recipe support · **food budget** · where they shop · **what would make a change hard to stick to**

### L. Life
Work and life balance · type of work · how they unwind · hobbies · exercise type, frequency, duration · everyday movement · smoking · recreational drugs · alcohol pattern · caring responsibilities · **faith or cultural practices affecting eating, fasting or routine**

### M. Physical observation
**Practitioner-entered only, in consultation.** Never asked of a self-serve client.

---

## 4. HOW IT MUST FEEL — the reason for the rebuild

**One question at a time, or one tight group. Never a wall.**

**Progressive disclosure.** Detail appears only when an earlier answer warrants it. Someone with no digestive symptoms never sees the digestive detail.

**Visual wherever a picture beats words.**
- Body map — tap where it hurts, rather than describe the location
- Stool form as illustrations, unlabelled by any clinical scale
- Frequency as simple visual scales, never "high / medium / low"
- Timeline as something they drag and place, not a table
- Food diary with photograph upload

**Save and resume, always.** Nobody finishes in one sitting. **Save on every step.** Work must never be lost.

**Show progress honestly.** Sections with time estimates — "about 4 minutes" where that is true.

**Let them skip.** Every non-essential question skippable and returnable to. A half-complete case is worth far more than an abandoned one.

**Explain why you are asking** — one line, inline, on anything that feels intrusive. People answer honestly when they understand the reason.

**Their words before the checkboxes.** Open text first on the presenting concern. A checklist refines what they said; it does not replace it.

**Mobile first.** Most will do this on a phone, in the evening, tired.

**Warmth.** Someone is telling a stranger about their body. It should sound like a person, not a questionnaire.

---

## 5. WHAT THE CLIENT GETS BACK

Nothing interpretive. But not nothing.

**Permitted:** their own information organised and readable back to them · a completeness indicator · what happens next · the ability to edit, export and delete · a printable copy of their own record

**Forbidden:** any summary that concludes, scores, patterns or suggests

---

## 6. WHAT THE PRACTITIONER GETS

An organised case, not a conclusion.

Everything above, structured by system · the timeline as entered · flags for **missing information**, never for clinical significance · the de-identified review pack where consent permits

**Layer 3 is written by the practitioner, in the practitioner workspace, behind the LRP gate.**

---

## 7. DELIVER

1. **Section and question map** — every domain in section 3, in the order a client meets them, with estimated time per section
2. **Question-by-question copy**, original, in NI's voice, lay-readable
3. **Conditional logic** — what triggers what
4. **Visual component specification** — body map, stool illustrations, timeline, food diary, frequency scales
5. **Mobile wireframe description**, section by section
6. **Save, resume and progress behaviour**
7. **Consent screen specification** — granular, independently withdrawable, with proposed wording
8. **Data model** — what is stored where, and exactly what the practitioner view exposes
9. **SaMD compliance statement** — confirm explicitly that nothing in the design infers, scores, ranks, predicts or recommends
10. **Build handoff for Claude Code**

---

## 8. CONSTRAINTS

- **Do not build. Specify.** KR approves, then Code builds.
- **Do not source wording from any external case-history form, college material or professional body template.** Write it fresh.
- Nothing on the SaMD forbidden list.
- No donations or charity references anywhere.
- Do not expand scope beyond intake. Not the practitioner workspace, not pricing, not billing.
- Flag anything you are assuming.

⚠️ **Intake is currently live and collecting.** Whatever is built replaces something already in use. State clearly how existing records migrate, or whether they are discarded.
