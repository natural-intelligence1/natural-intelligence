import React from 'react'

/**
 * Variant naming:
 *   default  — neutral (surface-muted bg, text-secondary)
 *   success  — positive state
 *   warning  — caution state
 *   error    — system error / validation failure
 *   info     — informational
 *
 * Note: the former "danger" variant is renamed "error" here.
 * "Danger" is reserved for destructive Button actions; "error" describes
 * system states, validation failures, and alert badges.
 * See packages/design-tokens/DESIGN_DECISIONS.md DD-004.
 */

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info'

interface BadgeProps {
  variant?:  BadgeVariant
  children:  React.ReactNode
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-surface-muted text-text-secondary',
  success: 'bg-status-successBg text-status-successText',
  warning: 'bg-status-warningBg text-status-warningText',
  error:   'bg-status-errorBg text-status-errorText',
  info:    'bg-status-infoBg text-status-infoText',
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
