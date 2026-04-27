import React from 'react'

/**
 * Pill — small tag/label component for area tags, specialties, types.
 *
 * Variants:
 *   default  — muted surface, secondary text, subtle border
 *   gold     — brand-subtle bg, brand text, brand-muted border
 */

type PillVariant = 'default' | 'gold'

interface PillProps {
  children:   React.ReactNode
  variant?:   PillVariant
  className?: string
}

const variantClasses: Record<PillVariant, string> = {
  default: 'bg-surface-muted text-text-secondary border border-border-muted',
  gold:    'bg-brand-subtle text-text-brand border border-brand-muted',
}

export function Pill({ children, variant = 'default', className = '' }: PillProps) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium',
        variantClasses[variant],
        className,
      ].join(' ')}
    >
      {children}
    </span>
  )
}
