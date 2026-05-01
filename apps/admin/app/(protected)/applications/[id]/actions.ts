'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'
import { sendEmail, applicationDecisionEmail, applicationApprovedEmail } from '@natural-intelligence/db'

// ─── Shared admin guard ───────────────────────────────────────────────────────

async function requireAdmin() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') throw new Error('Forbidden')

  return { user, adminClient }
}

// ─── Completeness calculation (mirrors web app logic) ────────────────────────

function calcCompleteness(data: {
  tagline?: string | null; bio?: string | null
  primary_professions?: string[] | null; area_tags?: string[] | null
  delivery_mode?: string | null; city?: string | null; country?: string | null
}): number {
  const checks = [
    Boolean(data.tagline?.trim()),
    Boolean(data.bio?.trim()),
    Boolean(data.primary_professions?.length),
    Boolean(data.area_tags?.length),
    Boolean(data.delivery_mode),
    Boolean(data.city?.trim()),
    Boolean(data.country?.trim()),
  ]
  return Math.round((checks.filter(Boolean).length / 7) * 100)
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function approveApplication(applicationId: string, notes: string) {
  const { adminClient } = await requireAdmin()

  // Fetch full application — profile_id is now the reliable link
  const { data: app } = await adminClient
    .from('practitioner_applications')
    .select('*')
    .eq('id', applicationId)
    .single()

  if (!app) throw new Error('Application not found')

  // Mark application approved
  await adminClient
    .from('practitioner_applications')
    .update({
      status:         'approved',
      reviewer_notes: notes || null,
      updated_at:     new Date().toISOString(),
    })
    .eq('id', applicationId)

  const profileId = (app as any).profile_id as string | null

  if (profileId) {
    // Compute initial completeness from application data
    // Bio lives on profiles table — fetch it
    const { data: profileRow } = await adminClient
      .from('profiles').select('bio').eq('id', profileId).single()

    const completenessData = {
      tagline:             null,         // not set until profile editor
      bio:                 profileRow?.bio ?? app.bio,
      primary_professions: (app as any).primary_professions ?? [],
      area_tags:           (app as any).area_tags ?? [],
      delivery_mode:       (app as any).delivery_mode ?? null,
      city:                (app as any).city ?? null,
      country:             (app as any).country ?? null,
    }
    const pct         = calcCompleteness(completenessData)
    const isReady     = pct === 100

    // Check for an existing practitioners row for this profile
    const { data: existing } = await adminClient
      .from('practitioners')
      .select('id')
      .eq('profile_id', profileId)
      .maybeSingle()

    const practitionerPayload = {
      profile_id:               profileId,
      city:                     (app as any).city    ?? null,
      country:                  (app as any).country ?? null,
      primary_professions:      (app as any).primary_professions    ?? [],
      area_tags:                (app as any).area_tags               ?? [],
      client_types:             (app as any).client_types            ?? [],
      delivery_mode:            (app as any).delivery_mode           ?? null,
      experience_range:         (app as any).experience_range        ?? null,
      currently_seeing_clients: (app as any).currently_seeing_clients ?? null,
      accepts_referrals:        (app as any).accepts_referrals       ?? true,
      open_to_collaboration:    (app as any).open_to_collaboration   ?? false,
      collaboration_types:      (app as any).collaboration_types     ?? [],
      specialties:              (app as any).area_tags               ?? [],
      credentials:              app.credentials ? [app.credentials] : [],
      website_url:              app.website_url  ?? null,
      linkedin_url:             app.linkedin_url ?? null,
      trust_level:              'unvetted' as const,
      is_active:                true,
      lifecycle_status:         isReady ? 'active' : 'approved_pending_profile',
      profile_completeness_pct: pct,
      is_directory_ready:       isReady,
      practitioner_tier:        'standard',
    }

    if (existing?.id) {
      await adminClient.from('practitioners').update(practitionerPayload).eq('id', existing.id)
    } else {
      await adminClient.from('practitioners').insert(practitionerPayload)
    }

    // Set bio on profiles if provided in application and not already set
    if (app.bio && !profileRow?.bio) {
      await adminClient.from('profiles').update({ bio: app.bio }).eq('id', profileId)
    }

    // Promote profile role
    await adminClient.from('profiles').update({ role: 'practitioner' }).eq('id', profileId)
  }

  // Send HTML approval email (non-fatal)
  const appEmail    = (app as any).email as string | null
  const appFullName = (app as any).full_name as string | null
  if (appEmail && appFullName) {
    try {
      await sendEmail(applicationApprovedEmail({
        fullName: appFullName,
        email:    appEmail,
      }))
    } catch (e) {
      console.error('[approveApplication] Email failed:', e)
    }
  }

  revalidatePath('/applications')
  revalidatePath(`/applications/${applicationId}`)
  revalidatePath('/practitioners')
}

export async function rejectApplication(applicationId: string, notes: string) {
  const { adminClient } = await requireAdmin()

  const { data: app } = await adminClient
    .from('practitioner_applications')
    .select('full_name, email')
    .eq('id', applicationId)
    .single()

  await adminClient
    .from('practitioner_applications')
    .update({
      status:         'rejected',
      reviewer_notes: notes || null,
      updated_at:     new Date().toISOString(),
    })
    .eq('id', applicationId)

  if (app?.email && app?.full_name) {
    try {
      await sendEmail(applicationDecisionEmail({
        to:       app.email,
        fullName: app.full_name,
        decision: 'rejected',
      }))
    } catch (e) {
      console.error('[rejectApplication] Email failed:', e)
    }
  }

  revalidatePath('/applications')
  revalidatePath(`/applications/${applicationId}`)
}

export async function markUnderReview(applicationId: string) {
  const { adminClient } = await requireAdmin()

  await adminClient
    .from('practitioner_applications')
    .update({ status: 'under_review', updated_at: new Date().toISOString() })
    .eq('id', applicationId)

  revalidatePath('/applications')
  revalidatePath(`/applications/${applicationId}`)
}
