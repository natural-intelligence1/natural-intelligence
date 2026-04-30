'use client'

import { useState } from 'react'
import Link from 'next/link'
import { copy } from '@/lib/copy'
import { createEvent, updateEvent } from './actions'

interface EventData {
  id?: string
  title?: string | null
  description?: string | null
  event_type?: string | null
  starts_at?: string | null
  ends_at?: string | null
  location?: string | null
  is_online?: boolean | null
  meeting_url?: string | null
  max_capacity?: number | null
  status?: string | null
}

interface Props {
  mode: 'create' | 'edit'
  event?: EventData
}

function toDatetimeLocal(iso: string | null | undefined) {
  if (!iso) return ''
  return iso.slice(0, 16)
}

export default function EventForm({ mode, event }: Props) {
  const [isOnline, setIsOnline] = useState(event?.is_online ?? false)
  const [loading, setLoading] = useState(false)

  const heading = mode === 'create' ? copy.workshops.form.heading.create : copy.workshops.form.heading.edit
  const f = copy.workshops.form.fields

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    try {
      if (mode === 'create') {
        await createEvent(formData)
      } else if (event?.id) {
        await updateEvent(event.id, formData)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="px-8 py-6 border-b border-border-default bg-surface-raised flex items-center gap-4">
        <Link href="/workshops" className="text-text-secondary hover:text-text-primary text-sm">
          {copy.shared.back}
        </Link>
        <span className="text-text-muted">/</span>
        <h1 className="text-2xl font-semibold text-text-primary">{heading}</h1>
      </div>

      <div className="px-8 py-6 max-w-2xl">
        <form action={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">{f.title}</label>
            <input
              name="title"
              required
              defaultValue={event?.title ?? ''}
              className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-raised text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">{f.description}</label>
            <textarea
              name="description"
              rows={3}
              defaultValue={event?.description ?? ''}
              className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-raised text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">{f.type}</label>
              <select
                name="event_type"
                defaultValue={event?.event_type ?? 'workshop'}
                className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-raised text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-default"
              >
                {Object.entries(copy.workshops.types).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">{f.status}</label>
              <select
                name="status"
                defaultValue={event?.status ?? 'draft'}
                className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-raised text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-default"
              >
                {Object.entries(copy.workshops.statuses).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">{f.startsAt}</label>
              <input
                type="datetime-local"
                name="starts_at"
                defaultValue={toDatetimeLocal(event?.starts_at)}
                className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-raised text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">{f.endsAt}</label>
              <input
                type="datetime-local"
                name="ends_at"
                defaultValue={toDatetimeLocal(event?.ends_at)}
                className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-raised text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_online"
              name="is_online"
              checked={isOnline}
              onChange={(e) => setIsOnline(e.target.checked)}
              className="rounded border-border-default"
            />
            <label htmlFor="is_online" className="text-sm font-medium text-text-secondary">{f.isOnline}</label>
          </div>

          {isOnline ? (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">{f.meetingUrl}</label>
              <input
                type="url"
                name="meeting_url"
                defaultValue={event?.meeting_url ?? ''}
                className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-raised text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">{f.location}</label>
              <input
                name="location"
                defaultValue={event?.location ?? ''}
                className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-raised text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">{f.maxCapacity}</label>
            <input
              type="number"
              name="max_capacity"
              min="1"
              defaultValue={event?.max_capacity ?? ''}
              className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-raised text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-brand-default hover:bg-brand-hover text-text-inverted text-sm font-medium transition-colors disabled:opacity-50"
            >
              {copy.workshops.form.save}
            </button>
            <Link
              href="/workshops"
              className="px-4 py-2 rounded-lg border border-border-default hover:bg-surface-muted text-text-primary text-sm font-medium transition-colors"
            >
              {copy.workshops.form.cancel}
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
