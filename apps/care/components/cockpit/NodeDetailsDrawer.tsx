'use client'

// ─── Node details · review mode ──────────────────────────────────────────────
// Board 9 is an ARCHITECTURE DIAGRAM, not a screen. Its CONTENT is implemented
// here as the approved side drawer over the right pane, built with NI
// components and tokens rather than reproduced pixel-for-pixel.
//
// Board 9's model, which this follows: one node powers both panes. The left
// pane reads its guidance (A · node guidance, linked safety rule, B ·
// case-specific items); the right pane reads and writes its capture (mapping
// status, provenance, capture owner, C · record). Guidance never becomes
// record; only what was asked, captured or observed becomes case data.
//
// SHOWN ONLY TO FOUNDER AND REVIEW ROLES. Normal practitioner view never
// shows question or concept ids, field paths, mapping status, edge details or
// Call Sheet ids — which is enforced by this drawer being the only component
// that renders them.

import type { NodeDetails, MappingPackSummary, PilotScope } from '@natural-intelligence/db/cockpit'
import { C, F, eyebrow, statePill } from './cockpitTokens'

export function NodeDetailsDrawer({
  details, open, onClose, pilot, mapping, annex, annexNodes, unsupplied,
}: {
  details: NodeDetails | null
  open: boolean
  onClose: () => void
  pilot: PilotScope
  mapping: MappingPackSummary
  annex: {
    present: boolean; source: string; validationStatus: string
    approvedRuleCount: number; rulesSuppliedForPilot: readonly number[]; note: string
  }
  annexNodes: ReadonlyArray<{
    ruleId: string; ruleNumber: number; topic: string; approvedQuestion: string
    notice: string; annexStreams: string[]; pilotSections: string[]; quantified: boolean
  }>
  unsupplied: ReadonlyArray<{ questionId: string; section: string; value: string }>
}) {
  if (!open) return null

  return (
    <aside
      aria-label="Node details, review mode"
      style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, width: '520px',
        background: C.warmWhite, borderLeft: `1px solid ${C.lineStrong}`,
        overflowY: 'auto', padding: '18px 22px 28px', zIndex: 20,
        display: 'flex', flexDirection: 'column', gap: '14px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
        <h2 style={{ fontFamily: F.display, fontSize: '23px', fontWeight: 600, margin: 0, color: C.botanical, flex: 1 }}>
          Node details
        </h2>
        <button type="button" onClick={onClose} style={{
          all: 'unset', cursor: 'pointer', fontSize: '12.5px', color: C.softText,
          border: `1px solid ${C.lineControl}`, borderRadius: '999px', padding: '5px 12px',
        }}>
          Close
        </button>
      </div>
      <p style={{ fontSize: '12.5px', color: C.softText, margin: 0, lineHeight: 1.5 }}>
        Review mode. One node powers both panes: the guide reads it, the capture writes it.
        Nothing here is shown to a practitioner in normal mode.
      </p>

      {/* The selected node — Board 9's centre column. */}
      {details ? (
        <>
          <Panel tone={C.pine}>
            <span style={eyebrow(C.goldInk, 11)}>Question node</span>
            <h3 style={{ fontFamily: F.display, fontSize: '21px', fontWeight: 600, margin: '2px 0 8px', color: C.botanical }}>
              {details.questionId}
            </h3>
            <Field k="Question" v={`${details.samd} · answer set from the approved registry`} />
            <Field k="Concept" v={details.conceptRef?.conceptId ?? 'none'} />
            {/* The variant is half the identity and is shown on its own line
                so it cannot be read past. */}
            <Field
              k="Concept variant"
              v={details.conceptRef?.variant ?? 'none (concept is not parameterised)'}
              emphasise={!!details.conceptRef?.variant}
            />
            <Field k="Canonical field(s)" v={details.fieldIds.join(', ') || 'none'} />
            <div style={{ marginTop: '8px' }}>
              <span style={statePill(details.mappingStatus === 'APPROVED' ? 'resolved' : 'target')}>
                {details.mappingStatus === 'APPROVED' ? 'Approved' : 'Target state until approved'}
              </span>
            </div>
          </Panel>

          <Panel>
            <span style={eyebrow(C.goldInk, 11)}>Mapping status</span>
            <p style={small}>
              Unmapped · candidate · needs review · approved · rejected. Suggested automatically,
              never approved automatically.
            </p>
            <Field k="Status" v={details.mappingStatus} />
            <Field
              k="Writes permitted"
              v={details.writeBlocked ? `No — ${details.writeBlockReason}` : 'Yes'}
              emphasise={details.writeBlocked}
            />
          </Panel>

          <Panel>
            <span style={eyebrow(C.goldInk, 11)}>Provenance and capture owner</span>
            <p style={small}>
              Client reported · practitioner verified · corrected/amended · observed · unconfirmed ·
              not asked · declined — with reviewer and status.
            </p>
            <Field k="Capture owner" v={details.captureOwner ?? '—'} />
            <Field k="Provenance rule" v={details.provenanceRule ?? '—'} />
          </Panel>

          <Panel tone={C.oxblood}>
            <span style={eyebrow(C.oxblood, 11)}>Linked safety rule</span>
            <p style={small}>
              Annex 1 approved wording, verbatim. Asked once, linked to every relevant stream.
              Yes or Not sure → needs human review.
            </p>
            <Field
              k="Annex rule"
              v={details.annexRuleIds.length > 0 ? details.annexRuleIds.join(', ') : 'no rule supplied for these values'}
            />
            <Field k="Red-flag values" v={details.redFlagValues.join(' | ') || '—'} />
          </Panel>

          <Panel>
            <span style={eyebrow(C.goldInk, 11)}>Digging edge — authored, never derived from showIf</span>
            {details.edges.length === 0
              ? <p style={small}>No edge sourced from this question.</p>
              : details.edges.map((e) => (
                <div key={e.id} style={{ fontSize: '12.5px', lineHeight: 1.5, marginBottom: '6px' }}>
                  <b style={{ fontWeight: 600, color: C.botanical }}>{e.id}</b>
                  <span style={{ display: 'block', color: C.softText }}>
                    trigger [{e.trigger.join(' | ')}] · {e.targets} target(s) · review {e.reviewStatus}
                    {e.safetyLinked ? ' · safety-linked' : ''}
                  </span>
                </div>
              ))}
          </Panel>
        </>
      ) : (
        <Panel>
          <p style={small}>Select “Node” on a question to inspect it.</p>
        </Panel>
      )}

      {/* Pilot-wide position. */}
      <Panel>
        <span style={eyebrow(C.goldInk, 11)}>Pilot</span>
        <Field k="Sections" v={pilot.sections.join(', ')} />
        <Field k="Questions" v={String(pilot.questionCount)} />
        <Field k="Mapping statuses" v={Object.entries(mapping.byStatus).filter(([, n]) => n > 0).map(([s, n]) => `${s}=${n}`).join('  ')} />
        <Field
          k="Canonical writes"
          v={mapping.allWritesBlocked ? 'ALL BLOCKED — 0 approved mappings' : 'some permitted'}
          emphasise={mapping.allWritesBlocked}
        />
      </Panel>

      <Panel tone={C.oxblood}>
        <span style={eyebrow(C.oxblood, 11)}>Annex 1</span>
        <Field k="Source" v={annex.source} />
        <Field k="Validation" v={annex.validationStatus} />
        <Field k="Rules" v={`${annex.approvedRuleCount} approved; ${annex.rulesSuppliedForPilot.join(', ')} in this pilot`} />
        {annexNodes.map((n) => (
          <div key={n.ruleId} style={{ fontSize: '12.5px', lineHeight: 1.5, marginTop: '6px' }}>
            <b style={{ fontWeight: 600, color: C.botanical }}>Rule {n.ruleNumber} · {n.topic}</b>
            <span style={{ display: 'block', color: C.text }}>“{n.approvedQuestion}”</span>
            <span style={{ display: 'block', color: C.softText }}>
              notice {n.notice} · asked once in {n.annexStreams.join(' | ')}
              {n.quantified ? ' · quantified trigger' : ''}
            </span>
          </div>
        ))}
        {unsupplied.length > 0 && (
          <p style={{ ...small, marginTop: '8px' }}>
            No rule supplied for: {unsupplied.map((u) => `“${u.value}”`).join(', ')}. These still
            raise review and are not Annex-approved wording.
          </p>
        )}
      </Panel>
    </aside>
  )
}

const small: React.CSSProperties = { fontSize: '12.5px', lineHeight: 1.5, color: C.softText, margin: 0 }

function Panel({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return (
    <section style={{
      background: C.warmWhite, border: `1px solid ${tone ?? C.line}`,
      borderRadius: '12px', padding: '12px 14px',
      display: 'flex', flexDirection: 'column', gap: '4px',
    }}>
      {children}
    </section>
  )
}

function Field({ k, v, emphasise }: { k: string; v: string; emphasise?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: '10px', padding: '4px 0', borderBottom: `1px solid ${C.line}` }}>
      <span style={{ fontSize: '11px', color: C.softText, minWidth: '132px' }}>{k}</span>
      <span style={{
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '11.5px',
        color: emphasise ? C.oxblood : C.text, flex: 1, wordBreak: 'break-word',
      }}>
        {v}
      </span>
    </div>
  )
}
