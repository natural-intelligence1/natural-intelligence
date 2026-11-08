// ─── apps/web/lib/intake/sectionProjection.ts ────────────────────────────────
// The legacy `intake_responses` projection, written at each step boundary.
//
// Extracted from IntakeForm.tsx so it can be tested. The mapping itself is
// unchanged; what changed is how it treats emptiness.
//
// THE DEFECT THIS FIXES
//
// Every string field was written as `f.x || null`, so a question the client
// REACHED AND DELIBERATELY LEFT BLANK was stored as NULL — indistinguishable
// from a question they never saw. Arrays had the mirror of the same bug: they
// were written unconditionally, so `[]` claimed "reached, nothing selected"
// for every client, including one who never got to the step.
//
// That is not a cosmetic difference. A practitioner reading "no answer" when
// the client looked at the question and chose to say nothing is reading
// something that did not happen. The answer store (`intake_answers`) always
// had this right: a row exists only if the client interacted.
//
// WHY A `reached` SET IS NEEDED, AND WHY `??` ALONE IS NOT ENOUGH
//
// The obvious fix — `f.x ?? null` — is wrong here. `FormState` initialises
// every string field to `''`, so an untouched question is `''` too. Switching
// to `??` would write `''` for every unreached field and claim a deliberate
// blank that never happened: the same lie, in the other direction.
//
// The form already knows which questions were reached, because `persist()`
// fires on interaction. `useIntakeAnswers` collects those ids (seeded on
// resume from the answers already stored) and passes them here. So:
//
//     value present            → write the value
//     empty AND reached        → write '' / []   ("asked, left blank")
//     empty AND never reached  → write null      ("never asked")
//
// The default empty set reproduces the old behaviour exactly, so a caller
// that forgets to pass it degrades to the previous semantics rather than
// fabricating blanks.
//
// NOT COVERED, DELIBERATELY
//
// `psychosocial_supported` is a boolean column fed by a four-key option. A
// boolean has no room for "reached and left blank", so it still stores null.
// The answer row carries the distinction, and the canonical projection
// (packages/db getCanonicalIntake) reads the answer row first.

import type { FormState } from '@/app/dashboard/intake/types'

/** Question ids the client has actually interacted with this session. */
export type ReachedQuestions = ReadonlySet<string>

export function getSectionData(
  f: FormState,
  s: number,
  primarySystem: string,
  reached: ReachedQuestions = new Set<string>(),
): Record<string, unknown> {
  /** A free-text field. Empty means blank-if-reached, absent otherwise. */
  const txt = (k: string, v: string | null | undefined): string | null => {
    const value = v ?? ''
    if (value !== '') return value
    return reached.has(k) ? '' : null
  }

  /** A multi-select. Empty means "nothing selected" only if reached. */
  const list = (k: string, v: string[] | null | undefined): string[] | null => {
    const value = v ?? []
    if (value.length > 0) return value
    return reached.has(k) ? [] : null
  }

  switch (s) {
    case 1:
      return { arrival_emotion: txt('arrival_emotion', f.arrival_emotion) }
    case 2:
      return {
        primary_concerns: list('primary_concerns', f.primary_concerns),
        concern_duration: txt('concern_duration', f.concern_duration),
        symptom_pattern: txt('symptom_pattern', f.symptom_pattern),
        primary_system: primarySystem,
        // Sprint B Phase 1 — signature question lives on intake_responses
        most_want_to_understand: txt('most_want_to_understand', f.most_want_to_understand),
      }
    case 3:
      return {
        timeline_last_well: txt('timeline_last_well', f.timeline_last_well),
        // Sprint B Phase 2 — Best Self Baseline flushes to intake_responses
        // when leaving Chapter 2 (step 2). Downstream (body story, synopsis,
        // practitioner workspace, What We Heard Pattern F) reads these.
        best_self_description: txt('best_self_description', f.best_self_description),
        best_self_sleep: txt('best_self_sleep', f.best_self_sleep),
        best_self_energy: txt('best_self_energy', f.best_self_energy),
        best_self_mood: txt('best_self_mood', f.best_self_mood),
        best_self_recovery_goal: txt('best_self_recovery_goal', f.best_self_recovery_goal),
      }
    case 4:
      return { timeline_trigger: txt('timeline_trigger', f.timeline_trigger) }
    case 5:
      return {
        systems_reviewed: list('systems_reviewed', f.systems_reviewed),
        primary_system: primarySystem,
      }
    case 6:
      return {
        sleep_hours: f.sleep_hours,
        sleep_quality: f.sleep_quality,
        stress_level: f.stress_level,
        energy_level: f.energy_level,
        exercise_frequency: txt('exercise_frequency', f.exercise_frequency),
        diet_description: txt('diet_description', f.diet_description),
      }
    case 7:
      // Sprint B Phase 1 — practitioner_types + surgeries_or_injuries removed.
      return {
        diagnosed_conditions: list('diagnosed_conditions', f.diagnosed_conditions),
        current_medications: txt('current_medications', f.current_medications),
        current_supplements: txt('current_supplements', f.current_supplements),
        past_treatments: txt('past_treatments', f.past_treatments),
        family_history: list('family_history', f.family_history),
      }
    case 8:
      return {
        psychosocial_impact: txt('psychosocial_impact', f.psychosocial_impact),
        psychosocial_worry: txt('psychosocial_worry', f.psychosocial_worry),
        // Boolean column, four-key answer. See the header note: the key, and
        // therefore "reached but blank", cannot survive here.
        psychosocial_supported: f.psychosocial_supported
          ? ['alone', 'not_really'].includes(f.psychosocial_supported)
            ? false
            : true
          : null,
      }
    // Sprint B Phase 1 — case 9 (Goals stub) is now empty after the
    // health_goals / timeline_expectation / biggest_barrier deletions.
    // Returns {} so the section transition still saves completed_sections.
    case 9:
      return {}
    // Sprint B Phase 1 — case 10 (Readiness stub): readiness_time and
    // readiness_change removed; only readiness_budget remains for now
    // (architecture §10 recommends moving to onboarding later).
    case 10:
      return { readiness_budget: txt('readiness_budget', f.readiness_budget) }
    default:
      return {}
  }
}
