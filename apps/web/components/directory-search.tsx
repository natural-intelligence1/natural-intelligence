'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useTransition } from 'react'
import { copy } from '@/lib/copy'

export function DirectorySearch() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const handleSearch = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set('q', value)
      } else {
        params.delete('q')
      }
      startTransition(() => {
        router.replace(`/directory?${params.toString()}`)
      })
    },
    [router, searchParams]
  )

  const handleTrust = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set('trust', value)
      } else {
        params.delete('trust')
      }
      startTransition(() => {
        router.replace(`/directory?${params.toString()}`)
      })
    },
    [router, searchParams]
  )

  const currentQ = searchParams.get('q') ?? ''
  const currentTrust = searchParams.get('trust') ?? ''

  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-8">
      <div className="flex-1">
        <label htmlFor="search" className="sr-only">{copy.directory.searchLabel}</label>
        <input
          id="search"
          type="search"
          defaultValue={currentQ}
          placeholder={copy.directory.searchPlaceholder}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg border border-border-default bg-surface-raised text-text-primary placeholder:text-text-placeholder text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent transition-colors"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => handleTrust('')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            currentTrust === ''
              ? 'bg-brand-default text-white'
              : 'border border-border-default text-text-secondary hover:bg-surface-muted'
          }`}
        >
          {copy.directory.filters.heading}
        </button>
        <button
          onClick={() => handleTrust('vetted')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            currentTrust === 'vetted'
              ? 'bg-brand-default text-white'
              : 'border border-border-default text-text-secondary hover:bg-surface-muted'
          }`}
        >
          {copy.directory.filters.vetted}
        </button>
        <button
          onClick={() => handleTrust('unvetted')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            currentTrust === 'unvetted'
              ? 'bg-brand-default text-white'
              : 'border border-border-default text-text-secondary hover:bg-surface-muted'
          }`}
        >
          {copy.directory.filters.unvetted}
        </button>
      </div>
    </div>
  )
}
