import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@natural-intelligence/db'
import { hasAllConsents, REQUIRED_INTAKE_CONSENTS } from '@natural-intelligence/db/consent'
import { isIntakeCollectionEnabled } from '@natural-intelligence/db/intake'
import { isIntakeV2Enabled, getOrCreateV2Session, loadV2Answers } from '@natural-intelligence/db/intakeV2'
import { IntakeConsentGate } from '../intake/IntakeConsentGate'
import { IntakeV2Flow } from './IntakeV2Flow'

// ─── NI Pre-Consultation Health Intake (V2) — flagged internal route ─────────
// Behind INTAKE_V2_ENABLED (default OFF, exact 'true'): until the flag is set,
// this route 404s and nothing here is reachable. The EXISTING intake route is
// untouched. Guard order mirrors the V1 route: collection kill-switch →
// V2 flag → auth → Sprint 3 consent-at-start gate (the same IntakeConsentGate,
// reused, not recreated) → the guided flow.
// V2 is a PRE-CONSULTATION intake: it gathers the client's factual health
// story and organises it for their practitioner. It interprets nothing.

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Your health story',
  robots: { index: false, follow: false },
}

export default async function IntakeV2Page() {
  if (!isIntakeV2Enabled()) return notFound()
  if (!isIntakeCollectionEnabled()) return notFound()

  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Sprint 3 consent-at-start — reused unchanged. No health data saves
  // before the required choices for the selected NI service are complete.
  const consented = await hasAllConsents(supabase, user.id, REQUIRED_INTAKE_CONSENTS)
  if (!consented) return <IntakeConsentGate />

  const session = await getOrCreateV2Session(supabase, user.id)
  const answers = await loadV2Answers(supabase, session.id)

  return <IntakeV2Flow initialAnswers={answers} submitted={session.status === 'completed'} />
}
