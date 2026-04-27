'use client'

import { useState, useTransition } from 'react'
import { copy } from '@/lib/copy'

async function submitSupportRequest(data: {
  full_name: string
  email: string
  phone?: string
  request_type: string
  description: string
  urgency: string
}): Promise<{ error?: string }> {
  const res = await fetch('/api/support', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    return { error: json.error ?? copy.auth.errors.generic }
  }
  return {}
}

export default function SupportPage() {
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [consented, setConsented] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!consented) {
      setError(copy.auth.errors.consentRequired)
      return
    }
    const fd = new FormData(e.currentTarget)
    const data = {
      full_name: fd.get('full_name') as string,
      email: fd.get('email') as string,
      phone: (fd.get('phone') as string) || undefined,
      request_type: fd.get('request_type') as string,
      description: fd.get('description') as string,
      urgency: fd.get('urgency') as string,
    }
    startTransition(async () => {
      const result = await submitSupportRequest(data)
      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(true)
      }
    })
  }

  if (success) {
    return (
      <div className="py-24 px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto text-center">
        <div className="rounded-xl border border-border-default bg-surface-raised p-10 shadow-sm">
          <h1 className="text-2xl font-bold text-text-primary mb-4">{copy.support.success.heading}</h1>
          <p className="text-text-secondary leading-relaxed">{copy.support.success.body}</p>
        </div>
      </div>
    )
  }

  const requestTypeOptions = Object.entries(copy.support.requestTypes)
  const urgencyOptions = Object.entries(copy.support.urgencyLevels)

  return (
    <div className="py-16 px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-text-primary mb-2">{copy.support.heading}</h1>
        <p className="text-text-secondary">{copy.support.subheading}</p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-status-errorBorder bg-status-errorBg px-4 py-3 text-sm text-status-errorText">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="full_name" className="block text-sm font-medium text-text-primary mb-1.5">
            {copy.support.fields.fullName}
          </label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            required
            placeholder={copy.support.placeholders.fullName}
            className="w-full px-3 py-2.5 rounded-lg border border-border-default bg-surface-raised text-text-primary placeholder:text-text-placeholder text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent transition-colors"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-text-primary mb-1.5">
            {copy.support.fields.email}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder={copy.support.placeholders.email}
            className="w-full px-3 py-2.5 rounded-lg border border-border-default bg-surface-raised text-text-primary placeholder:text-text-placeholder text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent transition-colors"
          />
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-text-primary mb-1.5">
            {copy.support.fields.phone}
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            placeholder={copy.support.placeholders.phone}
            className="w-full px-3 py-2.5 rounded-lg border border-border-default bg-surface-raised text-text-primary placeholder:text-text-placeholder text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent transition-colors"
          />
        </div>

        <div>
          <label htmlFor="request_type" className="block text-sm font-medium text-text-primary mb-1.5">
            {copy.support.fields.requestType}
          </label>
          <select
            id="request_type"
            name="request_type"
            required
            defaultValue=""
            className="w-full px-3 py-2.5 rounded-lg border border-border-default bg-surface-raised text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent transition-colors"
          >
            <option value="" disabled>{copy.support.fields.requestType}</option>
            {requestTypeOptions.map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="urgency" className="block text-sm font-medium text-text-primary mb-1.5">
            {copy.support.fields.urgency}
          </label>
          <select
            id="urgency"
            name="urgency"
            required
            defaultValue="normal"
            className="w-full px-3 py-2.5 rounded-lg border border-border-default bg-surface-raised text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent transition-colors"
          >
            {urgencyOptions.map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-text-primary mb-1.5">
            {copy.support.fields.description}
          </label>
          <textarea
            id="description"
            name="description"
            rows={5}
            required
            placeholder={copy.support.placeholders.description}
            className="w-full px-3 py-2.5 rounded-lg border border-border-default bg-surface-raised text-text-primary placeholder:text-text-placeholder text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent transition-colors resize-none"
          />
        </div>

        <label className="flex items-start gap-3 cursor-pointer pt-2">
          <input
            type="checkbox"
            checked={consented}
            onChange={(e) => setConsented(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-border-default text-brand-default focus:ring-brand-default"
          />
          <span className="text-sm text-text-secondary leading-relaxed">
            {copy.support.fields.consent}
          </span>
        </label>

        <button
          type="submit"
          disabled={isPending}
          className="w-full px-5 py-3 rounded-lg bg-brand-default hover:bg-brand-hover text-text-inverted text-sm font-medium transition-colors disabled:opacity-50"
        >
          {isPending ? '…' : copy.support.submit}
        </button>
      </form>
    </div>
  )
}
