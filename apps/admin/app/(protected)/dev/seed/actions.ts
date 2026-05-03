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

// ─── Seed showcase data (5 practitioners + 3 events + 3 resources) ───────────
export async function seedShowcaseData(): Promise<{ practitioners: number; events: number; resources: number }> {
  const { adminClient } = await requireAdmin()

  // ── Practitioners ────────────────────────────────────────────────────────────
  const practitioners = [
    {
      email:    `dr-sarah-chen-${Date.now()}@showcase.internal`,
      name:     'Dr Sarah Chen',
      bio:      'Dr Sarah Chen integrates Traditional Chinese Medicine with modern functional diagnostics to support chronic pain, fatigue, and fertility. She trained at the Beijing University of Chinese Medicine and has practised in London for over twelve years.',
      tagline:  'Traditional Chinese Medicine and acupuncture for chronic pain, fatigue, and fertility.',
      city:     'London',
      professions: ['Acupuncturist', 'Traditional Chinese Medicine Practitioner'],
      areas:    ['Chronic pain', 'Fatigue', 'Fertility', 'Hormonal balance'],
      clients:  ['Adults', 'Women'],
      experience: '10+ years',
      tier:     'premium',
      trust:    'vetted' as const,
    },
    {
      email:    `marcus-obi-${Date.now()}@showcase.internal`,
      name:     'Marcus Obi',
      bio:      'Marcus Obi is a functional medicine practitioner specialising in gut health, hormonal imbalance, and autoimmune conditions. He takes a root-cause approach combining advanced lab testing with evidence-based nutritional and lifestyle protocols.',
      tagline:  'Functional medicine for gut health, hormones, and autoimmune conditions.',
      city:     'Birmingham',
      professions: ['Functional Medicine Practitioner'],
      areas:    ['Gut health', 'Hormones', 'Autoimmune conditions', 'Inflammation'],
      clients:  ['Adults'],
      experience: '5-10 years',
      tier:     'standard',
      trust:    'vetted' as const,
    },
    {
      email:    `lena-parrish-${Date.now()}@showcase.internal`,
      name:     'Lena Parrish',
      bio:      'Lena Parrish is a registered nutritional therapist working with adults and young people on sustainable energy, healthy weight management, and nutritional foundations. Her approach is practical, non-restrictive, and grounded in biochemistry.',
      tagline:  'Nutritional therapy for lasting energy, weight balance, and everyday wellbeing.',
      city:     'Edinburgh',
      professions: ['Nutritional Therapist'],
      areas:    ['Nutrition', 'Weight management', 'Energy', 'Digestive health'],
      clients:  ['Adults', 'Young people'],
      experience: '3-5 years',
      tier:     'standard',
      trust:    'unvetted' as const,
    },
    {
      email:    `james-thornton-${Date.now()}@showcase.internal`,
      name:     'James Thornton',
      bio:      'James Thornton has practised naturopathic medicine for over a decade, helping patients address digestive disorders, chronic stress, and poor sleep through a combination of botanical medicine, hydrotherapy, and lifestyle modification.',
      tagline:  'Naturopathic medicine for digestive health, stress resilience, and restorative sleep.',
      city:     'Manchester',
      professions: ['Naturopath'],
      areas:    ['Digestive health', 'Stress', 'Sleep', 'Nervous system'],
      clients:  ['Adults', 'Older adults'],
      experience: '10+ years',
      tier:     'premium',
      trust:    'vetted' as const,
    },
    {
      email:    `dr-priya-nair-${Date.now()}@showcase.internal`,
      name:     'Dr Priya Nair',
      bio:      'Dr Priya Nair is an integrative GP and functional medicine physician with a specialism in women\'s hormonal health, thyroid conditions, and perimenopause. She brings the rigour of conventional medicine and the depth of functional investigation to every consultation.',
      tagline:  'Integrative medicine for women\'s health, thyroid conditions, and hormonal transitions.',
      city:     'London',
      professions: ['Integrative GP', 'Functional Medicine Practitioner'],
      areas:    ['Women\'s health', 'Thyroid', 'Perimenopause', 'Hormones'],
      clients:  ['Adults', 'Women'],
      experience: '10+ years',
      tier:     'premium',
      trust:    'vetted' as const,
    },
  ]

  let practitionerCount = 0

  for (const p of practitioners) {
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email:          p.email,
      password:       'ShowcasePass123!',
      email_confirm:  true,
    })
    if (authError || !authData.user) continue

    const profileId = authData.user.id

    await adminClient.from('profiles').update({
      full_name:    p.name,
      role:         'practitioner',
      bio:          p.bio,
      is_test_data: true,
    }).eq('id', profileId)

    const { error: pracError } = await adminClient.from('practitioners').insert({
      profile_id:              profileId,
      tagline:                 p.tagline,
      city:                    p.city,
      country:                 'UK',
      delivery_mode:           'both',
      primary_professions:     p.professions,
      area_tags:               p.areas,
      client_types:            p.clients,
      credentials:             [`Registered with relevant professional body. ${p.experience} experience.`],
      experience_range:        p.experience,
      accepts_referrals:       true,
      open_to_collaboration:   true,
      practitioner_tier:       p.tier,
      trust_level:             p.trust,
      lifecycle_status:        'active',
      is_active:               true,
      is_directory_ready:      true,
      profile_completeness_pct: 100,
      activated_at:            new Date().toISOString(),
      is_test_data:            true,
    })

    if (!pracError) practitionerCount++
  }

  // ── Events ───────────────────────────────────────────────────────────────────
  // Dates: 2, 3, and 4 weeks from seeding (approx. 2026-05-12, -19, -26)
  const now = new Date()
  const weeks = (n: number) => new Date(now.getTime() + n * 7 * 24 * 60 * 60 * 1000).toISOString()

  const events = [
    {
      title:        'Understanding Your Gut Microbiome',
      description:  'A guided workshop exploring how the gut microbiome influences immunity, mood, and metabolic health — and what you can do to support it. Includes a live Q&A with a functional medicine practitioner.',
      event_type:   'workshop',
      starts_at:    weeks(2),
      ends_at:      new Date(new Date(weeks(2)).getTime() + 60 * 60 * 1000).toISOString(),
      is_online:    true,
      max_capacity: 20,
      status:       'published',
    },
    {
      title:        'Functional Lab Testing: What Your GP Misses',
      description:  'Learn which advanced tests reveal the root causes behind fatigue, brain fog, hormonal imbalance, and digestive symptoms — and how to interpret results alongside a practitioner.',
      event_type:   'workshop',
      starts_at:    weeks(3),
      ends_at:      new Date(new Date(weeks(3)).getTime() + 90 * 60 * 1000).toISOString(),
      is_online:    true,
      max_capacity: 15,
      status:       'published',
    },
    {
      title:        'The Foundations of Functional Medicine',
      description:  'An introductory webinar covering the core principles of functional and naturopathic medicine — how it differs from conventional care, what to expect from your first consultation, and how to get started.',
      event_type:   'webinar',
      starts_at:    weeks(4),
      ends_at:      new Date(new Date(weeks(4)).getTime() + 45 * 60 * 1000).toISOString(),
      is_online:    true,
      max_capacity: 50,
      status:       'published',
    },
  ]

  const { data: insertedEvents } = await adminClient
    .from('events')
    .insert(events)
    .select('id')

  const eventCount = insertedEvents?.length ?? 0

  // ── Resources ────────────────────────────────────────────────────────────────
  const resources = [
    {
      title:         'A Practitioner\'s Guide to the Elimination Diet',
      description:   'A structured, step-by-step protocol for identifying food sensitivities and inflammatory triggers through a clinically supervised elimination and reintroduction approach.',
      resource_type: 'guide',
      topic_tags:    ['Nutrition', 'Gut health', 'Inflammation', 'Food sensitivity'],
      status:        'published' as const,
      published_at:  new Date().toISOString(),
    },
    {
      title:         'Reading Your Blood Work — What the Ranges Don\'t Tell You',
      description:   'Standard laboratory reference ranges are designed for sick populations, not optimal health. This article explains how functional practitioners interpret common blood markers differently and what narrower optimal ranges reveal.',
      resource_type: 'article',
      topic_tags:    ['Lab testing', 'Blood work', 'Functional medicine', 'Thyroid'],
      status:        'published' as const,
      published_at:  new Date().toISOString(),
    },
    {
      title:         'Supplement Quality: What to Look For',
      description:   'Not all supplements are created equal. This guide covers the key markers of quality — third-party testing, bioavailable forms, excipient standards — and how to evaluate products before recommending them to patients.',
      resource_type: 'guide',
      topic_tags:    ['Supplements', 'Quality', 'Nutrition', 'Clinical guidance'],
      status:        'published' as const,
      published_at:  new Date().toISOString(),
    },
  ]

  const { data: insertedResources } = await adminClient
    .from('resources')
    .insert(resources)
    .select('id')

  const resourceCount = insertedResources?.length ?? 0

  revalidatePath('/practitioners')
  revalidatePath('/workshops')
  revalidatePath('/resources')

  return { practitioners: practitionerCount, events: eventCount, resources: resourceCount }
}

// ─── Seed showcase practitioners (spec-exact data) ───────────────────────────
export async function seedShowcasePractitioners(): Promise<{ practitioners: number; events: number; resources: number }> {
  const { adminClient } = await requireAdmin()

  const ts = Date.now()

  const practitionerSpecs = [
    {
      email:        `dr-sarah-chen-${ts}@showcase.internal`,
      full_name:    'Dr Sarah Chen',
      bio:          'I work at the intersection of conventional medicine and naturopathic practice, helping patients with complex hormonal and metabolic presentations. My approach combines functional lab analysis with evidence-based natural interventions.',
      tagline:      'Bridging conventional and naturopathic medicine',
      primary_professions: ['Integrative Medicine Doctor'],
      area_tags:    ['HPA axis', 'hormones', 'fatigue', 'thyroid'],
      credentials:  ['MBBS', 'BANT member', 'Functional Medicine certified'],
      delivery_mode: 'online' as const,
      trust_level:   'vetted' as const,
      accepts_referrals: true,
    },
    {
      email:        `marcus-obi-${ts}@showcase.internal`,
      full_name:    'Marcus Obi',
      bio:          'Specialising in the gut-immune axis and metabolic dysfunction, I use advanced functional testing to uncover root causes that standard approaches miss.',
      tagline:      'Root cause nutrition for complex health needs',
      primary_professions: ['Functional Nutritionist'],
      area_tags:    ['gut health', 'inflammation', 'metabolic health', 'IBS'],
      credentials:  ['mBANT', 'CNHC registered', 'IFM trained'],
      delivery_mode: 'online' as const,
      trust_level:   'vetted' as const,
      accepts_referrals: true,
    },
    {
      email:        `dr-lena-parrish-${ts}@showcase.internal`,
      full_name:    'Dr Lena Parrish',
      bio:          'With a focus on autoimmune conditions and hormonal health, I combine naturopathic principles with current functional medicine research to create truly personalised care plans.',
      tagline:      'Personalised naturopathic care for chronic conditions',
      primary_professions: ['Naturopathic Doctor'],
      area_tags:    ['autoimmune', 'detoxification', 'hormones', 'fertility'],
      credentials:  ['ND', 'FNLP', 'BANT member'],
      delivery_mode: 'both' as const,
      trust_level:   'vetted' as const,
      accepts_referrals: false,
    },
    {
      email:        `james-thornton-${ts}@showcase.internal`,
      full_name:    'James Thornton',
      bio:          'I help high-performing individuals address the lifestyle foundations of health — sleep, stress, movement, and nutrition — using a functional lens and evidence-based coaching.',
      tagline:      'Sustainable lifestyle change through functional health',
      primary_professions: ['Health Coach'],
      area_tags:    ['stress', 'sleep', 'lifestyle medicine', 'resilience'],
      credentials:  ['NBC-HWC', 'Precision Nutrition L2'],
      delivery_mode: 'online' as const,
      trust_level:   'unvetted' as const,
      accepts_referrals: true,
    },
    {
      email:        `dr-priya-nair-${ts}@showcase.internal`,
      full_name:    'Dr Priya Nair',
      bio:          'I specialise in complex chronic conditions where conventional approaches have reached their limits. My practice combines advanced diagnostics with personalised therapeutic protocols.',
      tagline:      'Evidence-based functional medicine for complex cases',
      primary_professions: ['Functional Medicine Practitioner'],
      area_tags:    ['mitochondrial health', 'cognitive function', 'energy', 'complex chronic illness'],
      credentials:  ['MBBS', 'IFMCP', 'Bredesen ReCODE trained'],
      delivery_mode: 'both' as const,
      trust_level:   'unvetted' as const,
      accepts_referrals: true,
    },
  ]

  let practitionerCount = 0

  for (const spec of practitionerSpecs) {
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email:         spec.email,
      password:      'ShowcasePass123!',
      email_confirm: true,
    })
    if (authError || !authData.user) continue

    const profileId = authData.user.id

    await adminClient.from('profiles').update({
      full_name:    spec.full_name,
      role:         'practitioner',
      bio:          spec.bio,
      is_test_data: true,
    }).eq('id', profileId)

    const { error: pracError } = await adminClient.from('practitioners').insert({
      profile_id:              profileId,
      tagline:                 spec.tagline,
      country:                 'UK',
      delivery_mode:           spec.delivery_mode,
      primary_professions:     spec.primary_professions,
      area_tags:               spec.area_tags,
      credentials:             spec.credentials,
      trust_level:             spec.trust_level,
      accepts_referrals:       spec.accepts_referrals,
      lifecycle_status:        'active',
      is_active:               true,
      is_directory_ready:      true,
      profile_completeness_pct: 100,
      activated_at:            new Date().toISOString(),
      is_test_data:            true,
    })

    if (!pracError) practitionerCount++
  }

  // ── Events (2, 3, 4 weeks from now) ─────────────────────────────────────────
  const now = new Date()
  const weeksAhead = (n: number) =>
    new Date(now.getTime() + n * 7 * 24 * 60 * 60 * 1000).toISOString()

  const addHours = (iso: string, h: number) =>
    new Date(new Date(iso).getTime() + h * 60 * 60 * 1000).toISOString()

  const e1Start = weeksAhead(2)
  const e2Start = weeksAhead(3)
  const e3Start = weeksAhead(4)

  const { data: insertedEvents } = await adminClient.from('events').insert([
    {
      title:        'Understanding your cortisol cycle',
      event_type:   'workshop',
      is_online:    true,
      status:       'published',
      max_capacity: 20,
      starts_at:    e1Start,
      ends_at:      addHours(e1Start, 1),
      description:  'An in-depth look at how cortisol patterns affect energy, sleep, mood, and weight — and what you can do about it.',
    },
    {
      title:        'Reading your lab results like a practitioner',
      event_type:   'webinar',
      is_online:    true,
      status:       'published',
      max_capacity: 100,
      starts_at:    e2Start,
      ends_at:      addHours(e2Start, 1),
      description:  null,
    },
    {
      title:        'Gut health fundamentals — live Q&A',
      event_type:   'group_session',
      is_online:    true,
      status:       'published',
      max_capacity: 15,
      starts_at:    e3Start,
      ends_at:      addHours(e3Start, 1),
      description:  null,
    },
  ]).select('id')

  // ── Resources ────────────────────────────────────────────────────────────────
  const { data: insertedResources } = await adminClient.from('resources').insert([
    {
      title:         'The functional medicine approach to fatigue',
      resource_type: 'article',
      status:        'published',
      topic_tags:    ['fatigue', 'functional medicine', 'adrenal'],
      description:   'Why conventional medicine often misses the root causes of persistent fatigue — and how functional medicine investigates differently.',
      published_at:  new Date().toISOString(),
    },
    {
      title:         'Understanding your thyroid: beyond TSH',
      resource_type: 'guide',
      status:        'published',
      topic_tags:    ['thyroid', 'hormones', 'lab literacy'],
      description:   'A plain-language guide to thyroid function testing, reference ranges, and what optimal really means.',
      published_at:  new Date().toISOString(),
    },
    {
      title:         'The gut-brain axis: what your digestion tells you about your mental health',
      resource_type: 'article',
      status:        'published',
      topic_tags:    ['gut health', 'mental health', 'microbiome'],
      description:   'The emerging science connecting gut health to mood, cognition, and mental wellbeing.',
      published_at:  new Date().toISOString(),
    },
  ]).select('id')

  revalidatePath('/practitioners')
  revalidatePath('/workshops')
  revalidatePath('/resources')

  return {
    practitioners: practitionerCount,
    events:        insertedEvents?.length ?? 0,
    resources:     insertedResources?.length ?? 0,
  }
}

// ─── Fix workshop event times ─────────────────────────────────────────────────
// Updates the three showcase events with correct UK evening times (BST → UTC).
// Safe to run multiple times.
export async function fixEventTimes(): Promise<{ updated: number }> {
  const { adminClient } = await requireAdmin()

  const fixes = [
    { title: 'Understanding your cortisol cycle',            hour: 18, minute: 0,  durationMins: 60 },
    { title: 'Reading your lab results like a practitioner', hour: 17, minute: 0,  durationMins: 60 },
    { title: 'Gut health fundamentals — live Q&A',           hour: 11, minute: 30, durationMins: 60 },
  ]

  let updated = 0

  for (const fix of fixes) {
    const { data: event } = await adminClient
      .from('events')
      .select('id, starts_at')
      .eq('title', fix.title)
      .maybeSingle()

    if (!event) continue

    // Preserve the seeded date; override the time component to the correct UTC hour.
    const d = new Date(event.starts_at)
    d.setUTCHours(fix.hour, fix.minute, 0, 0)
    const newStart = d.toISOString()
    const newEnd   = new Date(d.getTime() + fix.durationMins * 60 * 1000).toISOString()

    const { error } = await adminClient
      .from('events')
      .update({ starts_at: newStart, ends_at: newEnd })
      .eq('id', event.id)

    if (!error) updated++
  }

  revalidatePath('/workshops')
  return { updated }
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
