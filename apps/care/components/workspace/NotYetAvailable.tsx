// ─── NotYetAvailable ─────────────────────────────────────────────────────────
// The honest empty state for a section whose capability does not exist yet.
//
// It names what is missing and where the work actually stands, because a
// practitioner looking at a blank panel should not have to guess whether the
// client has no data or NI has no feature. `domain` is the truthful status of
// the underlying code, not a promise about timing.

import { T, FONT_DISPLAY } from './caseTheme'

export function NotYetAvailable({
  title, what, domain,
}: {
  title: string
  /** What a practitioner will eventually do here. */
  what: string
  /** Honest status of the underlying capability. */
  domain: string
}) {
  return (
    <section
      aria-labelledby={`nya-${title.replace(/\W+/g, '-').toLowerCase()}`}
      style={{
        border: `1px dashed ${T.border}`, borderRadius: '10px',
        background: T.card, padding: '32px', maxWidth: '640px',
      }}
    >
      <h2
        id={`nya-${title.replace(/\W+/g, '-').toLowerCase()}`}
        style={{ fontFamily: FONT_DISPLAY, fontSize: '19px', color: T.text, margin: '0 0 8px' }}
      >
        {title}
      </h2>
      <p style={{ fontSize: '13.5px', color: T.text2, margin: '0 0 14px', lineHeight: 1.55 }}>
        {what}
      </p>
      <p style={{ fontSize: '12px', color: T.muted, margin: 0, lineHeight: 1.5 }}>
        <strong style={{ color: T.goldInk, fontWeight: 600 }}>Not available yet · </strong>
        {domain}
      </p>
    </section>
  )
}
