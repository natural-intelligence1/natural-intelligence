// ─── Case Overview ───────────────────────────────────────────────────────────
// The 30–60 second read: what has happened, what the person came with, and
// what needs the practitioner's attention.
//
// Ordered by what a practitioner needs first, not by what is easiest to
// render. Attention at the top, then the factual delta since they last
// looked, then the standing picture. Status lives in one quiet strip rather
// than three competing cards — "Synopsis current / no safety items / plan v2
// signed" is a glance, not a dashboard.
//
// Every fact shown is dated and attributed, and nothing here ranks, scores or
// interprets. FICTIONAL DATA — see caseFixture.ts.

import Link from 'next/link'
import { T, FONT_DISPLAY } from '@/components/workspace/caseTheme'
import { CASE_FIXTURE } from './caseFixture'

function Block({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: '34px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: '19px', color: T.text, margin: 0 }}>{title}</h2>
        {note && <span style={{ fontSize: '12px', color: T.muted }}>{note}</span>}
      </div>
      {children}
    </section>
  )
}

export default function CaseOverview({ params }: { params: { caseId: string } }) {
  const c = CASE_FIXTURE
  const base = `/cases/${params.caseId}`

  const standing = [
    {
      k: 'Factual Synopsis',
      v: c.synopsis.state === 'current' ? 'Current' : 'Draft',
      sub: c.synopsis.generatedAt ? `${c.synopsis.sections} sections · ${c.synopsis.generatedAt}` : '—',
      href: `${base}/synopsis`,
    },
    {
      k: 'Safety',
      v: c.safety.state === 'none_recorded' ? 'No items recorded' : `${c.safety.items} item(s)`,
      sub: c.safety.reviewed ? 'Reviewed' : 'Awaiting review',
      href: `${base}/safety`,
    },
    {
      k: 'Plan / Protocol',
      v: c.plan.state === 'signed' ? `v${c.plan.version} signed` : 'None signed',
      sub: c.plan.signedAt ? `${c.plan.signedBy} · ${c.plan.signedAt}` : '—',
      href: `${base}/plan`,
    },
  ]

  return (
    <>
      {/* ── Needs attention ─────────────────────────────────────────────── */}
      <Block title="Needs your attention">
        {c.outstandingWork.length === 0 ? (
          <p style={{ fontSize: '13.5px', color: T.muted, margin: 0 }}>Nothing outstanding on this case.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {c.outstandingWork.map((w) => (
              <li
                key={w.label}
                style={{
                  display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap',
                  background: w.urgency === 'watch' ? T.warnBg : T.card,
                  border: `1px solid ${w.urgency === 'watch' ? T.warnBorder : T.border}`,
                  borderRadius: '8px', padding: '12px 14px',
                }}
              >
                <span style={{ fontSize: '13.5px', color: T.text }}>{w.label}</span>
                <span style={{ fontSize: '12.5px', color: w.urgency === 'watch' ? T.warnText : T.muted }}>
                  Due {w.due}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Block>

      {/* ── Since last review — the factual delta ───────────────────────── */}
      <Block title="Since last review" note={`${c.lastReview} to today · facts only, each dated and attributed`}>
        <ol style={{ listStyle: 'none', padding: 0, margin: 0, borderLeft: `1px solid ${T.border}` }}>
          {c.sinceLastReview.map((u) => (
            <li key={u.at + u.fact} style={{ position: 'relative', padding: '0 0 16px 18px' }}>
              <span
                aria-hidden
                style={{
                  position: 'absolute', left: '-4px', top: '6px', width: '7px', height: '7px',
                  borderRadius: '50%', background: T.gold,
                }}
              />
              <p style={{ fontSize: '13.5px', color: T.text, margin: '0 0 2px', lineHeight: 1.5 }}>{u.fact}</p>
              <p style={{ fontSize: '11.5px', color: T.muted, margin: 0 }}>{u.at} · {u.source}</p>
            </li>
          ))}
        </ol>
      </Block>

      {/* ── What they came with ─────────────────────────────────────────── */}
      <Block title="What they came with" note="in their own words">
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {c.concerns.map((x) => (
            <li key={x.label} style={{ borderLeft: `2px solid ${T.border}`, paddingLeft: '14px' }}>
              <p style={{ fontSize: '12px', color: T.muted, margin: '0 0 3px' }}>
                {x.label} · {x.duration}
              </p>
              <p style={{ fontSize: '14px', color: T.text, margin: 0, fontStyle: 'italic', lineHeight: 1.5 }}>
                &ldquo;{x.inOwnWords}&rdquo;
              </p>
            </li>
          ))}
        </ul>
      </Block>

      {/* ── Systems under consideration ─────────────────────────────────── */}
      <Block title="Systems under consideration" note="selected by the client during intake — not an assessment">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {c.systemsUnderConsideration.map((s) => (
            <span
              key={s}
              style={{
                fontSize: '12.5px', padding: '5px 12px', borderRadius: '999px',
                background: T.sunken, border: `1px solid ${T.border}`, color: T.text2,
              }}
            >
              {s}
            </span>
          ))}
        </div>
      </Block>

      {/* ── Standing status, one quiet strip ────────────────────────────── */}
      <Block title="Where the case stands">
        <dl
          style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(176px, 1fr))',
            gap: '1px', background: T.border, border: `1px solid ${T.border}`,
            borderRadius: '8px', overflow: 'hidden', margin: 0,
          }}
        >
          {standing.map((s) => (
            <div key={s.k} style={{ background: T.card, padding: '14px 16px' }}>
              <dt style={{ fontSize: '11px', color: T.muted, margin: '0 0 4px' }}>{s.k}</dt>
              <dd style={{ margin: 0 }}>
                <Link
                  href={s.href}
                  style={{ fontSize: '14px', color: T.text, textDecoration: 'none', borderBottom: `1px solid ${T.gold}` }}
                >
                  {s.v}
                </Link>
                <p style={{ fontSize: '11.5px', color: T.muted, margin: '4px 0 0' }}>{s.sub}</p>
              </dd>
            </div>
          ))}
        </dl>
      </Block>

      {/* ── Care team ───────────────────────────────────────────────────── */}
      <Block title="Care team">
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {c.team.map((m) => (
            <li
              key={m.name}
              style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', fontSize: '13.5px' }}
            >
              <span style={{ color: T.text }}>{m.name}</span>
              <span style={{ color: T.muted, fontSize: '12.5px' }}>{m.role} · since {m.since}</span>
            </li>
          ))}
        </ul>
      </Block>

      <p
        style={{
          fontSize: '11.5px', color: T.muted, marginTop: '40px',
          paddingTop: '16px', borderTop: `1px solid ${T.border}`,
        }}
      >
        Fictional case for review. No real client, practitioner or health information appears on this screen.
      </p>
    </>
  )
}
