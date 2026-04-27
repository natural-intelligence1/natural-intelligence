import React from 'react'

/**
 * VettedBadge — indicates a practitioner has passed NI vetting.
 *
 * The label is a required prop so this component stays decoupled from
 * any app-specific copy file. Callers pass the appropriate string from
 * their own copy system (or a hardcoded label for now).
 *
 * Default label is 'Vetted' — matches all current call-sites.
 */

interface VettedBadgeProps {
  label?: string
  className?: string
}

export function VettedBadge({ label = 'Vetted', className = '' }: VettedBadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full',
        'bg-brand-light text-brand-text text-xs font-medium',
        className,
      ].join(' ')}
    >
      <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
          clipRule="evenodd"
        />
      </svg>
      {label}
    </span>
  )
}
