'use client'

// ─── Two ways to work with NI practitioners ──────────────────────────────────
// The one interactive region of the preview. Three presentational controls
// live here, and the Founder is reviewing their BEHAVIOUR, so they are real:
//
//   · the Guided Groups programme switcher  (4 example programmes)
//   · the 1-to-1 care-team toggle           (Initial Review / Ongoing support)
//   · the mobile Guided Groups / 1-to-1 tabs
//
// Every CALL TO ACTION remains inert. Switching a programme redraws an
// illustration; it books nothing, prices nothing and writes nothing.
//
// Responsive behaviour without measuring the viewport: on mobile the inactive
// panel is `hidden`, on desktop both are `md:block`. One state, no resize
// listener, no hydration mismatch.
//
// Prices come from @natural-intelligence/db/pricing. This file contains no
// figure — previewPageBoundary.test.ts fails if one appears.

import { useState } from 'react'
import {
  GUIDED_GROUPS, INITIAL_CARE_REVIEW, CARE_PRICES, ONGOING_SUPPORT,
  standardLabel, memberLabel, inlinePriceLabel,
} from '@natural-intelligence/db/pricing'
import { C, CHIP_ON, CHIP_OFF } from './theme'
import { WorkingPrice } from './WorkingPrice'
import { InertButton, Eyebrow, Tick, Dash } from './primitives'

// ─── Illustration data (presentational only — not clinical guidance) ─────────

const SYS: readonly (readonly [string, number])[] = [
  ['Digestive', 104], ['Immune', 88], ['Endocrine', 104], ['Nervous', 92],
  ['Musculoskeletal', 144], ['Cardiovascular', 136], ['Reproductive', 124],
  ['Detox & liver', 124],
]
const ANG = [-90, -45, 0, 45, 90, 135, 180, 225]

interface Prog {
  name: string
  primary: number[]
  secondary: number[]
  panel: readonly (readonly [string, boolean, number[]])[]
}

const PROGS: readonly Prog[] = [
  {
    name: 'Gut health', primary: [0, 1], secondary: [3, 7],
    panel: [['Nutrition', true, [0, 1]], ['Herbal medicine', false, [0, 7]], ['Mind–body & breath', false, [3]]],
  },
  {
    name: 'Hormone balance', primary: [2, 6], secondary: [3, 7],
    panel: [['Naturopathy', true, [2, 6]], ['Nutrition', false, [2, 7]], ['Herbal medicine', false, [6]], ['Sleep & stress', false, [3]]],
  },
  {
    name: 'Energy & fatigue', primary: [2, 3], secondary: [0, 5],
    panel: [['Functional medicine', true, [2, 3]], ['Nutrition', false, [0, 2]], ['Movement', false, [5]]],
  },
  {
    name: 'Stress & sleep', primary: [3], secondary: [2, 5],
    panel: [['Naturopathy', true, [3]], ['Mind–body & breath', false, [3, 5]], ['Herbal medicine', false, [3, 2]]],
  },
]

const SPEC: readonly (readonly [string, number, number, number])[] = [
  ['Nutrition', 110, 108.1, 158.9],
  ['Herbal medicine', 160, 170.4, 64.7],
  ['Naturopathy', 126, 280, 27],
  ['Functional medicine', 194, 389.6, 64.7],
  ['Movement', 101, 451.9, 158.9],
]
/** Specialists that light up once ongoing support is selected. */
const SPEC_ON_ONGOING = [1, 4]

const RECORD_CHIPS: readonly (readonly [string, boolean])[] = [
  ['Health Story', true], ['Symptoms', true], ['Goals', true], ['Labs', true],
  ['Relevant systems', true], ['Protocol', true],
  // Only present once care continues past the initial episode.
  ['Follow-up', false],
]

const systemNames = (ix: number[]) => ix.map((i) => SYS[i][0]).join(' · ')

// ─── Guided Groups illustration ──────────────────────────────────────────────

function GroupsDiagram({ prog }: { prog: Prog }) {
  const cx = 280, cy = 200, r = 165
  const nodes = SYS.map(([label, w], i) => {
    const a = (ANG[i] * Math.PI) / 180
    const x = Math.round((cx + r * Math.cos(a)) * 10) / 10
    const y = Math.round((cy + r * Math.sin(a)) * 10) / 10
    const primary = prog.primary.includes(i)
    const secondary = prog.secondary.includes(i)
    return {
      label, w, x, y, primary, secondary,
      fill: primary ? C.dPrimary : secondary ? C.paper : C.dNeutral,
      stroke: primary || secondary ? C.dStroke : C.dStrokeOff,
      rectDash: secondary ? '4 3' : undefined,
      ink: primary || secondary ? C.dInk : C.dInkOff,
      weight: primary ? 600 : 400,
      line: primary || secondary ? C.dStroke : 'transparent',
      lineDash: secondary ? '5 4' : undefined,
    }
  })

  return (
    <svg
      viewBox="0 0 560 400" role="img" className="w-full h-auto"
      aria-label={
        `Illustration of the ${prog.name} example programme: your group at the centre, ` +
        `held by one lead practitioner. Primary body systems: ${systemNames(prog.primary)}. ` +
        `Secondary: ${systemNames(prog.secondary)}.`
      }
    >
      {nodes.map((n) => (
        <line
          key={`l-${n.label}`} x1={cx} y1={cy} x2={n.x} y2={n.y}
          stroke={n.line} strokeWidth={1.4} strokeDasharray={n.lineDash}
        />
      ))}

      {/* Centre — the group, held by one lead practitioner throughout. */}
      <circle cx={cx} cy={cy} r={62} fill={C.paper} stroke={C.dLeadRing} strokeWidth={1.8} />
      <text x={cx} y={cy - 14} textAnchor="middle" fontSize={8.5} letterSpacing="0.1em" fill={C.goldInk}>
        LEAD PRACTITIONER
      </text>
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize={8.5} letterSpacing="0.1em" fill={C.goldInk}>
        · THROUGHOUT ·
      </text>
      <text x={cx} y={cy + 18} textAnchor="middle" fontSize={15} fontWeight={500} fill={C.dInk}>
        your group
      </text>

      {nodes.map((n) => (
        <g key={`n-${n.label}`}>
          <rect
            x={n.x - n.w / 2} y={n.y - 16} width={n.w} height={32} rx={16}
            fill={n.fill} stroke={n.stroke} strokeWidth={1.3} strokeDasharray={n.rectDash}
          />
          <text x={n.x} y={n.y + 5} textAnchor="middle" fontSize={12.5} fontWeight={n.weight} fill={n.ink}>
            {n.label}
          </text>
        </g>
      ))}
    </svg>
  )
}

function GroupsLegend() {
  const item = (fill: string, stroke: string, dash: string | undefined, label: string) => (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden
        style={{
          width: 22, height: 12, borderRadius: 999, background: fill,
          border: `1.3px ${dash ? 'dashed' : 'solid'} ${stroke}`, display: 'inline-block',
        }}
      />
      <span>{label}</span>
    </span>
  )
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-[12px] mt-3" style={{ color: C.muted }}>
      {item(C.dPrimary, C.dStroke, undefined, 'Primary body system')}
      {item(C.paper, C.dStroke, 'dashed', 'Secondary system')}
      {item(C.dNeutral, C.dStrokeOff, undefined, 'Not a focus of this programme')}
    </div>
  )
}

// ─── Care-team illustration ──────────────────────────────────────────────────

function CareTeamDiagram({ ongoing }: { ongoing: boolean }) {
  const lx = 280, ly = 252
  const nodes = SPEC.map(([label, w, x, y], i) => {
    const on = ongoing && SPEC_ON_ONGOING.includes(i)
    return {
      label, w, x, y, on,
      fill: on ? C.paper : C.dNeutral,
      stroke: on ? C.dStroke : C.dStrokeOff,
      ink: on ? C.dInk : C.dInkOff,
      line: on ? C.dStroke : '#E2DACB',
      lineDash: on ? '6 4' : '2 5',
    }
  })

  return (
    <svg
      viewBox="0 0 560 390" role="img" className="w-full h-auto"
      aria-label={
        ongoing
          ? 'Illustration of ongoing support: your lead practitioner at the centre with one connected record, ' +
            'bringing in specialists where needed. Your GP and NHS care sit outside NI care.'
          : 'Illustration of the Initial NI Care Review: your lead practitioner at the centre with one connected ' +
            'record. Specialists are not involved. Your GP and NHS care sit outside NI care.'
      }
    >
      {nodes.map((n) => (
        <line
          key={`l-${n.label}`} x1={lx} y1={ly - 40} x2={n.x} y2={n.y + 17}
          stroke={n.line} strokeWidth={1.4} strokeDasharray={n.lineDash}
        />
      ))}

      {nodes.map((n) => (
        <g key={`n-${n.label}`}>
          <rect
            x={n.x - n.w / 2} y={n.y - 17} width={n.w} height={34} rx={17}
            fill={n.fill} stroke={n.stroke} strokeWidth={1.3}
            strokeDasharray={n.on ? undefined : '4 3'}
          />
          <text x={n.x} y={n.y + 5} textAnchor="middle" fontSize={12.5} fill={n.ink}>
            {n.label}
          </text>
        </g>
      ))}

      {/* The lead — named, responsible, signs the Protocol. */}
      <circle cx={lx} cy={ly} r={66} fill={C.paper} stroke={C.dLeadRing} strokeWidth={2} />
      <text x={lx} y={ly - 22} textAnchor="middle" fontSize={8.5} letterSpacing="0.1em" fill={C.goldInk}>
        YOUR LEAD PRACTITIONER
      </text>
      <text x={lx} y={ly + 2} textAnchor="middle" fontSize={20} fontWeight={500} fill={C.dInk}>
        You
      </text>
      <text x={lx} y={ly + 22} textAnchor="middle" fontSize={11} fill={C.dInkOff}>
        one connected record
      </text>

      {/* Outside NI care — informed only with consent. */}
      <rect
        x={lx - 92} y={344} width={184} height={34} rx={17}
        fill="transparent" stroke={C.dStrokeOff} strokeWidth={1.3} strokeDasharray="5 4"
      />
      <text x={lx} y={366} textAnchor="middle" fontSize={12.5} fill={C.dInkOff}>
        Your GP &amp; NHS care
      </text>
      <line x1={lx} y1={ly + 66} x2={lx} y2={344} stroke={C.dStrokeOff} strokeWidth={1.3} strokeDasharray="2 5" />
    </svg>
  )
}

function RecordChips({ ongoing }: { ongoing: boolean }) {
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {RECORD_CHIPS.map(([label, always]) => {
        const on = always || ongoing
        return (
          <span
            key={label}
            className="inline-block text-[13px]"
            style={{
              border: `1px ${on ? 'solid' : 'dashed'} ${on ? C.dStroke : '#D6CDBC'}`,
              background: on ? C.paper : 'transparent',
              color: on ? C.dInk : C.dInkOff,
              borderRadius: 999, padding: '5px 12px',
            }}
          >
            {label}
          </span>
        )
      })}
    </div>
  )
}

// ─── Panels ──────────────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-6 sm:p-8 h-full"
      style={{ background: C.warm, border: `1px solid ${C.border}` }}
    >
      {children}
    </div>
  )
}

function PriceBlock({
  standard, member, children,
}: { standard: string; member: string; children?: React.ReactNode }) {
  return (
    <div className="pt-5 mt-5" style={{ borderTop: `1px solid ${C.border}` }}>
      <p className="text-[32px] leading-none font-light" style={{ color: C.text }}>{standard}</p>
      <p className="text-[14px] mt-2" style={{ color: C.text2 }}>{member}</p>
      {children}
    </div>
  )
}

function GuidedGroupsPanel() {
  const [ggp, setGgp] = useState(0)
  const prog = PROGS[ggp]

  return (
    <Card>
      <Eyebrow>Together, more affordably</Eyebrow>
      <h3 className="text-[26px] font-light mb-2" style={{ color: C.text }}>NI Guided Groups</h3>
      <p className="text-[15px] mb-4" style={{ color: C.text }}>
        One group. One coordinated journey. Several relevant perspectives.
      </p>
      <p className="text-[14px] leading-[1.7] mb-6" style={{ color: C.text2 }}>
        A small, fixed-length group of people with a similar health concern, moving through a
        structured programme together. One lead practitioner stays with the group; relevant
        specialists contribute where they help.
      </p>

      <p className="font-mono text-[11px] tracking-[0.12em] uppercase mb-3" style={{ color: C.goldInk }}>
        Example programme
      </p>
      <div role="group" aria-label="Example programme" className="flex flex-wrap gap-2 mb-4">
        {PROGS.map((p, i) => (
          <button
            key={p.name} type="button" onClick={() => setGgp(i)}
            aria-pressed={i === ggp} style={i === ggp ? CHIP_ON : CHIP_OFF}
          >
            {p.name}
          </button>
        ))}
      </div>

      <GroupsDiagram prog={prog} />
      <GroupsLegend />

      <p className="font-mono text-[11px] tracking-[0.12em] uppercase mt-7 mb-3" style={{ color: C.goldInk }}>
        This example&rsquo;s practitioner panel
      </p>
      <ul className="space-y-2 mb-4">
        {prog.panel.map(([modality, isLead, systems]) => (
          <li key={modality} className="flex items-start gap-3 text-[14px]">
            <span aria-hidden className="mt-1.5 flex-shrink-0" style={{ width: 16, textAlign: 'center' }}>
              <span
                style={
                  isLead
                    ? { display: 'inline-block', width: 14, height: 14, borderRadius: '50%', border: `1.8px solid ${C.dLeadRing}`, boxSizing: 'border-box' }
                    : { display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: C.dStroke }
                }
              />
            </span>
            <span>
              <span style={{ color: C.text }}>{modality}</span>
              {isLead && (
                <span className="ml-2 text-[12px]" style={{ color: C.goldInk }}>Lead practitioner</span>
              )}
              <span className="block text-[13px]" style={{ color: C.muted }}>
                → {systemNames(systems)}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[12.5px] leading-[1.65] mb-6" style={{ color: C.muted }}>
        Programmes are illustrative. Not every programme uses every modality. Some may include
        supervised students where appropriate. Each Guided Group lists its duration, group size,
        practitioner panel and price before you join.
      </p>

      <p className="font-mono text-[11px] tracking-[0.12em] uppercase mb-3" style={{ color: C.goldInk }}>
        A Guided Group includes
      </p>
      <ul className="space-y-2">
        {[
          'A structured, fixed-length programme',
          'A named lead practitioner',
          'Relevant specialist input',
          'Shared education and group support',
          'Your own goals and tracking',
          'Limited personalisation within the programme',
        ].map((f) => <Tick key={f}>{f}</Tick>)}
      </ul>

      <PriceBlock standard={standardLabel(GUIDED_GROUPS)} member={memberLabel(GUIDED_GROUPS)}>
        <WorkingPrice />
        <p className="text-[13px] leading-[1.65] mt-4" style={{ color: C.muted }}>
          Each programme has its own length, group size, practitioner panel and price, shown in
          full before you join.
        </p>
        <div className="mt-5">
          <InertButton>Register interest in Guided Groups</InertButton>
        </div>
      </PriceBlock>

      <p className="text-[13px] leading-[1.7] mt-6 pt-5" style={{ color: C.text2, borderTop: `1px solid ${C.border}` }}>
        A Guided Group does not automatically include an individual signed Protocol. If you need
        an individual assessment, private interpretation, personal clinical advice or an
        individual Protocol, <strong className="font-medium" style={{ color: C.text }}>NI Care
        1-to-1</strong> is the route — you can move across at any point.
      </p>
    </Card>
  )
}

function OneToOnePanel() {
  const [ct, setCt] = useState<'initial' | 'ongoing'>('initial')
  const ongoing = ct === 'ongoing'

  return (
    <Card>
      <Eyebrow>Individually</Eyebrow>
      <h3 className="text-[26px] font-light mb-2" style={{ color: C.text }}>NI Care 1-to-1</h3>
      <p className="text-[15px] mb-4" style={{ color: C.text }}>
        One person. One connected record. The right professional input at the right time.
      </p>
      <p className="text-[14px] leading-[1.7] mb-6" style={{ color: C.text2 }}>
        A defined episode of individual care, with a named lead practitioner who signs anything
        written for you.
      </p>

      <p className="font-mono text-[11px] tracking-[0.12em] uppercase mb-3" style={{ color: C.goldInk }}>
        Your care
      </p>
      <div role="group" aria-label="Your care" className="flex flex-wrap gap-2 mb-4">
        <button type="button" onClick={() => setCt('initial')} aria-pressed={!ongoing} style={ongoing ? CHIP_OFF : CHIP_ON}>
          Initial Review
        </button>
        <button type="button" onClick={() => setCt('ongoing')} aria-pressed={ongoing} style={ongoing ? CHIP_ON : CHIP_OFF}>
          Ongoing support
        </button>
      </div>

      <CareTeamDiagram ongoing={ongoing} />

      <p className="font-mono text-[11px] tracking-[0.12em] uppercase mt-6 mb-3 text-center" style={{ color: C.goldInk }}>
        Your connected record
      </p>
      <RecordChips ongoing={ongoing} />

      <ul className="space-y-2.5 mt-6 text-[13.5px] leading-[1.7]" style={{ color: C.text2 }}>
        <li>One named lead practitioner is responsible for your care and signs your Protocol.</li>
        <li>Other specialists join only when needed — each contribution agreed with you first.</li>
        <li>
          Your GP and NHS care stay in charge of your medical care; NI keeps them informed only
          with your consent.
        </li>
      </ul>
      <p className="text-[13.5px] leading-[1.7] mt-4" style={{ color: C.text2 }}>
        {ongoing
          ? 'With ongoing support, your record keeps building: follow-ups, Protocol revisions and, where needed, a specialist your lead brings in — each agreed and priced with you first.'
          : 'At your Initial Review, your lead practitioner works from your organised record — Health Story, symptoms, goals, labs and relevant systems — and writes and signs your Protocol.'}
      </p>

      {/* Start with — the entry point. */}
      <div className="mt-8 pt-6" style={{ borderTop: `1px solid ${C.border}` }}>
        <p className="font-mono text-[11px] tracking-[0.12em] uppercase mb-2" style={{ color: C.goldInk }}>
          Start with
        </p>
        <h4 className="text-[20px] font-light mb-1" style={{ color: C.text }}>Initial NI Care Review</h4>
        <p className="text-[13.5px] mb-4" style={{ color: C.text2 }}>
          A standalone episode of care, complete in itself.
        </p>
        <ul className="space-y-2">
          {[
            'An organised intake', 'Your Health Story', 'Practitioner preparation and review',
            'A consultation', 'A Protocol signed by your practitioner', 'Defined coordination',
            'One defined follow-up',
          ].map((f) => <Tick key={f}>{f}</Tick>)}
        </ul>
        <PriceBlock standard={standardLabel(INITIAL_CARE_REVIEW)} member={memberLabel(INITIAL_CARE_REVIEW)}>
          <WorkingPrice />
        </PriceBlock>
      </div>

      {/* Optional ongoing support — one tag covers all three services. */}
      <div className="mt-8 pt-6" style={{ borderTop: `1px solid ${C.border}` }}>
        <p className="font-mono text-[11px] tracking-[0.12em] uppercase mb-2" style={{ color: C.goldInk }}>
          then, only if useful
        </p>
        <h4 className="text-[20px] font-light" style={{ color: C.text }}>
          <span className="text-[13px] font-mono tracking-[0.1em] uppercase mr-2" style={{ color: C.muted }}>
            Optional
          </span>
          Ongoing support
        </h4>
        <p className="text-[13.5px] leading-[1.7] mt-2 mb-4" style={{ color: C.text2 }}>
          Not a subscription, not unlimited. Choose only what helps, and pay for it as you go.
        </p>

        <ul className="space-y-3">
          {ONGOING_SUPPORT.map((s) => (
            <li
              key={s.key}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pb-3"
              style={{ borderBottom: `1px solid ${C.border}` }}
            >
              <span>
                <span className="text-[15px]" style={{ color: C.text }}>{s.name}</span>
                <span className="block text-[13px]" style={{ color: C.muted }}>{s.note}</span>
              </span>
              <span className="text-[14px] whitespace-nowrap" style={{ color: C.text }}>
                {inlinePriceLabel(CARE_PRICES[s.key])}
              </span>
            </li>
          ))}
        </ul>
        <WorkingPrice />

        <p className="text-[13px] leading-[1.65] mt-4" style={{ color: C.muted }}>
          Each service is priced and agreed with you before it begins. Members receive
          preferential pricing.
        </p>
        <div className="mt-5">
          <InertButton>Register interest in NI Care 1-to-1</InertButton>
        </div>
      </div>

      <div className="mt-8 pt-6" style={{ borderTop: `1px solid ${C.border}` }}>
        <p className="font-mono text-[11px] tracking-[0.12em] uppercase mb-2" style={{ color: C.goldInk }}>
          Within NI Care
        </p>
        <h4 className="text-[18px] font-light mb-2" style={{ color: C.text }}>
          Additional specialist support
        </h4>
        <p className="text-[13.5px] leading-[1.7] mb-2" style={{ color: C.text2 }}>
          Additional specialist or complex professional input is discussed, scoped and agreed with
          you separately before it begins.
        </p>
        <p className="text-[13.5px] leading-[1.7]" style={{ color: C.text2 }}>
          Unusually senior or multidisciplinary input may cost more. You will always see the scope
          and price first, and nothing starts without your agreement.
        </p>
      </div>
    </Card>
  )
}

// ─── The section, with its mobile tabs ───────────────────────────────────────

export function CareSection() {
  const [tab, setTab] = useState<'groups' | 'one-to-one'>('groups')

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, border: 0, borderBottom: `2px solid ${active ? C.gold : 'transparent'}`,
    background: 'transparent', color: active ? C.text : C.muted,
    fontWeight: active ? 600 : 400, fontSize: 14, padding: '10px 4px',
    minHeight: 44, cursor: 'pointer', fontFamily: 'inherit',
  })

  return (
    <section id="care" className="px-4 py-14" style={{ background: C.cream }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <Eyebrow>Professional care</Eyebrow>
          <h2 className="text-[30px] font-light mb-3" style={{ color: C.text }}>
            Two ways to work with NI practitioners
          </h2>
          <p className="text-[14.5px] leading-[1.7] max-w-2xl mx-auto" style={{ color: C.text2 }}>
            A shared programme at a more accessible cost, or a defined episode of individual care.
            Both are open to everyone.
          </p>
        </div>

        {/* Mobile only — on desktop both panels show and tabs would mislead. */}
        <div
          role="tablist" aria-label="Ways to work with NI practitioners"
          className="flex md:hidden mb-6" style={{ borderBottom: `1px solid ${C.border}` }}
        >
          <button
            type="button" role="tab" id="tab-groups" aria-controls="panel-groups"
            aria-selected={tab === 'groups'} onClick={() => setTab('groups')}
            style={tabStyle(tab === 'groups')}
          >
            Guided Groups
          </button>
          <button
            type="button" role="tab" id="tab-one-to-one" aria-controls="panel-one-to-one"
            aria-selected={tab === 'one-to-one'} onClick={() => setTab('one-to-one')}
            style={tabStyle(tab === 'one-to-one')}
          >
            NI Care 1-to-1
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
          <div
            id="groups" role="tabpanel" aria-labelledby="tab-groups"
            className={tab === 'groups' ? 'block' : 'hidden md:block'}
          >
            <GuidedGroupsPanel />
          </div>

          <div
            id="one-to-one" role="tabpanel" aria-labelledby="tab-one-to-one"
            className={tab === 'one-to-one' ? 'block' : 'hidden md:block'}
          >
            <OneToOnePanel />
          </div>
        </div>

        <p className="text-center text-[13px] mt-6" style={{ color: C.muted }}>
          <Dash /> Membership is not required for professional care. Members receive preferential
          pricing.
        </p>
      </div>
    </section>
  )
}
