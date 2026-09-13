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
  title: 'Privacy & Data Controls',
  description: 'See what NI holds about you, manage your consents, and export, correct or delete your data.',
}

// Sprint 3 — member Privacy & Consent page. Closes the privacy-policy
// promise/reality gap: members can now see their consents and submit
// withdrawal / restriction / access / correction / export / erasure requests.
// Requests are fulfilled manually by the NI team (no instant deletion is
// promised). Table availability degrades gracefully pre-migration.

const REQUEST_LABELS: Record<RightsRequestType, string> = {
  access:             'See a copy of what NI holds about me',
  correction:         'Correct or update something in my data',
  export:             'Download / export my data',
  erasure:            'Delete my eligible data or my account',
  restriction:        'Restrict how my data is used',
  consent_withdrawal: 'Manage or withdraw an optional consent',
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
        <h1 className="text-2xl font-semibold text-text-primary mb-2">Privacy &amp; Data Controls</h1>
        <p className="text-sm text-text-secondary max-w-xl mb-3">
          From here you can see what Natural Intelligence holds about you,
          download or export your data, correct or update it, delete eligible
          self-serve data, request deletion of your account, and manage or
          withdraw your optional consents. Requests are handled personally by
          the Natural Intelligence team — we will acknowledge your request and
          keep you informed.
        </p>
        <p className="text-xs text-text-muted max-w-xl mb-2">
          Deletion: data you created through the self-serve tools can be
          deleted. Some records must or may legitimately be retained under
          legal or professional requirements — for example records Natural
          Intelligence or a practitioner must keep for legal, professional,
          complaints, insurance or claims purposes — so we do not promise that
          everything will be deleted.
        </p>
        <p className="text-xs text-text-muted max-w-xl">
          Withdrawal and retention: withdrawing a consent stops future
          processing that relies on it; it does not automatically erase
          information covered by those retention requirements. Natural
          Intelligence may retain data while your account or a service remains
          active where still necessary for the stated purpose, subject to the
          retention schedule.
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
