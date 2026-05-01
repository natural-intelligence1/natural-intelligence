'use server'

import { createServerSupabaseClient } from '@natural-intelligence/db'
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
    await supabase.from('consent_records').insert([
      {
        profile_id: data.user.id,
        email,
        consent_type: 'platform_terms',
        consented: true,
        consented_at: now,
      },
      {
        profile_id: data.user.id,
        email,
        consent_type: 'data_processing',
        consented: true,
        consented_at: now,
      },
    ])

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
