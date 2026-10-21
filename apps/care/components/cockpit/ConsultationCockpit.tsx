'use client'

// ─── Consultation Cockpit V2 — PILOT ─────────────────────────────────────────
// Built against the approved UI handover (Founder, 21 Oct 2026). Board 1 is
// the master reference; Boards 2–5 and 9 supply the states.
//
// ── ONE STRUCTURAL ACCOMMODATION, REPORTED NOT REDESIGNED ───────────────────
//
// Board 1 is a full-viewport application shell with its own brand header,
// client identity and timer. Its product home, /cases/[caseId]/intake, sits
// inside the case-workspace layout, which already renders a TopBar, a
// CaseHeader and a section nav inside a 1100px container. Rendering the
// approved design inside that would duplicate the chrome twice over and crush
// the approved 440px + ~1000px panes to about 660px total.
//
// So the cockpit takes the viewport as a focused consultation surface while
// it is open. The route and the information architecture are unchanged — it
// is still Client Case → Intake / Case-taking — and the approved layout is
// reproduced exactly. Nothing was reinterpreted.
//
// ── NOTHING IS PERSISTED ────────────────────────────────────────────────────
//
// No Question → Concept(+variant) → Field mapping is APPROVED, so capture
// lives in React state for the pilot. Presentation does not override the
// mapping gate: a field path appearing on a board is not permission to write.

import { useMemo, useState } from 'react'
import {
  newCaptureState, recordAnswer, recordBranchDetail, reopenBranch,
  markBranchNoLongerRelevant, edgeFor, studentDrafts,
  deriveCockpitSafetyItems, buildSafetyNodes, nodesForSection,
  buildGuidancePanel, orient, nodeDetails, annexRulesForSection,
  sectionStatus, caseWideSafetyStatus, finishSectionGate, finishSection,
  summariseMappingPack, summarisePilot, ANNEX_1_STATUS,
  annexNodeInventory, unsuppliedSafetyValues,
  pilotQuestions, pilotStreamTitle, PILOT_SECTION_IDS,
  submitForSupervision, can,
  newTimer, startTimer, pauseTimer, resumeTimer, completeTimer,
  FINISH_SECTION_LABEL, FINISH_SECTION_LABEL_CLEAR,
  type CaptureActor, type CaptureState, type PilotSectionId,
  type OverrunReason, type TimerSession, type SafetyNodeAnswer,
  type AnnexAnswer, type WeightLossDetail, type V4ReviewOutcome,
} from '@natural-intelligence/db/cockpit'
import type { V2Provenance } from '@natural-intelligence/db/intakeV2'
import { C, Z } from './cockpitTokens'
import { CockpitHeader, SectionTabs, CockpitFooter, type SectionTab } from './CockpitChrome'
import { GuidePane, type GuideGeneratedItem } from './GuidePane'
import { CapturePane } from './CapturePane'
import { NodeDetailsDrawer } from './NodeDetailsDrawer'
import { FinishConsultation } from './FinishConsultation'

// FICTIONAL EXAMPLE DATA — replaced with real data at runtime.
const PRACTITIONER: CaptureActor = { id: 'prac-1', displayName: 'Elin Marsh', role: 'practitioner' }
const STUDENT: CaptureActor = {
  id: 'stu-1', displayName: 'T. Reyes', role: 'student', supervisorId: 'prac-1',
}
const CLIENT_LINE = 'Rosa Penhallow · 47'
const WORK_REFERENCE = 'NI-W-0217'

const now = () => new Date().toISOString()

export function ConsultationCockpit({ caseId }: { caseId: string }) {
  const [section, setSection] = useState<PilotSectionId>('digestion')
  const [state, setState] = useState<CaptureState>(() => newCaptureState(caseId))
  const [asStudent, setAsStudent] = useState(false)
  const [reviewMode, setReviewMode] = useState(false)
  const [focusQuestionId, setFocus] = useState<string | null>(null)
  const [detailsFor, setDetailsFor] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [timer, setTimer] = useState<TimerSession>(() => newTimer(60))
  const [finishing, setFinishing] = useState(false)
  const [nodeAnswers, setNodeAnswers] = useState<Record<string, SafetyNodeAnswer>>({})
  const [outcomes, setOutcomes] = useState<Record<string, string>>({})
  const [toast, setToast] = useState<string | null>(null)

  const actor = asStudent ? STUDENT : PRACTITIONER
  const questions = useMemo(() => pilotQuestions(section), [section])
  const clock = now()

  // Everything below is DERIVED. No second copy of the truth is kept, so the
  // two panes and the footer cannot drift from one another.
  const answerInputs = useMemo(() => Object.values(state.answers).map((a) => ({
    questionId: a.questionId, value: a.value, capturedAt: a.at,
  })), [state.answers])

  const safetyNodes = useMemo(
    () => buildSafetyNodes({ caseId, answers: answerInputs, nodeAnswers }),
    [caseId, answerInputs, nodeAnswers])
  const safetyItems = useMemo(
    () => deriveCockpitSafetyItems({ caseId, at: clock, answers: answerInputs, nodeAnswers }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [caseId, answerInputs, nodeAnswers])

  const sectionNodes = useMemo(() => nodesForSection(safetyNodes, section), [safetyNodes, section])
  const sStatus = useMemo(() => sectionStatus(state, section, safetyItems), [state, section, safetyItems])
  const caseWide = useMemo(() => caseWideSafetyStatus(state, section, safetyItems), [state, section, safetyItems])
  const gate = useMemo(() => finishSectionGate(state, section, safetyItems), [state, section, safetyItems])
  const panel = useMemo(() => buildGuidancePanel({
    section, focusQuestionId, state, safetyItems, safetyNodes, isStudent: asStudent,
  }), [section, focusQuestionId, state, safetyItems, safetyNodes, asStudent])
  const orientation = useMemo(() => orient({
    section, state, safetyItems, safetyNodes,
  }), [section, state, safetyItems, safetyNodes])
  const details = useMemo(() => (detailsFor ? nodeDetails(detailsFor, state) : null), [detailsFor, state])

  const mapping = summariseMappingPack()
  const pilot = summarisePilot()
  const drafts = studentDrafts(state)
  const openReviews = safetyItems.filter((i) => i.record.state === 'open').length

  // The active question. Board 1 always has one, and the guide reads from it.
  const activeQuestionId = focusQuestionId ?? questions[0]?.id ?? null

  // ── RELEVANT NOW vs STILL TO COVER ───────────────────────────────────────
  //
  // Interaction rule 2: a rule goes under "Relevant now · approved safety
  // screening" ONLY when it is linked to the ACTIVE QUESTION — not merely to
  // the section. A rule that belongs to the section but not to this question
  // goes under "Still to cover", worded so it cannot read as triggered here.
  //
  // Rule 7 belongs with the stool questions; Rule 9 does not, and showing it
  // as "relevant now" would imply the client's answer raised it.
  const activeRuleIds = useMemo(() => {
    if (!activeQuestionId) return []
    return annexRulesForSection(section)
      .filter((r) => r.systemAnswerLinks.some((l) => l.questionId === activeQuestionId))
      .map((r) => r.id)
  }, [section, activeQuestionId])

  const relevantNow = useMemo(
    () => sectionNodes.filter((n) => activeRuleIds.includes(n.ruleId) && n.state !== 'answered'),
    [sectionNodes, activeRuleIds])

  const stillToCover = useMemo(() => {
    const out: string[] = []
    // Approved rules in this section that this question does not trigger.
    for (const n of sectionNodes) {
      if (activeRuleIds.includes(n.ruleId) || n.state === 'answered') continue
      out.push(`${n.topic} (Annex 1 Rule ${n.ruleNumber}). Not linked to this question.`)
    }
    const unanswered = questions.filter(
      (q) => q.id !== activeQuestionId && state.answers[q.id] === undefined)
    if (unanswered.length > 0) {
      out.push(`${unanswered.length} further question(s) in this section.`)
    }
    if (caseWide.unaskedSafetyElsewhere.length > 0) {
      out.push(`${caseWide.unaskedSafetyElsewhere.length} safety question(s) in other streams. Not linked to this question.`)
    }
    return out
  }, [sectionNodes, activeRuleIds, questions, activeQuestionId, state.answers, caseWide.unaskedSafetyElsewhere.length])

  const elsewhere = useMemo(
    () => sectionNodes.filter((n) => n.state === 'answered')
      .map((n) => `${n.topic} (Annex 1 Rule ${n.ruleNumber}) has been asked.${n.needsHumanReview ? ' It needs human review.' : ''}`),
    [sectionNodes])

  // FICTIONAL EXAMPLE DATA — the generated guide items for this client.
  const generated: GuideGeneratedItem[] = useMemo(() => {
    const a = focusQuestionId ? state.answers[focusQuestionId] : undefined
    const items: GuideGeneratedItem[] = []
    if (a && a.history.length > 0) {
      items.push({ tag: 'EXISTING FACT', text: `Earlier answer kept: ${String(a.history[0].value)}`, source: 'In history, with its own provenance' })
    }
    for (const b of Object.values(state.branches)) {
      if (b.section === section && b.needsReconciliation) {
        items.push({ tag: 'CLARIFICATION', text: 'A triggering answer changed. The branch is kept and needs a decision.' })
      }
    }
    return items
  }, [focusQuestionId, state.answers, state.branches, section])

  // ── Handlers ─────────────────────────────────────────────────────────────
  const onAnswer = (questionId: string, value: unknown, provenance: V2Provenance) => {
    if (!can(actor, 'capture_client_answer').allowed) return
    setState((s) => recordAnswer(s, { questionId, value, provenance, at: now(), actor }))
  }

  const onNodeAnswer = (ruleId: string, answer: AnnexAnswer) => {
    if (!can(actor, 'ask_safety_question').allowed) return
    setNodeAnswers((prev) => ({
      ...prev,
      [ruleId]: {
        ...prev[ruleId], answer, at: now(),
        actorId: actor.id, actorDisplayName: actor.displayName, via: 'approved_question',
      },
    }))
  }

  const onNodeFollowUp = (ruleId: string, followUpId: string, value: string) =>
    setNodeAnswers((prev) => {
      const existing = prev[ruleId]
      if (!existing) return prev
      return { ...prev, [ruleId]: { ...existing, followUp: { ...existing.followUp, [followUpId]: value } } }
    })

  const onWeightLoss = (ruleId: string, detail: WeightLossDetail) =>
    setNodeAnswers((prev) => {
      const existing = prev[ruleId]
      if (!existing) return prev
      return { ...prev, [ruleId]: { ...existing, weightLoss: { ...existing.weightLoss, ...detail } } }
    })

  const onRecordOutcome = (ruleId: string, outcome: V4ReviewOutcome, action: string) => {
    if (!can(actor, 'close_safety_review').allowed) return
    setOutcomes((prev) => ({ ...prev, [ruleId]: outcome }))
    setToast(`Outcome recorded by ${actor.displayName}${action ? ' with action noted' : ''}. Attributed and dated.`)
  }

  const onReconcile = (edgeId: string, choice: 'keep' | 'retire' | 'reopen', reason?: string) => {
    setState((s) => {
      if (choice === 'reopen') return reopenBranch(s, edgeId, now(), 'Reopened by the practitioner')
      if (choice === 'retire') {
        return markBranchNoLongerRelevant(s, { edgeId, at: now(), actor, reason: reason ?? '' })
      }
      // Keep as past history: clear the flag, change nothing else. The branch
      // and everything captured in it stay exactly as they are.
      const b = s.branches[edgeId]
      if (!b) return s
      return {
        ...s,
        branches: {
          ...s.branches,
          [edgeId]: {
            ...b, needsReconciliation: false,
            reconciliationReason: `Kept as past history — ${actor.displayName}, ${now()}`,
          },
        },
      }
    })
  }

  const primaryLabel = asStudent
    ? 'Submit for supervision'
    : gate.leavesReviewOpen ? FINISH_SECTION_LABEL : `Review and ${FINISH_SECTION_LABEL_CLEAR.toLowerCase()}`

  const onPrimary = () => {
    if (asStudent) {
      const r = submitForSupervision({
        actor, caseId, section, at: now(),
        draftAnswerCount: drafts.length, openSafetyItemCount: sStatus.openSafetyInThisSection,
      })
      setToast(r.ok
        ? `Sent to ${PRACTITIONER.displayName}: ${r.submission.draftAnswerCount} draft(s), ${r.submission.openSafetyItemCount} open safety item(s). Nothing was closed.`
        : `Not sent — ${r.reason.replace(/_/g, ' ')}.`)
      return
    }
    const after = finishSection(state, section, safetyItems)
    setState(after.state)
    setToast(after.finished
      ? (after.gate.leavesReviewOpen
          ? 'Section finished. Open reviews remain open and stay visible case-wide.'
          : 'Section finished.')
      : `Not finished — ${after.gate.blockers[0]}`)
  }

  const tabs: SectionTab[] = PILOT_SECTION_IDS.map((id, i) => ({
    id, number: i + 1, label: pilotStreamTitle(id),
  }))

  return (
    // Full viewport, fixed. The page never scrolls; the panes do.
    <div style={{
      position: 'fixed', inset: 0, zIndex: 40,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: C.cream, color: C.text,
      fontFamily: 'var(--font-dm-sans), system-ui, sans-serif',
    }}>
      <CockpitHeader
        clientLine={CLIENT_LINE}
        contextLine={asStudent
          ? `Synthetic case · Student ${STUDENT.displayName} · Supervisor ${PRACTITIONER.displayName}`
          : `Synthetic case · Initial consultation · Practitioner: ${PRACTITIONER.displayName} (fictional)`}
        rolePill={asStudent ? 'Student · supervised consultation' : undefined}
        timer={timer}
        now={clock}
        onPause={() => setTimer((t) => pauseTimer(t, now()))}
        onResume={() => setTimer((t) => resumeTimer(t, now()))}
        onSave={() => setToast('Capture saved. Nothing is lost.')}
      />

      <SectionTabs
        tabs={tabs}
        current={section}
        reviewCount={openReviews}
        reviewMode={reviewMode}
        onSelect={(id) => { setSection(id as PilotSectionId); setFocus(null) }}
        onToggleReviewMode={() => { setReviewMode((v) => !v); setDrawerOpen((v) => !v) }}
      />

      {/* Pilot banner — what is real and what is not, before anything else. */}
      <div style={{
        flexShrink: 0, background: C.goldTint, borderBottom: `1px solid ${C.gold}`,
        padding: '8px 28px', fontSize: '12px', color: C.goldInk, lineHeight: 1.5,
      }}>
        <strong style={{ fontWeight: 600 }}>Pilot · nothing is saved.&nbsp;</strong>
        {mapping.approved} of {mapping.total} Question → Concept + variant → Field mappings are
        approved, so no answer reaches the canonical record. Safety wording is loaded from{' '}
        {ANNEX_1_STATUS.source} ({ANNEX_1_STATUS.validationStatus}). Fictional case; no real client data.
        <button type="button" onClick={() => setAsStudent((v) => !v)} style={{
          all: 'unset', cursor: 'pointer', marginLeft: '14px', textDecoration: 'underline',
        }}>
          {asStudent ? 'Switch to practitioner' : 'Switch to student mode'}
        </button>
        <button type="button" onClick={() => (timer.state === 'not_started' ? setTimer((t) => startTimer(t, now())) : setFinishing(true))} style={{
          all: 'unset', cursor: 'pointer', marginLeft: '12px', textDecoration: 'underline', fontWeight: 600,
        }}>
          {timer.state === 'not_started' ? 'Start consultation' : timer.state === 'completed' ? 'View time log' : 'Finish consultation'}
        </button>
      </div>

      <div style={{
        flex: 1, display: 'grid',
        gridTemplateColumns: `${Z.guideWidth}px 1fr`,
        minHeight: 0, position: 'relative',
      }}>
        <GuidePane
          activeTitle={questions.find((q) => q.id === activeQuestionId)?.label ?? ''}
          panel={panel}
          orientation={orientation}
          reviewMode={reviewMode}
          relevantNow={relevantNow}
          stillToCover={stillToCover}
          elsewhere={elsewhere}
          generated={generated}
          exploreChips={panel.blocks.find((b) => b.id === 'explore')?.lines.map((l) => l.text) ?? []}
          studentSupport={asStudent ? {
            tips: ['Ask open first, then narrow. Let a pause sit. Write their words, not your summary.'],
            terms: [
              { term: 'Reaction', meaning: 'Any symptom the client links to a food — not the same as an allergy.' },
              { term: 'Intolerance', meaning: 'Avoid the word unless the client uses it first.' },
            ],
            why: 'Food links shape later nutrition questions and avoid asking twice.',
          } : null}
        />

        <CapturePane
          sectionTitle={pilotStreamTitle(section)}
          questions={questions}
          state={state}
          actor={actor}
          safetyNodes={sectionNodes}
          reviewMode={reviewMode}
          focusQuestionId={activeQuestionId}
          attributionNote={asStudent ? `All entries attributed to ${STUDENT.displayName} (student)` : null}
          edgeFor={edgeFor}
          onFocus={setFocus}
          onAnswer={onAnswer}
          onBranchDetail={(edgeId, key, value) => setState((s) =>
            recordBranchDetail(s, { edgeId, targetKey: key, value, provenance: 'client_reported', at: now(), actor }))}
          onReconcile={onReconcile}
          onNodeAnswer={onNodeAnswer}
          onNodeFollowUp={onNodeFollowUp}
          onWeightLoss={onWeightLoss}
          onRecordOutcome={onRecordOutcome}
          onNodeDetails={(questionId) => { setDetailsFor(questionId); setDrawerOpen(true); setReviewMode(true) }}
        />

        <NodeDetailsDrawer
          details={details}
          open={drawerOpen && reviewMode}
          onClose={() => setDrawerOpen(false)}
          pilot={pilot}
          mapping={mapping}
          annex={ANNEX_1_STATUS}
          annexNodes={annexNodeInventory()}
          unsupplied={unsuppliedSafetyValues()}
        />
      </div>

      <CockpitFooter
        thisSection={[
          ...(sStatus.mandatoryUnanswered.length > 0 ? [`${sStatus.mandatoryUnanswered.length} mandatory not asked`] : []),
          ...(sStatus.unfinishedDigging.length > 0 ? [`${sStatus.unfinishedDigging.length} branch not yet sufficient`] : []),
          ...(sStatus.needsReconciliation.length > 0 ? [`${sStatus.needsReconciliation.length} branch to reconcile`] : []),
          ...(sectionNodes.filter((n) => n.state !== 'answered').length > 0
            ? [`${sectionNodes.filter((n) => n.state !== 'answered').length} red flags not asked`] : []),
          ...(drafts.length > 0 ? [`${drafts.length} draft observation`] : []),
        ]}
        caseWideSafety={[
          ...(openReviews > 0 ? [`${openReviews} needs human review`] : []),
          ...(caseWide.unaskedSafetyElsewhere.length > 0
            ? [`${caseWide.unaskedSafetyElsewhere.length} red-flag question not yet asked elsewhere`] : []),
        ]}
        primaryLabel={primaryLabel}
        primaryDisabled={!asStudent && !gate.canFinish}
        onSaveAndPause={() => {
          setTimer((t) => pauseTimer(t, now(), 'saved and paused'))
          setToast('Saved and paused. Capture is kept; nothing is lost.')
        }}
        onPrimary={onPrimary}
      />

      {/* Finish consultation — Board 5. Opened from the completed timer. */}
      {finishing && (
        <FinishConsultation
          timer={timer}
          now={clock}
          practitionerName={PRACTITIONER.displayName}
          workReference={WORK_REFERENCE}
          caseId={caseId}
          onBack={() => setFinishing(false)}
          onFinish={(reason) => {
            const r = completeTimer(timer, now(), reason ? { reason } : undefined)
            if (r.ok) { setTimer(r.session); setFinishing(false); setToast('Consultation completed. Work log recorded.') }
          }}
        />
      )}

      {toast && (
        <div
          role="status"
          onClick={() => setToast(null)}
          style={{
            position: 'absolute', bottom: `${Z.footer + 14}px`, left: '50%', transform: 'translateX(-50%)',
            background: C.pine, color: C.cream, fontSize: '12.5px', borderRadius: '999px',
            padding: '9px 18px', cursor: 'pointer', zIndex: 50, maxWidth: '70%',
          }}
        >
          {toast}
        </div>
      )}

    </div>
  )
}
