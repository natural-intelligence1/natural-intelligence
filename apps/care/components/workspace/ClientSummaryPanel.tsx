// ─── ClientSummaryPanel ───────────────────────────────────────────────────────
// Renders structured intake data for the Client Summary workspace panel.
// Expanded by default (addendum S4).
// Data is pre-fetched by the workspace page and passed as props.

import type { IntakeSummary }       from '@natural-intelligence/db/practitioners'
import type { ClientPersonalisation } from '@natural-intelligence/db/personalisation'
import { CollapsibleSection }       from './CollapsibleSection'
import { ClinicalNoteEditor }       from './ClinicalNoteEditor'

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
  summary:        IntakeSummary | null
  clientName:     string
  memberId:       string
  personalisation: ClientPersonalisation | null
}

// ─── Clinical context subsection ──────────────────────────────────────────────
// Quiet annotation at the bottom of the panel. ONLY surfaces biological_sex
// and clinical_notes_on_sex from practitioner_client_personalisation. religion
// and religious_content_preference are not in this view by design (PS
// architectural contract) — they have no path to be rendered here.
function ClinicalContext({
  personalisation,
  memberId,
}: {
  personalisation: ClientPersonalisation | null
  memberId:        string
}) {
  const sexLabel = personalisation?.biologicalSex === 'male'   ? 'Male'
                : personalisation?.biologicalSex === 'female' ? 'Female'
                : 'Not recorded'

  return (
    <div style={{
      marginTop:    '24px',
      paddingTop:   '16px',
      borderTop:    '1px solid #E8E6E0',
    }}>
      <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#B0AEA8', marginBottom: '10px' }}>
        Clinical context
      </div>

      {/* Sex line — always shown, even when null (rendered as "Not recorded") */}
      <div style={{ fontSize: '13px', color: '#1A1917', marginBottom: '14px' }}>
        <span style={{ color: '#8A8880' }}>Sex: </span>
        <span style={{ color: personalisation?.biologicalSex ? '#1A1917' : '#B0AEA8' }}>
          {sexLabel}
        </span>
      </div>

      {/* Clinical note — inline edit affordance */}
      <ClinicalNoteEditor
        memberId={memberId}
        initialNote={personalisation?.clinicalNotesOnSex ?? null}
      />
    </div>
  )
}

export function ClientSummaryPanel({ summary, clientName, memberId, personalisation }: ClientSummaryPanelProps) {
  if (!summary) {
    return (
      <CollapsibleSection id="client-summary" title="Client Summary" defaultExpanded>
        <p style={{ fontSize: '13px', color: '#B0AEA8' }}>No intake data recorded for this client.</p>
        <ClinicalContext personalisation={personalisation} memberId={memberId} />
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

      {/* Clinical context — quiet annotation at the bottom */}
      <ClinicalContext personalisation={personalisation} memberId={memberId} />
    </CollapsibleSection>
  )
}
