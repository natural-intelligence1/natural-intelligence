// ─── packages/db/src/crt/founderReview.ts ────────────────────────────────────
// Read the canonical case for Founder Review Mode. READ ONLY.
//
// WHAT THIS IS
//
// Stage 2 of the one-case walkthrough. The Founder sees the real synthetic
// walkthrough case the way a practitioner eventually will, without being
// granted any clinical authority.
//
// It composes two things and adds nothing of its own:
//
//   · the case spine — client_cases, profiles, case_taking_sessions,
//     case_taking_answers
//   · the Intake — delegated WHOLLY to getCanonicalIntake()
//
// It used to resolve the Intake itself, including a bespoke "the column is
// empty but intake_answers has a value" fallback. That logic is gone. There
// is one answer truth and it lives in packages/db/src/intake, so Founder
// Review and the Stage 3 Cockpit cannot drift apart by each being clever
// separately.
//
// There is no second source. No review_case, no preview_case, no snapshot
// JSON, no fixture. One case identity: client_cases.id.
//
// WHAT THIS IS NOT
//
// It writes nothing. It is not a privilege grant, it does not touch
// practitioner assignment, case_team_roles or sign-off, and it never makes
// the Founder a practitioner. Every mutation verb is absent by construction
// and a structural test asserts that this file contains none.
//
// THE TEST-DATA GUARD
//
// This is not an unrestricted admin health-data browser. The client's profile
// must carry is_test_data = true or the surface is refused — and the guard
// runs BEFORE any clinical table is touched, so a refusal reads no health data
// at all. That ordering is asserted by test, not merely by reading order.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types'
import { getCanonicalIntake, type CanonicalIntake } from '../intake/getCanonicalIntake'

type AdminClient = SupabaseClient<Database>

/** Every canonical table this surface may read, directly or via the
 *  canonical Intake projection. Nothing else. */
export const FOUNDER_REVIEW_TABLES = [
  'client_cases',
  'profiles',
  'intake_responses',
  'intake_sessions',
  'intake_answers',
  'case_taking_sessions',
  'case_taking_answers',
] as const

/** Why a review surface was refused. Never a silent empty render. */
export type FounderReviewRefusal =
  | 'case_not_found'
  | 'client_profile_missing'
  | 'not_test_data'

export interface FounderReviewClient {
  id: string
  /** profiles.full_name, or null when the profile has none. Never invented. */
  displayName: string | null
  isTestData: boolean
}

export interface FounderReviewConsultation {
  id: string
  seq: number | null
  kind: string | null
  state: string
  signedOffAt: string | null
  createdAt: string | null
  answerCount: number
}

export interface FounderReviewCase {
  caseId: string
  status: string
  primaryConcern: string | null
  createdAt: string | null
  updatedAt: string | null
  client: FounderReviewClient
  /** The one answer truth. Resolved by the shared projection, not here. */
  intake: CanonicalIntake
  /** Empty until Stage 3 writes case-taking. Proves nothing is fabricated. */
  consultations: FounderReviewConsultation[]
}

export type FounderReviewResult =
  | { ok: true; data: FounderReviewCase }
  | { ok: false; refusal: FounderReviewRefusal }

export interface FounderReviewListRow {
  caseId: string
  status: string
  createdAt: string | null
  clientId: string
  clientName: string | null
}

/**
 * List the cases eligible for Founder Review: test clients only.
 *
 * The test-data filter is applied to profiles FIRST and the case query is then
 * restricted to those ids, so a real member cannot appear in the list even if
 * a later edit loosened the case query. An empty profile set returns an empty
 * list without querying cases at all.
 */
export async function listFounderReviewCases(
  supabase: AdminClient,
): Promise<FounderReviewListRow[]> {
  const { data: testProfiles, error: profileErr } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('is_test_data', true)

  if (profileErr) throw profileErr

  const nameById = new Map<string, string | null>()
  for (const p of testProfiles ?? []) nameById.set(p.id, p.full_name ?? null)
  if (nameById.size === 0) return []

  const { data: cases, error: caseErr } = await supabase
    .from('client_cases')
    .select('id, client_id, status, created_at')
    .in('client_id', [...nameById.keys()])
    .order('created_at', { ascending: false })

  if (caseErr) throw caseErr

  return (cases ?? []).map((c) => ({
    caseId: c.id,
    status: c.status,
    createdAt: c.created_at ?? null,
    clientId: c.client_id,
    clientName: nameById.get(c.client_id) ?? null,
  }))
}

/**
 * Read one canonical case for Founder Review.
 *
 * Order matters and is deliberate: case → profile → GUARD → clinical rows.
 * A non-test client is refused before a single health row is read.
 */
export async function getFounderReviewCase(
  supabase: AdminClient,
  caseId: string,
): Promise<FounderReviewResult> {
  const { data: caseRow, error: caseErr } = await supabase
    .from('client_cases')
    .select('id, client_id, status, primary_concern, created_at, updated_at')
    .eq('id', caseId)
    .maybeSingle()

  if (caseErr) throw caseErr
  if (!caseRow) return { ok: false, refusal: 'case_not_found' }

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('id, full_name, is_test_data')
    .eq('id', caseRow.client_id)
    .maybeSingle()

  if (profileErr) throw profileErr
  if (!profile) return { ok: false, refusal: 'client_profile_missing' }

  // ── THE GUARD ───────────────────────────────────────────────────────────
  // Strictly true. A null or absent flag is NOT a test client: this surface
  // shows stored health answers, so the default must be refusal.
  if (profile.is_test_data !== true) return { ok: false, refusal: 'not_test_data' }

  const [intake, consultationsRes] = await Promise.all([
    getCanonicalIntake(supabase, caseRow.client_id),
    supabase
      .from('case_taking_sessions')
      .select('id, consultation_seq, consultation_kind, state, signed_off_at, created_at')
      .eq('case_id', caseRow.id)
      .order('consultation_seq', { ascending: true }),
  ])

  if (consultationsRes.error) throw consultationsRes.error

  const consultationRows = consultationsRes.data ?? []

  // Per-consultation answer counts. Only queried when a consultation exists,
  // so the Stage 3 empty state costs no query and invents no zero.
  const answerCounts = new Map<string, number>()
  if (consultationRows.length > 0) {
    const { data: ctAnswers, error: ctErr } = await supabase
      .from('case_taking_answers')
      .select('session_id')
      .in(
        'session_id',
        consultationRows.map((c) => c.id),
      )
    if (ctErr) throw ctErr
    for (const a of ctAnswers ?? []) {
      answerCounts.set(a.session_id, (answerCounts.get(a.session_id) ?? 0) + 1)
    }
  }

  return {
    ok: true,
    data: {
      caseId: caseRow.id,
      status: caseRow.status,
      primaryConcern: caseRow.primary_concern ?? null,
      createdAt: caseRow.created_at ?? null,
      updatedAt: caseRow.updated_at ?? null,
      client: {
        id: profile.id,
        displayName: profile.full_name ?? null,
        isTestData: true,
      },
      intake,
      consultations: consultationRows.map((c) => ({
        id: c.id,
        seq: c.consultation_seq ?? null,
        kind: c.consultation_kind ?? null,
        state: c.state,
        signedOffAt: c.signed_off_at ?? null,
        createdAt: c.created_at ?? null,
        answerCount: answerCounts.get(c.id) ?? 0,
      })),
    },
  }
}
