// ─── packages/db/src/cockpit/pilot.ts ───────────────────────────────────────
// Consultation Cockpit V2 — PILOT SCOPE.
//
// Three domains only: Digestion, Energy & metabolism, Sleep. Everything in
// this module is deliberately a narrow slice of the existing registry rather
// than a second question bank — the cockpit reads the SAME approved questions
// the client intake reads.
//
// ONE TRANSLATION WORTH KNOWING ABOUT
//
// The intake SECTION ids and the field-registry SYSTEM keys do not match:
//
//   section 'digestion'        -> system key 'digestive'
//   section 'sleep'            -> system key 'sleep'
//   section 'energy_metabolic' -> system key 'energy_endocrine'
//
// Two of the three differ. That is not a typo to tidy away: the section is a
// step in the client's journey and the system key is a canonical field prefix,
// and they were named by different exercises. Every mapping that crosses this
// boundary carries a rationale in mappingPack.ts for exactly that reason.

import { V2_QUESTIONS, V2_SECTIONS } from '../intakeV2/registry'
import type { V2QuestionDef, V2SectionId } from '../intakeV2/types'

export const PILOT_SECTION_IDS = ['digestion', 'energy_metabolic', 'sleep'] as const
export type PilotSectionId = (typeof PILOT_SECTION_IDS)[number]

export function isPilotSection(id: string): id is PilotSectionId {
  return (PILOT_SECTION_IDS as readonly string[]).includes(id)
}

/** Section id -> field-registry system key. See the header. */
export const SYSTEM_KEY_BY_SECTION: Record<PilotSectionId, string> = {
  digestion:        'digestive',
  sleep:            'sleep',
  energy_metabolic: 'energy_endocrine',
}

/** The practitioner-facing stream name. Taken from the approved section
 *  titles, not reworded here. */
export function pilotStreamTitle(section: PilotSectionId): string {
  return V2_SECTIONS.find((s) => s.id === section)?.title ?? section
}

/** Every approved question in the pilot domains, in registry order. */
export function pilotQuestions(section?: PilotSectionId): V2QuestionDef[] {
  return V2_QUESTIONS.filter((q) =>
    isPilotSection(q.section) && (section === undefined || q.section === section))
}

export function pilotQuestionById(id: string): V2QuestionDef | undefined {
  return pilotQuestions().find((q) => q.id === id)
}

/**
 * The safety-capture questions in the pilot, with their approved red-flag
 * option values.
 *
 * `safetyOptions` is clinician-owned metadata already on the approved
 * question. Nothing here adds to it, re-words it or infers new red flags.
 */
export interface PilotRedFlagQuestion {
  questionId: string
  section: PilotSectionId
  label: string
  /** The approved option values that are red flags. Verbatim. */
  redFlagValues: string[]
  /** True where the question offers an explicit uncertainty answer, so the
   *  "YES or NOT SURE" shape applies literally rather than by analogy. */
  offersNotSure: boolean
}

const NOT_SURE_VALUES = ['Not sure', 'Sometimes', 'Unsure', "Don't know"]

export function pilotRedFlagQuestions(): PilotRedFlagQuestion[] {
  return pilotQuestions()
    .filter((q) => (q.safetyOptions?.length ?? 0) > 0)
    .map((q) => ({
      questionId: q.id,
      section: q.section as PilotSectionId,
      label: q.label,
      redFlagValues: [...(q.safetyOptions ?? [])],
      offersNotSure: (q.options ?? []).some((o) => NOT_SURE_VALUES.includes(o)),
    }))
}

/** Is this specific answer value an approved red flag for this question? */
export function isRedFlagValue(questionId: string, value: string): boolean {
  const q = pilotQuestionById(questionId)
  return (q?.safetyOptions ?? []).includes(value)
}

export interface PilotScope {
  sections: PilotSectionId[]
  questionCount: number
  redFlagQuestionCount: number
  redFlagValueCount: number
}

export function summarisePilot(): PilotScope {
  const flags = pilotRedFlagQuestions()
  return {
    sections: [...PILOT_SECTION_IDS],
    questionCount: pilotQuestions().length,
    redFlagQuestionCount: flags.length,
    redFlagValueCount: flags.reduce((n, f) => n + f.redFlagValues.length, 0),
  }
}

export type { V2QuestionDef, V2SectionId }
