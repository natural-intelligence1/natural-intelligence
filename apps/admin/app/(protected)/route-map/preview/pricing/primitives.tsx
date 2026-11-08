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

export function Eyebrow({ children, onDark = false }: { children: React.ReactNode; onDark?: boolean }) {
  return (
    <p
      className="font-mono text-[11px] font-medium tracking-[0.14em] uppercase mb-4"
      style={{ color: onDark ? C.goldPale : C.goldInk }}
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
      className="inline-block font-mono text-[10.5px] tracking-[0.1em] uppercase"
      style={{
        color: C.goldInk, border: `1px solid ${C.goldLine}`,
        borderRadius: 999, padding: '3px 9px',
      }}
    >
      {children}
    </span>
  )
}
