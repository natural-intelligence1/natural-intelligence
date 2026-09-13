'use client'

// Sprint 3 — intake-start consent gate. Shown INSTEAD of the intake form until
// the required granular consents are granted; the exact text of every consent
// is displayed and recorded verbatim with its version. Wording is
// DRAFT — requires solicitor/clinician review before real-client use.

import { useState, useTransition } from 'react'
// Subpath import: the db ROOT barrel re-exports server.ts (next/headers),
// which a client component must never pull into its bundle.
import {
  CONSENT_TEXTS, REQUIRED_INTAKE_CONSENTS, OPTIONAL_INTAKE_CONSENTS,
  type ConsentPurpose,
} from '@natural-intelligence/db/consent'
import { grantIntakeConsents } from './actions'

const PURPOSE_LABELS: Record<string, string> = {
  record_holding:                'Holding your health record',
  ai_assisted_processing:        'AI-assisted organisation of your record',
  deidentified_synopsis_sharing: 'Sharing a de-identified synopsis with a practitioner',
  retention_beyond_episode:      'Keeping your record after your care episode',
  anonymised_research:           'Anonymised research use',
}

export function IntakeConsentGate() {
  const [choices, setChoices] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const allRequiredTicked = REQUIRED_INTAKE_CONSENTS.every((p) => choices[p])

  function toggle(p: ConsentPurpose) {
    setChoices((c) => ({ ...c, [p]: !c[p] }))
  }

  function submit() {
    setError(null)
    startTransition(async () => {
      try {
        await grantIntakeConsents(choices)
        window.location.reload()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
      }
    })
  }

  function ConsentRow({ purpose, required }: { purpose: ConsentPurpose; required: boolean }) {
    return (
      <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-border-default bg-surface-base p-4">
        <input
          type="checkbox"
          checked={!!choices[purpose]}
          onChange={() => toggle(purpose)}
          className="mt-0.5 w-4 h-4 rounded border-border-default text-brand-default"
        />
        <span>
          <span className="block text-sm font-medium text-text-primary mb-1">
            {PURPOSE_LABELS[purpose]} {required ? <span className="text-status-errorText">*</span> : <span className="text-xs text-text-muted">(optional)</span>}
          </span>
          <span className="block text-xs text-text-secondary leading-relaxed">
            {CONSENT_TEXTS[purpose]}
          </span>
        </span>
      </label>
    )
  }

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold text-text-primary mb-2">Before you begin</h1>
      <p className="text-sm text-text-secondary mb-2 max-w-xl">
        Your intake collects health information. Please read and choose each
        consent below — nothing is saved until the required consents are in
        place, and you can withdraw any consent later from Privacy &amp; consent.
      </p>
      <p className="text-xs text-text-muted mb-6">
        DRAFT — requires solicitor/clinician review before real-client use.
      </p>

      <div className="space-y-3 mb-3">
        {REQUIRED_INTAKE_CONSENTS.map((p) => <ConsentRow key={p} purpose={p} required />)}
      </div>
      <div className="space-y-3 mb-6">
        {OPTIONAL_INTAKE_CONSENTS.map((p) => <ConsentRow key={p} purpose={p} required={false} />)}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-status-errorBorder bg-status-errorBg px-4 py-3 text-sm text-status-errorText">
          {error}
        </div>
      )}

      <button
        type="button"
        disabled={!allRequiredTicked || isPending}
        onClick={submit}
        className="px-6 py-3 rounded-full bg-brand-default hover:bg-brand-hover text-text-inverted text-sm font-medium transition-colors disabled:opacity-50"
      >
        {isPending ? 'Saving…' : 'Save my choices and begin'}
      </button>
      {!allRequiredTicked && (
        <p className="text-xs text-text-muted mt-3">
          The two required consents (*) must be granted before the intake can start.
        </p>
      )}
    </div>
  )
}
