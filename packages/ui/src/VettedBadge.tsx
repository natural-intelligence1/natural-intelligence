import React from 'react'

/**
 * VettedBadge — practitioner vetting status indicator.
 *
 * vetted=true:  sage-green success pill — "Vetted practitioner"
 * vetted=false: muted pill — "Listed practitioner"
 *
 * The label is derived from the vetted boolean so this component
 * stays decoupled from app-specific copy files.
 */

interface VettedBadgeProps {
  vetted:     boolean
  size?:      'sm' | 'md'
  className?: string
}

export function VettedBadge({ vetted, size = 'md', className = '' }: VettedBadgeProps) {
  const px  = size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1'
  const dot = size === 'sm' ? 'w-1 h-1'     : 'w-1.5 h-1.5'
  const text = size === 'sm' ? 'text-xs' : 'text-xs'

  if (vetted) {
    return (
      <span
        className={[
          'inline-flex items-center gap-1.5 rounded-full font-medium',
          'bg-status-successBg text-status-successText border border-status-successBorder',
          px, text, className,
        ].join(' ')}
      >
        <span className={[dot, 'rounded-full bg-status-successText flex-shrink-0'].join(' ')} aria-hidden="true" />
        Vetted practitioner
      </span>
    )
  }

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        'bg-surface-muted text-text-muted border border-border-muted',
        px, text, className,
      ].join(' ')}
    >
      <span className={[dot, 'rounded-full bg-text-muted flex-shrink-0'].join(' ')} aria-hidden="true" />
      Listed practitioner
    </span>
  )
}
