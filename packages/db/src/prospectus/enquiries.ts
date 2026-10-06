// ─── packages/db/src/prospectus/enquiries.ts ─────────────────────────────────
// Recording and fulfilling corporate prospectus requests.
//
// Flow: validate → route → record the enquiry → sign the routed document(s)
// from the private `prospectus` bucket → send the covering email to the
// requester and a notification to NI → stamp sent_at (or send_error).
//
// The four PDFs live at FIXED storage keys, so NI replaces a document by
// uploading over its key — no rebuild, no redeploy, no code change.
//
// BUSINESS CONTACT DATA ONLY. Nothing in this module reads or writes client
// health data, and the enquiry table has no link to the health data model.

import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail, prospectusDeliveryEmail, prospectusEnquiryNotificationEmail } from '../email'
import {
  routeProspectus, validateProspectusEnquiry, PROSPECTUS_DOCUMENT_DEFS,
  ORGANISATION_TYPE_LABELS, AUDIENCE_LABELS, SIZE_BAND_LABELS, INTEREST_LABELS, TIMING_LABELS,
} from './routing'
import type {
  ProspectusEnquiryInput, ProspectusDocumentId, RoutingResult,
} from './routing'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any>

const BUCKET = 'prospectus'
/** Delivery links are personal to one request and deliberately short-lived. */
const SIGNED_URL_TTL_SECONDS = 14 * 24 * 60 * 60 // 14 days

/**
 * Kill-switch for the public request flow (default OFF, exact 'true' to
 * enable — same semantics as every other NI flag). Stays OFF until the four
 * final PDFs are in place; the machinery ships dark.
 */
export function isProspectusRequestEnabled(): boolean {
  return process.env.PROSPECTUS_REQUEST_ENABLED === 'true'
}

export interface CreateEnquiryResult {
  id: string
  routing: RoutingResult
}

/** Validate + route + record. Throws on validation failure (caller surfaces). */
export async function createProspectusEnquiry(
  adminClient: AnyClient, input: ProspectusEnquiryInput,
): Promise<CreateEnquiryResult> {
  const errors = validateProspectusEnquiry(input)
  if (Object.keys(errors).length > 0) {
    throw new Error(`Invalid prospectus enquiry: ${Object.values(errors).join(' ')}`)
  }

  const routing = routeProspectus(input.organisationType, input.audience)

  const { data, error } = await (adminClient as AnyClient)
    .from('prospectus_enquiries')
    .insert({
      organisation_type:   input.organisationType,
      audience:            input.audience,
      size_band:           input.sizeBand,
      interests:           input.interests,
      timing:              input.timing,
      contact_name:        input.contactName.trim(),
      organisation_name:   input.organisationName.trim(),
      role:                input.role.trim(),
      email:               input.email.trim(),
      phone:               input.phone?.trim() || null,
      anything_else:       input.anythingElse?.trim() || null,
      marketing_opt_in:    input.marketingOptIn === true,
      routed_documents:    routing.documents,
      needs_manual_review: routing.needsManualReview,
    })
    .select('id')
    .single()
  if (error) throw new Error(`createProspectusEnquiry failed [${error.code}]: ${error.message}`)

  return { id: (data as { id: string }).id, routing }
}

/**
 * Signed download links for the routed documents. Returns null for a slot
 * whose document has not been uploaded yet, so the caller can refuse to send
 * a broken link rather than emailing one.
 */
export async function signProspectusDocuments(
  adminClient: AnyClient, ids: ProspectusDocumentId[],
): Promise<{ id: ProspectusDocumentId; title: string; url: string | null }[]> {
  const out: { id: ProspectusDocumentId; title: string; url: string | null }[] = []
  for (const id of ids) {
    const def = PROSPECTUS_DOCUMENT_DEFS[id]
    const { data, error } = await (adminClient as AnyClient)
      .storage.from(BUCKET).createSignedUrl(def.storageKey, SIGNED_URL_TTL_SECONDS)
    out.push({ id, title: def.title, url: error || !data?.signedUrl ? null : data.signedUrl })
  }
  return out
}

export interface DeliveryOutcome {
  delivered: boolean
  /** Populated when delivery could not complete; the enquiry is kept either way. */
  reason?: string
  documents: { id: ProspectusDocumentId; title: string }[]
}

/**
 * Send the covering email with the routed document link(s), plus the internal
 * notification. Never sends a broken link: if a document slot is empty or the
 * mailer is not configured, the enquiry is flagged for manual follow-up and
 * the reason recorded.
 */
export async function deliverProspectus(
  adminClient: AnyClient, enquiryId: string,
): Promise<DeliveryOutcome> {
  const { data: row, error } = await (adminClient as AnyClient)
    .from('prospectus_enquiries').select('*').eq('id', enquiryId).single()
  if (error || !row) throw new Error(`deliverProspectus: enquiry ${enquiryId} not found`)

  const enquiry = row as Record<string, unknown>
  const ids = (enquiry.routed_documents as ProspectusDocumentId[]) ?? []
  const routing = routeProspectus(
    enquiry.organisation_type as never, enquiry.audience as never,
  )
  const signed = await signProspectusDocuments(adminClient, ids)
  const documents = signed.map((s) => ({ id: s.id, title: s.title }))

  async function fail(reason: string): Promise<DeliveryOutcome> {
    await (adminClient as AnyClient).from('prospectus_enquiries')
      .update({ send_error: reason, needs_manual_review: true }).eq('id', enquiryId)
    return { delivered: false, reason, documents }
  }

  const missing = signed.filter((s) => !s.url).map((s) => s.title)
  if (missing.length > 0) {
    return fail(`Document not available in storage: ${missing.join('; ')}`)
  }
  if (!process.env.RESEND_API_KEY) {
    return fail('Mailer not configured (RESEND_API_KEY absent) — send manually')
  }

  const notifyTo = process.env.PROSPECTUS_NOTIFY_EMAIL
    ?? process.env.ADMIN_NOTIFY_EMAIL
    ?? 'hello@natural-intelligence.uk'

  try {
    await sendEmail(prospectusDeliveryEmail({
      to:               enquiry.email as string,
      contactName:      enquiry.contact_name as string,
      organisationName: enquiry.organisation_name as string,
      documents:        signed.map((s) => ({ title: s.title, url: s.url! })),
      variant:          routing.variant,
      coveringNote:     routing.coveringNote,
    }))
  } catch (err) {
    return fail(`Delivery email failed: ${err instanceof Error ? err.message : String(err)}`)
  }

  // Internal notification must never fail the delivery the requester already got.
  try {
    await sendEmail(prospectusEnquiryNotificationEmail({
      to:                notifyTo,
      enquiryId,
      organisationName:  enquiry.organisation_name as string,
      organisationType:  ORGANISATION_TYPE_LABELS[enquiry.organisation_type as never],
      audience:          AUDIENCE_LABELS[enquiry.audience as never],
      sizeBand:          SIZE_BAND_LABELS[enquiry.size_band as never],
      interests:         ((enquiry.interests as string[]) ?? []).map((i) => INTEREST_LABELS[i as never] ?? i),
      timing:            TIMING_LABELS[enquiry.timing as never],
      contactName:       enquiry.contact_name as string,
      role:              enquiry.role as string,
      email:             enquiry.email as string,
      phone:             enquiry.phone as string | null,
      anythingElse:      enquiry.anything_else as string | null,
      routedDocuments:   documents.map((d) => d.title),
      needsManualReview: enquiry.needs_manual_review === true,
    }))
  } catch (err) {
    console.error('[prospectus] internal notification failed:', err)
  }

  await (adminClient as AnyClient).from('prospectus_enquiries')
    .update({ sent_at: new Date().toISOString(), send_error: null }).eq('id', enquiryId)

  return { delivered: true, documents }
}

// ─── Admin tracking ──────────────────────────────────────────────────────────

export interface ProspectusEnquiryRow {
  id: string
  organisation_name: string
  organisation_type: string
  audience: string
  size_band: string
  interests: string[]
  timing: string
  contact_name: string
  role: string
  email: string
  phone: string | null
  anything_else: string | null
  routed_documents: string[]
  requested_at: string
  sent_at: string | null
  send_error: string | null
  follow_up_status: string
  needs_manual_review: boolean
  marketing_opt_in: boolean
}

export async function listProspectusEnquiries(
  adminClient: AnyClient, limit = 100,
): Promise<ProspectusEnquiryRow[]> {
  const { data, error } = await (adminClient as AnyClient)
    .from('prospectus_enquiries').select('*')
    .order('requested_at', { ascending: false }).limit(limit)
  if (error) return []
  return (data ?? []) as ProspectusEnquiryRow[]
}

export async function setProspectusFollowUpStatus(
  adminClient: AnyClient, enquiryId: string,
  status: 'new' | 'in_progress' | 'responded' | 'closed', note?: string,
): Promise<void> {
  const { error } = await (adminClient as AnyClient)
    .from('prospectus_enquiries')
    .update({ follow_up_status: status, ...(note !== undefined ? { follow_up_note: note } : {}) })
    .eq('id', enquiryId)
  if (error) throw new Error(`setProspectusFollowUpStatus failed: ${error.message}`)
}
