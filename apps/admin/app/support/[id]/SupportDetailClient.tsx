'use client'

import { useState } from 'react'
import { copy } from '@/lib/copy'
import { saveAdminNotes, updateSupportStatus } from './actions'

interface Props {
  requestId: string
  initialNotes: string | null
  currentStatus: string
}

const statuses = Object.keys(copy.support.statuses) as Array<keyof typeof copy.support.statuses>

export default function SupportDetailClient({ requestId, initialNotes, currentStatus }: Props) {
  const [notes, setNotes] = useState(initialNotes ?? '')
  const [status, setStatus] = useState(currentStatus)
  const [saving, setSaving] = useState(false)

  async function handleSaveNotes() {
    setSaving(true)
    try { await saveAdminNotes(requestId, notes) }
    finally { setSaving(false) }
  }

  async function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value
    setStatus(newStatus)
    await updateSupportStatus(requestId, newStatus)
  }

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1">
          {copy.support.detail.fields.status}
        </label>
        <select
          value={status}
          onChange={handleStatusChange}
          className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-raised text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-default"
        >
          {statuses.map((s) => (
            <option key={s} value={s}>
              {copy.support.statuses[s]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1">
          {copy.support.detail.fields.adminNotes}
        </label>
        <textarea
          rows={5}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={copy.support.detail.notesPlaceholder}
          className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-raised text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent resize-none"
        />
        <button
          disabled={saving}
          onClick={handleSaveNotes}
          className="mt-2 px-4 py-2 rounded-lg bg-brand-default hover:bg-brand-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          {copy.support.detail.saveNotes}
        </button>
      </div>
    </div>
  )
}
