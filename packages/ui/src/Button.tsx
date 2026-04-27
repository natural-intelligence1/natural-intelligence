import React from 'react'

/**
 * Variant naming:
 *   primary     — brand action (brand-default fill, inverted text)
 *   secondary   — outlined action (surface-raised bg, border-default border)
 *   ghost       — low-emphasis (transparent, hover surface-muted)
 *   danger      — destructive / irreversible (status.danger* tokens)
 *   gold        — high-emphasis CTA on dark backgrounds (same as primary, hover:opacity-90)
 *
 * See packages/design-tokens/DESIGN_DECISIONS.md DD-004 for error vs danger naming.
 */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold'
type ButtonSize    = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  ButtonVariant
  size?:     ButtonSize
  loading?:  boolean
  children:  React.ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:   'bg-brand-default text-text-inverted hover:bg-brand-hover active:bg-brand-pressed focus-visible:ring-brand-default',
  secondary: 'bg-surface-raised text-text-primary border border-border-default hover:bg-surface-muted focus-visible:ring-border-strong',
  ghost:     'bg-transparent text-text-secondary hover:text-text-primary hover:bg-surface-muted focus-visible:ring-border-strong',
  danger:    'bg-status-dangerBg text-status-dangerText border border-status-dangerBorder hover:opacity-90 focus-visible:ring-status-dangerBorder',
  gold:      'bg-brand-default text-text-inverted hover:opacity-90 active:opacity-80 focus-visible:ring-brand-default',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-sm',
  md: 'px-4 py-2 text-sm rounded-md',
  lg: 'px-5 py-2.5 text-base rounded-md',
}

const Spinner = () => (
  <svg
    className="animate-spin -ml-0.5 mr-2 h-4 w-4"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
)

export function Button({
  variant  = 'primary',
  size     = 'md',
  loading  = false,
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading

  return (
    <button
      disabled={isDisabled}
      className={[
        'inline-flex items-center justify-center font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(' ')}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  )
}
