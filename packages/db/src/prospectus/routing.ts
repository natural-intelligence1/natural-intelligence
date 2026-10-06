// ─── packages/db/src/prospectus/routing.ts ───────────────────────────────────
// Corporate prospectus — the five routing questions and the rules that pick
// which document(s) an enquiry receives. PURE: no I/O, no DB, no email, so the
// routing table can be unit-tested exhaustively.
//
// This is a gated enterprise-content journey, not a public download library:
// nothing here exposes a document URL. Delivery happens server-side after an
// enquiry is recorded (see ./enquiries.ts).
//
// DATA BOUNDARY: every field below is BUSINESS information about an
// organisation and its contact. Nothing here collects health information
// about an individual, and this dataset is kept out of the client health
// data model entirely.

export const ORGANISATION_TYPES = [
  'care_setting', 'workplace', 'school_college', 'community_faith', 'charity', 'other',
] as const
export type OrganisationType = (typeof ORGANISATION_TYPES)[number]

export const ORGANISATION_TYPE_LABELS: Record<OrganisationType, string> = {
  care_setting:    'Care home or care setting',
  workplace:       'Business or workplace',
  school_college:  'School or college',
  community_faith: 'Community or faith organisation',
  charity:         'Charity',
  other:           'Other',
}

export const AUDIENCES = [
  'residents', 'staff', 'both',
  'students', 'parents_families',
  'employees', 'members', 'service_users',
  'combination',
] as const
export type Audience = (typeof AUDIENCES)[number]

export const AUDIENCE_LABELS: Record<Audience, string> = {
  residents:        'Residents',
  staff:            'Staff',
  both:             'Both',
  students:         'Students',
  parents_families: 'Parents and families',
  employees:        'Employees',
  members:          'Members',
  service_users:    'Service users',
  combination:      'A combination',
}

/** Q2's options branch on Q1. */
export function audienceOptionsFor(type: OrganisationType): Audience[] {
  if (type === 'care_setting')   return ['residents', 'staff', 'both']
  if (type === 'school_college') return ['students', 'staff', 'parents_families', 'combination']
  return ['employees', 'members', 'service_users', 'combination']
}

export const SIZE_BANDS = ['under_25', '25_75', '75_200', 'over_200'] as const
export type SizeBand = (typeof SIZE_BANDS)[number]
export const SIZE_BAND_LABELS: Record<SizeBand, string> = {
  under_25: 'Under 25', '25_75': '25–75', '75_200': '75–200', over_200: 'Over 200',
}

export const INTERESTS = [
  'general_health_education', 'energy_fatigue', 'nutrition', 'sleep',
  'stress_wellbeing', 'healthy_ageing', 'families_carers', 'not_sure',
] as const
export type Interest = (typeof INTERESTS)[number]
export const INTEREST_LABELS: Record<Interest, string> = {
  general_health_education: 'General health education',
  energy_fatigue:           'Energy and fatigue',
  nutrition:                'Nutrition and eating well',
  sleep:                    'Sleep',
  stress_wellbeing:         'Stress and wellbeing',
  healthy_ageing:           'Healthy ageing',
  families_carers:          'Supporting families and carers',
  not_sure:                 'Not sure yet — advise me',
}

export const TIMINGS = ['within_a_month', 'next_few_months', 'exploring', 'have_a_date'] as const
export type Timing = (typeof TIMINGS)[number]
export const TIMING_LABELS: Record<Timing, string> = {
  within_a_month:   'Within a month',
  next_few_months:  'Next few months',
  exploring:        'Exploring for now',
  have_a_date:      'We have a date',
}

// ─── The four documents ──────────────────────────────────────────────────────
// `storageKey` is a FIXED object key in the private `prospectus` bucket
// (0058). Replacing a document means uploading over that key — no code change,
// no rebuild, no redeploy.

export const PROSPECTUS_DOCUMENTS = [
  'care_residents', 'care_staff', 'workplaces', 'community_faith',
] as const
export type ProspectusDocumentId = (typeof PROSPECTUS_DOCUMENTS)[number]

export interface ProspectusDocumentDef {
  id: ProspectusDocumentId
  title: string
  storageKey: string
}

export const PROSPECTUS_DOCUMENT_DEFS: Record<ProspectusDocumentId, ProspectusDocumentDef> = {
  care_residents:  { id: 'care_residents',  title: 'Natural Intelligence for care settings — sessions for residents', storageKey: 'care-settings-residents.pdf' },
  care_staff:      { id: 'care_staff',      title: 'Natural Intelligence for care settings — sessions for staff',     storageKey: 'care-settings-staff.pdf' },
  workplaces:      { id: 'workplaces',      title: 'Natural Intelligence for workplaces',                             storageKey: 'workplaces.pdf' },
  community_faith: { id: 'community_faith', title: 'Natural Intelligence for community and faith organisations',      storageKey: 'community-and-faith-organisations.pdf' },
}

// ─── Routing ─────────────────────────────────────────────────────────────────

export interface RoutingResult {
  documents: ProspectusDocumentId[]
  /** Covering sentence for the delivery email, explaining what was sent. */
  coveringNote: string
  variant: 'single' | 'dual' | 'other'
  /** True only for "Other": KR/NI reviews the enquiry personally. */
  needsManualReview: boolean
}

const NOTE_SINGLE =
  'We have attached the prospectus that fits what you described.'
const NOTE_DUAL =
  'You said the sessions would be for both residents and staff, so we have included both prospectuses — ' +
  'the two groups get different sessions, so they are set out separately.'
const NOTE_OTHER =
  'We have included our workplaces prospectus as the closest fit. Because your organisation does not fall ' +
  'neatly into one of our usual categories, someone from Natural Intelligence will look at your enquiry ' +
  'personally and come back to you.'

/**
 * Pick the document(s) for an enquiry. Audience only changes the outcome for
 * care settings and schools/colleges; every other organisation type routes on
 * Q1 alone.
 */
export function routeProspectus(
  organisationType: OrganisationType, audience: Audience,
): RoutingResult {
  const single = (doc: ProspectusDocumentId): RoutingResult => ({
    documents: [doc], coveringNote: NOTE_SINGLE, variant: 'single', needsManualReview: false,
  })

  switch (organisationType) {
    case 'care_setting':
      if (audience === 'residents') return single('care_residents')
      if (audience === 'staff')     return single('care_staff')
      return {
        documents: ['care_residents', 'care_staff'],
        coveringNote: NOTE_DUAL, variant: 'dual', needsManualReview: false,
      }

    case 'workplace':
      return single('workplaces')

    case 'school_college':
      // Staff sessions mirror the workplace offer; every other school audience
      // is served by the community and faith organisations prospectus.
      return single(audience === 'staff' ? 'workplaces' : 'community_faith')

    case 'community_faith':
    case 'charity':
      return single('community_faith')

    case 'other':
      return {
        documents: ['workplaces'],
        coveringNote: NOTE_OTHER, variant: 'other', needsManualReview: true,
      }
  }
}

export function documentTitles(ids: ProspectusDocumentId[]): string[] {
  return ids.map((id) => PROSPECTUS_DOCUMENT_DEFS[id].title)
}

// ─── Validation of a submitted enquiry ───────────────────────────────────────

export interface ProspectusEnquiryInput {
  organisationType: OrganisationType
  audience: Audience
  sizeBand: SizeBand
  interests: Interest[]
  timing: Timing
  contactName: string
  organisationName: string
  role: string
  email: string
  phone?: string
  anythingElse?: string
  /** Separate, optional, unticked by default; never required to receive the prospectus. */
  marketingOptIn?: boolean
}

/** Field-level validation errors, keyed by field. Empty object = valid. */
export function validateProspectusEnquiry(
  input: Partial<ProspectusEnquiryInput>,
): Record<string, string> {
  const errors: Record<string, string> = {}
  const req = (v: unknown) => typeof v === 'string' && v.trim().length > 0

  if (!input.organisationType || !ORGANISATION_TYPES.includes(input.organisationType)) {
    errors.organisationType = 'Please tell us what kind of organisation you are.'
  }
  if (!input.audience || !AUDIENCES.includes(input.audience)) {
    errors.audience = 'Please tell us who the sessions would be for.'
  } else if (
    input.organisationType &&
    ORGANISATION_TYPES.includes(input.organisationType) &&
    !audienceOptionsFor(input.organisationType).includes(input.audience)
  ) {
    errors.audience = 'Please choose one of the options listed.'
  }
  if (!input.sizeBand || !SIZE_BANDS.includes(input.sizeBand)) {
    errors.sizeBand = 'Please give us a rough number of people.'
  }
  if (!input.interests?.length) {
    errors.interests = 'Please choose at least one — "Not sure yet" is fine.'
  } else if (input.interests.some((i) => !INTERESTS.includes(i))) {
    errors.interests = 'Please choose from the options listed.'
  }
  if (!input.timing || !TIMINGS.includes(input.timing)) {
    errors.timing = 'Please tell us roughly when you are thinking.'
  }
  if (!req(input.contactName))      errors.contactName = 'Please give us your name.'
  if (!req(input.organisationName)) errors.organisationName = 'Please give us your organisation.'
  if (!req(input.role))             errors.role = 'Please tell us your role.'
  if (!req(input.email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email!.trim())) {
    errors.email = 'Please give us an email address we can send the prospectus to.'
  }
  return errors
}
