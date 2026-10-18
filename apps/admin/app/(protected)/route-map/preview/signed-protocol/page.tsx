import type { Metadata } from 'next'
import { Cormorant_Garamond, DM_Sans } from 'next/font/google'
import { SyntheticBanner, C, Shell, Card, Inert, CASE, PROTOCOL_ACTIONS } from '../_connected/shared'

// ─── SCREEN C — Signed protocol → DailyPath (synthetic preview) ──────────────
// Shows the versioning contract and the hand-off a signed action makes into
// DailyPath with its clinical content intact.
//
// SCHEMA DEPENDENCY — stated plainly on the page itself: the live schema has
// no signature, version, author or immutable-history columns on
// member_protocols, and today a CLIENT creates their own protocol from a
// template. This screen is therefore a UX demonstration only. The migration
// that would make it real is PREPARED BUT NOT APPLIED (see the morning report).

export const metadata: Metadata = {
  title: 'Signed protocol → DailyPath — Preview',
  robots: { index: false, follow: false },
}

const displayFont = Cormorant_Garamond({
  subsets: ['latin'], weight: ['300', '400', '500', '600'], style: ['normal', 'italic'],
  display: 'swap', variable: '--font-display',
})
const bodyFont = DM_Sans({
  subsets: ['latin'], weight: ['400', '500', '600'], display: 'swap', variable: '--font-body',
})

const VERSIONS = [
  { v: 3, state: 'Current', signedBy: 'Amara Okafor', at: '2026-09-18', note: 'Evening magnesium added after sleep discussion.' },
  { v: 2, state: 'Superseded', signedBy: 'Amara Okafor', at: '2026-08-07', note: 'Breakfast protein introduced.' },
  { v: 1, state: 'Superseded', signedBy: 'Amara Okafor', at: '2026-07-10', note: 'First protocol after initial review.' },
]

export default function SignedProtocolPreview() {
  return (
    <div className={`${displayFont.variable} ${bodyFont.variable}`}>
      <Shell
        eyebrow="Connected care preview — Screen C"
        title="Signed protocol → DailyPath"
        intro="How a practitioner-signed action reaches the client's day without anything clinical changing on the way."
      >
        <SyntheticBanner text="Synthetic protocol. UX demonstration only — Protocol header signing and versioning are live in the database; the per-version item model is not yet applied." />

        {/* The versioning contract */}
        <Card title={`Protocol v${CASE.protocolVersion} · signed`} tone="pine"
          note="A signed version is immutable. Revising it creates a new draft; the signed version is never edited in place.">
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            {[
              ['Version', `v${CASE.protocolVersion}`], ['State', 'Current'],
              ['Signed by', CASE.protocolSignedBy], ['Signed', '18 Sep 2026'],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[11.5px] mb-1" style={{ color: C.muted }}>{k}</dt>
                <dd className="text-[14px]" style={{ color: C.text }}>{v}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap gap-2">
            <Inert variant="pine">Start revision → v4 draft</Inert>
            <Inert>Download signed copy</Inert>
          </div>
          <p className="text-[11.5px] mt-3" style={{ color: C.muted }}>
            There is deliberately no “edit” control on a signed version.
          </p>
        </Card>

        {/* Version history */}
        <Card title="Signed history" note="Every version stays readable. Superseded versions are kept, never rewritten.">
          {VERSIONS.map((v) => (
            <div key={v.v} className="py-3 flex flex-wrap items-baseline gap-x-3 gap-y-1"
              style={{ borderTop: `1px solid ${C.border}` }}>
              <span className="text-[14px] font-medium" style={{ color: C.text, minWidth: '46px' }}>v{v.v}</span>
              <span className="text-[11px] px-2 py-[2px] rounded-full"
                style={{
                  background: v.state === 'Current' ? '#EEF2EA' : 'transparent',
                  color: v.state === 'Current' ? C.olive : C.muted,
                  border: `1px ${v.state === 'Current' ? 'solid #C9D2BE' : 'dashed ' + C.border}`,
                }}>
                {v.state}
              </span>
              <span className="text-[13px] flex-1" style={{ color: C.text2 }}>{v.note}</span>
              <span className="text-[11.5px]" style={{ color: C.muted }}>
                {v.signedBy} · <time dateTime={v.at}>{v.at}</time>
              </span>
            </div>
          ))}
        </Card>

        {/* The hand-off — what is preserved exactly */}
        <Card title="What reaches DailyPath" note="Clinical content is carried across unchanged. Only presentation is simplified.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Signed side */}
            <div className="rounded-xl p-4" style={{ background: '#FFFFFF', border: `1px solid ${C.border}` }}>
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-3" style={{ color: C.goldInk }}>
                Signed protocol action
              </p>
              {PROTOCOL_ACTIONS.map((a) => (
                <div key={a.id} className="py-2.5" style={{ borderTop: `1px solid ${C.border}` }}>
                  <p className="text-[14px]" style={{ color: C.text }}>
                    {a.instruction}{a.amount ? ` · ${a.amount}` : ''}
                  </p>
                  <p className="text-[12px]" style={{ color: C.muted }}>
                    {a.frequency} · {a.timing} · {a.duration}
                  </p>
                </div>
              ))}
            </div>

            {/* DailyPath side */}
            <div className="rounded-xl p-4" style={{ background: '#FFFFFF', border: `1px solid ${C.border}` }}>
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-3" style={{ color: C.goldInk }}>
                DailyPath action (client view)
              </p>
              {PROTOCOL_ACTIONS.map((a) => (
                <div key={a.id} className="py-2.5" style={{ borderTop: `1px solid ${C.border}` }}>
                  <p className="text-[14px]" style={{ color: C.text }}>
                    {a.instruction}{a.amount ? ` · ${a.amount}` : ''}
                  </p>
                  <p className="text-[12px]" style={{ color: C.muted }}>
                    {a.frequency} · {a.timing}
                  </p>
                  <p className="text-[11px] mt-1" style={{ color: C.goldInk }}>
                    From protocol v{CASE.protocolVersion} · {CASE.protocolSignedBy}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <ul className="mt-4 text-[12.5px] space-y-1" style={{ color: C.text2 }}>
            <li>· Instruction, amount, frequency and duration are carried across verbatim.</li>
            <li>· Author and version travel with every action, so the client can always see who set it.</li>
            <li>· DailyPath has no control that can alter a dose, amount, frequency or instruction.</li>
            <li>· A client obstacle raises a review item for the practitioner — it never edits the protocol.</li>
          </ul>
        </Card>

        {/* Honest statement of what is and is not real */}
        <Card tone="gold" title="What is real, and what is not yet">
          <p className="text-[13.5px] mb-2" style={{ color: C.text }}>
            Live in the database today (migration <code>0059</code>, applied 10 Oct 2026):
          </p>
          <ul className="text-[13px] space-y-1 mb-3" style={{ color: C.text2 }}>
            <li>· <code>member_protocols</code> carries <code>version</code>, <code>signed_at</code>, <code>signed_by</code> and <code>supersedes</code>.</li>
            <li>· A signature can only be written by the authenticated practitioner who is the active Lead and currently eligible.</li>
            <li>· A signed version cannot be edited in place or deleted.</li>
          </ul>
          <p className="text-[13.5px] mb-2" style={{ color: C.text }}>
            Still to come:
          </p>
          <ul className="text-[13px] space-y-1" style={{ color: C.text2 }}>
            <li>· Per-version Protocol items — the model that makes the <em>content</em> editable per client and frozen at signature — is prepared as <code>0061</code> on a feature branch and <strong>not applied</strong>.</li>
            <li>· The practitioner workspace shown here is under construction; there is no screen where a practitioner can yet edit and sign.</li>
            <li>· <code>member_protocols.assigned_by</code> exists but is never written.</li>
            <li>· A protocol is still created by the <strong>client</strong> choosing a template, not by a practitioner.</li>
            <li>· <code>apps/care</code> contains no protocol code at all.</li>
          </ul>
        </Card>
      </Shell>
    </div>
  )
}
