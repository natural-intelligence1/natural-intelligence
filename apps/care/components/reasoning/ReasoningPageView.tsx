// ─── apps/care/components/reasoning/ReasoningPageView.tsx ────────────────────
// Shared view component for the Clinical Reasoning Trace.
// Consumed by:
//   - /cases/[caseId]/reasoning (legacy route, unchanged user-facing behaviour)
//   - /cases/[caseId]/work/[workId] (B.1 workspace — replaces with full workspace in B.2)
//
// Does NOT include the top bar or page wrapper — those are added by the page.

import type { PractitionerTrace } from '@natural-intelligence/db/crt'
import { Section }       from './Section'
import { SnapshotCard }  from './SnapshotCard'
import { StatPill }      from './StatPill'
import { TimelineEntry } from './TimelineEntry'
import { ConfidenceBar } from './ConfidenceBar'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReasoningPageViewProps {
  trace:      PractitionerTrace | null
  clientCase: {
    id:                    string
    primary_concern:       string | null
    case_complexity_score: number
    escalation_required:   boolean
    status:                string
  }
  clientName: string
}

// ─── Sub-components (local to this view) ─────────────────────────────────────

function NoTrace() {
  return (
    <div style={{ padding: '48px', background: '#FFFFFF', border: '1px solid #E8E6E0', borderRadius: '12px', textAlign: 'center' }}>
      <p style={{ fontSize: '15px', color: '#8A8880', marginBottom: '8px' }}>
        No reasoning trace generated yet.
      </p>
      <p style={{ fontSize: '13px', color: '#B0AEA8' }}>
        A trace is generated automatically when the member completes their health intake.
      </p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ReasoningPageView({ trace, clientCase, clientName }: ReasoningPageViewProps) {
  const initials = clientName
    .split(' ')
    .map((w: string) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const hypotheses     = trace?.entries.filter(e => e.entry_type === 'hypothesis')     ?? []
  const observations   = trace?.entries.filter(e => e.entry_type === 'observation')   ?? []
  // Exclude client_explanation from the practitioner timeline (client-facing copy only)
  const timelineEntries = trace?.entries.filter(e => e.entry_type !== 'client_explanation') ?? []

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 32px' }}>

      {/* ── Case header ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '48px', gap: '24px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#1A1917', color: '#F8F6F2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 600, flexShrink: 0 }}>
            {initials}
          </div>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 500, margin: '0 0 4px' }}>{clientName}</h1>
            <p style={{ fontSize: '14px', color: '#8A8880', margin: 0 }}>
              {clientCase.primary_concern ?? 'No primary concern recorded'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <StatPill label="Complexity" value={String(clientCase.case_complexity_score)} />
          <StatPill
            label="Escalation"
            value={clientCase.escalation_required ? 'Required' : 'None'}
            alert={clientCase.escalation_required}
          />
          <StatPill label="Status" value={clientCase.status} />
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      {!trace ? (
        <NoTrace />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '32px', alignItems: 'start' }}>

          {/* ── Left column: snapshot + timeline ──────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

            <Section title="Case Snapshot">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <SnapshotCard
                  label="Primary systems"
                  value={
                    [...new Set(timelineEntries.filter(e => e.system_area).map(e => e.system_area!))].join(', ') || '—'
                  }
                />
                <SnapshotCard label="Observations" value={String(observations.length)} />
                <SnapshotCard label="Hypotheses"   value={String(hypotheses.length)} />
                <SnapshotCard label="Trace type"   value={trace.trace_type.replace('_', ' ')} />
              </div>
            </Section>

            <Section title="Reasoning Timeline">
              {timelineEntries.length === 0 ? (
                <p style={{ fontSize: '14px', color: '#8A8880' }}>No entries yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                  {timelineEntries.map((entry, i) => (
                    <TimelineEntry key={entry.id} entry={entry} index={i} />
                  ))}
                </div>
              )}
            </Section>
          </div>

          {/* ── Right column: hypothesis board + metadata ─────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            <Section title="Hypothesis Board">
              {hypotheses.length === 0 ? (
                <p style={{ fontSize: '13px', color: '#8A8880' }}>No hypotheses generated.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {hypotheses.map((h, i) => (
                    <div key={h.id} style={{ padding: '12px 14px', background: '#FFFFFF', border: '1px solid #E8E6E0', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#8A8880' }}>#{i + 1}</span>
                        {h.hypothesis_key && (
                          <span style={{ fontSize: '10px', background: '#F4F3F0', padding: '2px 6px', borderRadius: '3px', color: '#555350', fontFamily: 'monospace' }}>
                            {h.hypothesis_key}
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '13px', lineHeight: '1.5', margin: '0 0 8px', color: '#1A1917' }}>
                        {h.content}
                      </p>
                      <ConfidenceBar value={h.confidence ?? null} />
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Trace metadata */}
            <div style={{ padding: '12px 14px', background: '#F4F3F0', borderRadius: '8px' }}>
              <p style={{ fontSize: '11px', color: '#8A8880', margin: 0, lineHeight: '1.7' }}>
                Generated by: <strong>{trace.generated_by}</strong><br />
                Trace status: <strong>{trace.status}</strong><br />
                Created:{' '}
                <strong>
                  {new Date(trace.created_at).toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </strong>
              </p>
            </div>

            {/* B.2 placeholder — action panel renders here in the workspace */}
            <div style={{ padding: '16px', background: '#FFFFFF', border: '1px solid #E8E6E0', borderRadius: '8px' }}>
              <p style={{ fontSize: '12px', color: '#8A8880', margin: 0 }}>
                Practitioner actions coming in B.2.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
