// Synthetic content for the Protocol workspace preview.
//
// One coherent fictional case, continuing the client and practitioner used by
// the other connected-care previews. Illustrative only: nothing here is
// clinical guidance, and nothing asserts a diagnosis. Deliberately spread
// across nutrition, lifestyle and practitioner-led items so the interface can
// be judged on realistic variety rather than repeated rows.

import type { ProtocolVersionItem, ProtocolVersionRef } from '@natural-intelligence/db/protocols'

export const PRACTITIONER = {
  id: 'prac-amara',
  name: 'Amara Okafor',
  credential: 'Accredited Practitioner · Nutritional Therapy',
}

export const CLIENT = { name: 'Rowan Example', caseRef: 'NI-4F2A91' }

const base = {
  created_at: '2026-09-02T10:00:00Z',
  updated_at: '2026-09-18T09:14:00Z',
  source_template_item_id: null,
} as const

/** v2 — the signed, current Protocol. */
export const SIGNED_V2: ProtocolVersionRef = {
  id: 'proto-v2',
  version: 2,
  signed_at: '2026-09-18T09:20:00Z',
  signed_by: PRACTITIONER.id,
  supersedes: 'proto-v1',
  member_id: 'member-rowan',
  case_id: 'case-4f2a91',
}

/** v1 — an earlier signed version, kept readable. */
export const SIGNED_V1: ProtocolVersionRef = {
  id: 'proto-v1',
  version: 1,
  signed_at: '2026-07-24T11:05:00Z',
  signed_by: PRACTITIONER.id,
  supersedes: null,
  member_id: 'member-rowan',
  case_id: 'case-4f2a91',
}

export const SIGNED_V2_ITEMS: ProtocolVersionItem[] = [
  {
    ...base, id: 'v2-1', protocol_id: 'proto-v2', display_order: 0, is_active: true,
    name: 'Protein at breakfast', item_type: 'nutrition',
    dose: '25–30g', timing: 'Within an hour of waking', duration_weeks: 12,
    instructions: 'Eggs, fish, yoghurt or a legume base — whichever fits the morning. The timing matters more than the source.',
    rationale: 'Steadier morning energy; supports the sleep and appetite pattern we discussed.',
    drafted_source: 'practitioner', drafted_by: PRACTITIONER.id, last_edited_by: PRACTITIONER.id,
  },
  {
    ...base, id: 'v2-2', protocol_id: 'proto-v2', display_order: 1, is_active: true,
    name: 'Daylight walk', item_type: 'lifestyle',
    dose: null, timing: 'Morning, before screens', duration_weeks: 12,
    instructions: '15–20 minutes outdoors. Overcast is fine — it is the daylight rather than the sunshine that counts.',
    rationale: 'Circadian anchoring, which is the first thing to settle before anything else is layered on.',
    drafted_source: 'ni_tooling', drafted_by: 'ni-tooling', last_edited_by: PRACTITIONER.id,
  },
  {
    ...base, id: 'v2-3', protocol_id: 'proto-v2', display_order: 2, is_active: true,
    name: 'Magnesium glycinate', item_type: 'supplement',
    dose: '200mg', timing: 'Evening, with food', duration_weeks: 8,
    instructions: 'Take with the evening meal. Stop and tell me if digestion becomes loose.',
    rationale: 'Supports the evening wind-down while the sleep pattern re-establishes.',
    drafted_source: 'ai_assisted', drafted_by: 'ni-draft-assistant', last_edited_by: PRACTITIONER.id,
  },
  {
    ...base, id: 'v2-4', protocol_id: 'proto-v2', display_order: 3, is_active: true,
    name: 'Review call', item_type: 'practitioner',
    dose: null, timing: 'Week 4', duration_weeks: null,
    instructions: 'Twenty minutes. Bring the sleep notes; we will decide together what to keep and what to drop.',
    rationale: 'Checkpoint before considering any further change.',
    drafted_source: 'practitioner', drafted_by: PRACTITIONER.id, last_edited_by: PRACTITIONER.id,
  },
]

export const SIGNED_V1_ITEMS: ProtocolVersionItem[] = [
  {
    ...base, id: 'v1-1', protocol_id: 'proto-v1', display_order: 0, is_active: true,
    created_at: '2026-07-20T09:00:00Z', updated_at: '2026-07-24T11:00:00Z',
    name: 'Protein at breakfast', item_type: 'nutrition',
    dose: '20g', timing: 'Morning', duration_weeks: 8,
    instructions: 'Whatever is practical on a weekday morning.',
    rationale: 'Starting point while we establish the pattern.',
    drafted_source: 'practitioner', drafted_by: PRACTITIONER.id, last_edited_by: PRACTITIONER.id,
  },
  {
    ...base, id: 'v1-2', protocol_id: 'proto-v1', display_order: 1, is_active: true,
    created_at: '2026-07-20T09:00:00Z', updated_at: '2026-07-24T11:00:00Z',
    name: 'Sleep and energy notes', item_type: 'lifestyle',
    dose: null, timing: 'Daily, one line', duration_weeks: 8,
    instructions: 'One line a day. Not a diary — just enough to see a pattern at the review.',
    rationale: 'We need the pattern before changing anything else.',
    drafted_source: 'practitioner', drafted_by: PRACTITIONER.id, last_edited_by: PRACTITIONER.id,
  },
]

/** The names behind the ids, for display. Provenance shows people and
 *  systems by name, but never in a way that reattributes the signed work. */
export const ACTOR_NAMES: Record<string, string> = {
  [PRACTITIONER.id]: PRACTITIONER.name,
  'ni-tooling': 'NI tooling',
  'ni-draft-assistant': 'NI drafting assistant (AI-assisted)',
  'student-jo': 'J. Student (supervised)',
}

export const DRAFT_SOURCE_LABELS: Record<string, string> = {
  ni_tooling: 'NI tooling',
  ai_assisted: 'AI-assisted draft',
  student: 'Supervised student',
  practitioner: 'Written by practitioner',
  template: 'From a protocol template',
}
