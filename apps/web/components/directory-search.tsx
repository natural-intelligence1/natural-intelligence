'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useTransition } from 'react'
import { copy } from '@/lib/copy'

export function DirectorySearch() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    }
    startTransition(() => {
      router.replace(`/directory?${params.toString()}`)
    })
  }

  const handleSearch = useCallback(
    (value: string) => updateParams({ q: value || null }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParams]
  )

  const currentQ = searchParams.get('q') ?? ''

  return (
    <div>
      <label htmlFor="dir-search" className="sr-only">{copy.directory.searchLabel}</label>
      <input
        id="dir-search"
        type="search"
        defaultValue={currentQ}
        placeholder={copy.directory.searchPlaceholder}
        onChange={(e) => handleSearch(e.target.value)}
        className="w-full px-3 py-2.5 rounded-lg border border-border-default bg-surface-raised text-text-primary placeholder:text-text-placeholder text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent transition-colors"
      />
    </div>
  )
}
