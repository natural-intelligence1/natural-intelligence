// ─── packages/db/src/cockpit/synopsisContribution.ts ────────────────────────
// The last link in the acceptance chain:
//
//   QUESTION → CONCEPT → FIELD → GUIDANCE → DIGGING → SAFETY → PROVENANCE
//   → SYNOPSIS CONTRIBUTION
//
// WHAT THIS DOES, AND WHAT IT CAREFULLY DOES NOT
//
// It reports where each captured answer WOULD land in the practitioner
// synopsis, using the existing field registry's own `synopsisSection`. It does
// not write a synopsis, does not compose prose about the client, and does not
// summarise — `synopsis.ts`/`synopsisMapping.ts` already own that and are not
// reimplemented here.
//
// Every contribution is reported as PROJECTED while the mapping is
// unapproved, because that is the truth: the destination is known, the write
// is not permitted. A contribution that claimed to be live would make the
// chain look complete when its last link is open.

import { V2_FIELD_REGISTRY } from '../intakeV2/fieldRegistry'
import type { V2SynopsisSectionId } from '../intakeV2/fieldRegistry'
import { type CaptureState, type CapturedAnswer } from './capture'
import { mappingFor, canPersistCanonically } from './mappingPack'
import { describeConceptReference, type ConceptReference } from './conceptReference'
import { pilotQuestionById, type PilotSectionId } from './pilot'

export type ContributionState =
  /** Mapping APPROVED and the field exists — the answer would be written. */
  | 'live'
  /** Destination known, write blocked pending mapping approval. */
  | 'projected'
  /** No canonical destination exists at all. */
  | 'no_destination'

export interface SynopsisContribution {
  questionId: string
  section: PilotSectionId
  questionLabel: string
  conceptRef: ConceptReference | null
  fieldIds: string[]
  /** Where the field registry says this lands. Null where the field is not
   *  shown in the synopsis, or where there is no field. */
  synopsisSections: Array<V2SynopsisSectionId | null>
  state: ContributionState
  /** The value as captured, verbatim. Never re-worded. */
  value: unknown
  provenance: string
  /** Why it is not live, where it is not. */
  blockReason: string | null
}

function synopsisSectionsFor(fieldIds: readonly string[]): Array<V2SynopsisSectionId | null> {
  return fieldIds.map((id) => V2_FIELD_REGISTRY.find((f) => f.id === id)?.synopsisSection ?? null)
}

/** Where one captured answer would land. */
export function contributionFor(answer: CapturedAnswer): SynopsisContribution | null {
  const q = pilotQuestionById(answer.questionId)
  if (!q) return null
  const m = mappingFor(answer.questionId)
  const fieldIds = m?.fieldIds ?? []

  const state: ContributionState = fieldIds.length === 0
    ? 'no_destination'
    : canPersistCanonically(answer.questionId) ? 'live' : 'projected'

  return {
    questionId: answer.questionId,
    section: answer.section,
    questionLabel: q.label,
    conceptRef: m?.conceptRef ?? null,
    fieldIds,
    synopsisSections: synopsisSectionsFor(fieldIds),
    state,
    value: answer.value,
    provenance: answer.provenance,
    blockReason: state === 'live' ? null : (answer.canonicalBlockReason ?? m?.gap ?? null),
  }
}

/** Every contribution the current capture would make. */
export function contributions(state: CaptureState, section?: PilotSectionId): SynopsisContribution[] {
  return Object.values(state.answers)
    .filter((a) => section === undefined || a.section === section)
    .map(contributionFor)
    .filter((c): c is SynopsisContribution => c !== null)
}

export interface ChainLink {
  name: string
  /** Is this link demonstrable for the question under test? */
  present: boolean
  detail: string
}

/**
 * The acceptance chain, resolved for one question against real state.
 *
 * Returns a link per stage with whether it is genuinely present, so the
 * pilot's central claim can be checked rather than asserted. `field` is
 * present when a canonical destination EXISTS; whether it may be WRITTEN is
 * the separate `persisted` flag — conflating those two is exactly how a pilot
 * comes to look finished while nothing is stored.
 */
export function resolveChain(args: {
  questionId: string
  state: CaptureState
  hasGuidance: boolean
  safetyItemCount: number
}): { links: ChainLink[]; complete: boolean; persisted: boolean } {
  const { questionId, state } = args
  const q = pilotQuestionById(questionId)
  const m = mappingFor(questionId)
  const answer = state.answers[questionId]
  const branches = Object.values(state.branches).filter((b) => {
    const edgeSource = b.openedBy.length > 0
    return edgeSource && b.section === (q?.section as PilotSectionId)
  })

  const links: ChainLink[] = [
    {
      name: 'QUESTION', present: !!q,
      detail: q ? `${q.id} — approved registry question` : 'not a pilot question',
    },
    {
      name: 'CONCEPT + VARIANT', present: !!m?.conceptRef && (!m.conceptRef.conceptId.includes('*') || !!m.conceptRef.variant),
      detail: m?.conceptRef ? describeConceptReference(m.conceptRef) : 'no concept (no destination field to resolve one from)',
    },
    {
      name: 'FIELD', present: (m?.fieldIds.length ?? 0) > 0,
      detail: (m?.fieldIds.length ?? 0) > 0
        ? `${m!.fieldIds.join(', ')} — mapping ${m!.status}`
        : 'no canonical field exists; needs a registry decision',
    },
    {
      name: 'GUIDANCE', present: args.hasGuidance,
      detail: args.hasGuidance ? 'guide blocks rendered for this question' : 'no guidance resolved',
    },
    {
      name: 'DIGGING', present: branches.length > 0,
      detail: branches.length > 0
        ? `${branches.length} branch(es) opened: ${branches.map((b) => b.edgeId).join(', ')}`
        : 'no branch opened by the current answer',
    },
    {
      name: 'SAFETY', present: args.safetyItemCount > 0,
      detail: args.safetyItemCount > 0
        ? `${args.safetyItemCount} item(s) awaiting human review`
        : 'no red flag reported for this question',
    },
    {
      name: 'PROVENANCE', present: !!answer,
      detail: answer ? `${answer.provenance} · ${answer.actor.displayName}` : 'nothing captured yet',
    },
    {
      name: 'SYNOPSIS CONTRIBUTION', present: !!answer && (m?.fieldIds.length ?? 0) > 0,
      detail: answer
        ? (() => {
            const c = contributionFor(answer)
            return c
              ? `${c.state} → ${c.synopsisSections.filter(Boolean).join(', ') || 'not shown in synopsis'}`
              : 'no contribution'
          })()
        : 'nothing captured yet',
    },
  ]

  return {
    links,
    complete: links.every((l) => l.present),
    persisted: canPersistCanonically(questionId),
  }
}

export interface ContributionSummary {
  total: number
  live: number
  projected: number
  noDestination: number
  /** True while no captured answer can reach the canonical record. */
  nothingPersisted: boolean
}

export function summariseContributions(state: CaptureState): ContributionSummary {
  const all = contributions(state)
  const by = (s: ContributionState) => all.filter((c) => c.state === s).length
  return {
    total: all.length,
    live: by('live'),
    projected: by('projected'),
    noDestination: by('no_destination'),
    nothingPersisted: all.every((c) => c.state !== 'live'),
  }
}
