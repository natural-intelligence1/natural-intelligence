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
//
// A browser-local draft store was considered and DELIBERATELY NOT BUILT
// (Founder ruling, 5 Nov 2026). The persistence audit found no server-side
// draft store for practitioner case-taking: intake_answers belongs to a
// CLIENT intake session keyed on member_id, case_contributions is append-only
// with no writer, and there is no table at all for question state, section
// progress or consultation position. Putting practitioner-captured health
// content in localStorage to simulate autosave would make a preview
// convenience into the production persistence mechanism by default. So the
// chrome shows "Held in this session only", which is the truth, and the
// persistence design goes to review before anything is written.
//
// ── WHAT THE 4 NOV REVIEW CHANGED HERE ──────────────────────────────────────
//
//   · Save and "Save and pause" are gone. Autosave is the intended model and
//     a Save button offers a choice that will not exist.
//   · The footer carries ONE completion action, worded for the actor's
//     authority and the case-taking state, from caseTaking.completionOffer().
//   · "Student mode" is no longer a mode. Everyone authorised to take a case
//     operates as a practitioner; the pill reads "Practitioner · Supervised"
//     and the difference is authority at sign-off.
//   · The pilot banner collapses. Its truth is unchanged and still visible —
//     it is a summary line that opens, not a paragraph across the screen.

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
  can,
  newTimer, startTimer, pauseTimer, resumeTimer, completeTimer,
  completionOffer, applyCompletion, roleLabel, newCaseTakingRecord,
  CASE_TAKING_STATE_LABELS, isEditable,
  type CaptureActor, type CaptureState, type PilotSectionId,
  type TimerSession, type SafetyNodeAnswer,
  type AnnexAnswer, type WeightLossDetail, type V4ReviewOutcome,
  type CaseRole, type CaseTakingActor, type CaseTakingRecord,
} from '@natural-intelligence/db/cockpit'
import type { V2Provenance } from '@natural-intelligence/db/intakeV2'
import { C, F, Z, eyebrow } from './cockpitTokens'
import { CockpitHeader, SectionTabs, CockpitFooter, type SectionTab } from './CockpitChrome'
import { GuidePane, type GuideGeneratedItem } from './GuidePane'
import { CapturePane } from './CapturePane'
import { NodeDetailsDrawer } from './NodeDetailsDrawer'
import { FinishConsultation } from './FinishConsultation'

// FICTIONAL EXAMPLE DATA — replaced with real data at runtime.
//
// Three actors, one per case role, so the two completion paths the Founder
// specified can both be seen. In production the case role comes from
// case_team_roles.team_role for the signed-in practitioner on this case; it
// is never chosen in the interface.
const ACTORS: Record<CaseRole, CaseTakingActor> = {
  lead: {
    actor: { id: 'prac-lead', displayName: 'Amara Okafor', role: 'practitioner' },
    caseRole: 'lead',
  },
  care_team: {
    actor: { id: 'prac-1', displayName: 'Elin Marsh', role: 'practitioner' },
    caseRole: 'care_team',
  },
  student: {
    actor: { id: 'stu-1', displayName: 'T. Reyes', role: 'student', supervisorId: 'prac-lead' },
    caseRole: 'student',
  },
}

const LEAD_NAME = ACTORS.lead.actor.displayName
const CLIENT_LINE = 'Rosa Penhallow · 47'
const WORK_REFERENCE = 'NI-W-0217'

const now = () => new Date().toISOString()

export function ConsultationCockpit({ caseId }: { caseId: string }) {
  const [section, setSection] = useState<PilotSectionId>('digestion')
  const [state, setState] = useState<CaptureState>(() => newCaptureState(caseId))
  // Review-only. In production this is read from case_team_roles, not chosen.
  const [caseRole, setCaseRole] = useState<CaseRole>('care_team')
  const [takingRecord, setTakingRecord] = useState<CaseTakingRecord>(() => newCaseTakingRecord(caseId))
  const [pilotOpen, setPilotOpen] = useState(false)
  const [reviewMode, setReviewMode] = useState(false)
  const [focusQuestionId, setFocus] = useState<string | null>(null)
  const [detailsFor, setDetailsFor] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [timer, setTimer] = useState<TimerSession>(() => newTimer(60))
  const [finishing, setFinishing] = useState(false)
  const [nodeAnswers, setNodeAnswers] = useState<Record<string, SafetyNodeAnswer>>({})
  const [outcomes, setOutcomes] = useState<Record<string, string>>({})
  const [toast, setToast] = useState<string | null>(null)

  const takingActor = ACTORS[caseRole]
  const actor = takingActor.actor
  const asStudent = caseRole === 'student'
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
  //
  // IMMUTABILITY AFTER SIGN-OFF, enforced here rather than described.
  //
  // The Founder's rule: editable until sign-off; after it, that signed
  // version is immutable and a correction is an amendment creating the next
  // revision. So every capture path checks isEditable() and refuses with the
  // reason, instead of silently accepting a keystroke that would alter a
  // version a practitioner has put their name to.
  //
  // The way forward is not hidden: the Lead's completion action in that state
  // is "Amend — creates a new version", which reopens the record as the next
  // revision and leaves the signed one untouched.
  const frozen = !isEditable(takingRecord.state)

  const refuseIfFrozen = (): boolean => {
    if (!frozen) return false
    setToast('This version is signed off and read-only. Use Amend to start a new version.')
    return true
  }

  const onAnswer = (questionId: string, value: unknown, provenance: V2Provenance) => {
    if (refuseIfFrozen()) return
    if (!can(actor, 'capture_client_answer').allowed) return
    setState((s) => recordAnswer(s, { questionId, value, provenance, at: now(), actor }))
  }

  const onNodeAnswer = (ruleId: string, answer: AnnexAnswer) => {
    if (refuseIfFrozen()) return
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
    if (refuseIfFrozen()) return
    if (!can(actor, 'close_safety_review').allowed) return
    setOutcomes((prev) => ({ ...prev, [ruleId]: outcome }))
    setToast(`Outcome recorded by ${actor.displayName}${action ? ' with action noted' : ''}. Attributed and dated.`)
  }

  const onReconcile = (edgeId: string, choice: 'keep' | 'retire' | 'reopen', reason?: string) => {
    if (refuseIfFrozen()) return
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

  // ── The ONE completion action ─────────────────────────────────────────────
  //
  // Who may complete, and with what words, is decided in the domain layer by
  // completionOffer(caseRole, state, openReviews) — so the footer cannot
  // disagree with the authority rules, and the wording cannot claim
  // completeness while a safety review is open.
  //
  // Autosave is NOT sign-off. Capture being up to date says nothing about
  // whether a practitioner has adopted it, which is why finishing the
  // section and signing off are separate acts with separate labels.
  const capturedCount = Object.keys(state.answers).length
  const offer = completionOffer(takingActor, takingRecord.state, openReviews)

  const onPrimary = () => {
    const result = applyCompletion(offer.action, {
      record: takingRecord,
      actor: takingActor,
      at: now(),
      capturedAnswers: capturedCount,
      openSafetyReviews: openReviews,
    })

    if (!result.ok) {
      setToast(result.message)
      return
    }

    setTakingRecord(result.record)

    // Finishing the SECTION is a separate, existing act from case-taking
    // completion, and it keeps its own gate. Running it here means a
    // hand-over does not quietly leave the section looking unfinished.
    if (offer.action === 'submit_to_lead' || offer.action === 'mark_ready_for_sign_off') {
      const after = finishSection(state, section, safetyItems)
      setState(after.state)
    }

    const openNote = offer.leavesReviewOpen
      ? ' Open reviews remain open and stay visible case-wide.'
      : ''

    switch (offer.action) {
      case 'submit_to_lead':
        setToast(`Submitted to ${LEAD_NAME}. Nothing was closed; you can still add to the record.${openNote}`)
        break
      case 'mark_ready_for_sign_off':
        setToast(`Ready for your sign-off.${openNote}`)
        break
      case 'sign_off':
        setToast(`Signed off by ${takingActor.actor.displayName}. This version is now read-only; a correction creates a new one.`)
        break
      case 'amend':
        setToast(`Amendment started — revision ${result.record.revision}. The signed version it supersedes is unchanged.`)
        break
      default:
        break
    }
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
        contextLine={[
          'Synthetic case',
          actor.displayName,
          asStudent ? `supervised by ${LEAD_NAME}` : null,
          CASE_TAKING_STATE_LABELS[takingRecord.state],
          takingRecord.revision > 1 ? `revision ${takingRecord.revision}` : null,
        ].filter(Boolean).join(' · ')}
        rolePill={roleLabel(takingActor)}
        timer={timer}
        now={clock}
        /* The honest state: no mapping is approved and there is no
           practitioner draft store, so capture lives in this page. */
        saveState="in_session_only"
        timerAction={
          timer.state === 'not_started'
            ? { label: 'Start consultation', onClick: () => setTimer((t) => startTimer(t, now())) }
            : timer.state === 'completed'
              ? { label: 'View time log', onClick: () => setFinishing(true) }
              : { label: 'Finish consultation', onClick: () => setFinishing(true) }
        }
        onPause={() => setTimer((t) => pauseTimer(t, now()))}
        onResume={() => setTimer((t) => resumeTimer(t, now()))}
      />

      <SectionTabs
        tabs={tabs}
        current={section}
        reviewCount={openReviews}
        reviewMode={reviewMode}
        onSelect={(id) => { setSection(id as PilotSectionId); setFocus(null) }}
        onToggleReviewMode={() => { setReviewMode((v) => !v); setDrawerOpen((v) => !v) }}
      />

      {/* ── Pilot banner, collapsed by default ───────────────────────────────
          The Founder needs this truth visible and it is NOT being removed or
          softened: nothing reaches the canonical record while the mappings
          are unapproved. What changed is that it was a paragraph spanning the
          screen above the consultation. It is now one line that opens, and
          the headline clause — nothing is saved — is in the summary, so the
          warning is never behind a click. */}
      <div style={{
        flexShrink: 0, background: C.goldTint, borderBottom: `1px solid ${C.gold}`,
        padding: '6px 28px', fontSize: '12px', color: C.goldInk, lineHeight: 1.5,
      }}>
        <button
          type="button"
          onClick={() => setPilotOpen((v) => !v)}
          aria-expanded={pilotOpen}
          style={{
            all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
            gap: '7px', color: C.goldInk, font: `400 12px ${F.ui}`,
          }}
        >
          <span aria-hidden style={{
            display: 'inline-block', transform: pilotOpen ? 'rotate(90deg)' : 'none',
            transition: 'transform .15s', fontSize: '9px',
          }}>▶</span>
          <strong style={{ fontWeight: 600 }}>Pilot · nothing is saved.</strong>
          <span>
            {mapping.approved} of {mapping.total} mappings approved · fictional case · no real client data
          </span>
          <span style={{ textDecoration: 'underline' }}>{pilotOpen ? 'Less' : 'Why'}</span>
        </button>

        {pilotOpen && (
          <div style={{ marginTop: '7px', paddingTop: '7px', borderTop: `1px solid ${C.gold}`, maxWidth: '980px' }}>
            <p style={{ margin: '0 0 7px' }}>
              {mapping.approved} of {mapping.total} Question → Concept + variant → Field mappings are
              approved, so no answer reaches the canonical record. There is also no practitioner
              draft store: capture is held in this page and is lost on reload. Safety wording is
              loaded from {ANNEX_1_STATUS.source} ({ANNEX_1_STATUS.validationStatus}).
            </p>

            {/* REVIEW SCAFFOLDING, not a product control. In production the
                case role is read from case_team_roles for the signed-in
                practitioner; nobody picks it. It lives inside the pilot
                details precisely so it cannot read as a product mode. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flexWrap: 'wrap' }}>
              <span style={{ ...eyebrow(C.goldInk, 11), marginRight: '2px' }}>Review as</span>
              {(['lead', 'care_team', 'student'] as CaseRole[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => { setCaseRole(r); setTakingRecord(newCaseTakingRecord(caseId)) }}
                  aria-pressed={caseRole === r}
                  style={{
                    all: 'unset', cursor: 'pointer', font: `500 11.5px ${F.ui}`,
                    border: `1px solid ${caseRole === r ? C.goldInk : C.gold}`,
                    background: caseRole === r ? C.warmWhite : 'transparent',
                    color: C.goldInk, borderRadius: '999px', padding: '3px 10px',
                  }}
                >
                  {roleLabel(ACTORS[r])}
                </button>
              ))}
              <span style={{ fontSize: '11px', opacity: 0.85 }}>
                Switching resets the case-taking state so each completion path can be seen from the start.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Signed off — read-only, said once and plainly. Not an error state:
          this is what sign-off is for, and the way on is in the footer. */}
      {frozen && (
        <div
          role="status"
          style={{
            flexShrink: 0, background: C.sage, borderBottom: `1px solid ${C.pine}`,
            padding: '7px 28px', fontSize: '12.5px', color: C.pine,
            display: 'flex', alignItems: 'center', gap: '8px',
          }}
        >
          <strong style={{ fontWeight: 600 }}>
            Signed off{takingRecord.signedOffBy ? ` by ${actor.displayName}` : ''}
            {takingRecord.revision > 1 ? ` · revision ${takingRecord.revision}` : ''}.
          </strong>
          <span>
            This version is read-only. A correction is an amendment creating the next version —
            nothing here is overwritten.
          </span>
        </div>
      )}

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
          attributionNote={asStudent
            ? `All entries attributed to ${actor.displayName}, supervised by ${LEAD_NAME}`
            : null}
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
        primaryLabel={offer.label}
        primaryDisabled={offer.action === 'none'}
        blockedReason={offer.blockedReason}
        onPrimary={onPrimary}
      />

      {/* Finish consultation — Board 5. Opened from the completed timer. */}
      {finishing && (
        <FinishConsultation
          timer={timer}
          now={clock}
          practitionerName={actor.displayName}
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
