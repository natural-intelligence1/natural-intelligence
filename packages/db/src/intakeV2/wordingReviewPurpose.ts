// Section-id → domain purpose for the wording-review pack, resolved from
// the field-governance layer so the pack and the registry cannot drift.
import type { V2SectionId } from './types'
import { resolveV2FieldGovernance } from './fieldGovernance'
import { v2FieldsForDomain, type V2FieldDomain } from './fieldRegistry'

const SECTION_TO_DOMAIN: Partial<Record<V2SectionId, V2FieldDomain>> = {
  arrival: 'concerns',
  about: 'identity',
  care_in_place: 'care_in_place',
  concerns: 'concerns',
  medical_history: 'diagnoses',
  medication: 'medications',
  supplements: 'supplements',
  family: 'family',
  early_life: 'early_life',
  systems_overview: 'systems',
  digestion: 'systems', nervous: 'systems', sleep: 'systems', mood_stress: 'systems',
  energy_metabolic: 'systems', reproductive: 'reproductive', immune: 'systems',
  breathing: 'systems', urinary: 'systems', heart: 'systems', muscles_joints: 'systems',
  skin: 'systems',
  food_diary: 'food', food_frequency: 'food', eating_habits: 'food', drinks: 'food',
  lifestyle: 'lifestyle',
  timeline: 'timeline',
  review: 'concerns',
}

function domainPurpose(domain: V2FieldDomain): string {
  const fields = v2FieldsForDomain(domain)
  const representative = fields.find((field) => !field.notes) ?? fields[0]
  if (!representative) return '— (not present in canonical source)'
  return resolveV2FieldGovernance(representative).purpose
}

export const DOMAIN_PURPOSE_FOR_SECTION: Partial<Record<V2SectionId, string>> =
  Object.fromEntries(
    Object.entries(SECTION_TO_DOMAIN).map(([section, domain]) => [section, domainPurpose(domain as V2FieldDomain)]),
  )
