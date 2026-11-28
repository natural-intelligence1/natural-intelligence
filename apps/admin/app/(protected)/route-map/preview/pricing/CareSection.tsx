'use client'

// ─── Two ways to learn from and work with NI practitioners ───────────────────
// The one interactive region of the preview. Three presentational controls
// live here, and the Founder is reviewing their BEHAVIOUR, so they are real:
//
//   · the Circle switcher                   (4 launch Circles)
//   · the 1-to-1 care-team toggle           (Initial Review / Ongoing support)
//   · the mobile Circles / 1-to-1 tabs
//
// Every CALL TO ACTION remains inert. Switching a Circle redraws an
// illustration; it joins nothing, prices nothing and writes nothing.
//
// WHAT v14 CHANGED HERE
//
// The left-hand panel was NI Guided Groups: a paid programme with its own
// price, its own practitioner panel and its own body-system diagram. It is now
// NI Circles, which are INCLUDED IN MEMBERSHIP and therefore have no price at
// all. The panel lost its PriceBlock entirely — the figure did not move, it
// ceased to exist — and gained the seat-at-the-table illustration.
//
// The right-hand 1-to-1 panel is unchanged in structure: same Galaxy-style
// care-team diagram, same record chips, same entry point and optional ongoing
// services. Only its copy was corrected.
//
// Responsive behaviour without measuring the viewport: on mobile the inactive
// panel is `hidden`, on desktop both are `md:block`. One state, no resize
// listener, no hydration mismatch.
//
// No animation anywhere in this file: the illustrations are static SVG, so
// there is nothing for prefers-reduced-motion to suppress. Transitions are
// limited to hover colour on controls, which carries no motion.
//
// Prices come from @natural-intelligence/db/pricing. This file contains no
// figure — previewPageBoundary.test.ts fails if one appears.

import { useState } from 'react'
import {
  CIRCLES, CIRCLES_INCLUDED_NOTE, INITIAL_CARE_REVIEW, CARE_PRICES, ONGOING_SUPPORT,
  standardLabel, memberLabel, inlinePriceLabel,
} from '@natural-intelligence/db/pricing'
import { C, CHIP_ON, CHIP_OFF, DISPLAY, TAGLINE } from './theme'
import { WorkingPrice } from './WorkingPrice'
import { InertButton, Eyebrow, Tick, Dash } from './primitives'
// The two care visuals, ported from the v14 artboards rather than redrawn.
import {
  CareGalaxy, CircleTable, CoachNudgeIcon, ONE_TO_ONE_CHIPS, type TbCircle,
} from './v14Visuals'

// ─── Circle illustration data — EXAMPLES, not a schedule ─────────────────────
// Every string here is illustrative and the page says so. The host is given by
// DISCIPLINE, never by name: naming a practitioner on a pricing page would
// promise a particular person for a session that has not been scheduled.
//
// Topics and nudges are deliberately descriptive rather than outcome-claiming
// — "what's common" and "add one extra plant food", not "fix your bloating".
// A pricing page is advertising, and an implied efficacy claim here would be
// an advertising claim about health.

interface CircleExample {
  readonly name: string
  readonly topic: readonly [string, string]
  readonly host: string
  readonly replay: string
  readonly nudge: string
  readonly space: string
}

/**
 * Seat occupancy and the short name, from the v14 `TB` data.
 *
 * `filled` varies per Circle on purpose: the table should not look like the
 * same eight people every time, and a half-full Circle is an honest picture
 * of a group that is still forming. Kept beside CIRCLE_EXAMPLES rather than
 * merged into it because the copy there is Founder-approved and this is
 * purely a property of the drawing.
 */
const TB_META: readonly { readonly short: string; readonly filled: number }[] = [
  { short: 'Gut', filled: 6 },
  { short: 'Hormones', filled: 4 },
  { short: 'Energy', filled: 5 },
  { short: 'Stress & sleep', filled: 7 },
]

/** The host, without the leading article the prose line adds. */
const tbHost = (ex: CircleExample) => ex.host.replace(/^an?\s+NI\s+/i, '')

const toTbCircle = (ex: CircleExample, i: number): TbCircle => ({
  name: ex.name,
  short: TB_META[i]?.short ?? ex.name,
  host: tbHost(ex),
  filled: TB_META[i]?.filled ?? 6,
  t: ex.topic,
})

const CIRCLE_EXAMPLES: readonly CircleExample[] = [
  {
    name: CIRCLES[0],
    topic: ['Fibre, the microbiome', 'and everyday digestion'],
    host: 'an NI nutritional therapist',
    replay: 'Bloating: what’s common, and when to look closer',
    nudge: 'Add one extra plant food to each meal this week',
    space: 'Questions for the next live hour, shared tips and recipes',
  },
  {
    name: CIRCLES[1],
    topic: ['Cycles, perimenopause', 'and everyday hormone health'],
    host: 'an NI naturopathic practitioner',
    replay: 'Sleep, stress and the hormone picture',
    nudge: 'Note how you feel across the week, in one line a day',
    space: 'Questions for the next live hour, and what others are noticing',
  },
  {
    name: CIRCLES[2],
    topic: ['Blood sugar, meals', 'and steady energy'],
    host: 'an NI nutritional therapist',
    replay: 'Why afternoons feel flat, and what to look at',
    nudge: 'Add protein to breakfast three mornings this week',
    space: 'Questions for the next live hour, shared meals and routines',
  },
  {
    name: CIRCLES[3],
    topic: ['Wind-down, light', 'and the sleep window'],
    host: 'an NI medical herbalist',
    replay: 'Racing thoughts at bedtime: what’s common',
    nudge: 'Step outside for daylight within an hour of waking',
    space: 'Questions for the next live hour, and evening routines that stuck',
  },
]


const RECORD_CHIPS: readonly (readonly [string, boolean])[] = [
  ['Health Story', true], ['Symptoms', true], ['Goals', true], ['Labs', true],
  ['Relevant systems', true], ['Protocol', true],
  // Only present once care continues past the initial episode.
  ['Follow-up', false],
]

// ─── Circles illustration — a seat at the table ──────────────────────────────
// A round table seen from above. Ten seats: the HOST at the top, YOU at the
// bottom, and eight others who are deliberately anonymous — no faces, no
// names, no count stated in words. The page says "a focused group" and the
// picture agrees with it rather than contradicting it with a countable crowd.


/** One between-sessions row: an icon, a label and the example itself. */
function BetweenRow({ icon, label, body }: {
  icon: React.ReactNode; label: string; body: string
}) {
  return (
    <li className="flex items-start gap-3 py-3" style={{ borderTop: `1px solid ${C.border}` }}>
      <span
        aria-hidden
        className="flex-shrink-0 inline-flex items-center justify-center text-[12px]"
        style={{
          width: 28, height: 28, borderRadius: 999,
          border: `1px solid ${C.goldLine}`, color: C.goldInk,
        }}
      >
        {icon}
      </span>
      <span>
        <span className="block text-[12px]" style={{ color: C.muted }}>{label}</span>
        <span className="block text-[14px] leading-[1.6]" style={{ color: C.text }}>{body}</span>
      </span>
    </li>
  )
}

// ─── 1-to-1 care-team illustration ───────────────────────────────────────────


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
      <p className="text-[32px] leading-none" style={{ ...DISPLAY, color: C.text }}>{standard}</p>
      <p className="text-[14px] mt-2" style={{ color: C.text2 }}>{member}</p>
      {children}
    </div>
  )
}

function CirclesPanel() {
  const [i, setI] = useState(0)
  const ex = CIRCLE_EXAMPLES[i]

  return (
    <Card>
      <Eyebrow>Together · included with Membership</Eyebrow>
      <h3 className="text-[26px] mb-2" style={{ ...DISPLAY, color: C.text }}>NI Circles</h3>
      <p className="text-[17px] mb-4" style={{ ...TAGLINE, color: C.text }}>
        One body system. One monthly hour. People on the same path.
      </p>
      <p className="text-[14px] leading-[1.7] mb-6" style={{ color: C.text2 }}>
        {/* Punctuation aligned to v14 (colon, not an em dash). The closing
            clause deliberately does NOT follow v14: see the copy-difference
            list in the mission report. v14 reads "with a coach helping you
            stay with your plan", which edges a non-clinical Coach towards
            working to a clinical Protocol. The approved boundary wording is
            retained, because approved content corrections outrank the
            artboard on wording. */}
        Each member joins one Circle: the body system that needs them most right now. Each month an
        NI practitioner hosts a live hour for each Circle: focused teaching on that body system and
        open Q&amp;A, with a coach encouraging healthy everyday habits.
      </p>

      <p className="text-[12px] tracking-[0.18em] uppercase mb-3" style={{ fontWeight: 600, color: C.eyebrowInk }}>
        Choose your Circle
      </p>
      <div role="group" aria-label="Choose your Circle" className="flex flex-wrap gap-2 mb-4">
        {CIRCLE_EXAMPLES.map((c, idx) => (
          <button
            key={c.name} type="button" onClick={() => setI(idx)}
            aria-pressed={idx === i} style={idx === i ? CHIP_ON : CHIP_OFF}
          >
            {c.name}
          </button>
        ))}
      </div>

      <CircleTable circle={toTbCircle(ex, i)} />

      <p className="text-[12.5px] mt-3" style={{ color: C.muted }}>
        Hosted by {ex.host} · A focused group · Live online, monthly
      </p>

      <ul className="mt-5">
        <BetweenRow icon="▶" label="Replays · for example, last month" body={ex.replay} />
        {/* A speech bubble: the nudge is a message from a person, and the
            superseded diamond read as a generic ornament. */}
        <BetweenRow icon={<CoachNudgeIcon />} label="Coach nudge · between sessions" body={ex.nudge} />
        <BetweenRow icon="◎" label="Circle space · moderated" body={ex.space} />
      </ul>

      <p className="text-[12.5px] leading-[1.65] mt-4 mb-6" style={{ color: C.muted }}>
        Choose the body system that needs you most right now. You can swap from the following
        month. A Circle opens once enough members have joined. Sessions may include supervised
        students where appropriate. Illustrative.
      </p>

      <p className="text-[12px] tracking-[0.18em] uppercase mb-3" style={{ fontWeight: 600, color: C.eyebrowInk }}>
        Each Circle includes
      </p>
      <ul className="space-y-2">
        {[
          'One live online hour a month',
          'A focused group on the same path',
          'Focused teaching and open Q&A',
          'Coach encouragement for healthy everyday habits',
          'Replays and a moderated Circle space',
          'One Circle at a time; swap monthly',
        ].map((f) => <Tick key={f}>{f}</Tick>)}
      </ul>

      {/* No PriceBlock and no WorkingPrice tag. Circles have no price of their
          own: they are included, and a tagged figure here would invent a
          purchase that does not exist. */}
      <div className="pt-5 mt-6" style={{ borderTop: `1px solid ${C.border}` }}>
        <p className="flex flex-wrap items-baseline gap-x-3">
          <span className="text-[32px] leading-none" style={{ ...DISPLAY, color: C.text }}>Included</span>
          <span className="text-[14px]" style={{ color: C.text2 }}>{CIRCLES_INCLUDED_NOTE}</span>
        </p>
        <p className="text-[13px] leading-[1.65] mt-3" style={{ color: C.muted }}>
          No extra charge. Circles are for members only.
        </p>
        <div className="mt-5">
          <InertButton>Register interest in Membership</InertButton>
        </div>
      </div>

      {/* The boundary. A practitioner-led hour inside a membership is the line
          most likely to be read as individual care, so it is stated here as
          well as on the Membership card and in the questions. */}
      <p className="text-[13px] leading-[1.7] mt-6 pt-5" style={{ color: C.text2, borderTop: `1px solid ${C.border}` }}>
        Circles are group education and Q&amp;A, not individual care. Please don’t share personal
        health details in a session. For personal advice, an assessment or a signed Protocol,{' '}
        <strong className="font-medium" style={{ color: C.text }}>NI Care 1-to-1</strong> is the
        route — at member prices.
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
      <h3 className="text-[26px] mb-2" style={{ ...DISPLAY, color: C.text }}>NI Care 1-to-1</h3>
      <p className="text-[17px] mb-4" style={{ ...TAGLINE, color: C.text }}>
        One person. One connected record. The right professional input at the right time.
      </p>
      <p className="text-[14px] leading-[1.7] mb-6" style={{ color: C.text2 }}>
        A defined episode of individual care, with a named lead practitioner who reviews and signs
        your personal Protocol.
      </p>

      <p className="text-[12px] tracking-[0.18em] uppercase mb-3" style={{ fontWeight: 600, color: C.eyebrowInk }}>
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

      <CareGalaxy ongoing={ongoing} />

      <p className="text-[12px] tracking-[0.18em] uppercase mt-6 mb-3 text-center" style={{ fontWeight: 600, color: C.eyebrowInk }}>
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
        <p className="text-[12px] tracking-[0.18em] uppercase mb-2" style={{ fontWeight: 600, color: C.eyebrowInk }}>
          Start with
        </p>
        <h4 className="text-[20px] mb-1" style={{ ...DISPLAY, color: C.text }}>Initial NI Care Review</h4>
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
        <p className="text-[12px] tracking-[0.18em] uppercase mb-2" style={{ fontWeight: 600, color: C.eyebrowInk }}>
          then, only if useful
        </p>
        <h4 className="text-[20px]" style={{ ...DISPLAY, color: C.text }}>
          <span className="text-[13px] font-mono tracking-[0.1em] uppercase mr-2" style={{ color: C.muted }}>
            Optional
          </span>
          Ongoing support
        </h4>
        <p className="text-[13.5px] leading-[1.7] mt-2 mb-4" style={{ color: C.text2 }}>
          Not a subscription. Choose only what helps, and pay for it as you go.
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
        <p className="text-[12px] tracking-[0.18em] uppercase mb-2" style={{ fontWeight: 600, color: C.eyebrowInk }}>
          Within NI Care
        </p>
        <h4 className="text-[18px] mb-2" style={{ ...DISPLAY, color: C.text }}>
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
  const [tab, setTab] = useState<'circles' | 'one-to-one'>('circles')

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
          <Eyebrow>Professional care · opening soon</Eyebrow>
          <h2 className="text-[30px] mb-3" style={{ ...DISPLAY, color: C.text }}>
            Two ways to learn from and work with NI practitioners
          </h2>
          <p className="text-[14.5px] leading-[1.7] max-w-2xl mx-auto" style={{ color: C.text2 }}>
            Monthly practitioner-led Circles, included with Membership, or a defined episode of
            individual care, open to everyone.
          </p>
        </div>

        {/* Mobile only — on desktop both panels show and tabs would mislead. */}
        <div
          role="tablist" aria-label="Ways to learn from and work with NI practitioners"
          className="flex md:hidden mb-6" style={{ borderBottom: `1px solid ${C.border}` }}
        >
          <button
            type="button" role="tab" id="tab-circles" aria-controls="panel-circles"
            aria-selected={tab === 'circles'} onClick={() => setTab('circles')}
            style={tabStyle(tab === 'circles')}
          >
            NI Circles
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
            id="circles" role="tabpanel" aria-labelledby="tab-circles"
            className={tab === 'circles' ? 'block' : 'hidden md:block'}
          >
            <CirclesPanel />
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
