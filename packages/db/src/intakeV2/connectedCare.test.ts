// Connected-care layer — the behaviours the overnight mission requires proof of.
// Pure unit tests, synthetic data only, no database.

import { describe, it, expect } from 'vitest'
import { JOURNEY, unmappedSections, journeyProgress, chapterForSection } from './journey'
import {
  newBranch, recordAnswer, isFactuallySufficient, summariseBranch, reopenBranch, wasNeverAsked,
} from './branchLifecycle'
import {
  clientReported, correctFact, notAsked, declined, missingFact,
  isAffirmativeClientAnswer, interpretFact, V2_PROVENANCE_STATES,
} from './provenance'
import {
  detectClientExpressedLink, buildInfluenceFromClientStatement, practitionerAddedInfluence,
} from './influences'
import type { InfluenceRecord } from './influences'
import { deriveClarificationItems } from './concerns'
import type { ConcernCard } from './concerns'
import { buildFactualSynopsis, containsOnlyFactualProvenance, everyItemHasProvenance } from './synopsis'
import type { SynopsisInput } from './synopsis'
import { buildSinceLastReview, describeSequence } from './updates'
import type { DatedUpdate } from './updates'
import { canSignClinicalConclusions, canVerifyClinicalFacts } from './governanceControls'

const NOW = '2026-10-06T09:00:00.000Z'

// ─── Canonical journey ───────────────────────────────────────────────────────

describe('canonical journey — one definition drives everything', () => {
  it('has exactly the ten approved chapters, in order', () => {
    expect(JOURNEY).toHaveLength(10)
    expect(JOURNEY.map((c) => c.id)).toEqual([
      'welcome', 'about_you', 'what_matters', 'whole_health', 'relevant_areas',
      'health_story', 'influences', 'foundations', 'review', 'submit',
    ])
  })

  it('claims every section in the live V2 registry — nothing can fall out of the journey', () => {
    expect(unmappedSections()).toEqual([])
  })

  it('never exposes internal depth terminology to clients', () => {
    const clientText = JOURNEY.map((c) => `${c.title} ${c.intro}`).join(' ')
    expect(clientText).not.toMatch(/\bL[123]\b/)
    expect(clientText.toLowerCase()).not.toContain('branch')
    expect(clientText.toLowerCase()).not.toContain('registry')
  })

  it('maps a conditional system section into Exploring relevant areas', () => {
    expect(chapterForSection('digestion')?.id).toBe('relevant_areas')
  })

  it('reports progress only against sections this client can actually see', () => {
    const progress = journeyProgress(['arrival', 'about'], ['arrival'])
    const welcome = progress.find((p) => p.chapter === 'welcome')!
    const aboutYou = progress.find((p) => p.chapter === 'about_you')!
    const areas = progress.find((p) => p.chapter === 'relevant_areas')!
    expect(welcome.state).toBe('complete')
    expect(aboutYou.state).toBe('not_started')
    // Branches that never opened are not counted against the client.
    expect(areas.visibleSections).toBe(0)
  })
})

// ─── Branch lifecycle ────────────────────────────────────────────────────────

describe('branch lifecycle', () => {
  const required = ['q1', 'q2']

  it('activates when the client answers, and only then', () => {
    const b = newBranch('digestion', required)
    expect(b.state).toBe('collapsed')
    expect(wasNeverAsked(b)).toBe(true)
    const after = recordAnswer(b, 'q1', NOW)
    expect(after.state).toBe('expanded')
    expect(wasNeverAsked(after)).toBe(false)
  })

  it('closes ONLY when factually sufficient', () => {
    let b = newBranch('digestion', required)
    b = recordAnswer(b, 'q1', NOW)
    expect(isFactuallySufficient(b)).toBe(false)
    expect(b.state).toBe('expanded')

    b = recordAnswer(b, 'q2', NOW)
    expect(isFactuallySufficient(b)).toBe(true)
    expect(b.state).toBe('factually_sufficient')
  })

  it('reopens on later information WITHOUT losing answers, and records why', () => {
    let b = newBranch('digestion', required)
    b = recordAnswer(b, 'q1', NOW)
    b = recordAnswer(b, 'q2', NOW)
    b = summariseBranch(b, NOW)
    expect(b.state).toBe('summarised')

    const reopened = reopenBranch(b, '2026-10-07T09:00:00.000Z', 'new medication reported')
    expect(reopened.state).toBe('expanded')
    expect(reopened.answeredQuestionIds).toEqual(['q1', 'q2']) // nothing lost
    expect(reopened.history.at(-1)?.reason).toContain('new medication reported')
  })
})

// ─── Provenance ──────────────────────────────────────────────────────────────

describe('provenance', () => {
  it('keeps the original four states and adds the approved V4 states', () => {
    for (const s of ['client_reported', 'practitioner_verified', 'corrected', 'missing']) {
      expect(V2_PROVENANCE_STATES).toContain(s)
    }
    for (const s of ['documented_record', 'unconfirmed', 'not_asked', 'declined',
      'system_organised', 'system_structured_from_client_language', 'practitioner_interpreted']) {
      expect(V2_PROVENANCE_STATES).toContain(s)
    }
  })

  it('NOT ASKED is not NO — and neither is missing, declined or unconfirmed', () => {
    expect(isAffirmativeClientAnswer(notAsked())).toBe(false)
    expect(isAffirmativeClientAnswer(missingFact())).toBe(false)
    expect(isAffirmativeClientAnswer(declined())).toBe(false)
    // …and crucially none of them equals a recorded negative answer.
    const saidNo = clientReported('No')
    expect(isAffirmativeClientAnswer(saidNo)).toBe(true) // it IS an answer
    expect(notAsked().provenance).not.toBe(saidNo.provenance)
  })

  it('the original client answer survives a correction, verbatim', () => {
    const original = clientReported('about 3 months')
    const corrected = correctFact(original, '6 months', 'practitioner-1', NOW)
    expect(corrected.value).toBe('about 3 months')      // untouched
    expect(corrected.correction?.value).toBe('6 months')
    expect(corrected.correction?.actor).toBe('practitioner-1')
    expect(corrected.provenance).toBe('corrected')
  })

  it('practitioner interpretation attaches beside a fact, never over it', () => {
    const fact = clientReported('tired every afternoon')
    const interpreted = interpretFact(fact, 'pattern worth exploring', 'practitioner-1', NOW)
    expect(interpreted.value).toBe('tired every afternoon')
    expect(interpreted.provenance).toBe('client_reported')
    expect(interpreted.interpretation?.practitionerId).toBe('practitioner-1')
  })
})

// ─── Influences / ATM ────────────────────────────────────────────────────────

describe('influences — only what the client explicitly expressed', () => {
  it('structures a link when the client expresses one, keeping their words and the cue', () => {
    const result = buildInfluenceFromClientStatement({
      id: 'inf-1', concernId: 'c-1', kind: 'trigger',
      statement: 'The headaches started after I began the new shift pattern',
      summary: 'New shift pattern', clientViewWhereDiscussed: 'Your health story', capturedAt: NOW,
    })
    expect(result.influence).not.toBeNull()
    expect(result.influence!.originalWording)
      .toBe('The headaches started after I began the new shift pattern')
    expect(result.influence!.linguisticCue).toBeTruthy()
    expect(result.influence!.origin).toBe('client_explicit')
    expect(result.influence!.reviewState).toBe('awaiting_review')
  })

  it('TIMING ALONE creates no relationship', () => {
    const result = buildInfluenceFromClientStatement({
      id: 'inf-2', kind: 'trigger',
      statement: 'It started in March',
      summary: 'March', clientViewWhereDiscussed: 'Timeline', capturedAt: NOW,
    })
    expect(result.influence).toBeNull()
    expect(result.refusedReason).toBe('timing_only')
    expect(detectClientExpressedLink('It started in March').cue).toBeNull()
  })

  it('a bare statement with no link expressed creates nothing', () => {
    const result = buildInfluenceFromClientStatement({
      id: 'inf-3', kind: 'mediator', statement: 'I have two children',
      summary: 'Children', clientViewWhereDiscussed: 'About you', capturedAt: NOW,
    })
    expect(result.influence).toBeNull()
    expect(result.refusedReason).toBe('no_explicit_link')
  })

  it('refuses a kind the client wording does not support', () => {
    const result = buildInfluenceFromClientStatement({
      id: 'inf-4', kind: 'protective',
      statement: 'Stress makes it worse', // a mediator cue, not a protective one
      summary: 'Stress', clientViewWhereDiscussed: 'Your story', capturedAt: NOW,
    })
    expect(result.influence).toBeNull()
    expect(result.refusedReason).toBe('kind_not_supported_by_wording')
  })

  it('a practitioner-added influence is never attributed to the client', () => {
    const inf = practitionerAddedInfluence({
      id: 'inf-5', kind: 'antecedent', summary: 'Childhood antibiotics',
      practitionerId: 'practitioner-1', at: NOW,
    })
    expect(inf.origin).toBe('practitioner_added')
    expect(inf.originalWording).toBe('') // no client words to misattribute
  })
})

// ─── Factual synopsis ────────────────────────────────────────────────────────

function syntheticInput(): SynopsisInput {
  const concern: ConcernCard = {
    id: 'c-1',
    ownWords: clientReported('I am exhausted by lunchtime every day'),
    label: clientReported('Fatigue'),
    desiredImprovement: clientReported('Get through a day without needing to lie down'),
    onset: correctFact(clientReported('about 3 months'), '6 months', 'practitioner-1', NOW),
    pattern: clientReported('Worse on work days'),
    impact: notAsked(),
    relevantStreams: ['Energy'],
    timelineEntryIds: ['t-1'], influenceIds: ['inf-1'], evidenceIds: ['e-1'],
    whatHelps: clientReported('A short walk at lunch helps'),
    clarificationItems: [],
    capturedAt: NOW,
  }
  const influence: InfluenceRecord = buildInfluenceFromClientStatement({
    id: 'inf-1', concernId: 'c-1', kind: 'protective',
    statement: 'A short walk at lunch helps more than anything',
    summary: 'Short lunchtime walk', clientViewWhereDiscussed: 'What matters to you', capturedAt: NOW,
  }).influence!

  return {
    concerns: [concern],
    influences: [influence],
    safetyItems: [{
      id: 's-1', questionLabel: 'Mood and safety', matchedOptions: ['Feeling hopeless'],
      capturedAt: NOW, reviewStatus: 'unreviewed',
    }],
    clarifications: deriveClarificationItems(concern, NOW),
    medicines: [{ name: clientReported('Levothyroxine 75mcg'), detail: 'Current' }],
    evidence: [{ id: 'e-1', title: 'Blood test results', kind: 'Lab report', receivedAt: NOW, verified: true }],
    streamsUnderConsideration: ['Energy', 'Digestion'],
    timeline: [{ id: 't-1', at: '2026-04-01T00:00:00.000Z', summary: clientReported('Started new job'), concernId: 'c-1' }],
    updates: [],
    generatedAt: NOW,
  }
}

describe('factual synopsis builder', () => {
  const synopsis = buildFactualSynopsis(syntheticInput())

  it('produces every approved section', () => {
    expect(synopsis.sections.map((s) => s.id)).toEqual([
      'why_here', 'what_better_looks_like', 'main_concerns', 'strengths',
      'timeline', 'medicines', 'evidence', 'streams_under_consideration',
      'safety_awaiting_review', 'questions_worth_asking', 'dated_updates',
    ])
  })

  it('every item carries provenance — who/what/when is always answerable', () => {
    expect(everyItemHasProvenance(synopsis)).toBe(true)
  })

  it('contains NO practitioner interpretation', () => {
    expect(containsOnlyFactualProvenance(synopsis)).toBe(true)
  })

  it('shows a correction while preserving the client original', () => {
    const concerns = synopsis.sections.find((s) => s.id === 'main_concerns')!
    const onset = concerns.items.find((i) => i.label === 'Started')!
    expect(onset.value).toBe('6 months')             // corrected value displayed
    expect(onset.originalValue).toBe('about 3 months') // original still present
    expect(onset.correctedBy).toBe('practitioner-1')
  })

  it('reports "not asked" as absence, never as a negative answer', () => {
    const concerns = synopsis.sections.find((s) => s.id === 'main_concerns')!
    const impact = concerns.items.find((i) => i.label === 'Impact')
    expect(impact?.value).toBe('—')
    expect(impact?.provenanceLabel).toBe('Not asked')
  })

  it('keeps streams as UNDER CONSIDERATION and never emits systems under stress', () => {
    const streams = synopsis.sections.find((s) => s.id === 'streams_under_consideration')!
    expect(streams.title).toContain('under consideration')
    const allText = JSON.stringify(synopsis).toLowerCase()
    expect(allText).not.toContain('under stress')
  })

  it('surfaces safety items as awaiting a human, with no disposition', () => {
    const safety = synopsis.sections.find((s) => s.id === 'safety_awaiting_review')!
    expect(safety.items).toHaveLength(1)
    const text = JSON.stringify(safety).toLowerCase()
    for (const word of ['urgent', 'emergency', 'priority', 'refer', 'triage', 'risk score']) {
      expect(text).not.toContain(word)
    }
  })

  it('surfaces gaps as questions worth asking, framed factually', () => {
    const questions = synopsis.sections.find((s) => s.id === 'questions_worth_asking')!
    expect(questions.items.length).toBeGreaterThan(0)
    const text = questions.items.map((i) => i.value).join(' ').toLowerCase()
    expect(text).not.toContain('likely')
    expect(text).not.toContain('suggests')
  })

  it('uses explicit empty states rather than silence', () => {
    const empty = buildFactualSynopsis({
      ...syntheticInput(), concerns: [], influences: [], safetyItems: [],
      clarifications: [], medicines: [], evidence: [], streamsUnderConsideration: [], timeline: [],
    })
    const updates = empty.sections.find((s) => s.id === 'dated_updates')!
    expect(updates.emptyState).toBe('Nothing has changed since submission.')
  })

  it('records an audit trail of contributing sources', () => {
    expect(synopsis.meta.sourceRefs).toContain('e-1')
    expect(synopsis.meta.schemaVersion).toBe('factual-synopsis.v1')
  })
})

// ─── Since last review ───────────────────────────────────────────────────────

describe('since last review', () => {
  const updates: DatedUpdate[] = [
    { id: 'u1', at: '2026-09-01T09:00:00.000Z', authorRole: 'client', authorId: 'm1',
      kind: 'client_report', statement: 'Sleeping better', sourceRef: 'f1' },
    { id: 'u2', at: '2026-10-02T09:00:00.000Z', authorRole: 'client', authorId: 'm1',
      kind: 'daily_path_obstacle', statement: 'Could not take evening dose', sourceRef: 'f2' },
    { id: 'u3', at: '2026-10-03T09:00:00.000Z', authorRole: 'practitioner', authorId: 'p1',
      kind: 'protocol_version', statement: 'Protocol v2 issued', sourceRef: 'f3' },
  ]

  it('includes only what changed after the review point', () => {
    const delta = buildSinceLastReview(updates, '2026-10-01T00:00:00.000Z', NOW)
    expect(delta.count).toBe(2)
    expect(delta.sections.flatMap((s) => s.entries.map((e) => e.id))).toEqual(['u2', 'u3'])
  })

  it('returns a valid empty result when nothing changed', () => {
    const delta = buildSinceLastReview(updates, '2026-12-01T00:00:00.000Z', NOW)
    expect(delta.count).toBe(0)
    expect(delta.sections).toEqual([])
  })

  it('never produces causal language — only attributed sequence', () => {
    const sequence = describeSequence(updates[1], {
      ...updates[0], id: 'u4', at: '2026-10-05T09:00:00.000Z',
    })
    expect(sequence).toContain('after')
    expect(sequence).not.toContain('because')
    expect(sequence).not.toContain('due to')
    expect(sequence).not.toContain('improved by')
  })

  it('refuses a sequence statement when the later fact is not the client’s', () => {
    expect(describeSequence(updates[0], updates[2])).toBeNull() // practitioner-authored
  })
})

// ─── Authority boundaries (reusing the shipped governance guards) ────────────

describe('authority boundaries hold', () => {
  it('a student cannot sign or verify clinical conclusions', () => {
    expect(canSignClinicalConclusions('student')).toBe(false)
    expect(canVerifyClinicalFacts('student')).toBe(false)
  })

  it('neither can AI, automated jobs or synopsis generation', () => {
    for (const actor of ['ai', 'automated_job', 'synopsis_generation'] as const) {
      expect(canSignClinicalConclusions(actor)).toBe(false)
      expect(canVerifyClinicalFacts(actor)).toBe(false)
    }
  })

  it('only a practitioner may', () => {
    expect(canSignClinicalConclusions('practitioner')).toBe(true)
    expect(canVerifyClinicalFacts('practitioner')).toBe(true)
  })
})
