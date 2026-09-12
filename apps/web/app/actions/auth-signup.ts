'use server'

import { createServerSupabaseClient, recordSignupConsents } from '@natural-intelligence/db'
import { redirect } from 'next/navigation'

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

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  })

  if (error) {
    redirect(`/auth/signup?error=${encodeURIComponent(error.message)}`)
  }

  // Insert consent records if user was created
  if (data.user) {
    const now = new Date().toISOString()
    // Sprint 3: signup consents are written VERSIONED (consent_version, exact
    // consent_text shown, source 'signup_form', actor 'member'). Before
    // migration 0051 the versioned columns do not exist, so recordSignupConsents
    // falls back to the legacy row shape ONLY on a missing-column error; every
    // other failure is surfaced loudly here — consent evidence must never fail
    // silently. Signup itself proceeds (the account exists), but the missing
    // evidence is operationally visible.
    const consentResult = await recordSignupConsents(supabase, data.user.id, email)
    if (!consentResult.ok) {
      console.error(JSON.stringify({
        event: 'signup.consent_record_write_failed',
        profile_id: data.user.id,
        downgraded_attempt: consentResult.downgraded,
        code: consentResult.error?.code,
        message: consentResult.error?.message,
      }))
    } else if (consentResult.downgraded) {
      console.warn(JSON.stringify({
        event: 'signup.consent_record_written_unversioned',
        profile_id: data.user.id,
        reason: 'pre-0051 schema — versioned consent columns not present',
      }))
    }

    // Fire-and-forget notify (best effort)
    try {
      await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/api/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'signup',
          fullName,
          email,
          joinedAt: now,
        }),
      })
    } catch {
      // Non-fatal
    }
  }

  redirect('/welcome')
}
