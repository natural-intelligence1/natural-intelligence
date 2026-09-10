import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Cormorant_Garamond } from 'next/font/google'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'

// ─── Admin-only pricing page PREVIEW ──────────────────────────────────────────
// Founder-review preview of the launch pricing page. NOT public: it lives
// behind the admin (protected) layout, is linked from no public surface, and is
// marked noindex. Every button is inert. No Stripe, no checkout, no payment or
// subscription logic exists here — this is a picture of the launch product.
// Prices are deliberately unset (Founder decision; the retired 19/49/69/119
// figures must not be cited) — see FounderDecisionNotes at the foot of the page.

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

// NI Brand System V1 (self-contained — the admin app keeps its own dark-shell
// theme, so the preview carries the public palette via explicit values).
const C = {
  cream: '#F4ECDD', warm: '#FBF7EF', sand: '#E7DAC4',
  pine: '#2E4636', botanical: '#1E2F24', sage: '#8AA07E', olive: '#5E6B3F',
  gold: '#B08A3E', goldInk: '#7D6128', goldPale: '#E2D2AE',
  text: '#26302A', text2: '#4A544C', muted: '#5F6862', border: '#E0D4BE',
}

// ─── Inert button (preview only — no handlers, cannot submit) ─────────────────
function InertButton({ children, variant = 'pine' }: { children: React.ReactNode; variant?: 'pine' | 'outline' | 'cream' }) {
  const styles: Record<string, React.CSSProperties> = {
    pine:    { background: C.pine, color: C.cream, border: 'none' },
    outline: { background: 'transparent', color: C.text, border: `1px solid #C6B694` },
    cream:   { background: C.cream, color: C.pine, border: 'none' },
  }
  return (
    <span
      role="button"
      aria-disabled="true"
      title="Preview only — buttons are inert"
      className="inline-flex items-center justify-center px-6 py-3 rounded-full text-[15px] font-medium cursor-default select-none"
      style={styles[variant]}
    >
      {children}
    </span>
  )
}

function Eyebrow({ children, onDark = false }: { children: React.ReactNode; onDark?: boolean }) {
  return (
    <p className="font-mono text-[11px] font-medium tracking-[0.14em] uppercase mb-4" style={{ color: onDark ? C.goldPale : C.goldInk }}>
      {children}
    </p>
  )
}

// ─── 1. PreviewBanner ─────────────────────────────────────────────────────────
function PreviewBanner() {
  return (
    <div className="px-4 py-3 text-center" style={{ background: C.botanical }}>
      <p className="text-[13px] font-medium tracking-wide" style={{ color: C.goldPale }}>
        PREVIEW — not published. Represents the launch product, not current capability.
      </p>
    </div>
  )
}

// ─── 2. PricingHero ───────────────────────────────────────────────────────────
function PricingHero() {
  return (
    <section className="text-center px-4 pt-14 pb-10 max-w-3xl mx-auto">
      <Eyebrow>Pricing</Eyebrow>
      <h1 className={`${cormorant.className} italic font-light text-[34px] md:text-[44px] leading-[1.16] mb-4`} style={{ color: C.text }}>
        Free to learn. Paid where a practitioner gives you their time.
      </h1>
      <p className="text-[15px] font-light leading-[1.75] max-w-xl mx-auto" style={{ color: C.text2 }}>
        The Library, the community and your own tracking tools stay free. You pay
        only for scarce professional value — a qualified practitioner&rsquo;s
        review, judgement and continuing care. Coordination between you and a
        practitioner is arranged by our team, person to person.
      </p>
    </section>
  )
}

// ─── 3. AudiencePathCards ─────────────────────────────────────────────────────
function AudiencePathCards() {
  const paths = [
    { k: 'I want to learn',            d: 'Start free with The Library, community and workshops. No account needed to read.' },
    { k: 'I want to understand my health', d: 'Track your own patterns and ranges with the self-serve tools. They show patterns; they do not diagnose.' },
    { k: 'I want practitioner care',   d: 'Begin with First Care — a qualified practitioner, human-led from the first conversation.' },
    { k: 'I represent an organisation', d: 'Workforce and community sessions, scoped and quoted individually. See NI Corporate below.' },
  ]
  return (
    <section className="px-4 pb-12 max-w-5xl mx-auto">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {paths.map((p) => (
          <div key={p.k} className="rounded-xl p-5" style={{ background: C.warm, border: `1px solid ${C.border}` }}>
            <p className="text-[15px] font-medium mb-1.5" style={{ color: C.pine }}>{p.k}</p>
            <p className="text-[13px] leading-relaxed" style={{ color: C.text2 }}>{p.d}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Tier data ────────────────────────────────────────────────────────────────
interface Tier {
  name: string
  label: string
  price: string
  priceNote?: string
  blurb: string
  features: string[]
  featured?: boolean
  cta: string
}

const TIERS: Tier[] = [
  {
    name: 'NI Knowledge & Community',
    label: 'Free',
    price: 'Free',
    blurb: 'Learning and belonging. The open front door — no payment, ever, for knowledge.',
    features: ['The Library — open reading', 'Community membership', 'Free community workshops', 'Workshop updates'],
    cta: 'Start reading',
  },
  {
    name: 'Your Health, Tracked',
    label: 'Self-serve',
    price: '£ — / month',
    priceNote: 'Founder to set',
    blurb: 'Your own picture, on your own terms. Tools that show patterns and ranges — they do not diagnose.',
    features: ['Lab report organiser & trends', 'Daily habit & protocol tracking', 'Check-ins and personal goals', 'Symptom pattern explorer'],
    cta: 'Track your health',
  },
  {
    name: 'First Care',
    label: 'Practitioner-led',
    price: '£ —',
    priceNote: 'Founder to set · per review',
    blurb: 'Your first practitioner review. A qualified human practitioner considers your picture and responds — you pay for the review requested.',
    features: ['Everything in Tracked', 'Practitioner case review', 'Written, signed response', 'Admin-routed handover — arranged by a person'],
    featured: true,
    cta: 'Begin First Care',
  },
  {
    name: 'Ongoing Support',
    label: 'Practitioner-led',
    price: '£ — / month',
    priceNote: 'Founder to set',
    blurb: 'Continuing care with your practitioner — reviews, adjustments and follow-up over time.',
    features: ['Everything in First Care', 'Scheduled follow-up reviews', 'Protocol adjustments over time', 'Priority workshop access'],
    cta: 'Continue with support',
  },
  {
    name: 'Fully Supported',
    label: 'Human-coordinated',
    price: '£ — / month',
    priceNote: 'Founder to set',
    blurb: 'The most complete arrangement: your practitioner plus our team coordinating around you.',
    features: ['Everything in Ongoing Support', 'Named coordination contact', 'Multi-practitioner coordination', 'Care planning between reviews'],
    cta: 'Enquire',
  },
]

// ─── 4. TierCard ──────────────────────────────────────────────────────────────
function TierCard({ tier }: { tier: Tier }) {
  return (
    <div
      className="rounded-2xl p-6 flex flex-col"
      style={{
        background: tier.featured ? C.pine : C.warm,
        border: `1px solid ${tier.featured ? C.pine : C.border}`,
        boxShadow: '0 1px 3px rgba(38,48,42,0.06), 0 1px 2px rgba(38,48,42,0.04)',
      }}
    >
      <span
        className="self-start font-mono text-[10.5px] tracking-[0.12em] uppercase px-2.5 py-1 rounded-full mb-4"
        style={tier.featured
          ? { background: 'rgba(244,236,221,0.14)', color: C.goldPale, border: '1px solid rgba(244,236,221,0.2)' }
          : { background: C.cream, color: C.goldInk, border: `1px solid ${C.border}` }}
      >
        {tier.label}
      </span>
      <h3 className={`${cormorant.className} text-[24px] font-medium leading-tight mb-1`} style={{ color: tier.featured ? C.cream : C.text }}>
        {tier.name}
      </h3>
      <p className="text-[22px] font-light mb-0.5" style={{ color: tier.featured ? C.goldPale : C.pine }}>{tier.price}</p>
      {tier.priceNote && (
        <p className="font-mono text-[10px] tracking-[0.08em] uppercase mb-3" style={{ color: tier.featured ? 'rgba(244,236,221,0.6)' : C.muted }}>
          {tier.priceNote}
        </p>
      )}
      <p className="text-[13px] leading-relaxed mb-5" style={{ color: tier.featured ? 'rgba(244,236,221,0.8)' : C.text2 }}>
        {tier.blurb}
      </p>
      <ul className="space-y-2 mb-6 flex-1">
        {tier.features.map((f) => (
          <li key={f} className="flex gap-2 text-[13px] leading-snug" style={{ color: tier.featured ? 'rgba(244,236,221,0.85)' : C.text2 }}>
            <span aria-hidden="true" className="mt-[7px] w-1 h-1 rounded-full flex-shrink-0" style={{ background: tier.featured ? C.goldPale : C.gold }} />
            {f}
          </li>
        ))}
      </ul>
      <InertButton variant={tier.featured ? 'cream' : 'outline'}>{tier.cta}</InertButton>
    </div>
  )
}

// ─── Comparison data ──────────────────────────────────────────────────────────
type Cell = 'Included' | 'Add-on' | 'Not included'
const COMPARE: { row: string; cells: Cell[] }[] = [
  { row: 'The Library & community',            cells: ['Included', 'Included', 'Included', 'Included', 'Included'] },
  { row: 'Free community workshops',           cells: ['Included', 'Included', 'Included', 'Included', 'Included'] },
  { row: 'Self-serve tracking tools',          cells: ['Not included', 'Included', 'Included', 'Included', 'Included'] },
  { row: 'Practitioner case review',           cells: ['Not included', 'Not included', 'Included', 'Included', 'Included'] },
  { row: 'Signed practitioner response',       cells: ['Not included', 'Not included', 'Included', 'Included', 'Included'] },
  { row: 'Scheduled follow-up reviews',        cells: ['Not included', 'Not included', 'Add-on', 'Included', 'Included'] },
  { row: 'Named coordination contact',         cells: ['Not included', 'Not included', 'Not included', 'Add-on', 'Included'] },
  { row: 'Multi-practitioner coordination',    cells: ['Not included', 'Not included', 'Not included', 'Not included', 'Included'] },
]
const TIER_SHORT = ['Knowledge', 'Tracked', 'First Care', 'Ongoing', 'Fully Supported']

function CellMark({ v }: { v: Cell }) {
  const map: Record<Cell, { t: string; c: string }> = {
    'Included':     { t: 'Included',     c: '#4A6B4F' },
    'Add-on':       { t: 'Add-on',       c: C.goldInk },
    'Not included': { t: '—',            c: C.muted },
  }
  return <span className="text-[12px] font-medium" style={{ color: map[v].c }}>{map[v].t}</span>
}

// ─── 5. ComparisonAccordionMobile (native <details> — no JS) ─────────────────
function ComparisonAccordionMobile() {
  return (
    <div className="md:hidden space-y-2">
      {TIERS.map((tier, i) => (
        <details key={tier.name} className="rounded-xl overflow-hidden" style={{ background: C.warm, border: `1px solid ${C.border}` }}>
          <summary className="px-5 py-4 cursor-pointer text-[14px] font-medium list-none flex justify-between items-center" style={{ color: C.text }}>
            {tier.name}
            <span className="font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: C.goldInk }}>{tier.label}</span>
          </summary>
          <div className="px-5 pb-4 space-y-2" style={{ borderTop: `1px solid ${C.border}` }}>
            {COMPARE.map((r) => (
              <div key={r.row} className="flex justify-between gap-3 pt-2 text-[13px]" style={{ color: C.text2 }}>
                <span>{r.row}</span>
                <CellMark v={r.cells[i]} />
              </div>
            ))}
          </div>
        </details>
      ))}
    </div>
  )
}

// ─── 6. ComparisonTableDesktop ────────────────────────────────────────────────
function ComparisonTableDesktop() {
  return (
    <div className="hidden md:block overflow-x-auto rounded-2xl" style={{ background: C.warm, border: `1px solid ${C.border}` }}>
      <table className="w-full text-left">
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
            <th className="px-5 py-4 text-[12px] font-mono uppercase tracking-[0.1em] font-medium" style={{ color: C.muted }}>What you get</th>
            {TIER_SHORT.map((t) => (
              <th key={t} className="px-4 py-4 text-[13px] font-medium text-center" style={{ color: C.pine }}>{t}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPARE.map((r, ri) => (
            <tr key={r.row} style={{ borderBottom: ri < COMPARE.length - 1 ? `1px solid ${C.border}` : 'none' }}>
              <td className="px-5 py-3 text-[13px]" style={{ color: C.text2 }}>{r.row}</td>
              {r.cells.map((c, ci) => (
                <td key={ci} className="px-4 py-3 text-center"><CellMark v={c} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── 7. CorporateBlock ────────────────────────────────────────────────────────
function CorporateBlock() {
  return (
    <section className="rounded-2xl p-8 md:p-10 relative overflow-hidden" style={{ background: C.pine }}>
      <div aria-hidden="true" className="pointer-events-none absolute -top-24 -right-20 w-80 h-80 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(176,138,62,0.15), transparent 68%)' }} />
      <div className="relative grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        <div>
          <Eyebrow onDark>NI Corporate · By proposal</Eyebrow>
          <h2 className={`${cormorant.className} text-[30px] font-light leading-tight mb-3`} style={{ color: C.cream }}>
            Health education for your workforce or community.
          </h2>
          <p className="text-[14px] leading-relaxed mb-6" style={{ color: 'rgba(244,236,221,0.8)' }}>
            Practitioner-led sessions for workplaces, care settings and community
            organisations — education and wellbeing, scoped to your setting.
            Enquiry, scope, quote, deliver: every engagement is priced by proposal.
          </p>
          <InertButton variant="cream">Enquire about NI Corporate</InertButton>
        </div>
        <ul className="space-y-3">
          {['Workforce health education sessions', 'Care-home education and support visits', 'Organisation wellbeing programmes', 'Delivered by qualified practitioners'].map((f) => (
            <li key={f} className="flex gap-2 text-[13.5px]" style={{ color: 'rgba(244,236,221,0.85)' }}>
              <span aria-hidden="true" className="mt-[7px] w-1 h-1 rounded-full flex-shrink-0" style={{ background: C.goldPale }} />
              {f}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

// ─── 8. SubsidisedAccessBlock ─────────────────────────────────────────────────
function SubsidisedAccessBlock() {
  return (
    <section className="rounded-2xl p-8 text-center" style={{ background: C.sand, border: `1px solid ${C.border}` }}>
      <Eyebrow>Subsidised access · Eligibility-based</Eyebrow>
      <h2 className={`${cormorant.className} text-[26px] font-light mb-3`} style={{ color: C.text }}>
        Cost should not be the reason you go without care.
      </h2>
      <p className="text-[14px] leading-relaxed max-w-xl mx-auto mb-5" style={{ color: C.text2 }}>
        A limited number of subsidised places are available on our practitioner-led
        tiers, assessed on eligibility. Tell us your situation and our team will
        respond personally.
      </p>
      <InertButton variant="outline">Ask about subsidised access</InertButton>
    </section>
  )
}

// ─── 9. PricingFAQ ────────────────────────────────────────────────────────────
const FAQS: { q: string; a: string }[] = [
  {
    q: 'Do the tools diagnose anything?',
    a: 'No. The self-serve tools organise your own information and show patterns and ranges over time. They do not diagnose, treat or make any clinical judgement — that is always the work of a qualified human practitioner.',
  },
  {
    q: 'How am I matched with a practitioner?',
    a: 'You are not matched by software. Our team routes your request to a practitioner personally — coordination is human and admin-arranged at every step.',
  },
  {
    q: 'What exactly am I paying for on the care tiers?',
    a: 'A qualified practitioner’s time and judgement: the review you request, the written response they sign, and — on the ongoing tiers — their continuing attention over time.',
  },
  {
    q: 'Can I stay on the free tier forever?',
    a: 'Yes. The Library, the community and free community workshops are not a trial — they are a permanent part of what Natural Intelligence is.',
  },
  {
    q: 'Does Natural Intelligence replace my GP?',
    a: 'No. Natural Intelligence supports care; it does not replace medical care, and it is not an emergency service. In an emergency call 999, or use NHS 111 for urgent concerns.',
  },
]

function PricingFAQ() {
  return (
    <section className="max-w-2xl mx-auto">
      <h2 className={`${cormorant.className} text-[30px] font-light text-center mb-6`} style={{ color: C.text }}>
        Fair questions
      </h2>
      <div className="space-y-2">
        {FAQS.map((f) => (
          <details key={f.q} className="rounded-xl" style={{ background: C.warm, border: `1px solid ${C.border}` }}>
            <summary className="px-5 py-4 cursor-pointer text-[14px] font-medium list-none" style={{ color: C.text }}>{f.q}</summary>
            <p className="px-5 pb-4 text-[13.5px] leading-relaxed" style={{ color: C.text2 }}>{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

// ─── 10. FounderDecisionNotes (admin-facing, would not ship publicly) ─────────
function FounderDecisionNotes() {
  const notes = [
    'Prices are unset on every paid tier ("£ —"). The retired 19/49/69/119 figures are not used and must not return. Founder to set launch prices.',
    'Tier names, labels and the Included/Add-on grid are proposals for review — nothing here is published.',
    'First Care is presented as the featured tier; confirm or reorder.',
    'Subsidised access is worded as eligibility-based with no donation, charity or charitable-structure language, per the open legal question.',
    'Corporate is by-proposal only, mirroring the Plan of Record lane (enquiry → scope → quote → deliver).',
    'All CTAs are inert. Publishing any of this requires: prices set, Stripe/billing built (currently none exists), and the Sprint 3 safety floor for the care tiers.',
  ]
  return (
    <section className="rounded-2xl p-6" style={{ background: C.warm, border: `2px dashed ${C.gold}` }}>
      <p className="font-mono text-[11px] tracking-[0.14em] uppercase font-medium mb-3" style={{ color: C.goldInk }}>
        Founder decision notes — admin-only, not part of the public page
      </p>
      <ul className="space-y-2">
        {notes.map((n) => (
          <li key={n} className="flex gap-2 text-[13px] leading-relaxed" style={{ color: C.text2 }}>
            <span aria-hidden="true" className="mt-[7px] w-1 h-1 rounded-full flex-shrink-0" style={{ background: C.gold }} />
            {n}
          </li>
        ))}
      </ul>
    </section>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function PricingPreviewPage() {
  // Defence-in-depth: the (protected) layout enforces this; repeated per convention.
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('https://natural-intelligence.uk')

  return (
    <div className="min-h-screen" style={{ background: C.cream, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <PreviewBanner />
      <PricingHero />
      <AudiencePathCards />

      <section className="px-4 pb-12 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          {TIERS.map((t) => <TierCard key={t.name} tier={t} />)}
        </div>
      </section>

      <section className="px-4 pb-12 max-w-6xl mx-auto">
        <h2 className={`${cormorant.className} text-[30px] font-light text-center mb-6`} style={{ color: C.text }}>
          Compare in detail
        </h2>
        <ComparisonAccordionMobile />
        <ComparisonTableDesktop />
      </section>

      <div className="px-4 pb-12 max-w-6xl mx-auto space-y-6">
        <CorporateBlock />
        <SubsidisedAccessBlock />
      </div>

      <div className="px-4 pb-12">
        <PricingFAQ />
      </div>

      {/* Clinical boundary — canonical three-clause wording */}
      <div className="py-5 px-4" style={{ background: C.sand, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <p className="text-center text-[13px] leading-[1.7] max-w-3xl mx-auto" style={{ color: C.text2 }}>
          <strong className="font-medium" style={{ color: C.text }}>A qualified human practitioner is always responsible for clinical judgement.</strong>{' '}
          Natural Intelligence supports care; it does not replace medical care.
          Technology here organises and assists — it makes no clinical decision.
        </p>
      </div>

      <div className="px-4 py-10 max-w-4xl mx-auto">
        <FounderDecisionNotes />
      </div>
    </div>
  )
}
