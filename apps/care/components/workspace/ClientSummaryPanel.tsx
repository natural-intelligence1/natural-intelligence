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

// Remediation Task 2 — human-readable energy pattern for the workspace.
// Prefers the curve name; appends lowest-energy times when present.
// Returns null when neither field is populated (line is then hidden).
function energyPatternLabel(
  energyLowTimes: string[] | null,
  energyCurve:    string | null,
): string | null {
  const curveName: Record<string, string> = {
    morning_low:     'Morning low',
    afternoon_crash: 'Afternoon crash',
    evening_wired:   'Evening second wind',
    all_day_fatigue: 'All-day fatigue',
    fluctuating:     'Unpredictable',
    generally_good:  'Generally good',
  }
  const curve = energyCurve ? curveName[energyCurve] ?? null : null
  const lows  = (energyLowTimes ?? []).filter(Boolean)
  if (!curve && lows.length === 0) return null
  if (curve && lows.length) return `${curve} · lowest: ${lows.join(', ')}`
  if (curve) return curve
  return `Lowest: ${lows.join(', ')}`
}

// ─── Clinical context subsection ──────────────────────────────────────────────
// Quiet annotation at the bottom of the panel. ONLY surfaces biological_sex
// and clinical_notes_on_sex from practitioner_client_personalisation. religion
// and religious_content_preference are not in this view by design (PS
// architectural contract) — they have no path to be rendered here.
// Remediation Task 2 — also renders the energy-timing pattern (from intake,
// passed in via energyPattern) when present, same weight as the Sex line.
function ClinicalContext({
  personalisation,
  memberId,
  energyPattern,
}: {
  personalisation: ClientPersonalisation | null
  memberId:        string
  energyPattern?:  string | null
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

      {/* Energy pattern line — shown only when present. Same weight as Sex. */}
      {energyPattern && (
        <div style={{ fontSize: '13px', color: '#1A1917', marginBottom: '14px' }}>
          <span style={{ color: '#8A8880' }}>Energy pattern: </span>
          <span>{energyPattern}</span>
        </div>
      )}

      {/* Clinical note — inline edit affordance */}
      <ClinicalNoteEditor
        memberId={memberId}
        initialNote={personalisation?.clinicalNotesOnSex ?? null}
      />
    </div>
  )
}

// ─── Best Self Baseline subsection (Sprint B Phase 2) ─────────────────────────
// Renders the Chapter 2 Best Self answers as a labelled "BEST SELF" block.
// Visible only when at least one of the five Phase-2 fields is populated —
// graceful empty state (absent) when the client skipped the chapter.

function lastWellLabel(key: string | null): string | null {
  switch ((key ?? '').trim()) {
    case 'last_year':    return 'In the last year'
    case '1_3_years':    return '1–3 years ago'
    case '3_5_years':    return '3–5 years ago'
    case 'over_5_years': return 'More than 5 years ago'
    case 'not_sure':     return 'Not sure they ever have'
    default:             return key && key.trim() ? key : null
  }
}

function compareShort(key: string | null): string | null {
  switch ((key ?? '').trim()) {
    case 'better_than_now': return 'Better'
    case 'about_the_same':  return 'Same'
    case 'not_sure':        return 'Unsure'
    default:                return null
  }
}

function BestSelfSection({ summary }: { summary: IntakeSummary }) {
  const hasAny =
    !!summary.bestSelfDescription ||
    !!summary.bestSelfSleep ||
    !!summary.bestSelfEnergy ||
    !!summary.bestSelfMood ||
    !!summary.bestSelfRecoveryGoal
  if (!hasAny) return null

  const comparatives = [
    ['Sleep',  compareShort(summary.bestSelfSleep)],
    ['Energy', compareShort(summary.bestSelfEnergy)],
    ['Mood',   compareShort(summary.bestSelfMood)],
  ].filter(([, v]) => v) as [string, string][]

  const whenLabel = lastWellLabel(summary.timelineLastWell)

  return (
    <div style={{
      marginBottom:  '20px',
      paddingLeft:   '12px',
      borderLeft:    '3px solid #8FA68E',
      background:    '#F6F8F5',
      padding:       '10px 14px',
      borderRadius:  '0 6px 6px 0',
    }}>
      <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#7A8A78', marginBottom: '4px' }}>
        Best self {whenLabel ? `(${whenLabel.toLowerCase()})` : '(when last well)'}
      </div>
      {summary.bestSelfDescription && (
        <div style={{ fontSize: '13px', color: '#1A1917', lineHeight: '1.5', fontStyle: 'italic', marginBottom: comparatives.length || summary.bestSelfRecoveryGoal ? '8px' : 0 }}>
          &ldquo;{summary.bestSelfDescription}&rdquo;
        </div>
      )}
      {comparatives.length > 0 && (
        <div style={{ fontSize: '12px', color: '#4A4A46', marginBottom: summary.bestSelfRecoveryGoal ? '6px' : 0 }}>
          {comparatives.map(([k, v]) => `${k}: ${v}`).join('  ·  ')}
          <span style={{ color: '#9A9A94' }}>{'  '}(vs now)</span>
        </div>
      )}
      {summary.bestSelfRecoveryGoal && (
        <div style={{ fontSize: '12px', color: '#4A4A46' }}>
          <span style={{ color: '#7A8A78' }}>Most wants back: </span>
          <span style={{ fontStyle: 'italic', color: '#1A1917' }}>&ldquo;{summary.bestSelfRecoveryGoal}&rdquo;</span>
        </div>
      )}
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

      {/* Sprint B Phase 1 — signature question quoted verbatim under the
          client name. Renders only when populated (the question is not
          required; absence is itself signal). Read first by practitioners
          reading the case. */}
      {summary.mostWantToUnderstand && (
        <div style={{
          marginBottom:  '20px',
          paddingLeft:   '12px',
          borderLeft:    '3px solid #B8935A',
          background:    '#FAFAF9',
          padding:       '10px 14px',
          borderRadius:  '0 6px 6px 0',
        }}>
          <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#B0AEA8', marginBottom: '4px' }}>
            In their own words
          </div>
          <div style={{ fontSize: '13px', color: '#1A1917', lineHeight: '1.5', fontStyle: 'italic' }}>
            &ldquo;{summary.mostWantToUnderstand}&rdquo;
          </div>
        </div>
      )}

      {/* Sprint B Phase 2 — Best Self Baseline. Renders only when the client
          answered at least one of the five Chapter 2 fields. The "when last
          well" header line uses timelineLastWell (which predates Phase 2) but
          the section's visibility is gated on the new fields only — a client
          who only answered the timeline bucket still shows it under the
          structured grid below, not here. */}
      <BestSelfSection summary={summary} />

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
      <ClinicalContext
        personalisation={personalisation}
        memberId={memberId}
        energyPattern={energyPatternLabel(summary.energyLowTimes, summary.energyCurve)}
      />
    </CollapsibleSection>
  )
}
