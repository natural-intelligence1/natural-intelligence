// ─── packages/db/src/practitioners/agreementVersions.ts ──────────────────────
// Publishing, listing and notifying for the IMMUTABLE practitioner agreement
// versions introduced in 0051 and gated by 0056.
//
// What already exists in the database and is NOT re-implemented here:
//   • practitioner_agreements rows are immutable — a trigger refuses any edit
//     to category/version/title/body/created_at; only is_current may change.
//   • accept_current_agreement() resolves the caller's class server-side,
//     rejects a stale displayed version, and records version + sha256 hash.
//   • has_accepted_current_agreement() / practitioner_has_current_acceptance()
//     verify acceptance against the current row's id AND version AND a live
//     sha256 of its exact text, so a superseded or edited agreement fails
//     closed automatically.
//
// This module adds only what the agreement UX needs on top: publish a new
// version, read the full published history (for the permanent public pages),
// and notify affected practitioners that new terms are available.

import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { PRACTITIONER_CATEGORIES } from './agreements'
import type { PractitionerCategory } from './agreements'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any>

/** Client-facing names for the three practitioner classes (KR-confirmed). */
export const AGREEMENT_CLASS_LABELS: Record<PractitionerCategory, string> = {
  regulated_clinician:  'Regulated Healthcare Professional',
  voluntary_registered: 'Accredited Practitioner',
  unregistered:         'NI Verified Practitioner',
}

/** URL-safe slug per class, used for the permanent public agreement URLs. */
export const AGREEMENT_CLASS_SLUGS: Record<PractitionerCategory, string> = {
  regulated_clinician:  'regulated-healthcare-professional',
  voluntary_registered: 'accredited-practitioner',
  unregistered:         'ni-verified-practitioner',
}

export function categoryFromSlug(slug: string): PractitionerCategory | null {
  const hit = PRACTITIONER_CATEGORIES.find((c) => AGREEMENT_CLASS_SLUGS[c] === slug)
  return hit ?? null
}

/**
 * The canonical agreement hash. MUST stay byte-identical to the SQL the gate
 * uses — encode(digest(body, 'sha256'), 'hex') — because an acceptance is only
 * valid while the stored hash still matches the live body.
 */
export function computeAgreementHash(body: string): string {
  return createHash('sha256').update(body, 'utf8').digest('hex')
}

export interface AgreementVersionRow {
  id: string
  category: PractitionerCategory
  version: string
  title: string
  body: string
  is_current: boolean
  created_at: string
}

/** Every published version, current and superseded, newest first per class. */
export async function listAgreementVersions(
  client: AnyClient, category?: PractitionerCategory,
): Promise<AgreementVersionRow[]> {
  let query = (client as AnyClient)
    .from('practitioner_agreements')
    .select('id, category, version, title, body, is_current, created_at')
    .order('category', { ascending: true })
    .order('created_at', { ascending: false })
  if (category) query = query.eq('category', category)
  const { data, error } = await query
  if (error) return [] // fail closed: an empty history rather than a broken page
  return (data ?? []) as AgreementVersionRow[]
}

export async function getAgreementVersion(
  client: AnyClient, category: PractitionerCategory, version: string,
): Promise<AgreementVersionRow | null> {
  const { data, error } = await (client as AnyClient)
    .from('practitioner_agreements')
    .select('id, category, version, title, body, is_current, created_at')
    .eq('category', category)
    .eq('version', version)
    .maybeSingle()
  if (error || !data) return null
  return data as AgreementVersionRow
}

// ─── Class 3 sole-Lead restriction check ─────────────────────────────────────

/**
 * NI's approved legal architecture: an NI Verified Practitioner (Class 3,
 * `unregistered`) may not act as the SOLE Lead Responsible Practitioner. The
 * database enforces this (0057 trigger), but the practitioner must also be
 * able to understand it from the contract they sign.
 *
 * This is a presence check over the filed wording, not a drafting tool: it
 * reports whether the restriction appears to be stated, so publishing a Class 3
 * agreement that is silent on it can be surfaced for founder/legal attention.
 * It never edits, supplies or infers contractual text.
 */
export function statesClass3LeadRestriction(body: string): boolean {
  const text = body.toLowerCase().replace(/\s+/g, ' ')
  const mentionsLead = text.includes('lead responsible practitioner')
  if (!mentionsLead) return false
  // A restriction, not merely a mention of the role.
  return /(not|never|cannot|may not|must not|unable to|ineligible)[^.]{0,120}(sole )?lead responsible practitioner/.test(text)
    || /(sole )?lead responsible practitioner[^.]{0,120}(only|must be|reserved for)[^.]{0,120}(regulated|accredited|registered)/.test(text)
}

// ─── Publishing ──────────────────────────────────────────────────────────────

export interface PublishAgreementInput {
  category: PractitionerCategory
  version: string
  title: string
  body: string
}

export interface PublishAgreementResult {
  id: string
  category: PractitionerCategory
  version: string
  hash: string
  /** Only meaningful for `unregistered`; see statesClass3LeadRestriction. */
  class3RestrictionStated: boolean
  supersededVersion: string | null
}

/**
 * Publish a NEW immutable version and make it current. Never edits an existing
 * version: a repeat of an existing (category, version) is refused outright,
 * and the previous current row is demoted, not rewritten. Every practitioner
 * in that class then fails the gate's id+version+hash check until they accept.
 */
export async function publishAgreementVersion(
  adminClient: AnyClient, input: PublishAgreementInput,
): Promise<PublishAgreementResult> {
  const existing = await getAgreementVersion(adminClient, input.category, input.version)
  if (existing) {
    throw new Error(
      `Agreement ${input.category} ${input.version} already exists and is immutable — ` +
      'publish changed wording under a NEW version string'
    )
  }

  const previous = await (adminClient as AnyClient)
    .from('practitioner_agreements')
    .select('id, version')
    .eq('category', input.category)
    .eq('is_current', true)
    .maybeSingle()
  const supersededVersion = (previous.data as { version: string } | null)?.version ?? null

  // Demote first: a partial unique index allows only one current row per class.
  if (previous.data) {
    const { error: demoteErr } = await (adminClient as AnyClient)
      .from('practitioner_agreements')
      .update({ is_current: false })
      .eq('id', (previous.data as { id: string }).id)
    if (demoteErr) throw new Error(`Could not supersede the previous version: ${demoteErr.message}`)
  }

  const { data, error } = await (adminClient as AnyClient)
    .from('practitioner_agreements')
    .insert({
      category:   input.category,
      version:    input.version,
      title:      input.title,
      body:       input.body,
      is_current: true,
    })
    .select('id')
    .single()
  if (error) throw new Error(`publishAgreementVersion failed [${error.code}]: ${error.message}`)

  return {
    id: (data as { id: string }).id,
    category: input.category,
    version: input.version,
    hash: computeAgreementHash(input.body),
    class3RestrictionStated:
      input.category === 'unregistered' ? statesClass3LeadRestriction(input.body) : true,
    supersededVersion,
  }
}

// ─── Notification of affected practitioners ──────────────────────────────────

export interface AffectedPractitioner {
  id: string
  email: string
  displayName: string | null
}

/**
 * Practitioners in the class whose terms just changed. Archived accounts are
 * excluded — they have no platform access to regain.
 */
export async function listPractitionersForCategory(
  adminClient: AnyClient, category: PractitionerCategory,
): Promise<AffectedPractitioner[]> {
  const { data, error } = await (adminClient as AnyClient)
    .from('practitioners')
    .select('id, display_name, status, category')
    .eq('category', category)
    .neq('status', 'archived')
  if (error) throw new Error(`listPractitionersForCategory failed: ${error.message}`)

  const rows = (data ?? []) as { id: string; display_name: string | null }[]
  const out: AffectedPractitioner[] = []
  for (const row of rows) {
    // Email lives in auth.users, not practitioners — resolve per practitioner.
    const { data: userData } = await (adminClient as AnyClient).auth.admin.getUserById(row.id)
    const email = userData?.user?.email
    if (email) out.push({ id: row.id, email, displayName: row.display_name })
  }
  return out
}
