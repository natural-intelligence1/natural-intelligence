'use client'

import { useState } from 'react'
import { copy } from '@/lib/copy'
import { approveApplication, rejectApplication, markUnderReview } from './actions'

interface Props {
  applicationId: string
  initialNotes:  string | null
  currentStatus: string
}

export default function ApplicationActions({ applicationId, initialNotes, currentStatus }: Props) {
  const [notes,   setNotes]   = useState(initialNotes ?? '')
  const [loading, setLoading] = useState(false)

  async function handle(action: 'approve' | 'reject' | 'under_review') {
    setLoading(true)
    try {
      if (action === 'approve')      await approveApplication(applicationId, notes)
      else if (action === 'reject')  await rejectApplication(applicationId, notes)
      else                           await markUnderReview(applicationId)
    } finally {
      setLoading(false)
    }
  }

  const isFinal = currentStatus === 'approved' || currentStatus === 'rejected'

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1">
          {copy.applications.detail.fields.reviewerNotes}
        </label>
        <textarea
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={copy.applications.detail.notesPlaceholder}
          className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-raised text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent resize-none"
        />
      </div>
      {!isFinal && (
        <div className="flex gap-3 flex-wrap">
          <button
            disabled={loading}
            onClick={() => handle('approve')}
            className="px-4 py-2 rounded-lg bg-brand-default hover:bg-brand-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {copy.applications.detail.actions.approve}
          </button>
          {currentStatus !== 'under_review' && currentStatus !== 'reviewing' && (
            <button
              disabled={loading}
              onClick={() => handle('under_review')}
              className="px-4 py-2 rounded-lg border border-border-default hover:bg-surface-muted text-text-primary text-sm font-medium transition-colors disabled:opacity-50"
            >
              {copy.applications.detail.actions.reviewing}
            </button>
          )}
          <button
            disabled={loading}
            onClick={() => handle('reject')}
            className="px-4 py-2 rounded-lg bg-status-errorBg text-status-errorText border border-status-errorBorder text-sm font-medium transition-colors disabled:opacity-50"
          >
            {copy.applications.detail.actions.reject}
          </button>
        </div>
      )}
      {isFinal && (
        <p className="text-sm text-text-muted">
          This application has been {currentStatus}. No further actions are available.
        </p>
      )}
    </div>
  )
}
