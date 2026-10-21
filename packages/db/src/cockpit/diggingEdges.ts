// ─── packages/db/src/cockpit/diggingEdges.ts ────────────────────────────────
// Explicit DIGGING relationships for the pilot.
//
// NOT DERIVED FROM showIf. showIf answers "should the client see this screen",
// which is a routing question. Digging answers "this answer deserves to be
// opened up, here is what to ask and when you have enough", which is a
// clinical question. The existing questionGraph/edges.ts already records this
// distinction and reports diggingStatus() as unsupported precisely because
// nothing had encoded real digging edges. These are the first.
//
// WHERE THE TARGETS COME FROM
//
// A digging edge may target either:
//   · an existing approved registry question (`targetQuestionId`), or
//   · a practitioner prompt with no registry question behind it
//     (`practitionerPrompt`) — asked and recorded in the consultation, with
//     no canonical destination until a field and mapping exist.
//
// The second kind is honest about a real situation: a practitioner digging
// into "blood in the stool" needs to ask about duration and colour, and NI
// has no approved client question for either. The prompt is procedural
// ("ask about X"), never evaluative, and never a conclusion.

import { pilotQuestionById, isRedFlagValue, type PilotSectionId } from './pilot'

/** Separate axis from the structural lifecycle. */
export const DIGGING_REVIEW_STATUSES = [
  'clear', 'needs_clarification', 'needs_human_review', 'resolved',
] as const
export type DiggingReviewStatus = (typeof DIGGING_REVIEW_STATUSES)[number]

export const DIGGING_EDGE_VERSION = 'cockpit-digging.v1-pilot'

export interface DiggingTarget {
  /** Order within the branch. Lower is asked first. */
  sequence: number
  /** An approved registry question, where one exists. */
  targetQuestionId?: string
  /** A practitioner-asked prompt where no registry question exists. */
  practitionerPrompt?: string
  /** Canonical destination, where one exists. Empty means capture-only. */
  targetFieldIds: string[]
  required: boolean
  /** Does answering this count towards the branch being sufficient? */
  countsTowardsSufficiency: boolean
  /** What to do when the client genuinely does not know. Never treated as No. */
  unsureBehaviour: 'record_unsure_and_continue' | 'record_unsure_and_flag_clarification'
  rationale?: string
}

export interface DiggingEdge {
  id: string
  section: PilotSectionId
  /** The question whose answer can open this branch. */
  sourceQuestionId: string
  /** The concept the source question bears, for graph queries. */
  sourceConceptId: string | null
  /** The exact answer value(s) that open it. Verbatim approved options. */
  trigger: { anyOf: string[] }
  /** True where the trigger values are approved red flags, so opening this
   *  branch coincides with a safety item being raised. The branch does NOT
   *  raise the item — safetyLinks.ts does — and closing the branch does not
   *  close the item. */
  safetyLinked: boolean
  targets: DiggingTarget[]
  version: string
  reviewStatus: DiggingReviewStatus
  /** Why this branch exists, in the practitioner's terms. */
  rationale: string
  /** Where the clinical content came from. */
  source: 'ni_pilot_draft' | 'annex_1' | 'approved_registry_metadata'
}

const SHARED_CONCEPT = 'intake.systems.*.symptoms'

/**
 * The pilot digging edges.
 *
 * Deliberately few and deep rather than many and shallow: the pilot has to
 * demonstrate the whole chain for a branch that matters, not sketch twenty.
 *
 * `source: 'ni_pilot_draft'` on every edge is load-bearing. The prompts are
 * procedural wording written for this pilot. They are NOT Annex 1 content and
 * must not be presented as approved clinical rules — Annex 1 is not in the
 * repository (see ANNEX_1_STATUS in safetyLinks.ts).
 */
export const PILOT_DIGGING_EDGES: readonly DiggingEdge[] = Object.freeze([
  {
    id: 'dig.digestion.bowel_habit_change',
    section: 'digestion',
    sourceQuestionId: 'v2.digestion.noticed',
    sourceConceptId: SHARED_CONCEPT,
    trigger: { anyOf: ['A change in your usual bowel habit'] },
    safetyLinked: true,
    targets: [
      {
        sequence: 1,
        practitionerPrompt: 'Ask when the change began, and what it changed from and to.',
        targetFieldIds: [],
        required: true,
        countsTowardsSufficiency: true,
        unsureBehaviour: 'record_unsure_and_flag_clarification',
        rationale: 'When it started and what changed are the two facts a reviewing clinician will ask for first.',
      },
      {
        sequence: 2,
        targetQuestionId: 'v2.digestion.bowel_frequency',
        targetFieldIds: [],
        required: true,
        countsTowardsSufficiency: true,
        unsureBehaviour: 'record_unsure_and_continue',
        rationale: 'An approved question already asks this. Reuse it rather than invent a prompt.',
      },
      {
        sequence: 3,
        targetQuestionId: 'v2.digestion.stool_form',
        targetFieldIds: [],
        required: false,
        countsTowardsSufficiency: true,
        unsureBehaviour: 'record_unsure_and_continue',
      },
      {
        sequence: 4,
        practitionerPrompt: 'Ask whether anything else changed at the same time — diet, medicines, travel, stress.',
        targetFieldIds: [],
        required: false,
        countsTowardsSufficiency: false,
        unsureBehaviour: 'record_unsure_and_continue',
        rationale: 'Context, not sufficiency. Useful but its absence should not hold the branch open.',
      },
    ],
    version: DIGGING_EDGE_VERSION,
    reviewStatus: 'needs_human_review',
    rationale:
      'A change in usual bowel habit is an approved red-flag option. The branch gathers the ' +
      'factual detail a reviewer needs; it does not assess what the change means.',
    source: 'ni_pilot_draft',
  },
  {
    id: 'dig.digestion.blood_in_stool',
    section: 'digestion',
    sourceQuestionId: 'v2.digestion.noticed',
    sourceConceptId: SHARED_CONCEPT,
    trigger: { anyOf: ['Blood in the stool', 'Black, tar-like stool'] },
    safetyLinked: true,
    targets: [
      {
        sequence: 1,
        practitionerPrompt: 'Ask how long it has been happening, and whether it is still happening now.',
        targetFieldIds: [],
        required: true,
        countsTowardsSufficiency: true,
        unsureBehaviour: 'record_unsure_and_flag_clarification',
      },
      {
        sequence: 2,
        practitionerPrompt: 'Ask what they have actually seen — colour, and whether it is mixed through or on the surface.',
        targetFieldIds: [],
        required: true,
        countsTowardsSufficiency: true,
        unsureBehaviour: 'record_unsure_and_flag_clarification',
        rationale: 'Record the observation in the client\'s own terms. Do not interpret it here.',
      },
      {
        sequence: 3,
        practitionerPrompt: 'Ask whether they have already shown this to a GP or other clinician, and what was said.',
        targetFieldIds: [],
        required: true,
        countsTowardsSufficiency: true,
        unsureBehaviour: 'record_unsure_and_continue',
        rationale: 'Whether it is already in medical hands changes what NI should do next, and is a fact, not a judgement.',
      },
    ],
    version: DIGGING_EDGE_VERSION,
    reviewStatus: 'needs_human_review',
    rationale:
      'Both trigger values are approved red flags. Digging gathers detail for the human review ' +
      'that is already open; it never substitutes for it and cannot close it.',
    source: 'ni_pilot_draft',
  },
  {
    id: 'dig.digestion.reflux_pattern',
    section: 'digestion',
    sourceQuestionId: 'v2.digestion.noticed',
    sourceConceptId: SHARED_CONCEPT,
    trigger: { anyOf: ['Heartburn or reflux'] },
    safetyLinked: false,
    targets: [
      {
        sequence: 1,
        practitionerPrompt: 'Ask when it happens — after meals, lying down, at night.',
        targetFieldIds: [],
        required: true,
        countsTowardsSufficiency: true,
        unsureBehaviour: 'record_unsure_and_continue',
      },
      {
        sequence: 2,
        practitionerPrompt: 'Ask what they take for it, if anything, and how often.',
        targetFieldIds: [],
        required: true,
        countsTowardsSufficiency: true,
        unsureBehaviour: 'record_unsure_and_continue',
        rationale: 'Regular acid suppression is relevant to digestion and to nutrient status. Factual capture only.',
      },
    ],
    version: DIGGING_EDGE_VERSION,
    reviewStatus: 'clear',
    rationale: 'An ordinary non-safety branch, included so the pilot shows digging that is not red-flag driven.',
    source: 'ni_pilot_draft',
  },
  {
    id: 'dig.sleep.night_sweats_soaking',
    section: 'sleep',
    sourceQuestionId: 'v2.sleep.noticed',
    sourceConceptId: SHARED_CONCEPT,
    trigger: { anyOf: ['Night sweats that soak the bedding'] },
    safetyLinked: true,
    targets: [
      {
        sequence: 1,
        practitionerPrompt: 'Ask how long this has been happening, and how many nights in a usual week.',
        targetFieldIds: [],
        required: true,
        countsTowardsSufficiency: true,
        unsureBehaviour: 'record_unsure_and_flag_clarification',
      },
      {
        sequence: 2,
        practitionerPrompt: 'Ask whether weight, appetite or temperature have changed over the same period.',
        targetFieldIds: [],
        required: true,
        countsTowardsSufficiency: true,
        unsureBehaviour: 'record_unsure_and_continue',
        rationale:
          'These are facts a reviewer will want alongside the sweats. Asking them together is not ' +
          'NI drawing a link — the record states what was asked and answered, nothing more.',
      },
    ],
    version: DIGGING_EDGE_VERSION,
    reviewStatus: 'needs_human_review',
    rationale:
      'Soaking night sweats is the approved red flag; ordinary "Night sweats" is NOT and must not ' +
      'trigger this branch. The two option values are distinct and stay distinct.',
    source: 'ni_pilot_draft',
  },
  {
    id: 'dig.energy.unintended_weight_loss',
    section: 'energy_metabolic',
    sourceQuestionId: 'v2.energy.noticed',
    sourceConceptId: SHARED_CONCEPT,
    trigger: { anyOf: ['Weight going down without trying'] },
    safetyLinked: true,
    targets: [
      {
        sequence: 1,
        practitionerPrompt: 'Ask how much weight, over how long, and how they know.',
        targetFieldIds: [],
        required: true,
        countsTowardsSufficiency: true,
        unsureBehaviour: 'record_unsure_and_flag_clarification',
        rationale: '"How they know" matters: a measured change and an impression are different facts.',
      },
      {
        sequence: 2,
        practitionerPrompt: 'Ask whether appetite, eating pattern or activity have changed.',
        targetFieldIds: [],
        required: true,
        countsTowardsSufficiency: true,
        unsureBehaviour: 'record_unsure_and_continue',
      },
      {
        sequence: 3,
        practitionerPrompt: 'Ask whether a clinician is already aware of the weight change.',
        targetFieldIds: [],
        required: false,
        countsTowardsSufficiency: false,
        unsureBehaviour: 'record_unsure_and_continue',
      },
    ],
    version: DIGGING_EDGE_VERSION,
    reviewStatus: 'needs_human_review',
    rationale: 'Approved red-flag option. The branch records the quantity and the timeframe, and assesses nothing.',
    source: 'ni_pilot_draft',
  },
] as const)

// ── Queries ─────────────────────────────────────────────────────────────────

export function edgeById(id: string): DiggingEdge | undefined {
  return PILOT_DIGGING_EDGES.find((e) => e.id === id)
}

export function edgesForQuestion(questionId: string): DiggingEdge[] {
  return PILOT_DIGGING_EDGES.filter((e) => e.sourceQuestionId === questionId)
}

/**
 * Which branches a given set of selected values opens.
 *
 * Exact value matching against the approved option strings — no fuzzy
 * matching, no substring matching. "Night sweats" must not open the branch
 * belonging to "Night sweats that soak the bedding".
 */
export function edgesTriggeredBy(questionId: string, selectedValues: readonly string[]): DiggingEdge[] {
  return edgesForQuestion(questionId)
    .filter((e) => e.trigger.anyOf.some((t) => selectedValues.includes(t)))
}

/** Required target count, for sufficiency. */
export function requiredTargets(edge: DiggingEdge): DiggingTarget[] {
  return edge.targets.filter((t) => t.required)
}

export function sufficiencyTargets(edge: DiggingEdge): DiggingTarget[] {
  return edge.targets.filter((t) => t.countsTowardsSufficiency)
}

/** A stable key for one target within one branch. */
export function targetKey(edge: DiggingEdge, target: DiggingTarget): string {
  return target.targetQuestionId
    ? `${edge.id}::${target.targetQuestionId}`
    : `${edge.id}::seq${target.sequence}`
}

/** Targets in asking order. */
export function orderedTargets(edge: DiggingEdge): DiggingTarget[] {
  return [...edge.targets].sort((a, b) => a.sequence - b.sequence)
}

export interface DiggingGraphSummary {
  edges: number
  safetyLinkedEdges: number
  targets: number
  /** Targets reusing an approved registry question. */
  registryBackedTargets: number
  /** Targets that are practitioner prompts with no registry question. */
  promptOnlyTargets: number
  /** Targets with a canonical destination. Zero until mappings are approved. */
  targetsWithCanonicalField: number
  byReviewStatus: Record<DiggingReviewStatus, number>
}

export function summariseDiggingGraph(): DiggingGraphSummary {
  const all = PILOT_DIGGING_EDGES.flatMap((e) => e.targets)
  return {
    edges: PILOT_DIGGING_EDGES.length,
    safetyLinkedEdges: PILOT_DIGGING_EDGES.filter((e) => e.safetyLinked).length,
    targets: all.length,
    registryBackedTargets: all.filter((t) => t.targetQuestionId).length,
    promptOnlyTargets: all.filter((t) => !t.targetQuestionId).length,
    targetsWithCanonicalField: all.filter((t) => t.targetFieldIds.length > 0).length,
    byReviewStatus: Object.fromEntries(
      DIGGING_REVIEW_STATUSES.map((s) => [s, PILOT_DIGGING_EDGES.filter((e) => e.reviewStatus === s).length]),
    ) as Record<DiggingReviewStatus, number>,
  }
}

/**
 * Consistency check: an edge claiming to be safety-linked must actually
 * trigger on approved red-flag values, and one claiming not to must not.
 *
 * Returns the problems. A test asserts it is empty — so a future edge cannot
 * quietly mislabel its own safety status.
 */
export function validateDiggingEdges(): string[] {
  const problems: string[] = []
  for (const e of PILOT_DIGGING_EDGES) {
    const q = pilotQuestionById(e.sourceQuestionId)
    if (!q) {
      problems.push(`${e.id}: source question ${e.sourceQuestionId} is not a pilot question`)
      continue
    }
    for (const t of e.trigger.anyOf) {
      if (!(q.options ?? []).includes(t)) {
        problems.push(`${e.id}: trigger "${t}" is not an approved option of ${q.id}`)
      }
    }
    const anyRedFlag = e.trigger.anyOf.some((t) => isRedFlagValue(e.sourceQuestionId, t))
    if (anyRedFlag && !e.safetyLinked) {
      problems.push(`${e.id}: triggers on an approved red flag but is not marked safetyLinked`)
    }
    if (!anyRedFlag && e.safetyLinked) {
      problems.push(`${e.id}: marked safetyLinked but no trigger value is an approved red flag`)
    }
    const seqs = e.targets.map((t) => t.sequence)
    if (new Set(seqs).size !== seqs.length) problems.push(`${e.id}: duplicate target sequence`)
    if (e.targets.length === 0) problems.push(`${e.id}: has no targets`)
    for (const t of e.targets) {
      if (!t.targetQuestionId && !t.practitionerPrompt) {
        problems.push(`${e.id}: target ${t.sequence} has neither a question nor a prompt`)
      }
      if (t.required && !t.countsTowardsSufficiency) {
        problems.push(`${e.id}: target ${t.sequence} is required but does not count towards sufficiency`)
      }
    }
  }
  return problems
}
