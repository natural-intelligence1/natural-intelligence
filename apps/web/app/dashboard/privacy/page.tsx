import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import {
  createServerSupabaseClient,
  getMemberConsents, listOwnRightsRequests, isRightsChannelAvailable,
  RIGHTS_REQUEST_TYPES, CONSENT_PURPOSES, type RightsRequestType,
} from '@natural-intelligence/db'
import { PrivacyRequestForm } from './PrivacyRequestForm'
import { submitRightsRequest } from './actions'

export const metadata: Metadata = {
  title: 'Privacy & consent',
  description: 'See your consents and make requests about your data.',
}

// Sprint 3 — member Privacy & Consent page. Closes the privacy-policy
// promise/reality gap: members can now see their consents and submit
// withdrawal / restriction / access / correction / export / erasure requests.
// Requests are fulfilled manually by the NI team (no instant deletion is
// promised). Table availability degrades gracefully pre-migration.

const REQUEST_LABELS: Record<RightsRequestType, string> = {
  access:             'See a copy of my data',
  correction:         'Correct something in my data',
  export:             'Export my data',
  erasure:            'Delete my data',
  restriction:        'Restrict how my data is used',
  consent_withdrawal: 'Withdraw a consent I gave',
}

const STATUS_LABELS: Record<string, string> = {
  new: 'Received', acknowledged: 'Acknowledged', in_progress: 'In progress',
  fulfilled: 'Fulfilled', refused: 'Declined', withdrawn: 'Withdrawn',
}

export default async function PrivacyPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Pre-migration degradation (final review, item 4): if the rights-request
  // table is not available yet (0051 unapplied), render a clear "coming soon /
  // contact us" state instead of a form that would fail on submit.
  const [consents, requests, channelAvailable] = await Promise.all([
    getMemberConsents(supabase, user.id),
    listOwnRightsRequests(supabase, user.id),
    isRightsChannelAvailable(supabase),
  ])

  return (
    <div className="py-10 px-4 sm:px-6 lg:px-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-text-primary mb-2">Privacy &amp; consent</h1>
        <p className="text-sm text-text-secondary max-w-xl">
          What you have consented to, and how to change it. Requests are handled
          personally by the Natural Intelligence team — we will acknowledge your
          request and keep you informed. We do not promise instant deletion:
          some records must be retained where the law requires it.
        </p>
      </div>

      {/* Consents */}
      <section className="rounded-xl border border-border-default bg-surface-raised p-6 mb-6">
        <h2 className="text-base font-semibold text-text-primary mb-4">Your consents</h2>
        {consents.length === 0 ? (
          <p className="text-sm text-text-muted">
            No consent records are available to display yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {consents.map((c) => (
              <li key={c.id} className="text-sm flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium text-text-primary">{c.consent_type.replace(/_/g, ' ')}</span>
                <span className={c.withdrawn_at ? 'text-status-errorText' : 'text-status-successText'}>
                  {c.withdrawn_at ? 'withdrawn' : c.consented ? 'granted' : 'declined'}
                </span>
                <span className="text-xs text-text-muted">
                  {c.consented_at ? new Date(c.consented_at).toLocaleDateString('en-GB') : ''}
                  {c.consent_version ? ` · ${c.consent_version}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Submit a request */}
      <section className="rounded-xl border border-border-default bg-surface-raised p-6 mb-6">
        <h2 className="text-base font-semibold text-text-primary mb-2">Make a request</h2>
        {channelAvailable ? (
          <>
            <p className="text-xs text-text-muted mb-4">
              DRAFT wording — requires solicitor review before real-client use.
            </p>
            <PrivacyRequestForm
              submitAction={submitRightsRequest}
              requestTypes={[...RIGHTS_REQUEST_TYPES]}
              requestLabels={REQUEST_LABELS}
              consentPurposes={CONSENT_PURPOSES.filter((p) => p !== 'platform_terms' && p !== 'data_processing')}
            />
          </>
        ) : (
          <p className="text-sm text-text-secondary">
            Online privacy requests are not available just yet — this part of
            the service is being finalised. In the meantime, you can make any
            request about your data (including withdrawing a consent or asking
            for a copy, correction or deletion) by contacting the Natural
            Intelligence team directly at{' '}
            <a href="mailto:info@natural-intelligence.uk" className="underline text-text-primary">
              info@natural-intelligence.uk
            </a>
            . Your rights are unaffected.
          </p>
        )}
      </section>

      {/* Existing requests */}
      <section className="rounded-xl border border-border-default bg-surface-raised p-6">
        <h2 className="text-base font-semibold text-text-primary mb-4">Your requests</h2>
        {!channelAvailable ? (
          <p className="text-sm text-text-muted">
            Requests made by email are handled personally and are not listed here yet.
          </p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-text-muted">You have not made any requests.</p>
        ) : (
          <ul className="space-y-3">
            {requests.map((r) => (
              <li key={r.id} className="text-sm flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium text-text-primary">{REQUEST_LABELS[r.request_type] ?? r.request_type}</span>
                <span className="text-text-secondary">{STATUS_LABELS[r.status] ?? r.status}</span>
                <span className="text-xs text-text-muted">{new Date(r.created_at).toLocaleDateString('en-GB')}</span>
                {r.resolution_note && <span className="text-xs text-text-muted w-full">{r.resolution_note}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
