// ─── Pricing preview — shared presentational primitives ─────────────────────
// No 'use client': these are plain components with no server-only API, so
// they work in the server page and inside the client panels alike.

import { C } from './theme'

/**
 * A call to action that cannot act.
 *
 * A <span role="button" aria-disabled>, not a <button disabled> — the Founder
 * should see the CTA as it will look, and a disabled button renders greyed.
 * There is no handler, no form and no href, so there is nothing to submit:
 * no basket, no payment provider, no subscription. previewPageBoundary.test.ts
 * fails if a form, a submit control or a server action appears on this
 * surface.
 */
export function InertButton({
  children, variant = 'pine',
}: { children: React.ReactNode; variant?: 'pine' | 'outline' | 'cream' }) {
  const styles: Record<string, React.CSSProperties> = {
    pine: { background: C.pine, color: C.cream, border: 'none' },
    outline: { background: 'transparent', color: C.text, border: '1px solid #C6B694' },
    cream: { background: C.cream, color: C.pine, border: 'none' },
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

/**
 * A section eyebrow.
 *
 * GOLD IS ORNAMENT, NOT TEXT.
 *
 * These rendered in gold (#7D6128) and in a monospace face. In the v14
 * artboards every eyebrow is DM Sans 12px / 600 / 0.18em in either warm ink
 * (#5E5850) or sage (#3F6B4D); #B8935A gold is reserved for rules, rings and
 * the table rim. Gold text at this size also fails contrast against cream.
 *
 * `onDark` keeps the pale gold, because on the dark band it is a surface
 * treatment rather than small body text.
 */
export function Eyebrow({ children, onDark = false, tone = 'ink' }: {
  children: React.ReactNode
  onDark?: boolean
  tone?: 'ink' | 'sage'
}) {
  return (
    <p
      className="text-[12px] tracking-[0.18em] uppercase mb-4"
      style={{
        fontWeight: 600,
        color: onDark ? C.goldPale : tone === 'sage' ? C.eyebrowSage : C.eyebrowInk,
      }}
    >
      {children}
    </p>
  )
}

/** An included item. */
export function Tick({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-[14px] leading-[1.6]" style={{ color: C.text }}>
      <span aria-hidden className="flex-shrink-0 mt-0.5" style={{ color: C.olive }}>✓</span>
      <span>{children}</span>
    </li>
  )
}

/**
 * A deliberate exclusion. Stated, not omitted — "no practitioner time
 * included" is the single most important line on a membership card, and a
 * missing row would read as an oversight rather than a boundary.
 */
export function Dash({ children }: { children?: React.ReactNode }) {
  if (children === undefined) {
    return <span aria-hidden style={{ color: C.muted }}>—</span>
  }
  return (
    <li className="flex items-start gap-3 text-[14px] leading-[1.6]" style={{ color: C.muted }}>
      <span aria-hidden className="flex-shrink-0 mt-0.5">—</span>
      <span>{children}</span>
    </li>
  )
}

/** A quiet status pill: "Open now", "Opening soon", "Opening later". */
export function StatusPill({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-block text-[10.5px] tracking-[0.14em] uppercase"
      style={{
        // Gold keeps the RING; the text does not. Same rule as the eyebrows.
        fontWeight: 600, color: C.eyebrowInk, border: `1px solid ${C.goldLine}`,
        borderRadius: 999, padding: '3px 9px',
      }}
    >
      {children}
    </span>
  )
}
