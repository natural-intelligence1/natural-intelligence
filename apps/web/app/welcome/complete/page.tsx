// ─── Onboarding complete — the boundary before health intake ────────────────
//
// This page exists to make a product boundary visible: joining NI and telling
// NI about your health are two different acts, and the second one should be
// entered deliberately rather than arrived at.
//
// Before this, /welcome wrote the profile and redirected straight to
// /dashboard, so there was no moment where a person was finished joining and
// had not yet started on health. That moment is the point of this screen.
//
// NOTHING HERE ASKS FOR HEALTH INFORMATION. No symptoms, diagnoses,
// medications, goals, food, lifestyle or history. Onboarding is not intake.

import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@natural-intelligence/db'

export const metadata: Metadata = { title: 'You are set up — Natural Intelligence' }

export default async function OnboardingCompletePage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, onboarding_completed_at')
    .eq('id', user.id)
    .maybeSingle()

  // Reached directly without finishing onboarding — send them back to do it.
  if (!profile?.onboarding_completed_at) redirect('/welcome')

  const firstName = profile.full_name?.trim().split(/\s+/)[0]

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16 bg-surface-base">
      <div className="w-full max-w-lg">

        <div className="flex justify-center mb-8">
          <Image
            src="/images/NI_logo_full_transparent.png"
            alt="Natural Intelligence"
            width={160}
            height={46}
            className="h-10 w-auto"
          />
        </div>

        <div className="bg-surface-raised border border-border-default rounded-2xl p-8 sm:p-10">

          <h1 className="font-display text-3xl text-text-primary mb-3">
            {firstName ? `You are set up, ${firstName}.` : 'You are set up.'}
          </h1>

          <p className="text-text-secondary text-[15px] leading-relaxed mb-8">
            Your account is ready. Nothing about your health has been asked yet &mdash; that is a
            separate step, and it is yours to start when you are ready.
          </p>

          {/* The two acts, named and separated. */}
          <div className="border-t border-border-muted pt-6 mb-8">
            <p className="text-xs uppercase tracking-[0.12em] text-text-muted mb-4">What happens next</p>

            <div className="flex gap-4 mb-5">
              <div aria-hidden className="mt-1 h-5 w-5 flex-shrink-0 rounded-full bg-brand-default/15 border border-brand-default flex items-center justify-center">
                <span className="text-[11px] text-brand-default">&#10003;</span>
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">Your account</p>
                <p className="text-[13px] text-text-muted leading-relaxed">
                  Name, sign-in and preferences. Done.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div aria-hidden className="mt-1 h-5 w-5 flex-shrink-0 rounded-full border border-border-strong" />
              <div>
                <p className="text-sm font-medium text-text-primary">Your health story</p>
                <p className="text-[13px] text-text-muted leading-relaxed">
                  Told once, in your own words, and reused from then on &mdash; so you are not
                  starting again with every practitioner you see.
                </p>
              </div>
            </div>
          </div>

          <Link
            href="/dashboard/intake"
            className="block w-full text-center px-5 py-3 rounded-lg bg-brand-default hover:bg-brand-hover text-text-inverted text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-default focus:ring-offset-2"
          >
            Begin your health intake
          </Link>

          <Link
            href="/dashboard"
            className="block w-full text-center mt-3 px-5 py-3 rounded-lg border border-border-default text-text-secondary hover:bg-surface-muted text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-default focus:ring-offset-2"
          >
            Not now &mdash; take me to my dashboard
          </Link>

          <p className="text-xs text-text-muted mt-6 leading-relaxed">
            You can start, pause and come back to your intake at any time. Nothing is shared with a
            practitioner until you ask for it.
          </p>
        </div>
      </div>
    </div>
  )
}
