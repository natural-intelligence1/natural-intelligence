import React from 'react'

/**
 * Avatar — initials-based user avatar.
 *
 * Sizes:
 *   sm  — w-8  h-8  (32px)  — compact lists, comment threads
 *   md  — w-10 h-10 (40px)  — default, cards, nav
 *   lg  — w-16 h-16 (64px)  — practitioner cards, featured sections
 *   xl  — w-20 h-20 (80px)  — profile headers, detail pages
 */

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl'

interface AvatarProps {
  name:      string
  size?:     AvatarSize
  className?: string
}

const sizeClasses: Record<AvatarSize, string> = {
  sm: 'w-8  h-8  text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-16 h-16 text-xl',
  xl: 'w-20 h-20 text-2xl',
}

export function Avatar({ name, size = 'md', className = '' }: AvatarProps) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div
      className={[
        sizeClasses[size],
        'rounded-full bg-brand-light text-brand-text font-semibold',
        'flex items-center justify-center flex-shrink-0',
        className,
      ].join(' ')}
    >
      {initials}
    </div>
  )
}
