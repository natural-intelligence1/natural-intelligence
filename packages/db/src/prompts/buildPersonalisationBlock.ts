// PS.4 — buildPersonalisationBlock
//
// Builds a structured CLIENT CONTEXT text block for insertion at the top of
// AI generation system prompts. Personalisation values come from
// getPersonalisationForGeneration; clinical_notes_on_sex is not part of the
// input type (Future-Sensitive Columns Rule).
//
// Boolean gate (addendum Part 3): Islamic framing applies iff
//   religion === 'muslim' AND religiousContentPreference === 'show'
// Any other combination → secular framing.
//
// The returned block is plain text, prefixed and trailing newlines stripped.
// Callers prepend it (with a blank-line separator) to their existing prompt.

import type { PersonalisationForGeneration } from '../personalisation/getPersonalisationForGeneration'

// Derived boolean — exported so generation paths can log it without ever
// touching the underlying religion value.
export function isIslamicFramingEnabled(p: PersonalisationForGeneration): boolean {
  return p.religion === 'muslim' && p.religiousContentPreference === 'show'
}

function sexLabel(p: PersonalisationForGeneration): string {
  if (p.biologicalSex === 'female') return 'female'
  if (p.biologicalSex === 'male')   return 'male'
  return 'not recorded'
}

function sexInstruction(p: PersonalisationForGeneration): string {
  if (p.biologicalSex === 'female') {
    return 'Apply female-pattern clinical interpretation where relevant (reference ranges, cycle phase, hormonal context).'
  }
  if (p.biologicalSex === 'male') {
    return 'Apply male-pattern clinical interpretation where relevant (reference ranges, hormonal context).'
  }
  // null → don't assume sex-specific reference ranges
  return 'Biological sex is not recorded — avoid sex-specific clinical claims and prefer generic phrasing.'
}

function framingInstruction(p: PersonalisationForGeneration): string {
  if (isIslamicFramingEnabled(p)) {
    return [
      '- Framing preference: Islamic',
      'Where relevant and enriching, you may reference Islamic concepts of ihsan, amanah, or similar. Clinical recommendations remain governed by evidence. Framing is narrative only.',
    ].join('\n')
  }
  return [
    '- Framing preference: secular',
    'Use secular language and examples throughout.',
  ].join('\n')
}

export function buildPersonalisationBlock(p: PersonalisationForGeneration): string {
  return [
    'CLIENT CONTEXT:',
    `- Biological sex: ${sexLabel(p)}`,
    sexInstruction(p),
    framingInstruction(p),
  ].join('\n')
}

// Sprint B Phase 1 — signature question block.
//
// When the user has answered "what would you most want to understand" the
// AI generation paths (body story, synopsis) receive this verbatim so the
// opening sentence can quote it back. The quote-back is contractually
// required (Sprint B Phase 1 — Part 2: "a question the platform asks and
// then ignores is worse than not asking it").
//
// Returns an empty string when the user skipped the question — callers
// concatenate with '\n\n' separators; empty block disappears cleanly.
export function buildSignatureQuestionBlock(mostWantToUnderstand: string | null): string {
  const quote = (mostWantToUnderstand ?? '').trim()
  if (!quote) return ''
  return [
    'WHAT THE USER MOST WANTS TO UNDERSTAND:',
    `"${quote}"`,
    '',
    'This is the question they came in with. Open your response by acknowledging it directly — quote or paraphrase their words. Everything you write should help answer or honour it.',
  ].join('\n')
}

// Block variant that strips the framing line entirely — used by BioHub lab
// interpretation (Option iii: clinical-only, no religious framing surface).
export function buildBiologicalContextBlock(p: PersonalisationForGeneration): string {
  return [
    'CLIENT CONTEXT:',
    `- Biological sex: ${sexLabel(p)}`,
    p.biologicalSex
      ? `Apply ${p.biologicalSex}-specific reference ranges and hormonal pattern interpretation where relevant.`
      : 'Biological sex is not recorded — avoid sex-specific reference ranges and pattern claims.',
  ].join('\n')
}
