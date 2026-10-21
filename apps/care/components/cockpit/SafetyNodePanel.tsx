'use client'

// ─── Approved Annex 1 safety questions, as explicit nodes ────────────────────
//
// The correction this component carries: an approved safety question is read
// out in its own words and answered YES / NO / NOT SURE. It is NOT a chip
// inside an unrelated symptom list, and nothing here paraphrases it.
//
// The wording is rendered verbatim from `node.approvedQuestion`. There is no
// prop by which a caller could substitute different text.
//
// ASK ONCE: one node per underlying fact, showing every stream Annex 1 links
// it to. Answering it here answers it everywhere.

import { useState } from 'react'
import {
  ANNEX_FOLLOW_UPS, can,
  type SafetyNode, type AnnexAnswer, type CaptureActor, type WeightLossDetail,
} from '@natural-intelligence/db/cockpit'
import { T, FONT_DISPLAY } from '@/components/workspace/caseTheme'

const ANSWER_LABELS: Record<AnnexAnswer, string> = {
  YES: 'Yes', NO: 'No', NOT_SURE: 'Not sure',
}

const answerBtn = (selected: boolean, emphasise: boolean) => ({
  fontSize: '13px', padding: '7px 18px', borderRadius: '8px', cursor: 'pointer',
  background: selected ? (emphasise ? T.gold : T.text) : T.card,
  color: selected ? '#fff' : T.text2,
  border: `1px solid ${selected ? (emphasise ? T.gold : T.text) : T.border}`,
  fontWeight: selected ? 600 : 400,
})

export function SafetyNodePanel({
  nodes, actor, reviewMode, onAnswer, onFollowUp, onWeightLoss,
}: {
  nodes: SafetyNode[]
  actor: CaptureActor
  reviewMode: boolean
  onAnswer: (ruleId: string, answer: AnnexAnswer) => void
  onFollowUp: (ruleId: string, followUpId: string, value: string) => void
  onWeightLoss: (ruleId: string, detail: WeightLossDetail) => void
}) {
  if (nodes.length === 0) return null
  const mayAsk = can(actor, 'ask_safety_question').allowed

  return (
    <section
      aria-label="Approved safety questions"
      style={{
        background: T.goldWash, border: `1px solid ${T.goldPale}`,
        borderRadius: '10px', padding: '16px 18px', marginBottom: '18px',
      }}
    >
      <header style={{ marginBottom: '12px' }}>
        <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: '16px', color: T.goldInk, margin: '0 0 3px' }}>
          Safety screening · Annex 1
        </h3>
        <p style={{ fontSize: '11.5px', color: T.goldInk, margin: 0, lineHeight: 1.5 }}>
          Approved NI wording. Ask each as written. Asked once — the answer carries to every stream
          it belongs to.
        </p>
      </header>

      {nodes.map((n) => (
        <SafetyNodeCard
          key={n.ruleId}
          node={n}
          mayAsk={mayAsk}
          reviewMode={reviewMode}
          onAnswer={(a) => onAnswer(n.ruleId, a)}
          onFollowUp={(id, v) => onFollowUp(n.ruleId, id, v)}
          onWeightLoss={(d) => onWeightLoss(n.ruleId, d)}
        />
      ))}
    </section>
  )
}

function SafetyNodeCard({
  node, mayAsk, reviewMode, onAnswer, onFollowUp, onWeightLoss,
}: {
  node: SafetyNode
  mayAsk: boolean
  reviewMode: boolean
  onAnswer: (a: AnnexAnswer) => void
  onFollowUp: (followUpId: string, value: string) => void
  onWeightLoss: (detail: WeightLossDetail) => void
}) {
  const [pct, setPct] = useState('')
  const [months, setMonths] = useState('')
  const answered = node.answer
  const triggered = node.needsHumanReview

  return (
    <article style={{
      background: T.card, border: `1px solid ${triggered ? T.goldPale : T.border}`,
      borderRadius: '8px', padding: '14px 16px', marginBottom: '12px',
    }}>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '10.5px', color: T.muted }}>
          Rule {node.ruleNumber} · {node.topic}
        </span>
        {node.state === 'relevant_unasked' && (
          <span style={{
            fontSize: '10.5px', padding: '2px 8px', borderRadius: '999px',
            background: T.warnBg, border: `1px solid ${T.warnBorder}`, color: T.warnText,
          }}>
            Relevant now
          </span>
        )}
        <span style={{ fontSize: '10.5px', color: T.muted, marginLeft: 'auto' }}>
          Notice {node.notice}
        </span>
      </div>

      {/* The approved wording. Verbatim. */}
      <p style={{
        fontFamily: FONT_DISPLAY, fontSize: '15.5px', color: T.text,
        margin: '8px 0 4px', lineHeight: 1.45,
      }}>
        {node.approvedQuestion}
      </p>

      {node.relevanceReason && node.state !== 'answered' && (
        <p style={{ fontSize: '11.5px', color: T.text2, margin: '0 0 8px' }}>
          {node.relevanceReason} — ask this now.
        </p>
      )}

      <div role="radiogroup" aria-label={node.approvedQuestion}
        style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
        {(['YES', 'NO', 'NOT_SURE'] as AnnexAnswer[]).map((a) => {
          const selected = answered?.answer === a
          return (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={!mayAsk}
              onClick={() => onAnswer(a)}
              style={{ ...answerBtn(selected, a !== 'NO'), opacity: mayAsk ? 1 : 0.6 }}
            >
              {ANSWER_LABELS[a]}
            </button>
          )
        })}
      </div>

      {/* Rule 26 needs an amount and a timeframe; the answer alone is not the
          trigger. Unknown is fail-closed and still reaches a human. */}
      {node.threshold !== null && answered?.answer === 'YES' && (
        <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ fontSize: '12px', color: T.text2 }}>
            How much (% of body weight){' '}
            <input value={pct} onChange={(e) => setPct(e.target.value)} inputMode="decimal"
              style={{ width: '70px', fontSize: '12px', padding: '4px 6px', borderRadius: '6px', border: `1px solid ${T.border}` }} />
          </label>
          <label style={{ fontSize: '12px', color: T.text2 }}>
            Over how many months{' '}
            <input value={months} onChange={(e) => setMonths(e.target.value)} inputMode="numeric"
              style={{ width: '70px', fontSize: '12px', padding: '4px 6px', borderRadius: '6px', border: `1px solid ${T.border}` }} />
          </label>
          <button type="button" onClick={() => onWeightLoss({
            percentLost: pct === '' ? null : Number(pct),
            overMonths: months === '' ? null : Number(months),
          })} style={{
            fontSize: '11.5px', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer',
            background: T.card, color: T.text2, border: `1px solid ${T.border}`,
          }}>
            Record
          </button>
          <button type="button" onClick={() => onWeightLoss({ noticeableOverWeeks: true })} style={{
            fontSize: '11.5px', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer',
            background: T.card, color: T.text2, border: `1px solid ${T.border}`,
          }}>
            Noticeable over weeks
          </button>
          <span style={{ fontSize: '11px', color: node.threshold === 'met' ? T.goldInk : T.muted }}>
            threshold: {node.threshold}
          </span>
        </div>
      )}

      {/* Follow-up detail. Captured because a reviewer wants it; it never
          raises the review, which is already open by the time it is asked. */}
      {triggered && (
        <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: `1px solid ${T.border}` }}>
          <p style={{ fontSize: '11px', color: T.muted, margin: '0 0 8px' }}>
            Detail for the reviewer. Capturing it does not raise or close anything.
          </p>
          {ANNEX_FOLLOW_UPS.map((f) => (
            <label key={f.id} style={{ display: 'block', marginBottom: '7px' }}>
              <span style={{ fontSize: '12px', color: T.text2 }}>{f.prompt}</span>
              <input
                defaultValue={answered?.followUp?.[f.id] ?? ''}
                onBlur={(e) => { if (e.target.value.trim()) onFollowUp(f.id, e.target.value.trim()) }}
                style={{
                  display: 'block', width: '100%', marginTop: '3px', fontSize: '12.5px',
                  padding: '6px 8px', borderRadius: '6px', border: `1px solid ${T.border}`,
                  background: T.card, color: T.text,
                }}
              />
            </label>
          ))}
        </div>
      )}

      {answered && (
        <p style={{ fontSize: '11px', color: T.muted, margin: '10px 0 0', lineHeight: 1.5 }}>
          {answered.via === 'system_answer_equivalent'
            ? `Answered from the client's own selection “${answered.viaOptionValue}” — the approved question was not read out.`
            : `${answered.actorDisplayName} · ${new Date(answered.at).toLocaleString('en-GB')}`}
          {triggered && (
            <strong style={{ color: T.goldInk, fontWeight: 600 }}> · needs human review</strong>
          )}
        </p>
      )}

      {reviewMode && (
        <p style={{ fontSize: '10px', color: T.muted, margin: '7px 0 0', fontFamily: 'ui-monospace, monospace' }}>
          {node.ruleId} · streams: {node.annexStreams.join(' | ')} · sections: {node.linkedSections.join(', ')}
          {' '}· absenceCanSatisfyNo: false
        </p>
      )}
    </article>
  )
}
