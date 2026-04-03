'use client'

import { useState } from 'react'
import Link from 'next/link'
import { copy } from '@/lib/copy'
import { createResource, updateResource } from './actions'

interface ResourceData {
  id?: string
  title?: string | null
  description?: string | null
  body?: string | null
  resource_type?: string | null
  topic_tags?: string[] | null
  status?: string | null
}

interface Props {
  mode: 'create' | 'edit'
  resource?: ResourceData
}

export default function ResourceForm({ mode, resource }: Props) {
  const [loading, setLoading] = useState(false)

  const heading = mode === 'create' ? copy.resources.form.heading.create : copy.resources.form.heading.edit
  const f = copy.resources.form.fields

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    try {
      if (mode === 'create') {
        await createResource(formData)
      } else if (resource?.id) {
        await updateResource(resource.id, formData)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="px-8 py-6 border-b border-border-default bg-surface-raised flex items-center gap-4">
        <Link href="/resources" className="text-text-secondary hover:text-text-primary text-sm">
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
              defaultValue={resource?.title ?? ''}
              className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-raised text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">{f.description}</label>
            <textarea
              name="description"
              rows={2}
              defaultValue={resource?.description ?? ''}
              className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-raised text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">{f.body}</label>
            <textarea
              name="body"
              rows={10}
              defaultValue={resource?.body ?? ''}
              className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-raised text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">{f.type}</label>
              <select
                name="resource_type"
                defaultValue={resource?.resource_type ?? 'article'}
                className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-raised text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-default"
              >
                {Object.entries(copy.resources.types).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">{f.status}</label>
              <select
                name="status"
                defaultValue={resource?.status ?? 'draft'}
                className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-raised text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-default"
              >
                {Object.entries(copy.resources.statuses).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">{f.topicTags}</label>
            <input
              name="topic_tags"
              defaultValue={resource?.topic_tags?.join(', ') ?? ''}
              placeholder={f.tagsHint}
              className="w-full px-3 py-2 rounded-lg border border-border-default bg-surface-raised text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent"
            />
            <p className="text-xs text-text-muted mt-1">{f.tagsHint}</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-brand-default hover:bg-brand-hover text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {copy.resources.form.save}
            </button>
            <Link
              href="/resources"
              className="px-4 py-2 rounded-lg border border-border-default hover:bg-surface-muted text-text-primary text-sm font-medium transition-colors"
            >
              {copy.resources.form.cancel}
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
