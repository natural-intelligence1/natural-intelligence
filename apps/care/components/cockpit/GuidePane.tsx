'use client'

// ─── LEFT PANE — Contextual Practitioner Guide ───────────────────────────────
// Supports the consultation; must not compete with it.
//
// Three deliberate restraints, because the risk here is a guide that pulls
// attention off the person in the room:
//
//   · narrower than the capture pane, and visually quieter — no white cards,
//     no accent fills except on the one safety block;
//   · nothing interactive except the collapse toggles, so there is never a
//     reason to click into this pane mid-sentence;
//   · the domain caps each block at four lines, and this renders what it is
//     given rather than adding its own.
//
// It cannot write to the record. `GuidancePanel` carries no value and no
// provenance, so there is nothing here to submit.

import { useState } from 'react'
import type { GuidancePanel, GuidanceBlockId, PractitionerOrientation } from '@natural-intelligence/db/cockpit'
import { T, FONT_DISPLAY } from '@/components/workspace/caseTheme'

/** The safety block is the one that earns an accent. */
const ACCENTED: GuidanceBlockId = 'relevant_now_safety'

/** Blocks that start collapsed — reference rather than live prompting. */
const COLLAPSED_BY_DEFAULT: GuidanceBlockId[] = ['client_already_told_us', 'still_to_cover']

export function GuidePane({
  panel, orientation, reviewMode,
}: {
  panel: GuidancePanel
  orientation: PractitionerOrientation
  reviewMode: boolean
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(
    () => Object.fromEntries(COLLAPSED_BY_DEFAULT.map((id) => [id, true])),
  )

  return (
    <aside
      aria-label="Practitioner guide"
      style={{
        background: T.sunken,
        border: `1px solid ${T.border}`,
        borderRadius: '10px',
        padding: '16px',
        alignSelf: 'start',
        position: 'sticky',
        top: '16px',
        maxHeight: 'calc(100vh - 32px)',
        overflowY: 'auto',
      }}
    >
      <header style={{ marginBottom: '14px' }}>
        <p style={{
          fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.12em',
          color: T.muted, margin: '0 0 3px',
        }}>
          Guide
        </p>
        <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: '16px', color: T.text, margin: 0 }}>
          {panel.streamTitle}
        </h2>
      </header>

      {/* The four questions the practitioner must always be able to answer.
          Kept at the top because it is the orientation, not a block. */}
      <dl style={{
        margin: '0 0 16px', paddingBottom: '14px', borderBottom: `1px solid ${T.border}`,
        display: 'flex', flexDirection: 'column', gap: '8px',
      }}>
        {([
          ['Ask now', orientation.whatShouldIAskNow],
          ['Explore next', orientation.whatShouldIExploreNext],
          ['Don’t overlook', orientation.whatMustINotOverlook],
          ['Still to record or review', orientation.whatStillNeedsRecordingOrReview],
        ] as const).map(([k, v]) => (
          <div key={k}>
            <dt style={{ fontSize: '10.5px', color: T.muted, marginBottom: '1px' }}>{k}</dt>
            <dd style={{ fontSize: '12.5px', color: v ? T.text : T.muted, margin: 0, lineHeight: 1.45 }}>
              {v ?? 'Nothing outstanding'}
            </dd>
          </div>
        ))}
      </dl>

      {panel.blocks.length === 0 && (
        <p style={{ fontSize: '12.5px', color: T.muted, margin: 0 }}>
          Nothing to add here. Ask in your own way.
        </p>
      )}

      {panel.blocks.map((block) => {
        const isCollapsed = collapsed[block.id] === true
        const accented = block.id === ACCENTED
        return (
          <section
            key={block.id}
            style={{
              marginBottom: '14px',
              ...(accented
                ? {
                    background: T.goldWash, border: `1px solid ${T.goldPale}`,
                    borderRadius: '8px', padding: '10px 12px',
                  }
                : {}),
            }}
          >
            <button
              type="button"
              onClick={() => setCollapsed((c) => ({ ...c, [block.id]: !isCollapsed }))}
              aria-expanded={!isCollapsed}
              style={{
                all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center',
                gap: '6px', width: '100%', marginBottom: isCollapsed ? 0 : '7px',
              }}
            >
              <span aria-hidden style={{ fontSize: '9px', color: T.muted }}>
                {isCollapsed ? '▸' : '▾'}
              </span>
              <span style={{
                fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.1em',
                color: accented ? T.goldInk : T.muted, fontWeight: 500,
              }}>
                {block.title}
              </span>
              {isCollapsed && (
                <span style={{ fontSize: '10.5px', color: T.faint, marginLeft: 'auto' }}>
                  {block.lines.length}
                </span>
              )}
            </button>

            {!isCollapsed && (
              <ul style={{
                listStyle: 'none', padding: 0, margin: 0,
                display: 'flex', flexDirection: 'column', gap: '6px',
              }}>
                {block.lines.map((l, i) => (
                  <li
                    key={`${block.id}-${i}`}
                    style={{
                      fontSize: '12.5px', lineHeight: 1.5,
                      color: accented ? T.goldInk : T.text2,
                      paddingLeft: '10px', borderLeft: `2px solid ${accented ? T.goldPale : T.faint}`,
                    }}
                  >
                    {l.text}
                    {/* Review mode only: where this line came from. */}
                    {reviewMode && (
                      <span style={{ display: 'block', fontSize: '10px', color: T.muted, marginTop: '2px' }}>
                        {l.source}{l.ref ? ` · ${l.ref}` : ''}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}

      <p style={{
        fontSize: '10.5px', color: T.muted, lineHeight: 1.5,
        marginTop: '18px', paddingTop: '12px', borderTop: `1px solid ${T.border}`,
      }}>
        Guidance only. Nothing in this pane enters the clinical record, and nothing here decides
        anything — only what you ask and capture is recorded.
      </p>
    </aside>
  )
}
