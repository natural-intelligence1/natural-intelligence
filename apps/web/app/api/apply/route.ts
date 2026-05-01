import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'
import { sendEmail, applicationSubmittedNotificationEmail } from '@natural-intelligence/db'

// ─── Validation constants (must mirror client) ────────────────────────────────
const BIO_MIN        = 80
const BIO_MAX        = 1200
const MOTIVATION_MIN = 100
const MOTIVATION_MAX = 2000
const CREDENTIALS_MAX = 400

const VALID_EXPERIENCE_RANGES  = ['0-1', '1-3', '3-5', '5-10', '10+'] as const
const VALID_DELIVERY_MODES     = ['online', 'in_person', 'both'] as const

function isValidUrl(s: string | null | undefined): boolean {
  if (!s) return true
  try { new URL(s); return true } catch { return false }
}

export async function POST(request: NextRequest) {
  // ── 1. Require authenticated session ─────────────────────────────────────
  const supabase = createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'You must be logged in to apply.' }, { status: 401 })
  }

  try {
    const body = await request.json()

    const {
      profile_id,
      full_name,
      email,
      phone,
      city,
      country,
      experience_range,
      currently_seeing_clients,
      primary_professions,
      area_tags,
      client_types,
      delivery_mode,
      credentials,
      bio,
      website_url,
      accepts_referrals,
      open_to_collaboration,
      collaboration_types,
      motivation,
      consent_text,
      consent_version,
    } = body

    // ── 2. Verify profile_id matches authenticated user ───────────────────
    if (profile_id !== user.id) {
      return NextResponse.json({ error: 'Profile ID mismatch.' }, { status: 403 })
    }

    // ── 3. Server-side validation ─────────────────────────────────────────
    const errors: string[] = []

    if (!full_name?.trim())               errors.push('Full name is required.')
    if (!city?.trim())                    errors.push('City is required.')
    if (!country?.trim())                 errors.push('Country is required.')
    if (!experience_range || !VALID_EXPERIENCE_RANGES.includes(experience_range))
                                          errors.push('Valid experience range is required.')
    if (!primary_professions?.length)     errors.push('At least one profession is required.')
    if (!area_tags?.length)               errors.push('At least one area of practice is required.')
    if (!delivery_mode || !VALID_DELIVERY_MODES.includes(delivery_mode))
                                          errors.push('Valid delivery mode is required.')
    if (!credentials?.trim())             errors.push('Credentials are required.')
    if (credentials?.length > CREDENTIALS_MAX)
                                          errors.push(`Credentials must be under ${CREDENTIALS_MAX} characters.`)
    if (!bio?.trim() || bio.length < BIO_MIN)
                                          errors.push(`Bio must be at least ${BIO_MIN} characters.`)
    if (bio?.length > BIO_MAX)            errors.push(`Bio must be under ${BIO_MAX} characters.`)
    if (!motivation?.trim() || motivation.length < MOTIVATION_MIN)
                                          errors.push(`Motivation must be at least ${MOTIVATION_MIN} characters.`)
    if (motivation?.length > MOTIVATION_MAX)
                                          errors.push(`Motivation must be under ${MOTIVATION_MAX} characters.`)
    if (website_url && !isValidUrl(website_url))
                                          errors.push('Please enter a valid website URL.')
    if (!consent_text?.trim())            errors.push('Consent is required.')

    if (errors.length > 0) {
      return NextResponse.json({ error: errors[0] }, { status: 422 })
    }

    // ── 4. Duplicate application check ────────────────────────────────────
    const adminClient = createAdminClient()

    const { data: existing } = await adminClient
      .from('practitioner_applications')
      .select('id, status')
      .eq('profile_id', user.id)
      .neq('status', 'rejected')
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'You have already submitted an application.' },
        { status: 409 }
      )
    }

    // ── 5. Insert application ─────────────────────────────────────────────
    const { data: inserted, error: insertError } = await adminClient
      .from('practitioner_applications')
      .insert({
        profile_id,
        full_name:                full_name.trim(),
        email:                    user.email ?? email,
        phone:                    phone?.trim() || null,
        city:                     city.trim(),
        country:                  country.trim(),
        experience_range,
        currently_seeing_clients: currently_seeing_clients ?? null,
        primary_professions:      Array.isArray(primary_professions) ? primary_professions : [],
        area_tags:                Array.isArray(area_tags) ? area_tags : [],
        client_types:             Array.isArray(client_types) ? client_types : [],
        delivery_mode,
        credentials:              credentials.trim(),
        bio:                      bio.trim(),
        motivation:               motivation.trim(),
        website_url:              website_url?.trim() || null,
        accepts_referrals:        accepts_referrals ?? true,
        open_to_collaboration:    open_to_collaboration ?? false,
        collaboration_types:      Array.isArray(collaboration_types) ? collaboration_types : [],
        consent_text:             consent_text?.trim() || null,
        consent_version:          consent_version ?? '1.0',
        status:                   'submitted',
        submitted_at:             new Date().toISOString(),
      })
      .select('id')
      .single()

    if (insertError) {
      // Unique constraint violation = duplicate application race condition
      if (insertError.code === '23505') {
        return NextResponse.json({ error: 'You have already submitted an application.' }, { status: 409 })
      }
      console.error('[apply] Insert error:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // ── 6. HTML notification email to admin (non-fatal) ───────────────────
    try {
      await sendEmail(applicationSubmittedNotificationEmail({
        id:                 inserted?.id ?? 'unknown',
        fullName:           full_name.trim(),
        email:              user.email ?? email,
        primaryProfessions: Array.isArray(primary_professions) ? primary_professions : [],
        areaTags:           Array.isArray(area_tags) ? area_tags : [],
        motivation:         motivation.trim(),
        submittedAt:        new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' }),
      }))
    } catch (emailErr) {
      console.error('[apply] Email notification failed:', emailErr)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[apply] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
