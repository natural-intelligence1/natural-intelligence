import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { createServerSupabaseClient } from '@natural-intelligence/db'
import { isIntakeCollectionEnabled, isIntakeAllowedForUser } from '@natural-intelligence/db/intake'
import { copy } from '@/lib/copy'
import { IntakeForm } from './IntakeForm'

export const metadata: Metadata = {
  title: 'Health intake',
  description: 'Complete your health intake to receive a personalised health synopsis.',
}

// Containment patch: shown instead of the live form while intake collection is
// disabled (INTAKE_COLLECTION_ENABLED !== "true"). No health-data fields render,
// which also removes the client-side intake_answers write path.
function IntakeUnavailable() {
  return (
    <div className="py-16 px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto">
      <div className="rounded-xl border border-border-default bg-surface-raised p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-text-primary mb-3">
          {copy.intakeUnavailable.heading}
        </h1>
        <p className="text-sm text-text-secondary leading-relaxed mb-6">
          {copy.intakeUnavailable.body}
        </p>
        <div className="flex flex-wrap gap-3 mb-8">
          <Link
            href="/support"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-brand-default text-text-inverted text-sm font-medium hover:bg-brand-hover transition-colors"
          >
            {copy.intakeUnavailable.supportCta}
          </Link>
          <Link
            href="/legal/privacy"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg border border-border-default bg-surface-base text-text-primary text-sm font-medium hover:bg-surface-muted transition-colors"
          >
            {copy.intakeUnavailable.privacyLink}
          </Link>
        </div>
        <div role="note" className="rounded-lg border border-status-warningBorder bg-status-warningBg px-4 py-3">
          <p className="text-sm text-status-warningText leading-relaxed">{copy.brand.safetyNotice}</p>
        </div>
      </div>
    </div>
  )
}

export default async function IntakePage() {
  // Availability rule: the global collection kill-switch (default OFF) OR the
  // single-account founder-preview allowlist. When globally disabled, the
  // allowlist requires an authenticated session whose email is EXACTLY
  // allowlisted; everyone else gets the unavailable state and no health-data
  // fields render (which also removes the client-side intake_answers write
  // path — the form is the only thing that issues those writes). Server
  // actions enforce the same rule independently.
  if (!isIntakeCollectionEnabled()) {
    const gate = createServerSupabaseClient()
    const { data: { user: gateUser } } = await gate.auth.getUser()
    if (!gateUser || !isIntakeAllowedForUser(gateUser.email)) return <IntakeUnavailable />
  }

  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: existing } = await supabase
    .from('intake_responses')
    .select('*')
    .eq('member_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Decision 4 — read biological_sex from user_personalisation (PS.1 substrate).
  // Sprint B Phase 1 — also read religion + religious_content_preference so the
  // intake can pre-fill the new Chapter 1 questions if the user already answered
  // them (e.g. resume case). Cast trick: piggy-back on 'profiles' table name to
  // bypass generated DB types not knowing about user_personalisation.
  // user_personalisation isn't in the generated DB types; reach it through a
  // loose client. Its PK is user_id (there is no id column).
  const personalisationQuery = await (supabase as any)
    .from('user_personalisation')
    .select('biological_sex, religion, religious_content_preference')
    .eq('user_id', user.id)
    .maybeSingle()
  const personalisation = personalisationQuery.data as unknown as {
    biological_sex:                'male' | 'female' | null
    religion:                      string | null
    religious_content_preference:  'show' | 'hide' | null
  } | null
  const biologicalSex             = personalisation?.biological_sex ?? null
  const religion                  = (personalisation?.religion ?? 'prefer_not_to_say') as
    'muslim' | 'christian' | 'jewish' | 'hindu' | 'buddhist' | 'sikh' | 'secular' | 'prefer_not_to_say' | 'other'
  const religiousContentPreference = (personalisation?.religious_content_preference ?? 'hide') as 'show' | 'hide'

  return (
    <IntakeForm
      existing={existing as Record<string, unknown> | null}
      memberId={user.id}
      initialBiologicalSex={biologicalSex}
      initialReligion={religion}
      initialReligiousContentPreference={religiousContentPreference}
    />
  )
}
