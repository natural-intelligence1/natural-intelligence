// ─── packages/db/src/rights/requests.ts ───────────────────────────────────────
// Sprint 3 — client rights requests: the durable channel for consent
// withdrawal and GDPR record rights (access, correction, export, erasure,
// restriction). Manual fulfilment first: members submit, admins action via a
// queue. Table arrives with migration 0051; loose client until typegen.

import type { SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any>

export const RIGHTS_REQUEST_TYPES = [
  'access', 'correction', 'export', 'erasure', 'restriction', 'consent_withdrawal',
] as const
export type RightsRequestType = (typeof RIGHTS_REQUEST_TYPES)[number]

export const RIGHTS_REQUEST_STATUSES = [
  'new', 'acknowledged', 'in_progress', 'fulfilled', 'refused', 'withdrawn',
] as const
export type RightsRequestStatus = (typeof RIGHTS_REQUEST_STATUSES)[number]

/** Legal status transitions for the admin queue (pure — unit-tested). */
const TRANSITIONS: Record<RightsRequestStatus, RightsRequestStatus[]> = {
  new:          ['acknowledged', 'in_progress', 'fulfilled', 'refused', 'withdrawn'],
  acknowledged: ['in_progress', 'fulfilled', 'refused', 'withdrawn'],
  in_progress:  ['fulfilled', 'refused', 'withdrawn'],
  fulfilled:    [],
  refused:      [],
  withdrawn:    [],
}

export function isValidTransition(from: RightsRequestStatus, to: RightsRequestStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false
}

export function isRightsRequestType(v: string): v is RightsRequestType {
  return (RIGHTS_REQUEST_TYPES as readonly string[]).includes(v)
}

export interface RightsRequestRow {
  id: string
  member_id: string
  request_type: RightsRequestType
  details: string | null
  consent_type: string | null
  status: RightsRequestStatus
  resolution_note: string | null
  created_at: string
  updated_at: string
  acknowledged_at: string | null
  resolved_at: string | null
}

export async function createRightsRequest(
  client: AnyClient,
  input: { memberId: string; requestType: RightsRequestType; details?: string; consentType?: string },
): Promise<void> {
  if (!isRightsRequestType(input.requestType)) throw new Error(`Unknown request type: ${input.requestType}`)
  const { error } = await (client as AnyClient).from('client_rights_requests').insert({
    member_id:    input.memberId,
    request_type: input.requestType,
    details:      input.details ?? null,
    consent_type: input.consentType ?? null,
  })
  if (error) throw new Error(`createRightsRequest failed [${error.code}]: ${error.message}`)
}

/** A member's own requests, newest first. [] on error (e.g. pre-migration). */
export async function listOwnRightsRequests(client: AnyClient, memberId: string): Promise<RightsRequestRow[]> {
  const { data, error } = await (client as AnyClient)
    .from('client_rights_requests').select('*')
    .eq('member_id', memberId).order('created_at', { ascending: false })
  if (error) return []
  return (data ?? []) as RightsRequestRow[]
}

/** Admin queue: all requests, oldest-open first. [] on error. */
export async function listAllRightsRequests(client: AnyClient): Promise<RightsRequestRow[]> {
  const { data, error } = await (client as AnyClient)
    .from('client_rights_requests').select('*')
    .order('created_at', { ascending: true })
  if (error) return []
  return (data ?? []) as RightsRequestRow[]
}

export async function updateRightsRequestStatus(
  client: AnyClient,
  input: { requestId: string; from: RightsRequestStatus; to: RightsRequestStatus; handledBy: string; resolutionNote?: string },
): Promise<void> {
  if (!isValidTransition(input.from, input.to)) {
    throw new Error(`Invalid status transition ${input.from} → ${input.to}`)
  }
  const now = new Date().toISOString()
  const patch: Record<string, unknown> = {
    status: input.to, handled_by: input.handledBy, updated_at: now,
    resolution_note: input.resolutionNote ?? null,
  }
  if (input.to === 'acknowledged') patch.acknowledged_at = now
  if (['fulfilled', 'refused', 'withdrawn'].includes(input.to)) patch.resolved_at = now
  const { data, error } = await (client as AnyClient)
    .from('client_rights_requests').update(patch)
    .eq('id', input.requestId).eq('status', input.from)   // optimistic-lock on current status
    .select('id')
  if (error) throw new Error(`updateRightsRequestStatus failed [${error.code}]: ${error.message}`)
  // Review amendment 9: a zero-row update means the request no longer holds
  // the expected status (stale view / concurrent action) — never succeed silently.
  if (!data || data.length === 0) {
    throw new Error(
      `updateRightsRequestStatus: request ${input.requestId} is no longer in status '${input.from}' — refresh and retry.`,
    )
  }
}

const BLOCKING_STATUSES = ['new', 'acknowledged', 'in_progress', 'fulfilled']

/**
 * GLOBAL processing restriction: an open/fulfilled RESTRICTION or ERASURE
 * request, or a consent_withdrawal with NO specific purpose (deliberate
 * "restrict all processing"). Purpose-specific withdrawals do NOT trigger this
 * — see hasPurposeWithdrawal. Failure behaviour: a missing table
 * (pre-migration) returns false — acceptable ONLY because every processing
 * pipeline is additionally behind the default-off intake kill-switches; once
 * 0051 is applied this check is live end-to-end.
 */
export async function hasActiveRestriction(client: AnyClient, memberId: string): Promise<boolean> {
  const { data, error } = await (client as AnyClient)
    .from('client_rights_requests')
    .select('id, request_type, consent_type')
    .eq('member_id', memberId)
    .in('request_type', ['restriction', 'consent_withdrawal', 'erasure'])
    .in('status', BLOCKING_STATUSES)
  if (error) return false
  return (data ?? []).some(
    (r: { request_type: string; consent_type: string | null }) =>
      r.request_type === 'restriction' ||
      r.request_type === 'erasure' ||
      (r.request_type === 'consent_withdrawal' && !r.consent_type),
  )
}

/**
 * PURPOSE-SPECIFIC withdrawal: an open/fulfilled consent_withdrawal request
 * naming exactly this consent purpose. Same pre-migration failure note as
 * hasActiveRestriction.
 */
export async function hasPurposeWithdrawal(
  client: AnyClient, memberId: string, purpose: string,
): Promise<boolean> {
  const { data, error } = await (client as AnyClient)
    .from('client_rights_requests')
    .select('id')
    .eq('member_id', memberId)
    .eq('request_type', 'consent_withdrawal')
    .eq('consent_type', purpose)
    .in('status', BLOCKING_STATUSES)
    .limit(1)
  if (error) return false
  return (data ?? []).length > 0
}

/**
 * The enforcement question pipelines actually ask: is processing under this
 * purpose blocked for this member — either globally (restriction / erasure /
 * blanket withdrawal) or by a withdrawal naming this specific purpose?
 */
export async function isProcessingBlocked(
  client: AnyClient, memberId: string, purpose: string,
): Promise<boolean> {
  if (await hasActiveRestriction(client, memberId)) return true
  return hasPurposeWithdrawal(client, memberId, purpose)
}
