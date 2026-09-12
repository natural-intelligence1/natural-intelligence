// ─── packages/db/src/practitioners/reviewPackAccess.ts ────────────────────────
// Sprint 3 — review-pack workspace access + controlled generation.
//
// PRACTITIONER_REVIEW_PACKS_ENABLED (default OFF, exact "true" — same
// semantics as the intake kill-switches) switches the care workspace from raw
// identified intake data to de-identified review packs. When OFF, nothing
// changes. When ON, the workspace reads packs ONLY and never silently falls
// back to raw identified data.
//
// Generation is ADMIN/SERVER-side only (service-role client): it reads the
// identified source once, builds the default-deny pack, stores the pack on
// the practitioner-readable table and the source linkage/audit on the
// admin-only review_pack_audit table. Tables arrive with migration 0051.

import type { SupabaseClient } from '@supabase/supabase-js'
import { buildReviewPack } from './reviewPack'
import { getIntakeSummary } from './getIntakeSummary'
import { hasActiveConsent } from '../consent/records'
import { isProcessingBlocked } from '../rights/requests'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any>

/** Kill-switch: the review-pack workspace mode is off unless explicitly enabled. */
export function isReviewPacksEnabled(): boolean {
  return process.env.PRACTITIONER_REVIEW_PACKS_ENABLED === 'true'
}

/** The ONLY columns a practitioner-facing surface may read. */
export interface ReviewPackRow {
  id: string
  case_id: string
  pseudonym: string
  pack: {
    clinical?: Record<string, unknown>
    transformedFields?: string[]
    note?: string
  }
  pack_version: number
  generated_at: string
}

const SAFE_PACK_COLUMNS = 'id, case_id, pseudonym, pack, pack_version, generated_at'

/**
 * Latest review pack for a case, SAFE COLUMNS ONLY (audit/source fields live
 * on a separate admin-only table and are never selected here). RLS restricts
 * practitioners to packs on cases where they hold an ACTIVE work item.
 * Returns null when none exists or pre-migration — callers must show a
 * blocked/empty state, never fall back to raw data.
 */
export async function getReviewPackForCase(client: AnyClient, caseId: string): Promise<ReviewPackRow | null> {
  const { data, error } = await (client as AnyClient)
    .from('practitioner_review_packs')
    .select(SAFE_PACK_COLUMNS)
    .eq('case_id', caseId)
    .order('pack_version', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  return data as ReviewPackRow
}

/**
 * FAIL-CLOSED consent gate for anything that shares a de-identified synopsis
 * with a practitioner (pack generation AND assignment routing). Throws with a
 * clear, admin-readable reason unless the member has an ACTIVE
 * deidentified_synopsis_sharing consent AND no global restriction / erasure /
 * blanket withdrawal / purpose-specific withdrawal on file. hasActiveConsent
 * is itself fail-closed (error or absence = no consent), so pre-migration or
 * degraded states block rather than pass.
 */
export async function assertSynopsisSharingPermitted(
  admin: AnyClient, memberId: string,
): Promise<void> {
  const consented = await hasActiveConsent(admin, memberId, 'deidentified_synopsis_sharing')
  if (!consented) {
    throw new Error(
      'Blocked: this member has no active consent for de-identified synopsis sharing. '
      + 'A review pack cannot be generated or routed without it.',
    )
  }
  const blocked = await isProcessingBlocked(admin, memberId, 'deidentified_synopsis_sharing')
  if (blocked) {
    throw new Error(
      'Blocked: this member has a restriction, erasure request or consent withdrawal '
      + 'on file covering de-identified synopsis sharing.',
    )
  }
}

export interface GenerateReviewPackResult {
  packId: string
  pseudonym: string
  packVersion: number
  suppressedCount: number
}

/**
 * ADMIN-ONLY generation: reads the identified source with the service-role
 * client, builds the default-deny pack, stores pack + audit. Regeneration
 * creates a NEW version (packs are never edited in place). Never expose this
 * to public users; never call it with a user-scoped client.
 */
export async function generateAndStoreReviewPack(
  admin: AnyClient, caseId: string, generatedBy: string,
): Promise<GenerateReviewPackResult> {
  // 1. Case → member (+ the case's own free-text concern, which 0052 removes
  //    from direct practitioner reach — the pack carries it, token-normalised).
  const { data: caseRow, error: caseErr } = await (admin as AnyClient)
    .from('client_cases')
    .select('id, client_id, primary_concern')
    .eq('id', caseId)
    .maybeSingle()
  if (caseErr || !caseRow) throw new Error(`generateReviewPack: case not found [${caseErr?.message ?? caseId}]`)

  // 1b. Consent gate — FAIL CLOSED before any identified data is read.
  await assertSynopsisSharingPermitted(admin, caseRow.client_id)

  // 2. Identified intake summary (service-role read; the last identified hop).
  const summary = await getIntakeSummary(admin as Parameters<typeof getIntakeSummary>[0], caseRow.client_id)
  if (!summary) throw new Error('generateReviewPack: no completed intake summary for this case’s member')

  const { data: intakeRow } = await (admin as AnyClient)
    .from('intake_responses')
    .select('id')
    .eq('member_id', caseRow.client_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // 3. Default-deny de-identification. The case primary_concern joins the
  //    token-normalised concerns list rather than passing as free text.
  const source: Record<string, unknown> = { ...(summary as unknown as Record<string, unknown>) }
  if (caseRow.primary_concern) {
    const existing = Array.isArray(source.primaryConcerns) ? (source.primaryConcerns as unknown[]) : []
    source.primaryConcerns = [...existing, caseRow.primary_concern]
  }
  const pack = buildReviewPack(caseId, source)

  // 4. Version = max + 1 (regeneration never overwrites).
  const { data: latest } = await (admin as AnyClient)
    .from('practitioner_review_packs')
    .select('pack_version')
    .eq('case_id', caseId)
    .order('pack_version', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextVersion = (latest?.pack_version ?? 0) + 1

  // 5. Store pack (practitioner-readable, safe fields only)…
  const { data: inserted, error: insErr } = await (admin as AnyClient)
    .from('practitioner_review_packs')
    .insert({
      case_id: caseId,
      pseudonym: pack.pseudonym,
      pack: { clinical: pack.clinical, transformedFields: pack.transformedFields, note: pack.note },
      pack_version: nextVersion,
    })
    .select('id')
    .single()
  if (insErr || !inserted) throw new Error(`generateReviewPack: pack insert failed [${insErr?.message}]`)

  // 6. …and the internal audit/source linkage (admin-only table).
  const { error: auditErr } = await (admin as AnyClient)
    .from('review_pack_audit')
    .insert({
      pack_id: inserted.id,
      source_intake_id: intakeRow?.id ?? null,
      suppressed_fields: pack.suppressedFields,
      transformed_fields: pack.transformedFields,
      generated_by: generatedBy,
    })
  if (auditErr) throw new Error(`generateReviewPack: audit insert failed [${auditErr.message}]`)

  return {
    packId: inserted.id,
    pseudonym: pack.pseudonym,
    packVersion: nextVersion,
    suppressedCount: pack.suppressedFields.length,
  }
}
