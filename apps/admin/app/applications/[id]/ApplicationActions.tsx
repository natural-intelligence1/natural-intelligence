'use client'

import { useState } from 'react'
import { copy } from '@/lib/copy'
import { approveApplication, rejectApplication, markReviewing } from './actions'

interface Props {
  applicationId: string
  initialNotes: string | null
  currentStatus: string
}

export default function ApplicationActions({ applicationId, initialNotes, currentStatus }: Props) {
  const [notes, setNotes] = useState(initialNotes ?? '')
  const [loading, setLoading] = useState(false)

  async function handle(action: 'approve' | 'reject' | 'reviewing') {
    setLoading(true)
    try {
      if (action === 'approve') await approveApplication(applicationId, notes)
      else if (action === 'reject') await rejectApplication(applicationId, notes)
      else await markReviewing(applicationId)
    } finally {
      setLoading(false)
    }
  }

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
      <div className="flex gap-3 flex-wrap">
        {currentStatus !== 'approved' && (
          <button
            disabled={loading}
            onClick={() => handle('approve')}
            className="px-4 py-2 rounded-lg bg-brand-default hover:bg-brand-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {copy.applications.detail.actions.approve}
          </button>
        )}
        {currentStatus !== 'reviewing' && (
          <button
            disabled={loading}
            onClick={() => handle('reviewing')}
            className="px-4 py-2 rounded-lg border border-border-default hover:bg-surface-muted text-text-primary text-sm font-medium transition-colors disabled:opacity-50"
          >
            {copy.applications.detail.actions.reviewing}
          </button>
        )}
        {currentStatus !== 'rejected' && (
          <button
            disabled={loading}
            onClick={() => handle('reject')}
            className="px-4 py-2 rounded-lg bg-status-errorBg hover:bg-status-errorBorder text-status-errorText text-sm font-medium transition-colors disabled:opacity-50"
          >
            {copy.applications.detail.actions.reject}
          </button>
        )}
      </div>
    </div>
  )
}
