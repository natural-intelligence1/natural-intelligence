// ─── packages/db/src/intakeV2/synopsis.ts ────────────────────────────────────
// THE FACTUAL HEALTH STORY BUILDER — answers in, factual synopsis out.
//
// This is the piece the implementation audit found missing: a deterministic
// answers→synopsis generator. It is PURE (no DB, no network, no model call),
// so what it produces is reproducible and testable line by line.
//
// WHAT IT MAY DO: organise, summarise, deduplicate, link, order chronologically,
// and surface what is missing or uncertain.
//
// WHAT IT MAY NEVER DO: diagnose, assign root cause, rank clinical priority,
// recommend treatment, choose urgency, or produce a practitioner conclusion.
// Two structural guarantees enforce that here, not by convention:
//
//   1. Practitioner interpretation is FILTERED OUT of every factual section.
//      It is carried separately so a caller must deliberately choose to show
//      it — it can never leak into the factual story by accident.
//   2. Body-system areas appear only as "under consideration", taken from what
//      the client indicated. `systems under stress` is practitioner-authored
//      and this builder will not emit it at all.

import type { V2SourcedFact, V2Provenance } from './provenance'
import { isPractitionerOnlyProvenance } from './provenance'
import type { ConcernCard, ClarificationItem } from './concerns'
import { concernsInClientOrder, influencesForConcern } from './concerns'
import type { InfluenceRecord } from './influences'
import { INFLUENCE_KIND_LABELS } from './influences'
import type { V2CaseSnapshot } from './caseSnapshot'
import type { DatedUpdate } from './updates'
import { buildSinceLastReview } from './updates'

// ─── Output shape ────────────────────────────────────────────────────────────

export const SYNOPSIS_SECTION_IDS = [
  'why_here', 'what_better_looks_like', 'main_concerns', 'strengths',
  'timeline', 'medicines', 'evidence', 'streams_under_consideration',
  'safety_awaiting_review', 'questions_worth_asking', 'dated_updates',
] as const
export type SynopsisSectionId = (typeof SYNOPSIS_SECTION_IDS)[number]

export const SYNOPSIS_SECTION_TITLES: Record<SynopsisSectionId, string> = {
  why_here:                    'Why they are here',
  what_better_looks_like:      'What better looks like',
  main_concerns:               'Main concerns',
  strengths:                   'Strengths and what helps',
  timeline:                    'Timeline',
  medicines:                   'Medicines and supplements',
  evidence:                    'Evidence and documents',
  streams_under_consideration: 'Health streams under consideration',
  safety_awaiting_review:      'Safety items awaiting human review',
  questions_worth_asking:      'Questions still worth asking',
  dated_updates:               'Dated updates since submission',
}

/** Everything needed to answer: who supplied it, from what source, when,
 *  documented or reported, clarified or corrected. */
export interface SynopsisItem {
  label: string
  /** Display value. For a corrected fact this is the correction; the original
   *  is always still present in `originalValue`. */
  value: string
  provenance: V2Provenance
  provenanceLabel: string
  /** Present whenever a correction exists — the client's original, verbatim. */
  originalValue?: string
  /** The client's own words where NI imposed any structure. */
  originalWording?: string
  sourceRef?: string
  capturedAt?: string
  correctedBy?: string
  correctedAt?: string
  /** Link targets so the UI can navigate to source. */
  concernId?: string
}

export interface SynopsisSection {
  id: SynopsisSectionId
  title: string
  items: SynopsisItem[]
  /** Shown instead of items — always explicit, never a blank space. */
  emptyState?: string
}

export interface FactualSynopsis {
  sections: SynopsisSection[]
  meta: {
    generatedAt: string
    /** Field/record ids that contributed, for the audit trail. */
    sourceRefs: string[]
    /** Count of practitioner-interpretation items deliberately withheld. */
    interpretationWithheld: number
    schemaVersion: string
  }
}

export const SYNOPSIS_BUILDER_VERSION = 'factual-synopsis.v1'

const PROVENANCE_LABELS: Record<V2Provenance, string> = {
  client_reported:                        'Client reported',
  practitioner_verified:                  'Practitioner verified',
  corrected:                              'Corrected',
  missing:                                'Not answered',
  documented_record:                      'Documented record',
  unconfirmed:                            'Unconfirmed',
  not_asked:                              'Not asked',
  declined:                               'Preferred to discuss',
  system_organised:                       'Organised by NI',
  system_structured_from_client_language: 'Structured from client’s words',
  practitioner_interpreted:               'Practitioner interpretation',
}

export function provenanceLabel(p: V2Provenance): string {
  return PROVENANCE_LABELS[p]
}

// ─── Input ───────────────────────────────────────────────────────────────────

export interface SynopsisInput {
  snapshot?: V2CaseSnapshot
  concerns: ConcernCard[]
  influences: InfluenceRecord[]
  /** Safety items already captured by clinician-owned question metadata. */
  safetyItems: { id: string; questionLabel: string; matchedOptions: string[]; capturedAt: string | null; reviewStatus: string }[]
  clarifications: ClarificationItem[]
  medicines: { name: V2SourcedFact<string>; detail?: string }[]
  evidence: { id: string; title: string; kind: string; receivedAt: string; verified: boolean }[]
  /** Body-system areas the CLIENT indicated. Never "under stress". */
  streamsUnderConsideration: string[]
  timeline: { id: string; at: string; summary: V2SourcedFact<string>; concernId?: string }[]
  updates: DatedUpdate[]
  lastReviewAt?: string | null
  generatedAt: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toItem(
  label: string, fact: V2SourcedFact<unknown>, extra: Partial<SynopsisItem> = {},
): SynopsisItem | null {
  // Structural guarantee #1: practitioner interpretation never enters a
  // factual section.
  if (isPractitionerOnlyProvenance(fact.provenance) && fact.provenance === 'practitioner_interpreted') {
    return null
  }
  const displayed = fact.correction ? fact.correction.value : fact.value
  if (displayed === null || displayed === undefined || displayed === '') {
    // Absence is still reportable — but only as absence, never as a negative.
    if (fact.provenance === 'missing' || fact.provenance === 'not_asked' || fact.provenance === 'declined') {
      return {
        label, value: '—', provenance: fact.provenance,
        provenanceLabel: provenanceLabel(fact.provenance), ...extra,
      }
    }
    return null
  }
  return {
    label,
    value: String(displayed),
    provenance: fact.provenance,
    provenanceLabel: provenanceLabel(fact.provenance),
    ...(fact.correction ? {
      originalValue: String(fact.value),
      correctedBy: fact.correction.actor,
      correctedAt: fact.correction.at,
    } : {}),
    ...(fact.originalWording ? { originalWording: fact.originalWording } : {}),
    ...(fact.sourceRef ? { sourceRef: fact.sourceRef } : {}),
    ...(fact.capturedAt ? { capturedAt: fact.capturedAt } : {}),
    ...extra,
  }
}

function countInterpretation(input: SynopsisInput): number {
  let n = 0
  const scan = (f?: V2SourcedFact<unknown>) => {
    if (!f) return
    if (f.provenance === 'practitioner_interpreted') n++
    if (f.interpretation) n++
  }
  for (const c of input.concerns) {
    scan(c.ownWords); scan(c.label); scan(c.desiredImprovement); scan(c.onset)
    scan(c.course); scan(c.pattern); scan(c.impact); scan(c.whatHelps)
    scan(c.alreadyTried); scan(c.previousCare)
  }
  for (const t of input.timeline) scan(t.summary)
  for (const m of input.medicines) scan(m.name)
  return n
}

// ─── The builder ─────────────────────────────────────────────────────────────

export function buildFactualSynopsis(input: SynopsisInput): FactualSynopsis {
  const sections: SynopsisSection[] = []
  const sourceRefs = new Set<string>()
  const ordered = concernsInClientOrder(input.concerns)
  const track = (item: SynopsisItem | null) => {
    if (item?.sourceRef) sourceRefs.add(item.sourceRef)
    return item
  }

  const push = (id: SynopsisSectionId, items: (SynopsisItem | null)[], emptyState: string) => {
    const clean = items.filter((i): i is SynopsisItem => i !== null)
    sections.push({
      id, title: SYNOPSIS_SECTION_TITLES[id], items: clean,
      ...(clean.length === 0 ? { emptyState } : {}),
    })
  }

  // 1 — Why they are here: the client's own words, first concern first.
  push('why_here',
    ordered.slice(0, 3).map((c) => track(toItem('In their words', c.ownWords, { concernId: c.id }))),
    'No presenting concern was recorded.')

  // 2 — What better looks like.
  push('what_better_looks_like',
    ordered.map((c) => c.desiredImprovement
      ? track(toItem(String(c.label.value ?? 'Concern'), c.desiredImprovement, { concernId: c.id }))
      : null),
    'The client has not yet described what better would look like.')

  // 3 — Main concerns, in the client's order. No ranking is applied.
  push('main_concerns',
    ordered.flatMap((c) => [
      track(toItem(String(c.label.value ?? 'Concern'), c.ownWords, { concernId: c.id })),
      c.onset   ? track(toItem('Started', c.onset,   { concernId: c.id })) : null,
      c.pattern ? track(toItem('Pattern', c.pattern, { concernId: c.id })) : null,
      c.impact  ? track(toItem('Impact',  c.impact,  { concernId: c.id })) : null,
    ]),
    'No concerns were recorded.')

  // 4 — Strengths: protective influences plus anything the client said helps.
  const protective = input.influences.filter((i) => i.kind === 'protective')
  push('strengths', [
    ...protective.map((i) => ({
      label: INFLUENCE_KIND_LABELS.protective,
      value: i.summary,
      provenance: 'system_structured_from_client_language' as V2Provenance,
      provenanceLabel: provenanceLabel('system_structured_from_client_language'),
      originalWording: i.originalWording,
      capturedAt: i.capturedAt,
      ...(i.concernId ? { concernId: i.concernId } : {}),
    })),
    ...ordered.map((c) => c.whatHelps
      ? track(toItem('What helps', c.whatHelps, { concernId: c.id })) : null),
  ], 'Nothing has been recorded yet about what helps.')

  // 5 — Timeline, chronological. Order only; no narrative is inferred.
  push('timeline',
    [...input.timeline]
      .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
      .map((t) => track(toItem(
        new Date(t.at).toISOString().slice(0, 10), t.summary,
        { ...(t.concernId ? { concernId: t.concernId } : {}) },
      ))),
    'No dated events were recorded.')

  // 6 — Medicines and supplements.
  push('medicines',
    input.medicines.map((m) => track(toItem(m.detail ?? 'Current', m.name))),
    'No medicines or supplements were recorded.')

  // 7 — Evidence, with verification state stated plainly.
  push('evidence', input.evidence.map((e) => ({
    label: e.kind,
    value: e.title,
    provenance: (e.verified ? 'documented_record' : 'unconfirmed') as V2Provenance,
    provenanceLabel: provenanceLabel(e.verified ? 'documented_record' : 'unconfirmed'),
    sourceRef: e.id,
    capturedAt: e.receivedAt,
  })), 'No documents or results have been provided.')

  // 8 — Streams UNDER CONSIDERATION. Structural guarantee #2: this builder
  // never emits "systems under stress"; that is practitioner-authored.
  push('streams_under_consideration', input.streamsUnderConsideration.map((s) => ({
    label: 'Indicated by client',
    value: s,
    provenance: 'client_reported' as V2Provenance,
    provenanceLabel: provenanceLabel('client_reported'),
  })), 'The client did not indicate any particular area.')

  // 9 — Safety items awaiting a human. NI surfaces; a person decides.
  push('safety_awaiting_review', input.safetyItems.map((s) => ({
    label: s.questionLabel,
    value: s.matchedOptions.join(', '),
    provenance: 'client_reported' as V2Provenance,
    provenanceLabel: provenanceLabel('client_reported'),
    sourceRef: s.id,
    ...(s.capturedAt ? { capturedAt: s.capturedAt } : {}),
  })), 'No safety items are awaiting review.')

  // 10 — Questions still worth asking (gaps, never significance).
  push('questions_worth_asking', input.clarifications.map((c) => ({
    label: c.reason.replace(/_/g, ' '),
    value: c.prompt,
    provenance: 'system_organised' as V2Provenance,
    provenanceLabel: provenanceLabel('system_organised'),
    ...(c.fieldRef ? { sourceRef: c.fieldRef } : {}),
    ...(c.concernId ? { concernId: c.concernId } : {}),
    capturedAt: c.createdAt,
  })), 'Nothing is outstanding.')

  // 11 — Dated updates since the last review (or since submission).
  const since = buildSinceLastReview(input.updates, input.lastReviewAt ?? null, input.generatedAt)
  push('dated_updates', since.sections.flatMap((s) => s.entries.map((u) => ({
    label: s.label,
    value: u.statement,
    provenance: (u.authorRole === 'client' ? 'client_reported' : 'system_organised') as V2Provenance,
    provenanceLabel: provenanceLabel(u.authorRole === 'client' ? 'client_reported' : 'system_organised'),
    sourceRef: u.sourceRef,
    capturedAt: u.at,
    ...(u.concernId ? { concernId: u.concernId } : {}),
  }))), 'Nothing has changed since submission.')

  for (const e of input.evidence) sourceRefs.add(e.id)

  return {
    sections,
    meta: {
      generatedAt: input.generatedAt,
      sourceRefs: [...sourceRefs].sort(),
      interpretationWithheld: countInterpretation(input),
      schemaVersion: SYNOPSIS_BUILDER_VERSION,
    },
  }
}

/**
 * Guard for tests and callers: true when every item in the synopsis is
 * factual. Any practitioner-interpretation state present means the factual
 * boundary has been breached.
 */
export function containsOnlyFactualProvenance(synopsis: FactualSynopsis): boolean {
  return synopsis.sections.every((s) =>
    s.items.every((i) => i.provenance !== 'practitioner_interpreted'))
}

/** Every item can answer who/what/when — the provenance contract. */
export function everyItemHasProvenance(synopsis: FactualSynopsis): boolean {
  return synopsis.sections.every((s) =>
    s.items.every((i) => !!i.provenance && !!i.provenanceLabel))
}
