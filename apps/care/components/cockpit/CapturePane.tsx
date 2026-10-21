'use client'

// ─── RIGHT PANE — Live Case Capture ──────────────────────────────────────────
// The dominant working area. Everything the practitioner actually does.
//
// Only what is explicitly asked, captured or observed enters the record here.
// Each control calls a domain function; this file holds no clinical rules of
// its own — which branch opens, what is sufficient, what raises review and
// what may be written are all decided in packages/db/src/cockpit.
//
// UNANSWERED IS NEVER "NO". There is no default selection anywhere in this
// pane, and the "Not asked" and "Declined" controls record those states
// explicitly rather than leaving absence to be interpreted.

import { useId, useState } from 'react'
import {
  orderedTargets, targetKey, outstandingTargets, isBranchSufficient,
  attributionLine, can,
  type CaptureState, type CaptureActor, type BranchCapture, type DiggingEdge,
  type CockpitSafetyItem, type FinishSectionGate, type SectionStatus,
  type CaseWideSafetyStatus, type V2QuestionDef,
} from '@natural-intelligence/db/cockpit'
import type { V2Provenance } from '@natural-intelligence/db/intakeV2'
import { T, FONT_DISPLAY } from '@/components/workspace/caseTheme'

export interface CapturePaneProps {
  questions: V2QuestionDef[]
  state: CaptureState
  actor: CaptureActor
  safetyItems: readonly CockpitSafetyItem[]
  sectionStatus: SectionStatus
  caseWide: CaseWideSafetyStatus
  gate: FinishSectionGate
  reviewMode: boolean
  focusQuestionId: string | null
  edgeFor: (edgeId: string) => DiggingEdge | undefined
  onFocus: (questionId: string) => void
  onAnswer: (questionId: string, value: unknown, provenance: V2Provenance) => void
  onBranchDetail: (edgeId: string, key: string, value: string) => void
  onReopen: (edgeId: string) => void
  onNoLongerRelevant: (edgeId: string, reason: string) => void
  onFinish: () => void
  onNodeDetails: (questionId: string) => void
}

const chip = (selected: boolean, flagged: boolean) => ({
  fontSize: '12.5px', padding: '6px 12px', borderRadius: '999px', cursor: 'pointer',
  textAlign: 'left' as const,
  background: selected ? (flagged ? T.goldWash : T.text) : T.card,
  color: selected ? (flagged ? T.goldInk : '#fff') : T.text2,
  border: `1px solid ${selected ? (flagged ? T.goldPale : T.text) : T.border}`,
  fontWeight: selected && flagged ? 600 : 400,
})

const smallBtn = {
  fontSize: '11.5px', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer',
  background: T.card, color: T.text2, border: `1px solid ${T.border}`,
}

function asList(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String) : typeof v === 'string' ? [v] : []
}

// ── One question ────────────────────────────────────────────────────────────

function QuestionCard({
  q, props,
}: { q: V2QuestionDef; props: CapturePaneProps }) {
  const { state, actor, reviewMode } = props
  const id = useId()
  const captured = state.answers[q.id]
  const selected = asList(captured?.value)
  const redFlags = q.safetyOptions ?? []
  const multi = q.type === 'multichip'
  const focused = props.focusQuestionId === q.id
  const mayCapture = can(actor, 'capture_client_answer').allowed

  const toggle = (option: string) => {
    if (!mayCapture) return
    const next = multi
      ? (selected.includes(option) ? selected.filter((v) => v !== option) : [...selected, option])
      : [option]
    // Chip questions offer "None of these" as an exclusive answer.
    const cleaned = multi && option === 'None of these'
      ? ['None of these']
      : next.filter((v) => v !== 'None of these' || !multi)
    props.onAnswer(q.id, multi ? cleaned : cleaned[0], 'client_reported')
  }

  return (
    <article
      onFocusCapture={() => props.onFocus(q.id)}
      style={{
        background: T.card,
        border: `1px solid ${focused ? T.goldPale : T.border}`,
        borderLeft: `3px solid ${focused ? T.gold : T.border}`,
        borderRadius: '10px', padding: '16px 18px', marginBottom: '14px',
      }}
    >
      <div style={{ display: 'flex', gap: '12px', alignItems: 'baseline', flexWrap: 'wrap' }}>
        <h3 id={id} style={{ fontFamily: FONT_DISPLAY, fontSize: '16px', color: T.text, margin: 0, flex: 1 }}>
          {q.label}
        </h3>
        {redFlags.length > 0 && (
          <span style={{
            fontSize: '10.5px', padding: '2px 8px', borderRadius: '999px',
            background: T.goldWash, border: `1px solid ${T.goldPale}`, color: T.goldInk,
          }}>
            Carries safety screening
          </span>
        )}
        {reviewMode && (
          <button type="button" onClick={() => props.onNodeDetails(q.id)} style={smallBtn}>
            Node details
          </button>
        )}
      </div>

      {q.help && (
        <p style={{ fontSize: '12px', color: T.text2, margin: '7px 0 0', lineHeight: 1.5 }}>{q.help}</p>
      )}

      <div
        role={multi ? 'group' : 'radiogroup'}
        aria-labelledby={id}
        style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', marginTop: '12px' }}
      >
        {(q.options ?? []).map((option: string) => {
          const isSelected = selected.includes(option)
          const flagged = redFlags.includes(option)
          return (
            <button
              key={option}
              type="button"
              role={multi ? 'checkbox' : 'radio'}
              aria-checked={isSelected}
              disabled={!mayCapture}
              onClick={() => toggle(option)}
              style={{ ...chip(isSelected, flagged), opacity: mayCapture ? 1 : 0.6 }}
            >
              {option}
              {/* The red flag is named in words, not signalled by colour alone. */}
              {flagged && isSelected && (
                <span style={{ fontSize: '10px', display: 'block', fontWeight: 400 }}>
                  needs human review
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Explicit states, so absence is never read as a negative answer. */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
        <button type="button" disabled={!mayCapture}
          onClick={() => props.onAnswer(q.id, null, 'not_asked')} style={smallBtn}>
          Not asked
        </button>
        <button type="button" disabled={!mayCapture}
          onClick={() => props.onAnswer(q.id, null, 'declined')} style={smallBtn}>
          Client declined
        </button>
        {captured && can(actor, 'verify_qualified_matter').allowed && (
          <button type="button"
            onClick={() => props.onAnswer(q.id, captured.value, 'practitioner_verified')} style={smallBtn}>
            Verify as asked
          </button>
        )}
      </div>

      {captured && (
        <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: `1px solid ${T.border}` }}>
          <p style={{ fontSize: '11px', color: T.muted, margin: 0 }}>
            {captured.provenance.replace(/_/g, ' ')} · {attributionLine(captured.actor, captured.at)}
            {captured.draft && ' · draft'}
          </p>

          {/* A changed answer keeps its history, and the history is visible. */}
          {captured.history.length > 0 && (
            <details style={{ marginTop: '7px' }}>
              <summary style={{ fontSize: '11px', color: T.goldInk, cursor: 'pointer' }}>
                {captured.history.length} earlier answer{captured.history.length > 1 ? 's' : ''} kept
              </summary>
              <ul style={{ listStyle: 'none', padding: '7px 0 0', margin: 0 }}>
                {captured.history.map((h, i) => (
                  <li key={i} style={{ fontSize: '11.5px', color: T.text2, marginBottom: '4px' }}>
                    {asList(h.value).join(', ') || '—'}
                    <span style={{ color: T.muted }}>
                      {' '}· {h.provenance.replace(/_/g, ' ')} · {new Date(h.at).toLocaleString('en-GB')}
                    </span>
                    {h.note && <span style={{ color: T.muted }}> · {h.note}</span>}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {captured.canonicalWriteBlocked && (
            <p style={{ fontSize: '10.5px', color: T.muted, margin: '7px 0 0', lineHeight: 1.45 }}>
              Held in this session only — {captured.canonicalBlockReason}
            </p>
          )}
        </div>
      )}
    </article>
  )
}

// ── One digging branch ──────────────────────────────────────────────────────

function BranchCard({
  branch, edge, props,
}: { branch: BranchCapture; edge: DiggingEdge; props: CapturePaneProps }) {
  const { actor, reviewMode } = props
  const [retireReason, setRetireReason] = useState('')
  const [retiring, setRetiring] = useState(false)
  const sufficient = isBranchSufficient(branch)
  const outstanding = outstandingTargets(branch)
  const mayRetire = can(actor, 'mark_branch_no_longer_relevant').allowed

  return (
    <article style={{
      background: branch.needsReconciliation ? T.warnBg : T.sunken,
      border: `1px solid ${branch.needsReconciliation ? T.warnBorder : T.border}`,
      borderRadius: '10px', padding: '14px 16px', marginBottom: '14px', marginLeft: '18px',
    }}>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'baseline', flexWrap: 'wrap' }}>
        <h4 style={{ fontSize: '13.5px', color: T.text, margin: 0, flex: 1, fontWeight: 600 }}>
          Opened by “{branch.openedBy.join('”, “')}”
        </h4>
        <span style={{ fontSize: '10.5px', color: T.muted }}>
          {branch.lifecycle.replace(/_/g, ' ')}
          {sufficient ? ' · enough recorded' : ` · ${outstanding.length} outstanding`}
        </span>
        {edge.safetyLinked && (
          <span style={{
            fontSize: '10.5px', padding: '2px 8px', borderRadius: '999px',
            background: T.goldWash, border: `1px solid ${T.goldPale}`, color: T.goldInk,
          }}>
            safety linked
          </span>
        )}
      </div>

      {branch.needsReconciliation && (
        <div style={{ marginTop: '10px' }}>
          <p style={{ fontSize: '12px', color: T.warnText, margin: '0 0 8px', lineHeight: 1.5 }}>
            {branch.reconciliationReason}
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" onClick={() => props.onReopen(edge.id)} style={smallBtn}>
              Reopen
            </button>
            {mayRetire ? (
              retiring ? (
                <>
                  <input
                    value={retireReason}
                    onChange={(e) => setRetireReason(e.target.value)}
                    placeholder="Why is it no longer relevant?"
                    aria-label="Reason no longer relevant"
                    style={{
                      fontSize: '12px', padding: '4px 8px', borderRadius: '6px', minWidth: '240px',
                      border: `1px solid ${T.border}`, background: T.card, color: T.text,
                    }}
                  />
                  <button
                    type="button"
                    disabled={!retireReason.trim()}
                    onClick={() => { props.onNoLongerRelevant(edge.id, retireReason); setRetiring(false) }}
                    style={smallBtn}
                  >
                    Record
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => setRetiring(true)} style={smallBtn}>
                  No longer relevant
                </button>
              )
            ) : (
              <span style={{ fontSize: '11px', color: T.muted }}>
                {can(actor, 'mark_branch_no_longer_relevant').reason}
              </span>
            )}
          </div>
          <p style={{ fontSize: '10.5px', color: T.muted, margin: '8px 0 0' }}>
            Everything recorded here is kept either way.
          </p>
        </div>
      )}

      <ol style={{ listStyle: 'none', padding: 0, margin: '12px 0 0' }}>
        {orderedTargets(edge).map((t) => {
          const key = targetKey(edge, t)
          const got = branch.answers[key]
          const prompt = t.practitionerPrompt
            ?? props.questions.find((q) => q.id === t.targetQuestionId)?.label
            ?? 'Continue'
          return (
            <li key={key} style={{ marginBottom: '12px' }}>
              <p style={{ fontSize: '13px', color: T.text, margin: '0 0 5px', lineHeight: 1.45 }}>
                {t.sequence}. {prompt}
                {!t.required && <span style={{ color: T.muted, fontSize: '11px' }}> · optional</span>}
                {reviewMode && (
                  <span style={{ display: 'block', fontSize: '10px', color: T.muted }}>
                    {key} · sufficiency: {String(t.countsTowardsSufficiency)} · unsure: {t.unsureBehaviour}
                  </span>
                )}
              </p>
              <BranchInput
                initial={typeof got?.value === 'string' ? got.value : ''}
                onSave={(v) => props.onBranchDetail(edge.id, key, v)}
                disabled={!can(props.actor, 'capture_client_answer').allowed}
              />
              {got && (
                <p style={{ fontSize: '10.5px', color: T.muted, margin: '4px 0 0' }}>
                  {attributionLine(got.actor, got.at)}
                  {got.history.length > 0 && ` · ${got.history.length} earlier kept`}
                </p>
              )}
            </li>
          )
        })}
      </ol>

      <p style={{ fontSize: '10.5px', color: T.muted, margin: '4px 0 0', lineHeight: 1.45 }}>
        Detail recorded here does not itself raise a review, and finishing this branch does not
        close one.
      </p>
    </article>
  )
}

/** Uncontrolled until blur, so a keystroke does not rebuild the case state. */
function BranchInput({
  initial, onSave, disabled,
}: { initial: string; onSave: (v: string) => void; disabled: boolean }) {
  const [draft, setDraft] = useState(initial)
  return (
    <textarea
      value={draft}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { if (draft.trim() && draft !== initial) onSave(draft.trim()) }}
      rows={2}
      placeholder="What they said, in their words"
      style={{
        width: '100%', fontSize: '12.5px', lineHeight: 1.5, padding: '7px 9px',
        borderRadius: '6px', border: `1px solid ${T.border}`, background: T.card,
        color: T.text, fontFamily: 'inherit', resize: 'vertical',
      }}
    />
  )
}

// ── The pane ────────────────────────────────────────────────────────────────

export function CapturePane(props: CapturePaneProps) {
  const { questions, state, sectionStatus: s, caseWide, gate, actor } = props
  const mayFinish = can(actor, 'finish_section').allowed

  return (
    <section aria-label="Live case capture">
      {questions.map((q) => {
        const branches = Object.values(state.branches)
          .filter((b) => props.edgeFor(b.edgeId)?.sourceQuestionId === q.id)
        return (
          <div key={q.id}>
            <QuestionCard q={q} props={props} />
            {branches.map((b) => {
              const edge = props.edgeFor(b.edgeId)
              return edge ? <BranchCard key={b.edgeId} branch={b} edge={edge} props={props} /> : null
            })}
          </div>
        )
      })}

      {/* ── Section footer. THIS SECTION and CASE-WIDE kept apart. ────────── */}
      <footer style={{
        marginTop: '26px', borderTop: `1px solid ${T.border}`, paddingTop: '18px',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px',
      }}>
        <div>
          <h3 style={{
            fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.1em',
            color: T.muted, margin: '0 0 8px',
          }}>
            This section
          </h3>
          {s.clear ? (
            <p style={{ fontSize: '12.5px', color: T.text2, margin: 0 }}>Nothing outstanding here.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '12.5px', color: T.text2 }}>
              {s.mandatoryUnanswered.length > 0 && (
                <li>{s.mandatoryUnanswered.length} required question(s) unanswered</li>
              )}
              {s.unfinishedDigging.length > 0 && (
                <li>{s.unfinishedDigging.length} line(s) of questioning unfinished</li>
              )}
              {s.needsReconciliation.length > 0 && (
                <li>{s.needsReconciliation.length} branch(es) need reconciliation</li>
              )}
            </ul>
          )}
          {s.openSafetyInThisSection > 0 && (
            <p style={{ fontSize: '12px', color: T.goldInk, margin: '8px 0 0' }}>
              {s.openSafetyInThisSection} safety item(s) raised here await a human review. Finishing
              the section does not close them.
            </p>
          )}
        </div>

        <div>
          <h3 style={{
            fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.1em',
            color: T.muted, margin: '0 0 8px',
          }}>
            Case-wide safety
          </h3>
          {!caseWide.anyOpenAnywhere && caseWide.unaskedSafetyElsewhere.length === 0 ? (
            <p style={{ fontSize: '12.5px', color: T.text2, margin: 0 }}>Nothing open across the case.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '12.5px', color: T.text2 }}>
              {caseWide.openElsewhere > 0 && (
                <li>{caseWide.openElsewhere} item(s) open in {caseWide.sectionsElsewhere.join(', ')}</li>
              )}
              {caseWide.decidedNotResolved > 0 && (
                <li>{caseWide.decidedNotResolved} decided but not yet resolved</li>
              )}
              {caseWide.unaskedSafetyElsewhere.length > 0 && (
                <li>{caseWide.unaskedSafetyElsewhere.length} safety question(s) not yet asked elsewhere</li>
              )}
            </ul>
          )}
          <p style={{ fontSize: '10.5px', color: T.muted, margin: '8px 0 0', lineHeight: 1.45 }}>
            Belongs to the whole case. None of it blocks this section.
          </p>
        </div>
      </footer>

      {/* ── Finish. Surfaces everything BEFORE the click, not after. ──────── */}
      <div style={{ marginTop: '20px' }}>
        {gate.blockers.length > 0 && (
          <ul style={{
            listStyle: 'none', padding: '12px 14px', margin: '0 0 12px', borderRadius: '8px',
            background: T.warnBg, border: `1px solid ${T.warnBorder}`,
            fontSize: '12.5px', color: T.warnText,
          }}>
            {gate.blockers.map((b) => <li key={b}>{b}</li>)}
          </ul>
        )}
        {gate.remainsOpen.length > 0 && (
          <ul style={{
            listStyle: 'none', padding: 0, margin: '0 0 12px',
            fontSize: '12px', color: T.muted, lineHeight: 1.5,
          }}>
            {gate.remainsOpen.map((r) => <li key={r}>{r}</li>)}
          </ul>
        )}
        <button
          type="button"
          disabled={!gate.canFinish || !mayFinish}
          onClick={props.onFinish}
          style={{
            fontSize: '13px', padding: '9px 18px', borderRadius: '8px',
            cursor: gate.canFinish && mayFinish ? 'pointer' : 'not-allowed',
            background: gate.canFinish && mayFinish ? T.gold : T.sunken,
            color: gate.canFinish && mayFinish ? '#fff' : T.muted,
            border: `1px solid ${gate.canFinish && mayFinish ? T.gold : T.border}`,
          }}
        >
          {gate.label}
        </button>
        {!mayFinish && (
          <p style={{ fontSize: '11.5px', color: T.muted, margin: '8px 0 0' }}>
            {can(actor, 'finish_section').reason}
          </p>
        )}
      </div>
    </section>
  )
}
