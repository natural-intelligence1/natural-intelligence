import React from 'react'

/**
 * Avatar — initials-based user avatar with optional image.
 *
 * Sizes:
 *   sm  — w-7  h-7  (28px)  — compact lists, comment threads
 *   md  — w-9  h-9  (36px)  — default, cards, nav
 *   lg  — w-11 h-11 (44px)  — practitioner cards, featured sections
 *   xl  — w-14 h-14 (56px)  — profile headers, detail pages
 */

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl'

interface AvatarProps {
  name:       string
  imageUrl?:  string
  size?:      AvatarSize
  className?: string
}

const sizeClasses: Record<AvatarSize, string> = {
  sm: 'w-7  h-7  text-xs',
  md: 'w-9  h-9  text-sm',
  lg: 'w-11 h-11 text-base',
  xl: 'w-14 h-14 text-lg',
}

function getInitials(name: string): string {
  const cleaned = name
    .replace(/^(Dr|Mr|Mrs|Ms|Prof|Rev)\.?\s+/i, '')
    .trim()
  const parts = cleaned.split(/\s+/)
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?'
  return parts
    .map((p) => p[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function Avatar({ name, imageUrl, size = 'md', className = '' }: AvatarProps) {
  const baseClasses = [
    sizeClasses[size],
    'rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden',
    className,
  ].join(' ')

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name}
        className={[baseClasses, 'object-cover'].join(' ')}
      />
    )
  }

  return (
    <div className={[baseClasses, 'bg-brand-subtle text-text-brand font-medium'].join(' ')}>
      {getInitials(name)}
    </div>
  )
}
