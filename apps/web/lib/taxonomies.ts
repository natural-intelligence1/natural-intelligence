/**
 * Natural Intelligence — Practitioner Taxonomy Data
 *
 * Structured option arrays for application form selectors.
 * These are used in the multi-step application form, directory filters,
 * and admin referral matching panel.
 */

export const AREA_TAGS = [
  'Nutrition & dietary therapy',
  'Herbal medicine',
  'Naturopathy',
  'Functional medicine',
  'Acupuncture & TCM',
  'Homeopathy',
  'Osteopathy',
  'Chiropractic care',
  'Reflexology',
  'Aromatherapy',
  'Yoga & movement therapy',
  'Mindfulness & meditation',
  'Psychotherapy & counselling',
  'Life coaching',
  'Breathwork',
  'Energy healing',
  'Gut & digestive health',
  'Hormonal health',
  'Chronic fatigue & ME',
] as const

export type AreaTag = (typeof AREA_TAGS)[number]

export const PRIMARY_PROFESSIONS = [
  'Nutritionist / Nutritional therapist',
  'Naturopath',
  'Medical herbalist',
  'Functional medicine practitioner',
  'Acupuncturist',
  'Homeopath',
  'Osteopath',
  'Chiropractor',
  'Reflexologist',
  'Aromatherapist',
  'Yoga therapist',
  'Psychotherapist / Counsellor',
  'Life coach',
  'Other',
] as const

export type PrimaryProfession = (typeof PRIMARY_PROFESSIONS)[number]

export const CLIENT_TYPES = [
  'Adults (18+)',
  'Children & young people',
  'Older adults (65+)',
  'Pregnant & postpartum',
  'Couples',
  'Families',
  'LGBTQ+ individuals',
  'Neurodiverse clients',
  'People with chronic illness',
] as const

export type ClientType = (typeof CLIENT_TYPES)[number]

export const COLLABORATION_TYPES = [
  'Co-referral',
  'Case discussion',
  'Peer supervision',
  'Research & writing',
  'Group programmes',
  'Mentorship',
] as const

export type CollaborationType = (typeof COLLABORATION_TYPES)[number]

export const EXPERIENCE_RANGES: { value: string; label: string }[] = [
  { value: '0-1',  label: 'Less than 1 year' },
  { value: '1-3',  label: '1–3 years' },
  { value: '3-5',  label: '3–5 years' },
  { value: '5-10', label: '5–10 years' },
  { value: '10+',  label: '10 or more years' },
]

export const DELIVERY_MODES: { value: string; label: string }[] = [
  { value: 'online',    label: 'Online only' },
  { value: 'in_person', label: 'In person only' },
  { value: 'both',      label: 'Online & in person' },
]

export const REFERRAL_CONTACT_METHODS: { value: string; label: string }[] = [
  { value: 'email',            label: 'Email' },
  { value: 'website',          label: 'Website contact form' },
  { value: 'platform_message', label: 'Platform message' },
]
