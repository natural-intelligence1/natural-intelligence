'use client'

// ─── RIGHT PANE — Live Case Capture ──────────────────────────────────────────
// Board 1 (MASTER), with Board 2 (digging), Board 3 (red flag) and Board 4
// (student). Always the dominant area.
//
// This file renders. It decides nothing: which branch opens, what counts as
// sufficient, what raises review, who may act and whether anything may be
// written are all settled in packages/db/src/cockpit.
//
// ── TWO RULES VISIBLE IN THE MARKUP ─────────────────────────────────────────
//
// "Not asked" is a state with its own chip and its own sentence. It is never
// rendered as, defaulted to, or counted as "No".
//
// An earlier answer is struck through and kept with its own provenance; the
// new value becomes current. Nothing is overwritten in place.

import { useState } from 'react'
import {
  orderedTargets, targetKey, outstandingTargets, isBranchSufficient, can,
  attributionLine, BRANCH_LIFECYCLE, DIGGING_REVIEW_STATUSES,
  V4_REVIEW_OUTCOMES, V4_REVIEW_OUTCOME_LABELS,
  type CaptureState, type CaptureActor, type BranchCapture, type DiggingEdge,
  type SafetyNode, type AnnexAnswer, type V4ReviewOutcome, type V2QuestionDef,
  type WeightLossDetail,
} from '@natural-intelligence/db/cockpit'
import type { V2Provenance } from '@natural-intelligence/db/intakeV2'
import {
  C, F, card, cardActive, cardSafety, button, eyebrow,
  PROVENANCE_CHIP, PROVENANCE_LEGEND, statePill,
} from './cockpitTokens'

const PROVENANCE_LABEL: Record<string, string> = {
  client_reported: 'Client reported',
  practitioner_verified: 'Practitioner verified',
  corrected: 'Amended',
  observed: 'Observed',
  unconfirmed: 'Unconfirmed',
  not_asked: 'Not asked',
  declined: 'Declined',
}

function Chip({ kind, children }: { kind: string; children?: React.ReactNode }) {
  return (
    <span style={PROVENANCE_CHIP[kind] ?? PROVENANCE_CHIP.not_asked}>
      {children ?? PROVENANCE_LABEL[kind] ?? kind}
    </span>
  )
}

const asList = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(String) : typeof v === 'string' ? [v] : []

export interface CapturePaneProps {
  sectionTitle: string
  questions: V2QuestionDef[]
  state: CaptureState
  actor: CaptureActor
  safetyNodes: SafetyNode[]
  reviewMode: boolean
  focusQuestionId: string | null
  attributionNote?: string | null
  edgeFor: (edgeId: string) => DiggingEdge | undefined
  onFocus: (questionId: string) => void
  onAnswer: (questionId: string, value: unknown, provenance: V2Provenance) => void
  onBranchDetail: (edgeId: string, key: string, value: string) => void
  onReconcile: (edgeId: string, choice: 'keep' | 'retire' | 'reopen', reason?: string) => void
  onNodeAnswer: (ruleId: string, answer: AnnexAnswer) => void
  onNodeFollowUp: (ruleId: string, followUpId: string, value: string) => void
  onWeightLoss: (ruleId: string, detail: WeightLossDetail) => void
  onRecordOutcome: (ruleId: string, outcome: V4ReviewOutcome, action: string) => void
  onNodeDetails: (questionId: string) => void
}

export function CapturePane(props: CapturePaneProps) {
  const { sectionTitle, questions, state, actor, safetyNodes, reviewMode } = props
  const isStudent = actor.role === 'student'

  return (
    <section
      aria-label="Live case capture"
      style={{
        padding: '18px 30px 24px', display: 'flex', flexDirection: 'column',
        gap: '10px', overflowY: 'auto', minHeight: 0, background: C.cream,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: F.display, fontSize: '30px', fontWeight: 600, margin: 0, color: C.botanical }}>
          {sectionTitle}
        </h1>
        {props.attributionNote
          ? <span style={{ fontSize: '13px', color: C.softText }}>{props.attributionNote}</span>
          : (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              {PROVENANCE_LEGEND.map((p) => <Chip key={p.key} kind={p.key}>{p.label}</Chip>)}
            </div>
          )}
      </div>

      {/* Board 4: what a student may and may not do, before they capture. */}
      {isStudent && <StudentBoundaryPanel />}

      {questions.map((q, index) => {
        const branches = Object.values(state.branches)
          .filter((b) => props.edgeFor(b.edgeId)?.sourceQuestionId === q.id)
        return (
          <div key={q.id} style={{ display: 'flex', flexDirection: 'column' }}>
            <QuestionCard q={q} index={index} props={props} />
            {branches.map((b) => {
              const edge = props.edgeFor(b.edgeId)
              return edge ? <BranchPanel key={b.edgeId} branch={b} edge={edge} props={props} /> : null
            })}
            {branches.filter((b) => b.needsReconciliation).map((b) => (
              <ReconcilePanel key={`r-${b.edgeId}`} branch={b} props={props} />
            ))}
          </div>
        )
      })}

      {/* Approved Annex 1 red-flag questions, as their own rows. */}
      {safetyNodes.map((n) => (
        <RedFlagCard key={n.ruleId} node={n} props={props} />
      ))}

      {reviewMode && (
        <p style={{ fontSize: '10.5px', color: C.softText, fontFamily: 'ui-monospace, monospace', marginTop: '6px' }}>
          review mode on · technical detail available per node
        </p>
      )}
    </section>
  )
}

// ── Student boundary ────────────────────────────────────────────────────────

function StudentBoundaryPanel() {
  const col = (head: string, items: string[], tone: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <span style={eyebrow(tone, 11.5)}>{head}</span>
      {items.map((i) => (
        <span key={i} style={{ fontSize: '13.5px', color: C.text }}>{i}</span>
      ))}
    </div>
  )
  return (
    <div style={{
      ...card, padding: '14px 18px', display: 'grid',
      gridTemplateColumns: '1fr 1fr', gap: '24px',
    }}>
      {col('You can', [
        "Record the client's answers and words",
        'Add observations as drafts',
        'Submit the section for supervision',
      ], C.goldInk)}
      {col('Needs your supervisor', [
        'Verify, amend or finalise answers',
        'Close any safety item',
        'Sign or release a Protocol',
      ], C.oxblood)}
    </div>
  )
}

// ── One question ────────────────────────────────────────────────────────────

function QuestionCard({ q, index, props }: { q: V2QuestionDef; index: number; props: CapturePaneProps }) {
  const { state, actor, reviewMode } = props
  const captured = state.answers[q.id]
  const selected = asList(captured?.value)
  const multi = q.type === 'multichip'
  const active = props.focusQuestionId === q.id
  const mayCapture = can(actor, 'capture_client_answer').allowed
  const mayVerify = can(actor, 'verify_qualified_matter').allowed
  const notAsked = captured === undefined || captured.provenance === 'not_asked'

  const toggle = (option: string) => {
    if (!mayCapture) return
    const next = multi
      ? (selected.includes(option) ? selected.filter((v) => v !== option) : [...selected, option])
      : [option]
    const cleaned = multi && option === 'None of these' ? ['None of these'] : next
    props.onAnswer(q.id, multi ? cleaned : cleaned[0], 'client_reported')
  }

  const displayValue = captured && captured.provenance !== 'not_asked'
    ? (selected.join(', ') || String(captured.value ?? ''))
    : null

  return (
    <article
      onClick={() => props.onFocus(q.id)}
      style={{
        ...(active ? cardActive : card),
        padding: active ? '15px 18px 15px 20px' : '11px 16px',
        display: 'grid', gridTemplateColumns: '78px 1fr auto',
        gap: active ? '8px 14px' : '4px 14px', alignItems: 'center',
        marginBottom: '9px', cursor: 'pointer',
      }}
    >
      <span style={{ fontSize: '11.5px', color: C.goldInk, fontWeight: 600, letterSpacing: '.04em' }}>
        Q{index + 1}
      </span>
      <span style={{ fontSize: '14.5px', color: C.botanical, fontWeight: 500 }}>{q.label}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {displayValue
          ? <span style={{ fontSize: '13px', fontWeight: 600, color: C.botanical }}>{displayValue}</span>
          : <Chip kind="not_asked" />}
        {reviewMode && (
          <button type="button" onClick={(e) => { e.stopPropagation(); props.onNodeDetails(q.id) }}
            style={{ ...button('mini'), minHeight: '28px', padding: '3px 9px', fontSize: '11.5px' }}>
            Node
          </button>
        )}
      </span>

      {/* Sub-row: provenance chain, or the "not asked is never No" sentence. */}
      <span style={{
        gridColumn: '2/4', fontSize: '12.5px', color: C.softText,
        display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap',
      }}>
        {captured && captured.provenance !== 'not_asked' ? (
          <>
            <Chip kind={captured.history.length > 0 ? 'corrected' : captured.provenance} />
            {captured.provenance === 'practitioner_verified' && <span style={{ color: C.softText }}>→</span>}
            <span>{attributionLine(captured.actor, captured.at)}</span>
            {captured.draft && <Chip kind="student_draft">Student draft · requires supervisor review</Chip>}
          </>
        ) : (
          <span>Not answered at intake. Not asked is never treated as No.</span>
        )}
      </span>

      {active && (
        <div style={{ gridColumn: '2/4', display: 'flex', flexDirection: 'column', gap: '9px', marginTop: '2px' }}>
          {/* An earlier answer, kept whole with its own provenance. */}
          {captured && captured.history.length > 0 && (
            <div style={{ background: C.cream, borderRadius: '10px', padding: '9px 12px', fontSize: '14px', lineHeight: 1.5 }}>
              {captured.history.map((h, i) => (
                <div key={i} style={{ marginBottom: '4px' }}>
                  <span style={{ textDecoration: 'line-through', color: C.softText }}>
                    {asList(h.value).join(', ') || '—'}
                  </span>
                  <span style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px', color: C.softText, marginTop: '4px', flexWrap: 'wrap' }}>
                    <Chip kind={h.provenance} />
                    {new Date(h.at).toLocaleString('en-GB')} · original kept
                  </span>
                </div>
              ))}
            </div>
          )}

          <span style={{ fontSize: '12.5px', fontWeight: 600, color: C.pine }}>Structured answer</span>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {(q.options ?? []).map((option: string) => {
              const on = selected.includes(option)
              return (
                <button
                  key={option}
                  type="button"
                  disabled={!mayCapture}
                  onClick={(e) => { e.stopPropagation(); toggle(option) }}
                  style={{
                    font: `500 13px ${F.ui}`,
                    border: `1px solid ${on ? C.pine : C.lineControl}`,
                    background: on ? C.pine : C.warmWhite,
                    color: on ? C.cream : C.text,
                    borderRadius: '8px', padding: '7px 12px', minHeight: '36px',
                    cursor: mayCapture ? 'pointer' : 'not-allowed',
                    opacity: mayCapture ? 1 : 0.6,
                  }}
                >
                  {option}
                </button>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {mayVerify ? (
              <button type="button" onClick={(e) => { e.stopPropagation(); captured && props.onAnswer(q.id, captured.value, 'practitioner_verified') }}
                style={button('miniPrimary')}>Verify</button>
            ) : (
              <button type="button" disabled style={button('disabled')}>Verify — supervisor only</button>
            )}
            <button type="button" disabled={!mayVerify}
              onClick={(e) => { e.stopPropagation(); captured && props.onAnswer(q.id, captured.value, 'corrected') }}
              style={mayVerify ? button('mini') : button('disabled')}>Amend</button>
            <button type="button" disabled={!mayCapture}
              onClick={(e) => { e.stopPropagation(); captured && props.onAnswer(q.id, captured.value, 'observed') }}
              style={button('mini')}>
              {actor.role === 'student' ? 'Add observation (draft)' : 'Add observation'}
            </button>
            <button type="button" disabled={!mayCapture}
              onClick={(e) => { e.stopPropagation(); captured && props.onAnswer(q.id, captured.value, 'unconfirmed') }}
              style={button('mini')}>Mark unconfirmed</button>
            <button type="button" disabled={!mayCapture}
              onClick={(e) => { e.stopPropagation(); props.onAnswer(q.id, null, 'not_asked') }}
              style={button('mini')}>Not asked</button>
            <button type="button" disabled={!mayCapture}
              onClick={(e) => { e.stopPropagation(); props.onAnswer(q.id, null, 'declined') }}
              style={button('mini')}>Declined</button>
            <span style={{ fontSize: '12px', color: C.softText }}>
              Every action is attributed and dated; earlier values stay in history.
            </span>
          </div>

          {captured?.canonicalWriteBlocked && (
            <span style={{ fontSize: '11.5px', color: C.softText }}>
              Held in this session only — {captured.canonicalBlockReason}
            </span>
          )}
        </div>
      )}
      {!active && notAsked && <span style={{ display: 'none' }} />}
    </article>
  )
}

// ── Digging branch (Board 2) ────────────────────────────────────────────────

function BranchPanel({
  branch, edge, props,
}: { branch: BranchCapture; edge: DiggingEdge; props: CapturePaneProps }) {
  const sufficient = isBranchSufficient(branch)
  const outstanding = outstandingTargets(branch)
  const lifecycleIndex = BRANCH_LIFECYCLE.indexOf(branch.lifecycle)

  const stepRow = (label: string, state: 'done' | 'now' | 'todo') => ({
    done: { background: C.pine, borderColor: C.pine },
    now:  { background: C.gold, borderColor: C.gold },
    todo: { background: C.warmWhite, borderColor: C.unconfirmed },
  }[state])

  return (
    <article style={{
      border: `1px solid ${C.pine}`, borderTop: `1px dashed ${C.lineStrong}`,
      borderRadius: '0 0 12px 12px', background: C.warmWhite,
      padding: '10px 18px 12px 32px', marginTop: '-9px', marginBottom: '9px',
      position: 'relative', display: 'flex', flexDirection: 'column',
    }}>
      {/* Two axes, kept apart: structural lifecycle and review status. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
        <span style={{ ...eyebrow(C.softText, 11), minWidth: '72px' }}>Lifecycle</span>
        {BRANCH_LIFECYCLE.map((s, i) => {
          const current = s === branch.lifecycle
          const past = i < lifecycleIndex
          return (
            <span key={s} style={{
              fontSize: '12.5px', borderRadius: '7px', padding: '5px 10px',
              background: current ? C.pine : past ? C.sage : 'transparent',
              color: current ? C.cream : C.text,
              border: `1px solid ${current ? C.pine : past ? C.pine : C.lineStrong}`,
              textTransform: 'capitalize',
            }}>
              {s.replace(/_/g, ' ')}
            </span>
          )
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
        <span style={{ ...eyebrow(C.softText, 11), minWidth: '72px' }}>Review</span>
        {DIGGING_REVIEW_STATUSES.map((s) => {
          const on = s === branch.reviewStatus
          return (
            <span key={s} style={{
              fontSize: '12.5px', borderRadius: '999px', padding: '4px 11px',
              background: on ? (s === 'needs_human_review' ? C.oxblood : C.warmWhite) : 'transparent',
              color: on ? (s === 'needs_human_review' ? C.cream : C.pine) : C.softText,
              border: `1px solid ${on ? (s === 'needs_human_review' ? C.oxblood : C.pine) : C.lineStrong}`,
              textTransform: 'capitalize',
            }}>
              {s.replace(/_/g, ' ')}
            </span>
          )
        })}
      </div>

      {/* Steps on a vertical timeline. Filled = captured, gold = current,
          hollow = not asked. */}
      <div style={{ position: 'relative' }}>
        <span aria-hidden style={{
          position: 'absolute', left: '-18px', top: '14px', bottom: '14px',
          width: '1px', background: C.lineStrong,
        }} />
        {orderedTargets(edge).map((t) => {
          const key = targetKey(edge, t)
          const got = branch.answers[key]
          const isNext = !got && outstanding[0]?.key === key
          const prompt = t.practitionerPrompt
            ?? props.questions.find((q) => q.id === t.targetQuestionId)?.label
            ?? 'Continue'
          const dot = stepRow(prompt, got ? 'done' : isNext ? 'now' : 'todo')
          return (
            <div key={key} style={{
              display: 'grid', gridTemplateColumns: '150px 1fr auto', gap: '12px',
              alignItems: 'center', padding: isNext ? '9px 10px' : '7px 0',
              borderTop: isNext ? '1px solid transparent' : `1px solid ${C.parchment}`,
              background: isNext ? C.stepNow : 'transparent',
              margin: isNext ? '0 -10px' : undefined,
              borderRadius: isNext ? '8px' : undefined,
              position: 'relative',
            }}>
              <span aria-hidden style={{
                position: 'absolute', left: isNext ? '-8px' : '-18px', top: '15px',
                width: '9px', height: '9px', borderRadius: '50%',
                background: dot.background, border: `1.5px solid ${dot.borderColor}`,
              }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: C.pine, display: 'flex', flexDirection: 'column', gap: '1px' }}>
                {prompt.length > 34 ? `${prompt.slice(0, 32)}…` : prompt}
                {!t.required && <i style={{ fontStyle: 'normal', fontSize: '10.5px', color: C.softText, fontWeight: 500 }}>optional</i>}
              </span>
              {got ? (
                <span style={{ fontSize: '13.5px', lineHeight: 1.45 }}>
                  “{String(got.value)}”
                  <span style={{ color: C.softText, fontSize: '12px', display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                    <Chip kind={got.provenance} /> {new Date(got.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </span>
              ) : (
                <BranchInput
                  disabled={!can(props.actor, 'capture_client_answer').allowed}
                  onSave={(v) => props.onBranchDetail(edge.id, key, v)}
                />
              )}
              <span>{!got && <Chip kind="not_asked" />}</span>
            </div>
          )
        })}
      </div>

      <p style={{ fontSize: '12px', color: C.softText, margin: '8px 0 0' }}>
        {sufficient
          ? 'Every answer counting towards sufficiency is recorded.'
          : `${outstanding.length} step(s) outstanding.`}
        {' '}Detail recorded here does not itself raise a review, and finishing this branch does not close one.
      </p>
    </article>
  )
}

function BranchInput({ onSave, disabled }: { onSave: (v: string) => void; disabled: boolean }) {
  const [draft, setDraft] = useState('')
  return (
    <input
      value={draft}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { if (draft.trim()) { onSave(draft.trim()); setDraft('') } }}
      placeholder="Their words"
      style={{
        width: '100%', fontSize: '13px', padding: '6px 9px', borderRadius: '8px',
        border: `1px solid ${C.lineControl}`, background: C.warmWhite, color: C.text,
        fontFamily: F.ui,
      }}
    />
  )
}

// ── Reconciliation (Board 2, lower panel) ───────────────────────────────────

function ReconcilePanel({ branch, props }: { branch: BranchCapture; props: CapturePaneProps }) {
  const mayRetire = can(props.actor, 'mark_branch_no_longer_relevant').allowed
  const [reason, setReason] = useState('')
  return (
    <div style={{
      background: C.warmWhite, border: `1px solid ${C.reconBorder}`, borderRadius: '12px',
      padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '7px', marginBottom: '9px',
    }}>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12.5px', color: C.goldInk, fontWeight: 600 }}>Earlier answer changed</span>
        <span style={statePill('clarification')}>Branch: needs reconciliation</span>
      </div>
      <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5 }}>{branch.reconciliationReason}</p>
      <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5 }}>
        The follow-up branch is not deleted. Decide how it now reads:
      </p>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" style={button('mini')}
          onClick={() => props.onReconcile(branch.edgeId, 'keep')}>Keep as past history</button>
        {mayRetire ? (
          <>
            <input value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Why is it no longer relevant?"
              style={{
                fontSize: '12.5px', padding: '6px 9px', borderRadius: '8px', minWidth: '230px',
                border: `1px solid ${C.lineControl}`, background: C.warmWhite, fontFamily: F.ui,
              }} />
            <button type="button" disabled={!reason.trim()} style={reason.trim() ? button('mini') : button('disabled')}
              onClick={() => props.onReconcile(branch.edgeId, 'retire', reason)}>Mark no longer relevant</button>
          </>
        ) : (
          <button type="button" disabled style={button('disabled')}>Mark no longer relevant — supervisor only</button>
        )}
        <button type="button" style={button('mini')}
          onClick={() => props.onReconcile(branch.edgeId, 'reopen')}>Reopen branch</button>
      </div>
    </div>
  )
}

// ── Approved Annex 1 red flag (Board 3 / Board 4) ───────────────────────────

function RedFlagCard({ node, props }: { node: SafetyNode; props: CapturePaneProps }) {
  const { actor, reviewMode } = props
  const mayAsk = can(actor, 'ask_safety_question').allowed
  const mayClose = can(actor, 'close_safety_review').allowed
  const [outcome, setOutcome] = useState<V4ReviewOutcome | null>(null)
  const [action, setAction] = useState('')
  const [pct, setPct] = useState('')
  const [months, setMonths] = useState('')

  const answered = node.answer
  const open = node.needsHumanReview

  return (
    <article style={{
      ...(open ? cardSafety : card),
      padding: '14px 18px', marginBottom: '9px',
      display: 'grid', gridTemplateColumns: '78px 1fr auto', gap: '8px 14px', alignItems: 'start',
    }}>
      <span style={{ fontSize: '11.5px', color: C.oxblood, fontWeight: 600 }}>Red flag</span>

      {/* The approved wording, verbatim. */}
      <span style={{ fontSize: '14.5px', color: C.botanical, fontWeight: 500, lineHeight: 1.4 }}>
        “{node.approvedQuestion}”
      </span>

      <span>
        {open
          ? <span style={statePill('review')}>Needs human review</span>
          : answered
            ? <span style={statePill('resolved')}>Asked · {answered.answer.replace('_', ' ').toLowerCase()}</span>
            : <span style={PROVENANCE_CHIP.safety}>Red flag · not asked</span>}
      </span>

      <div style={{ gridColumn: '2/4', display: 'flex', flexDirection: 'column', gap: '9px' }}>
        <span style={{ fontSize: '12.5px', color: C.softText }}>
          Annex 1 · {node.topic} · {node.annexStreams.join(' · ')} · client notice {node.notice.toLowerCase()}
        </span>

        <div role="radiogroup" aria-label={node.approvedQuestion} style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {(['YES', 'NO', 'NOT_SURE'] as AnnexAnswer[]).map((a) => {
            const on = answered?.answer === a
            return (
              <button key={a} type="button" role="radio" aria-checked={on} disabled={!mayAsk}
                onClick={() => props.onNodeAnswer(node.ruleId, a)}
                style={{
                  font: `500 13px ${F.ui}`,
                  border: `1px solid ${on ? C.pine : C.lineControl}`,
                  background: on ? C.pine : C.warmWhite,
                  color: on ? C.cream : C.text,
                  borderRadius: '8px', padding: '7px 16px', minHeight: '36px',
                  cursor: mayAsk ? 'pointer' : 'not-allowed', opacity: mayAsk ? 1 : 0.6,
                }}>
                {a === 'NOT_SURE' ? 'Not sure' : a === 'YES' ? 'Yes' : 'No'}
              </button>
            )
          })}
        </div>

        {/* Quantified rule: the practitioner records what was said; NI does
            not calculate or judge the threshold in the room. */}
        {node.threshold !== null && answered?.answer === 'YES' && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input value={pct} onChange={(e) => setPct(e.target.value)} placeholder="% lost" inputMode="decimal"
              style={smallInput} />
            <input value={months} onChange={(e) => setMonths(e.target.value)} placeholder="over months" inputMode="numeric"
              style={smallInput} />
            <button type="button" style={button('mini')}
              onClick={() => props.onWeightLoss(node.ruleId, {
                percentLost: pct === '' ? null : Number(pct),
                overMonths: months === '' ? null : Number(months),
              })}>Record</button>
            <button type="button" style={button('mini')}
              onClick={() => props.onWeightLoss(node.ruleId, { noticeableOverWeeks: true })}>
              Noticeable over weeks
            </button>
            <span style={{ fontSize: '11.5px', color: node.threshold === 'met' ? C.oxblood : C.softText }}>
              threshold: {node.threshold}
            </span>
          </div>
        )}

        {answered && (
          <span style={{ fontSize: '12px', color: C.softText }}>
            {answered.via === 'system_answer_equivalent'
              ? `Answered from the client's own selection “${answered.viaOptionValue}” — the approved question was not read out.`
              : `Recorded: ${answered.answer.replace('_', ' ').toLowerCase()} · ${answered.actorDisplayName} · ${new Date(answered.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
          </span>
        )}

        {/* Capture-only follow-up. Never itself a trigger. */}
        {open && (
          <>
            <span style={eyebrow(C.softText, 11)}>Capture-only follow-up after Yes or Not sure</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
              {[
                ['started', 'Started'], ['frequency', 'How often'], ['ongoing', 'Still happening'],
                ['gp_seen', 'GP / tests'], ['associated', 'Pain / discomfort'],
              ].map(([id, label]) => (
                <label key={id} style={{ background: C.cream, borderRadius: '8px', padding: '6px 8px' }}>
                  <b style={{ display: 'block', fontSize: '10.5px', letterSpacing: '.05em', textTransform: 'uppercase', color: C.softText, fontWeight: 600 }}>
                    {label}
                  </b>
                  <input
                    defaultValue={answered?.followUp?.[id] ?? ''}
                    onBlur={(e) => e.target.value.trim() && props.onNodeFollowUp(node.ruleId, id, e.target.value.trim())}
                    style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '12.5px', fontFamily: F.ui, color: C.text, outline: 'none' }}
                  />
                </label>
              ))}
            </div>

            {/* Named human review. Nothing pre-selected; NI shows no urgency. */}
            <div style={{ ...card, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
              <h3 style={{ fontFamily: F.display, fontSize: '19px', fontWeight: 600, margin: 0, color: C.botanical }}>
                Named human review
              </h3>
              <p style={{ fontSize: '12.5px', color: C.softText, margin: 0, lineHeight: 1.5 }}>
                Outcomes are the approved V4 review outcomes; queue states are workflow only.
                Nothing is pre-selected; NI shows no urgency or interpretation.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {V4_REVIEW_OUTCOMES.map((o) => (
                  <label key={o} style={{
                    display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px',
                    border: `1px solid ${outcome === o ? C.pine : C.lineStrong}`,
                    borderRadius: '8px', padding: '10px 12px',
                    cursor: mayClose ? 'pointer' : 'not-allowed', opacity: mayClose ? 1 : 0.6,
                  }}>
                    <input type="radio" name={`outcome-${node.ruleId}`} disabled={!mayClose}
                      checked={outcome === o} onChange={() => setOutcome(o)} />
                    {V4_REVIEW_OUTCOME_LABELS[o]}
                  </label>
                ))}
              </div>
              <span style={{ fontSize: '12.5px', fontWeight: 600, color: C.pine }}>Action taken and contact made</span>
              <textarea
                value={action} onChange={(e) => setAction(e.target.value)} disabled={!mayClose} rows={2}
                placeholder="Any referral or contact decision within the practitioner's scope is recorded here."
                style={{
                  fontSize: '13px', padding: '9px 11px', borderRadius: '8px', fontFamily: F.ui,
                  border: `1px solid ${C.lineStrong}`, background: C.warmWhite, color: C.text, resize: 'vertical',
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', color: C.softText, display: 'flex', alignItems: 'center', gap: '7px' }}>
                  {!mayClose && <LockGlyph />}
                  {mayClose
                    ? `Reviewer: ${actor.displayName} · attributed, dated, read-only once recorded`
                    : 'Only the supervisor or the lead responsible practitioner can record the outcome.'}
                </span>
                <button type="button" disabled={!mayClose || outcome === null}
                  onClick={() => outcome && props.onRecordOutcome(node.ruleId, outcome, action)}
                  style={(!mayClose || outcome === null) ? button('disabled') : button('miniPrimary')}>
                  Record outcome
                </button>
              </div>
            </div>
          </>
        )}

        {reviewMode && (
          <span style={{ fontSize: '10.5px', color: C.softText, fontFamily: 'ui-monospace, monospace' }}>
            {node.ruleId} · absenceCanSatisfyNo: false · streams {node.annexStreams.join(' | ')}
          </span>
        )}
      </div>
    </article>
  )
}

const smallInput: React.CSSProperties = {
  width: '110px', fontSize: '12.5px', padding: '6px 9px', borderRadius: '8px',
  border: `1px solid ${C.lineControl}`, background: C.warmWhite, fontFamily: F.ui,
}

function LockGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 1 1 8 0v4" />
    </svg>
  )
}
