'use client'

// ─── LEFT PANE — Contextual Practitioner Guide ───────────────────────────────
// Board 1 (MASTER). Fixed 440px, tinted parchment, right border, scrolls
// internally. The footnote is pinned to the bottom with margin-top:auto.
//
// ── GUIDANCE IS NEVER RECORD ────────────────────────────────────────────────
//
// Nothing in this pane writes to the case. Reading a prompt — including an
// Annex 1 red-flag prompt — never marks a question asked. The pane renders a
// GuidancePanel, which carries no value and no provenance, so there is
// nothing here that a capture function would accept.
//
// ── RELEVANT NOW vs STILL TO COVER ──────────────────────────────────────────
//
// An Annex rule appears under "Relevant now · approved safety screening"
// (oxblood) ONLY when it is linked to the active question's stream. Mandatory
// items that are not linked go under "Still to cover in this section" (dashed
// neutral), worded so they cannot read as triggered by this question. The
// distinction is approved, and getting it wrong would imply the client's
// answer raised a red flag it did not raise.

import type {
  GuidancePanel, PractitionerOrientation, SafetyNode,
} from '@natural-intelligence/db/cockpit'
import { C, F, Z, eyebrow } from './cockpitTokens'

export interface GuideGeneratedItem {
  /** EXISTING FACT · CLARIFICATION · CHRONOLOGY GAP · CONTRADICTION · DEFERRED */
  tag: string
  text: string
  source?: string
}

export function GuidePane({
  panel, orientation, reviewMode, relevantNow, stillToCover, elsewhere,
  generated, exploreChips, studentSupport, activeTitle,
}: {
  /** The ACTIVE question. The guide follows it — interaction rule 1. */
  activeTitle: string
  panel: GuidancePanel
  orientation: PractitionerOrientation
  reviewMode: boolean
  /** Annex nodes linked to the active question's stream. */
  relevantNow: SafetyNode[]
  /** Mandatory items for the section NOT linked to the active question. */
  stillToCover: string[]
  /** Already asked elsewhere in this section. */
  elsewhere: string[]
  generated: GuideGeneratedItem[]
  exploreChips: string[]
  studentSupport?: { tips: string[]; terms: Array<{ term: string; meaning: string }>; why: string } | null
}) {
  const why = panel.blocks.find((b) => b.id === 'why_this_matters')?.lines ?? []
  const howToAsk = panel.blocks.find((b) => b.id === 'how_to_ask')?.lines ?? []

  return (
    <aside
      aria-label="Practitioner guide"
      style={{
        background: C.parchment, borderRight: `1px solid ${C.line}`,
        padding: '16px 26px', display: 'flex', flexDirection: 'column',
        gap: '9px', overflowY: 'auto', minHeight: 0,
      }}
    >
      {/* Eyebrow — says where the guidance comes from and that it follows
          the active question. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
        <span style={eyebrow(C.goldInk, 12)}>Guide · from Call Sheet</span>
        <span style={{ fontSize: '12px', color: C.softText, fontWeight: 500 }}>
          synced to the active question
        </span>
      </div>

      <h2 style={{
        fontFamily: F.display, fontSize: '23px', fontWeight: 600, lineHeight: 1.18,
        color: C.botanical, margin: 0,
      }}>
        {activeTitle || panel.streamTitle}
      </h2>

      {why.length > 0 && (
        <Block label="Why this matters">
          {why.map((l, i) => (
            <p key={i} style={body}>{l.text}</p>
          ))}
        </Block>
      )}

      {howToAsk.length > 0 && (
        <Block label="How to ask">
          {howToAsk.map((l, i) => (
            // Script — Cormorant italic with a 2px GOLD left rule.
            <p key={i} style={{
              fontFamily: F.display, fontStyle: 'italic', fontSize: '16.5px',
              lineHeight: 1.4, color: C.botanical,
              borderLeft: `2px solid ${C.gold}`, padding: '2px 0 2px 12px', margin: 0,
            }}>
              {l.text}
            </p>
          ))}
        </Block>
      )}

      {generated.length > 0 && (
        <Block label="For this client · generated">
          {generated.map((g, i) => (
            <div key={i} style={{
              display: 'flex', gap: '8px', alignItems: 'flex-start',
              fontSize: '13px', lineHeight: 1.4,
              background: C.parchTint, borderRadius: '9px', padding: '6px 10px',
            }}>
              <i style={{
                fontStyle: 'normal', fontSize: '11px', fontWeight: 600,
                color: C.goldInk, whiteSpace: 'nowrap', paddingTop: '1px',
              }}>
                {g.tag}
              </i>
              <span>
                {g.text}
                {g.source && (
                  <span style={{ display: 'block', fontSize: '12px', color: C.softText, marginTop: '3px' }}>
                    {g.source}
                  </span>
                )}
              </span>
            </div>
          ))}
        </Block>
      )}

      {exploreChips.length > 0 && (
        <Block label="Explore — optional">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
            {exploreChips.map((chip) => (
              <span key={chip} style={{
                fontSize: '13px', border: `1px solid ${C.lineStrong}`, background: C.parchTint,
                borderRadius: '999px', padding: '6px 11px', color: C.text,
              }}>
                {chip}
              </span>
            ))}
          </div>
        </Block>
      )}

      {/* ── RELEVANT NOW · APPROVED SAFETY SCREENING ─────────────────────── */}
      {relevantNow.map((node) => (
        <div key={node.ruleId} style={{
          border: `1px solid ${C.oxblood}`, borderRadius: '12px', background: C.warmWhite,
          padding: '11px 14px', display: 'flex', flexDirection: 'column', gap: '6px',
        }}>
          <span style={{ ...eyebrow(C.oxblood, 11.5), display: 'flex', alignItems: 'center', gap: '7px' }}>
            <ShieldGlyph /> Relevant now · approved safety screening
          </span>
          <p style={{ ...body, margin: 0 }}>
            {node.topic} (Annex 1 Rule {node.ruleNumber}) belongs with this question — ask exactly:
          </p>
          {/* The approved wording, verbatim, with a 2px OXBLOOD rule. */}
          <p style={{
            fontFamily: F.display, fontSize: '17px', lineHeight: 1.35, color: C.botanical,
            borderLeft: `2px solid ${C.oxblood}`, padding: '1px 0 1px 10px', margin: 0,
          }}>
            “{node.approvedQuestion}”
          </p>
          <p style={{ ...body, margin: 0 }}>
            Yes or Not sure → needs human review. Reading this does not mark it asked.
          </p>
          {reviewMode && (
            <span style={{ fontSize: '10.5px', color: C.softText, fontFamily: 'ui-monospace, monospace' }}>
              {node.ruleId} · notice {node.notice} · {node.annexStreams.join(' | ')}
            </span>
          )}
        </div>
      ))}

      {/* ── STILL TO COVER — dashed neutral, explicitly NOT triggered here ── */}
      {stillToCover.length > 0 && (
        <div style={{
          border: `1px dashed ${C.lineStrong}`, borderRadius: '12px', padding: '10px 14px',
          display: 'flex', flexDirection: 'column', gap: '5px', background: C.cream,
        }}>
          <span style={eyebrow(C.softText, 11.5)}>Still to cover in this section</span>
          {stillToCover.map((s, i) => (
            <p key={i} style={{ margin: 0, fontSize: '13px', lineHeight: 1.5 }}>{s}</p>
          ))}
        </div>
      )}

      {elsewhere.length > 0 && (
        <div style={{
          border: `1px dashed ${C.lineStrong}`, borderRadius: '12px', padding: '10px 14px',
          display: 'flex', flexDirection: 'column', gap: '5px', background: C.cream,
        }}>
          <span style={eyebrow(C.softText, 11.5)}>Elsewhere in this section · not linked to this question</span>
          {elsewhere.map((s, i) => (
            <p key={i} style={{ margin: 0, fontSize: '13px', lineHeight: 1.5 }}>{s}</p>
          ))}
        </div>
      )}

      {/* ── Student support — the teaching layer over the same Call Sheet ── */}
      {studentSupport && (
        <div style={{
          border: `1px solid ${C.gold}`, borderRadius: '12px', background: C.warmWhite,
          padding: '11px 14px', display: 'flex', flexDirection: 'column', gap: '8px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
            <b style={{ fontSize: '14px', fontWeight: 600, color: C.botanical }}>Student support</b>
            <span style={{ fontSize: '11.5px', color: C.softText }}>same Call Sheet entry · teaching layer</span>
          </div>
          <span style={eyebrow(C.goldInk, 11)}>Interviewing tips</span>
          {studentSupport.tips.map((t, i) => <p key={i} style={body}>{t}</p>)}
          {studentSupport.terms.length > 0 && (
            <>
              <span style={eyebrow(C.goldInk, 11)}>Plain-English terms</span>
              {studentSupport.terms.map((t) => (
                <div key={t.term} style={{ display: 'grid', gridTemplateColumns: '92px 1fr', gap: '10px' }}>
                  <b style={{ fontSize: '13px', fontWeight: 600 }}>{t.term}</b>
                  <span style={{ fontSize: '13px', lineHeight: 1.45 }}>{t.meaning}</span>
                </div>
              ))}
            </>
          )}
          <span style={eyebrow(C.goldInk, 11)}>Why this question</span>
          <p style={body}>{studentSupport.why}</p>
          <p style={{
            ...body, margin: 0, background: C.parchTint, borderRadius: '9px', padding: '8px 10px',
          }}>
            <b style={{ fontWeight: 600 }}>Supervision:</b> you can record what the client says. Your
            observations are drafts for your supervisor. This panel gives no supervisory or clinical
            authority.
          </p>
        </div>
      )}

      {/* Pinned to the bottom. */}
      <p style={{
        marginTop: 'auto', fontSize: '12px', lineHeight: 1.5, color: C.softText,
        borderTop: `1px solid ${C.guideRule}`, paddingTop: '9px', marginBottom: 0,
      }}>
        Guidance only. Nothing in this pane is saved as something the client said.
      </p>
    </aside>
  )
}

const body: React.CSSProperties = {
  fontSize: '13.5px', lineHeight: 1.55, color: C.text, margin: 0,
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <span style={eyebrow(C.softText, 11.5)}>{label}</span>
      {children}
    </section>
  )
}

function ShieldGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
    </svg>
  )
}

export { Z }
