'use server'

// ─── NI Pre-Consultation Health Intake (V2) — server actions ─────────────────
// Guard order on EVERY action, fail-closed, before any health-data write:
//   1. INTAKE_COLLECTION_ENABLED (global collection kill-switch)
//   2. INTAKE_V2_ENABLED         (V2 route flag, default OFF)
//   3. authenticated user
//   4. required Sprint 3 consents (hasAllConsents — errors count as NO)
// Submission triggers NOTHING downstream: no AI pipelines, no assignment,
// no client_cases, no case_practitioner_work, no practitioner visibility.

import { createServerSupabaseClient } from '@natural-intelligence/db'
import { hasAllConsents, REQUIRED_INTAKE_CONSENTS } from '@natural-intelligence/db/consent'
import { assertIntakeCollectionEnabled } from '@natural-intelligence/db/intake'
import {
  isIntakeV2Enabled, saveV2Answer, loadV2Answers, missingRequired,
  getOrCreateV2Session, completeV2Session,
} from '@natural-intelligence/db/intakeV2'

async function guardedContext() {
  assertIntakeCollectionEnabled()
  if (!isIntakeV2Enabled()) {
    throw new Error('The new intake experience is not enabled.')
  }
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')
  const consented = await hasAllConsents(supabase, user.id, REQUIRED_INTAKE_CONSENTS)
  if (!consented) {
    throw new Error('The required choices for your selected NI service must be completed before the intake can save.')
  }
  return { supabase, user }
}

/** Save one screen's answers (called on every step — save-and-resume). */
export async function saveV2Screen(answers: Record<string, unknown>): Promise<void> {
  const { supabase, user } = await guardedContext()
  const session = await getOrCreateV2Session(supabase, user.id)
  for (const [questionId, value] of Object.entries(answers)) {
    await saveV2Answer(supabase, { sessionId: session.id, memberId: user.id, questionId, value })
  }
}

/** Submit the intake. Factual completeness check only — no interpretation. */
export async function submitV2(): Promise<{ ok: boolean; missing: string[] }> {
  const { supabase, user } = await guardedContext()
  const session = await getOrCreateV2Session(supabase, user.id)
  const answers = await loadV2Answers(supabase, session.id)
  const missing = missingRequired(answers)
  if (missing.length > 0) {
    return { ok: false, missing: missing.map((question) => question.label) }
  }
  await completeV2Session(supabase, session.id)
  return { ok: true, missing: [] }
}
