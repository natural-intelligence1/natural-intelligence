'use client'

import Link from 'next/link'
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

const REQUEST_TYPE_ICONS: Record<string, string> = {
  general:            '💬',
  referral:           '🔗',
  charity_referral:   '🌿',
  practitioner_match: '🔍',
  other:              '✉️',
}

export default function SupportPage() {
  const [success, setSuccess]           = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [consented, setConsented]       = useState(false)
  const [isPending, startTransition]    = useTransition()
  const [requestType, setRequestType]   = useState('')
  const [urgency, setUrgency]           = useState('normal')

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!consented) {
      setError(copy.auth.errors.consentRequired)
      return
    }
    if (!requestType) {
      setError('Please select a request type.')
      return
    }
    const fd = new FormData(e.currentTarget)
    const data = {
      full_name:    fd.get('full_name') as string,
      email:        fd.get('email') as string,
      phone:        (fd.get('phone') as string) || undefined,
      request_type: requestType,
      description:  fd.get('description') as string,
      urgency,
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
          <div className="w-12 h-12 rounded-full bg-brand-light flex items-center justify-center mx-auto mb-6">
            <svg className="w-6 h-6 text-brand-text" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-text-primary mb-4">{copy.support.success.heading}</h1>
          <p className="text-text-secondary leading-relaxed mb-8">{copy.support.success.body}</p>
          <Link
            href="/dashboard"
            className="inline-block px-5 py-2.5 rounded-lg bg-brand-default hover:bg-brand-hover text-text-inverted text-sm font-medium transition-colors"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    )
  }

  const requestTypeEntries = Object.entries(copy.support.requestTypes)
  const urgencyEntries = Object.entries(copy.support.urgencyLevels)

  const inputClass =
    'w-full px-3 py-2.5 rounded-lg border border-border-default bg-surface-raised text-text-primary placeholder:text-text-placeholder text-sm focus:outline-none focus:ring-2 focus:ring-brand-default focus:border-transparent transition-colors'
  const labelClass = 'block text-sm font-medium text-text-primary mb-1.5'

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

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Name */}
        <div>
          <label htmlFor="full_name" className={labelClass}>{copy.support.fields.fullName}</label>
          <input
            id="full_name" name="full_name" type="text" required
            placeholder={copy.support.placeholders.fullName}
            className={inputClass}
          />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className={labelClass}>{copy.support.fields.email}</label>
          <input
            id="email" name="email" type="email" required
            placeholder={copy.support.placeholders.email}
            className={inputClass}
          />
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="phone" className={labelClass}>{copy.support.fields.phone}</label>
          <input
            id="phone" name="phone" type="tel"
            placeholder={copy.support.placeholders.phone}
            className={inputClass}
          />
        </div>

        {/* Request type — card selector 2×3 */}
        <div>
          <p className={labelClass}>{copy.support.fields.requestType}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {requestTypeEntries.map(([key, label]) => {
              const selected = requestType === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setRequestType(key)}
                  className={`flex flex-col items-start gap-1.5 px-4 py-3.5 rounded-xl border text-left transition-colors ${
                    selected
                      ? 'border-brand-default bg-brand-light ring-1 ring-brand-default'
                      : 'border-border-default bg-surface-raised hover:bg-surface-muted'
                  }`}
                >
                  <span className="text-lg leading-none">{REQUEST_TYPE_ICONS[key] ?? '📋'}</span>
                  <span className={`text-sm font-medium leading-snug ${selected ? 'text-brand-text' : 'text-text-primary'}`}>
                    {label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Charity referral explanation card */}
        {requestType === 'charity_referral' && (
          <div className="rounded-xl border border-status-warningBorder bg-status-warningBg p-4">
            <p className="text-sm font-semibold text-status-warningText mb-1">About charity-supported referrals</p>
            <p className="text-sm text-status-warningText leading-relaxed">
              This option is for individuals who require financial assistance to access practitioner support.
              Natural Intelligence works with a small number of charitable partners to subsidise sessions.
              Our team will assess your request and be in touch with next steps. Please describe your situation in the message below.
            </p>
          </div>
        )}

        {/* Urgency — 3-button row */}
        <div>
          <p className={labelClass}>{copy.support.fields.urgency}</p>
          <div className="grid grid-cols-3 gap-3">
            {urgencyEntries.map(([key, label]) => {
              const selected = urgency === key
              const accentClass =
                key === 'high'   ? (selected ? 'border-status-errorText bg-status-errorBg text-status-errorText ring-1 ring-status-errorText' : 'border-border-default text-text-secondary hover:border-status-errorText hover:text-status-errorText') :
                key === 'normal' ? (selected ? 'border-brand-default bg-brand-light text-brand-text ring-1 ring-brand-default' : 'border-border-default text-text-secondary hover:bg-surface-muted') :
                                   (selected ? 'border-border-default bg-surface-muted text-text-secondary ring-1 ring-border-default' : 'border-border-default text-text-secondary hover:bg-surface-muted')
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setUrgency(key)}
                  className={`py-2.5 px-3 rounded-lg border text-sm font-medium text-center transition-colors ${accentClass}`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className={labelClass}>{copy.support.fields.description}</label>
          <textarea
            id="description" name="description" rows={5} required
            placeholder={copy.support.placeholders.description}
            className={`${inputClass} resize-none`}
          />
        </div>

        {/* Consent */}
        <label className="flex items-start gap-3 cursor-pointer pt-1">
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
