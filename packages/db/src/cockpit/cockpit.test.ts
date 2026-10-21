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
  // safety
  ANNEX_1_STATUS, deriveCockpitSafetyItems, triggersHumanReview,
  raiseForFollowUpDetail, consolidateSafety, openItemsElsewhere,
  pilotRedFlagInventory,
  // guidance
  buildGuidancePanel, orient, nodeDetails,
  // section status
  sectionStatus, caseWideSafetyStatus, finishSectionGate, finishSection,
  FINISH_SECTION_LABEL,
  // student
  can, submitForSupervision, attributionLine, STUDENT_CAPABILITIES,
  // timer
  newTimer, startTimer, pauseTimer, resumeTimer, activeSeconds, isOverrunning,
  completeTimer, toWorkLogEntry, TIMER_CANNOT_AFFECT_CONTENT, formatDuration,
  // chain
  resolveChain, contributions, summariseContributions,
  type CaptureActor,
} from './index'

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

  it('refuses to guess a destination it does not have', () => {
    // The three the pilot deliberately left UNMAPPED rather than force-fit.
    for (const id of ['v2.digestion.bowel_frequency', 'v2.digestion.stool_form', 'v2.sleep.hours']) {
      const m = mappingFor(id)!
      expect(m.status, id).toBe('UNMAPPED')
      expect(m.fieldIds, id).toEqual([])
      expect(m.rationale, id).toBeTruthy()
      expect(m.gap, id).toMatch(/registry decision/i)
    }
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

// ── §8 Safety ───────────────────────────────────────────────────────────────

describe('safety', () => {
  const answer = (value: unknown, questionId = DIGESTION_Q) =>
    deriveCockpitSafetyItems({ caseId: CASE, at: AT, answers: [{ questionId, value }] })

  it('states plainly that Annex 1 is absent and substitutes nothing', () => {
    expect(ANNEX_1_STATUS.present).toBe(false)
    expect(ANNEX_1_STATUS.whatIsMissing).toEqual(
      expect.arrayContaining(['Annex 1 approved wording', 'Rule 7', 'Rule 9', 'Rule 26']),
    )
    // Every item leaves the rule link empty rather than inventing one.
    for (const i of answer(['Blood in the stool'])) {
      expect(i.annexRuleId).toBeNull()
      expect(i.annexStatus).toBe('awaiting_annex_1')
    }
  })

  it('a reported red flag raises an item needing a human', () => {
    const items = answer(['Bloating', 'Blood in the stool'])
    expect(items).toHaveLength(1)
    expect(items[0].record.state).toBe('open')
    expect(items[0].reason).toBe('red_flag_value_selected')
    expect(items[0].matchedOptions).toEqual(['Blood in the stool'])
  })

  it('asks once: one item per question carrying every matched red flag', () => {
    const items = answer(['Blood in the stool', 'Black, tar-like stool', 'Difficulty swallowing'])
    expect(items).toHaveLength(1)
    expect(items[0].matchedOptions).toHaveLength(3)
    expect(items[0].linkedSections).toEqual(['digestion'])
  })

  it('keeps the full reported answer, not just the red flags', () => {
    const items = answer(['Bloating', 'Wind', 'Blood in the stool'])
    expect(items[0].rawAnswer).toEqual(['Bloating', 'Wind', 'Blood in the stool'])
  })

  it('an ordinary answer raises nothing', () => {
    expect(answer(['Bloating', 'Wind'])).toEqual([])
    expect(triggersHumanReview(DIGESTION_Q, 'Bloating')).toBeNull()
  })

  it('"not sure" on a red-flag question is not a No', () => {
    expect(triggersHumanReview(DIGESTION_Q, 'Not sure'))
      .toBe('uncertain_answer_to_red_flag_question')
    const items = answer(['Not sure'])
    expect(items).toHaveLength(1)
    expect(items[0].reason).toBe('uncertain_answer_to_red_flag_question')
    // Nothing matched, and the item says so rather than pretending otherwise.
    expect(items[0].matchedOptions).toEqual([])
  })

  it('does not double-raise when a red flag and an uncertainty both appear', () => {
    const items = answer(['Blood in the stool', 'Not sure'])
    expect(items).toHaveLength(1)
    expect(items[0].reason).toBe('red_flag_value_selected')
  })

  it('follow-up detail never raises an item by itself', () => {
    expect(raiseForFollowUpDetail()).toEqual([])
  })

  it('the case-level summary is a read-only view, not a questionnaire', () => {
    const c = consolidateSafety(answer(['Blood in the stool']))
    expect(c.isReadOnlyView).toBe(true)
    expect(c.anyOpen).toBe(true)
    expect(c.sectionsWithOpenItems).toEqual(['digestion'])
  })

  it('every approved red-flag value in the pilot is inventoried', () => {
    const inv = pilotRedFlagInventory()
    expect(inv.length).toBe(summarisePilot().redFlagValueCount)
    expect(inv.map((i) => i.value)).toContain('Night sweats that soak the bedding')
    expect(inv.map((i) => i.value)).not.toContain('Night sweats')
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

  it('names approved red-flag questions not yet asked under "Don\'t miss"', () => {
    const panel = buildGuidancePanel({ section: 'digestion', state: newCaptureState(CASE) })
    const block = panel.blocks.find((b) => b.id === 'dont_miss')!
    expect(block.lines[0].text).toMatch(/Not yet asked/)
    expect(block.lines[0].ref).toBe(DIGESTION_Q)
  })

  it('drops "Don\'t miss" once the question has been asked', () => {
    const s = recordAnswer(newCaptureState(CASE), {
      questionId: DIGESTION_Q, value: ['Bloating'], provenance: 'client_reported', at: AT, actor: PRAC,
    })
    const panel = buildGuidancePanel({ section: 'digestion', state: s })
    expect(panel.blocks.find((b) => b.id === 'dont_miss')).toBeUndefined()
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

    s = recordAnswer(s, {
      questionId: 'v2.digestion.bowel_frequency', value: 'Every two or three days',
      provenance: 'client_reported', at: AT, actor: PRAC,
    })
    expect(orient({ section: 'digestion', state: s }).whatMustINotOverlook).toBeNull()
  })
})

// ── §4 Technical detail is hidden unless asked for ──────────────────────────

describe('node details · review mode', () => {
  it('exposes the plumbing only through nodeDetails', () => {
    const d = nodeDetails(DIGESTION_Q)!
    expect(d.conceptId).toBe('intake.systems.*.symptoms')
    expect(d.fieldIds).toEqual(['intake.systems.digestive.symptoms'])
    expect(d.mappingStatus).toBe('NEEDS_REVIEW')
    expect(d.writeBlocked).toBe(true)
    expect(d.annexRuleId).toBeNull()
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
    t = pauseTimer(t, T5)
    expect(t.state).toBe('paused')
    expect(t.accumulatedSeconds).toBe(300)
    expect(t.pauseCount).toBe(1)
    // Two minutes pass while paused and must not count.
    t = resumeTimer(t, T7)
    expect(activeSeconds(t, T7)).toBe(300)
  })

  it('reports overrun against the planned duration', () => {
    const t = startTimer(newTimer(60), T0)
    expect(isOverrunning(t, T5)).toBe(false)
    expect(isOverrunning(t, T70)).toBe(true)
  })

  it('refuses to complete an overrun without a structured reason', () => {
    const t = startTimer(newTimer(60), T0)
    const r = completeTimer(t, T70)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('overrun_reason_required')
  })

  it('completes an overrun with a reason from the fixed list', () => {
    const t = startTimer(newTimer(60), T0)
    const r = completeTimer(t, T70, { reason: 'safety_matter_needed_time' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.session.overrunReason).toBe('safety_matter_needed_time')
  })

  it('completes within time without needing a reason', () => {
    const r = completeTimer(startTimer(newTimer(60), T0), T5)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.session.state).toBe('completed')
      expect(r.session.overrunReason).toBeNull()
    }
  })

  it('keeps the operational log free of clinical content', () => {
    const r = completeTimer(startTimer(newTimer(60), T0), T70, {
      reason: 'other_operational', note: 'Room double-booked.',
    })
    const entry = toWorkLogEntry((r as { session: ReturnType<typeof newTimer> }).session, {
      caseId: CASE, practitionerId: 'prac-1', at: T70,
    })
    // The whole shape, pinned. A clinical field could not be added without
    // this failing.
    expect(Object.keys(entry).sort()).toEqual([
      'activeSeconds', 'caseId', 'completedAt', 'overran', 'overrunNote',
      'overrunReason', 'overrunSeconds', 'pauseCount', 'plannedMinutes',
      'practitionerId', 'startedAt',
    ])
    expect(entry.overran).toBe(true)
  })

  it('keeps a free-text note only for the operational reason, and caps it', () => {
    const long = 'x'.repeat(400)
    const r = completeTimer(startTimer(newTimer(60), T0), T70, { reason: 'other_operational', note: long })
    if (r.ok) expect(r.session.overrunNote!.length).toBeLessThanOrEqual(140)

    // A note offered with a non-"other" reason is discarded — there is no
    // route for clinical detail to ride in on a structured reason.
    const r2 = completeTimer(startTimer(newTimer(60), T0), T70, {
      reason: 'client_needed_longer', note: 'Discussed her blood results in detail.',
    })
    if (r2.ok) expect(r2.session.overrunNote).toBeNull()
  })

  it('cannot influence what is asked', () => {
    expect(TIMER_CANNOT_AFFECT_CONTENT.takesNoClinicalInput).toBe(true)
    expect(TIMER_CANNOT_AFFECT_CONTENT.operationalFieldsOnly).toBe(true)
    // The timer never appears in the section gate or the safety path.
    const gate = finishSectionGate(newCaptureState(CASE), 'digestion')
    expect(JSON.stringify(gate)).not.toMatch(/timer|minute|overrun/i)
  })

  it('formats for the chrome', () => {
    expect(formatDuration(0)).toBe('00:00')
    expect(formatDuration(65)).toBe('01:05')
    expect(formatDuration(3725)).toBe('1:02:05')
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

  it('reports no_destination rather than inventing one', () => {
    const s = recordAnswer(newCaptureState(CASE), {
      questionId: 'v2.digestion.stool_form', value: 'Smooth and soft',
      provenance: 'client_reported', at: AT, actor: PRAC,
    })
    const c = contributions(s)[0]
    expect(c.state).toBe('no_destination')
    expect(c.fieldIds).toEqual([])
    expect(c.blockReason).toMatch(/registry decision|No canonical/i)
  })

  it('shows where a mapped answer WOULD land in the synopsis', () => {
    const s = recordAnswer(newCaptureState(CASE), {
      questionId: DIGESTION_Q, value: ['Bloating'], provenance: 'client_reported', at: AT, actor: PRAC,
    })
    expect(contributions(s)[0].synopsisSections).toEqual(['systems_review'])
  })
})
