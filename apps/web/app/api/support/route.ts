import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createServerSupabaseClient } from '@natural-intelligence/db'
import {
  sendEmail,
  supportRequestNotificationEmail,
  supportRequestConfirmationEmail,
} from '@natural-intelligence/db'

// ─── Validation constants ─────────────────────────────────────────────────────

const VALID_REQUEST_TYPES = ['general', 'referral', 'charity_referral', 'practitioner_match', 'other'] as const
const VALID_URGENCY       = ['low', 'normal', 'high'] as const

const MAX_FULL_NAME   = 120
const MAX_EMAIL       = 254  // RFC 5321 max
const MAX_PHONE       = 30
const MAX_DESCRIPTION = 3000
const EMAIL_RE        = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ─── Route ────────────────────────────────────────────────────────────────────

// Unauthenticated support submission is an intentional product decision for Phase 1.
// Non-members (potential clients, referral sources, general public) must be able to
// submit without creating an account. The admin client is used server-side so that
// no RLS policy is required for the insert; all field values are server-validated
// below before writing to the database.

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { full_name, email, phone, request_type, description, urgency } = body

    // ── Required field presence ──────────────────────────────────────────────
    if (!full_name || !email || !request_type || !description) {
      return NextResponse.json({ error: 'Required fields missing' }, { status: 400 })
    }

    // ── Type guard (all must be strings at this point) ───────────────────────
    if (
      typeof full_name    !== 'string' ||
      typeof email        !== 'string' ||
      typeof description  !== 'string' ||
      typeof request_type !== 'string'
    ) {
      return NextResponse.json({ error: 'Invalid field types' }, { status: 400 })
    }

    // ── Length caps ──────────────────────────────────────────────────────────
    if (full_name.trim().length    > MAX_FULL_NAME)   return NextResponse.json({ error: `Full name must be ${MAX_FULL_NAME} characters or fewer` },   { status: 400 })
    if (email.trim().length        > MAX_EMAIL)        return NextResponse.json({ error: `Email address is too long` },                                  { status: 400 })
    if (description.trim().length  > MAX_DESCRIPTION)  return NextResponse.json({ error: `Description must be ${MAX_DESCRIPTION} characters or fewer` }, { status: 400 })
    if (phone && typeof phone === 'string' && phone.trim().length > MAX_PHONE) {
      return NextResponse.json({ error: `Phone number must be ${MAX_PHONE} characters or fewer` }, { status: 400 })
    }

    // ── Email format ─────────────────────────────────────────────────────────
    if (!EMAIL_RE.test(email.trim())) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    // ── Enum whitelist ───────────────────────────────────────────────────────
    if (!(VALID_REQUEST_TYPES as readonly string[]).includes(request_type)) {
      return NextResponse.json({ error: 'Invalid request type' }, { status: 400 })
    }

    const resolvedUrgency = (VALID_URGENCY as readonly string[]).includes(urgency) ? urgency : 'normal'

    // ── Minimum content check ────────────────────────────────────────────────
    if (description.trim().length < 20) {
      return NextResponse.json({ error: 'Please provide more detail in your description' }, { status: 400 })
    }

    // ── Get authenticated user if any (non-fatal — submission is open) ───────
    const supabaseUser = createServerSupabaseClient()
    const { data: { user } } = await supabaseUser.auth.getUser()

    // ── Insert via admin client (service role — bypasses RLS by design) ──────
    const supabase = createAdminClient()

    const { data: inserted, error } = await supabase
      .from('support_requests')
      .insert({
        member_id:    user?.id ?? null,
        full_name:    full_name.trim(),
        email:        email.trim().toLowerCase(),
        phone:        phone?.trim() || null,
        request_type,
        description:  description.trim(),
        urgency:      resolvedUrgency,
        status:       'new',
        submitted_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const submittedAt  = new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' })
    const resolvedEmail = email.trim().toLowerCase()
    const resolvedName  = full_name.trim()

    // ── Admin notification email (non-fatal) ─────────────────────────────────
    try {
      await sendEmail(supportRequestNotificationEmail({
        id:          inserted?.id ?? 'unknown',
        fullName:    resolvedName,
        email:       resolvedEmail,
        requestType: request_type,
        urgency:     resolvedUrgency,
        description: description.trim(),
        submittedAt,
      }))
    } catch (emailErr) {
      console.error('[support] Admin notification email failed:', emailErr)
    }

    // ── Submitter confirmation email (non-fatal) ──────────────────────────────
    try {
      await sendEmail(supportRequestConfirmationEmail({
        fullName:    resolvedName,
        email:       resolvedEmail,
        requestType: request_type,
      }))
    } catch (emailErr) {
      console.error('[support] Confirmation email failed:', emailErr)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[support] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
