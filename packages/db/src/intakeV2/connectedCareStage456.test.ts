// Stages 4–6: Call Sheet generation, nutrition's three layers + aims +
// outcome measures, and the safety review workflow machinery.
//
// These tests assert the STRUCTURAL guarantees, not example output: that NI
// cannot author clinical prose, cannot author nutrition advice, cannot close a
// safety item, and cannot overwrite a client answer.

import { describe, it, expect } from 'vitest'
import {
  buildCallSheet, recordCallSheetEntry, allCallSheetItems,
  SAFETY_PROMPT, CALL_SHEET_SECTION_IDS, CALL_SHEET_TREES,
} from './index'
import {
  currentIntake, clientBelief, practitionerAdvice, groupNutrition,
  therapeuticAim, describeChange, readingsForMeasure,
} from './index'
import {
  raiseSafetyItem, assignReviewer, acknowledgeSafetyItem, recordSafetyDecision,
  recordSafetyAction, resolveSafetyItem, reopenSafetyItem, openSafetyItems, isOpen,
} from './index'
import type {
  ConcernCard, V2SafetyReviewItem, OutcomeMeasure, MeasureReading, CallSheetItem,
} from './index'

const AT = '2026-10-06T09:00:00.000Z'

const concern = (over: Partial<ConcernCard> = {}): ConcernCard => ({
  id: 'c-sleep',
  ownWords: { value: 'I wake at 3am and can’t get back to sleep', provenance: 'client_reported' },
  label: { value: 'Sleep', provenance: 'system_organised' },
  relevantStreams: [],
  timelineEntryIds: [], influenceIds: [], evidenceIds: [],
  clarificationItems: [],
  capturedAt: '2026-09-01T00:00:00.000Z',
  ...over,
})

const safetyItem = (over: Partial<V2SafetyReviewItem> = {}): V2SafetyReviewItem => ({
  sourceQuestionId: 'v2.heart.noticed',
  questionLabel: 'Have you noticed any of these?',
  rawAnswer: ['Chest pain or tightness', 'Breathlessness'],
  matchedOptions: ['Chest pain or tightness'],
  capturedAt: '2026-09-01T00:00:00.000Z',
  reviewStatus: 'unreviewed',
  ...over,
})

// ─── Stage 4 — Call Sheet generation ─────────────────────────────────────────

describe('Stage 4 — Call Sheet generation', () => {
  it('A. returns an empty-but-valid sheet when there is nothing to prepare', () => {
    const sheet = buildCallSheet({
      caseId: 'case-1', answers: {}, concerns: [], safetyItems: [], generatedAt: AT,
    })
    expect(sheet.count).toBe(0)
    expect(sheet.sections).toEqual([])
    expect(sheet.builderVersion).toBe('call-sheet.v1')
  })

  it('B. puts safety items first so they cannot be buried', () => {
    const sheet = buildCallSheet({
      caseId: 'case-1',
      answers: { 'v2.digestion.noticed': ['Bloating'] },
      concerns: [concern()],
      safetyItems: [safetyItem()],
      generatedAt: AT,
    })
    expect(sheet.sections[0].id).toBe('awaiting_safety_review')
    expect(sheet.sections.length).toBeGreaterThan(1)
  })

  it('C. never adjudicates a safety item — reviewStatus passes through', () => {
    const item = safetyItem()
    const sheet = buildCallSheet({
      caseId: 'case-1', answers: {}, concerns: [], safetyItems: [item], generatedAt: AT,
    })
    // The item object is carried, not reinterpreted.
    expect(item.reviewStatus).toBe('unreviewed')
    expect(sheet.sections[0].items[0].origin).toBe('safety_capture')
  })

  it('D. the only sentence NI applies to a safety capture is the fixed template', () => {
    const item = safetyItem()
    const sheet = buildCallSheet({
      caseId: 'case-1', answers: {}, concerns: [], safetyItems: [item], generatedAt: AT,
    })
    expect(sheet.sections[0].items[0].prompt).toBe(SAFETY_PROMPT(item.questionLabel))
  })

  it('E. carries the client’s raw answer verbatim and complete', () => {
    const item = safetyItem()
    const sheet = buildCallSheet({
      caseId: 'case-1', answers: {}, concerns: [], safetyItems: [item], generatedAt: AT,
    })
    const wording = sheet.sections[0].items[0].clientWording!
    // Every reported option survives — not just the matched subset.
    for (const option of item.rawAnswer) expect(wording).toContain(option)
  })

  it('F. every prompt is verbatim from a fixed table — NI composes no prose', () => {
    const sheet = buildCallSheet({
      caseId: 'case-1',
      answers: { 'v2.digestion.noticed': ['Bloating'], 'v2.nervous.noticed': ['Headaches'] },
      concerns: [concern()],
      safetyItems: [safetyItem()],
      generatedAt: AT,
    })
    const allowed = new Set<string>([
      ...CALL_SHEET_TREES.flatMap((t) => t.prompts.map((p) => p.prompt)),
      SAFETY_PROMPT(safetyItem().questionLabel),
      // The four factual-gap prompts deriveClarificationItems emits.
      'When did this start?', 'Has it changed since it began?',
      'Is there a pattern to when it happens?', 'How does it affect day-to-day life?',
    ])
    for (const item of allCallSheetItems(sheet)) {
      expect(allowed.has(item.prompt)).toBe(true)
    }
  })

  it('G. routes a declined answer to "preferred to discuss", not to a gap', () => {
    const sheet = buildCallSheet({
      caseId: 'case-1', answers: {},
      concerns: [concern({ onset: { value: null, provenance: 'declined' } })],
      safetyItems: [], generatedAt: AT,
    })
    const deferred = sheet.sections.find((s) => s.id === 'client_deferred')
    expect(deferred?.items.some((i) => i.origin === 'client_deferred')).toBe(true)
    const gaps = sheet.sections.find((s) => s.id === 'factual_gaps')
    expect(gaps?.items.some((i) => i.prompt === 'When did this start?')).toBe(false)
  })

  it('H. sections only ever appear in the declared order', () => {
    const sheet = buildCallSheet({
      caseId: 'case-1',
      answers: { 'v2.digestion.noticed': ['Bloating'] },
      concerns: [concern({ onset: { value: null, provenance: 'declined' } })],
      safetyItems: [safetyItem()],
      practitionerAdded: [{ id: 'p1', prompt: 'Ask about the new job', origin: 'practitioner_added' }],
      generatedAt: AT,
    })
    const order = sheet.sections.map((s) => s.id)
    const canonical = CALL_SHEET_SECTION_IDS.filter((id) => order.includes(id))
    expect(order).toEqual(canonical)
  })

  it('I. a practitioner entry never overwrites the client answer', () => {
    const clientAnswer = ['Bloating', 'Reflux']
    const { entry } = recordCallSheetEntry({
      questionId: 'v2.digestion.noticed',
      clientAnswer,
      correction: ['Bloating'],
      actor: 'prac-1', recordedAt: AT,
    })
    expect(entry!.clientAnswer).toBe(clientAnswer)          // identity preserved
    expect(entry!.practitionerCorrection).toEqual(['Bloating'])
    expect(entry!.verificationStatus).toBe('practitioner_corrected')
  })

  it('J. refuses an unattributable entry rather than writing one', () => {
    const r = recordCallSheetEntry({
      questionId: 'q', clientAnswer: 'x', note: 'Discussed', actor: null, recordedAt: AT,
    })
    expect(r.entry).toBeNull()
    expect(r.refusedReason).toBe('no_actor')
  })

  it('K. refuses an empty entry', () => {
    const r = recordCallSheetEntry({
      questionId: 'q', clientAnswer: 'x', actor: 'prac-1', recordedAt: AT,
    })
    expect(r.entry).toBeNull()
    expect(r.refusedReason).toBe('no_content')
  })
})

// ─── Stage 5 — nutrition, aims, outcome measures ─────────────────────────────

describe('Stage 5 — nutrition’s three layers', () => {
  it('L. keeps the three layers apart', () => {
    const advice = practitionerAdvice({
      id: 'a1', instruction: 'Protein at breakfast', amount: '20–30 g',
      authoredBy: 'prac-1', protocolVersion: 3, authoredAt: AT,
    }).advice!
    const grouped = groupNutrition([
      currentIntake({ id: 'i1', item: 'Toast and tea', capturedAt: AT }),
      clientBelief({ id: 'b1', statement: 'Dairy makes my sinuses worse', capturedAt: AT }),
      advice,
    ])
    expect(grouped.currentIntake).toHaveLength(1)
    expect(grouped.clientBeliefs).toHaveLength(1)
    expect(grouped.practitionerAdvice).toHaveLength(1)
  })

  it('M. current intake is client-reported, never NI-asserted', () => {
    const e = currentIntake({ id: 'i1', item: 'Toast and tea', capturedAt: AT })
    expect(e.item.provenance).toBe('client_reported')
    expect(e.item.capturedAt).toBe(AT)
  })

  it('N. a client belief is held as a belief and starts unreviewed', () => {
    const b = clientBelief({ id: 'b1', statement: 'Dairy makes my sinuses worse', capturedAt: AT })
    expect(b.statement.provenance).toBe('client_reported')
    expect(b.reviewState).toBe('unreviewed')
    // The belief is never promoted to a practitioner-owned provenance by NI.
    expect(b.statement.provenance).not.toBe('practitioner_verified')
  })

  it('O. NI cannot author nutrition advice without a named practitioner', () => {
    const r = practitionerAdvice({
      id: 'a1', instruction: 'Protein at breakfast',
      authoredBy: null, protocolVersion: 3, authoredAt: AT,
    })
    expect(r.advice).toBeNull()
    expect(r.refusedReason).toBe('no_author')
  })

  it('P. nutrition advice cannot exist outside a protocol version', () => {
    const r = practitionerAdvice({
      id: 'a1', instruction: 'Protein at breakfast',
      authoredBy: 'prac-1', protocolVersion: null, authoredAt: AT,
    })
    expect(r.advice).toBeNull()
    expect(r.refusedReason).toBe('no_protocol_version')
  })
})

describe('Stage 5 — therapeutic aims', () => {
  it('Q. an aim requires an author', () => {
    const r = therapeuticAim({ id: 'aim1', aim: 'Sleep through the night', setBy: null, setAt: AT })
    expect(r.aim).toBeNull()
    expect(r.refusedReason).toBe('no_author')
  })

  it('R. refuses predictive or promissory wording', () => {
    for (const text of [
      'This will cure the migraines',
      'Guarantee better sleep within a month',
      'Will resolve the bloating',
    ]) {
      const r = therapeuticAim({ id: 'aim1', aim: text, setBy: 'prac-1', setAt: AT })
      expect(r.aim).toBeNull()
      expect(r.refusedReason).toBe('predictive_wording')
    }
  })

  it('S. accepts an aim stated as what is being worked towards', () => {
    const r = therapeuticAim({
      id: 'aim1', aim: 'Fewer night wakings, by the client’s own account',
      setBy: 'prac-1', setAt: AT, agreedWithClient: true,
    })
    expect(r.aim).not.toBeNull()
    expect(r.aim!.state).toBe('active')
    expect(r.aim!.agreedWithClient).toBe(true)
  })

  it('T. keeps the client’s wording as client-reported when it is theirs', () => {
    const r = therapeuticAim({
      id: 'aim1', aim: 'Get through the afternoon without crashing',
      setBy: 'prac-1', setAt: AT, fromClientWording: true,
    })
    expect(r.aim!.aim.provenance).toBe('client_reported')
  })
})

describe('Stage 5 — outcome measures', () => {
  const measure: OutcomeMeasure = {
    id: 'm1', label: 'Afternoon energy', aimId: 'aim1', concernId: 'c-sleep',
    source: 'client_rated', unit: 'of 10', createdBy: 'prac-1', createdAt: AT,
  }
  const reading = (id: string, value: string, at: string): MeasureReading => ({
    id, measureId: 'm1', value: { value, provenance: 'client_reported' }, at, sourceRef: `Check-in ${at.slice(0, 10)}`,
  })

  it('U. states a change without evaluating it', () => {
    const text = describeChange(
      measure, reading('r1', '4', '2026-09-20T00:00:00.000Z'),
      reading('r2', '5', '2026-10-02T00:00:00.000Z'))!
    expect(text).toContain('4 of 10 → 5 of 10')
    expect(text).toContain('client-rated')
    for (const word of ['improved', 'better', 'worse', 'because', 'due to', 'progress']) {
      expect(text.toLowerCase()).not.toContain(word)
    }
  })

  it('V. refuses to describe a change that runs backwards or is undated', () => {
    expect(describeChange(
      measure, reading('r1', '5', '2026-10-02T00:00:00.000Z'),
      reading('r2', '4', '2026-09-20T00:00:00.000Z'))).toBeNull()
    expect(describeChange(
      measure, reading('r1', '4', 'not-a-date'),
      reading('r2', '5', '2026-10-02T00:00:00.000Z'))).toBeNull()
  })

  it('W. orders readings by date without computing a trend', () => {
    const ordered = readingsForMeasure(measure, [
      reading('r2', '5', '2026-10-02T00:00:00.000Z'),
      reading('r1', '4', '2026-09-20T00:00:00.000Z'),
    ])
    expect(ordered.map((r) => r.id)).toEqual(['r1', 'r2'])
  })
})

// ─── Stage 6 — safety review workflow machinery ──────────────────────────────

describe('Stage 6 — safety workflow machinery', () => {
  const raised = () => raiseSafetyItem({
    id: 's1', caseId: 'case-1', item: safetyItem(), at: '2026-09-01T00:00:00.000Z',
  })

  it('X. NI can only raise — the item starts open and unassigned', () => {
    const r = raised()
    expect(r.state).toBe('open')
    expect(r.decision).toBeNull()
    expect(r.resolvedBy).toBeNull()
    expect(isOpen(r)).toBe(true)
    // The raise event is the only audit entry without a human actor.
    expect(r.audit).toHaveLength(1)
    expect(r.audit[0].kind).toBe('raised')
    expect(r.audit[0].actor).toBeNull()
  })

  it('Y. carries the derived item verbatim and never edits it', () => {
    const item = safetyItem()
    const r = raiseSafetyItem({ id: 's1', caseId: 'case-1', item, at: AT })
    expect(r.item).toBe(item)
  })

  it('Z. a decision requires acknowledgement first', () => {
    const r = recordSafetyDecision(raised(), {
      decision: 'Discussed; already assessed by GP in August.', actor: 'prac-1', at: AT,
    })
    expect(r.record).toBeNull()
    expect(r.refusedReason).toBe('not_acknowledged')
  })

  it('AA. every human transition refuses without a named actor', () => {
    const open = raised()
    expect(acknowledgeSafetyItem(open, null, AT).refusedReason).toBe('no_actor')
    expect(assignReviewer(open, null, AT).refusedReason).toBe('no_actor')
    expect(recordSafetyDecision(open, { decision: 'x', actor: null, at: AT }).refusedReason).toBe('no_actor')
    expect(recordSafetyAction(open, { id: 'a', action: 'x', actor: null, at: AT }).refusedReason).toBe('no_actor')
    expect(resolveSafetyItem(open, null, AT).refusedReason).toBe('no_actor')
  })

  it('AB. a decision requires the practitioner’s own words', () => {
    const ack = acknowledgeSafetyItem(raised(), 'prac-1', AT).record!
    const r = recordSafetyDecision(ack, { decision: '   ', actor: 'prac-1', at: AT })
    expect(r.record).toBeNull()
    expect(r.refusedReason).toBe('no_decision_text')
  })

  it('AC. an item cannot be closed without a recorded human decision', () => {
    const ack = acknowledgeSafetyItem(raised(), 'prac-1', AT).record!
    const r = resolveSafetyItem(ack, 'prac-1', AT)
    expect(r.record).toBeNull()
    expect(r.refusedReason).toBe('no_decision_recorded')
  })

  it('AD. the full lifecycle records who did what, when, in their words', () => {
    const ack = acknowledgeSafetyItem(raised(), 'prac-1', '2026-09-02T00:00:00.000Z').record!
    const decided = recordSafetyDecision(ack, {
      decision: 'Client confirms GP assessed this in August; no new symptoms.',
      actor: 'prac-1', at: '2026-09-03T00:00:00.000Z',
    }).record!
    const acted = recordSafetyAction(decided, {
      id: 'act1', action: 'Asked client to bring the GP letter to the next review.',
      actor: 'prac-1', at: '2026-09-03T00:10:00.000Z',
    }).record!
    const resolved = resolveSafetyItem(acted, 'prac-1', '2026-09-04T00:00:00.000Z').record!

    expect(resolved.state).toBe('resolved')
    expect(isOpen(resolved)).toBe(false)
    expect(resolved.decision!.decidedBy).toBe('prac-1')
    expect(resolved.decision!.decision).toContain('GP assessed this in August')
    expect(resolved.actions).toHaveLength(1)
    expect(resolved.audit.map((e) => e.kind)).toEqual([
      'raised', 'acknowledged', 'decision_recorded', 'action_recorded', 'resolved',
    ])
    // Every event after `raised` is attributed to a person.
    for (const event of resolved.audit.slice(1)) expect(event.actor).toBe('prac-1')
  })

  it('AE. reopening preserves the previous decision and appends to the trail', () => {
    const ack = acknowledgeSafetyItem(raised(), 'prac-1', AT).record!
    const decided = recordSafetyDecision(ack, {
      decision: 'No action needed.', actor: 'prac-1', at: AT,
    }).record!
    const resolved = resolveSafetyItem(decided, 'prac-1', AT).record!
    const reopened = reopenSafetyItem(resolved, {
      actor: 'prac-2', at: '2026-10-01T00:00:00.000Z', reason: 'Client reported it again.',
    }).record!

    expect(reopened.state).toBe('reopened')
    expect(isOpen(reopened)).toBe(true)
    expect(reopened.decision).toEqual(decided.decision)   // preserved, not erased
    expect(reopened.audit).toHaveLength(resolved.audit.length + 1)
    expect(reopened.audit.at(-1)!.detail).toBe('Client reported it again.')
  })

  it('AF. refuses to reopen something that is not resolved', () => {
    const r = reopenSafetyItem(raised(), { actor: 'prac-1', at: AT })
    expect(r.record).toBeNull()
    expect(r.refusedReason).toBe('not_resolved')
  })

  it('AG. the audit trail is append-only across every transition', () => {
    const open = raised()
    const ack = acknowledgeSafetyItem(open, 'prac-1', AT).record!
    // The earlier record is untouched — transitions return new objects.
    expect(open.audit).toHaveLength(1)
    expect(ack.audit).toHaveLength(2)
    expect(ack.audit[0]).toEqual(open.audit[0])
  })

  it('AH. open items are ordered by when they were raised, never ranked', () => {
    const a = raiseSafetyItem({ id: 'a', caseId: 'c', item: safetyItem(), at: '2026-09-10T00:00:00.000Z' })
    const b = raiseSafetyItem({ id: 'b', caseId: 'c', item: safetyItem(), at: '2026-09-01T00:00:00.000Z' })
    expect(openSafetyItems([a, b]).map((r) => r.id)).toEqual(['b', 'a'])
  })

  it('AI. a resolved item drops out of the open list', () => {
    const ack = acknowledgeSafetyItem(raised(), 'prac-1', AT).record!
    const decided = recordSafetyDecision(ack, { decision: 'Done.', actor: 'prac-1', at: AT }).record!
    const resolved = resolveSafetyItem(decided, 'prac-1', AT).record!
    expect(openSafetyItems([resolved])).toEqual([])
  })

  it('AJ. nothing can be added to a resolved item without reopening it', () => {
    const ack = acknowledgeSafetyItem(raised(), 'prac-1', AT).record!
    const decided = recordSafetyDecision(ack, { decision: 'Done.', actor: 'prac-1', at: AT }).record!
    const resolved = resolveSafetyItem(decided, 'prac-1', AT).record!
    expect(acknowledgeSafetyItem(resolved, 'prac-1', AT).refusedReason).toBe('already_resolved')
    expect(recordSafetyDecision(resolved, { decision: 'x', actor: 'prac-1', at: AT }).refusedReason).toBe('already_resolved')
    expect(recordSafetyAction(resolved, { id: 'a', action: 'x', actor: 'prac-1', at: AT }).refusedReason).toBe('already_resolved')
  })
})

// ─── Cross-stage: the Call Sheet reflects open safety work ───────────────────

describe('Stages 4+6 together', () => {
  it('AK. an unreviewed safety capture reaches the Call Sheet; NI still decides nothing', () => {
    const record = raiseSafetyItem({
      id: 's1', caseId: 'case-1', item: safetyItem(), at: '2026-09-01T00:00:00.000Z',
    })
    const sheet = buildCallSheet({
      caseId: 'case-1', answers: {}, concerns: [],
      safetyItems: [record.item], generatedAt: AT,
    })
    const item: CallSheetItem = sheet.sections[0].items[0]
    expect(item.safetyFollowUp).toBe(true)
    // The sheet tells the practitioner to decide. It does not decide.
    expect(item.prompt).toContain('record your decision')
    expect(record.decision).toBeNull()
  })
})
