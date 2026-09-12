import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Cormorant_Garamond } from 'next/font/google'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'

// ─── Admin-only pricing page PREVIEW (editorial redesign) ─────────────────────
// Founder-review preview of the launch pricing page. NOT public: it lives
// behind the admin (protected) layout, is linked from no public surface, and is
// marked noindex. Every button is inert. No Stripe, no checkout, no payment or
// subscription logic exists here — this is a picture of the launch product.
// Prices are deliberately unset (Founder decision; the retired 19/49/69/119
// figures must not be cited) — see FounderDecisionNotes at the foot of the page.
//
// Design intent: calm, editorial, Apple-like restraint within NI's brand.
// The page is built around one story — Learn free. Track your health. Bring in
// a practitioner. Coordinate the right people around you. — with each line
// becoming a tier section. Few words, generous space, no gradients, no motion.

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
  pine: '#2E4636', botanical: '#1E2F24',
  gold: '#B08A3E', goldInk: '#7D6128', goldPale: '#E2D2AE',
  text: '#26302A', text2: '#4A544C', muted: '#5F6862', border: '#E0D4BE',
}

// ─── Inert button (preview only — no handlers, cannot submit) ─────────────────
function InertButton({ children, variant = 'pine' }: { children: React.ReactNode; variant?: 'pine' | 'outline' | 'cream' }) {
  const styles: Record<string, React.CSSProperties> = {
    pine:    { background: C.pine, color: C.cream, border: 'none' },
    outline: { background: 'transparent', color: C.text, border: '1px solid #C6B694' },
    cream:   { background: C.cream, color: C.pine, border: 'none' },
  }
  return (
    <span
      role="button"
      aria-disabled="true"
      title="Preview only — buttons are inert"
      className="inline-flex items-center justify-center px-7 py-3 rounded-full text-[15px] font-medium cursor-default select-none"
      style={styles[variant]}
    >
      {children}
    </span>
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

// ─── 2. Hero — the story, and almost nothing else ─────────────────────────────
function PricingHero() {
  const lines = [
    'Learn free.',
    'Track your health.',
    'Bring in a practitioner.',
    'Coordinate the right people around you.',
  ]
  return (
    <section className="text-center px-6 pt-24 pb-20 md:pt-32 md:pb-28 max-w-3xl mx-auto">
      <h1 className={`${cormorant.className} font-light text-[38px] md:text-[54px] leading-[1.18]`} style={{ color: C.text }}>
        {lines.map((l) => (
          <span key={l} className="block">{l}</span>
        ))}
      </h1>
      <p className="text-[15px] font-light leading-[1.8] max-w-md mx-auto mt-10" style={{ color: C.text2 }}>
        Knowledge is free, always. You pay only where a qualified practitioner
        gives you their time.
      </p>
    </section>
  )
}

// ─── Tier data — one section per story line ───────────────────────────────────
interface Tier {
  story: string
  name: string
  price: string
  priceNote?: string
  line: string
  features: string[]
  stages?: { title: string; items: string[] }[]
  featured?: boolean
  cta: string
}

const TIERS: Tier[] = [
  {
    story: 'Learn free',
    name: 'NI Knowledge & Community',
    price: 'Free, always',
    line: 'The Library, the community and free workshops. Open to everyone — knowledge is never behind a price.',
    features: ['The Library — open reading', 'Community membership', 'Free community workshops'],
    cta: 'Start reading',
  },
  {
    story: 'Track your health',
    name: 'Your Health, Tracked',
    price: '£ — per month',
    priceNote: 'Price to be set',
    line: 'Your own patterns, quietly organised. These tools show — they do not diagnose.',
    features: ['Lab report organiser and trends', 'Daily habit and protocol tracking', 'Check-ins and personal goals', 'Symptom pattern explorer'],
    cta: 'Track your health',
  },
  {
    story: 'Bring in a practitioner',
    name: 'NI Care',
    price: '£ —',
    priceNote: 'Price to be set',
    line: 'One care journey, led by a qualified practitioner from the first conversation. Begin with intake, consultation and your personal plan. Continue with follow-ups, labs and plan updates for as long as it serves you. Everything in Tracked is included.',
    features: [],
    stages: [
      { title: 'Begin', items: ['Intake and consultation', 'Full case-taking', 'Your personal naturopathic plan'] },
      { title: 'Continue', items: ['Follow-up reviews', 'Lab discounts and practitioner lab analysis', 'Plan updates over time'] },
    ],
    featured: true,
    cta: 'Begin NI Care',
  },
  {
    story: 'Coordinate the right people around you',
    name: 'Fully Supported',
    price: '£ — per month',
    priceNote: 'Price to be set',
    line: 'Everything in NI Care, with our team coordinating the right people around you — personally, not by software.',
    features: ['A named coordination contact', 'Multi-practitioner coordination', 'Care planning between reviews'],
    cta: 'Enquire',
  },
]

// ─── 3. TierSection — a wide editorial row, not a SaaS card ──────────────────
function TierSection({ tier, last }: { tier: Tier; last: boolean }) {
  const inner = (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12">
      {/* Left: story + name + line */}
      <div className="md:col-span-7">
        <p className="font-mono text-[11px] font-medium tracking-[0.16em] uppercase mb-4" style={{ color: C.goldInk }}>
          {tier.story}
        </p>
        <h2 className={`${cormorant.className} text-[30px] md:text-[36px] font-light leading-tight mb-4`} style={{ color: C.text }}>
          {tier.name}
        </h2>
        <p className="text-[15px] font-light leading-[1.8] max-w-xl" style={{ color: C.text2 }}>
          {tier.line}
        </p>
      </div>

      {/* Right: price, features, CTA */}
      <div className="md:col-span-5 md:pt-10">
        <p className="text-[20px] font-light mb-1" style={{ color: C.pine }}>{tier.price}</p>
        {tier.priceNote && (
          <p className="font-mono text-[10px] tracking-[0.1em] uppercase mb-5" style={{ color: C.muted }}>{tier.priceNote}</p>
        )}
        {!tier.priceNote && <div className="mb-5" />}

        {tier.features.length > 0 && (
          <ul className="space-y-2.5 mb-7">
            {tier.features.map((f) => (
              <li key={f} className="text-[14px] leading-snug" style={{ color: C.text2 }}>{f}</li>
            ))}
          </ul>
        )}
        {tier.stages && (
          <div className="grid grid-cols-2 gap-6 mb-7">
            {tier.stages.map((s) => (
              <div key={s.title}>
                <p className="font-mono text-[10px] tracking-[0.14em] uppercase mb-2.5" style={{ color: C.goldInk }}>{s.title}</p>
                <ul className="space-y-2.5">
                  {s.items.map((i) => (
                    <li key={i} className="text-[14px] leading-snug" style={{ color: C.text2 }}>{i}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        <InertButton variant={tier.featured ? 'pine' : 'outline'}>{tier.cta}</InertButton>
      </div>
    </div>
  )

  if (tier.featured) {
    return (
      <section className="max-w-4xl mx-auto px-6 py-6">
        <div className="rounded-2xl px-8 py-12 md:px-14 md:py-14" style={{ background: C.warm, border: `1px solid ${C.border}` }}>
          {inner}
        </div>
      </section>
    )
  }
  return (
    <section className="max-w-4xl mx-auto px-6 py-14 md:py-16" style={!last ? { borderBottom: `1px solid ${C.border}` } : undefined}>
      {inner}
    </section>
  )
}

// ─── Comparison — quiet accordions on every breakpoint ───────────────────────
type Cell = 'Included' | 'Not included'
const COMPARE: { row: string; cells: Cell[] }[] = [
  { row: 'The Library and community',                   cells: ['Included', 'Included', 'Included', 'Included'] },
  { row: 'Free community workshops',                    cells: ['Included', 'Included', 'Included', 'Included'] },
  { row: 'Self-serve tracking tools',                   cells: ['Not included', 'Included', 'Included', 'Included'] },
  { row: 'Intake, consultation and case-taking',        cells: ['Not included', 'Not included', 'Included', 'Included'] },
  { row: 'Personal naturopathic plan',                  cells: ['Not included', 'Not included', 'Included', 'Included'] },
  { row: 'Follow-up reviews and plan updates',          cells: ['Not included', 'Not included', 'Included', 'Included'] },
  { row: 'Lab discounts and practitioner lab analysis', cells: ['Not included', 'Not included', 'Included', 'Included'] },
  { row: 'A named coordination contact',                cells: ['Not included', 'Not included', 'Not included', 'Included'] },
  { row: 'Multi-practitioner coordination',             cells: ['Not included', 'Not included', 'Not included', 'Included'] },
]
const TIER_SHORT = ['NI Knowledge & Community', 'Your Health, Tracked', 'NI Care', 'Fully Supported']

function ComparisonAccordions() {
  return (
    <section className="max-w-2xl mx-auto px-6 py-16 md:py-20">
      <h2 className={`${cormorant.className} text-[28px] md:text-[32px] font-light text-center mb-2`} style={{ color: C.text }}>
        What each includes
      </h2>
      <p className="text-center text-[13px] font-light mb-8" style={{ color: C.muted }}>
        Open a tier to see the detail.
      </p>
      <div className="space-y-2">
        {TIER_SHORT.map((name, i) => (
          <details key={name} className="rounded-xl" style={{ background: C.warm, border: `1px solid ${C.border}` }}>
            <summary className="px-6 py-4 cursor-pointer text-[14px] font-medium list-none" style={{ color: C.text }}>
              {name}
            </summary>
            <ul className="px-6 pb-5 pt-1 space-y-2">
              {COMPARE.filter((r) => r.cells[i] === 'Included').map((r) => (
                <li key={r.row} className="text-[13.5px] leading-snug" style={{ color: C.text2 }}>{r.row}</li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </section>
  )
}

// ─── Corporate — separate, enquiry-led ────────────────────────────────────────
function CorporateBlock() {
  const includes = [
    'One practitioner-led workshop each month',
    'A resource for every participant',
    'A staff information sheet',
    'A family resource to take home',
    'A practical monthly challenge',
  ]
  return (
    <section className="max-w-4xl mx-auto px-6 py-16 md:py-20">
      <div className="rounded-2xl px-8 py-12 md:px-14 md:py-14" style={{ background: C.pine }}>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12">
          <div className="md:col-span-7">
            <p className="font-mono text-[11px] font-medium tracking-[0.16em] uppercase mb-4" style={{ color: C.goldPale }}>
              For organisations
            </p>
            <h2 className={`${cormorant.className} text-[30px] md:text-[34px] font-light leading-tight mb-4`} style={{ color: C.cream }}>
              A 12-month organisational programme.
            </h2>
            <p className="text-[14.5px] font-light leading-[1.8] mb-8" style={{ color: 'rgba(244,236,221,0.82)' }}>
              Practitioner-led health education for care homes, schools and
              workplaces — one programme, delivered month by month, shaped to
              your setting. Every engagement is scoped and quoted individually.
            </p>
            <InertButton variant="cream">Request a proposal</InertButton>
          </div>
          <div className="md:col-span-5 md:pt-10">
            <p className="font-mono text-[10px] tracking-[0.14em] uppercase mb-3" style={{ color: C.goldPale }}>
              Each month includes
            </p>
            <ul className="space-y-2.5">
              {includes.map((f) => (
                <li key={f} className="text-[14px] leading-snug" style={{ color: 'rgba(244,236,221,0.85)' }}>{f}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Subsidised access — a quiet note, not a sales card ──────────────────────
function SubsidisedNote() {
  return (
    <section className="max-w-xl mx-auto px-6 pb-16 md:pb-20 text-center">
      <p className="text-[13.5px] font-light leading-[1.8] pt-10" style={{ color: C.text2, borderTop: `1px solid ${C.border}` }}>
        Cost should not be the reason anyone goes without care. A limited number
        of subsidised places are available on the practitioner-led tiers,
        assessed on eligibility — tell us your situation and our team will
        respond personally.
      </p>
    </section>
  )
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────
const FAQS: { q: string; a: string }[] = [
  {
    q: 'Do the tools diagnose anything?',
    a: 'No. The self-serve tools organise your own information and show patterns over time. They do not diagnose, treat or make any clinical judgement — that is always the work of a qualified human practitioner.',
  },
  {
    q: 'How am I matched with a practitioner?',
    a: 'You are not matched by software. Our team routes your request to a practitioner personally — coordination is human at every step.',
  },
  {
    q: 'What exactly am I paying for?',
    a: 'A qualified practitioner’s time and judgement: the consultation you book, the plan they write, and — where you continue — their attention over time.',
  },
  {
    q: 'Can I stay on the free tier forever?',
    a: 'Yes. The Library, the community and free workshops are not a trial — they are a permanent part of what Natural Intelligence is.',
  },
  {
    q: 'Does Natural Intelligence replace my GP?',
    a: 'No. Natural Intelligence supports care; it does not replace medical care, and it is not an emergency service. In an emergency call 999, or use NHS 111 for urgent concerns.',
  },
]

function PricingFAQ() {
  return (
    <section className="max-w-2xl mx-auto px-6 pb-16 md:pb-20">
      <h2 className={`${cormorant.className} text-[28px] md:text-[32px] font-light text-center mb-8`} style={{ color: C.text }}>
        Fair questions
      </h2>
      <div className="space-y-2">
        {FAQS.map((f) => (
          <details key={f.q} className="rounded-xl" style={{ background: C.warm, border: `1px solid ${C.border}` }}>
            <summary className="px-6 py-4 cursor-pointer text-[14px] font-medium list-none" style={{ color: C.text }}>{f.q}</summary>
            <p className="px-6 pb-5 text-[13.5px] font-light leading-[1.75]" style={{ color: C.text2 }}>{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

// ─── FounderDecisionNotes (admin-facing, would not ship publicly) ─────────────
function FounderDecisionNotes() {
  const notes = [
    'Prices remain unset on every paid tier ("£ —"). The retired 19/49/69/119 figures are not used and must not return. Founder to set launch prices.',
    'Editorial redesign (this revision): the four-line story is now the page structure — each line opens its tier section. Path cards and the desktop comparison table are gone; comparison is a set of quiet per-tier accordions on all screen sizes.',
    'First Care and Ongoing Support remain collapsed into one NI Care tier — one journey, Begin/Continue. NI Care is the only tier set on a card; everything else sits directly on the cream ground.',
    'Corporate is the specified 12-month organisational programme (monthly practitioner-led workshop, participant resource, staff sheet, family resource, practical challenge; care homes, schools, workplaces; "Request a proposal"). Enquiry-led, by proposal only.',
    'Subsidised access is a quiet support note, not a sales card, and uses eligibility-based wording with no donation/charitable-structure language, per the open legal question.',
    'All CTAs are inert. Publishing any of this requires: prices set, billing built (none exists), and the Sprint 3 safety floor for the care tiers.',
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

      {/* The story, section by section */}
      <div className="pb-6">
        {TIERS.map((t, i) => (
          <TierSection key={t.name} tier={t} last={i === TIERS.length - 1} />
        ))}
      </div>

      <ComparisonAccordions />
      <CorporateBlock />
      <SubsidisedNote />
      <PricingFAQ />

      {/* Clinical boundary — canonical three-clause wording */}
      <div className="py-6 px-6" style={{ background: C.sand, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <p className="text-center text-[13px] leading-[1.7] max-w-3xl mx-auto" style={{ color: C.text2 }}>
          <strong className="font-medium" style={{ color: C.text }}>A qualified human practitioner is always responsible for clinical judgement.</strong>{' '}
          Natural Intelligence supports care; it does not replace medical care.
          Technology here organises and assists — it makes no clinical decision.
        </p>
      </div>

      <div className="px-6 py-10 max-w-4xl mx-auto">
        <FounderDecisionNotes />
      </div>
    </div>
  )
}
