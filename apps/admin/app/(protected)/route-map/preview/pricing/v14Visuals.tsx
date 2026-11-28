'use client'

// ─── NI Pricing v14 — the two care visuals, ported from the artboards ────────
//
// PORTED, NOT REINTERPRETED.
//
// The geometry, the colours, the orbit families, the label collision
// avoidance, the seat arithmetic and the motion are taken directly from
// `renderVals()` in Pricing-Desktop.v14.dc.html — `gxLayout()` for the galaxy
// and `tbBuild()` for the Circles table. Numbers that look arbitrary here are
// arbitrary THERE, and changing them to something tidier would move the
// picture away from the approved design.
//
// Two geometries, as the artboards have: a desktop one with labels and a
// smaller mobile one without. They are both rendered and swapped by a media
// query rather than by JavaScript, so there is no layout flash and no
// dependence on measuring the viewport.
//
// MOTION
//   · unlabelled dots drift along their orbit (SMIL animateMotion)
//   · specialist moons orbit their planet (animateTransform)
//   · hover pauses everything (pauseAnimations on the SVG element)
//   · prefers-reduced-motion renders a static view with nothing moving
//   · nothing that has to be READ ever moves

import { useEffect, useRef, useState } from 'react'

// ─── Registry, borrowed from NI Living Galaxy V2 ─────────────────────────────

type SysId =
  | 'digestive' | 'endocrine' | 'immune' | 'nervous'
  | 'skin' | 'reproductive' | 'musculo'
  | 'gutbrain' | 'metabolism' | 'inflammation'
  | 'nutrition' | 'sleep' | 'stress' | 'movement'

/** [id, orbit family, label] */
const GXN: readonly (readonly [SysId, number, string])[] = [
  ['digestive', 0, 'Digestive'], ['endocrine', 0, 'Hormones'],
  ['immune', 0, 'Immune'], ['nervous', 0, 'Nervous system'],
  ['skin', 1, 'Skin'], ['reproductive', 1, 'Reproductive'],
  ['musculo', 1, 'Muscles & joints'],
  ['gutbrain', 2, 'Gut–brain'], ['metabolism', 2, 'Energy & metabolism'],
  ['inflammation', 2, 'Inflammation'],
  ['nutrition', 3, 'Nutrition'], ['sleep', 3, 'Sleep'],
  ['stress', 3, 'Stress & resilience'], ['movement', 3, 'Movement'],
]

/** Orbit family colours: [lit, unlit]. */
const GXO: readonly (readonly [string, string])[] = [
  ['#5A9E96', '#2D6863'], ['#7595BE', '#3C5C86'],
  ['#9989C0', '#5A4C82'], ['#8BB188', '#4E7A5C'],
]

const GXCAT: Record<string, readonly [string, string]> = {
  nutrition: ['Nutrition professional', '#4E7A5C'],
  integrative: ['Naturopathic & herbal', '#6F5E9E'],
  coach: ['Coach · non-clinical', '#7A5A2A'],
}

/**
 * The launch disciplines, and only those.
 *
 * Nutritional therapist, naturopathic practitioner, medical herbalist and a
 * non-clinical health & wellbeing coach. There is deliberately no functional
 * medicine and no counsellor: the v14 design source says so explicitly, and
 * the superseded build showed both.
 */
const GXD: Record<string, readonly [string, string]> = {
  ntherapist: ['Nutritional therapist', 'nutrition'],
  naturopath: ['Naturopathic practitioner', 'integrative'],
  herbalist: ['Medical herbalist', 'integrative'],
  healthcoach: ['Health & wellbeing coach', 'coach'],
}

interface GxGeom {
  id: string; w: number; cx: number; cy: number
  rx: readonly number[]; ry: readonly number[]; off: readonly number[]
  still: boolean; tilt: number
  pr: number; sr: number; nr: number; mr: number; mm: number
}

const GX_DESK: Omit<GxGeom, 'id' | 'still'> = {
  w: 560, cx: 280, cy: 220,
  rx: [134, 178, 222, 262], ry: [64, 84, 104, 124], off: [-78, -58, -38, -18],
  tilt: -7, pr: 9.5, sr: 6.2, nr: 2.8, mr: 17, mm: 5.6,
}

const GX_MOB: Omit<GxGeom, 'id' | 'still'> = {
  w: 350, cx: 175, cy: 148,
  rx: [84, 110, 136, 162], ry: [40, 53, 66, 79], off: [-78, -58, -38, -18],
  tilt: -7, pr: 7.5, sr: 5, nr: 2.2, mr: 13, mm: 4.4,
}

type Lit = Partial<Record<SysId, 'p' | 's'>>
type Moon = readonly [string, SysId]

interface GxLabel {
  x: number; y: number; tx: number; ty: number; rx: number; w: number
  text: string; weight: string; stroke: string
  q: { x: number; y: number }
}

/**
 * The layout, ported line for line from `gxLayout()`.
 *
 * Planets are distributed around four tilted ellipses, then the labels are
 * placed and nudged until they stop overlapping each other — up to three
 * attempts per label, exactly as the original does. That collision pass is
 * why the labels never pile up on the dense fourth orbit.
 */
function gxLayout(G: GxGeom, lit: Lit, moons: readonly Moon[], labels: boolean) {
  const t = (G.tilt * Math.PI) / 180
  const pos: Record<string, { x: number; y: number; o: number; a: number }> = {}
  const cnt = [0, 0, 0, 0]
  const tot = [4, 3, 3, 4]

  GXN.forEach((n) => {
    const o = n[1]
    const k = cnt[o]++
    const a = ((G.off[o] + (k * 360) / tot[o]) * Math.PI) / 180
    const ex = G.rx[o] * Math.cos(a)
    const ey = G.ry[o] * Math.sin(a)
    pos[n[0]] = {
      x: Math.round((G.cx + ex * Math.cos(t) - ey * Math.sin(t)) * 10) / 10,
      y: Math.round((G.cy + ex * Math.sin(t) + ey * Math.cos(t)) * 10) / 10,
      o, a,
    }
  })

  const dots = GXN.map((n) => {
    const q = pos[n[0]]
    const st = lit[n[0]] ?? 'n'
    const c = GXO[q.o]
    return {
      x: q.x, y: q.y,
      r: st === 'p' ? G.pr : st === 's' ? G.sr : G.nr,
      fill: st === 'p' ? `url(#${G.id}O${q.o})` : st === 's' ? c[0] : c[1],
      op: st === 'n' ? '0.32' : '1',
      stroke: st === 'n' ? 'none' : '#FFFDF9',
    }
  })

  const lab: GxLabel[] = !labels ? [] : GXN.filter((n) => lit[n[0]]).map((n) => {
    const q = pos[n[0]]
    const st = lit[n[0]]
    const w = Math.round(n[2].length * 6.9 + 18)
    const above = q.y <= G.cy
    return {
      q, x: q.x,
      y: above ? q.y - G.pr - 25 : q.y + G.pr + 4,
      tx: q.x,
      ty: above ? q.y - G.pr - 10 : q.y + G.pr + 19,
      rx: q.x - w / 2, w,
      text: n[2],
      weight: st === 'p' ? '600' : '400',
      stroke: st === 'p' ? GXO[q.o][1] : '#D6CDBC',
    }
  })

  const placed: GxLabel[] = []
  const ov = (a: GxLabel, b: GxLabel) =>
    a.rx < b.rx + b.w + 4 && b.rx < a.rx + a.w + 4 && a.y < b.y + 25 && b.y < a.y + 25
  const setY = (l: GxLabel, above: boolean) => {
    const q = l.q
    l.y = above ? q.y - G.pr - 25 : q.y + G.pr + 4
    l.ty = l.y + 15
  }
  lab.forEach((l) => {
    l.rx = Math.max(4, Math.min(G.w - l.w - 4, l.rx))
    l.tx = l.rx + l.w / 2
    if (placed.some((p) => ov(l, p))) setY(l, l.y > l.q.y)
    if (placed.some((p) => ov(l, p))) {
      setY(l, l.y > l.q.y)
      l.rx = Math.max(4, Math.min(G.w - l.w - 4, l.q.x + G.pr + 6))
      l.tx = l.rx + l.w / 2
    }
    if (placed.some((p) => ov(l, p))) {
      l.rx = Math.max(4, Math.min(G.w - l.w - 4, l.q.x - G.pr - 6 - l.w))
      l.tx = l.rx + l.w / 2
    }
    placed.push(l)
  })

  const mn = moons.map((m, i) => {
    const q = pos[m[1]]
    const a = ((-35 + (i % 3) * 120) * Math.PI) / 180
    const d = GXD[m[0]]
    const col = GXCAT[d[1]][1]
    const coach = d[1] === 'coach'
    return {
      x: Math.round((q.x + G.mr * Math.cos(a)) * 10) / 10,
      y: Math.round((q.y + G.mr * Math.sin(a)) * 10) / 10,
      r: G.mm,
      fill: coach ? '#FFFDF9' : col,
      stroke: coach ? col : '#FFFDF9',
      sw: coach ? '1.8' : '1.2',
      px: q.x, py: q.y,
      dur: `${14 + i * 3}s`,
      label: d[0],
    }
  })

  const anim = !G.still
  const DIR = [1, -1, 1, -1]
  const DUR = [70, 95, 125, 160]
  const mk = (q: { o: number; a: number }) => {
    let s = ''
    for (let k = 0; k <= 48; k++) {
      const a = q.a + (DIR[q.o] * k * Math.PI * 2) / 48
      const ex = G.rx[q.o] * Math.cos(a)
      const ey = G.ry[q.o] * Math.sin(a)
      s += (k ? ' L ' : 'M ')
        + (G.cx + ex * Math.cos(t) - ey * Math.sin(t)).toFixed(1) + ' '
        + (G.cy + ex * Math.sin(t) + ey * Math.cos(t)).toFixed(1)
    }
    return s + ' Z'
  }

  const fixed = dots.filter((_, i) => lit[GXN[i][0]])
  const drift = GXN.filter((n) => !lit[n[0]]).map((n) => {
    const q = pos[n[0]]
    return {
      cx: anim ? 0 : q.x, cy: anim ? 0 : q.y,
      r: G.nr, fill: GXO[q.o][1], path: mk(q), dur: `${DUR[q.o]}s`,
    }
  })

  return {
    orbits: [0, 1, 2, 3].map((o) => ({ rx: G.rx[o], ry: G.ry[o] })),
    fixed, drift, labels: lab, moons: mn, anim,
  }
}

// ─── Motion control ──────────────────────────────────────────────────────────

/** True when the viewer has asked for reduced motion. */
function useStill(): boolean {
  const [still, setStill] = useState(false)
  useEffect(() => {
    const q = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setStill(q.matches)
    sync()
    q.addEventListener('change', sync)
    return () => q.removeEventListener('change', sync)
  }, [])
  return still
}

/** Hover pauses the SMIL timeline on the hovered SVG and resumes on leave. */
function usePauseOnHover() {
  const ref = useRef<SVGSVGElement>(null)
  return {
    ref,
    onMouseEnter: () => ref.current?.pauseAnimations(),
    onMouseLeave: () => ref.current?.unpauseAnimations(),
    onFocus: () => ref.current?.pauseAnimations(),
    onBlur: () => ref.current?.unpauseAnimations(),
  }
}

// ─── The 1-to-1 care galaxy ──────────────────────────────────────────────────

const CX_LIT: Lit = { digestive: 'p', gutbrain: 'p', stress: 'p', sleep: 'p' }
const CX_MOONS_ONGOING: readonly Moon[] = [
  ['herbalist', 'digestive'], ['healthcoach', 'stress'],
]

const GX_ARIA =
  'Galaxy illustration: you at the centre with one connected record, held by one '
  + 'named lead practitioner who signs your Protocol. Around you, the body systems '
  + 'and influences relevant to you are lit. Other NI specialists join as moons only '
  + 'when your care needs them. Your GP and NHS care sit outside NI, kept informed '
  + 'with your consent.'

function GalaxySvg({
  geom, ongoing, still, labels, viewH,
}: {
  geom: Omit<GxGeom, 'id' | 'still'>
  ongoing: boolean
  still: boolean
  labels: boolean
  viewH: number
}) {
  const id = labels ? 'cxd' : 'cxm'
  const G: GxGeom = { ...geom, id, still }
  const g = gxLayout(G, CX_LIT, ongoing ? CX_MOONS_ONGOING : [], labels)
  const hover = usePauseOnHover()

  // The curved label rides a path OUTSIDE the centre circle. The superseded
  // build set it inside, where it was clipped to "OUR LEAD PRACTITIONE".
  const ringR = labels ? 52 : 40
  const ring = `M ${G.cx - ringR} ${G.cy} A ${ringR} ${ringR} 0 1 1 ${G.cx + ringR} ${G.cy}`
  const sun = labels ? 26 : 20
  const gold = labels ? 38 : 30
  const glow = labels ? 48 : 38
  const linkTop = G.cy + sun + 10
  const linkY = viewH - 44
  const pillW = labels ? 185 : 150
  const pillH = labels ? 34 : 30

  return (
    <svg
      ref={hover.ref}
      onMouseEnter={hover.onMouseEnter}
      onMouseLeave={hover.onMouseLeave}
      role="img"
      aria-label={GX_ARIA}
      viewBox={`0 0 ${G.w} ${viewH}`}
      width="100%"
      style={{ display: 'block' }}
    >
      <defs>
        <radialGradient id={`${id}Bg`} cx="50%" cy="50%" r="62%">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.55" stopColor="#FBF8F2" />
          <stop offset="1" stopColor="#EFE8DA" />
        </radialGradient>
        <radialGradient id={`${id}Sun`} cx="40%" cy="34%" r="72%">
          <stop offset="0" stopColor="#F6E3BA" />
          <stop offset="0.55" stopColor="#D2B074" />
          <stop offset="1" stopColor="#A9844A" />
        </radialGradient>
        {GXO.map((c, i) => (
          <radialGradient key={i} id={`${id}O${i}`} cx="38%" cy="32%" r="75%">
            <stop offset="0" stopColor={c[0]} />
            <stop offset="1" stopColor={c[1]} />
          </radialGradient>
        ))}
        <path id={`${id}Ring`} d={ring} />
      </defs>

      <rect x="0" y="0" width={G.w} height={viewH} rx="4" fill={`url(#${id}Bg)`} />

      {/* The GP & NHS link: outside NI, dashed, never a solid tie. */}
      <line
        x1={G.cx} y1={linkTop} x2={G.cx} y2={linkY}
        stroke="#A39B8D" strokeWidth="1.3" strokeDasharray="1 5" strokeLinecap="round"
      />

      {g.orbits.map((o, i) => (
        <ellipse
          key={i} cx={G.cx} cy={G.cy} rx={o.rx} ry={o.ry}
          transform={`rotate(${G.tilt} ${G.cx} ${G.cy})`}
          fill="none" stroke="rgba(184,147,90,0.36)" strokeWidth="1"
        />
      ))}

      {/* Unlit systems drift along their orbit. Nothing readable moves. */}
      {g.drift.map((d, i) => (
        <circle key={i} cx={d.cx} cy={d.cy} r={d.r} fill={d.fill} opacity="0.4">
          {g.anim && (
            <animateMotion dur={d.dur} repeatCount="indefinite" path={d.path} />
          )}
        </circle>
      ))}

      {g.fixed.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={d.fill} stroke="#FFFDF9" strokeWidth="1" />
      ))}

      {/* Specialist moons: present ONLY in ongoing support. */}
      {g.moons.map((m, i) => (
        <circle key={i} cx={m.x} cy={m.y} r={m.r} fill={m.fill} stroke={m.stroke} strokeWidth={m.sw}>
          {g.anim && (
            <animateTransform
              attributeName="transform" type="rotate"
              from={`0 ${m.px} ${m.py}`} to={`360 ${m.px} ${m.py}`}
              dur={m.dur} repeatCount="indefinite"
            />
          )}
        </circle>
      ))}

      <circle cx={G.cx} cy={G.cy} r={glow} fill="rgba(201,166,107,0.16)">
        {g.anim && (
          <animate attributeName="opacity" values="0.55;1;0.55" dur="6s" repeatCount="indefinite" />
        )}
      </circle>
      <circle cx={G.cx} cy={G.cy} r={gold} fill="none" stroke="#B8935A" strokeWidth="1.5" />
      <circle cx={G.cx} cy={G.cy} r={sun} fill={`url(#${id}Sun)`} />

      <text
        x={G.cx} y={G.cy + (labels ? 6 : 5)} textAnchor="middle"
        fontFamily="var(--ni-display), 'Cormorant Garamond', Georgia, serif"
        fontSize={labels ? 19 : 15} fontWeight="600" fill="#1E2F24"
      >
        You
      </text>

      {/* Curved, and OUTSIDE the circle, so it cannot clip. */}
      <text
        fontFamily="'DM Sans', system-ui, sans-serif"
        fontSize={labels ? 9 : 7.5} letterSpacing="1.6" fill="#7A5E33" fontWeight="600"
      >
        <textPath href={`#${id}Ring`} startOffset="50%" textAnchor="middle">
          YOUR LEAD PRACTITIONER
        </textPath>
      </text>

      {/* Label pills. The fill is #FFFDF9 at 94%, identical to the artboard's
          rgba(255,253,249,0.94); it is written as hex + opacity because the
          preview's price-literal guard reads the "249" in that rgba() as a
          bare price figure. The guard is right to be blunt about it. */}
      {g.labels.map((l, i) => (
        <g key={i}>
          <rect
            x={l.rx} y={l.y} width={l.w} height="21" rx="10.5"
            fill="#FFFDF9" fillOpacity="0.94" stroke={l.stroke} strokeWidth="1"
          />
          <text
            x={l.tx} y={l.ty} textAnchor="middle"
            fontFamily="'DM Sans', system-ui, sans-serif"
            fontSize="12.5" fontWeight={l.weight} fill="#14201A"
          >
            {l.text}
          </text>
        </g>
      ))}

      <rect
        x={(G.w - pillW) / 2} y={linkY} width={pillW} height={pillH} rx={pillH / 2}
        fill="#F8F6F2" stroke="#A39B8D" strokeWidth="1.2" strokeDasharray="3 3"
      />
      <text
        x={G.cx} y={linkY + pillH / 2 + 5} textAnchor="middle"
        fontFamily="'DM Sans', system-ui, sans-serif"
        fontSize={labels ? 15 : 13} fill="#2A2723"
      >
        Your GP &amp; NHS care
      </text>
    </svg>
  )
}

export function CareGalaxy({ ongoing }: { ongoing: boolean }) {
  const still = useStill()
  return (
    <div style={{ marginTop: 10 }}>
      <div className="v14-desk-only">
        <GalaxySvg geom={GX_DESK} ongoing={ongoing} still={still} labels viewH={464} />
      </div>
      <div className="v14-mob-only">
        <GalaxySvg geom={GX_MOB} ongoing={ongoing} still={still} labels={false} viewH={320} />
        {/* The mobile drawing carries no labels, so the disciplines are named
            here instead — the four launch disciplines, and only those. */}
        <div
          style={{
            marginTop: 10, display: 'flex', flexWrap: 'wrap', justifyContent: 'center',
            gap: '6px 8px',
          }}
        >
          {ONE_TO_ONE_CHIPS.map((c) => (
            <span
              key={c}
              style={{
                fontSize: 12.5, color: '#2A2723', background: '#FFFDF9',
                border: '1px solid #D6CDBC', borderRadius: 999, padding: '4px 10px',
              }}
            >
              {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * The mobile 1-to-1 specialist chips.
 *
 * Launch disciplines only. The superseded build also listed Functional
 * medicine and Movement, neither of which NI offers — the v14 design source
 * names exactly these four and says so explicitly.
 */
export const ONE_TO_ONE_CHIPS = [
  'Nutrition', 'Naturopathy', 'Herbal medicine', 'Health coaching',
] as const

// ─── The Circles table ───────────────────────────────────────────────────────

export interface TbCircle {
  readonly name: string
  readonly short: string
  readonly host: string
  readonly filled: number
  readonly t: readonly [string, string]
}

/**
 * Seats, ported from `tbBuild()`.
 *
 * Eight chairs at 45° apart. The host is seat 0 at the top in a gold seat,
 * "You" is seat 4 at the bottom in a pine seat with the pulse ring, and the
 * others fill in the order [1,7,2,6,3,5] so occupancy grows outward from the
 * host rather than leaving a gap beside them.
 */
function tbBuild(d: TbCircle, mob: boolean) {
  const chairs = []
  const others = [1, 7, 2, 6, 3, 5]
  for (let i = 0; i < 8; i++) {
    const a = ((-90 + i * 45) * Math.PI) / 180
    const cx = 300 + 200 * Math.cos(a)
    const cy = 250 + 200 * Math.sin(a)
    const px = 300 + 192 * Math.cos(a)
    const py = 250 + 192 * Math.sin(a)
    const deg = i * 45
    const host = i === 0
    const you = i === 4
    const sat = host || you || (others.indexOf(i) >= 0 && others.indexOf(i) < d.filled - 2)
    const lab = host ? 'Host' : you ? 'You' : ''
    const lw = (host ? 52 : 44) * (mob ? 1.35 : 1)
    chairs.push({
      tf: `translate(${cx.toFixed(1)} ${cy.toFixed(1)}) rotate(${deg})`,
      pf: `translate(${px.toFixed(1)} ${py.toFixed(1)}) rotate(${deg})`,
      chair: you ? '#E6EEE5' : '#F4EEE3',
      sat,
      body: host ? '#C9A66B' : you ? '#2E4636' : '#9DB3A3',
      head: host ? `url(#tbGold${mob ? 'm' : ''})` : you ? '#2E4636' : '#B9CBBE',
      ring: host ? '#B8935A' : you ? '#F8F6F2' : '#FFFDF9',
      rw: host || you ? '2' : '1.2',
      lab, lw, lh: mob ? 30 : 24, lr: mob ? 15 : 12,
      lx: (cx - lw / 2).toFixed(1),
      ly: host ? (cy - (mob ? 62 : 54)).toFixed(1) : (cy + 26).toFixed(1),
      tx: cx.toFixed(1),
      ty: host ? (cy - (mob ? 41 : 37.5)).toFixed(1) : (cy + (mob ? 47 : 42.5)).toFixed(1),
      lfill: host ? '#FFFDF9' : '#2E4636',
      lstroke: host ? '#B8935A' : '#2E4636',
      lcol: host ? '#7A5E33' : '#F8F6F2',
    })
  }
  return chairs
}

function TableSvg({ d, mob, still }: { d: TbCircle; mob: boolean; still: boolean }) {
  const chairs = tbBuild(d, mob)
  const anim = !still
  const sfx = mob ? 'm' : ''
  const hover = usePauseOnHover()
  const aria =
    `Illustration: the ${d.name} Circle as a round table with eight seats. The host, `
    + `an NI ${d.host}, sits at the top and your seat is at the bottom. On the table: `
    + `this month’s live hour topic, replays and a coach nudge. Topic shown is an example.`

  return (
    <svg
      ref={hover.ref}
      onMouseEnter={hover.onMouseEnter}
      onMouseLeave={hover.onMouseLeave}
      role="img" aria-label={aria}
      viewBox="0 -18 600 530" width="100%" style={{ display: 'block' }}
    >
      <defs>
        <radialGradient id={`tbTable${sfx}`} cx="45%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#FFFDF9" />
          <stop offset="100%" stopColor="#F1E9DA" />
        </radialGradient>
        <radialGradient id={`tbGold${sfx}`} cx="38%" cy="34%" r="70%">
          <stop offset="0%" stopColor="#F3E3C2" />
          <stop offset="60%" stopColor="#C9A66B" />
          <stop offset="100%" stopColor="#9C7A45" />
        </radialGradient>
        <filter id={`tbSh${sfx}`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#1E2F24" floodOpacity="0.16" />
        </filter>
      </defs>

      {/* Chairs sit behind the table. */}
      {chairs.map((c, i) => (
        <g key={`c${i}`} transform={c.tf}>
          <rect x="-26" y="-20" width="52" height="40" rx="14" fill={c.chair} stroke="#D6CDBC" strokeWidth="1" />
        </g>
      ))}

      <circle
        cx="300" cy="250" r="150" fill={`url(#tbTable${sfx})`}
        stroke="#B8935A" strokeWidth="1.6" filter={`url(#tbSh${sfx})`}
      />
      <circle cx="300" cy="250" r="138" fill="none" stroke="#E2D6BF" strokeWidth="1" strokeDasharray="2 5" />

      {/* Seated figures, seen from above: an ellipse body and a round head. */}
      {chairs.map((c, i) => c.sat && (
        <g key={`p${i}`} transform={c.pf}>
          <ellipse cx="0" cy="-3" rx="20" ry="12" fill={c.body} />
          <circle cx="0" cy="5" r="10" fill={c.head} stroke={c.ring} strokeWidth={c.rw} />
        </g>
      ))}

      {chairs.map((c, i) => c.lab && (
        <g key={`l${i}`}>
          <rect x={c.lx} y={c.ly} width={c.lw} height={c.lh} rx={c.lr} fill={c.lfill} stroke={c.lstroke} />
          <text
            x={c.tx} y={c.ty} textAnchor="middle"
            fontFamily="'DM Sans', system-ui, sans-serif"
            fontSize="12.5" fontWeight="600" fill={c.lcol}
          >
            {c.lab}
          </text>
        </g>
      ))}

      {anim && (
        <circle cx="300" cy="442" r="22" fill="none" stroke="#2E4636" strokeWidth="1.5">
          <animate attributeName="r" values="20;30;20" dur="3.2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.7;0;0.7" dur="3.2s" repeatCount="indefinite" />
        </circle>
      )}

      <text
        x="300" y="194" textAnchor="middle"
        fontFamily="'DM Sans', system-ui, sans-serif"
        fontSize="11" letterSpacing="1.8" fill="#7A5E33"
      >
        THIS MONTH’S LIVE HOUR
      </text>
      <text
        x="300" y="228" textAnchor="middle"
        fontFamily="var(--ni-display), 'Cormorant Garamond', Georgia, serif" fontSize="30" fill="#0E0D0B"
      >
        {mob ? d.short : d.name}
      </text>
      <text x="300" y="254" textAnchor="middle" fontFamily="'DM Sans', system-ui, sans-serif" fontSize="13.5" fill="#2A2723">
        {d.t[0]}
      </text>
      <text x="300" y="272" textAnchor="middle" fontFamily="'DM Sans', system-ui, sans-serif" fontSize="13.5" fill="#2A2723">
        {d.t[1]}
      </text>

      {/* Two cards on the table, deliberately tilted: -6° and +5°. */}
      <g transform="rotate(-6 238 306)">
        <rect x="196" y="290" width="84" height="34" rx="4" fill="#FFFDF9" stroke="#D6CDBC" />
        <path d="M208 300 L216 307 L208 314 Z" fill="#2E4636" />
        <text x="224" y="312" fontFamily="'DM Sans', system-ui, sans-serif" fontSize="12" fill="#2A2723">Replays</text>
      </g>
      <g transform="rotate(5 360 306)">
        <rect x="316" y="290" width="92" height="34" rx="4" fill="#FBF3E2" stroke="#E2CFA6" />
        <text x="362" y="312" textAnchor="middle" fontFamily="'DM Sans', system-ui, sans-serif" fontSize="12" fill="#5A4524">
          Coach nudge
        </text>
      </g>
    </svg>
  )
}

export function CircleTable({ circle }: { circle: TbCircle }) {
  const still = useStill()
  return (
    <div style={{ marginTop: 12, background: '#EFE8DA', borderRadius: 8, padding: '14px 18px 10px' }}>
      <div className="v14-desk-only">
        <TableSvg d={circle} mob={false} still={still} />
      </div>
      <div className="v14-mob-only">
        <TableSvg d={circle} mob still={still} />
      </div>
    </div>
  )
}

/** A speech bubble — the coach nudge row icon. NOT a diamond. */
export function CoachNudgeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#7A5A2A" strokeWidth="1.5">
      <path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" />
    </svg>
  )
}
