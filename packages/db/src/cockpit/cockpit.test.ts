// Consultation Cockpit V2 — pilot domain behaviour.
//
// The suite is organised around the mission's own locked rules, so a failure
// names the rule it broke. Pure: no database, no network, no React.

import { describe, it, expect } from 'vitest'
import {
  // pilot
  PILOT_SECTION_IDS, SYSTEM_KEY_BY_SECTION, pilotQuestions, summarisePilot,
  // mapping
  PILOT_MAPPING_PACK, canPersistCanonically, persistenceBlockReason,
  proposeCandidate, summariseMappingPack, unmappedPilotQuestions, mappingFor,
  // digging
  PILOT_DIGGING_EDGES, edgesTriggeredBy, validateDiggingEdges,
  summariseDiggingGraph, orderedTargets, targetKey, edgeById,
  // capture
  newCaptureState, recordAnswer, recordBranchDetail, isBranchSufficient,
  outstandingTargets, markBranchNoLongerRelevant, reopenBranch,
  branchesNeedingReconciliation, studentDrafts, amendedAnswers,
  // safety — Annex 1
  ANNEX_1_STATUS, ANNEX_1_SOURCE, ANNEX_1_PILOT_RULES, ANNEX_FOLLOW_UPS,
  annexRuleById, answerTriggersReview, rule26Threshold, buildSafetyNodes,
  unaskedRelevantNodes, deriveCockpitSafetyItems, raiseForFollowUpDetail,
  consolidateSafety, openItemsElsewhere, annexNodeInventory, unsuppliedSafetyValues,
  // concept reference
  conceptReference, conceptReferenceForField, conceptRefKey, sameConcept,
  groupByConceptReference,
  // guidance
  buildGuidancePanel, orient, nodeDetails,
  // section status
  sectionStatus, caseWideSafetyStatus, finishSectionGate, finishSection,
  FINISH_SECTION_LABEL,
  // student
  can, submitForSupervision, attributionLine, STUDENT_CAPABILITIES,
  // timer
  newTimer, startTimer, pauseTimer, resumeTimer, activeSeconds, pausedSeconds,
  isOverrunning, overrunSeconds,
  completeTimer, toWorkLogEntry, TIMER_CANNOT_AFFECT_CONTENT, formatDuration,
  OVERRUN_REASONS, OVERRUN_REASON_LABELS,
  // approved V4 review outcomes
  V4_REVIEW_OUTCOMES, V4_REVIEW_OUTCOME_LABELS, DEFAULT_REVIEW_OUTCOME, recordReviewOutcome,
  // chain
  resolveChain, contributions, summariseContributions,
  type CaptureActor, type SafetyNodeAnswer,
} from './index'
import { CONCEPT_LAYER } from '../intakeV2/questionGraph/concepts'
import { V2_FIELD_REGISTRY } from '../intakeV2/fieldRegistry'
import * as reviewOutcomesModule from './reviewOutcomes'

const AT = '2026-10-21T10:00:00.000Z'
const LATER = '2026-10-21T10:05:00.000Z'
const CASE = 'case-pilot-1'

const PRAC: CaptureActor = { id: 'prac-1', displayName: 'Amara Okafor', role: 'practitioner' }
const STUDENT: CaptureActor = {
  id: 'stu-1', displayName: 'Saima Student', role: 'student', supervisorId: 'prac-1',
}
const UNSUPERVISED: CaptureActor = { id: 'stu-2', displayName: 'Lone Student', role: 'student' }

const DIGESTION_Q = 'v2.digestion.noticed'

// ── §5 The mapping gate ─────────────────────────────────────────────────────

describe('the mapping gate', () => {
  it('has zero approved mappings', () => {
    const s = summariseMappingPack()
    expect(s.approved).toBe(0)
    expect(s.byStatus.APPROVED).toBe(0)
  })

  it('blocks every canonical write in the pilot', () => {
    expect(summariseMappingPack().allWritesBlocked).toBe(true)
    for (const q of pilotQuestions()) expect(canPersistCanonically(q.id), q.id).toBe(false)
  })

  it('covers every pilot question, so nothing is silently absent', () => {
    expect(unmappedPilotQuestions()).toEqual([])
    expect(PILOT_MAPPING_PACK.length).toBe(pilotQuestions().length)
  })

  it('fails closed for an unknown question', () => {
    expect(canPersistCanonically('v2.nonsense.thing')).toBe(false)
    expect(persistenceBlockReason('v2.nonsense.thing')).toMatch(/No mapping entry/)
  })

  it('uses the authorised fields rather than the ones it refused', () => {
    // These three were UNMAPPED because no field could hold them without
    // changing its meaning. The Founder authorised three fields; the refusals
    // that produced them must still hold.
    const expected: Record<string, string> = {
      'v2.digestion.bowel_frequency': 'intake.systems.digestive.bowel_frequency',
      'v2.digestion.stool_form':      'intake.systems.digestive.stool_form',
      'v2.sleep.hours':               'intake.systems.sleep.typical_sleep_duration_hours',
    }
    for (const [id, field] of Object.entries(expected)) {
      const m = mappingFor(id)!
      expect(m.fieldIds, id).toEqual([field])
      expect(m.proposedBy, id).toBe('founder_authorised_field')
      // A field is not a mapping. Still NEEDS_REVIEW, still unwritable.
      expect(m.status, id).toBe('NEEDS_REVIEW')
      expect(canPersistCanonically(id), id).toBe(false)
    }
    // And neither symptom-frequency field was co-opted.
    expect(mappingFor('v2.digestion.bowel_frequency')!.fieldIds)
      .not.toContain('intake.systems.digestive.frequency')
    expect(mappingFor('v2.sleep.hours')!.fieldIds)
      .not.toContain('intake.systems.sleep.frequency')
  })

  it('every non-approved entry states what is missing', () => {
    for (const m of PILOT_MAPPING_PACK) {
      if (m.status !== 'APPROVED') {
        expect((m.gap ?? m.rationale ?? '').length, m.questionId).toBeGreaterThan(0)
      }
    }
  })

  it('name similarity can only propose a CANDIDATE, never an approval', () => {
    const c = proposeCandidate(DIGESTION_Q)!
    expect(c.status).toBe('CANDIDATE')
    expect(c.proposedBy).toBe('name_similarity')
    // And a candidate still cannot be persisted.
    expect(canPersistCanonically(DIGESTION_Q)).toBe(false)
  })

  it('records the section-id to system-key translation that mappings cross', () => {
    expect(SYSTEM_KEY_BY_SECTION.digestion).toBe('digestive')
    expect(SYSTEM_KEY_BY_SECTION.energy_metabolic).toBe('energy_endocrine')
    expect(SYSTEM_KEY_BY_SECTION.sleep).toBe('sleep')
    // Two of three differ, which is why each mapping carries a rationale.
    const differing = PILOT_SECTION_IDS.filter((s) => SYSTEM_KEY_BY_SECTION[s] !== s)
    expect(differing).toHaveLength(2)
  })
})

// ── §6 Digging is explicit, not derived from showIf ─────────────────────────

describe('digging edges', () => {
  it('are internally consistent', () => {
    expect(validateDiggingEdges()).toEqual([])
  })

  it('every trigger is a verbatim approved option of its source question', () => {
    // Guards against a trigger drifting from the registry wording, which
    // would silently stop the branch ever opening.
    for (const e of PILOT_DIGGING_EDGES) {
      const q = pilotQuestions().find((x) => x.id === e.sourceQuestionId)!
      for (const t of e.trigger.anyOf) expect(q.options, `${e.id}/${t}`).toContain(t)
    }
  })

  it('does not merge two option values that differ only by severity', () => {
    // THE distinction that matters most in the sleep stream. "Night sweats"
    // is not an approved red flag; "Night sweats that soak the bedding" is.
    expect(edgesTriggeredBy('v2.sleep.noticed', ['Night sweats'])).toEqual([])
    expect(edgesTriggeredBy('v2.sleep.noticed', ['Night sweats that soak the bedding'])
      .map((e) => e.id)).toEqual(['dig.sleep.night_sweats_soaking'])
  })

  it('matches trigger values exactly, never by substring', () => {
    expect(edgesTriggeredBy(DIGESTION_Q, ['Blood'])).toEqual([])
    expect(edgesTriggeredBy(DIGESTION_Q, ['blood in the stool'])).toEqual([])
  })

  it('carries both review axes separately', () => {
    const s = summariseDiggingGraph()
    expect(s.edges).toBeGreaterThan(0)
    expect(s.byReviewStatus.needs_human_review).toBeGreaterThan(0)
    expect(s.byReviewStatus.clear).toBeGreaterThan(0)   // a non-safety branch exists
  })

  it('has no canonical destination anywhere, and says so', () => {
    expect(summariseDiggingGraph().targetsWithCanonicalField).toBe(0)
  })

  it('reuses approved registry questions as targets where they exist', () => {
    expect(summariseDiggingGraph().registryBackedTargets).toBeGreaterThan(0)
  })
})

// ── §7 A changed answer never deletes history ───────────────────────────────

describe('changed answers', () => {
  const openBranch = () => recordAnswer(newCaptureState(CASE), {
    questionId: DIGESTION_Q,
    value: ['Bloating', 'A change in your usual bowel habit'],
    provenance: 'client_reported', at: AT, actor: PRAC,
  })

  it('keeps the previous answer, its provenance and its timestamp', () => {
    const s = recordAnswer(openBranch(), {
      questionId: DIGESTION_Q, value: ['Bloating'],
      provenance: 'corrected', at: LATER, actor: PRAC, note: 'Client corrected this on review.',
    })
    const a = s.answers[DIGESTION_Q]
    expect(a.value).toEqual(['Bloating'])
    expect(a.provenance).toBe('corrected')
    expect(a.history).toHaveLength(1)
    expect(a.history[0].value).toEqual(['Bloating', 'A change in your usual bowel habit'])
    expect(a.history[0].provenance).toBe('client_reported')
    expect(a.history[0].at).toBe(AT)
    expect(a.history[0].note).toMatch(/corrected this on review/)
    expect(amendedAnswers(s)).toHaveLength(1)
  })

  it('flags the orphaned branch for reconciliation and keeps its content', () => {
    let s = openBranch()
    const edge = edgeById('dig.digestion.bowel_habit_change')!
    const key = targetKey(edge, orderedTargets(edge)[0])
    s = recordBranchDetail(s, {
      edgeId: edge.id, targetKey: key, value: 'Six weeks, from daily to every third day.',
      provenance: 'client_reported', at: AT, actor: PRAC,
    })

    s = recordAnswer(s, {
      questionId: DIGESTION_Q, value: ['Bloating'],
      provenance: 'corrected', at: LATER, actor: PRAC,
    })

    const b = s.branches[edge.id]
    expect(b).toBeDefined()
    expect(b.needsReconciliation).toBe(true)
    expect(b.reconciliationReason).toMatch(/kept/i)
    // The captured detail survives.
    expect(b.answers[key].value).toBe('Six weeks, from daily to every third day.')
    expect(branchesNeedingReconciliation(s, 'digestion').map((x) => x.edgeId)).toEqual([edge.id])
  })

  it('reopens rather than duplicating when the trigger returns', () => {
    let s = openBranch()
    s = recordAnswer(s, { questionId: DIGESTION_Q, value: ['Bloating'], provenance: 'corrected', at: LATER, actor: PRAC })
    s = recordAnswer(s, {
      questionId: DIGESTION_Q, value: ['Bloating', 'A change in your usual bowel habit'],
      provenance: 'corrected', at: '2026-10-21T10:10:00.000Z', actor: PRAC,
    })
    const b = s.branches['dig.digestion.bowel_habit_change']
    expect(b.lifecycle).toBe('reopened')
    expect(b.needsReconciliation).toBe(false)
    expect(b.history.length).toBeGreaterThanOrEqual(2)
  })

  it('"no longer relevant" is a status a human sets, and it deletes nothing', () => {
    let s = openBranch()
    const edge = edgeById('dig.digestion.bowel_habit_change')!
    const key = targetKey(edge, orderedTargets(edge)[0])
    s = recordBranchDetail(s, {
      edgeId: edge.id, targetKey: key, value: 'Six weeks.',
      provenance: 'client_reported', at: AT, actor: PRAC,
    })
    s = markBranchNoLongerRelevant(s, {
      edgeId: edge.id, at: LATER, actor: PRAC, reason: 'Resolved after the GP changed her medication.',
    })
    const b = s.branches[edge.id]
    expect(b.reviewStatus).toBe('resolved')
    expect(b.reconciliationReason).toMatch(/No longer relevant/)
    expect(b.answers[key].value).toBe('Six weeks.')   // still there
  })

  it('refuses "no longer relevant" from a student, and without a reason', () => {
    const s = openBranch()
    const edge = 'dig.digestion.bowel_habit_change'
    expect(markBranchNoLongerRelevant(s, { edgeId: edge, at: LATER, actor: STUDENT, reason: 'done' })
      .branches[edge].reviewStatus).not.toBe('resolved')
    expect(markBranchNoLongerRelevant(s, { edgeId: edge, at: LATER, actor: PRAC, reason: '  ' })
      .branches[edge].reviewStatus).not.toBe('resolved')
  })

  it('never writes canonically, and records why', () => {
    const a = openBranch().answers[DIGESTION_Q]
    expect(a.canonicalWriteBlocked).toBe(true)
    expect(a.canonicalBlockReason).toMatch(/NEEDS_REVIEW|APPROVED/)
  })
})

// ── §1/§2 Annex 1 as the authoritative source, in explicit ask-once nodes ───

describe('Annex 1 is the clinical authority', () => {
  const nodes = (answers: Array<{ questionId: string; value: unknown }> = [],
                 nodeAnswers?: Record<string, SafetyNodeAnswer>) =>
    buildSafetyNodes({ caseId: CASE, answers, nodeAnswers })

  it('names the approved source and status', () => {
    expect(ANNEX_1_STATUS.present).toBe(true)
    expect(ANNEX_1_SOURCE.validationStatus).toBe('CLOSED — APPROVED WITH AMENDMENTS')
    expect(ANNEX_1_SOURCE.approvedRuleCount).toBe(37)
    expect(ANNEX_1_SOURCE.rulesSuppliedForPilot).toEqual([7, 9, 26])
  })

  it('carries each approved question VERBATIM', () => {
    // The wording IS the authority. A paraphrase here is a different question.
    expect(annexRuleById('annex1.rule7')!.approvedQuestion)
      .toBe('Have you noticed blood in or on your stools, or when you wipe?')
    expect(annexRuleById('annex1.rule9')!.approvedQuestion)
      .toBe('Have your stools been black and sticky like tar, or have you vomited blood or something like coffee grounds?')
    expect(annexRuleById('annex1.rule26')!.approvedQuestion)
      .toBe('Have you lost weight without trying? How much, and over how long?')
  })

  it('records each approved notice and stream list verbatim', () => {
    expect(annexRuleById('annex1.rule9')!.notice).toBe('NOW')
    expect(annexRuleById('annex1.rule7')!.notice).toBe('END')
    expect(annexRuleById('annex1.rule26')!.notice).toBe('END')
    expect(annexRuleById('annex1.rule7')!.askedOnceIn)
      .toEqual(['GIT: Diarrhoea', 'GIT: Mucus/blood', 'GIT: Frequency/stool'])
    expect(annexRuleById('annex1.rule26')!.askedOnceIn)
      .toEqual(['Endocrine: Weight', 'Endocrine: Fatigue', 'Endocrine: Frequent urination'])
  })

  it('is an explicit node, not a chip hidden inside a symptom list', () => {
    const all = nodes()
    expect(all).toHaveLength(3)
    for (const n of all) {
      expect(n.approvedQuestion.length).toBeGreaterThan(0)
      // The node exists before anything is asked, so the guide can say "not
      // yet asked" rather than silently omitting it.
      expect(n.state).toBe('dormant')
      expect(n.answer).toBeNull()
      expect(n.needsHumanReview).toBe(false)
    }
  })

  it('YES to the approved question needs a human', () => {
    const n = nodes([], {
      'annex1.rule7': {
        answer: 'YES', at: AT, actorId: 'prac-1', actorDisplayName: 'Amara Okafor',
        via: 'approved_question',
      },
    }).find((x) => x.ruleId === 'annex1.rule7')!
    expect(n.state).toBe('answered')
    expect(n.needsHumanReview).toBe(true)
    expect(n.triggerReason).toBe('annex_question_yes')
    expect(n.answer!.via).toBe('approved_question')
  })

  it('NOT SURE needs a human, on every rule', () => {
    for (const ruleId of ['annex1.rule7', 'annex1.rule9', 'annex1.rule26']) {
      const n = nodes([], {
        [ruleId]: {
          answer: 'NOT_SURE', at: AT, actorId: 'prac-1', actorDisplayName: 'A',
          via: 'approved_question',
        },
      }).find((x) => x.ruleId === ruleId)!
      expect(n.needsHumanReview, ruleId).toBe(true)
      expect(n.triggerReason, ruleId).toBe('annex_question_not_sure')
    }
  })

  it('NO to the approved question does not', () => {
    const n = nodes([], {
      'annex1.rule7': {
        answer: 'NO', at: AT, actorId: 'prac-1', actorDisplayName: 'A', via: 'approved_question',
      },
    }).find((x) => x.ruleId === 'annex1.rule7')!
    expect(n.state).toBe('answered')
    expect(n.needsHumanReview).toBe(false)
  })

  it('is ONE fact linked to every stream Annex 1 names', () => {
    const all = nodes()
    const rule7 = all.find((x) => x.ruleId === 'annex1.rule7')!
    expect(rule7.annexStreams).toHaveLength(3)
    expect(rule7.linkedSections).toEqual(['digestion'])
    // One node, not one per stream. Answering it answers it everywhere.
    expect(all.filter((n) => n.ruleId === 'annex1.rule7')).toHaveLength(1)
  })
})

describe('what a system answer may and may not do', () => {
  const nodes = (answers: Array<{ questionId: string; value: unknown }>) =>
    buildSafetyNodes({ caseId: CASE, answers })

  it('an affirmative chip can satisfy the approved YES', () => {
    const n = nodes([{ questionId: DIGESTION_Q, value: ['Blood in the stool'] }])
      .find((x) => x.ruleId === 'annex1.rule7')!
    expect(n.state).toBe('answered')
    expect(n.needsHumanReview).toBe(true)
    expect(n.triggerReason).toBe('system_answer_satisfied_yes')
    // The record says HOW it was answered, so it never implies the approved
    // question was read out when it was not.
    expect(n.answer!.via).toBe('system_answer_equivalent')
    expect(n.answer!.viaOptionValue).toBe('Blood in the stool')
  })

  it('NOT selecting a chip never answers NO', () => {
    // The asymmetry that matters: a client who bleeds only on wiping answers
    // the chip NO and the approved question YES.
    const n = nodes([{ questionId: DIGESTION_Q, value: ['Bloating', 'Wind'] }])
      .find((x) => x.ruleId === 'annex1.rule7')!
    expect(n.state).not.toBe('answered')
    expect(n.answer).toBeNull()
    for (const r of ANNEX_1_PILOT_RULES) expect(r.absenceCanSatisfyNo, r.id).toBe(false)
  })

  it('a related-but-different chip only establishes relevance', () => {
    // "Vomiting" is not "vomiting blood or coffee grounds". Treating it as
    // Rule 9's second limb would invent a report the client never made.
    const n = nodes([{ questionId: DIGESTION_Q, value: ['Vomiting'] }])
      .find((x) => x.ruleId === 'annex1.rule9')!
    expect(n.state).toBe('relevant_unasked')
    expect(n.needsHumanReview).toBe(false)
    expect(n.relevanceReason).toMatch(/Vomiting/)
  })

  it('a quantified rule is never satisfied by an unquantified chip', () => {
    const answers = [{ questionId: 'v2.energy.noticed', value: ['Weight going down without trying'] }]
    const n = nodes(answers).find((x) => x.ruleId === 'annex1.rule26')!
    expect(n.state).toBe('relevant_unasked')
    expect(n.needsHumanReview).toBe(false)
    expect(unaskedRelevantNodes(nodes(answers)).map((x) => x.ruleId)).toContain('annex1.rule26')
  })

  it('a direct answer always beats a system inference', () => {
    const n = buildSafetyNodes({
      caseId: CASE,
      answers: [{ questionId: DIGESTION_Q, value: ['Blood in the stool'] }],
      nodeAnswers: {
        'annex1.rule7': {
          answer: 'NO', at: AT, actorId: 'prac-1', actorDisplayName: 'A', via: 'approved_question',
        },
      },
    }).find((x) => x.ruleId === 'annex1.rule7')!
    // The practitioner asked and got a NO — the chip was a mis-tap.
    expect(n.answer!.via).toBe('approved_question')
    expect(n.needsHumanReview).toBe(false)
  })

  it('every link states why it is what it is', () => {
    for (const r of ANNEX_1_PILOT_RULES) {
      for (const l of r.systemAnswerLinks) {
        expect(l.rationale.length, `${r.id}/${l.optionValue}`).toBeGreaterThan(20)
      }
    }
  })
})

describe('Rule 26 quantified trigger', () => {
  it('meets the threshold at 5% or more over 6-12 months', () => {
    expect(rule26Threshold({ percentLost: 6, overMonths: 8 })).toBe('met')
    expect(rule26Threshold({ percentLost: 5, overMonths: 12 })).toBe('met')
  })

  it('meets it on noticeable unexplained loss over weeks', () => {
    expect(rule26Threshold({ noticeableOverWeeks: true })).toBe('met')
  })

  it('is UNKNOWN, not "not met", when the client cannot say', () => {
    // Fail-closed. NI cannot rule a threshold out on absent information, and
    // recording "not met" from silence would be exactly that.
    expect(rule26Threshold(null)).toBe('unknown')
    expect(rule26Threshold({})).toBe('unknown')
    expect(rule26Threshold({ percentLost: 7 })).toBe('unknown')
    expect(rule26Threshold({ overMonths: 9 })).toBe('unknown')
  })

  it('is "not met" only with both figures and an explicit no to the weeks limb', () => {
    expect(rule26Threshold({ percentLost: 2, overMonths: 9, noticeableOverWeeks: false }))
      .toBe('not_met')
  })

  it('raises review on YES unless the threshold is genuinely not met', () => {
    const r26 = annexRuleById('annex1.rule26')!
    expect(answerTriggersReview(r26, 'YES', { percentLost: 7, overMonths: 8 })).toBe(true)
    expect(answerTriggersReview(r26, 'YES', null)).toBe(true)
    expect(answerTriggersReview(r26, 'NOT_SURE',
      { percentLost: 1, overMonths: 9, noticeableOverWeeks: false })).toBe(true)
    expect(answerTriggersReview(r26, 'YES',
      { percentLost: 1, overMonths: 9, noticeableOverWeeks: false })).toBe(false)
  })

  it('an unquantified rule needs no threshold', () => {
    expect(answerTriggersReview(annexRuleById('annex1.rule7')!, 'YES')).toBe(true)
  })
})

describe('review items', () => {
  const answer = (value: unknown, questionId = DIGESTION_Q) =>
    deriveCockpitSafetyItems({ caseId: CASE, at: AT, answers: [{ questionId, value }] })

  it('an Annex-backed item names its rule and notice', () => {
    const item = answer(['Black, tar-like stool']).find((i) => i.annexRuleId === 'annex1.rule9')!
    expect(item.annexRuleNumber).toBe(9)
    expect(item.annexStatus).toBe('approved_annex_1_rule')
    expect(item.notice).toBe('NOW')
    expect(item.questionLabel).toBe(annexRuleById('annex1.rule9')!.approvedQuestion)
    expect(item.record.state).toBe('open')
  })

  it('carries safety values whose Annex rule was not supplied, clearly marked', () => {
    // Losing a safety signal is worse than carrying an unlabelled one.
    const item = answer(['Difficulty swallowing'])
      .find((i) => i.annexStatus === 'rule_not_supplied_for_pilot')!
    expect(item.annexRuleId).toBeNull()
    expect(item.record.state).toBe('open')
    expect(item.matchedOptions).toContain('Difficulty swallowing')
    expect(unsuppliedSafetyValues().map((v) => v.value)).toContain('Difficulty swallowing')
  })

  it('does not double-raise a value an Annex rule already owns', () => {
    const items = answer(['Blood in the stool'])
    expect(items.filter((i) => i.annexStatus === 'rule_not_supplied_for_pilot')).toHaveLength(0)
    expect(unsuppliedSafetyValues().map((v) => v.value)).not.toContain('Blood in the stool')
  })

  it('an ordinary answer raises nothing', () => {
    expect(answer(['Bloating', 'Wind'])).toEqual([])
  })

  it('follow-up detail never raises an item by itself', () => {
    expect(raiseForFollowUpDetail()).toEqual([])
    expect(ANNEX_FOLLOW_UPS.map((f) => f.id))
      .toEqual(['started', 'frequency', 'ongoing', 'gp_seen', 'associated'])
  })

  it('the case summary is a read-only view, and counts NOW notices', () => {
    const c = consolidateSafety(answer(['Black, tar-like stool']))
    expect(c.isReadOnlyView).toBe(true)
    expect(c.anyOpen).toBe(true)
    expect(c.noticeNowCount).toBe(1)
  })

  it('inventories every approved Annex node for review mode', () => {
    const inv = annexNodeInventory()
    expect(inv.map((i) => i.ruleNumber).sort((a, b) => a - b)).toEqual([7, 9, 26])
    expect(inv.every((i) => i.approvedQuestion.length > 0)).toBe(true)
  })
})

// ── §4 Concept identity cannot collapse across variants ────────────────────

describe('concept reference requires its variant', () => {
  it('refuses a parameterised concept without one', () => {
    const r = conceptReference('intake.systems.*.symptoms')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('variant_required')
  })

  it('accepts it with a valid variant', () => {
    const r = conceptReference('intake.systems.*.symptoms', 'digestive')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.ref).toEqual({ conceptId: 'intake.systems.*.symptoms', variant: 'digestive' })
  })

  it('refuses a variant the concept does not have', () => {
    // Catches a plausible-looking but wrong system key — exactly what a
    // label-based assumption produces.
    const r = conceptReference('intake.systems.*.symptoms', 'digestion')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('variant_not_valid_for_concept')
  })

  it('refuses a variant on a concept that has no dimension', () => {
    const plain = CONCEPT_LAYER.find((c) => !c.id.includes('*'))!
    const r = conceptReference(plain.id, 'digestive')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('variant_not_applicable')
  })

  it('derives the variant from the FIELD id, never from a label', () => {
    const r = conceptReferenceForField('intake.systems.digestive.symptoms')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.ref.variant).toBe('digestive')
  })

  it('THREE SYSTEMS SHARING ONE CONCEPT ARE NOT INTERCHANGEABLE', () => {
    // The collapse this model exists to prevent.
    const dig = conceptReferenceForField('intake.systems.digestive.symptoms')
    const slp = conceptReferenceForField('intake.systems.sleep.symptoms')
    const eng = conceptReferenceForField('intake.systems.energy_endocrine.symptoms')
    expect(dig.ok && slp.ok && eng.ok).toBe(true)
    if (!dig.ok || !slp.ok || !eng.ok) return

    // Same concept id...
    expect(dig.ref.conceptId).toBe(slp.ref.conceptId)
    expect(dig.ref.conceptId).toBe(eng.ref.conceptId)
    // ...and NOT the same thing.
    expect(sameConcept(dig.ref, slp.ref)).toBe(false)
    expect(sameConcept(dig.ref, eng.ref)).toBe(false)
    expect(sameConcept(slp.ref, eng.ref)).toBe(false)
    expect(new Set([dig.ref, slp.ref, eng.ref].map(conceptRefKey)).size).toBe(3)
  })

  it('grouping keeps the three apart', () => {
    const fields = [
      'intake.systems.digestive.symptoms',
      'intake.systems.sleep.symptoms',
      'intake.systems.energy_endocrine.symptoms',
    ]
    const grouped = groupByConceptReference(fields, (f) => {
      const r = conceptReferenceForField(f)
      if (!r.ok) throw new Error(`unresolved ${f}`)
      return r.ref
    })
    // Keyed on concept id alone this would be ONE group of three.
    expect(grouped.size).toBe(3)
    for (const [, g] of grouped) expect(g.items).toHaveLength(1)
  })

  it('does not inflate the concept count by cloning the template', () => {
    // The template model is preserved: one generic concept across twelve
    // systems, not twelve copies of it.
    const symptoms = CONCEPT_LAYER.filter((c) => c.id === 'intake.systems.*.symptoms')
    expect(symptoms).toHaveLength(1)
    expect(symptoms[0].variants).toHaveLength(12)
  })
})

// ── §3 The three authorised canonical fields ───────────────────────────────

describe('the three authorised fields', () => {
  it('exist and are distinct from the fields they were kept out of', () => {
    for (const id of [
      'intake.systems.digestive.bowel_frequency',
      'intake.systems.digestive.stool_form',
      'intake.systems.sleep.typical_sleep_duration_hours',
    ]) expect(V2_FIELD_REGISTRY.find((f) => f.id === id), id).toBeDefined()

    // The refusals that produced them must stay true.
    expect(V2_FIELD_REGISTRY.find((f) => f.id === 'intake.systems.digestive.frequency')).toBeDefined()
    expect(V2_FIELD_REGISTRY.find((f) => f.id === 'intake.systems.sleep.frequency')).toBeDefined()
  })

  it('takes the registry to 387 fields', () => {
    // POSITION TEST. 384 -> 387 on Founder authorisation.
    expect(V2_FIELD_REGISTRY.length).toBe(387)
  })

  it('closed the three UNMAPPED entries without approving them', () => {
    const s = summariseMappingPack()
    expect(s.needNewField).toEqual([])
    expect(s.byStatus.UNMAPPED).toBe(0)
    // Authorising a FIELD is not approving a MAPPING.
    expect(s.approved).toBe(0)
    expect(s.allWritesBlocked).toBe(true)
  })
})

// ── §9 Section versus case-wide ─────────────────────────────────────────────

describe('section versus case-wide status', () => {
  const withSleepFlag = () => deriveCockpitSafetyItems({
    caseId: CASE, at: AT,
    answers: [{ questionId: 'v2.sleep.noticed', value: ['Night sweats that soak the bedding'] }],
  })

  it('another stream\'s open item never blocks this section', () => {
    const state = newCaptureState(CASE)
    const gate = finishSectionGate(state, 'digestion', withSleepFlag())
    expect(gate.canFinish).toBe(true)
    expect(gate.blockers).toEqual([])
    expect(gate.remainsOpen.join(' ')).toMatch(/other streams/)
  })

  it('reports open items elsewhere separately from here', () => {
    const items = withSleepFlag()
    expect(openItemsElsewhere(items, 'digestion')).toHaveLength(1)
    expect(openItemsElsewhere(items, 'sleep')).toHaveLength(0)
    const cw = caseWideSafetyStatus(newCaptureState(CASE), 'digestion', items)
    expect(cw.openElsewhere).toBe(1)
    expect(cw.sectionsElsewhere).toEqual(['sleep'])
  })

  it('an unfinished branch in THIS section does block finishing', () => {
    const s = recordAnswer(newCaptureState(CASE), {
      questionId: DIGESTION_Q, value: ['A change in your usual bowel habit'],
      provenance: 'client_reported', at: AT, actor: PRAC,
    })
    const gate = finishSectionGate(s, 'digestion')
    expect(gate.canFinish).toBe(false)
    expect(gate.blockers.join(' ')).toMatch(/Digging branch not finished/)
  })

  it('finishing never closes a human-review item, and the label says so', () => {
    let s = recordAnswer(newCaptureState(CASE), {
      questionId: DIGESTION_Q, value: ['Blood in the stool'],
      provenance: 'client_reported', at: AT, actor: PRAC,
    })
    const items = deriveCockpitSafetyItems({
      caseId: CASE, at: AT, answers: [{ questionId: DIGESTION_Q, value: ['Blood in the stool'] }],
    })
    // Satisfy the branch so the only thing left is the review.
    const edge = edgeById('dig.digestion.blood_in_stool')!
    for (const t of orderedTargets(edge)) {
      s = recordBranchDetail(s, {
        edgeId: edge.id, targetKey: targetKey(edge, t), value: 'recorded',
        provenance: 'client_reported', at: AT, actor: PRAC,
      })
    }

    const gate = finishSectionGate(s, 'digestion', items)
    expect(gate.canFinish).toBe(true)
    expect(gate.leavesReviewOpen).toBe(true)
    expect(gate.label).toBe(FINISH_SECTION_LABEL)

    const after = finishSection(s, 'digestion', items)
    expect(after.finished).toBe(true)
    // The item is untouched — finishSection cannot reach it.
    expect(consolidateSafety(items).anyOpen).toBe(true)
    expect(items[0].record.state).toBe('open')
  })

  it('unanswered is never treated as No', () => {
    const st = sectionStatus(newCaptureState(CASE), 'digestion')
    // No pilot question is `required`, so nothing is listed as mandatory —
    // and crucially nothing is recorded as answered either.
    expect(st.mandatoryUnanswered).toEqual([])
    expect(contributions(newCaptureState(CASE))).toEqual([])
  })

  it('names safety questions not yet asked in other streams', () => {
    const cw = caseWideSafetyStatus(newCaptureState(CASE), 'digestion', [])
    expect(cw.unaskedSafetyElsewhere.map((u) => u.section).sort())
      .toEqual(['energy_metabolic', 'sleep'])
  })
})

// ── §2 Guidance supports but never enters the record ────────────────────────

describe('the guide', () => {
  it('is advisory only, with nothing a capture function would accept', () => {
    const panel = buildGuidancePanel({
      section: 'digestion', focusQuestionId: DIGESTION_Q, state: newCaptureState(CASE),
    })
    expect(panel.isAdvisoryOnly).toBe(true)
    // No block or line carries a value or provenance — the two things capture
    // needs. If either appeared, guidance could become record content.
    for (const b of panel.blocks) {
      for (const l of b.lines) {
        expect(Object.keys(l).sort()).toEqual(expect.arrayContaining(['source', 'text']))
        expect(l).not.toHaveProperty('value')
        expect(l).not.toHaveProperty('provenance')
      }
    }
  })

  it('names the APPROVED ANNEX question not yet asked, verbatim', () => {
    const panel = buildGuidancePanel({ section: 'digestion', state: newCaptureState(CASE) })
    const block = panel.blocks.find((b) => b.id === 'dont_miss')!
    expect(block.lines[0].text).toMatch(/Not yet asked/)
    // The approved wording, not the chip question's label.
    expect(block.lines[0].text).toContain('Have you noticed blood in or on your stools')
    expect(block.lines[0].ref).toMatch(/^annex1\.rule/)
  })

  it('escalates to "relevant now" when an answer makes a rule relevant', () => {
    const s = recordAnswer(newCaptureState(CASE), {
      questionId: DIGESTION_Q, value: ['Mucus in the stool'],
      provenance: 'client_reported', at: AT, actor: PRAC,
    })
    const block = buildGuidancePanel({ section: 'digestion', state: s })
      .blocks.find((b) => b.id === 'dont_miss')!
    expect(block.lines.some((l) => /Relevant now — ask/.test(l.text))).toBe(true)
  })

  it('keeps "Don\'t miss" until the APPROVED question is answered', () => {
    // Answering the chip question is not answering Rule 7. A client who
    // bleeds only on wiping would be missed if this dropped here.
    const s = recordAnswer(newCaptureState(CASE), {
      questionId: DIGESTION_Q, value: ['Bloating'], provenance: 'client_reported', at: AT, actor: PRAC,
    })
    const panel = buildGuidancePanel({ section: 'digestion', state: s })
    expect(panel.blocks.find((b) => b.id === 'dont_miss')).toBeDefined()

    // It drops once every Annex node in the section is answered.
    const answered = buildGuidancePanel({
      section: 'digestion', state: s,
      safetyNodes: buildSafetyNodes({
        caseId: CASE, answers: [],
        nodeAnswers: {
          'annex1.rule7': { answer: 'NO', at: AT, actorId: 'p', actorDisplayName: 'A', via: 'approved_question' },
          'annex1.rule9': { answer: 'NO', at: AT, actorId: 'p', actorDisplayName: 'A', via: 'approved_question' },
        },
      }),
    })
    expect(answered.blocks.find((b) => b.id === 'dont_miss')).toBeUndefined()
  })

  it('shows student support only in student mode', () => {
    const base = { section: 'digestion' as const, state: newCaptureState(CASE) }
    expect(buildGuidancePanel(base).blocks.find((b) => b.id === 'student_support')).toBeUndefined()
    expect(buildGuidancePanel({ ...base, isStudent: true })
      .blocks.find((b) => b.id === 'student_support')).toBeDefined()
  })

  it('keeps every block short so it cannot compete with the capture pane', () => {
    const s = recordAnswer(newCaptureState(CASE), {
      questionId: DIGESTION_Q,
      value: ['Blood in the stool', 'A change in your usual bowel habit', 'Heartburn or reflux'],
      provenance: 'client_reported', at: AT, actor: PRAC,
    })
    const panel = buildGuidancePanel({ section: 'digestion', focusQuestionId: DIGESTION_Q, state: s })
    for (const b of panel.blocks) expect(b.lines.length, b.id).toBeLessThanOrEqual(4)
  })

  it('answers the practitioner\'s four questions', () => {
    let s = recordAnswer(newCaptureState(CASE), {
      questionId: DIGESTION_Q, value: ['A change in your usual bowel habit'],
      provenance: 'client_reported', at: AT, actor: PRAC,
    })
    const items = deriveCockpitSafetyItems({
      caseId: CASE, at: AT,
      answers: [{ questionId: DIGESTION_Q, value: ['A change in your usual bowel habit'] }],
    })
    const o = orient({ section: 'digestion', state: s, safetyItems: items })
    expect(o.whatShouldIAskNow).toBeTruthy()
    expect(o.whatShouldIExploreNext).toBeTruthy()
    expect(o.whatStillNeedsRecordingOrReview).toMatch(/awaiting human review/)

    // Nothing in the orientation decides anything clinically.
    const all = Object.values(o).filter(Boolean).join(' ')
    expect(all).not.toMatch(/likely|probably|suggests|indicates|diagnos|urgent|risk of/i)

    // "Don't overlook" clears only when the APPROVED questions are answered —
    // not when the ordinary questions around them are.
    s = recordAnswer(s, {
      questionId: 'v2.digestion.bowel_frequency', value: 'Every two or three days',
      provenance: 'client_reported', at: AT, actor: PRAC,
    })
    expect(orient({ section: 'digestion', state: s }).whatMustINotOverlook).not.toBeNull()

    const allAnswered = buildSafetyNodes({
      caseId: CASE, answers: [],
      nodeAnswers: {
        'annex1.rule7': { answer: 'NO', at: AT, actorId: 'p', actorDisplayName: 'A', via: 'approved_question' },
        'annex1.rule9': { answer: 'NO', at: AT, actorId: 'p', actorDisplayName: 'A', via: 'approved_question' },
      },
    })
    expect(orient({ section: 'digestion', state: s, safetyNodes: allAnswered }).whatMustINotOverlook)
      .toBeNull()
  })
})

// ── §4 Technical detail is hidden unless asked for ──────────────────────────

describe('node details · review mode', () => {
  it('exposes the plumbing only through nodeDetails', () => {
    const d = nodeDetails(DIGESTION_Q)!
    expect(d.conceptRef).toEqual({ conceptId: 'intake.systems.*.symptoms', variant: 'digestive' })
    expect(d.fieldIds).toEqual(['intake.systems.digestive.symptoms'])
    expect(d.mappingStatus).toBe('NEEDS_REVIEW')
    expect(d.writeBlocked).toBe(true)
    expect(d.redFlagValues.length).toBeGreaterThan(0)
    expect(d.edges.length).toBeGreaterThan(0)
    expect(d.redFlagValues).toContain('Blood in the stool')
  })

  it('does not leak ids into the practitioner guide text', () => {
    const panel = buildGuidancePanel({
      section: 'digestion', focusQuestionId: DIGESTION_Q, state: newCaptureState(CASE),
    })
    // `ref` is for review mode; the TEXT a practitioner reads must not carry
    // question ids, concept ids or field paths.
    for (const b of panel.blocks) {
      for (const l of b.lines) {
        expect(l.text, l.text).not.toMatch(/v2\.[a-z_]+\.[a-z_]+/)
        expect(l.text, l.text).not.toMatch(/intake\.systems\./)
      }
    }
  })

  it('returns nothing for a question outside the pilot', () => {
    expect(nodeDetails('v2.mood.safety')).toBeNull()
  })
})

// ── §10 Student mode ────────────────────────────────────────────────────────

describe('student mode', () => {
  it('may capture, record words, save, submit and ask safety questions', () => {
    for (const c of STUDENT_CAPABILITIES) expect(can(STUDENT, c).allowed, c).toBe(true)
  })

  it('may not verify, finalise, close safety, sign, retire a branch or finish', () => {
    for (const c of [
      'verify_qualified_matter', 'finalise_practitioner_interpretation',
      'close_safety_review', 'sign_or_release_protocol',
      'mark_branch_no_longer_relevant', 'finish_section',
    ] as const) {
      const d = can(STUDENT, c)
      expect(d.allowed, c).toBe(false)
      expect(d.reason, c).toBeTruthy()
    }
  })

  it('cannot capture at all without a recorded supervisor', () => {
    const d = can(UNSUPERVISED, 'capture_client_answer')
    expect(d.allowed).toBe(false)
    expect(d.reason).toMatch(/supervising practitioner/i)
  })

  it('records every student entry as an attributed draft', () => {
    const s = recordAnswer(newCaptureState(CASE), {
      questionId: DIGESTION_Q, value: ['Bloating'], provenance: 'client_reported', at: AT, actor: STUDENT,
    })
    expect(s.answers[DIGESTION_Q].draft).toBe(true)
    expect(studentDrafts(s)).toHaveLength(1)
    expect(attributionLine(STUDENT, AT)).toMatch(/Saima Student · student · draft for supervision/)
  })

  it('a practitioner entry is not a draft', () => {
    const s = recordAnswer(newCaptureState(CASE), {
      questionId: DIGESTION_Q, value: ['Bloating'], provenance: 'client_reported', at: AT, actor: PRAC,
    })
    expect(s.answers[DIGESTION_Q].draft).toBe(false)
  })

  it('submission hands over without closing anything', () => {
    const r = submitForSupervision({
      actor: STUDENT, caseId: CASE, section: 'digestion', at: AT,
      draftAnswerCount: 2, openSafetyItemCount: 1, handoverNote: 'Asked everything; unsure about the dates.',
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.submission.supervisorId).toBe('prac-1')
      expect(r.submission.openSafetyItemCount).toBe(1)
      // Counts only — no clinical content travels in the submission.
      expect(Object.keys(r.submission)).not.toContain('answers')
    }
  })

  it('refuses submission from a practitioner, an unsupervised student, or with nothing to send', () => {
    expect(submitForSupervision({ actor: PRAC, caseId: CASE, section: 'digestion', at: AT, draftAnswerCount: 1, openSafetyItemCount: 0 }))
      .toMatchObject({ ok: false, reason: 'not_a_student' })
    expect(submitForSupervision({ actor: UNSUPERVISED, caseId: CASE, section: 'digestion', at: AT, draftAnswerCount: 1, openSafetyItemCount: 0 }))
      .toMatchObject({ ok: false, reason: 'no_supervisor' })
    expect(submitForSupervision({ actor: STUDENT, caseId: CASE, section: 'digestion', at: AT, draftAnswerCount: 0, openSafetyItemCount: 0 }))
      .toMatchObject({ ok: false, reason: 'nothing_to_submit' })
  })
})

// ── §12 Timer and work log ──────────────────────────────────────────────────

describe('the consultation timer', () => {
  const T0 = '2026-10-21T10:00:00.000Z'
  const T5 = '2026-10-21T10:05:00.000Z'
  const T7 = '2026-10-21T10:07:00.000Z'
  const T70 = '2026-10-21T11:10:00.000Z'

  it('runs, pauses, resumes and excludes paused time', () => {
    let t = startTimer(newTimer(60), T0)
    expect(t.state).toBe('running')
    t = pauseTimer(t, T5, 'client stepped out')
    expect(t.state).toBe('paused')
    expect(t.accumulatedSeconds).toBe(300)
    expect(t.pauseCount).toBe(1)
    expect(t.pauseReason).toBe('client stepped out')
    // Two minutes pass while paused and must not count as active.
    t = resumeTimer(t, T7)
    expect(activeSeconds(t, T7)).toBe(300)
    expect(pausedSeconds(t, T7)).toBe(120)
  })

  it('logs pause time as its own segment', () => {
    let t = startTimer(newTimer(60), T0)
    t = pauseTimer(t, T5)
    expect(pausedSeconds(t, T7)).toBe(120)   // still paused, clock runs on pause
    t = resumeTimer(t, T7)
    expect(pausedSeconds(t, T70)).toBe(120)  // frozen once resumed
  })

  it('reports overrun against the planned duration', () => {
    const t = startTimer(newTimer(60), T0)
    expect(isOverrunning(t, T5)).toBe(false)
    expect(isOverrunning(t, T70)).toBe(true)
    expect(overrunSeconds(t, T70)).toBe(600)
  })

  it('refuses to complete an overrun without a structured reason', () => {
    const r = completeTimer(startTimer(newTimer(60), T0), T70)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('overrun_reason_required')
  })

  it('completes an overrun with a reason from the APPROVED list', () => {
    const r = completeTimer(startTimer(newTimer(60), T0), T70, {
      reason: 'safety_or_safeguarding_clarification',
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.session.overrunReason).toBe('safety_or_safeguarding_clarification')
  })

  it('uses exactly the six approved overrun reasons', () => {
    // LOCKED PRODUCT DESIGN. An earlier draft had seven reasons of my own;
    // they were replaced wholesale, not merged.
    expect([...OVERRUN_REASONS]).toEqual([
      'complexity_or_additional_history',
      'client_accessibility_or_support_needs',
      'technical_interruption',
      'safety_or_safeguarding_clarification',
      'client_interruption',
      'other',
    ])
    expect(OVERRUN_REASON_LABELS.safety_or_safeguarding_clarification)
      .toBe('Safety or safeguarding clarification')
  })

  it('completes within time without needing a reason', () => {
    const r = completeTimer(startTimer(newTimer(60), T0), T5)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.session.state).toBe('completed')
      expect(r.session.overrunReason).toBeNull()
      expect(r.session.completedAt).toBe(T5)
    }
  })

  it('stops the clock on completion without counting a pause', () => {
    const r = completeTimer(startTimer(newTimer(60), T0), T5)
    if (r.ok) {
      expect(r.session.pauseCount).toBe(0)
      expect(r.session.pausedSeconds).toBe(0)
      expect(activeSeconds(r.session, T70)).toBe(300)   // frozen at completion
    }
  })

  it('holds exactly the approved operational fields, and no clinical note', () => {
    // THE WHOLE SHAPE, PINNED. A clinical field could not be added without
    // this failing, and there is no free-text field for one to arrive in.
    const r = completeTimer(startTimer(newTimer(60), T0), T70, { reason: 'client_interruption' })
    const entry = toWorkLogEntry((r as { session: ReturnType<typeof newTimer> }).session, {
      caseId: CASE, practitionerId: 'prac-1', practitionerDisplayName: 'Amara Okafor',
      workReference: 'NI-W-0217', at: T70,
    })
    expect(Object.keys(entry).sort()).toEqual([
      'activeSeconds', 'caseId', 'completedAt', 'overran', 'overrunReason',
      'overrunSeconds', 'pauseCount', 'pauseSeconds', 'plannedMinutes',
      'practitionerDisplayName', 'practitionerId', 'startedAt', 'workReference',
    ])
    expect(entry.overran).toBe(true)
    expect(entry.workReference).toBe('NI-W-0217')
    // No field anywhere in the entry can hold prose.
    expect(JSON.stringify(entry)).not.toMatch(/note/i)
  })

  it('cannot influence what is asked', () => {
    expect(TIMER_CANNOT_AFFECT_CONTENT.takesNoClinicalInput).toBe(true)
    expect(TIMER_CANNOT_AFFECT_CONTENT.operationalFieldsOnly).toBe(true)
    const gate = finishSectionGate(newCaptureState(CASE), 'digestion')
    expect(JSON.stringify(gate)).not.toMatch(/timer|minute|overrun/i)
  })

  it('formats for the chrome', () => {
    expect(formatDuration(0)).toBe('00:00')
    expect(formatDuration(65)).toBe('01:05')
    expect(formatDuration(3725)).toBe('1:02:05')
  })
})

// ── Approved V4 human-review outcomes ──────────────────────────────────────

describe('V4 review outcomes', () => {
  const REVIEWER = { reviewerId: 'prac-1', reviewerDisplayName: 'Elin Marsh', at: AT, canClose: true }

  it('are exactly the approved five, in order', () => {
    expect([...V4_REVIEW_OUTCOMES]).toEqual([
      'prompt_clinical_review',
      'routine_practitioner_review',
      'safeguarding_action',
      'needs_human_contact_for_more_information',
      'no_further_action_required',
    ])
    expect(V4_REVIEW_OUTCOME_LABELS.needs_human_contact_for_more_information)
      .toBe('Needs human contact for more information')
  })

  it('pre-selects nothing', () => {
    expect(DEFAULT_REVIEW_OUTCOME).toBeNull()
    expect(recordReviewOutcome({ ...REVIEWER, outcome: null }))
      .toMatchObject({ ok: false, reason: 'no_outcome_selected' })
  })

  it('records a named human decision', () => {
    const r = recordReviewOutcome({
      ...REVIEWER, outcome: 'routine_practitioner_review',
      actionTaken: 'Asked her to book with her GP; she agreed.',
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.recorded.reviewerDisplayName).toBe('Elin Marsh')
      expect(r.recorded.at).toBe(AT)
    }
  })

  it('refuses an outcome outside the approved list', () => {
    expect(recordReviewOutcome({ ...REVIEWER, outcome: 'urgent_referral' }))
      .toMatchObject({ ok: false, reason: 'unknown_outcome' })
  })

  it('refuses an unnamed reviewer', () => {
    expect(recordReviewOutcome({
      ...REVIEWER, outcome: 'no_further_action_required', reviewerDisplayName: '  ',
    })).toMatchObject({ ok: false, reason: 'no_reviewer' })
  })

  it('refuses anyone who may not close the item', () => {
    // A student may capture a safety answer and may not close it. The
    // boundary is enforced by the caller and respected here.
    expect(recordReviewOutcome({
      ...REVIEWER, outcome: 'no_further_action_required', canClose: false,
    })).toMatchObject({ ok: false, reason: 'not_permitted' })
    expect(can(STUDENT, 'close_safety_review').allowed).toBe(false)
  })

  it('offers no function that suggests an outcome', () => {
    // NI shows the approved list and records what a human chose. If a
    // "suggest" or "recommend" export ever appeared, this would fail.
    const names = Object.keys(reviewOutcomesModule).join(' ')
    expect(names).not.toMatch(/suggest|recommend|infer|score|rank|triage|urgency/i)
    expect(names).toContain('recordReviewOutcome')
  })
})


// ── §17 The acceptance chain ────────────────────────────────────────────────

describe('the acceptance chain, end to end', () => {
  it('is demonstrable for a red-flag digestion answer', () => {
    let s = recordAnswer(newCaptureState(CASE), {
      questionId: DIGESTION_Q,
      value: ['Bloating', 'A change in your usual bowel habit'],
      provenance: 'client_reported', at: AT, actor: PRAC,
    })
    const edge = edgeById('dig.digestion.bowel_habit_change')!
    s = recordBranchDetail(s, {
      edgeId: edge.id, targetKey: targetKey(edge, orderedTargets(edge)[0]),
      value: 'About six weeks, from daily to every third day.',
      provenance: 'client_reported', at: AT, actor: PRAC,
    })
    const items = deriveCockpitSafetyItems({
      caseId: CASE, at: AT,
      answers: [{ questionId: DIGESTION_Q, value: ['Bloating', 'A change in your usual bowel habit'] }],
    })

    const chain = resolveChain({
      questionId: DIGESTION_Q, state: s, hasGuidance: true, safetyItemCount: items.length,
    })

    // Every link present...
    for (const l of chain.links) expect(l.present, `${l.name}: ${l.detail}`).toBe(true)
    expect(chain.complete).toBe(true)
    // ...and the last one honest about not being written.
    expect(chain.persisted).toBe(false)

    const c = contributions(s, 'digestion')
    expect(c.find((x) => x.questionId === DIGESTION_Q)!.state).toBe('projected')
    expect(summariseContributions(s).nothingPersisted).toBe(true)
  })

  it('projects to the authorised field, still without writing', () => {
    const s = recordAnswer(newCaptureState(CASE), {
      questionId: 'v2.digestion.stool_form', value: 'Smooth and soft',
      provenance: 'client_reported', at: AT, actor: PRAC,
    })
    const c = contributions(s)[0]
    expect(c.state).toBe('projected')
    expect(c.fieldIds).toEqual(['intake.systems.digestive.stool_form'])
    expect(c.conceptRef).toEqual({ conceptId: 'intake.systems.*.stool_form', variant: 'digestive' })
    expect(c.blockReason).toMatch(/NEEDS_REVIEW|APPROVED/)
  })

  it('shows where a mapped answer WOULD land in the synopsis', () => {
    const s = recordAnswer(newCaptureState(CASE), {
      questionId: DIGESTION_Q, value: ['Bloating'], provenance: 'client_reported', at: AT, actor: PRAC,
    })
    expect(contributions(s)[0].synopsisSections).toEqual(['systems_review'])
  })
})
