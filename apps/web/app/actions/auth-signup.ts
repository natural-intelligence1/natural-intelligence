'use server'

import {
  createServerSupabaseClient,
  buildSignupConsentPayload, canSignSignupConsent,
  CONSENT_TEXT_VERSION, SIGNUP_CONSENT_METADATA_KEY,
  type ConsentPurpose,
} from '@natural-intelligence/db'
import { redirect } from 'next/navigation'

// The two foundational consents the signup form requires. Both checkboxes are
// `required`, so reaching the signUp call means the member actively accepted
// both — which is what the signed payload attests to.
const SIGNUP_PURPOSES: ConsentPurpose[] = ['platform_terms', 'data_processing']

export async function signupWithConsent(formData: FormData) {
  const supabase = createServerSupabaseClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('full_name') as string
  const consentTerms = formData.get('consent_terms') === '1'
  const consentData = formData.get('consent_data') === '1'

  if (!consentTerms || !consentData) {
    redirect(`/auth/signup?error=${encodeURIComponent('You must agree to the terms to continue.')}`)
  }

  // ── Consent evidence: carried on the USER, not on this browser ─────────────
  //
  // This used to INSERT into consent_records right after signUp(). It could
  // never work: email confirmation is required, so signUp() returns a user and
  // NO session, leaving this client on the `anon` role — and consent_records
  // has no anon INSERT policy, by design. RLS refused every attempt, which is
  // why the live table has never held a single source='signup_form' row.
  //
  // The decision is instead signed here and carried in the user's own
  // auth metadata, then persisted at /auth/callback once a session exists
  // (see packages/db/src/consent/foundational.ts). A short-lived signed cookie
  // was assessed and rejected: it is bound to this browser, so confirming the
  // email on a phone would silently reproduce the original defect.
  const decidedAt = new Date()
  const consentPayload = buildSignupConsentPayload({
    email,
    purposes:  SIGNUP_PURPOSES,
    decidedAt,
    version:   CONSENT_TEXT_VERSION,
  })

  if (!consentPayload) {
    // No signing secret configured. The account is still created — the member
    // did accept — but NO evidence is fabricated. ensureFoundationalConsents()
    // will ask them to affirm on first authenticated entry.
    console.error(JSON.stringify({
      event: 'signup.consent_payload_unsigned',
      reason: 'no SIGNUP_CONSENT_SECRET and no SUPABASE_SERVICE_ROLE_KEY to derive from',
      can_sign: canSignSignupConsent(),
    }))
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        // Same transport that already carries full_name through to
        // handle_new_user(), so this is a proven path, not a new one.
        ...(consentPayload ? { [SIGNUP_CONSENT_METADATA_KEY]: consentPayload } : {}),
      },
    },
  })

  if (error) {
    redirect(`/auth/signup?error=${encodeURIComponent(error.message)}`)
  }

  if (data.user) {
    console.log(JSON.stringify({
      event:            'signup.consent_payload_attached',
      profile_id:       data.user.id,
      consent_version:  CONSENT_TEXT_VERSION,
      purposes:         SIGNUP_PURPOSES,
      signed:           consentPayload !== null,
      // Persistence happens at the auth callback, not here.
      persisted:        false,
    }))

    // Fire-and-forget notify (best effort)
    try {
      await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/api/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'signup',
          fullName,
          email,
          joinedAt: decidedAt.toISOString(),
        }),
      })
    } catch {
      // Non-fatal
    }
  }

  redirect('/welcome')
}
