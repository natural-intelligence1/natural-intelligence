'use client'

import { useEffect, useRef } from 'react'

export interface SpherePoint {
  theta:      number
  phi:        number
  confidence: number
  colour:     string
  name:       string
}

const CX = 140
const CY = 140
const R  = 100

function project(theta: number, phi: number): [number, number] {
  return [
    CX + R * Math.sin(theta) * Math.cos(phi),
    CY - R * Math.cos(theta),
  ]
}

function getTargetAngle(theta: number, phi: number): number {
  const [x, y] = project(theta, phi)
  return Math.atan2(x - CX, CY - y) * (180 / Math.PI)
}

export function BlochSphere({ points }: { points: SpherePoint[] }) {
  const needleRef   = useRef<SVGLineElement>(null)
  const rafRef      = useRef<number>(0)
  const startRef    = useRef<number | null>(null)
  const angleRef    = useRef<number>(0)

  // Dominant = within 80% of top confidence
  const topConf    = points[0]?.confidence ?? 1
  const dominant   = points.filter((p) => p.confidence >= topConf * 0.8)

  useEffect(() => {
    const needle = needleRef.current
    if (!needle || points.length === 0) return

    const setNeedle = (angleDeg: number) => {
      angleRef.current = angleDeg
      const rad = (angleDeg * Math.PI) / 180
      needle.setAttribute('x2', String(CX + 75 * Math.sin(rad)))
      needle.setAttribute('y2', String(CY - 75 * Math.cos(rad)))
    }

    if (dominant.length === 1) {
      // Ease-out to static
      const target  = getTargetAngle(dominant[0].theta, dominant[0].phi)
      const initial = angleRef.current
      const duration = 1500

      const animate = (ts: number) => {
        if (!startRef.current) startRef.current = ts
        const elapsed = ts - startRef.current
        const t       = Math.min(elapsed / duration, 1)
        const ease    = 1 - Math.pow(1 - t, 3)
        setNeedle(initial + (target - initial) * ease)
        if (t < 1) rafRef.current = requestAnimationFrame(animate)
      }
      rafRef.current = requestAnimationFrame(animate)

    } else if (dominant.length === 2) {
      // Sinusoidal blend between two angles
      const a1 = getTargetAngle(dominant[0].theta, dominant[0].phi)
      const a2 = getTargetAngle(dominant[1].theta, dominant[1].phi)

      const animate = (ts: number) => {
        if (!startRef.current) startRef.current = ts
        const elapsed = (ts - startRef.current) / 1000
        const blend   = (1 + Math.sin(elapsed * 0.57)) / 2   // period ≈ 11 s
        setNeedle(a1 + (a2 - a1) * blend)
        rafRef.current = requestAnimationFrame(animate)
      }
      rafRef.current = requestAnimationFrame(animate)

    } else {
      // Slow sequential cycle (4 s per cause)
      const period = 4000

      const animate = (ts: number) => {
        if (!startRef.current) startRef.current = ts
        const elapsed = ts - startRef.current
        const idx     = Math.floor((elapsed / period) % dominant.length)
        setNeedle(getTargetAngle(dominant[idx].theta, dominant[idx].phi))
        rafRef.current = requestAnimationFrame(animate)
      }
      rafRef.current = requestAnimationFrame(animate)
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      startRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Initial static needle position (before rAF kicks in)
  const initAngle = getTargetAngle(
    points[0]?.theta ?? Math.PI / 2,
    points[0]?.phi   ?? 0
  )
  const initRad   = (initAngle * Math.PI) / 180

  return (
    <svg
      width="280"
      height="280"
      viewBox="0 0 280 280"
      className="flex-shrink-0"
      aria-label="Bloch sphere showing root cause positions"
    >
      {/* Outer circle */}
      <circle cx={CX} cy={CY} r={R} stroke="#2a2925" strokeWidth="1.5" fill="none" />

      {/* Equator ellipse (dashed) */}
      <ellipse
        cx={CX} cy={CY}
        rx={R} ry={R * 0.28}
        stroke="#2a2925" strokeWidth="1"
        fill="none" strokeDasharray="4 3"
      />

      {/* Vertical axis line */}
      <line x1={CX} y1={CY - R} x2={CX} y2={CY + R} stroke="#2a2925" strokeWidth="1" />

      {/* Root cause dots */}
      {points.map((p, i) => {
        const [px, py] = project(p.theta, p.phi)
        return (
          <g key={i}>
            {i === 0 && (
              <circle cx={px} cy={py} r={13} fill="none" stroke={p.colour} strokeWidth="1.5" opacity="0.35" />
            )}
            <circle
              cx={px}
              cy={py}
              r={i === 0 ? 7 : 4}
              fill={p.colour}
              opacity={i === 0 ? 1 : 0.55}
            />
          </g>
        )
      })}

      {/* Needle */}
      <line
        ref={needleRef}
        x1={CX}
        y1={CY}
        x2={CX + 75 * Math.sin(initRad)}
        y2={CY - 75 * Math.cos(initRad)}
        stroke="#F8F6F2"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Needle pivot */}
      <circle cx={CX} cy={CY} r={3} fill="#F8F6F2" />

      {/* Axis labels */}
      <text x={CX} y={CY - R - 8}   textAnchor="middle" fill="#4a4840" fontSize="10">N</text>
      <text x={CX} y={CY + R + 16}  textAnchor="middle" fill="#4a4840" fontSize="10">S</text>
    </svg>
  )
}
