import React from 'react'

/**
 * Variant naming:
 *   primary     — brand action (brand-default fill, white text)
 *   secondary   — outlined action (surface-raised bg, border-default border)
 *   ghost       — low-emphasis (transparent, text-secondary, hover surface-muted)
 *   danger      — destructive / irreversible action (status.danger* tokens)
 *
 * Note: "destructive" is intentionally named "danger" here.
 * System error states use status.error* directly on alert components;
 * danger is reserved for UI actions that delete or cannot be undone.
 * See packages/design-tokens/DESIGN_DECISIONS.md DD-004.
 */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize    = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?:    ButtonSize
  children: React.ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:   'bg-brand-default text-text-inverted hover:bg-brand-hover focus-visible:ring-brand-default',
  secondary: 'bg-surface-raised text-text-primary border border-border-default hover:bg-surface-muted focus-visible:ring-border-strong',
  ghost:     'text-text-secondary hover:text-text-primary hover:bg-surface-muted focus-visible:ring-border-strong',
  danger:    'bg-status-dangerBg text-status-dangerText border border-status-dangerBorder hover:bg-status-dangerBorder focus-visible:ring-status-dangerBorder',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
}

export function Button({
  variant = 'primary',
  size    = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={[
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </button>
  )
}
