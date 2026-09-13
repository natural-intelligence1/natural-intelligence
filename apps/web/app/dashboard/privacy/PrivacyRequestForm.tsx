'use client'

// Sprint 3 (review amendment 1) — rights-request form with GRANULAR consent
// withdrawal: choosing "Withdraw a consent I gave" reveals a consent-purpose
// selector. "Withdraw all consents" is deliberately its own choice and is
// treated by enforcement as a global processing restriction.

import { useState } from 'react'

const PURPOSE_LABELS: Record<string, string> = {
  data_processing:               'Data processing (platform service)',
  record_holding:                'Holding my health record',
  deidentified_synopsis_sharing: 'Sharing a de-identified synopsis with a practitioner',
  ai_assisted_processing:        'AI-assisted organisation of my record',
  retention_beyond_episode:      'Keeping my record after my care episode',
  anonymised_research:           'Anonymised research use',
}

export function PrivacyRequestForm({
  submitAction, requestTypes, requestLabels, consentPurposes,
}: {
  submitAction: (formData: FormData) => Promise<void>
  requestTypes: string[]
  requestLabels: Record<string, string>
  consentPurposes: string[]
}) {
  const [requestType, setRequestType] = useState(requestTypes[0] ?? 'access')
  const isWithdrawal = requestType === 'consent_withdrawal'

  return (
    <form action={submitAction} className="space-y-4">
      <div>
        <label htmlFor="request_type" className="block text-sm font-medium text-text-primary mb-1.5">
          What would you like to do?
        </label>
        <select
          id="request_type" name="request_type" required
          value={requestType}
          onChange={(e) => setRequestType(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg border border-border-default bg-surface-base text-text-primary text-sm"
        >
          {requestTypes.map((t) => (
            <option key={t} value={t}>{requestLabels[t] ?? t}</option>
          ))}
        </select>
      </div>

      {isWithdrawal && (
        <div>
          <label htmlFor="consent_type" className="block text-sm font-medium text-text-primary mb-1.5">
            Which consent?
          </label>
          <select
            id="consent_type" name="consent_type"
            className="w-full px-3 py-2.5 rounded-lg border border-border-default bg-surface-base text-text-primary text-sm"
          >
            {consentPurposes.map((p) => (
              <option key={p} value={p}>{PURPOSE_LABELS[p] ?? p.replace(/_/g, ' ')}</option>
            ))}
            <option value="">All consents — restrict all further processing</option>
          </select>
          <p className="text-xs text-text-muted mt-1.5">
            Withdrawing one consent stops that specific use. Choosing
            &ldquo;All consents&rdquo; asks us to restrict all further processing
            of your record.
          </p>
        </div>
      )}

      <div>
        <label htmlFor="details" className="block text-sm font-medium text-text-primary mb-1.5">
          Tell us more (optional)
        </label>
        <textarea
          id="details" name="details" rows={3} maxLength={2000}
          placeholder="Anything that helps us action this for you…"
          className="w-full px-3 py-2.5 rounded-lg border border-border-default bg-surface-base text-text-primary text-sm resize-none"
        />
      </div>

      <button
        type="submit"
        className="px-5 py-2.5 rounded-full bg-brand-default hover:bg-brand-hover text-text-inverted text-sm font-medium transition-colors"
      >
        Submit request
      </button>
    </form>
  )
}
