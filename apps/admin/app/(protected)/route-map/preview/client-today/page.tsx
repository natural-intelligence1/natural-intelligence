import type { Metadata } from 'next'
import { Cormorant_Garamond, DM_Sans } from 'next/font/google'
import { SyntheticBanner } from '../_careV2/ui'
import { C, display, body, Shell, Card, Inert, ChoiceChip, FOCUS_RING, CASE, PROTOCOL_ACTIONS } from '../_connected/shared'

// ─── SCREEN A — Client Today (synthetic preview) ─────────────────────────────
// One agreed next action from a SIGNED protocol, not a grid of unrelated
// product cards. Everything shown traces to the practitioner-signed version.
// Admin-protected by the (protected) layout, noindex, entirely inert.

export const metadata: Metadata = {
  title: 'Client Today — Preview',
  robots: { index: false, follow: false },
}

const displayFont = Cormorant_Garamond({
  subsets: ['latin'], weight: ['300', '400', '500', '600'], style: ['normal', 'italic'],
  display: 'swap', variable: '--font-display',
})
const bodyFont = DM_Sans({
  subsets: ['latin'], weight: ['400', '500', '600'], display: 'swap', variable: '--font-body',
})

const TABS = ['Today', 'My Plan', 'My Health', 'My Team'] as const

export default function ClientTodayPreview() {
  const next = PROTOCOL_ACTIONS[0]

  return (
    <div className={`${displayFont.variable} ${bodyFont.variable}`}>
      <Shell
        eyebrow="Connected care preview — Screen A"
        title="Today"
        intro="What the client sees first: the next thing they agreed with their practitioner, where it came from, and an honest way to say it did not happen."
      >
        <SyntheticBanner text="Synthetic client. Nothing here is a real person or a real plan." />

        {/* Journey-level navigation, not module names */}
        <nav aria-label="Main" className="flex flex-wrap gap-1.5 mb-6">
          {TABS.map((t) => (
            <span key={t} tabIndex={0}
              aria-current={t === 'Today' ? 'page' : undefined}
              className={`rounded-full px-4 text-[13px] font-medium inline-flex items-center ${FOCUS_RING}`}
              style={{
                ...body, minHeight: '44px',
                background: t === 'Today' ? C.pine : 'transparent',
                color: t === 'Today' ? C.cream : C.pine,
                border: `1px solid ${t === 'Today' ? C.pine : C.border}`,
              }}>
              {t}
            </span>
          ))}
        </nav>

        {/* The one thing that matters now */}
        <Card tone="pine" title="Your next step">
          <p className="mb-1" style={{ ...display, fontSize: '26px', lineHeight: 1.2, color: C.botanical }}>
            {next.instruction}{next.amount ? ` · ${next.amount}` : ''}
          </p>
          <p className="text-[14px] mb-3" style={{ color: C.text2 }}>
            {next.frequency} · {next.timing}
          </p>
          <p className="text-[13.5px] mb-4" style={{ color: C.text2 }}>{next.rationaleForClient}</p>

          <p className="text-[12px] mb-4" style={{ color: C.muted }}>
            From your protocol v{CASE.protocolVersion}, signed by {CASE.protocolSignedBy} on{' '}
            <time dateTime={CASE.protocolSignedAt}>18 September 2026</time>.{' '}
            <span style={{ color: C.goldInk }}>Only your practitioner can change this.</span>
          </p>

          <div className="flex flex-wrap gap-2">
            <Inert variant="pine">Done</Inert>
            <Inert>I couldn’t do this</Inert>
          </div>
        </Card>

        {/* Obstacle capture — the gap the audit found in DailyPath */}
        <Card title="If something got in the way" note="Telling us does not change your plan — it tells your practitioner what to look at.">
          <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend className="text-[12.5px] mb-2" style={{ color: C.text2 }}>
              What made it difficult? (optional)
            </legend>
            <div className="flex flex-wrap gap-2">
              {['Forgot', 'Felt unwell', 'Too busy', 'Ran out', 'Didn’t feel right', 'Something else'].map((r) => (
                <ChoiceChip key={r}>{r}</ChoiceChip>
              ))}
            </div>
          </fieldset>
        </Card>

        {/* The rest of today's plan */}
        <Card title="Also today">
          {PROTOCOL_ACTIONS.slice(1).map((a) => (
            <div key={a.id} className="py-3 flex flex-wrap items-baseline gap-x-3 gap-y-1"
              style={{ borderTop: `1px solid ${C.border}` }}>
              <span className="text-[14px] flex-1" style={{ color: C.text }}>
                {a.instruction}{a.amount ? ` · ${a.amount}` : ''}
              </span>
              <span className="text-[12px]" style={{ color: C.muted }}>{a.timing}</span>
              <Inert>Done</Inert>
            </div>
          ))}
        </Card>

        {/* Factual progress — counts and client-reported ratings only */}
        <Card title="How it has gone" note="Facts only. No score, no grade, no interpretation.">
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              ['Steps done this week', '11 of 15'],
              ['Days you checked in', '5 of 7'],
              ['Sleep you reported', '6 → 7 of 10'],
              ['Energy you reported', '4 → 5 of 10'],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[11.5px] mb-1" style={{ color: C.muted }}>{k}</dt>
                <dd style={{ ...display, fontSize: '20px', color: C.botanical }}>{v}</dd>
              </div>
            ))}
          </dl>
          <p className="text-[11.5px] mt-4" style={{ color: C.muted }}>
            These are the numbers you entered. Natural Intelligence does not grade them.
          </p>
        </Card>

        <Card tone="gold" title="Your next review">
          <p className="text-[14px]" style={{ color: C.text }}>
            <time dateTime={CASE.nextReview}>Thursday 16 October 2026</time> with {CASE.lead.split(' — ')[0]}.
          </p>
          <p className="text-[12.5px] mt-1" style={{ color: C.text2 }}>
            Anything you tell us between now and then is saved with its date and shown to your
            practitioner as an update — it never rewrites what you first told us.
          </p>
        </Card>

        <p role="note" className="text-[11.5px] mt-8" style={{ color: C.muted, maxWidth: '68ch' }}>
          A qualified human practitioner is always responsible for clinical judgement. Natural
          Intelligence organises and assists; it makes no clinical decision. This is not an
          emergency service — call 999 or NHS 111 if you need urgent help.
        </p>
      </Shell>
    </div>
  )
}
