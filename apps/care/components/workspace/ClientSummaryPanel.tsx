// ─── ClientSummaryPanel ───────────────────────────────────────────────────────
// Renders structured intake data for the Client Summary workspace panel.
// Expanded by default (addendum S4).
// Data is pre-fetched by the workspace page and passed as props.

import type { IntakeSummary } from '@natural-intelligence/db/practitioners'
import { CollapsibleSection } from './CollapsibleSection'

function Field({ label, value, highlight }: { label: string; value: string | null | undefined; highlight?: boolean }) {
  if (!value) return null
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#B0AEA8', marginBottom: '2px' }}>
        {label}
      </div>
      <div style={{
        fontSize: '14px',
        color: highlight ? '#DC2626' : '#1A1917',
        fontWeight: highlight ? 600 : 400,
        background: highlight ? '#FEF2F2' : 'transparent',
        padding: highlight ? '2px 6px' : undefined,
        borderRadius: highlight ? '4px' : undefined,
        display: highlight ? 'inline-block' : undefined,
      }}>
        {value}
      </div>
    </div>
  )
}

function ScoreField({ label, value, max }: { label: string; value: number | null; max: number }) {
  if (value === null) return null
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#B0AEA8', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ flex: 1, height: '6px', background: '#E8E6E0', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(value / max) * 100}%`, background: '#B8935A', borderRadius: '3px' }} />
        </div>
        <span style={{ fontSize: '13px', color: '#1A1917', fontWeight: 500, minWidth: '40px' }}>
          {value}/{max}
        </span>
      </div>
    </div>
  )
}

interface ClientSummaryPanelProps {
  summary:    IntakeSummary | null
  clientName: string
}

export function ClientSummaryPanel({ summary, clientName }: ClientSummaryPanelProps) {
  if (!summary) {
    return (
      <CollapsibleSection id="client-summary" title="Client Summary" defaultExpanded>
        <p style={{ fontSize: '13px', color: '#B0AEA8' }}>No intake data recorded for this client.</p>
      </CollapsibleSection>
    )
  }

  const pexLabel = summary.postExertionalWorsening === true
    ? 'Yes — post-exertional worsening reported'
    : summary.postExertionalWorsening === false
      ? 'No'
      : null

  return (
    <CollapsibleSection id="client-summary" title="Client Summary" defaultExpanded>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>

        {/* Left column */}
        <div>
          <Field label="Client" value={clientName} />
          <Field label="Arrival emotion" value={summary.arrivalEmotion} />
          <Field label="Primary concerns" value={summary.primaryConcerns?.join(', ')} />
          <Field label="Primary system" value={summary.primarySystem} />
          <Field label="Symptom onset" value={summary.symptomOnset} />
          <Field label="Last felt well" value={summary.timelineLastWell} />
          <Field label="Trigger" value={summary.timelineTrigger} />
          <Field
            label="Post-exertional worsening"
            value={pexLabel}
            highlight={summary.postExertionalWorsening === true}
          />
          <Field label="Diagnosed conditions" value={summary.diagnosedConditions?.join(', ')} />
        </div>

        {/* Right column */}
        <div>
          {summary.concernSeverity !== null && (
            <ScoreField label="Symptom severity" value={summary.concernSeverity} max={10} />
          )}
          <ScoreField label="Stress level" value={summary.stressLevel}   max={10} />
          <ScoreField label="Sleep quality"  value={summary.sleepQuality} max={10} />
          <ScoreField label="Energy level"   value={summary.energyLevel}  max={10} />
          <Field label="Diet" value={summary.dietDescription} />
          <Field label="Medications" value={summary.currentMedications} />
          <Field label="Supplements" value={summary.currentSupplements} />
        </div>
      </div>
    </CollapsibleSection>
  )
}
