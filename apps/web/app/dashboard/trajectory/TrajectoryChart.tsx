'use client'

import { useState } from 'react'

export interface TrajectoryPoint {
  date: string
  value: number
  zone: number | null
}

export interface MarkerData {
  key: string
  name: string
  unit: string | null
  points: TrajectoryPoint[]
  optimalLow: number | null
  optimalHigh: number | null
}

function zoneColor(zone: number | null): string {
  switch (zone) {
    case 1:           return '#C94040'
    case 2:           return '#D97B4F'
    case 3:           return '#D9C44F'
    case 4:           return '#4E7A5C'
    case 5:           return '#D97B4F'
    case 6:           return '#C94040'
    default:          return '#B8935A'
  }
}

function zoneLabel(zone: number | null): string {
  switch (zone) {
    case 1:  return 'Severely depleted'
    case 2:  return 'Below optimal'
    case 3:  return 'Sub-optimal'
    case 4:  return 'Optimal'
    case 5:  return 'Above optimal'
    case 6:  return 'Excess'
    default: return '—'
  }
}

// ─── Sparkline (60 × 20 SVG) ──────────────────────────────────────────────────

function Sparkline({ points }: { points: TrajectoryPoint[] }) {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
  if (sorted.length < 2) {
    return <div className="h-5 w-14 bg-surface-muted rounded" />
  }
  const W = 56, H = 20
  const vals = sorted.map(p => p.value)
  const yMin = Math.min(...vals)
  const yMax = Math.max(...vals)
  const yRange = yMax - yMin || 1
  const n = sorted.length
  const toX = (i: number) => (i / (n - 1)) * W
  const toY = (v: number) => H - ((v - yMin) / yRange) * (H - 4) - 2
  const pts = sorted.map((p, i) => `${toX(i).toFixed(1)},${toY(p.value).toFixed(1)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={56} height={20} className="overflow-visible">
      <polyline points={pts} fill="none" stroke="#B8935A" strokeWidth={1.5} strokeLinejoin="round" />
      <circle
        cx={toX(n - 1)} cy={toY(sorted[n - 1].value)} r={2.5}
        fill={zoneColor(sorted[n - 1].zone)}
      />
    </svg>
  )
}

// ─── Main SVG chart ───────────────────────────────────────────────────────────

function TrajectoryChartSVG({ marker }: { marker: MarkerData }) {
  const sorted = [...marker.points].sort((a, b) => a.date.localeCompare(b.date))

  if (sorted.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-sm text-text-muted">
        No data for this marker
      </div>
    )
  }

  const W = 480, H = 180
  const PAD = { t: 16, r: 16, b: 36, l: 52 }
  const cW = W - PAD.l - PAD.r
  const cH = H - PAD.t - PAD.b

  const vals = sorted.map(p => p.value)
  const rawMin = Math.min(...vals)
  const rawMax = Math.max(...vals)
  const margin = (rawMax - rawMin) * 0.2 || rawMax * 0.1 || 1
  const yMin = rawMin - margin
  const yMax = rawMax + margin

  const dates = sorted.map(p => new Date(p.date).getTime())
  const xMin = Math.min(...dates)
  const xMax = Math.max(...dates)
  const xRange = xMax - xMin || 1

  const toX = (d: string) => PAD.l + ((new Date(d).getTime() - xMin) / xRange) * cW
  const toY = (v: number) => PAD.t + (1 - (v - yMin) / (yMax - yMin)) * cH
  const polyPoints = sorted.map(p => `${toX(p.date).toFixed(1)},${toY(p.value).toFixed(1)}`).join(' ')

  const bandY1 = marker.optimalHigh !== null ? toY(marker.optimalHigh) : null
  const bandY2 = marker.optimalLow  !== null ? toY(marker.optimalLow)  : null
  const showBand = bandY1 !== null && bandY2 !== null

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => ({
    y:     PAD.t + (1 - t) * cH,
    label: (yMin + t * (yMax - yMin)).toFixed(1),
  }))

  const xIndices =
    sorted.length === 1 ? [0]
    : sorted.length <= 4 ? sorted.map((_, i) => i)
    : [0, Math.floor(sorted.length / 2), sorted.length - 1]

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible">
      {/* Optimal band */}
      {showBand && (
        <rect
          x={PAD.l} y={bandY1!}
          width={cW} height={Math.max(0, bandY2! - bandY1!)}
          fill="#B8935A" fillOpacity={0.1}
        />
      )}

      {/* Grid + Y-axis labels */}
      {yTicks.map((tick, i) => (
        <g key={i}>
          <line
            x1={PAD.l} y1={tick.y} x2={PAD.l + cW} y2={tick.y}
            stroke="#E8E5DF" strokeWidth={0.5}
          />
          <text x={PAD.l - 6} y={tick.y + 3.5} textAnchor="end" fontSize={9} fill="#8a8579">
            {tick.label}
          </text>
        </g>
      ))}

      {/* Unit on Y axis */}
      {marker.unit && (
        <text
          x={10} y={PAD.t + cH / 2}
          textAnchor="middle" fontSize={8} fill="#8a8579"
          transform={`rotate(-90, 10, ${PAD.t + cH / 2})`}
        >
          {marker.unit}
        </text>
      )}

      {/* Polyline */}
      {sorted.length > 1 && (
        <polyline
          points={polyPoints}
          fill="none"
          stroke="#B8935A"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}

      {/* Dots */}
      {sorted.map((p, i) => (
        <circle
          key={i}
          cx={toX(p.date)}
          cy={toY(p.value)}
          r={5}
          fill={zoneColor(p.zone)}
          stroke="#F8F6F2"
          strokeWidth={1.5}
        />
      ))}

      {/* X-axis date labels */}
      {xIndices.map(i => (
        <text
          key={i}
          x={toX(sorted[i].date)}
          y={H - 6}
          textAnchor="middle"
          fontSize={8}
          fill="#8a8579"
        >
          {fmt(sorted[i].date)}
        </text>
      ))}
    </svg>
  )
}

// ─── Public export ────────────────────────────────────────────────────────────

export function TrajectoryChart({ markers }: { markers: MarkerData[] }) {
  const [selectedKey, setSelectedKey] = useState(markers[0]?.key ?? '')
  const marker = markers.find(m => m.key === selectedKey) ?? markers[0]

  if (!marker) return null

  const sorted = [...marker.points].sort((a, b) => a.date.localeCompare(b.date))
  const latest = sorted[sorted.length - 1]

  return (
    <div>
      {/* Marker selector pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {markers.map(m => (
          <button
            key={m.key}
            type="button"
            onClick={() => setSelectedKey(m.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              selectedKey === m.key
                ? 'bg-brand-default text-text-inverted'
                : 'bg-surface-muted text-text-secondary hover:bg-surface-raised border border-border-default'
            }`}
          >
            {m.name}
          </button>
        ))}
      </div>

      {/* Main chart card */}
      <section className="rounded-xl border border-border-default bg-surface-raised p-5 mb-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">{marker.name}</h2>
            {latest && (
              <p className="text-xs text-text-muted mt-0.5">
                Latest:{' '}
                <span className="font-mono font-medium text-text-primary">
                  {latest.value} {marker.unit ?? ''}
                </span>
                {latest.zone !== null && (
                  <span className="ml-1.5" style={{ color: zoneColor(latest.zone) }}>
                    · {zoneLabel(latest.zone)}
                  </span>
                )}
              </p>
            )}
          </div>
          <span className="text-xs text-text-muted flex-shrink-0">
            {sorted.length} reading{sorted.length !== 1 ? 's' : ''}
          </span>
        </div>

        <TrajectoryChartSVG marker={marker} />

        {(marker.optimalLow !== null || marker.optimalHigh !== null) && (
          <div className="flex items-center gap-2 mt-3">
            <div
              className="w-8 h-2 rounded-sm"
              style={{ backgroundColor: '#B8935A', opacity: 0.3 }}
            />
            <span className="text-[10px] text-text-muted">
              Optimal range: {marker.optimalLow ?? '?'} – {marker.optimalHigh ?? '?'} {marker.unit ?? ''}
            </span>
          </div>
        )}
      </section>

      {/* Zone legend */}
      <section className="rounded-xl border border-border-default bg-surface-raised p-4 mb-5">
        <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">
          Functional zones
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[1, 2, 3, 4, 5, 6].map(zone => (
            <div key={zone} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: zoneColor(zone) }}
              />
              <span className="text-xs text-text-secondary">{zoneLabel(zone)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* All markers summary cards with sparklines */}
      <section>
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
          All markers
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {markers.map(m => {
            const mSorted = [...m.points].sort((a, b) => a.date.localeCompare(b.date))
            const mLatest = mSorted[mSorted.length - 1]
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setSelectedKey(m.key)}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  selectedKey === m.key
                    ? 'border-[#B8935A] bg-[#F8F1E4]'
                    : 'border-border-default bg-surface-raised hover:bg-surface-muted'
                }`}
              >
                <p className="text-xs font-medium text-text-primary truncate mb-0.5">{m.name}</p>
                {mLatest && (
                  <p className="text-[10px] text-text-muted font-mono mb-2">
                    {mLatest.value} {m.unit ?? ''}
                  </p>
                )}
                {mLatest?.zone != null && (
                  <div
                    className="text-[9px] font-medium mb-2 px-1.5 py-0.5 rounded-full inline-block"
                    style={{
                      backgroundColor: zoneColor(mLatest.zone) + '22',
                      color: zoneColor(mLatest.zone),
                    }}
                  >
                    {zoneLabel(mLatest.zone)}
                  </div>
                )}
                <Sparkline points={m.points} />
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
