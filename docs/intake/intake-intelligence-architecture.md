# Intake Intelligence Architecture

**Type:** Design document
**Status:** Draft — awaiting review before Sprint B Phase 2
**Scope:** Architecture only. No code, no migrations, no UI changes, no question rewrites.
**Purpose:** Define how NI should think, not what it should ask.

---

## Framing

The goal is not to collect more data. It is to collect the *right* data — the data that creates insight rather than the data that creates completeness.

An experienced naturopathic practitioner seeing a new client does not work through a form. They hold a conversation in which every answer shapes the next question. They are simultaneously building a clinical picture, testing hypotheses, and reading the human in front of them. By the end of the consultation they have not asked about everything — they have asked about the things that mattered, and they have understood *why* those things mattered.

NI's intake should work the same way. The questions are the surface. Underneath the questions is a reasoning architecture that decides which questions to surface, in which order, for which person, at which moment.

This document designs that reasoning architecture.

---

## Part 1 — Signal hierarchy: what practitioners actually use

### How this was derived

The NI synopsis and body story outputs, combined with the existing practitioner workspace design, reveal what information creates diagnostic and narrative leverage. The analysis below distinguishes between what gets *collected* and what gets *used*.

---

### Tier A — Highest value signals

These are the signals that change everything. When a Tier A signal is present, it reorganises the entire clinical picture. Missing a Tier A signal is a clinical failure.

**A1 — The temporal trigger**
*"When were you last well, and what changed?"*

The single most leveraged question in functional medicine. It creates:
- A personal health baseline (what "well" looks like for this person)
- A temporal marker (when the decline began)
- A contextual frame (what was happening in life when decline began)
- A hypothesis anchor (did decline follow illness, stress, pregnancy, medication, relocation, bereavement?)

The NI synopsis example demonstrates this clearly: "From the timing you've described — energy collapsing after your second child — it looks like your body went through the significant physiological demands of a second pregnancy without fully recovering the resources it needed." That sentence is built entirely on a Tier A signal. It is the sentence that makes the client feel understood.

**A2 — Post-exertional malaise (PEM)**
*"Does doing more make you feel worse the next day rather than better?"*

A binary signal with categorical consequences. If YES: the entire clinical approach changes. Graduated exercise becomes contraindicated. Pacing becomes the primary intervention. Aggressive supplementation becomes risky. Missing this signal and recommending exercise to a client with ME/CFS-adjacent presentation causes harm.

**A3 — System timing pattern**
*"When in the day do you feel worst? Best?"*

Reveals the neuroendocrine pattern underlying the presentation:
- Worst in the morning → HPA axis suppression (low cortisol awakening response)
- Worst in the afternoon → blood sugar dysregulation, circadian disruption
- Consistent throughout day → metabolic/haematological (thyroid, iron, mitochondrial)
- "Tired but wired" at night → HPA elevated phase, sympathetic dominance

This single question frequently narrows the differential from five possible pathways to two.

**A4 — The signature concern**
*"If we get this right, what would you most want to understand about what's happening to you?"*

Not a symptom question. An intentionality question. It reveals:
- What the client believes is the core problem (often diagnostically useful)
- What language the client uses for their experience (critical for narrative)
- What a successful outcome looks like from their perspective (critical for therapeutic alliance)
- What has not been addressed by previous practitioners (frequently the most important clue)

The NI synopsis demonstrates the power of this: "You asked about understanding why your energy collapsed after your second child" — that sentence exists because the signature concern was captured and used. It is the sentence that creates trust.

**A5 — Multi-system concurrence**
When symptoms span 3+ body systems simultaneously, the probability of a systemic driver (HPA dysregulation, autoimmune, post-viral, significant toxic load) increases dramatically. The concurrence *pattern* is more informative than any individual symptom.

**A6 — Reproductive and hormonal transitions (female)**
Pregnancy, postpartum, perimenopause, significant menstrual changes — these are physiological inflection points that frequently correlate with health trajectory changes. When a female client's health decline correlates temporally with a reproductive transition, that correlation is high-value clinical information.

---

### Tier B — Useful signals

These signals contribute to the clinical picture but rarely change the diagnosis on their own. They refine, contextualise, and deepen what Tier A signals suggest.

**B1 — Primary system symptoms**
Which body systems are reporting dysfunction: digestive, hormonal, neurological, musculoskeletal, cardiovascular, skin. Useful for system prioritisation but insufficient alone — the same symptom (fatigue) can arise from a dozen different system dysfunctions.

**B2 — Sleep quality and architecture**
Not just duration — quality, restorativeness, ability to fall asleep vs. stay asleep. Non-restorative sleep is itself a significant clinical signal. Sleep disruption is both a consequence and a cause of HPA dysregulation.

**B3 — Dietary pattern (macro)**
Mediterranean vs. Western vs. restrictive vs. erratic. The practitioner uses this to understand inflammatory load, nutrient density, and gut microbiome implications. Fine-grained dietary data (individual foods, quantities) is rarely used in the initial clinical picture.

**B4 — Stress context**
Current life stress level and perceived stress trajectory. Used to contextualise HPA findings and to calibrate intervention sequencing (a client under acute severe stress cannot absorb a complex protocol).

**B5 — Current medications and supplements**
Drug-nutrient interactions, iatrogenic nutrient depletion (PPIs → magnesium/B12; statins → CoQ10; metformin → B12), contraindications for herbal interventions. This is not optional — it is a clinical safety requirement.

**B6 — Relevant diagnosed conditions**
Contextualises the presentation, flags contraindications, and often reveals patterns (three autoimmune conditions = likely systemic immune dysregulation; hypothyroidism + iron deficiency + fatigue = highly probable clinical picture).

**B7 — Family pattern**
Not individual family history line items — the *generational pattern*. Cardiovascular disease running in the paternal line. Autoimmunity through the maternal line. Metabolic syndrome across multiple generations. The pattern suggests genetic predispositions and environmental factors.

---

### Tier C — Low-value signals (currently over-collected)

These signals generate data that is rarely used in the initial clinical reasoning. Collecting them at intake creates questionnaire fatigue without proportionate clinical return.

**C1 — Specific surgical history line items**
A list of past surgeries is rarely useful unless one was recent or directly relevant (hysterectomy changes hormonal baseline; appendectomy is rarely relevant). The current intake collects surgeries_or_injuries as a field but it has no UI and no downstream consumer.

**C2 — Practitioner type history list**
Whether a client has previously seen an osteopath vs. a nutritionist vs. a GP is rarely clinically useful. What *was* tried, what *helped*, what *didn't* is useful. The type list is not.

**C3 — Readiness and timeline expectation questions**
Asking a client how long they are willing to commit to their health improvement is a wellness-quiz question. It produces aspirational answers that don't predict clinical compliance. Readiness is better inferred from how the client answers substantive questions — the depth and specificity of their responses is more predictive than their stated timeline.

**C4 — Health goals chip list**
"More energy / Better sleep / Clearer skin" — these are marketing categories, not clinical signals. They tell the practitioner nothing that the symptom and concern questions don't already reveal more precisely.

**C5 — Granular lifestyle metrics**
Exact exercise frequency, specific food quantities, precise sleep duration. At intake, these have very low signal-to-noise ratio. Clients either don't remember accurately or answer aspirationally. Broad patterns are more reliable than precise metrics.

---

## Part 2 — Dynamic interview tree

### How NI should think, not what it should ask

The following trees show the *reasoning* behind question sequencing. Each signal generates follow-up logic based on what the signal reveals and what hypothesis it affects.

---

**Signal: "I am exhausted"**

```
Client: "I am exhausted"
NI thinks: Fatigue is the most common presenting complaint. It is a flag, not a signal.
           I need to characterise it before it means anything.

Question 1: "When in the day is it worst?"
  → Worst morning: HPA suppression pathway (H2 ++)
  → Worst afternoon: Blood sugar / circadian pathway (H8 ++)
  → Consistent all day: Metabolic pathway — thyroid, iron, mitochondrial (H3, H4, H7 ++)
  → Variable, crashes after effort: POST-VIRAL PATHWAY (H1 +++ — critical)

If consistent all day:
Question 2: "Do you feel cold when others don't?"
  → Yes: Thyroid pathway prioritised (H4 ++)
  → No: Iron + mitochondrial pathway (H3, H7 ++)

If worst morning:
Question 2: "Do you wake feeling unrefreshed even after enough sleep?"
  → Yes: HPA suppression confirmed (H2 +++)
  → No: Sleep disorder pathway, sleep architecture question

If variable with crashes:
Question 2: "Does doing more — physically or mentally — make you feel worse
            the following day, not just tired?"
  → YES: POST-EXERTIONAL MALAISE FLAG
         This is a Tier A signal. Clinical approach changes immediately.
         Surface: viral onset question, cognitive symptom question
         Flag for practitioner: PEM reported — pacing protocol required
  → No: Continue normal fatigue pathway
```

---

**Signal: "I used to be fine until my second child"**

```
Client: "I used to be fine until my second child"
NI thinks: A temporal trigger has been offered. This is a Tier A signal.
           I should not skip past this to ask about symptoms.
           I should deepen the temporal narrative first.

Question 1: "How long ago was that?"
  Why: Establishes whether this is acute recovery failure or chronic adaptation

Question 2: "What was different about how you felt before?"
  Why: Creates the Best Self Baseline — the reference point the entire
       clinical picture will be measured against

Question 3: "What changed most — your energy, your thinking, your mood,
             your body, or something else?"
  → Energy: HPA, iron, thyroid, mitochondrial pathway
  → Thinking/mood: Neuroinflammation, HPA, post-viral, nutritional
  → Body (physical): Hormonal, autoimmune, nutritional depletion
  → Multiple simultaneously: Multi-system picture — H2 + H5 + H3 likely concurrent

NI thinks: Postpartum depletion is a specific clinical pattern.
           Iron depletion is almost universal. Thyroid disruption is common.
           HPA dysregulation from sustained caregiving stress is common.
           Compound these and I have a coherent hypothesis before asking
           about any specific symptom.

Follow-up: "Were there any specific symptoms — like hair loss, feeling cold,
            or particularly heavy periods — that appeared after the birth?"
  → Hair loss + cold: Iron + thyroid screen
  → Heavy periods: Iron deficiency driver ongoing
  → None: HPA + nutritional depletion most likely
```

---

**Signal: "My digestion changed after antibiotics"**

```
Client: "My digestion changed after antibiotics"
NI thinks: A clear environmental trigger with a known mechanism.
           Antibiotic → microbiome disruption → dysbiosis → downstream effects.
           The clinical picture depends on what "changed" means and what followed.

Question 1: "When was that, and has it been different since?"
  Why: Persistent change vs. partial recovery changes the intervention approach

Question 2: "What changed exactly — the type of symptoms, the frequency,
             or something more general like energy and mood?"
  → Bloating/gas/irregular bowel only: Localised dysbiosis (H5 ++)
  → Plus mood changes: Gut-brain axis disruption (H5 +++)
  → Plus fatigue and immune symptoms: Systemic dysbiosis (H5 +++ + H2 +)
  → Plus skin changes: Gut-skin axis (H5 +++)

Question 3: "Have you taken probiotics or changed your diet since?"
  Why: Informs whether microbiome recovery has been attempted and whether
       intervention is needed from scratch or as a refinement

NI thinks: This is a high-value clinical narrative — a clear cause-effect
           relationship that practitioners can use immediately. I should
           surface this clearly in the practitioner workspace.
```

---

**Signal: "My symptoms started after a bereavement"**

```
Client: "My symptoms started after a bereavement"
NI thinks: A psychosocial trigger that almost certainly activated
           sustained HPA dysregulation. The bereavement is not
           the clinical problem — the physiological adaptation to
           it is.
           I should acknowledge the significance without becoming
           a grief counsellor. I should deepen the clinical
           picture around the physiological impact.

Question 1: "How long ago was that?"
  Why: Acute grief (under 6 months) vs. chronic adaptation (over a year)
       requires different framing

Question 2: "How has your sleep been since then?"
  Why: Grief almost universally disrupts sleep. Sleep disruption
       perpetuates HPA dysregulation. This is the most direct
       physiological pathway.

Question 3: "Has your appetite or relationship with food changed?"
  Why: Grief commonly produces either appetite suppression (weight loss,
       nutritional depletion) or comfort eating (blood sugar dysregulation)

NI thinks: I will NOT ask probing questions about the bereavement itself.
           That is therapy, not clinical intake. I will use the temporal
           marker to contextualise the physiological picture and flag the
           connection clearly in the practitioner workspace:
           "Health changes appear to correlate with a significant loss
           [timeframe]. HPA dysregulation likely mediator."
```

---

## Part 3 — Discovery layers

### The three-layer model

Not every client needs every layer. The intake should front-load high-leverage questions and only deepen when signals warrant it.

---

**Layer 1: Fast discovery (every client, every time)**

Purpose: Establish the minimum viable clinical picture. Create the Best Self Baseline. Identify the primary presenting pattern. Surface any Tier A signals.

Questions at this layer:
- Signature concern (what would you most want to understand)
- Temporal trigger (when were you last well, what changed)
- Primary concern (what brings you here)
- Energy timing pattern (when worst, when best)
- PEM screen (does more make you worse the next day)
- Multi-system flag (how many body systems are reporting symptoms)
- Current medications and significant diagnosed conditions

Outcome: The practitioner workspace can be populated. A preliminary clinical narrative is possible. The "What We Heard" closing chapter can be generated.

Time: 4–6 minutes.

---

**Layer 2: Pattern clarification (triggered by Layer 1 signals)**

Purpose: Deepen the specific pattern suggested by Layer 1. Test the leading hypothesis. Collect the clinical detail needed to distinguish between similar pathways.

Triggered by:
- Energy timing pattern → deepen into HPA, thyroid, or iron pathway as appropriate
- PEM flag → deepen into post-viral pathway (viral onset, cognitive symptoms, orthostatic)
- Multi-system concurrence → deepen into systemic driver (inflammation, autoimmune, toxic load)
- Temporal trigger → deepen the narrative (what changed exactly, what was different before)
- Digestive symptoms → deepen into dysbiosis pathway (antibiotic history, dietary pattern, bowel changes)
- Female + fatigue + hair loss → deepen into iron and hormonal pathway

Outcome: The body story can be generated. The hypothesis scoring is sufficient for meaningful clinical output. The synopsis has the depth needed to feel personalised.

Time: 3–5 minutes (additional to Layer 1).

---

**Layer 3: Deep exploration (rarely needed, carefully triggered)**

Purpose: Investigate specific high-complexity presentations that Layer 1 and 2 cannot resolve. Collect data for clinical edge cases.

Triggered only when:
- Multiple competing hypotheses remain after Layer 2
- Red flags present suggesting referral is needed
- Client has already had extensive investigation and remains undiagnosed
- Autoimmune, environmental toxicity, or rare condition is a serious hypothesis

Examples:
- Detailed environmental exposure history (heavy metals, mould, chemical exposures)
- Detailed family pattern exploration (generational autoimmunity, metabolic disease)
- Reproductive history depth (multiple pregnancies, hormonal interventions, fertility treatment)
- Cognitive symptom depth (if neurological involvement is suspected)
- Mental health history depth (if trauma or psychological factors are significant clinical mediators)

Critical rule: Layer 3 questions should never be reached by a client with a straightforward presentation. If a client with simple fatigue is being asked about mould exposure, the architecture has failed.

Time: Variable — but only initiated with an explicit signal.

---

### Layer transition examples

**Example A — simple presentation, Layer 1 sufficient:**
Client: fatigue, poor sleep, high stress, no PEM, no multi-system concurrence, clear HPA trigger (prolonged work stress).
Layer 1 completes. Layer 2 deepens briefly into HPA pathway (energy timing, cortisol-adjacent symptoms). Layer 3 not triggered.
Result: 7 minutes, clear clinical picture, useful output.

**Example B — moderate complexity, Layer 2 triggered:**
Client: fatigue, digestive symptoms, mood changes, antibiotic history. No PEM. Multi-system concurrence present.
Layer 1 completes. Layer 2 triggered by digestive symptoms (dysbiosis pathway) and multi-system flag. Layer 3 not triggered.
Result: 10 minutes, dysbiosis hypothesis dominant, HPA as secondary. Body story and synopsis can be meaningfully generated.

**Example C — complex presentation, Layer 3 triggered:**
Client: fatigue since viral illness 18 months ago, PEM present, cognitive symptoms, orthostatic symptoms, multiple systems affected, previous investigation inconclusive.
Layer 1 flags PEM. Layer 2 deepens into post-viral pathway. Layer 3 triggered by PEM + multi-system + cognitive symptoms — deeper cognitive and autonomic questions surfaced.
Result: 15 minutes. High-complexity flag raised. Practitioner workspace flags this as requiring senior review. Body story acknowledges complexity.

---

## Part 4 — Minimum data set

### What NI must know before generating each output

---

**What We Heard (closing chapter)**

*Required:*
- signature_concern (what the client wants to understand)
- primary_concerns (what brought them here)
- temporal_trigger (when things changed — even if "not sure")
- at least one body system with symptoms reported
- energy_pattern (timing)

*Optional (enhances quality):*
- best_self_description (enables the gap framing)
- what_changed_description (enables temporal narrative)
- pem_status (enables post-exertional framing if positive)

*Only if triggered:*
- specific_system_patterns (for system-specific pattern bullets)

Minimum viable: 3 required fields completed.

---

**Body Story**

*Required:*
- signature_concern
- temporal_trigger (when last well + what changed)
- primary_system (which system is most affected)
- energy_pattern
- biological_sex (for sex-appropriate clinical framing)
- at least 3 symptom fields populated

*Optional (significantly enhances quality):*
- best_self_description (enables the before/after narrative)
- what_changed_life_context (enables the life-event correlation)
- pem_status
- sleep_quality
- stress_level
- relevant diagnosed conditions

*Only if triggered:*
- pem_detail (if pem = yes)
- thyroid_symptoms (if thyroid pathway triggered)
- iron_symptoms (if iron pathway triggered)
- gut_symptoms_detail (if dysbiosis pathway triggered)

Minimum viable: 6 required fields + at least 2 optional fields. Below this threshold, generation should return insufficient_data and prompt the client to complete more of the intake.

---

**Synopsis**

*Required (all body story requirements plus):*
- medications (for drug interaction awareness)
- most recent lab values (if available — even partial)
- diagnosed_conditions
- supplements

*Optional (significantly enhances quality):*
- family_pattern
- environmental_context
- dietary_pattern

---

**Practitioner Workspace Summary**

*Required:*
- signature_concern (verbatim — the "In their own words" block)
- temporal_trigger
- primary_concerns
- primary_system
- pem_status
- energy_pattern
- biological_sex
- clinical_notes_on_sex (practitioner-written, from user_personalisation)
- medications
- diagnosed_conditions
- symptom_severity_score
- stress_level

*Optional:*
- best_self_description
- what_changed_description
- family_pattern
- supplements
- dietary_pattern

*Only if triggered:*
- pem_detail (if pem = yes — critical for practitioner to see this clearly)
- autoimmune_screen results (if triggered)

---

## Part 5 — Narrative extraction

### How NI discovers the story without feeling like therapy

The goal is to understand:
- What life was like before
- What changed
- What was lost
- What matters most
- What success looks like

The challenge is asking questions that are clinically useful AND feel like discovery rather than assessment. The difference is framing.

---

**What life was like before — the Best Self Baseline**

Conventional clinical question: *"When did your symptoms start?"*
This is a symptom question. It anchors the conversation in pathology.

NI question: *"Tell me about a time when you felt physically, mentally, and emotionally at your best. How old were you, and what was life like?"*
This is an identity question. It anchors the conversation in the person's own standard of health.

Why this works clinically: The best-self description creates a personal reference range. "I slept 7 hours and woke feeling ready" is more useful than "I rate my sleep 6/10" because it establishes a baseline from which the decline can be measured.

Why this works narratively: The body story can open with "You described feeling..." and then reference the specific details they provided. This creates an immediate sense that the platform understood them as a person, not catalogued them as a patient.

---

**What changed — the transition narrative**

Conventional clinical question: *"What were your stressors at that time?"*
This is analytical and invites self-diagnosis.

NI question: *"Walk me through what changed in your life around the time your health started to shift. It could be anything — work, family, where you lived, something that happened, or just a sense that things became different."*
This invites narrative, not analysis.

Why this works clinically: Life transitions frequently correlate with health inflection points. Pregnancy, bereavement, relocation, career change, relationship change — each carries physiological consequences that are clinically relevant. Asking for narrative captures these naturally.

Why this works without feeling like therapy: The framing is "what changed in your life" not "what was traumatic for you." The clinical intent (identifying triggers and mediators) is served without the emotional weight of a trauma assessment.

---

**What was lost — the gap framing**

NI question: *"Is there something specific you've lost — in how you feel, what you can do, or who you are — that you'd most want to get back?"*

This question does three things simultaneously:
1. It establishes the subjective cost of the health decline (clinically useful for motivation and engagement)
2. It reveals what the client values most (useful for treatment prioritisation — someone who has lost their ability to exercise needs a different initial intervention order than someone who has lost their cognitive sharpness)
3. It creates narrative material for the body story closing section

The phrasing "who you are" acknowledges that health decline affects identity, not just function — without crossing into therapy territory.

---

**What matters most — the success frame**

Conventional question: *"What are your health goals?"* → Produces aspirational checklists.

NI question (the signature concern): *"If we get this right, what would you most want to understand about what's happening to you?"* → Produces a personal statement of clinical intent.

The difference: goals are external targets. Understanding is an internal orientation. "I want more energy" is a goal. "I want to understand why my energy collapsed after my second child" is a clinical direction that carries diagnostic content.

---

**How NI extracts these narratives without feeling like therapy**

Rules:
1. Questions about life events are always framed around health correlation, not emotional processing. "What was happening in your life when your health started to change?" not "What was difficult for you at that time?"
2. Narrative questions are always brief and open. They invite the client to say as much or as little as they choose.
3. The platform never probes into a difficult topic once it has been mentioned. If a client says "I went through a divorce" the platform does not ask "how did that affect you emotionally?" It notes the temporal marker and moves on.
4. The closing "What We Heard" chapter demonstrates that the narratives were heard without psychologising them. "A significant life change appears to coincide with changes in your health" — clinical, not therapeutic.

---

## Part 6 — Clinical depth vs. questionnaire fatigue analysis

### Where the current intake is too shallow

**Temporal narrative (shallow):**
The current intake asks when symptoms started but does not ask what life was like *before*. The Best Self Baseline is completely absent. This is the single most significant gap. Without it, the body story has no reference point and the synopsis has no before/after frame.

**Circadian biology (shallow):**
The current intake has energy_level and sleep_quality scores but no chronotype data, no cortisol rhythm assessment, no light exposure patterns, no wake timing consistency. Given that HPA dysregulation and circadian disruption are among the most common patterns in the client population, this is a significant clinical gap.

**The "what changed" context (shallow):**
The intake captures symptoms and ratings. It does not capture what was happening in the client's life when symptoms began. The life-context correlation is frequently the most clinically useful single piece of information, and it is almost entirely absent from the current question set.

**Gut-brain connection (shallow):**
Digestive and mood symptoms are captured separately. There is no question that explicitly asks about their temporal relationship ("did your mood and gut symptoms change at the same time?"). The gut-brain axis is one of the most clinically important relationships in naturopathic practice and the intake treats it as two separate system inventories.

**Family pattern (shallow):**
Current family history is a list of conditions. There is no question about generational themes. "Both my parents have metabolic syndrome and my grandmother had thyroid disease" is more clinically useful than three line items in a family history table.

---

### Where the current intake is too deep

**Medication and supplement detail at intake:**
A detailed supplement list at initial intake produces data that practitioners cannot use until later in the clinical process. A broad "are you taking any supplements?" with a text field is sufficient for intake. The detailed supplement protocol review belongs in the practitioner workspace.

**Symptom severity rating scales:**
Multiple 1-10 scales for adjacent symptoms (stress 1-10, sleep 1-10, energy 1-10, symptom severity 1-10) create rating fatigue. Clients rate these numbers inconsistently and practitioners rarely use the specific numbers — they use the *pattern* across ratings. Three well-chosen scales are more useful than seven overlapping ones.

**Lifestyle category questions:**
The current intake asks about multiple lifestyle domains (diet, exercise, environment, relationships, work) at a level of detail that doesn't translate into clinical action at intake. A practitioner reading the intake summary doesn't need to know a client exercises "3–4 times per week" — they need to know if exercise makes the client feel better or worse (PEM screen) and whether the client is sedentary or active.

---

### Where the current intake asks things practitioners rarely use

**Practitioner type history:**
A list of practitioner types seen previously is low clinical value. What matters is what was tried, what helped, and what didn't. The type list is noise.

**Readiness and commitment scales:**
Practitioners don't use these in clinical reasoning. They use them briefly as a conversational tool during the consultation itself — where they can observe how the client responds in real time. A static scale answer is unreliable.

**Timeline expectation:**
Asking a client how long they expect treatment to take before they have seen a single clinical output is premature. This question also has no downstream consumer in the current system.

---

### Where the current intake misses high-value information

**Post-exertional malaise (entirely absent):**
The most diagnostically critical question in fatigue presentations is not in the intake. This is a clinical safety issue, not just a data quality issue.

**Chronotype and cortisol awakening response indicators:**
What time does the client naturally wake? How do they feel in the first hour of the morning? This is highly predictive of HPA axis state and is completely absent.

**The "what was different then" question:**
The absence of the Best Self Baseline means the body story cannot make the most powerful comparison available: who the client was versus who they are now.

**Social connection and loneliness:**
One of the strongest predictors of physical health outcomes, almost never asked in health intake, entirely absent from the current form. One well-framed question ("How often do you have someone to talk to about what's really going on for you?") would provide significant clinical and narrative value.

**Environmental exposure brief screen:**
Mould, occupational chemical exposure, heavy metals — entirely absent. A single gateway question ("Have you ever lived or worked somewhere that you felt made you physically worse?") would flag clients who need deeper environmental investigation without burdening the majority.

---

## Part 7 — The 10 highest-leverage questions

These are questions that create disproportionate insight. Each one either changes the entire clinical approach if answered a certain way, or creates the narrative material that makes the platform feel intelligent.

---

**Question 1 — The signature concern**
*"If we get this right, what would you most want to understand about what's happening to you?"*

Why it belongs: Creates narrative anchor, reveals the client's clinical hypothesis, establishes therapeutic intent, generates the verbatim quote that appears in the practitioner workspace, body story, and synopsis. One question that works across all downstream surfaces.

---

**Question 2 — The best self baseline**
*"Think of a time when you felt physically, mentally, and emotionally at your best. Describe what that was like — how old were you, what was your energy like, how were you sleeping?"*

Why it belongs: Creates the reference point for everything that follows. Without it, the body story has no "before." The synopsis cannot articulate the gap between who this person was and who they are now. This is the question most likely to make a client feel that the platform actually understands health as a longitudinal story rather than a current symptom inventory.

---

**Question 3 — The temporal trigger with context**
*"When did things start to shift, and what was happening in your life at that time?"*

Why it belongs: Combines temporal marker with contextual frame. This single question frequently reveals the trigger-mediator relationship that organises the entire clinical picture. More clinically useful than ten symptom questions because it asks the body *why*, not just *what*.

---

**Question 4 — Post-exertional malaise screen**
*"When you push yourself physically or mentally, do you feel significantly worse the next day — not just tired, but as if you've crossed a threshold?"*

Why it belongs: A categorical diagnostic signal. Changes the entire clinical approach if positive. Clinical safety requirement for fatigue presentations.

---

**Question 5 — Energy timing**
*"What time of day do you feel at your worst? At your best?"*

Why it belongs: Narrows the differential from five possible pathways to two with a single answer. The most efficient single question in fatigue characterisation.

---

**Question 6 — The gap question**
*"Is there something specific you've lost — in how you feel, what you can do, or who you are — that you'd most want to get back?"*

Why it belongs: Creates motivational material, reveals values, establishes the personal cost of illness, and provides narrative material for the body story closing. Also surfaces implicit treatment priorities that explicit goal questions don't capture.

---

**Question 7 — Sleep restorativeness**
*"When you sleep enough hours, do you wake feeling genuinely rested — or do you still feel tired?"*

Why it belongs: Non-restorative sleep (sleeping enough but waking exhausted) is a specific clinical signal pointing toward HPA dysregulation, sleep architecture disruption, or post-viral presentation. Sleep *duration* is much less clinically useful than sleep *quality*.

---

**Question 8 — The multi-system check**
*"Across your body, how many different areas are you experiencing problems with right now?"* (with gentle system prompts)

Why it belongs: Multi-system concurrence is a proxy for systemic drivers. Three or more systems simultaneously = high probability of HPA, autoimmune, post-viral, or environmental driver. This question changes the hypothesis weighting rapidly and flags high-complexity cases.

---

**Question 9 — Gut-mood temporal correlation**
*"If you have both digestive symptoms and mood or energy changes, did they start around the same time?"*

Why it belongs: The gut-brain axis is one of the most clinically important relationships in naturopathic and functional medicine. Concurrent onset suggests a shared driver (dysbiosis → neurotransmitter disruption; HPA dysregulation → gut motility + mood). Separate onset suggests two distinct processes. This single question changes the hypothesis architecture significantly.

---

**Question 10 — The environmental gateway**
*"Have you ever lived or worked in a place that you felt was making you physically worse — or noticed feeling significantly better when away from home or work?"*

Why it belongs: This is the most efficient way to screen for environmental contributors (mould, chemical exposure, air quality, electromagnetic sensitivity) without a full environmental history. A positive answer triggers Layer 3 environmental investigation. A negative answer closes the pathway cleanly. The question is intuitively understood, non-threatening, and frequently produces clinically significant responses.

---

## Part 8 — The future AI interviewer

### How today's form architecture should evolve into tomorrow's AI interview

Phase D introduces a conversational AI interviewer. The transition from structured form to conversation is not a redesign — it is an evolution. The architecture designed in this document is already conversational in structure. The difference is execution mode.

---

### What changes: execution mode

**Today (Phase B):** Questions are pre-authored, statically sequenced within chapters, with dynamic branching based on answer values.

**Tomorrow (Phase D):** Questions are dynamically generated by an AI that is consulting the hypothesis scoring model and the signal hierarchy in real time. The AI has the same reasoning architecture — it uses it to generate appropriate follow-up language rather than to select from a pre-authored list.

The architecture is the same. The interface changes.

---

### What does not change

- The three-layer discovery model (fast discovery → pattern clarification → deep exploration)
- The hypothesis scoring model (A1–A6 Tier A signals → H1–H10 hypotheses)
- The minimum data sets for each downstream output
- The narrative extraction goals (best self, what changed, what was lost, what matters)
- The principle that the AI infers rather than asks for urgency, complexity, and readiness
- The editorial principle: every interaction either improves clinical accuracy or makes the person feel understood

---

### What today's architecture must produce to support Phase D

**Structured signal storage:** Every answer that carries hypothesis weight must be stored with its hypothesis implications, not just its value. When the AI interviewer succeeds the form, it needs to know not just that the client answered "energy worst in the morning" but that this answer increased H2 weight by ++. The hypothesis model must be stored alongside the answers.

**Narrative field storage:** The best self description, temporal trigger narrative, and what-changed description must be stored as free text (they already are as textarea fields). The conversational AI will use these as context windows — the client's own words become the context the AI reasons within.

**Signal inheritance:** When the AI interview begins, it should inherit the signals already collected by the form (biological_sex, religion, signature concern). It should not re-ask questions already answered. The minimum data set for each output should be checked before generating — the AI knows which signals are still missing and which chapters of the story are yet to be told.

**Conversation history as clinical record:** The transcript of the AI interview must be stored as a case event (the same `case_events` table used for practitioner decisions). The CCR should eventually contain not just structured data but the conversation through which that data was elicited. This is clinically important — *how* a client describes something is frequently as diagnostic as *what* they describe.

---

### The transition design

**Phase B (current):** Structured form with dynamic branching. Hypothesis scoring runs after submission to generate outputs.

**Phase D.0 (next):** Pathology catalogue built in Obsidian. Signal hierarchy and hypothesis model formalised in code (`branchingRules.ts` extended with the full H1–H10 model).

**Phase D.1 (adaptive form):** The form branches adaptively *during* completion, not just after. A client who triggers H1 (post-viral) gets different questions in real time. The form feels intelligent without being conversational.

**Phase D.2 (hybrid):** A conversational element is introduced at specific points — particularly the narrative extraction sections (best self, what changed). The form handles structured clinical data. A lightweight conversational interface handles the story sections. Both feed the same data model.

**Phase D.3 (full conversational):** The AI interviewer conducts the majority of the intake. The structured form becomes a post-interview confirmation and data-validation layer. The conversation transcript is the primary clinical record. The structured outputs are derived from it.

---

### One thing to build now that Phase D will depend on

The most important Phase D enabler that should be built during Phase B is **the hypothesis scoring model as a named, testable function in the codebase** — not just as implicit logic in branching rules.

A function like:
```
scoreHypotheses(answers: IntakeAnswers) → HypothesisScores
```

...that takes the current answer set and returns weighted hypothesis scores is the foundation on which both the adaptive form (Phase D.1) and the conversational AI (Phase D.3) are built. Without it, the intelligence lives in the AI model's general knowledge. With it, the intelligence is explicit, auditable, and improvable.

This function should be built during the intake architecture sprint (Sprint B Phase 2 or Sprint C) so it is available when Phase D begins.

---

## Summary: the architecture in one page

**What NI collects:** Tier A signals first. Tier B signals to refine. Tier C signals only if they earn their place by having a downstream consumer.

**How NI sequences questions:** Three layers. Fast discovery for every client. Pattern clarification triggered by Layer 1 signals. Deep exploration triggered only by high-complexity presentations.

**What NI is looking for:** Ten hypotheses. Each answer updates hypothesis weights. The hypothesis with the highest weight at any point determines the next question.

**What NI is building:** Four outputs — What We Heard, Body Story, Synopsis, Practitioner Workspace Summary — each with a defined minimum data set. Generation begins when the minimum data set is met, not when the form is "complete."

**How NI understands story:** Best Self Baseline → temporal trigger → what changed → what was lost → what success looks like. These are not separate questions. They are a narrative arc that the intake extracts progressively.

**How NI grows:** The form today. The adaptive form in Phase D.1. The hybrid form in Phase D.2. The conversational interviewer in Phase D.3. The architecture is the same throughout. Only the execution mode changes.

---

*Document produced: 2026-06-01*
*Status: Draft — awaiting founder review*
*Next: This document informs Sprint B Phase 2 question rewrites and Phase D.0 pathology catalogue design*
