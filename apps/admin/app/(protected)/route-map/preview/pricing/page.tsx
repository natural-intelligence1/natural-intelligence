import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Cormorant_Garamond } from 'next/font/google'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'
import {
  MEMBERSHIP, MEMBERSHIP_HEADLINE, MEMBERSHIP_YEARLY_NOTE, FAMILY_MEMBERSHIP_NOTE,
  GUIDED_GROUPS, INITIAL_CARE_REVIEW, formatPounds, inlinePriceLabel,
} from '@natural-intelligence/db/pricing'
import { C } from './theme'
import { InertButton, Eyebrow, Tick, Dash, StatusPill } from './primitives'
import { CareSection } from './CareSection'
import { Disclosures } from './Disclosures'
import { FaqAccordion } from './FaqAccordion'

// ─── Admin-only pricing page PREVIEW — v7 ────────────────────────────────────
// Founder-review preview of the launch pricing page. NOT public: it lives
// behind the admin (protected) layout, is linked from no public surface, and
// is marked noindex. Every call to action is inert. No payment provider, no
// basket and no subscription logic exists here — this is a picture of the
// launch product, not the product.
//
// WHAT CHANGED IN v7
//
// The page this replaced was committed on 10 September and still advertised
// two tiers the frozen architecture had withdrawn — a paid self-serve
// tracking tier and a human-coordinated tier — with their prices left unset
// for the Founder. It is replaced wholesale because it shared almost no
// sections with the frozen architecture, not because a rewrite was the
// smaller change.
//
// PRICES LIVE IN ONE PLACE
//
// Every figure comes from @natural-intelligence/db/pricing. No currency
// literal appears anywhere in this directory, and previewPageBoundary.test.ts
// fails if one does — including a bare figure typed without a symbol.
//
// Internal professional-time allowances are NOT importable here: they sit in
// the catalogue's PRACTITIONER_TIME_ALLOWANCES namespace, which the public
// barrel does not re-export, and a test sweeps apps/ to keep it that way.

export const metadata: Metadata = {
  title: 'Pricing — Preview',
  robots: { index: false, follow: false },
}

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
})

const display = cormorant.className

// ─── Preview banner ──────────────────────────────────────────────────────────

function PreviewBanner() {
  return (
    <div className="px-4 py-3" style={{ background: C.botanical }}>
      <p className="max-w-5xl mx-auto text-[12.5px] leading-[1.6]" style={{ color: C.goldPale }}>
        <strong className="font-semibold">Founder preview — not public.</strong>{' '}
        Admin-only, noindexed and linked from no public page. Every call to action is inert; the
        programme switcher, care-team toggle, mobile tabs, disclosures and questions work so their
        behaviour can be reviewed. Care prices are working prices pending final sign-off.
      </p>
    </div>
  )
}

// ─── Hero ────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="px-4 pt-14 pb-10" style={{ background: C.cream }}>
      <div className="max-w-3xl mx-auto text-center">
        <Eyebrow>Pricing</Eyebrow>
        <h1 className={`${display} text-[40px] sm:text-[52px] font-light leading-[1.1] mb-5`} style={{ color: C.text }}>
          Free to begin. Membership for continuity.
          <span className="block italic" style={{ color: C.pine }}>
            Professional care when you need it.
          </span>
        </h1>
        <p className="text-[15.5px] leading-[1.75] max-w-2xl mx-auto" style={{ color: C.text2 }}>
          NI keeps learning and community open to everyone, helps you build a living health record
          over time, and charges separately only when a qualified professional gives you their
          time.
        </p>
      </div>
    </section>
  )
}

// ─── What would you like from NI? ────────────────────────────────────────────

const ROUTES: readonly { want: string; name: string; href: string }[] = [
  { want: 'I want to learn', name: 'NI Free', href: '#free' },
  { want: 'I want NI to organise my health over time', name: 'NI Membership', href: '#membership' },
  { want: 'I want my household’s health records connected', name: 'NI Family Membership', href: '#family' },
  { want: 'I want affordable practitioner-led support', name: 'NI Guided Groups', href: '#groups' },
  { want: 'I want individual practitioner care', name: 'NI Care 1-to-1', href: '#one-to-one' },
  { want: 'I represent an organisation', name: 'NI for Organisations', href: '#organisations' },
]

function AudiencePaths() {
  return (
    <section className="px-4 pb-14" style={{ background: C.cream }}>
      <div className="max-w-5xl mx-auto">
        <h2 className={`${display} text-[28px] font-light text-center mb-6`} style={{ color: C.text }}>
          What would you like from NI?
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ROUTES.map((r) => (
            <a
              key={r.name}
              href={r.href}
              className="block rounded-xl p-4 transition-colors hover:bg-white"
              style={{ background: C.warm, border: `1px solid ${C.border}` }}
            >
              <p className="text-[13px] leading-[1.5] mb-2" style={{ color: C.muted }}>{r.want}</p>
              <p className="text-[15px] font-medium flex items-center gap-2" style={{ color: C.text }}>
                {r.name}
                <span aria-hidden style={{ color: C.gold }}>→</span>
              </p>
            </a>
          ))}
        </div>
        <p className="text-center text-[13px] mt-5" style={{ color: C.muted }}>
          These are choices, not steps. Use one, or combine them. Membership is never required for
          professional care.
        </p>
      </div>
    </section>
  )
}

// ─── Your health record and continuity ───────────────────────────────────────

function RecordCards() {
  const card: React.CSSProperties = { background: C.warm, border: `1px solid ${C.border}` }

  return (
    <section className="px-4 py-14" style={{ background: C.warm }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <Eyebrow>Your health record and continuity</Eyebrow>
          <p className="text-[14.5px] leading-[1.7] max-w-2xl mx-auto" style={{ color: C.text2 }}>
            These products organise your health over time. None of them include practitioner time.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
          {/* NI Free */}
          <div id="free" className="rounded-2xl p-6 sm:p-7 h-full" style={{ ...card, background: '#FFFDF9' }}>
            <div className="flex items-center justify-between mb-4">
              <span className="font-mono text-[11px] tracking-[0.12em] uppercase" style={{ color: C.goldInk }}>
                To begin
              </span>
              <StatusPill>Open now</StatusPill>
            </div>
            <h3 className={`${display} text-[24px] font-light mb-1`} style={{ color: C.text }}>NI Free</h3>
            <p className="text-[32px] leading-none font-light mb-1" style={{ color: C.text }}>Free</p>
            <p className="text-[13px] mb-4" style={{ color: C.muted }}>No card needed</p>
            <p className="text-[14px] leading-[1.7] mb-5" style={{ color: C.text2 }}>
              Begin organising and understanding your own health.
            </p>
            <ul className="space-y-2 mb-6">
              <Tick>NI Knowledge — free health education</Tick>
              <Tick>The NI community</Tick>
              <Tick>Free community workshops</Tick>
              <Tick>Basic self-serve health organisation, where available</Tick>
              <Dash>No practitioner time included</Dash>
            </ul>
            <InertButton variant="outline">Start Free</InertButton>
          </div>

          {/* NI Membership */}
          <div
            id="membership"
            className="rounded-2xl p-6 sm:p-7 h-full"
            style={{ background: '#FFFDF9', border: `1.5px solid ${C.goldLine}` }}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="font-mono text-[11px] tracking-[0.12em] uppercase" style={{ color: C.goldInk }}>
                For continuity
              </span>
              <StatusPill>Opening soon</StatusPill>
            </div>
            <h3 className={`${display} text-[24px] font-light mb-1`} style={{ color: C.text }}>NI Membership</h3>
            <p className="text-[32px] leading-none font-light mb-1" style={{ color: C.text }}>
              {MEMBERSHIP_HEADLINE}
              <span className="text-[15px] font-normal ml-1" style={{ color: C.muted }}>/ month</span>
            </p>
            {/* No Monthly/Yearly selector: both figures are stated, with the saving. */}
            <p className="text-[13px] mb-4" style={{ color: C.muted }}>{MEMBERSHIP_YEARLY_NOTE}</p>
            <p className="text-[14px] leading-[1.7] mb-5" style={{ color: C.text2 }}>
              Your health story, organised over time.
            </p>
            <ul className="space-y-2 mb-6">
              <Tick>Your living, longitudinal health record</Tick>
              <Tick>BioHub — your results in one organised place</Tick>
              <Tick>LifeTracker — tracking over time</Tick>
              <Tick>Continuity across NI and connected tools</Tick>
              <Tick>Preferential pricing on NI professional care</Tick>
              <Dash>No practitioner time or appointments included</Dash>
            </ul>
            <InertButton>Register interest</InertButton>
          </div>

          {/* NI Family Membership */}
          <div id="family" className="rounded-2xl p-6 sm:p-7 h-full" style={{ ...card, background: '#FFFDF9' }}>
            <div className="flex items-center justify-between mb-4">
              <span className="font-mono text-[11px] tracking-[0.12em] uppercase" style={{ color: C.goldInk }}>
                For your household
              </span>
              <StatusPill>Opening later</StatusPill>
            </div>
            <h3 className={`${display} text-[24px] font-light mb-1`} style={{ color: C.text }}>
              NI Family Membership
            </h3>
            <p className="text-[20px] leading-tight font-light mb-1" style={{ color: C.text }}>
              {FAMILY_MEMBERSHIP_NOTE}
            </p>
            <p className="text-[13px] mb-4" style={{ color: C.muted }}>
              Priced per household · adults only at launch
            </p>
            <p className="text-[14px] leading-[1.7] mb-4" style={{ color: C.text2 }}>
              One connected household. Private records for each adult.
            </p>
            <p className="font-mono text-[10.5px] tracking-[0.12em] uppercase mb-3" style={{ color: C.goldInk }}>
              Shared household context
            </p>
            <ul className="space-y-2 mb-6">
              <Tick>A separate, private record for each adult</Tick>
              <Tick>
                Shared household context, only where each adult consents — family history, cooking,
                water, mould, pets, home environment
              </Tick>
              <Tick>The account holder never sees another adult’s record automatically</Tick>
              <Dash>Not family care: care is per person, per episode</Dash>
            </ul>
            <InertButton variant="outline">Register interest</InertButton>
          </div>
        </div>

        {/* The membership boundary — the most important line on this page. */}
        <div
          className="mt-8 rounded-xl px-6 py-5 text-center"
          style={{ background: C.sand, border: `1px solid ${C.border}` }}
        >
          <p className={`${display} text-[20px] font-light leading-snug mb-2`} style={{ color: C.text }}>
            Membership pays for continuity. Professional care pays for defined human input.
          </p>
          <p className="text-[13.5px]" style={{ color: C.text2 }}>
            Membership is not required for professional care. Members receive preferential pricing.
          </p>
        </div>
      </div>
    </section>
  )
}

// ─── At a glance ─────────────────────────────────────────────────────────────

function AtAGlance() {
  const COLS = ['NI Free', 'Membership', 'Family Membership', 'Guided Groups', 'NI Care 1-to-1']

  // Every price cell is composed from the catalogue — no figure is typed here.
  const ROWS: readonly (readonly string[])[] = [
    [
      'Price',
      'Free',
      `${formatPounds(MEMBERSHIP.monthly)}/month or ${formatPounds(MEMBERSHIP.yearly)}/year`,
      FAMILY_MEMBERSHIP_NOTE,
      inlinePriceLabel(GUIDED_GROUPS),
      `Initial Review ${inlinePriceLabel(INITIAL_CARE_REVIEW)}`,
    ],
    ['Your health record', 'Basic, where available', 'Living, longitudinal', 'Private record per adult', 'Programme tracking', 'One connected record'],
    ['Practitioner time', 'Not included', 'Not included', 'Not included', 'Programme-based', 'Included in this episode'],
    ['Individual signed Protocol', 'Not included', 'Not included', 'Not included', 'Available separately', 'Included in this episode'],
    ['Specialist input', '—', '—', '—', 'Programme-based', 'Scoped if needed'],
    ['Member pricing on care', '—', 'Preferential member pricing', 'Preferential member pricing', 'Preferential member pricing', 'Preferential member pricing'],
  ]

  return (
    <section className="px-4 py-14" style={{ background: C.warm }}>
      <div className="max-w-6xl mx-auto">
        <h2 className={`${display} text-[30px] font-light text-center mb-7`} style={{ color: C.text }}>
          At a glance
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]" style={{ minWidth: 760, borderCollapse: 'collapse' }}>
            <caption className="sr-only">
              NI products and professional care compared across price, record, practitioner time,
              Protocol, specialist input and member pricing.
            </caption>
            <thead>
              <tr>
                <th scope="col" className="text-left p-3" style={{ borderBottom: `1px solid ${C.border}` }} />
                {COLS.map((c) => (
                  <th
                    key={c} scope="col"
                    className="text-left p-3 font-medium text-[13px]"
                    style={{ color: C.text, borderBottom: `1px solid ${C.border}` }}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row[0]}>
                  <th
                    scope="row"
                    className="text-left p-3 font-medium align-top whitespace-nowrap"
                    style={{ color: C.text, borderBottom: `1px solid ${C.border}` }}
                  >
                    {row[0]}
                  </th>
                  {row.slice(1).map((cell, i) => (
                    <td
                      key={`${row[0]}-${COLS[i]}`}
                      className="p-3 align-top leading-[1.6]"
                      style={{ color: C.text2, borderBottom: `1px solid ${C.border}` }}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

// ─── Organisations and subsidised access ─────────────────────────────────────

function OrganisationsAndAccess() {
  return (
    <section className="px-4 py-12" style={{ background: C.cream }}>
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-5">
        <div id="organisations" className="rounded-2xl p-7" style={{ background: C.warm, border: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between mb-4">
            <span className="font-mono text-[11px] tracking-[0.12em] uppercase" style={{ color: C.goldInk }}>
              For organisations
            </span>
            <StatusPill>Bespoke</StatusPill>
          </div>
          <h3 className={`${display} text-[24px] font-light mb-3`} style={{ color: C.text }}>
            NI for Organisations
          </h3>
          <p className="text-[14px] leading-[1.7] mb-5" style={{ color: C.text2 }}>
            Health education, workforce wellbeing and practitioner-led programmes, shaped to your
            people and priced by proposal.
          </p>
          <div className="flex flex-wrap gap-2 mb-6">
            {['Employers', 'Care homes', 'Community organisations', 'Health education', 'Workforce wellbeing', 'Commissioned group support'].map((t) => (
              <span
                key={t}
                className="inline-block text-[12.5px]"
                style={{ border: `1px solid ${C.border}`, borderRadius: 999, padding: '4px 11px', color: C.text2 }}
              >
                {t}
              </span>
            ))}
          </div>
          <InertButton variant="outline">Talk to us</InertButton>
        </div>

        <div className="rounded-2xl p-7" style={{ background: C.warm, border: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between mb-4">
            <span className="font-mono text-[11px] tracking-[0.12em] uppercase" style={{ color: C.goldInk }}>
              Subsidised access
            </span>
            <StatusPill>Based on eligibility</StatusPill>
          </div>
          <h3 className={`${display} text-[24px] font-light mb-3`} style={{ color: C.text }}>
            Cost should not be the reason you go without care.
          </h3>
          <p className="text-[14px] leading-[1.7] mb-6" style={{ color: C.text2 }}>
            A limited number of subsidised places may be offered, based on eligibility. Ask us
            about it — we’ll explain what’s available when care opens.
          </p>
          <InertButton variant="outline">Ask about eligibility</InertButton>
        </div>
      </div>
    </section>
  )
}

// ─── Other ways to join NI ───────────────────────────────────────────────────

function OtherWaysToJoin() {
  const ways = [
    {
      eyebrow: 'For practitioners',
      name: 'Practitioner Network',
      body: 'Practitioners don’t pay to reach NI clients. Join for organised cases, NI referrals and NI-paid professional work as care opens.',
      cta: 'Join the Practitioner Network →',
    },
    {
      eyebrow: 'For students & graduates',
      name: 'NI Student & Graduate Community',
      body: 'Learn alongside practitioners, with supervised experience as NI’s pathways open. There’s no fee to join.',
      cta: 'Join the Student & Graduate Community →',
    },
  ]

  return (
    <section className="px-4 py-12" style={{ background: C.botanical }}>
      <div className="max-w-5xl mx-auto">
        <h2 className={`${display} text-[26px] font-light text-center mb-7`} style={{ color: C.cream }}>
          Other ways to join NI
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {ways.map((w) => (
            <div
              key={w.name}
              className="rounded-2xl p-6"
              style={{ border: `1px solid rgba(226,210,174,0.3)` }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-[11px] tracking-[0.12em] uppercase" style={{ color: C.goldPale }}>
                  {w.eyebrow}
                </span>
                <span
                  className="font-mono text-[10.5px] tracking-[0.1em] uppercase"
                  style={{ color: C.cream, border: `1px solid ${C.goldPale}`, borderRadius: 999, padding: '3px 9px' }}
                >
                  Free
                </span>
              </div>
              <h3 className={`${display} text-[21px] font-light mb-3`} style={{ color: C.cream }}>
                {w.name}
              </h3>
              <p className="text-[13.5px] leading-[1.7] mb-5" style={{ color: 'rgba(244,236,221,0.78)' }}>
                {w.body}
              </p>
              <InertButton variant="cream">{w.cta}</InertButton>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Closing ─────────────────────────────────────────────────────────────────

function Closing() {
  return (
    <section className="px-4 py-14" style={{ background: C.cream }}>
      <div className="max-w-2xl mx-auto text-center">
        <h2 className={`${display} text-[34px] font-light leading-tight mb-3`} style={{ color: C.text }}>
          Begin free.
          <span className="block italic" style={{ color: C.pine }}>
            Add continuity or care when it helps.
          </span>
        </h2>
        <div className="flex flex-wrap gap-3 justify-center mt-7">
          <InertButton>Start Free</InertButton>
          <InertButton variant="outline">Explore NI Knowledge</InertButton>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="px-4 py-10" style={{ background: C.botanical }}>
      <div className="max-w-3xl mx-auto text-center">
        <p className={`${display} text-[19px] font-light`} style={{ color: C.cream }}>
          Natural Intelligence
        </p>
        <p className={`${display} text-[14px] italic mb-5`} style={{ color: C.goldPale }}>
          The signs are within you.
        </p>
        <p className="text-[12.5px] leading-[1.7]" style={{ color: 'rgba(244,236,221,0.7)' }}>
          Natural Intelligence works alongside your GP and NHS care. It is not an emergency
          service. If you need urgent medical help, call 999 or use NHS 111.
        </p>
      </div>
    </footer>
  )
}

// ─── Founder decision notes — open items only ────────────────────────────────

function FounderDecisionNotes() {
  const items: readonly { title: string; body: string }[] = [
    {
      title: 'Paid-service, subscription, refund and cancellation terms',
      body: 'Legal lane. Required before billing activation. Nothing on this page creates a contract, and no payment path exists in the code.',
    },
    {
      title: 'Guided Groups example programmes and discipline panels are placeholders',
      body: 'The four example programmes and their practitioner panels are illustrative only. Each real Guided Group will state its own duration, group size, panel and price before anyone joins.',
    },
    {
      title: 'Family Membership pricing is TBC',
      body: 'The card and the comparison both say so rather than showing a figure. Adults only at launch, priced per household.',
    },
    {
      title: 'Working prices are pending final sign-off',
      body: 'Every care price carries a visible working-price tag on this preview. One flag in the pricing catalogue removes all of them when the prices are final — no page edit needed.',
    },
    {
      title: 'The consultation timer is blocked until the care workspace ships to main',
      body: 'Internal professional-time allowances are stored in the catalogue, unrendered. The timer, its phase log and the exception queue are not built. The phase-log table needs separate Founder approval, because the architecture moratorium applies.',
    },
  ]

  return (
    <div className="rounded-xl p-6" style={{ background: C.warm, border: `1px dashed ${C.goldLine}` }}>
      <p className="font-mono text-[11px] tracking-[0.12em] uppercase mb-1" style={{ color: C.goldInk }}>
        Founder decision notes
      </p>
      <p className="text-[12.5px] mb-5" style={{ color: C.muted }}>
        Open items only. Internal — this block is part of the preview, not the public page.
      </p>
      <ol className="space-y-4">
        {items.map((it, i) => (
          <li key={it.title} className="flex gap-3">
            <span
              aria-hidden
              className="flex-shrink-0 font-mono text-[12px] mt-0.5"
              style={{ color: C.goldInk }}
            >
              {i + 1}.
            </span>
            <span>
              <span className="block text-[14px] font-medium" style={{ color: C.text }}>{it.title}</span>
              <span className="block text-[13px] leading-[1.7] mt-1" style={{ color: C.text2 }}>
                {it.body}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────
// The guard and the presentation are separate functions on purpose: the guard
// is the only thing that decides who may see this, so it should be readable
// on its own rather than buried at the top of three hundred lines of markup.

function PricingPreviewBody() {
  return (
    <div className="min-h-screen" style={{ background: C.cream, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <PreviewBanner />
      <Hero />
      <AudiencePaths />
      <RecordCards />
      <CareSection />
      <AtAGlance />
      <OrganisationsAndAccess />
      <OtherWaysToJoin />
      <Disclosures />

      <div className="px-4 py-14" style={{ background: C.cream }}>
        <FaqAccordion />
      </div>

      {/* Clinical boundary — canonical three-clause wording */}
      <div className="py-5 px-4" style={{ background: C.sand, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <p className="text-center text-[13px] leading-[1.7] max-w-3xl mx-auto" style={{ color: C.text2 }}>
          <strong className="font-medium" style={{ color: C.text }}>
            A qualified human practitioner is always responsible for clinical judgement.
          </strong>{' '}
          Natural Intelligence supports care; it does not replace medical care.
          Technology here organises and assists — it makes no clinical decision.
        </p>
      </div>

      <Closing />

      <div className="px-4 pb-12 max-w-4xl mx-auto">
        <FounderDecisionNotes />
      </div>

      <Footer />
    </div>
  )
}

export default async function PricingPreviewPage() {
  // Defence-in-depth: the (protected) layout enforces this; repeated per convention.
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('https://natural-intelligence.uk')

  return <PricingPreviewBody />
}
