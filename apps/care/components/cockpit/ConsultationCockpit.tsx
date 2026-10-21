'use client'

// ─── Consultation Cockpit V2 — PILOT ─────────────────────────────────────────
// Board 1, Cockpit Default. Two panes, with the chrome above both.
//
// This component holds STATE and wires CALLBACKS. It contains no clinical
// rule: which branch opens, what counts as sufficient, what raises a review,
// who may do what, and whether anything may be written are all decided in
// packages/db/src/cockpit and merely rendered here.
//
// NOTHING IS PERSISTED. No mapping is approved, so the cockpit runs on React
// state and says so in the banner. A page refresh loses the session, which is
// the honest behaviour for a pilot whose write path is gated — better than a
// surface that looks saved and is not.

import { useMemo, useState } from 'react'
import {
  // state
  newCaptureState, recordAnswer, recordBranchDetail, reopenBranch,
  markBranchNoLongerRelevant, edgeFor, studentDrafts,
  // derived
  deriveCockpitSafetyItems, buildGuidancePanel, orient, nodeDetails,
  sectionStatus, caseWideSafetyStatus, finishSectionGate, finishSection,
  summariseMappingPack, summarisePilot, ANNEX_1_STATUS,
  pilotQuestions, pilotStreamTitle, PILOT_SECTION_IDS,
  submitForSupervision, can,
  // timer
  newTimer, startTimer, pauseTimer, resumeTimer, completeTimer,
  type CaptureActor, type CaptureState, type PilotSectionId,
  type OverrunReason, type TimerSession,
} from '@natural-intelligence/db/cockpit'
import type { V2Provenance } from '@natural-intelligence/db/intakeV2'
import { T, FONT_DISPLAY } from '@/components/workspace/caseTheme'
import { CockpitChrome } from './CockpitChrome'
import { GuidePane } from './GuidePane'
import { CapturePane } from './CapturePane'
import { NodeDetailsPanel } from './NodeDetailsPanel'

const PRACTITIONER: CaptureActor = {
  id: 'prac-fixture-1', displayName: 'Amara Okafor', role: 'practitioner',
}
const STUDENT: CaptureActor = {
  id: 'stu-fixture-1', displayName: 'Saima Student', role: 'student',
  supervisorId: 'prac-fixture-1',
}

const now = () => new Date().toISOString()

const tab = (active: boolean) => ({
  fontSize: '12.5px', padding: '6px 13px', borderRadius: '999px', cursor: 'pointer',
  background: active ? T.text : T.card,
  color: active ? '#fff' : T.text2,
  border: `1px solid ${active ? T.text : T.border}`,
})

export function ConsultationCockpit({ caseId }: { caseId: string }) {
  const [section, setSection] = useState<PilotSectionId>('digestion')
  const [state, setState] = useState<CaptureState>(() => newCaptureState(caseId))
  const [asStudent, setAsStudent] = useState(false)
  const [reviewMode, setReviewMode] = useState(false)
  const [focusQuestionId, setFocus] = useState<string | null>(null)
  const [detailsFor, setDetailsFor] = useState<string | null>(null)
  const [timer, setTimer] = useState<TimerSession>(() => newTimer(45))
  const [handover, setHandover] = useState<string | null>(null)

  const actor = asStudent ? STUDENT : PRACTITIONER
  const questions = useMemo(() => pilotQuestions(section), [section])

  // Everything below is DERIVED from capture state on each render. No second
  // copy of the truth is kept, so the panes cannot drift from each other.
  const safetyItems = useMemo(() => deriveCockpitSafetyItems({
    caseId,
    at: now(),
    answers: Object.values(state.answers).map((a) => ({
      questionId: a.questionId, value: a.value, capturedAt: a.at,
    })),
  }), [caseId, state.answers])

  const sStatus = useMemo(() => sectionStatus(state, section, safetyItems), [state, section, safetyItems])
  const caseWide = useMemo(() => caseWideSafetyStatus(state, section, safetyItems), [state, section, safetyItems])
  const gate = useMemo(() => finishSectionGate(state, section, safetyItems), [state, section, safetyItems])
  const panel = useMemo(() => buildGuidancePanel({
    section, focusQuestionId, state, safetyItems, isStudent: asStudent,
  }), [section, focusQuestionId, state, safetyItems, asStudent])
  const orientation = useMemo(() => orient({ section, state, safetyItems }), [section, state, safetyItems])
  const details = useMemo(() => (detailsFor ? nodeDetails(detailsFor, state) : null), [detailsFor, state])

  const mapping = summariseMappingPack()
  const pilot = summarisePilot()
  const drafts = studentDrafts(state)

  const onAnswer = (questionId: string, value: unknown, provenance: V2Provenance) => {
    if (!can(actor, 'capture_client_answer').allowed) return
    setState((s) => recordAnswer(s, { questionId, value, provenance, at: now(), actor }))
  }

  const onComplete = (overrun?: { reason: OverrunReason; note?: string }) => {
    const r = completeTimer(timer, now(), overrun)
    if (r.ok) setTimer(r.session)
  }

  const onSubmitForSupervision = () => {
    const r = submitForSupervision({
      actor, caseId, section, at: now(),
      draftAnswerCount: drafts.length,
      openSafetyItemCount: sStatus.openSafetyInThisSection,
    })
    setHandover(r.ok
      ? `Sent to ${PRACTITIONER.displayName}: ${r.submission.draftAnswerCount} draft(s), `
        + `${r.submission.openSafetyItemCount} open safety item(s). Nothing was closed.`
      : `Not sent — ${r.reason.replace(/_/g, ' ')}.`)
  }

  return (
    <div>
      {/* ── What is real and what is not. Stated before anything else. ───── */}
      <div style={{
        background: T.goldWash, border: `1px solid ${T.goldPale}`, borderRadius: '10px',
        padding: '12px 15px', marginBottom: '18px',
      }}>
        <p style={{ fontSize: '12.5px', color: T.goldInk, margin: 0, lineHeight: 1.55 }}>
          <strong style={{ fontWeight: 600 }}>Pilot · nothing is saved. </strong>
          {mapping.approved} of {mapping.total} Question → Concept → Field mappings are approved, so
          no answer can reach the canonical record. Capture, digging, safety, provenance and the
          section gate are all real domain behaviour running on this session only — a refresh
          clears it. Fictional case; no real client data.
        </p>
        <p style={{ fontSize: '11.5px', color: T.goldInk, margin: '7px 0 0', lineHeight: 1.5 }}>
          Safety screening uses the approved <code>safetyOptions</code> metadata already in the
          repository. Annex 1 and Rules 7 / 9 / 26 are <strong>not in the repository</strong> and
          nothing has been invented in their place — every review item records a null Annex rule.
        </p>
      </div>

      <CockpitChrome
        timer={timer}
        onStart={() => setTimer((t) => startTimer(t, now()))}
        onPause={() => setTimer((t) => pauseTimer(t, now()))}
        onResume={() => setTimer((t) => resumeTimer(t, now()))}
        onComplete={onComplete}
      />

      {/* ── Mode and stream controls. Also chrome, not panes. ─────────────── */}
      <div style={{
        display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '18px',
      }}>
        {PILOT_SECTION_IDS.map((id) => (
          <button key={id} type="button" onClick={() => { setSection(id); setFocus(null) }} style={tab(section === id)}>
            {pilotStreamTitle(id)}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setAsStudent((v) => !v)} style={tab(asStudent)}>
            {asStudent ? 'Student mode · on' : 'Student mode · off'}
          </button>
          <button type="button" onClick={() => setReviewMode((v) => !v)} style={tab(reviewMode)}>
            Node details · review mode
          </button>
        </span>
      </div>

      {asStudent && (
        <div style={{
          background: T.sunken, border: `1px solid ${T.border}`, borderRadius: '10px',
          padding: '12px 15px', marginBottom: '18px',
        }}>
          <p style={{ fontSize: '12.5px', color: T.text, margin: '0 0 6px' }}>
            <strong style={{ fontWeight: 600 }}>{STUDENT.displayName}</strong>, supervised by{' '}
            {PRACTITIONER.displayName}. Everything you record is attributed to you and saved as a draft.
          </p>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={onSubmitForSupervision}
              style={{ ...tab(false), background: T.gold, color: '#fff', border: `1px solid ${T.gold}` }}
            >
              Submit {drafts.length} draft(s) for supervision
            </button>
            {handover && <span style={{ fontSize: '11.5px', color: T.text2 }}>{handover}</span>}
          </div>
        </div>
      )}

      {/* ── THE TWO PANES. Right is dominant. ────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(240px, 30%) minmax(0, 1fr)',
          gap: '22px',
          alignItems: 'start',
        }}
      >
        <GuidePane panel={panel} orientation={orientation} reviewMode={reviewMode} />

        <CapturePane
          questions={questions}
          state={state}
          actor={actor}
          safetyItems={safetyItems}
          sectionStatus={sStatus}
          caseWide={caseWide}
          gate={gate}
          reviewMode={reviewMode}
          focusQuestionId={focusQuestionId}
          edgeFor={edgeFor}
          onFocus={setFocus}
          onAnswer={onAnswer}
          onBranchDetail={(edgeId, key, value) => setState((s) =>
            recordBranchDetail(s, { edgeId, targetKey: key, value, provenance: 'client_reported', at: now(), actor }))}
          onReopen={(edgeId) => setState((s) =>
            reopenBranch(s, edgeId, now(), 'Reopened by the practitioner'))}
          onNoLongerRelevant={(edgeId, reason) => setState((s) =>
            markBranchNoLongerRelevant(s, { edgeId, at: now(), actor, reason }))}
          onFinish={() => setState((s) => finishSection(s, section, safetyItems).state)}
          onNodeDetails={(questionId) => setDetailsFor(questionId)}
        />
      </div>

      {reviewMode && (
        <NodeDetailsPanel
          details={details}
          onClose={() => setDetailsFor(null)}
          pilot={pilot}
          mapping={mapping}
          annex={ANNEX_1_STATUS}
        />
      )}

      <p style={{
        fontSize: '11.5px', color: T.muted, marginTop: '32px', paddingTop: '14px',
        borderTop: `1px solid ${T.border}`, lineHeight: 1.55,
      }}>
        <span style={{ fontFamily: FONT_DISPLAY }}>Consultation Cockpit V2 · pilot.</span>{' '}
        Digestion, Energy &amp; metabolism and Sleep only. Fictional case for review — no real
        client, practitioner or health information appears on this screen.
      </p>
    </div>
  )
}
