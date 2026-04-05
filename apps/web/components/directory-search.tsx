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

  const currentQ        = searchParams.get('q')        ?? ''
  const currentTrust    = searchParams.get('trust')    ?? ''
  const currentDelivery = searchParams.get('delivery') ?? ''
  const currentReferral = searchParams.get('referrals') ?? ''

  const filterBtn = (active: boolean) =>
    `px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
      active
        ? 'bg-brand-default text-white'
        : 'border border-border-default text-text-secondary hover:bg-surface-muted'
    }`

  return (
    <div className="space-y-3 mb-8">
      {/* Search input */}
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

      {/* Filter chips row */}
      <div className="flex flex-wrap gap-2">
        {/* Trust filter */}
        <button onClick={() => updateParams({ trust: null })} className={filterBtn(currentTrust === '')}>
          {copy.directory.filters.all}
        </button>
        <button onClick={() => updateParams({ trust: 'vetted' })} className={filterBtn(currentTrust === 'vetted')}>
          {copy.directory.filters.vetted}
        </button>

        {/* Delivery filter */}
        <button onClick={() => updateParams({ delivery: currentDelivery === 'online' ? null : 'online' })} className={filterBtn(currentDelivery === 'online')}>
          {copy.directory.filters.online}
        </button>
        <button onClick={() => updateParams({ delivery: currentDelivery === 'in_person' ? null : 'in_person' })} className={filterBtn(currentDelivery === 'in_person')}>
          {copy.directory.filters.inPerson}
        </button>

        {/* Referrals filter */}
        <button onClick={() => updateParams({ referrals: currentReferral === 'yes' ? null : 'yes' })} className={filterBtn(currentReferral === 'yes')}>
          {copy.directory.filters.acceptsReferrals}
        </button>

        {/* Clear */}
        {(currentQ || currentTrust || currentDelivery || currentReferral) && (
          <button
            onClick={() => updateParams({ q: null, trust: null, delivery: null, referrals: null })}
            className="px-4 py-2 rounded-lg text-sm font-medium text-text-muted hover:text-text-secondary hover:bg-surface-muted transition-colors"
          >
            {copy.directory.filters.clearAll}
          </button>
        )}
      </div>
    </div>
  )
}
