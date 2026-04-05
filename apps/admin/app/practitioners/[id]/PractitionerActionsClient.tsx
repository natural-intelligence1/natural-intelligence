'use client'

import { useState } from 'react'
import { copy } from '@/lib/copy'
import { activatePractitioner, pausePractitioner, resendApprovalEmail } from '../actions'

interface Props {
  practitionerId:  string
  lifecycleStatus: string
}

export default function PractitionerActionsClient({ practitionerId, lifecycleStatus }: Props) {
  const [loading,      setLoading]      = useState(false)
  const [pauseReason,  setPauseReason]  = useState('')
  const [showPause,    setShowPause]    = useState(false)
  const [feedback,     setFeedback]     = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const c = copy.practitioners

  async function handle(action: () => Promise<void>) {
    setLoading(true)
    setFeedback(null)
    try {
      await action()
      setFeedback({ type: 'success', msg: copy.shared.saved })
      setShowPause(false)
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err?.message ?? copy.shared.error })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {feedback && (
        <div className={`rounded-lg px-4 py-2.5 text-sm font-medium ${
          feedback.type === 'success'
            ? 'bg-status-successBg text-status-successText border border-status-successBorder'
            : 'bg-status-errorBg text-status-errorText border border-status-errorBorder'
        }`}>
          {feedback.msg}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {/* Activate */}
        {lifecycleStatus !== 'active' && (
          <button
            disabled={loading}
            onClick={() => handle(() => activatePractitioner(practitionerId))}
            className="px-4 py-2 rounded-lg bg-brand-default hover:bg-brand-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {c.actions.activate}
          </button>
        )}

        {/* Pause */}
        {lifecycleStatus !== 'paused' && (
          <button
            disabled={loading}
            onClick={() => setShowPause(!showPause)}
            className="px-4 py-2 rounded-lg border border-border-default hover:bg-surface-muted text-text-primary text-sm font-medium transition-colors disabled:opacity-50"
          >
            {c.actions.pause}
          </button>
        )}

        {/* Resend approval email */}
        <button
          disabled={loading}
          onClick={() => handle(() => resendApprovalEmail(practitionerId))}
          className="px-4 py-2 rounded-lg border border-border-default hover:bg-surface-muted text-text-primary text-sm font-medium transition-colors disabled:opacity-50"
        >
          {c.actions.resendApproval}
        </button>
      </div>

      {/* Pause form */}
      {showPause && (
        <div className="rounded-lg border border-border-default bg-surface-muted p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              {c.pauseReasonLabel}
            </label>
            <textarea
              rows={2}
              value={pauseReason}
              onChange={(e) => setPauseReason(e.target.value)}
              placeholder={c.pauseReasonPlaceholder}
              className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-raised text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              disabled={loading}
              onClick={() => handle(() => pausePractitioner(practitionerId, pauseReason))}
              className="px-4 py-2 rounded-lg bg-status-errorBg text-status-errorText border border-status-errorBorder text-sm font-medium transition-colors disabled:opacity-50"
            >
              {c.actions.pause}
            </button>
            <button
              onClick={() => setShowPause(false)}
              className="px-4 py-2 rounded-lg border border-border-default text-text-secondary hover:bg-surface-muted text-sm font-medium transition-colors"
            >
              {copy.shared.cancel}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
