import React from 'react'

/**
 * Variant naming:
 *   default  — neutral state
 *   success  — positive / confirmed
 *   warning  — caution
 *   danger   — destructive action badge / high-severity alert
 *   info     — informational
 *
 * "danger" (not "error") is the canonical term for badge states.
 * System error alerts use status.error* tokens directly in page components.
 * See packages/design-tokens/DESIGN_DECISIONS.md DD-004.
 */

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info'

interface BadgeProps {
  variant?:   BadgeVariant
  children:   React.ReactNode
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-surface-muted text-text-secondary border border-border-muted',
  success: 'bg-status-successBg text-status-successText border border-status-successBorder',
  warning: 'bg-status-warningBg text-status-warningText border border-status-warningBorder',
  danger:  'bg-status-dangerBg text-status-dangerText border border-status-dangerBorder',
  info:    'bg-status-infoBg text-status-infoText border border-status-infoBorder',
}

export function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variantClasses[variant],
        className,
      ].join(' ')}
    >
      {children}
    </span>
  )
}
