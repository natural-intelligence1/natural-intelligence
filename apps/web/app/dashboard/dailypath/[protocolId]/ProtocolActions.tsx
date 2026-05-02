'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { pauseProtocol, resumeProtocol, abandonProtocol } from '../actions'

interface ProtocolActionsProps {
  protocolId: string
  status:     string
}

export function ProtocolActions({ protocolId, status }: ProtocolActionsProps) {
  const router                  = useRouter()
  const [isPending, startTx]    = useTransition()
  const [confirmAbandon, setConfirmAbandon] = useState(false)

  function handlePause() {
    startTx(async () => {
      await pauseProtocol(protocolId)
      router.refresh()
    })
  }

  function handleResume() {
    startTx(async () => {
      await resumeProtocol(protocolId)
      router.refresh()
    })
  }

  function handleAbandon() {
    if (!confirmAbandon) {
      setConfirmAbandon(true)
      return
    }
    startTx(async () => {
      await abandonProtocol(protocolId)
      router.push('/dashboard/dailypath')
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-border-default">
      {status === 'active' ? (
        <button
          type="button"
          onClick={handlePause}
          disabled={isPending}
          className="px-4 py-2 rounded-lg border border-border-default text-sm font-medium text-text-secondary hover:bg-surface-muted transition-colors disabled:opacity-50"
        >
          {isPending ? '…' : 'Pause protocol'}
        </button>
      ) : status === 'paused' ? (
        <button
          type="button"
          onClick={handleResume}
          disabled={isPending}
          className="px-4 py-2 rounded-lg bg-brand-default hover:bg-brand-hover text-text-inverted text-sm font-medium transition-colors disabled:opacity-50"
        >
          {isPending ? '…' : 'Resume protocol'}
        </button>
      ) : null}

      <button
        type="button"
        onClick={handleAbandon}
        disabled={isPending}
        className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
          confirmAbandon
            ? 'bg-[#FDF3EA] border border-[#B87840]/40 text-[#B87840] hover:bg-[#B87840] hover:text-[#F8F6F2]'
            : 'text-text-muted hover:text-text-secondary'
        }`}
      >
        {confirmAbandon ? 'Confirm abandon' : 'Abandon protocol'}
      </button>

      {confirmAbandon && (
        <button
          type="button"
          onClick={() => setConfirmAbandon(false)}
          className="text-xs text-text-muted hover:text-text-secondary"
        >
          Cancel
        </button>
      )}
    </div>
  )
}
