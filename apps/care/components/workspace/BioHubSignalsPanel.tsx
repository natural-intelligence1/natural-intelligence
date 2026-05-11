// ─── BioHubSignalsPanel ───────────────────────────────────────────────────────
// Biomarker results from lab uploads. Collapsed by default (addendum S4).
// Empty state: muted "None recorded" subline, no expand affordance (S4).
// Raw values only — practitioners apply clinical judgement.

import type { BioHubSignal } from '@natural-intelligence/db/practitioners'
import { CollapsibleSection } from './CollapsibleSection'

// functional_zone: 1=optimal, 2=normal, 3=borderline, 4=high, 5=critical
const ZONE_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Optimal',    color: '#15803D' },
  2: { label: 'Normal',     color: '#8A8880' },
  3: { label: 'Borderline', color: '#D97706' },
  4: { label: 'High',       color: '#DC2626' },
  5: { label: 'Critical',   color: '#7F1D1D' },
}

function RangeBar({ value, low, high }: { value: number | null; low: number | null; high: number | null }) {
  if (value === null || low === null || high === null) return null
  const range   = high - low
  if (range <= 0) return null
  const pct     = Math.min(100, Math.max(0, ((value - low) / range) * 100))
  const inRange = value >= low && value <= high
  return (
    <div style={{ position: 'relative', height: '4px', background: '#E8E6E0', borderRadius: '2px', marginTop: '4px', width: '80px' }}>
      <div style={{ position: 'absolute', left: `${pct}%`, top: '-3px', width: '10px', height: '10px', background: inRange ? '#15803D' : '#DC2626', borderRadius: '50%', transform: 'translateX(-50%)' }} />
    </div>
  )
}

interface BioHubSignalsPanelProps {
  signals: BioHubSignal[]
}

export function BioHubSignalsPanel({ signals }: BioHubSignalsPanelProps) {
  const count = signals.length

  if (count === 0) {
    return (
      <CollapsibleSection
        id="biohub"
        title="Lab Signals"
        defaultExpanded={false}
        emptyState="No lab data"
      >
        <></>
      </CollapsibleSection>
    )
  }

  const subtitle = `${count} marker${count === 1 ? '' : 's'}`

  return (
    <CollapsibleSection id="biohub" title="Lab Signals" subtitle={subtitle} defaultExpanded={false}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #E8E6E0' }}>
              {['Marker', 'Value', 'Unit', 'GP Range', 'NI Optimal', 'Status', 'Date'].map(h => (
                <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#B0AEA8' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {signals.map(s => {
              const zone    = s.functionalZone ? ZONE_LABELS[s.functionalZone] : null
              const inRange = s.value !== null && s.gpRangeLow !== null && s.gpRangeHigh !== null
                ? s.value >= s.gpRangeLow && s.value <= s.gpRangeHigh
                : null
              return (
                <tr key={s.id} style={{ borderBottom: '1px solid #F4F3F0' }}>
                  <td style={{ padding: '8px', fontWeight: 500, color: '#1A1917' }}>{s.markerName}</td>
                  <td style={{ padding: '8px', color: inRange === false ? '#DC2626' : '#1A1917', fontWeight: inRange === false ? 600 : 400 }}>
                    {s.value ?? '—'}
                  </td>
                  <td style={{ padding: '8px', color: '#8A8880' }}>{s.unit ?? '—'}</td>
                  <td style={{ padding: '8px', color: '#8A8880' }}>
                    {s.gpRangeLow !== null && s.gpRangeHigh !== null
                      ? `${s.gpRangeLow}–${s.gpRangeHigh}`
                      : '—'}
                    <RangeBar value={s.value} low={s.gpRangeLow} high={s.gpRangeHigh} />
                  </td>
                  <td style={{ padding: '8px', color: '#8A8880' }}>
                    {s.niOptimalLow !== null && s.niOptimalHigh !== null
                      ? `${s.niOptimalLow}–${s.niOptimalHigh}`
                      : '—'}
                  </td>
                  <td style={{ padding: '8px' }}>
                    {zone ? (
                      <span style={{ fontSize: '10px', fontWeight: 600, color: zone.color }}>
                        {zone.label}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '8px', color: '#B0AEA8' }}>
                    {s.reportDate
                      ? new Date(s.reportDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                      : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </CollapsibleSection>
  )
}
