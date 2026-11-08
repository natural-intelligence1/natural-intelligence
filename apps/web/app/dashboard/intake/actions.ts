'use server'

import {
  createServerSupabaseClient, createAdminClient,
  recordConsent, hasAllConsents, isProcessingBlocked,
  REQUIRED_INTAKE_CONSENTS, OPTIONAL_INTAKE_CONSENTS, CONSENT_PURPOSES,
  type ConsentPurpose,
} from '@natural-intelligence/db'
import { routeIntakeAssignment }      from '@natural-intelligence/db/practitioners'
import { assertIntakeCollectionEnabled } from '@natural-intelligence/db/intake'
import { linkIntakeCompletionToCase } from '@natural-intelligence/db/crt'
import { generateHealthSynopsis }    from '../synopsis/actions'
import { generateBodyStory }         from '../story/actions'

// ─── Sprint 3 — consent-at-start enforcement ─────────────────────────────────
// Fail-closed: intake writes are refused unless the required granular consents
// exist. Runs AFTER the collection kill-switch (both must pass).
async function assertIntakeConsents(
  supabase: ReturnType<typeof createServerSupabaseClient>, memberId: string,
): Promise<void> {
  const ok = await hasAllConsents(supabase, memberId, REQUIRED_INTAKE_CONSENTS)
  if (!ok) throw new Error('Required intake consents are not in place. Please complete the consent step first.')
}

// ─── grantIntakeConsents ──────────────────────────────────────────────────────
// Records the member's intake-start consent choices (required + optional),
// each with the exact text shown and its version. Refuses unless every
// REQUIRED consent is granted.
export async function grantIntakeConsents(choices: Record<string, boolean>): Promise<void> {
  assertIntakeCollectionEnabled()
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  for (const p of REQUIRED_INTAKE_CONSENTS) {
    if (!choices[p]) throw new Error('All required consents must be granted to begin the intake.')
  }
  const offered: ConsentPurpose[] = [...REQUIRED_INTAKE_CONSENTS, ...OPTIONAL_INTAKE_CONSENTS]
  for (const purpose of offered) {
    if (!(CONSENT_PURPOSES as readonly string[]).includes(purpose)) continue
    await recordConsent(supabase, {
      memberId: user.id,
      email:    user.email ?? '',
      purpose,
      consented: !!choices[purpose],
      source:   'intake_start',
      actor:    'member',
    })
  }
}

// ─── saveIntakeSection ────────────────────────────────────────────────────────
// Upsert a partial section's data into intake_responses.
// Uses select-first pattern (no unique constraint on member_id).
// Guarded by the collection kill-switch: throws BEFORE any client/DB access
// when INTAKE_COLLECTION_ENABLED !== "true", so nothing is written.
export async function saveIntakeSection(
  sectionData: Record<string, unknown>,
  sectionNumber: number
): Promise<void> {
  assertIntakeCollectionEnabled()
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')
  await assertIntakeConsents(supabase, user.id)   // Sprint 3: no consent, no save

  const { data: existing } = await supabase
    .from('intake_responses')
    .select('id, completed_sections')
    .eq('member_id', user.id)
    .maybeSingle()

  const completedSections = Math.max(existing?.completed_sections ?? 0, sectionNumber)

  if (existing) {
    await supabase
      .from('intake_responses')
      .update({
        ...sectionData,
        completed_sections: completedSections,
        updated_at: new Date().toISOString(),
      })
      .eq('member_id', user.id)
  } else {
    await supabase
      .from('intake_responses')
      .insert({
        member_id: user.id,
        ...sectionData,
        completed_sections: completedSections,
      })
  }
}

// ─── completeIntake ───────────────────────────────────────────────────────────
// Mark the intake as complete, record consent, and fire off synopsis generation
// (non-blocking — same fire-and-forget pattern as BioHub's parseLabReport).
export async function completeIntake(consentData: {
  consent_to_ai_analysis: boolean
  consent_given_at: string
}): Promise<void> {
  // Collection kill-switch — refuses completion before any DB access, so no
  // intake_responses write and no AI synopsis / body-story generation runs
  // while disabled. (Assignment routing stays separately gated downstream by
  // INTAKE_ASSIGNMENT_ENABLED.)
  assertIntakeCollectionEnabled()
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')
  await assertIntakeConsents(supabase, user.id)   // Sprint 3: no consent, no completion

  // Sprint 3 — restriction enforcement (purpose-aware, review amendment 1):
  // AI processing is blocked when the member has a GLOBAL restriction
  // (restriction / erasure / blanket withdrawal) OR has specifically withdrawn
  // ai_assisted_processing consent.
  //
  // This check is NO LONGER the only one. As of Mission 20 each generator
  // performs it itself, because the two page-level regenerate controls call
  // the generators directly and so bypassed everything in this function. The
  // check is kept here as well because it additionally suppresses the
  // assignment bridge below, which the generators know nothing about.
  //
  // (The former note here claimed the check returns false "pre-migration" and
  // that this was acceptable because both intake kill-switches were
  // default-off. Both clauses are obsolete: client_rights_requests exists
  // (0051 is applied), and the 13 September ruling opened collection.)
  // ─── MANDATORY: completion AND case identity, in ONE transaction ──────────
  //
  // This single call persists the completion, creates or resumes the canonical
  // case, links the response to it and marks the session completed. It is the
  // only write on this path that is not fire-and-forget, and it deliberately
  // runs before everything optional below.
  //
  // Case identity used to be a side effect of generateBodyStory(). When the
  // AI hold switched that generator off, case creation went with it —
  // silently, because the caller's .catch() swallowed the result. Completed
  // Intakes then produced no case at all, which is how one real member
  // finished an Intake in September and still has none.
  //
  // The completion write used to live above this, as a separate request. That
  // was the remaining hole: a failure here would have left is_complete = true
  // with case_id NULL, already committed. It is now inside the same database
  // transaction (migration 0068), so either the whole completion lands or none
  // of it does.
  //
  // It also runs BEFORE the restriction check below. A member who has
  // withdrawn AI-processing consent has still completed an Intake and still
  // needs a case; a restriction must suppress interpretation, not identity.
  //
  // No try/catch. If identity cannot be established the error reaches the
  // caller and completion reports failure, because telling someone their
  // Intake is complete when nothing can be traced to it is a lie with
  // clinical consequences.
  const spine = await linkIntakeCompletionToCase(createAdminClient(), user.id, {
    consentToAi: consentData.consent_to_ai_analysis,
    consentGivenAt: consentData.consent_given_at,
  })
  console.log(JSON.stringify({
    event: 'intake.case.resolved',
    member_id: user.id,
    case_id: spine.caseId,
    outcome: spine.outcome,
    case_status: spine.caseStatus,
    already_linked: spine.alreadyLinked,
  }))

  const restricted = await isProcessingBlocked(createAdminClient(), user.id, 'ai_assisted_processing')
  if (restricted) {
    console.log(JSON.stringify({ event: 'intake.processing.blocked_by_restriction', member_id: user.id }))
    return
  }

  // ─── OPTIONAL from here down ───────────────────────────────────────────────
  // Every call below may fail, be held or be disabled. None of them can
  // invalidate the completion or the case identity established above.

  // Fire-and-forget: synopsis page shows generating state with meta refresh
  generateHealthSynopsis(user.id).catch((err) => {
    console.error('[completeIntake] synopsis generation failed:', err)
  })

  // Fire-and-forget: CRT body story generation (Sprint 17/18)
  generateBodyStory(user.id).catch((err) => {
    console.error('[completeIntake] body story generation failed:', err)
  })

  // Sprint 2 — assignment bridge: route the completed case to the client's linked
  // practitioner so it surfaces in the practitioner inbox. Fire-and-forget: a missing
  // link or failure never blocks intake completion.
  routeCompletedCaseToPractitioner(user.id).catch((err) => {
    console.error('[completeIntake] assignment bridge failed:', err)
  })
}

// ─── routeCompletedCaseToPractitioner ─────────────────────────────────────────
// Sprint 2 minimum assignment bridge (server-side, admin client), gated by the
// INTAKE_ASSIGNMENT_ENABLED kill-switch. Routing logic (flag → link resolution →
// assignment) lives in routeIntakeAssignment (db layer, unit-tested); this wrapper
// just invokes it and logs the outcome. DISABLED BY DEFAULT: no assignment is
// created unless INTAKE_ASSIGNMENT_ENABLED === "true".
async function routeCompletedCaseToPractitioner(memberId: string): Promise<void> {
  const admin = createAdminClient()
  const res = await routeIntakeAssignment(admin, memberId)

  if (res.status === 'disabled') {
    console.log(JSON.stringify({ event: 'intake.assignment.disabled', member_id: memberId }))
    return
  }
  if (res.status === 'blocked_by_consent') {
    console.log(JSON.stringify({ event: 'intake.assignment.blocked_by_consent', member_id: memberId, reason: res.reason }))
    return
  }
  if (res.status === 'no_linked_practitioner') {
    console.log(JSON.stringify({ event: 'intake.assignment.no_linked_practitioner', member_id: memberId }))
    return
  }
  console.log(JSON.stringify({
    event: 'intake.assignment.created', member_id: memberId,
    case_id: res.caseId, work_id: res.workId, already_assigned: res.alreadyAssigned,
  }))
}
