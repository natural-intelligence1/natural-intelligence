import Link from 'next/link'
import {
  CONSENT_TEXT_VERSION, resolveConsentText, type ConsentPurpose,
} from '@natural-intelligence/db'
import { affirmFoundationalConsents } from './consent-gate-actions'

/**
 * Shown when an account holds no active evidence of the foundational consents.
 *
 * Why an account can be in this state: before the signup-consent repair, the
 * consent INSERT ran as `anon` immediately after signUp() and was refused by
 * RLS, so no row was ever written. Those accounts are not assumed to have
 * agreed — they are asked, once, and the answer is recorded with the real
 * timestamp of the answer.
 *
 * Privacy and Data Rights stay reachable from here and are exempt from the
 * gate in the dashboard layout, so a member can always exercise their rights
 * without first agreeing to anything.
 */
export function ConsentReaffirmationGate({
  missing,
  failed,
}: {
  missing: ConsentPurpose[]
  failed?: boolean
}) {
  const items = missing
    .map((purpose) => ({ purpose, text: resolveConsentText(CONSENT_TEXT_VERSION, purpose) }))
    .filter((i): i is { purpose: ConsentPurpose; text: string } => i.text !== null)

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <p className="text-xs font-semibold text-text-brand uppercase tracking-wider mb-1">
          One moment
        </p>
        <h1 className="text-2xl font-bold text-text-primary">
          Please confirm how we may hold your information
        </h1>
        <p className="text-sm text-text-secondary mt-2 leading-relaxed">
          We do not have a complete record of your agreement to these, so we would
          rather ask than assume. It takes one click and you will not be asked again.
        </p>
      </div>

      {failed && (
        <div className="mb-5 rounded-lg border border-status-errorBorder bg-status-errorBg px-4 py-3 text-sm text-status-errorText">
          We could not save that just now. Please try once more — nothing has been
          recorded yet.
        </div>
      )}

      <form action={affirmFoundationalConsents}>
        <section className="rounded-xl border border-border-default bg-surface-raised p-6">
          <ul className="space-y-4 mb-6">
            {items.map(({ purpose, text }) => (
              <li key={purpose} className="text-sm text-text-secondary leading-relaxed">
                {text}
              </li>
            ))}
          </ul>

          <label className="flex items-start gap-3 cursor-pointer mb-6">
            <input
              type="checkbox"
              name="accept"
              value="1"
              required
              className="mt-0.5 w-4 h-4 rounded border-border-default text-brand-default focus:ring-brand-default"
            />
            <span className="text-sm text-text-primary leading-relaxed">
              I agree to the above.
            </span>
          </label>

          <button
            type="submit"
            className="inline-block px-6 py-2.5 rounded-lg bg-brand-default hover:bg-brand-hover text-text-inverted text-sm font-medium transition-colors"
          >
            Agree and continue
          </button>
        </section>
      </form>

      <p className="text-xs text-text-muted mt-6 leading-relaxed">
        You can always{' '}
        <Link href="/dashboard/privacy" className="underline hover:text-text-secondary">
          review your privacy choices
        </Link>{' '}
        or{' '}
        <Link href="/dashboard/requests" className="underline hover:text-text-secondary">
          make a data rights request
        </Link>{' '}
        without agreeing to anything here.
      </p>
    </div>
  )
}
