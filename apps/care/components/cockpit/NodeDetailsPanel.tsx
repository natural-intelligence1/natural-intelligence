'use client'

// ─── Node details · review mode ──────────────────────────────────────────────
// The ONLY place internal plumbing is shown: question ids, concept ids, field
// paths, mapping statuses, graph edges and Call Sheet linkage.
//
// For Founder, product and architecture inspection. A practitioner in normal
// mode never sees any of it — the whole panel renders only when review mode
// is on, and the data comes from `nodeDetails()`, which nothing else calls.

import type {
  NodeDetails, MappingPackSummary, PilotScope,
} from '@natural-intelligence/db/cockpit'
import { T, FONT_DISPLAY } from '@/components/workspace/caseTheme'

const mono = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '11.5px' }

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '10px', padding: '5px 0', borderBottom: `1px solid ${T.border}` }}>
      <dt style={{ fontSize: '11px', color: T.muted, minWidth: '150px' }}>{k}</dt>
      <dd style={{ margin: 0, color: T.text, flex: 1, ...mono }}>{v}</dd>
    </div>
  )
}

export function NodeDetailsPanel({
  details, onClose, pilot, mapping, annex, annexNodes, unsupplied,
}: {
  details: NodeDetails | null
  onClose: () => void
  pilot: PilotScope
  mapping: MappingPackSummary
  annex: {
    present: boolean
    source: string
    validationStatus: string
    approvedRuleCount: number
    rulesSuppliedForPilot: readonly number[]
    note: string
  }
  annexNodes: ReadonlyArray<{
    ruleId: string; ruleNumber: number; topic: string; approvedQuestion: string
    notice: string; annexStreams: string[]; pilotSections: string[]; quantified: boolean
  }>
  unsupplied: ReadonlyArray<{ questionId: string; section: string; value: string }>
}) {
  return (
    <section
      aria-label="Node details, review mode"
      style={{
        marginTop: '26px', background: T.card, border: `1px solid ${T.faint}`,
        borderRadius: '10px', padding: '18px 20px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '14px' }}>
        <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: '17px', color: T.text, margin: 0, flex: 1 }}>
          Node details · review mode
        </h2>
        {details && (
          <button
            type="button" onClick={onClose}
            style={{
              fontSize: '11.5px', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer',
              background: T.card, color: T.text2, border: `1px solid ${T.border}`,
            }}
          >
            Clear selection
          </button>
        )}
      </div>

      <p style={{ fontSize: '11.5px', color: T.muted, margin: '0 0 16px', lineHeight: 1.5 }}>
        Internal plumbing, for product and architecture inspection. None of this is shown to a
        practitioner in normal mode.
      </p>

      {/* ── Pilot-wide position ──────────────────────────────────────────── */}
      <dl style={{ margin: '0 0 20px' }}>
        <Row k="pilot sections" v={pilot.sections.join(', ')} />
        <Row k="pilot questions" v={pilot.questionCount} />
        <Row k="red-flag questions" v={`${pilot.redFlagQuestionCount} (${pilot.redFlagValueCount} values)`} />
        <Row
          k="mapping statuses"
          v={Object.entries(mapping.byStatus).filter(([, n]) => n > 0)
            .map(([s, n]) => `${s}=${n}`).join('  ')}
        />
        <Row
          k="canonical writes"
          v={mapping.allWritesBlocked
            ? <span style={{ color: T.goldInk }}>ALL BLOCKED — 0 approved mappings</span>
            : 'some permitted'}
        />
        <Row k="needs a new field" v={mapping.needNewField.join(', ') || '—'} />
        <Row k="Annex 1" v={`${annex.source} — ${annex.validationStatus}`} />
        <Row
          k="Annex rules"
          v={`${annex.approvedRuleCount} approved; ${annex.rulesSuppliedForPilot.join(', ')} supplied for this pilot`}
        />
      </dl>

      {/* The approved safety nodes, as their own objects. */}
      <h3 style={{ fontSize: '12px', color: T.text, margin: '0 0 8px', fontWeight: 600 }}>
        Approved Annex 1 nodes
      </h3>
      <dl style={{ margin: '0 0 20px' }}>
        {annexNodes.map((n) => (
          <Row
            key={n.ruleId}
            k={`rule ${n.ruleNumber}`}
            v={
              <>
                {n.topic} · notice {n.notice}{n.quantified ? ' · quantified trigger' : ''}
                <span style={{ display: 'block', color: T.text2 }}>“{n.approvedQuestion}”</span>
                <span style={{ display: 'block', color: T.muted }}>
                  asked once in: {n.annexStreams.join(' | ')} → {n.pilotSections.join(', ')}
                </span>
              </>
            }
          />
        ))}
        <Row
          k="no rule supplied"
          v={unsupplied.length === 0
            ? '—'
            : <span style={{ color: T.goldInk }}>
                {unsupplied.map((u) => u.value).join(' | ')} — still raise review, not Annex-approved wording
              </span>}
        />
      </dl>

      {/* ── The selected question ────────────────────────────────────────── */}
      {details ? (
        <>
          <h3 style={{ fontSize: '12px', color: T.text, margin: '0 0 8px', fontWeight: 600 }}>
            Selected node
          </h3>
          <dl style={{ margin: 0 }}>
            <Row k="question id" v={details.questionId} />
            <Row k="concept id" v={details.conceptRef?.conceptId ?? <span style={{ color: T.muted }}>null</span>} />
            {/* The variant is half the identity. Shown separately so it
                cannot be read past. */}
            <Row
              k="concept variant"
              v={details.conceptRef?.variant
                ?? <span style={{ color: T.muted }}>none (concept is not parameterised)</span>}
            />
            <Row k="canonical field(s)" v={details.fieldIds.join(', ') || <span style={{ color: T.muted }}>none</span>} />
            <Row k="mapping status" v={details.mappingStatus} />
            <Row k="capture owner" v={details.captureOwner ?? '—'} />
            <Row k="provenance rule" v={details.provenanceRule ?? '—'} />
            <Row k="SaMD class" v={details.samd} />
            <Row k="red-flag values" v={details.redFlagValues.join(' | ') || '—'} />
            <Row k="Annex rule" v={details.annexRuleIds.length > 0 ? details.annexRuleIds.join(", ") : <span style={{ color: T.muted }}>no rule supplied for these values</span>} />
            <Row k="Call Sheet linked" v={String(details.callSheetLinked)} />
            <Row
              k="write blocked"
              v={details.writeBlocked
                ? <span style={{ color: T.goldInk }}>yes — {details.writeBlockReason}</span>
                : 'no'}
            />
            <Row
              k="digging edges"
              v={details.edges.length === 0 ? '—' : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {details.edges.map((e) => (
                    <li key={e.id} style={{ marginBottom: '3px' }}>
                      {e.id} · trigger [{e.trigger.join(' | ')}] · {e.targets} target(s) ·{' '}
                      {e.reviewStatus}{e.safetyLinked ? ' · safety-linked' : ''}
                    </li>
                  ))}
                </ul>
              )}
            />
          </dl>
        </>
      ) : (
        <p style={{ fontSize: '12.5px', color: T.muted, margin: 0 }}>
          Select “Node details” on a question to inspect its concept, field path, mapping status and
          graph edges.
        </p>
      )}
    </section>
  )
}
