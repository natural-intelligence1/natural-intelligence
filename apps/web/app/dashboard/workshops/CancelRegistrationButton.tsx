'use client'

import { useState, useTransition } from 'react'
import { cancelRegistration } from './actions'

export function CancelRegistrationButton({ registrationId }: { registrationId: string }) {
  const [isPending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)

  if (confirming) {
    return (
      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={() => startTransition(async () => { await cancelRegistration(registrationId) })}
          disabled={isPending}
          className="px-3 py-1.5 rounded-lg bg-status-errorBg border border-status-errorBorder text-status-errorText text-xs font-medium transition-colors disabled:opacity-50"
        >
          {isPending ? '…' : 'Yes, cancel'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="px-3 py-1.5 rounded-lg border border-border-default text-text-secondary text-xs font-medium hover:bg-surface-muted transition-colors"
        >
          Keep
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex-shrink-0 px-3 py-1.5 rounded-lg border border-border-default text-text-secondary text-xs font-medium hover:bg-surface-muted transition-colors"
    >
      Cancel spot
    </button>
  )
}
