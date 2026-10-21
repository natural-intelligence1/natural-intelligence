// ─── packages/db/src/cockpit/mappingPack.ts ─────────────────────────────────
// PILOT MAPPING REVIEW PACK — Question → Concept → canonical Field.
//
// ── THE GATE ────────────────────────────────────────────────────────────────
//
// Global truth, unchanged by this file: there are ZERO approved
// Question → Concept → Field mappings. Every entry below is at most a
// CANDIDATE or NEEDS_REVIEW. Nothing is APPROVED, and `canPersistCanonically`
// returns false for every question in the pilot.
//
// Name-similarity may PROPOSE a candidate. It may never approve one, and this
// module contains no code path that promotes a mapping without an explicit
// reviewer and decision. The cockpit therefore runs on local session state,
// and the UI says so rather than implying a write happened.
//
// ── WHAT I REFUSED TO GUESS ─────────────────────────────────────────────────
//
// Three pilot questions have NO plausible canonical destination:
//
//   v2.digestion.bowel_frequency  — intake.systems.digestive.frequency is
//     "how often (light)", meaning how often the SYMPTOM occurs. Bowel-opening
//     frequency is a different quantity, and writing one into the other would
//     silently corrupt both. UNMAPPED.
//   v2.digestion.stool_form       — no stool-form field exists anywhere in the
//     registry. UNMAPPED.
//   v2.sleep.hours                — no sleep-duration field exists. The
//     systems bundle has symptoms/frequency/free_text/none_reported only.
//     UNMAPPED.
//
// Each needs a new canonical field, which is a registry decision and not
// mine to make. They are listed with status UNMAPPED and a stated gap, which
// is the honest answer and the useful one.
//
// ── QUESTION → CONCEPT IS MANY-TO-ONE HERE. READ THIS BEFORE APPROVING. ─────
//
// All three mapped pilot questions resolve to the SAME concept:
//
//   intake.systems.*.symptoms
//
// The concept layer collapses the enumerated `system` dimension to `*`, so
// digestion, sleep and energy share one concept and are distinguished only by
// its VARIANT. That is the concept layer working as designed, but it has a
// consequence a reviewer must weigh: the concept alone cannot tell you which
// body system an answer belongs to. Anything downstream that groups by
// concept and ignores the variant would merge three domains into one.
//
// The FIELD ids remain distinct (`...digestive...`, `...sleep...`,
// `...energy_endocrine...`), so the canonical destination is unambiguous. It
// is the concept layer, not the field layer, that is lossy here.
export const PILOT_SHARED_CONCEPT_ID = 'intake.systems.*.symptoms'

import { V2_FIELD_REGISTRY } from '../intakeV2/fieldRegistry'
import { conceptForField } from '../intakeV2/questionGraph/concepts'
import {
  PILOT_SECTION_IDS, SYSTEM_KEY_BY_SECTION, pilotQuestions, pilotQuestionById,
  type PilotSectionId,
} from './pilot'

/** Status progression. Order matters: index is the progression position. */
export const MAPPING_STATUSES = [
  'UNMAPPED', 'CANDIDATE', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED',
] as const
export type MappingStatus = (typeof MAPPING_STATUSES)[number]

/** Only an APPROVED mapping may ever drive a canonical write. */
export const PERSISTABLE_STATUSES: readonly MappingStatus[] = ['APPROVED']

/** Who owns putting the value into the record. */
export const CAPTURE_OWNERS = ['client', 'practitioner', 'student_draft', 'system'] as const
export type CaptureOwner = (typeof CAPTURE_OWNERS)[number]

export interface MappingEntry {
  questionId: string
  section: PilotSectionId
  /** Concept id from the existing concept layer, or null where the
   *  destination field does not exist so no concept can be resolved. */
  conceptId: string | null
  /** Canonical field ids this question would write to. Empty when UNMAPPED. */
  fieldIds: string[]
  captureOwner: CaptureOwner
  /** How the answer becomes the field value, where it is not a plain copy. */
  writeRule?: string
  /** What provenance the written value carries. */
  provenance: string
  status: MappingStatus
  /** Required where the mapping is not self-evident, and where it is blocked. */
  rationale?: string
  /** What is missing, for anything not APPROVED. */
  gap?: string
  /** How the candidate was arrived at. Name similarity can only propose. */
  proposedBy: 'name_similarity' | 'explicit_registry_metadata' | 'none'
}

const fieldExists = (id: string) => V2_FIELD_REGISTRY.some((f) => f.id === id)

/**
 * The pack.
 *
 * NEEDS_REVIEW is used where a destination genuinely exists and the mapping
 * looks right but crosses the section/system-key boundary or collapses
 * several answers into one field — i.e. exactly where a human should look.
 * CANDIDATE is used where name similarity alone proposed it.
 */
export const PILOT_MAPPING_PACK: readonly MappingEntry[] = Object.freeze([
  // ── Digestion ─────────────────────────────────────────────────────────────
  {
    questionId: 'v2.digestion.noticed',
    section: 'digestion',
    conceptId: conceptForField('intake.systems.digestive.symptoms')?.id ?? null,
    fieldIds: ['intake.systems.digestive.symptoms'],
    captureOwner: 'client',
    writeRule:
      'Selected chips are stored as a value list, verbatim. Red-flag selections ALSO raise a ' +
      'safety review item; they are never removed from, or re-worded inside, the stored list. ' +
      '"None of these" writes intake.systems.digestive.none_reported instead, and must not be ' +
      'stored as a symptom.',
    provenance: 'client_reported, or practitioner_verified once confirmed in consultation',
    status: 'NEEDS_REVIEW',
    rationale:
      'Section "digestion" maps to system key "digestive" — the names differ, so this crosses the ' +
      'boundary described in pilot.ts and should be confirmed rather than assumed. The field is ' +
      'also the right destination for the red-flag options, which carry clinical weight: a ' +
      'reviewer should confirm that storing them in the ordinary symptom list, with the safety ' +
      'item raised alongside, is what NI intends.',
    gap: 'Awaiting Founder approval. No canonical write until APPROVED.',
    proposedBy: 'explicit_registry_metadata',
  },
  {
    questionId: 'v2.digestion.bowel_frequency',
    section: 'digestion',
    conceptId: null,
    fieldIds: [],
    captureOwner: 'client',
    provenance: 'client_reported',
    status: 'UNMAPPED',
    rationale:
      'intake.systems.digestive.frequency is "how often (light)" — how often the SYMPTOM occurs. ' +
      'How often the bowels open is a different quantity with a different option set. Writing ' +
      'one into the other would corrupt both readings, so no candidate is proposed.',
    gap: 'Needs a new canonical field, e.g. a digestive bowel-habit frequency. Registry decision.',
    proposedBy: 'none',
  },
  {
    questionId: 'v2.digestion.stool_form',
    section: 'digestion',
    conceptId: null,
    fieldIds: [],
    captureOwner: 'client',
    provenance: 'client_reported',
    status: 'UNMAPPED',
    rationale:
      'No stool-form field exists anywhere in the registry, and none of the systems bundle ' +
      'fields carries an ordinal scale. There is nothing to map to.',
    gap: 'Needs a new canonical field for stool form. Registry decision.',
    proposedBy: 'none',
  },

  // ── Energy, hormones & metabolism ─────────────────────────────────────────
  {
    questionId: 'v2.energy.noticed',
    section: 'energy_metabolic',
    conceptId: conceptForField('intake.systems.energy_endocrine.symptoms')?.id ?? null,
    fieldIds: ['intake.systems.energy_endocrine.symptoms'],
    captureOwner: 'client',
    writeRule:
      'As for digestion: verbatim value list; "None of these" writes .none_reported; red-flag ' +
      'selections also raise a safety item without altering the stored list.',
    provenance: 'client_reported, or practitioner_verified once confirmed in consultation',
    status: 'NEEDS_REVIEW',
    rationale:
      'Section "energy_metabolic" maps to system key "energy_endocrine" — the names differ ' +
      'substantially, and "metabolism" and "endocrine" are not synonyms. This is the least ' +
      'obvious of the three translations and most needs a human decision.',
    gap: 'Awaiting Founder approval. No canonical write until APPROVED.',
    proposedBy: 'explicit_registry_metadata',
  },

  // ── Sleep ─────────────────────────────────────────────────────────────────
  {
    questionId: 'v2.sleep.noticed',
    section: 'sleep',
    conceptId: conceptForField('intake.systems.sleep.symptoms')?.id ?? null,
    fieldIds: ['intake.systems.sleep.symptoms'],
    captureOwner: 'client',
    writeRule:
      'As for digestion. Note the two night-sweats options are distinct values — "Night sweats" ' +
      'and "Night sweats that soak the bedding" — and only the second is an approved red flag. ' +
      'They must not be merged.',
    provenance: 'client_reported, or practitioner_verified once confirmed in consultation',
    status: 'NEEDS_REVIEW',
    rationale:
      'Section and system key agree here ("sleep"), so the destination is not in doubt. It is ' +
      'NEEDS_REVIEW rather than CANDIDATE because of the night-sweats distinction: a mapping ' +
      'that collapsed the two values would destroy the red flag.',
    proposedBy: 'explicit_registry_metadata',
  },
  {
    questionId: 'v2.sleep.hours',
    section: 'sleep',
    conceptId: null,
    fieldIds: [],
    captureOwner: 'client',
    provenance: 'client_reported',
    status: 'UNMAPPED',
    rationale:
      'No sleep-duration field exists. intake.systems.sleep.frequency is symptom frequency, not ' +
      'hours slept, and the banded options ("Under 5", "It varies wildly") do not fit it.',
    gap: 'Needs a new canonical field for typical sleep duration. Registry decision.',
    proposedBy: 'none',
  },
] as const)

// ── The gate ────────────────────────────────────────────────────────────────

export function mappingFor(questionId: string): MappingEntry | undefined {
  return PILOT_MAPPING_PACK.find((m) => m.questionId === questionId)
}

/**
 * May this question's answer be written to a canonical field?
 *
 * The single gate. Fail-closed: an unknown question, a missing mapping, a
 * non-APPROVED status and an empty destination all answer false. There is no
 * override argument, and no caller can pass one.
 */
export function canPersistCanonically(questionId: string): boolean {
  const m = mappingFor(questionId)
  if (!m) return false
  if (!PERSISTABLE_STATUSES.includes(m.status)) return false
  if (m.fieldIds.length === 0) return false
  return m.fieldIds.every(fieldExists)
}

/** Why a write is blocked, in words a reviewer can act on. */
export function persistenceBlockReason(questionId: string): string | null {
  const m = mappingFor(questionId)
  if (!m) return `No mapping entry exists for ${questionId}.`
  if (m.status === 'UNMAPPED') return m.gap ?? 'No canonical destination exists.'
  if (m.status === 'REJECTED') return 'This mapping was rejected.'
  if (m.status !== 'APPROVED') {
    return `Mapping is ${m.status}; canonical writes need APPROVED. ${m.gap ?? ''}`.trim()
  }
  if (m.fieldIds.length === 0) return 'Mapping is APPROVED but names no destination field.'
  const missing = m.fieldIds.filter((f) => !fieldExists(f))
  return missing.length > 0 ? `Destination field does not exist: ${missing.join(', ')}.` : null
}

/**
 * Propose a candidate by name similarity.
 *
 * Returns CANDIDATE at best, never APPROVED — the return type makes that
 * unrepresentable. Offered so the review pack can be extended without
 * hand-writing every row, not so mappings can be generated and trusted.
 */
export function proposeCandidate(questionId: string): MappingEntry | null {
  const q = pilotQuestionById(questionId)
  if (!q) return null
  const systemKey = SYSTEM_KEY_BY_SECTION[q.section as PilotSectionId]
  const guess = `intake.systems.${systemKey}.symptoms`
  if (!fieldExists(guess)) return null
  return {
    questionId,
    section: q.section as PilotSectionId,
    conceptId: conceptForField(guess)?.id ?? null,
    fieldIds: [guess],
    captureOwner: 'client',
    provenance: 'client_reported',
    status: 'CANDIDATE',
    rationale: `Proposed by name similarity from section "${q.section}" to system key "${systemKey}". Not reviewed.`,
    gap: 'A candidate is a suggestion, not a mapping. Needs human review before it means anything.',
    proposedBy: 'name_similarity',
  }
}

export interface MappingPackSummary {
  total: number
  byStatus: Record<MappingStatus, number>
  approved: number
  /** True while nothing in the pilot may be persisted canonically. */
  allWritesBlocked: boolean
  /** Questions needing a brand-new canonical field. */
  needNewField: string[]
  sections: PilotSectionId[]
}

export function summariseMappingPack(): MappingPackSummary {
  const byStatus = Object.fromEntries(
    MAPPING_STATUSES.map((s) => [s, PILOT_MAPPING_PACK.filter((m) => m.status === s).length]),
  ) as Record<MappingStatus, number>

  return {
    total: PILOT_MAPPING_PACK.length,
    byStatus,
    approved: byStatus.APPROVED,
    allWritesBlocked: PILOT_MAPPING_PACK.every((m) => !canPersistCanonically(m.questionId)),
    needNewField: PILOT_MAPPING_PACK.filter((m) => m.status === 'UNMAPPED').map((m) => m.questionId),
    sections: [...PILOT_SECTION_IDS],
  }
}

/** Every pilot question has a pack entry — so nothing is silently absent. */
export function unmappedPilotQuestions(): string[] {
  return pilotQuestions().map((q) => q.id).filter((id) => !mappingFor(id))
}
