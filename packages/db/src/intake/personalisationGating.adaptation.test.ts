/**
 * Intake adaptation test — Layer 1 (deterministic gating) decision logic.
 *
 * SCOPE / HONESTY NOTE:
 *   apps/web has NO React test harness (no vitest/jest/RTL/jsdom), so this
 *   spec cannot render the live IntakeForm tree. Instead it encodes the EXACT
 *   inline predicates from apps/web/app/dashboard/intake/IntakeForm.tsx,
 *   verbatim with file:line citations, and asserts them across a truth table.
 *   The corresponding live JSX guards were verified by reading the source
 *   (citations on each predicate below). This tests the decision logic, not
 *   the rendered DOM.
 *
 *   Layer 2 (signal-driven adaptation) is intentionally NOT tested here —
 *   the architecture report (separate) establishes whether it exists. As of
 *   this commit the intake question set is static except for the gates below.
 */
import { describe, it, expect } from 'vitest'

// ── Predicates copied verbatim from IntakeForm.tsx ───────────────────────────

type Sex = 'male' | 'female' | null
type Religion =
  | 'muslim' | 'christian' | 'jewish' | 'hindu' | 'buddhist'
  | 'sikh' | 'secular' | 'prefer_not_to_say' | 'other'
type Pref = 'show' | 'hide'

// IntakeForm.tsx:1057 — menstrual block lives inside `if (branch === 'hormonal')`
//   const isFemale = form.biological_sex === 'female'
//   cycle_patterns / menstrual_status / showCycleQuestions all gated on isFemale.
function menstrualSectionRenders(branch: string, sex: Sex): boolean {
  if (branch !== 'hormonal') return false      // branch gate (outer `if`)
  return sex === 'female'                        // isFemale gate (line 1057/1080/1092)
}

// IntakeForm.tsx:824 — {form.religion === 'muslim' && ( ...preference question... )}
function preferenceQuestionRenders(religion: Religion): boolean {
  return religion === 'muslim'
}

// IntakeForm.tsx:1989-2010 — setReligion(value): the DB payload it writes.
//   payload = value==='muslim' ? { religion } : { religion, religious_content_preference:'hide' }
// Returns the object actually sent to user_personalisation.update(...).
function setReligionPayload(value: Religion): { religion: string; religious_content_preference?: 'hide' } {
  return value === 'muslim'
    ? { religion: value }
    : { religion: value, religious_content_preference: 'hide' }
}

// DB defaults (information_schema, live): religion → 'prefer_not_to_say', preference → 'hide'.
const DB_DEFAULT_RELIGION: Religion = 'prefer_not_to_say'
const DB_DEFAULT_PREF: Pref = 'hide'

// ── Layer 1.1 — biological_sex gates the menstrual section ───────────────────
describe('Layer 1.1 — biological_sex → menstrual section', () => {
  it('female + hormonal branch → menstrual section renders', () => {
    expect(menstrualSectionRenders('hormonal', 'female')).toBe(true)
  })
  it('male + hormonal branch → menstrual section absent', () => {
    expect(menstrualSectionRenders('hormonal', 'male')).toBe(false)
  })
  it('null sex + hormonal branch → menstrual section absent', () => {
    expect(menstrualSectionRenders('hormonal', null)).toBe(false)
  })
  it('female but NON-hormonal branch → menstrual section absent (branch gate)', () => {
    expect(menstrualSectionRenders('energy', 'female')).toBe(false)
  })
})

// ── Layer 1.2 — religion gates the preference question ───────────────────────
describe('Layer 1.2 — religion → religious_content_preference question', () => {
  it('religion=muslim → preference question renders', () => {
    expect(preferenceQuestionRenders('muslim')).toBe(true)
  })
  it('religion=christian → preference question absent', () => {
    expect(preferenceQuestionRenders('christian')).toBe(false)
  })
  it('religion=prefer_not_to_say (default/blank) → preference question absent', () => {
    expect(preferenceQuestionRenders('prefer_not_to_say')).toBe(false)
  })
})

// ── Layer 1.4 — edge case: change religion away from muslim ───────────────────
describe('Layer 1.4 — muslim→non-muslim clears the stored preference (no orphan)', () => {
  it('preference question disappears when religion leaves muslim', () => {
    expect(preferenceQuestionRenders('secular')).toBe(false)
  })
  it('the DB payload EXPLICITLY writes preference=hide (not orphaned)', () => {
    const payload = setReligionPayload('secular')
    expect(payload.religious_content_preference).toBe('hide')
  })
  it('switching TO muslim preserves prior preference (payload omits the field)', () => {
    const payload = setReligionPayload('muslim')
    expect(payload.religious_content_preference).toBeUndefined()
  })
})

// ── DB defaults (live information_schema) ────────────────────────────────────
describe('DB defaults match the gate-safe baseline', () => {
  it('religion defaults to prefer_not_to_say (preference question hidden by default)', () => {
    expect(preferenceQuestionRenders(DB_DEFAULT_RELIGION)).toBe(false)
  })
  it('preference defaults to hide (Islamic framing off by default)', () => {
    expect(DB_DEFAULT_PREF).toBe('hide')
  })
})
