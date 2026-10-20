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
//
// "Since last review" is the one block NOT rendered from pre-written lines.
// It queries case_events through the shared reader, and passes real
// DatedUpdate records through the shipped buildSinceLastReview — so the
// grouping, ordering, review cutoff and attribution on screen are the domain
// module's, not this page's.
//
// A real case id gets real events. The fixture route id has none, so it falls
// back to invented records through the SAME builder, and says which it is
// showing. Clients cannot yet record an update at all (one missing INSERT
// policy — see CLIENT_UPDATE_STORAGE_GAP), which the block states plainly
// rather than letting an empty list imply the client has said nothing.

import Link from 'next/link'
import { createServerSupabaseClient } from '@natural-intelligence/db'
import {
  loadCaseUpdates, buildSinceLastReviewView, provenanceLabel, CLIENT_UPDATE_STORAGE_GAP,
} from '@natural-intelligence/db/careRecord'
import { T, FONT_DISPLAY } from '@/components/workspace/caseTheme'
import { CASE_FIXTURE } from './caseFixture'

export const dynamic = 'force-dynamic'

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

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

export default async function CaseOverview({ params }: { params: { caseId: string } }) {
  const c = CASE_FIXTURE
  const base = `/cases/${params.caseId}`

  // Real events for a real case id, under RLS. The fixture route id resolves
  // to nothing, and a reader failure must not take the whole case down.
  const supabase = createServerSupabaseClient()
  const live = await loadCaseUpdates(supabase, params.caseId).catch(() => [])
  const usingFixture = live.length === 0

  // The shipped builder either way. Nothing on screen is pre-grouped.
  const delta = usingFixture
    ? buildSinceLastReviewView(c.sinceLastReview, c.lastReviewAt, '2026-10-05T09:00:00.000Z')
    : buildSinceLastReviewView(live, c.lastReviewAt)

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
      <Block
        title="Since last review"
        note={`${c.lastReview} to today · ${delta.review.count} item(s) · ${delta.clientReportedCount} client reported`}
      >
        {delta.nothingChanged ? (
          <p style={{ fontSize: '13.5px', color: T.muted, margin: 0 }}>
            Nothing has been recorded since the last review.
          </p>
        ) : (
          delta.review.sections.map((section) => (
            <div key={section.kind} style={{ marginBottom: '20px' }}>
              {/* The builder's own label and grouping, not this page's. */}
              <h3 style={{
                fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em',
                color: T.muted, margin: '0 0 8px', fontWeight: 500,
              }}>
                {section.label}
              </h3>
              <ol style={{ listStyle: 'none', padding: 0, margin: 0, borderLeft: `1px solid ${T.border}` }}>
                {section.entries.map((u) => (
                  <li key={u.id} style={{ position: 'relative', padding: '0 0 16px 18px' }}>
                    <span
                      aria-hidden
                      style={{
                        position: 'absolute', left: '-4px', top: '6px', width: '7px', height: '7px',
                        borderRadius: '50%', background: T.gold,
                      }}
                    />
                    <p style={{ fontSize: '13.5px', color: T.text, margin: '0 0 2px', lineHeight: 1.5 }}>
                      {u.statement}
                    </p>
                    {/* A before-and-after is shown as two values, never as a
                        change the practitioner has not yet seen interpreted. */}
                    {u.previousValue && u.newValue && (
                      <p style={{ fontSize: '12px', color: T.text2, margin: '0 0 2px' }}>
                        {u.previousValue} → {u.newValue}
                      </p>
                    )}
                    <p style={{ fontSize: '11.5px', color: T.muted, margin: 0 }}>
                      {formatWhen(u.at)} · {provenanceLabel(u)}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          ))
        )}

        {/* The honest part. A practitioner must be able to tell "the client has
            said nothing" from "the client has no way to tell us anything". */}
        {delta.storageUnavailable && (
          <p style={{
            fontSize: '11.5px', color: T.muted, margin: '4px 0 0', lineHeight: 1.5,
            background: T.sunken, border: `1px solid ${T.border}`, borderRadius: '6px', padding: '10px 12px',
          }}>
            <strong style={{ color: T.goldInk, fontWeight: 600 }}>
              {usingFixture ? 'Fictional records · ' : 'Live case events · '}
            </strong>
            {usingFixture
              ? 'no events are recorded against this case id, so invented records are shown through the real delta builder. '
              : 'read from case_events under row-level security. '}
            Clients cannot yet record an update themselves: {CLIENT_UPDATE_STORAGE_GAP.gaps[0].what.toLowerCase()}
            {delta.unattributedCount > 0 && (
              <>
                {' '}
                {delta.unattributedCount} line(s) could not be attributed to a named person —
                case_events has no author column.
              </>
            )}
          </p>
        )}
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
