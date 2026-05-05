import Link                        from 'next/link'
import { notFound }               from 'next/navigation'
import type { Metadata }          from 'next'
import { createAdminClient }      from '@natural-intelligence/db'
import { getPractitionerTrace }   from '@natural-intelligence/db'

export const metadata: Metadata = { title: 'Clinical Reasoning — NI Care' }

// ─── Visual helpers ───────────────────────────────────────────────────────────

const ENTRY_TYPE_LABELS: Record<string, string> = {
  observation:         'Observation',
  hypothesis:          'Hypothesis',
  evidence_for:        'Evidence for',
  evidence_against:    'Evidence against',
  weighting:           'Weighting',
  decision:            'Decision',
  uncertainty:         'Uncertainty',
  recommendation:      'Recommendation',
  escalation_flag:     'Escalation flag',
  practitioner_comment:'Practitioner comment',
  client_explanation:  'Client explanation',
}

const ENTRY_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  observation:         { bg: '#EEF6FF', text: '#2563EB', border: '#BFDBFE' },
  hypothesis:          { bg: '#F5F3FF', text: '#7C3AED', border: '#DDD6FE' },
  evidence_for:        { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
  evidence_against:    { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
  weighting:           { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' },
  decision:            { bg: '#F8FAFC', text: '#1A1917', border: '#E2E8F0' },
  uncertainty:         { bg: '#FFF7ED', text: '#C2410C', border: '#FDBA74' },
  recommendation:      { bg: '#F0FDF4', text: '#166534', border: '#A7F3D0' },
  escalation_flag:     { bg: '#FEF2F2', text: '#991B1B', border: '#FCA5A5' },
  practitioner_comment:{ bg: '#F8F6F2', text: '#1A1917', border: '#D4B07A' },
  client_explanation:  { bg: '#F9FAFB', text: '#374151', border: '#D1D5DB' },
}

const AGENT_LABELS: Record<string, string> = {
  case_historian:      'Case Historian',
  medical_records:     'Medical Records',
  food_environment:    'Food Environment',
  root_cause:          'Root Cause',
  protocol_builder:    'Protocol Builder',
  safety_scope:        'Safety & Scope',
  practitioner_review: 'Practitioner Review',
}

function EntryTypeBadge({ type }: { type: string }) {
  const style = ENTRY_TYPE_COLORS[type] ?? { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' }
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: style.bg, color: style.text, border: `1px solid ${style.border}` }}>
      {ENTRY_TYPE_LABELS[type] ?? type}
    </span>
  )
}

function ConfidenceBar({ value }: { value: number | null }) {
  if (value === null) return null
  const pct = Math.round(value * 100)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ width: '64px', height: '4px', borderRadius: '2px', background: '#E8E6E0', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: value >= 0.7 ? '#15803D' : value >= 0.4 ? '#D97706' : '#DC2626', borderRadius: '2px' }} />
      </div>
      <span style={{ fontSize: '12px', color: '#8A8880' }}>{pct}%</span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ReasoningPage({
  params,
}: {
  params: { caseId: string }
}) {
  const admin = createAdminClient()

  // Load case
  const { data: clientCase, error: caseErr } = await admin
    .from('client_cases')
    .select(`id, primary_concern, case_complexity_score, escalation_required, status, created_at, profiles:client_id (full_name)`)
    .eq('id', params.caseId)
    .single()

  if (caseErr || !clientCase) return notFound()

  // Load trace + entries
  const trace = await getPractitionerTrace(admin, params.caseId)

  const profile = clientCase.profiles as unknown as { full_name: string | null } | null
  const fullName = profile?.full_name ?? 'Unknown'
  const initials = fullName.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()

  // Derive hypotheses from entries
  const hypotheses = trace?.entries.filter(e => e.entry_type === 'hypothesis') ?? []
  const observations = trace?.entries.filter(e => e.entry_type === 'observation') ?? []
  // Exclude client_explanation from the main timeline (client-only)
  const timelineEntries = trace?.entries.filter(e => e.entry_type !== 'client_explanation') ?? []

  return (
    <main style={{ minHeight: '100vh', background: '#FAFAF9', color: '#1A1917' }}>

      {/* ── Top nav ──────────────────────────────────────────────────────────── */}
      <div style={{ borderBottom: '1px solid #E8E6E0', background: '#FFFFFF', padding: '0 32px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '56px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Link href="/cases" style={{ fontSize: '13px', color: '#8A8880', textDecoration: 'none' }}>
              ← All cases
            </Link>
            <span style={{ color: '#D4D0C8' }}>|</span>
            <span style={{ fontSize: '13px', color: '#555350', fontWeight: 500 }}>Clinical Reasoning Trace</span>
          </div>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#B8935A' }}>NI Care</span>
        </div>
      </div>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 32px' }}>

        {/* ── Case header ────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '48px', gap: '24px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#1A1917', color: '#F8F6F2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 600, flexShrink: 0 }}>
              {initials}
            </div>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 500, margin: '0 0 4px' }}>{fullName}</h1>
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

        {!trace ? (
          <NoTrace />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '32px', alignItems: 'start' }}>

            {/* ── Left column: timeline + reasoning ──────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

              {/* Case Snapshot */}
              <Section title="Case Snapshot">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <SnapshotCard label="Primary systems" value={
                    [...new Set(timelineEntries.filter(e => e.system_area).map(e => e.system_area!))].join(', ') || '—'
                  } />
                  <SnapshotCard label="Observations" value={String(observations.length)} />
                  <SnapshotCard label="Hypotheses" value={String(hypotheses.length)} />
                  <SnapshotCard label="Trace type" value={trace.trace_type.replace('_', ' ')} />
                </div>
              </Section>

              {/* Reasoning Timeline */}
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

            {/* ── Right column: hypothesis board + actions ────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

              {/* Hypothesis Board */}
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
                        <ConfidenceBar value={h.confidence} />
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* Practitioner Actions */}
              <Section title="Practitioner Actions">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <ActionButton label="Approve reasoning" variant="primary" />
                  <ActionButton label="Add comment" variant="secondary" />
                  <ActionButton label="Request more data" variant="secondary" />
                  <ActionButton label="Override hypothesis" variant="secondary" />
                  <ActionButton label="Escalate" variant="danger" />
                  <ActionButton label="Approve protocol" variant="primary" />
                </div>
                <p style={{ fontSize: '11px', color: '#8A8880', marginTop: '12px' }}>
                  Practitioner actions are coming in Phase 2.
                </p>
              </Section>

              {/* Trace metadata */}
              <div style={{ padding: '12px 14px', background: '#F4F3F0', borderRadius: '8px' }}>
                <p style={{ fontSize: '11px', color: '#8A8880', margin: 0, lineHeight: '1.7' }}>
                  Generated by: <strong>{trace.generated_by}</strong><br />
                  Trace status: <strong>{trace.status}</strong><br />
                  Created: <strong>{new Date(trace.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
                </p>
              </div>

            </div>
          </div>
        )}
      </div>
    </main>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatPill({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div style={{ padding: '8px 14px', background: alert ? '#FEF2F2' : '#F4F3F0', borderRadius: '8px', border: `1px solid ${alert ? '#FECACA' : '#E8E6E0'}` }}>
      <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#8A8880', margin: '0 0 2px', fontWeight: 600 }}>{label}</p>
      <p style={{ fontSize: '14px', fontWeight: 600, margin: 0, color: alert ? '#DC2626' : '#1A1917' }}>{value}</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#8A8880', marginBottom: '14px' }}>
        {title}
      </h2>
      {children}
    </div>
  )
}

function SnapshotCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '14px 16px', background: '#FFFFFF', border: '1px solid #E8E6E0', borderRadius: '8px' }}>
      <p style={{ fontSize: '11px', color: '#8A8880', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>{label}</p>
      <p style={{ fontSize: '15px', fontWeight: 500, margin: 0 }}>{value}</p>
    </div>
  )
}

interface EntryProps {
  entry: {
    id: string
    agent_name: string
    entry_type: string
    system_area: string | null
    content: string
    confidence: number | null
    priority: number | null
    visibility: string
  }
  index: number
}

function TimelineEntry({ entry, index }: EntryProps) {
  const isFirst = index === 0
  return (
    <div style={{ padding: '16px 18px', background: '#FFFFFF', borderRadius: isFirst ? '8px 8px 0 0' : index % 2 === 0 ? '0' : '0', border: '1px solid #E8E6E0', borderTopWidth: isFirst ? '1px' : '0', display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'start' }}>
      <div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <EntryTypeBadge type={entry.entry_type} />
          <span style={{ fontSize: '12px', color: '#8A8880' }}>{AGENT_LABELS[entry.agent_name] ?? entry.agent_name}</span>
          {entry.system_area && (
            <span style={{ fontSize: '11px', background: '#F4F3F0', padding: '2px 6px', borderRadius: '3px', color: '#555350' }}>
              {entry.system_area}
            </span>
          )}
          {entry.visibility !== 'practitioner' && (
            <span style={{ fontSize: '10px', background: '#EEF6FF', color: '#2563EB', padding: '1px 5px', borderRadius: '3px', border: '1px solid #BFDBFE' }}>
              {entry.visibility}
            </span>
          )}
        </div>
        <p style={{ fontSize: '14px', lineHeight: '1.6', margin: 0, color: '#1A1917' }}>{entry.content}</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
        {entry.priority && (
          <span style={{ fontSize: '11px', color: '#8A8880' }}>P{entry.priority}</span>
        )}
        <ConfidenceBar value={entry.confidence} />
      </div>
    </div>
  )
}

function ActionButton({ label, variant }: { label: string; variant: 'primary' | 'secondary' | 'danger' }) {
  const styles = {
    primary:   { background: '#1A1917', color: '#F8F6F2', border: '1px solid #1A1917' },
    secondary: { background: '#FFFFFF', color: '#1A1917', border: '1px solid #E8E6E0' },
    danger:    { background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' },
  }
  const s = styles[variant]
  return (
    <button
      disabled
      style={{ width: '100%', padding: '10px 14px', borderRadius: '7px', fontSize: '13px', fontWeight: 500, cursor: 'not-allowed', opacity: 0.6, textAlign: 'left', ...s }}
    >
      {label}
    </button>
  )
}

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
