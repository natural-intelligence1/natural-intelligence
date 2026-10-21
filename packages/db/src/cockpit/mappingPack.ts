// ─── packages/db/src/cockpit/mappingPack.ts ─────────────────────────────────
// PILOT MAPPING REVIEW PACK — Question → Concept(+variant) → canonical Field.
//
// ── THE GATE ────────────────────────────────────────────────────────────────
//
// ZERO approved mappings. Every entry is NEEDS_REVIEW. `canPersistCanonically`
// returns false for every pilot question and takes no override argument.
//
// Three fields the Founder authorised have now closed the three UNMAPPED
// entries — they have destinations, and they are still NEEDS_REVIEW, because
// authorising a FIELD is not approving a MAPPING.
//
// ── SECTION LABEL ↔ CANONICAL SYSTEM KEY IS NOT A SYNONYM RULE ──────────────
//
// `PRODUCT_TO_CANONICAL` below records product section → canonical system key
// as an explicit translation. It exists to be READ, not applied: every entry
// in the pack names its own destination independently, and nothing derives a
// destination from a section at write time.
//
// Energy & metabolism is the case in point. `energy_endocrine` is the key for
// the systems bundle, and it does NOT follow that every question in that
// product section belongs there — weight, thirst and urinary frequency are
// each capable of belonging elsewhere, and the Annex puts unexplained weight
// loss under "URINARY & METABOLIC", not under an endocrine systems heading.

import { V2_FIELD_REGISTRY } from '../intakeV2/fieldRegistry'
import { conceptReferenceForField, describeConceptReference, type ConceptReference } from './conceptReference'
import { PILOT_SECTION_IDS, pilotQuestions, pilotQuestionById, type PilotSectionId } from './pilot'

/** Status progression. */
export const MAPPING_STATUSES = [
  'UNMAPPED', 'CANDIDATE', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED',
] as const
export type MappingStatus = (typeof MAPPING_STATUSES)[number]

/** Only an APPROVED mapping may ever drive a canonical write. */
export const PERSISTABLE_STATUSES: readonly MappingStatus[] = ['APPROVED']

export const CAPTURE_OWNERS = ['client', 'practitioner', 'student_draft', 'system'] as const
export type CaptureOwner = (typeof CAPTURE_OWNERS)[number]

/**
 * Product section → canonical system key.
 *
 * An EXPLICIT TRANSLATION TABLE, not a synonym rule and not a derivation.
 * Two of three differ, and "metabolism" and "endocrine" are not the same
 * word for the same thing.
 */
export const PRODUCT_TO_CANONICAL: readonly {
  productSection: PilotSectionId
  productLabel: string
  canonicalSystemKey: string
  note: string
}[] = Object.freeze([
  {
    productSection: 'digestion',
    productLabel: 'Digestion',
    canonicalSystemKey: 'digestive',
    note: 'Different word, same system. Recorded so nothing has to guess.',
  },
  {
    productSection: 'sleep',
    productLabel: 'Sleep',
    canonicalSystemKey: 'sleep',
    note: 'The one case where the two agree. Still recorded, so agreement is a fact and not a coincidence relied upon.',
  },
  {
    productSection: 'energy_metabolic',
    productLabel: 'Energy & metabolism',
    canonicalSystemKey: 'energy_endocrine',
    note:
      'The least safe translation in the pilot. "Metabolism" and "endocrine" are not synonyms, and ' +
      'this key is correct for the SYSTEMS BUNDLE only. It must not be applied to every question ' +
      'in the product section: Annex 1 places unexplained weight loss under "URINARY & METABOLIC". ' +
      'Each question names its own destination in this pack.',
  },
])

export function canonicalKeyFor(section: PilotSectionId): string {
  return PRODUCT_TO_CANONICAL.find((t) => t.productSection === section)!.canonicalSystemKey
}

export interface MappingEntry {
  questionId: string
  /** The question as the client sees it, verbatim. */
  displayedQuestion: string
  section: PilotSectionId
  productLabel: string
  /** Concept id AND its variant. Neither alone is a semantic identity. */
  conceptRef: ConceptReference | null
  answerType: string
  /** Canonical field ids. Named independently, never derived from the section. */
  fieldIds: string[]
  captureOwner: CaptureOwner
  /** How the answer becomes the field value. */
  writeRule: string
  provenance: string
  status: MappingStatus
  rationale: string
  gap?: string
  proposedBy: 'name_similarity' | 'explicit_registry_metadata' | 'founder_authorised_field' | 'none'
}

const fieldExists = (id: string) => V2_FIELD_REGISTRY.some((f) => f.id === id)

function refFor(fieldId: string): ConceptReference | null {
  const r = conceptReferenceForField(fieldId)
  return r.ok ? r.ref : null
}

const VERBATIM = (id: string) => pilotQuestionById(id)?.label ?? id
const TYPE_OF = (id: string) => pilotQuestionById(id)?.type ?? 'unknown'

export const PILOT_MAPPING_PACK: readonly MappingEntry[] = Object.freeze([
  // ── Digestion ─────────────────────────────────────────────────────────────
  {
    questionId: 'v2.digestion.noticed',
    displayedQuestion: VERBATIM('v2.digestion.noticed'),
    section: 'digestion',
    productLabel: 'Digestion',
    conceptRef: refFor('intake.systems.digestive.symptoms'),
    answerType: TYPE_OF('v2.digestion.noticed'),
    fieldIds: ['intake.systems.digestive.symptoms'],
    captureOwner: 'client',
    writeRule:
      'Selected chips stored as a verbatim value list. "None of these" writes ' +
      'intake.systems.digestive.none_reported instead and must never be stored as a symptom. ' +
      'Chips that satisfy an Annex rule (Rule 7 "Blood in the stool", Rule 9 "Black, tar-like ' +
      'stool") stay in this list unchanged AND satisfy the approved safety question — the safety ' +
      'answer is recorded on its own node, not by editing this list.',
    provenance: 'client_reported; practitioner_verified once confirmed in consultation',
    status: 'NEEDS_REVIEW',
    rationale:
      'Destination is unambiguous (digestive). It is NEEDS_REVIEW because the chip list now ' +
      'carries values that feed approved Annex safety nodes, and a reviewer should confirm that ' +
      'storing them here verbatim, with the safety fact held separately, is what NI intends.',
    gap: 'Awaiting Founder approval. No canonical write until APPROVED.',
    proposedBy: 'explicit_registry_metadata',
  },
  {
    questionId: 'v2.digestion.bowel_frequency',
    displayedQuestion: VERBATIM('v2.digestion.bowel_frequency'),
    section: 'digestion',
    productLabel: 'Digestion',
    conceptRef: refFor('intake.systems.digestive.bowel_frequency'),
    answerType: TYPE_OF('v2.digestion.bowel_frequency'),
    fieldIds: ['intake.systems.digestive.bowel_frequency'],
    captureOwner: 'client',
    writeRule:
      'Single selected band stored verbatim as the approved option label ("One to three times a ' +
      'day"). No numeric conversion — the bands are not evenly spaced and a number would imply a ' +
      'precision the client did not give.',
    provenance: 'client_reported; practitioner_verified once confirmed in consultation',
    status: 'NEEDS_REVIEW',
    rationale:
      'Field authorised by the Founder specifically for this fact. It must NOT go to ' +
      'intake.systems.digestive.frequency, which is symptom frequency; that refusal is what ' +
      'produced the new field.',
    gap: 'Awaiting Founder approval of the MAPPING. The field now exists; approving a field is not approving a mapping.',
    proposedBy: 'founder_authorised_field',
  },
  {
    questionId: 'v2.digestion.stool_form',
    displayedQuestion: VERBATIM('v2.digestion.stool_form'),
    section: 'digestion',
    productLabel: 'Digestion',
    conceptRef: refFor('intake.systems.digestive.stool_form'),
    answerType: TYPE_OF('v2.digestion.stool_form'),
    fieldIds: ['intake.systems.digestive.stool_form'],
    captureOwner: 'client',
    writeRule:
      'Selected form stored verbatim as the approved option label ("Smooth and soft"). The ' +
      'picture-scale interaction is a presentation of the same options when the intake UX reaches ' +
      'that stage; it must not introduce a numeric scale into the stored value.',
    provenance: 'client_reported; practitioner_verified once confirmed in consultation',
    status: 'NEEDS_REVIEW',
    rationale:
      'Field authorised by the Founder. Nothing in the registry previously held stool form, so no ' +
      'existing field could take it without changing its meaning.',
    gap: 'Awaiting Founder approval of the MAPPING.',
    proposedBy: 'founder_authorised_field',
  },

  // ── Energy, hormones & metabolism ─────────────────────────────────────────
  {
    questionId: 'v2.energy.noticed',
    displayedQuestion: VERBATIM('v2.energy.noticed'),
    section: 'energy_metabolic',
    productLabel: 'Energy & metabolism',
    conceptRef: refFor('intake.systems.energy_endocrine.symptoms'),
    answerType: TYPE_OF('v2.energy.noticed'),
    fieldIds: ['intake.systems.energy_endocrine.symptoms'],
    captureOwner: 'client',
    writeRule:
      'As for digestion: verbatim value list; "None of these" writes .none_reported. ' +
      '"Weight going down without trying" stays in this list AND makes Annex Rule 26 relevant — ' +
      'it does NOT answer it, because Rule 26 needs a quantity and a timeframe this chip has not got.',
    provenance: 'client_reported; practitioner_verified once confirmed in consultation',
    status: 'NEEDS_REVIEW',
    rationale:
      'The riskiest destination in the pack. energy_endocrine is right for the systems BUNDLE, but ' +
      'this question mixes energy, appetite, thirst, urinary frequency, weight and thyroid in one ' +
      'chip list, and Annex 1 files unexplained weight loss under "URINARY & METABOLIC". A reviewer ' +
      'should decide whether the whole list belongs in one endocrine field or whether some values ' +
      'need their own destinations.',
    gap: 'Awaiting Founder approval. Destination genuinely in doubt for part of the option list.',
    proposedBy: 'explicit_registry_metadata',
  },

  // ── Sleep ─────────────────────────────────────────────────────────────────
  {
    questionId: 'v2.sleep.noticed',
    displayedQuestion: VERBATIM('v2.sleep.noticed'),
    section: 'sleep',
    productLabel: 'Sleep',
    conceptRef: refFor('intake.systems.sleep.symptoms'),
    answerType: TYPE_OF('v2.sleep.noticed'),
    fieldIds: ['intake.systems.sleep.symptoms'],
    captureOwner: 'client',
    writeRule:
      'Verbatim value list. The two night-sweats options — "Night sweats" and "Night sweats that ' +
      'soak the bedding" — are DISTINCT values and must never be merged; only the second is a ' +
      'safety value. "None of these" writes .none_reported.',
    provenance: 'client_reported; practitioner_verified once confirmed in consultation',
    status: 'NEEDS_REVIEW',
    rationale:
      'Section and canonical key agree, so the destination is not in doubt. NEEDS_REVIEW because a ' +
      'mapping that collapsed the two night-sweats values would destroy a safety signal.',
    gap: 'Awaiting Founder approval. No canonical write until APPROVED.',
    proposedBy: 'explicit_registry_metadata',
  },
  {
    questionId: 'v2.sleep.hours',
    displayedQuestion: VERBATIM('v2.sleep.hours'),
    section: 'sleep',
    productLabel: 'Sleep',
    conceptRef: refFor('intake.systems.sleep.typical_sleep_duration_hours'),
    answerType: TYPE_OF('v2.sleep.hours'),
    fieldIds: ['intake.systems.sleep.typical_sleep_duration_hours'],
    captureOwner: 'client',
    writeRule:
      'Selected band stored verbatim as the approved option label ("5–6", "It varies wildly"). ' +
      '"It varies wildly" is a real answer and must be stored as given, not discarded for being ' +
      'non-numeric and not averaged into a number.',
    provenance: 'client_reported; practitioner_verified once confirmed in consultation',
    status: 'NEEDS_REVIEW',
    rationale:
      'Field authorised by the Founder. It must NOT overload intake.systems.sleep.frequency, which ' +
      'is symptom frequency and whose option set does not fit banded hours.',
    gap: 'Awaiting Founder approval of the MAPPING.',
    proposedBy: 'founder_authorised_field',
  },
] as const)

// ── The gate ────────────────────────────────────────────────────────────────

export function mappingFor(questionId: string): MappingEntry | undefined {
  return PILOT_MAPPING_PACK.find((m) => m.questionId === questionId)
}

/**
 * May this question's answer be written to a canonical field?
 *
 * The single gate. Fail-closed: unknown question, missing mapping,
 * non-APPROVED status, empty destination, missing field, or a concept
 * reference that is not semantically complete all answer false. No override
 * argument exists, and no caller can pass one.
 */
export function canPersistCanonically(questionId: string): boolean {
  const m = mappingFor(questionId)
  if (!m) return false
  if (!PERSISTABLE_STATUSES.includes(m.status)) return false
  if (m.fieldIds.length === 0) return false
  if (!m.fieldIds.every(fieldExists)) return false
  // A mapping whose concept reference is incomplete is not safe to write:
  // downstream grouping would lose which system it belongs to.
  return m.conceptRef !== null
}

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
  if (missing.length > 0) return `Destination field does not exist: ${missing.join(', ')}.`
  if (m.conceptRef === null) return 'Concept reference is incomplete — no variant resolved.'
  return null
}

/**
 * Propose a candidate by name similarity.
 *
 * CANDIDATE at best. Offered so the pack can be extended without hand-writing
 * every row — NOT so a destination can be derived from a section label. The
 * returned rationale says so, and §5's translation table is a record, not a
 * rule this function is permitted to apply silently.
 */
export function proposeCandidate(questionId: string): MappingEntry | null {
  const q = pilotQuestionById(questionId)
  if (!q) return null
  const key = canonicalKeyFor(q.section as PilotSectionId)
  const guess = `intake.systems.${key}.symptoms`
  if (!fieldExists(guess)) return null
  return {
    questionId,
    displayedQuestion: q.label,
    section: q.section as PilotSectionId,
    productLabel: PRODUCT_TO_CANONICAL.find((t) => t.productSection === q.section)!.productLabel,
    conceptRef: refFor(guess),
    answerType: q.type,
    fieldIds: [guess],
    captureOwner: 'client',
    writeRule: 'Not determined — a candidate has no agreed write rule.',
    provenance: 'client_reported',
    status: 'CANDIDATE',
    rationale:
      `Proposed from the product-to-canonical translation (${q.section} → ${key}). That table is ` +
      'a record of an explicit mapping, NOT a synonym rule — this proposal must be checked ' +
      'question by question before it means anything.',
    gap: 'A candidate is a suggestion, not a mapping.',
    proposedBy: 'name_similarity',
  }
}

export interface MappingPackSummary {
  total: number
  byStatus: Record<MappingStatus, number>
  approved: number
  allWritesBlocked: boolean
  needNewField: string[]
  sections: PilotSectionId[]
  /** Entries whose concept reference carries a variant. */
  withVariant: number
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
    withVariant: PILOT_MAPPING_PACK.filter((m) => m.conceptRef?.variant).length,
  }
}

export function unmappedPilotQuestions(): string[] {
  return pilotQuestions().map((q) => q.id).filter((id) => !mappingFor(id))
}

/** Pack rows for review, with the variant spelled out. */
export function mappingPackRows(): Array<Record<string, string>> {
  return PILOT_MAPPING_PACK.map((m) => ({
    questionId: m.questionId,
    displayedQuestion: m.displayedQuestion,
    section: `${m.productLabel} (${m.section})`,
    conceptId: m.conceptRef?.conceptId ?? '—',
    conceptVariant: m.conceptRef?.variant ?? '—',
    conceptReference: m.conceptRef ? describeConceptReference(m.conceptRef) : '—',
    fieldIds: m.fieldIds.join(', ') || '—',
    answerType: m.answerType,
    writeRule: m.writeRule,
    captureOwner: m.captureOwner,
    provenance: m.provenance,
    rationale: m.rationale,
    status: m.status,
  }))
}

export { PILOT_SECTION_IDS }
