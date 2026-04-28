'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient, createAdminClient } from '@natural-intelligence/db'

async function requireAdmin() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') throw new Error('Forbidden')

  return { adminClient, adminUserId: user.id }
}

// ─── Seed test application ────────────────────────────────────────────────────
export async function seedTestApplication(): Promise<{ id: string }> {
  const { adminClient } = await requireAdmin()

  // Create a throw-away auth user for the test application
  const email = `test-applicant-${Date.now()}@dev.internal`
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password: 'TestPass123!',
    email_confirm: true,
  })
  if (authError || !authData.user) throw new Error(authError?.message ?? 'Failed to create test auth user')

  const profileId = authData.user.id

  // Update profile with a name
  await adminClient.from('profiles').update({
    full_name: `Test Applicant ${Date.now()}`,
    role: 'member',
    is_test_data: true,
  }).eq('id', profileId)

  const { data: app, error: appError } = await adminClient
    .from('practitioner_applications')
    .insert({
      profile_id:       profileId,
      full_name:        `Test Applicant ${Date.now()}`,
      email,
      phone:            '+44 7000 000000',
      city:             'London',
      country:          'UK',
      experience_range: '3-5 years',
      delivery_mode:    'both',
      primary_professions: ['Psychotherapist'],
      area_tags:        ['Anxiety', 'Depression'],
      client_types:     ['Adults'],
      credentials:      'BACP accredited. Test credentials entry for dev data.',
      bio:              'This is a test applicant bio. It is long enough to meet the minimum character requirements for the bio field which is eighty characters.',
      motivation:       'This is a test motivation statement. It needs to be at least one hundred characters long to pass validation. This test entry is used for development and seeding purposes only and should not be visible to real users.',
      accepts_referrals:       true,
      open_to_collaboration:   false,
      status:                  'submitted',
      consent_text:            'Test consent snapshot',
      consent_version:         '1.1',
      is_test_data:            true,
    })
    .select('id')
    .single()

  if (appError) throw new Error(appError.message)

  revalidatePath('/applications')
  return { id: app.id }
}

// ─── Seed approved practitioner (active, profile complete) ───────────────────
export async function seedTestPractitioner(): Promise<{ id: string }> {
  const { adminClient } = await requireAdmin()

  const email = `test-practitioner-${Date.now()}@dev.internal`
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password: 'TestPass123!',
    email_confirm: true,
  })
  if (authError || !authData.user) throw new Error(authError?.message ?? 'Failed to create test auth user')

  const profileId = authData.user.id

  await adminClient.from('profiles').update({
    full_name: `Test Practitioner ${Date.now()}`,
    role: 'practitioner',
    bio: 'Test practitioner bio. This practitioner was created via the admin dev seed tool for internal testing purposes only.',
    is_test_data: true,
  }).eq('id', profileId)

  const { data: prac, error: pracError } = await adminClient
    .from('practitioners')
    .insert({
      profile_id:              profileId,
      tagline:                 'Test practitioner tagline for directory display.',
      city:                    'Manchester',
      country:                 'UK',
      delivery_mode:           'online',
      primary_professions:     ['Counsellor'],
      area_tags:               ['Stress', 'Burnout', 'Work-life balance'],
      client_types:            ['Adults', 'Couples'],
      credentials:             ['BACP member. Test entry.'],
      experience_range:        '5-10 years',
      accepts_referrals:       true,
      open_to_collaboration:   true,
      practitioner_tier:       'standard',
      trust_level:             'unvetted',
      lifecycle_status:        'active',
      is_active:               true,
      is_directory_ready:      true,
      profile_completeness_pct: 100,
      activated_at:            new Date().toISOString(),
      is_test_data:            true,
    })
    .select('id')
    .single()

  if (pracError) throw new Error(pracError.message)

  revalidatePath('/practitioners')
  return { id: prac.id }
}

// ─── Seed test support request ────────────────────────────────────────────────
export async function seedTestSupportRequest(): Promise<{ id: string }> {
  const { adminClient } = await requireAdmin()

  const { data: req, error } = await adminClient
    .from('support_requests')
    .insert({
      member_id:    null,
      full_name:    'Dev Seed — Test Request',
      email:        'dev-seed@dev.internal',
      request_type: 'general',
      description:  'This is a test support request created via the dev seed tool. It can be safely deleted.',
      urgency:      'low',
      status:       'new',
      is_test_data: true,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  revalidatePath('/support')
  return { id: req.id }
}

// ─── Reset all test data ──────────────────────────────────────────────────────
export async function resetTestData(): Promise<{ deleted: Record<string, number> }> {
  const { adminClient } = await requireAdmin()

  // Delete in dependency order
  const [apps, pracs, support, profiles] = await Promise.all([
    adminClient.from('practitioner_applications').delete().eq('is_test_data', true).select('id'),
    adminClient.from('practitioners').delete().eq('is_test_data', true).select('id'),
    adminClient.from('support_requests').delete().eq('is_test_data', true).select('id'),
    adminClient.from('profiles').select('id').eq('is_test_data', true),
  ])

  // Delete auth users for test profiles
  if (profiles.data && profiles.data.length > 0) {
    await Promise.all(
      profiles.data.map((p: { id: string }) =>
        adminClient.auth.admin.deleteUser(p.id).catch(() => null)
      )
    )
  }

  revalidatePath('/applications')
  revalidatePath('/practitioners')
  revalidatePath('/support')

  return {
    deleted: {
      applications:     apps.data?.length ?? 0,
      practitioners:    pracs.data?.length ?? 0,
      supportRequests:  support.data?.length ?? 0,
      profiles:         profiles.data?.length ?? 0,
    },
  }
}
