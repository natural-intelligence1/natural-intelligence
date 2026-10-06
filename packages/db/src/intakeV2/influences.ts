// ─── packages/db/src/intakeV2/influences.ts ──────────────────────────────────
// "What may be influencing your health" — the ATM container (antecedent,
// trigger, mediator/perpetuator) plus protective factors.
//
// THE RULE THAT GOVERNS THIS WHOLE FILE:
// NI only ever records a relationship the CLIENT EXPLICITLY EXPRESSED, in
// their own words, with an identifiable linguistic cue. NI never infers a
// relationship, and never derives causality from timing alone — "it started in
// March" and "I had a bad winter" are chronology, not cause, no matter how
// suggestive the sequence looks.
//
// Everything stored here is therefore attributable: the client's original
// wording, the cue that justified structuring it, who originated it, and
// whether a practitioner has reviewed it. A practitioner may add their own
// influence, but it is marked as theirs and never presented as the client's.

import type { V2SourcedFact } from './provenance'
import { systemStructuredFromClientLanguage } from './provenance'

export const INFLUENCE_KINDS = ['antecedent', 'trigger', 'mediator', 'protective'] as const
export type InfluenceKind = (typeof INFLUENCE_KINDS)[number]

export const INFLUENCE_KIND_LABELS: Record<InfluenceKind, string> = {
  antecedent: 'Something that came before',
  trigger:    'Something that may have set it off',
  mediator:   'Something that may be keeping it going',
  protective: 'Something that helps',
}

export type InfluenceOrigin = 'client_explicit' | 'practitioner_added'
export type InfluenceReviewState = 'awaiting_review' | 'reviewed_kept' | 'reviewed_set_aside'

export interface InfluenceRecord {
  id: string
  /** The concern this relates to, when the client tied it to one. */
  concernId: string | null
  kind: InfluenceKind
  /** What NI structured — short, neutral, never clinical. */
  summary: string
  /** The client's own sentence, preserved verbatim. Required. */
  originalWording: string
  /** The exact phrase that justified structuring this as a relationship. */
  linguisticCue: string
  origin: InfluenceOrigin
  /** Practitioners review client-expressed links; they are never auto-accepted. */
  reviewState: InfluenceReviewState
  reviewedBy?: string
  reviewedAt?: string
  /** Where the client said it, so it can be shown in context. */
  clientViewWhereDiscussed: string
  capturedAt: string
}

// ─── Cue detection ───────────────────────────────────────────────────────────

/**
 * Phrases in which a client is explicitly linking two things. Deliberately
 * conservative: every entry asserts a RELATION, not a date. Missing a real
 * link is a recoverable omission (the practitioner asks); inventing one is not.
 */
const CAUSAL_CUES: { cue: RegExp; kinds: InfluenceKind[] }[] = [
  { cue: /\bbecause of\b/i,            kinds: ['antecedent', 'trigger', 'mediator'] },
  { cue: /\bbecause\b/i,               kinds: ['antecedent', 'trigger', 'mediator'] },
  { cue: /\bever since\b/i,            kinds: ['trigger'] },
  { cue: /\bstarted after\b/i,         kinds: ['trigger'] },
  { cue: /\bbegan after\b/i,           kinds: ['trigger'] },
  { cue: /\bafter I (started|had|went|came)\b/i, kinds: ['trigger'] },
  { cue: /\bbrought (it|them) on\b/i,  kinds: ['trigger'] },
  { cue: /\btriggers?\b/i,             kinds: ['trigger'] },
  { cue: /\bsets? (it|them) off\b/i,   kinds: ['trigger'] },
  { cue: /\bflares? up when\b/i,       kinds: ['trigger'] },
  { cue: /\bmakes? (it|them) worse\b/i, kinds: ['mediator'] },
  { cue: /\bworse when\b/i,            kinds: ['mediator'] },
  { cue: /\bkeeps? (it|them) going\b/i, kinds: ['mediator'] },
  { cue: /\bstops? me\b/i,             kinds: ['mediator'] },
  { cue: /\bhelps?\b/i,                kinds: ['protective'] },
  { cue: /\beases?\b/i,                kinds: ['protective'] },
  { cue: /\bbetter when\b/i,           kinds: ['protective'] },
  { cue: /\bonly thing that works\b/i, kinds: ['protective'] },
  { cue: /\bI (think|reckon) it('s| is| was)? (down to|caused by)\b/i, kinds: ['antecedent', 'trigger'] },
  { cue: /\bever since (my|the)\b/i,   kinds: ['antecedent', 'trigger'] },
]

/**
 * Pure chronology. Present on its own, these NEVER justify a relationship —
 * they are the exact trap this module exists to avoid.
 */
const TEMPORAL_ONLY = [
  /\b(it |this |symptoms? )?(started|began|came on)\s+(in|on|around|about)?\s*(january|february|march|april|may|june|july|august|september|october|november|december|\d{4}|\d+\s*(days?|weeks?|months?|years?)\s*ago)\b/i,
  /\b(for|about|around)\s+\d+\s*(days?|weeks?|months?|years?)\b/i,
  /\b(last|this)\s+(winter|summer|spring|autumn|year|month|week)\b/i,
]

export interface CueDetection {
  /** The matched phrase, or null when the client expressed no relationship. */
  cue: string | null
  /** Kinds this cue could support. Empty when there is no cue. */
  candidateKinds: InfluenceKind[]
  /** True when the text is chronology only — explicitly NOT a relationship. */
  temporalOnly: boolean
}

/**
 * Does this client statement explicitly express a relationship? Returns the
 * cue if so. A statement that only locates something in time returns no cue,
 * with `temporalOnly` set so callers can say WHY nothing was structured.
 */
export function detectClientExpressedLink(statement: string): CueDetection {
  const text = (statement ?? '').trim()
  if (!text) return { cue: null, candidateKinds: [], temporalOnly: false }

  for (const { cue, kinds } of CAUSAL_CUES) {
    const match = text.match(cue)
    if (match) return { cue: match[0], candidateKinds: kinds, temporalOnly: false }
  }
  const temporalOnly = TEMPORAL_ONLY.some((p) => p.test(text))
  return { cue: null, candidateKinds: [], temporalOnly }
}

export interface BuildInfluenceInput {
  id: string
  concernId?: string | null
  statement: string
  /** Which kind the client's wording supports. Must be a candidate kind. */
  kind: InfluenceKind
  summary: string
  clientViewWhereDiscussed: string
  capturedAt: string
}

export interface BuildInfluenceResult {
  influence: InfluenceRecord | null
  /** Why nothing was created, for the Call Sheet ("worth asking about"). */
  refusedReason?: 'no_explicit_link' | 'timing_only' | 'kind_not_supported_by_wording'
}

/**
 * Build an influence from a client statement — or refuse. Refusal is a normal,
 * useful outcome: it means a practitioner should ask, not that NI should guess.
 */
export function buildInfluenceFromClientStatement(
  input: BuildInfluenceInput,
): BuildInfluenceResult {
  const detection = detectClientExpressedLink(input.statement)

  if (!detection.cue) {
    return {
      influence: null,
      refusedReason: detection.temporalOnly ? 'timing_only' : 'no_explicit_link',
    }
  }
  if (!detection.candidateKinds.includes(input.kind)) {
    return { influence: null, refusedReason: 'kind_not_supported_by_wording' }
  }

  return {
    influence: {
      id: input.id,
      concernId: input.concernId ?? null,
      kind: input.kind,
      summary: input.summary,
      originalWording: input.statement.trim(),
      linguisticCue: detection.cue,
      origin: 'client_explicit',
      reviewState: 'awaiting_review',
      clientViewWhereDiscussed: input.clientViewWhereDiscussed,
      capturedAt: input.capturedAt,
    },
  }
}

/** A practitioner's own influence. Marked as theirs; never shown as the
 *  client's words, and it carries no client wording to misattribute. */
export function practitionerAddedInfluence(input: {
  id: string
  concernId?: string | null
  kind: InfluenceKind
  summary: string
  practitionerId: string
  at: string
}): InfluenceRecord {
  return {
    id: input.id,
    concernId: input.concernId ?? null,
    kind: input.kind,
    summary: input.summary,
    originalWording: '',
    linguisticCue: '',
    origin: 'practitioner_added',
    reviewState: 'reviewed_kept',
    reviewedBy: input.practitionerId,
    reviewedAt: input.at,
    clientViewWhereDiscussed: 'Added by practitioner',
    capturedAt: input.at,
  }
}

/** The client-facing fact for an influence — always carries their wording. */
export function influenceAsSourcedFact(influence: InfluenceRecord): V2SourcedFact<string> {
  return systemStructuredFromClientLanguage(influence.summary, influence.originalWording)
}

/** Practitioner review of a client-expressed link. Setting one aside never
 *  deletes it — the client's words remain on the record. */
export function reviewInfluence(
  influence: InfluenceRecord, keep: boolean, practitionerId: string, at: string,
): InfluenceRecord {
  return {
    ...influence,
    reviewState: keep ? 'reviewed_kept' : 'reviewed_set_aside',
    reviewedBy: practitionerId,
    reviewedAt: at,
  }
}
