# Intake Intelligence Architecture — Remediation Plan
*Version 2 — incorporating founder review*

**Type:** Design document
**Status:** Approved for immediate implementation (Phase 1 only — see roadmap)
**Source:** Sprint B Phase 2 Chapter 3 investigation + founder review
**Purpose:** Design how NI evolves from a questionnaire into an intelligence engine

---

## The finding in one sentence

NI currently collects data — including Tier A signals — and then discards most of it. The infrastructure to convert that data into intelligence exists in design but is either dead code, disconnected from the form, or reading stale field names. The fix is not more questions. It is better use of the signals already collected.

---

## The governing principle (founder-approved)

> "Before NI asks a new question, it must demonstrate that it is meaningfully using the answer to the previous one."

This principle governs every intake decision. No new signal is added until the signals already collected are producing downstream value. This prevents the intake from becoming a functional medicine questionnaire while still allowing the intelligence layer to grow in sophistication.

---

## What NI should surface vs. what practitioners should own

NI's primary question is not "what would a practitioner want to know?" It is:

**"What information changes the next best action?"**

These are not always the same. Chronotype may be clinically interesting without changing the body story, the practitioner review priority, or the hypothesis ranking. A question about what the client could do before their health declined — and can no longer do — changes all three immediately.

The implication for prioritisation: signals are ranked by **decision impact**, not clinical curiosity. A signal that changes what is said in What We Heard, what the body story emphasises, or how the practitioner prioritises their review is high priority. A signal that is interesting but does not change any output is deferred regardless of its clinical interest.

---

## What NI surfaces vs. what practitioners own

The hypothesis engine should NOT become a functional medicine score system:

> Dysbiosis score: 7.2
> Adrenal score: 5.1
> Thyroid score: 4.8

This forces all clinical reasoning into pre-defined buckets and removes practitioner judgement from where it belongs.

NI should instead surface:

- **Pattern confidence** — how consistent are the signals pointing in this direction?
- **Signal confidence** — how complete is the data behind this pattern?
- **Missing information** — what would significantly change the picture if known?
- **Contradictions** — where do signals point in different directions?

Practitioners own the hypotheses. NI surfaces the patterns. This is the correct division of responsibility.

---

## 1. PEM — universal, unconditional

**Decision: approved for immediate implementation.**

PEM is a risk-stratification question, not a fatigue question. A client presenting with brain fog, Long COVID sequelae, hormonal complaints, digestive complaints, or unexplained cognitive decline may have PEM. Gating it to the energy sub-branch is architecturally wrong.

Making PEM conditional on a fatigue branch means the most discriminating signal for ME/CFS, post-viral dysautonomia, and mitochondrial dysfunction is invisible to clients who present with brain fog, hormonal symptoms, or digestive complaints — the exact presentations where missing PEM is most clinically consequential.

**Implementation decision:** PEM should appear in Chapter 3 (What Changed) as a universal foundational signal, immediately after the temporal narrative question. It is not a symptom question. It is a first-order clinical signal that determines the entire approach to what follows.

If PEM = yes: the intake should surface the PEM track in Chapter 4 — prioritising cognitive symptoms, orthostatic symptoms, and recovery questions over generic symptom breadth.

---

## 2. Energy timing — wire existing signals downstream

**Decision: approved for immediate implementation.**

`energy_low_times` and `energy_curve` are Tier A signals with zero downstream consumers. They are collected and discarded. The fix requires no new schema — only connecting existing fields to existing surfaces.

**What We Heard rules to add:**
- Worst in morning → "Your energy follows a pattern that often points toward how your stress hormone system is working, particularly in the early part of the day."
- Consistent all day → "Your energy appears low throughout the day, which often points toward several underlying patterns we'll explore in your Body Story."
- Afternoon crash → "The afternoon dip you described is one of the most informative patterns in the intake — and one of the most common."
- Tired but wired at night → "You described a pattern many people recognise — tired but unable to switch off. This is one of the most distinctive patterns we see."

These are recognition statements, not diagnoses. They demonstrate that the platform noticed something.

**Body story prompt addition:** Pass energy timing into the clinical context block with instruction: "The client's energy timing pattern is [value]. Where relevant to the energy picture, reference this pattern."

**Practitioner workspace:** Add energy timing as a one-line field in the clinical context section. "Energy pattern: [value]" — a practitioner reads this in two seconds and immediately orients their reasoning.

---

## 3. Synopsis field repair

**Decision: approved for immediate implementation.**

The synopsis prompt reads stale field names (`chief_complaints`, `complaint_duration`, `existing_conditions`, `previous_practitioners`, `diet_type`, `mood_level`, `digestion_level`, `cognitive_level`, `smoking_status`, `alcohol_frequency`) that do not correspond to any current `intake_responses` columns. The synopsis is generating from incomplete data. This is not a design decision — it is a bug.

**Fix:** Audit every field name in the synopsis prompt builder against current column names. Replace stale names with current equivalents. Remove reads for columns that no longer exist. No schema changes needed.

---

## 4. Dead scoring engine — replace

**Decision: approved for replacement. Timing: Phase D.0.**

`clinicalScoringRules.ts` is dead code. It is imported nowhere, its field names don't match current columns, and it uses hypothesis scoring rather than pattern surfacing. It should be archived as a design reference, not repaired.

The replacement is `scoreHypotheses()` — a named, testable pure function. But this is Phase D.0 work. It is designed here; implementation waits for Phase D.

**Design specification for Phase D.0:**

```
scoreHypotheses(answers: IntakeAnswers) → PatternSummary

PatternSummary {
  patterns: PatternSignal[]
  missingSignals: string[]
  contradictions: string[]
  signalConfidence: 'high' | 'medium' | 'low'
}

PatternSignal {
  name: string           // e.g. "Post-viral pattern"
  confidence: number     // 0–1
  supportingSignals: string[]
  contradictingSignals: string[]
}
```

Note: returns patterns with confidence levels and supporting/contradicting signals. Does NOT return named hypothesis scores. Practitioners own the hypotheses. NI surfaces the patterns.

---

## 5. The missing signal not on the list — functional loss trajectory

**Addition from founder review.**

> "What can you no longer do that you used to be able to do?"

This single question produces more clinical insight than ten symptom questions. It reveals:
- Severity (what it has taken from the person)
- Timeline (when the loss began)
- Impact (what matters most to them)
- Priorities (what would motivate engagement with the protocol)

Examples: "I used to exercise five days a week." / "I used to read books." / "I used to work full days without difficulty." / "I used to socialise without paying for it for days after."

This also creates powerful body story material — the contrast between capacity then and capacity now is the narrative engine the body story needs.

**Field:** `functional_loss_description` — WarmTextarea, optional, positioned in Chapter 2 (Your Best) after the Best Self Baseline, or in Chapter 3 before the symptom inventory. Natural position: "What have you lost since then?" — already captured partially by `best_self_recovery_goal`, but that is forward-looking (what to recover). Functional loss is backward-looking and specific (what was taken).

**This is near-term scope**, not immediate — it requires a small migration and downstream wiring. Surfaces here as a named, approved addition for the next schema sprint.

---

## 6. Signal priority — decision impact ranking

### Approved for immediate wiring (no new schema)

| Signal | Current state | Fix required |
|---|---|---|
| PEM | Collected but gated | Ungate — display condition change |
| Energy timing | Collected, zero consumers | Add downstream wiring |
| Synopsis field names | Stale reads | Repair prompt builder |

### Approved for near-term sprint (small schema additions)

| Signal | Decision impact | Why now |
|---|---|---|
| Functional loss trajectory | High — severity, timeline, body story | Changes What We Heard, body story, practitioner priority |
| Recovery time after exertion | High — intervention pacing, mitochondrial flag | Changes protocol intensity recommendations |
| Infection-onset structured flag | High — post-viral pathway gate | Converts free-text signal to structured hypothesis input |

### Deferred — not until existing signals are fully used

| Signal | Reason for deferral |
|---|---|
| Chronotype | Clinically interesting; decision impact on current outputs unclear |
| Social connection / loneliness | High clinical value; not yet proven to change NI outputs |
| Environmental exposure gateway | Useful; deferred until Phase D environmental hypothesis pathway exists |
| Gut-mood temporal correlation | Valuable; deferred until temporal correlation architecture is built in Phase D.1 |
| Full temporal correlation layer | Phase D.1 |
| Medication narrative | Phase D.2 |
| Chronological symptom onset | Phase D.2 / conversational AI |

---

## 7. Roadmap

### Immediate (Sprint B Phase 2 continuation)

1. Ungate PEM — universal, unconditional, Chapter 3
2. Wire energy timing → What We Heard rules
3. Wire energy timing → Body Story context block
4. Wire energy timing → Practitioner workspace
5. Repair synopsis prompt field names

These five changes require no new schema. They convert discarded Tier A signals into live clinical inputs and fix a data bug in the synopsis. High value, low risk, immediate.

### Near-term (Sprint C or standalone sprint)

6. Functional loss trajectory — new field, migration, downstream wiring
7. Recovery time after exertion — new field, migration, downstream wiring
8. Infection-onset structured flag — new field, migration, post-viral pathway connection

### Phase D.0 (pathology catalogue + intelligence engine)

9. Design and build `scoreHypotheses()` as a named pure function — pattern confidence, signal confidence, missing information, contradictions. No hypothesis scores.
10. Wire scoring output to What We Heard, body story prompt, and practitioner workspace pattern panel
11. Archive `clinicalScoringRules.ts` as design reference

### Phase D.1 (adaptive intake)

12. Temporal correlation layer — gut-mood, hormonal-fatigue, sleep-symptom correlations surfaced when co-occurrence is detected
13. Adaptive Chapter 4 — questions adapt based on pattern signals from Chapters 1–3

### Phase D.2 / Conversational AI

14. Medication narrative (timeline and context, not just list)
15. Chronological symptom onset across domains
16. Pattern confidence displayed to practitioner in workspace

---

## Summary — the three decisions that matter most

**One — universalise PEM.** Clinical safety requirement. Immediate.

**Two — wire energy timing downstream.** The data exists. It is being thrown away. No schema work needed. Immediate.

**Three — NI surfaces patterns; practitioners own hypotheses.** This is not an implementation decision — it is a product philosophy decision that shapes every future design choice. The intake intelligence engine should return pattern confidence, signal confidence, contradictions, and missing information. Not scores. Not diagnoses. Patterns that experienced practitioners can act on.

---

*Version 2 produced: 2026-06-02*
*Founder review incorporated*
*Approved for immediate implementation: items 1–5 (roadmap: Immediate)*
*Status: Ready to send to Claude Code*
