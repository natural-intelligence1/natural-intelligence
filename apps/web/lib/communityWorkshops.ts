// ─── apps/web/lib/communityWorkshops.ts ───────────────────────────────────────
// Community workshop CONTENT records for the public /workshops page.
//
// These are Founder-supplied, statically-rendered event entries (no database
// rows, no registration forms, no health-data capture). Event copy is used
// VERBATIM per Founder instruction — do not rewrite, "improve", rename
// practitioners, or alter dates/venues/booking links here without explicit
// Founder direction. UI labels stay in lib/copy.ts; this file holds event
// content data.

import type { EventScheduling } from './workshops/lifecycle'

export interface CommunityPractitioner {
  name: string
  credentials: string[]
  topic: string
  description: string
}

export interface CommunityWorkshop {
  slug: string
  title: string
  presentedBy: string
  tagline: string
  theme: string
  audience: string
  cost: string
  date: string
  time: string
  venueLines: string[]
  venueNote?: string
  status: 'open' | 'coming_soon'
  statusLabel?: string
  intro: string
  practitioners: CommunityPractitioner[]
  practitionersNote?: string
  whatToExpect?: string[]
  learnAbout?: string[]
  connect?: string
  registerLines?: string[]
  booking?: {
    instruction: string
    url: string
    linkLabel: string
    deadline: string
  }
  bookingComingSoon?: string
  closing?: string
  shareNote?: string
  provisionalNote?: string
  poster?: {
    src: string
    width: number
    height: number
    alt: string
  }
  // ── Canonical scheduling fields ─────────────────────────────────────────────
  // Presence of `scheduling` gives an entry a detail page at
  // /workshops/<slug> and a DERIVED lifecycle phase (booking open → closed →
  // past) from these timestamps rather than hard-coded status. Entries
  // without `scheduling` (e.g. date-TBC announcements) stay listing-only.
  scheduling?: EventScheduling
  subtitle?: string
  series?: string
  /** One-line excerpt for event index cards. */
  excerpt?: string
  speaker?: { name: string; title: string }
  /** Verbatim Founder-supplied detail-page body copy. */
  detailCopy?: {
    intro: string[]
    lookAt: string[]
    booking: string[]
  }
  /** Exact page <title> for the event detail route (overrides the template). */
  metaTitle?: string
  /** Exact meta description for the event detail route. */
  metaDescription?: string
}

export const communityWorkshops: CommunityWorkshop[] = [
  {
    slug: 'thriving-naturally-living-well',
    title: 'THRIVING NATURALLY, LIVING WELL',
    presentedBy: 'Natural Intelligence',
    tagline: 'The Signs Are Within You',
    theme: 'Natural • Holistic • Lifestyle Medicine',
    audience: 'Ladies only',
    cost: 'Free event',
    date: 'Wednesday 2 September 2026',
    time: '11:00am – 1:00pm',
    venueLines: ['Ilford Community Centre', '15 Albert Road', 'Ilford IG1 1NG'],
    venueNote: 'opposite the Albert Road Mosque',
    status: 'open',
    intro:
      'Join us for an informative morning exploring practical ways to better understand your body, ' +
      'support your health and make positive choices for the future.',
    practitioners: [
      {
        name: 'DEE SAHOTA',
        credentials: ['Naturopathic Nutritional Therapist', 'Founder of The Nutrition Room'],
        topic: 'Your Grandparents Ate Roti. So Why Is Metabolic Disease Rising?',
        description:
          'Explore how our changing food chain and modern lifestyles may affect gut and metabolic ' +
          'health, the early signals our bodies give us, and why taking a more preventative approach ' +
          'could help us act earlier.',
      },
      {
        name: 'KATHLEEN CORNMELL',
        credentials: ['Naturopathic Nutritional Therapist', 'Phlebotomist'],
        topic: 'Healthy Ageing & Longevity: How to Stay Strong, Sharp and Independent',
        description:
          'Discover practical nutrition and lifestyle strategies to support muscle, bone, energy and ' +
          'brain health, plus simple health checks and steps we can take now to stay healthier and ' +
          'independent as we age.',
      },
    ],
    whatToExpect: ['Expert talks', 'Practical guidance', 'Time for your questions', 'A welcoming space'],
    learnAbout: [
      'Nutrition & lifestyle strategies for metabolic health and healthy ageing',
      'Gut & metabolic health',
      'Inflammation',
      'Muscle, bone & brain health',
      'Longevity & independence',
      'Preventative health checks',
    ],
    connect:
      'Meet like-minded ladies in your community and leave feeling inspired and empowered.',
    registerLines: ['Advanced booking required.', 'Spaces are limited.', 'We look forward to seeing you there.'],
    booking: {
      instruction:
        'Join our dedicated Workshop WhatsApp Group to book your FREE place and receive event updates.',
      url: 'https://chat.whatsapp.com/G15tsCJojvP54JTHJpDEIl?s=cl&p=i&mlu=0',
      linkLabel: 'Join the Workshop WhatsApp Group',
      deadline: 'Deadline to book: Tuesday 1st September.',
    },
    closing: 'Places are limited, so please join early to secure your place.',
    shareNote:
      'Please feel free to share this message and the poster with friends and family who may benefit.',
    poster: {
      src: '/images/workshops/thriving-naturally-2026-09-02.jpeg',
      width: 1023,
      height: 1537,
      alt:
        'Natural Intelligence poster for the free ladies’ health workshop Thriving Naturally, ' +
        'Living Well in Ilford on Wednesday 2 September 2026.',
    },
    scheduling: {
      start:           '2026-09-02T11:00:00+01:00',
      end:             '2026-09-02T13:00:00+01:00',
      timezone:        'Europe/London',
      bookingClosesAt: '2026-09-01T23:59:00+01:00',
      bookingState:    'open',
    },
    series: 'Free Ladies’ Health Workshops — Ilford',
    excerpt:
      'An informative morning exploring practical ways to better understand your body, ' +
      'support your health and make positive choices for the future.',
  },
  {
    slug: 'from-stressed-to-steady-oct-2026',
    title: 'From Stressed to Steady',
    subtitle: 'Understanding stress, and building real resilience',
    series: 'Free Ladies’ Health Workshops — Ilford',
    presentedBy: 'Natural Intelligence',
    tagline: 'The Signs Are Within You',
    theme: 'Nutrition • Lifestyle • Mind-Body Balance • Spiritual Wellbeing',
    audience: 'Ladies only',
    cost: 'Free',
    date: 'Wednesday 7 October 2026',
    time: '10:30am–12:45pm',
    venueLines: ['Ilford Community Centre', '15 Albert Road', 'Ilford IG1 1NG'],
    venueNote: 'opposite the Albert Road Mosque',
    status: 'open',
    intro:
      'Stress touches all of us. Some mornings it sits in the chest before the day has even started.',
    practitioners: [],
    speaker: {
      name: 'Shazia Sohail mANP',
      title: 'Naturopathic Nutritional Therapist & Educator',
    },
    whatToExpect: [
      'Expert talk',
      'Practical guidance',
      'Interactive discussion',
      'Time for your questions',
      'A welcoming space',
    ],
    learnAbout: [
      'What stress does to the body',
      'Nutrition for a calmer mind',
      'Sleep, energy and mood',
      'Building resilience',
      'Reflections from the Quran & Sunnah',
      'Simple tools to take home',
    ],
    connect:
      'Meet like-minded ladies in your community and leave feeling inspired and empowered.',
    booking: {
      instruction:
        'Book your free place by joining the WhatsApp group. Once you join, your place is confirmed.',
      url: 'https://chat.whatsapp.com/G15tsCJojvP54JTHJpDEIl?s=cl&p=i&mlu=0&ilr=4',
      linkLabel: 'Book your free place on WhatsApp',
      deadline:
        'Bookings close Tuesday 6th October. Places are limited — do book early, and bring a friend.',
    },
    detailCopy: {
      intro: [
        'Stress touches all of us. Some mornings it sits in the chest before the day has even started.',
        'Join Shazia Sohail mANP, Naturopathic Nutritional Therapist and Educator, for a warm, ' +
          'practical morning on what stress actually does to the body, and what steadies it again.',
      ],
      lookAt: [
        'What stress does to the body',
        'Nutrition for a calmer mind',
        'Sleep, energy and mood',
        'Building resilience',
        'Reflections from the Quran & Sunnah',
        'Simple tools to take home',
      ],
      booking: [
        'Book your free place by joining the WhatsApp group. Once you join, your place is confirmed.',
        'Bookings close Tuesday 6th October. Places are limited — do book early, and bring a friend.',
      ],
    },
    excerpt: 'Understanding stress, and building real resilience.',
    poster: {
      // Founder-supplied artwork, served as the optimised original WebP
      // (~273KB) — not re-encoded, not redrawn.
      src: '/images/workshops/from-stressed-to-steady-oct-2026.webp',
      width: 1024,
      height: 1536,
      alt: 'From Stressed to Steady — free ladies’ health workshop, Ilford, Wednesday 7 October',
    },
    scheduling: {
      start:           '2026-10-07T10:30:00+01:00',
      end:             '2026-10-07T12:45:00+01:00',
      timezone:        'Europe/London',
      bookingClosesAt: '2026-10-06T23:59:00+01:00',
      bookingState:    'open',
    },
    metaTitle: 'From Stressed to Steady | Natural Intelligence',
    metaDescription:
      'A free morning workshop for ladies in Ilford on understanding stress and building ' +
      'resilience. Wednesday 7 October, 10:30am–12:45pm. Free, booking essential.',
  },
  {
    // Spelling corrected to "Divine Design" per Founder (2026-09-08).
    slug: 'divine-design',
    title: 'Divine Design',
    presentedBy: 'Natural Intelligence',
    tagline: 'The Signs Are Within You',
    theme: 'Natural • Holistic • Lifestyle Medicine',
    audience: 'Ladies only',
    cost: 'Free event — details to be confirmed.',
    date: 'Date TBC',
    time: 'Time TBC',
    venueLines: ['Ilford Community Centre', '15 Albert Road', 'Ilford IG1 1NG'],
    status: 'coming_soon',
    statusLabel: 'Coming soon — details to be confirmed',
    intro:
      'Divine Design is a forthcoming Natural Intelligence community workshop exploring how women ' +
      'can understand their bodies, daily rhythms, lifestyle patterns and wellbeing through a ' +
      'natural-health lens.',
    provisionalNote:
      'This session will focus on education, self-awareness and practical everyday steps. Guest ' +
      'practitioners, full topic details and booking information will be announced once confirmed.',
    practitioners: [],
    practitionersNote: 'Guest practitioners to be announced.',
    bookingComingSoon: 'Booking link coming soon.',
  },
]

/** Verbatim health notice for event DETAIL pages — always fully visible,
 *  never collapsed, truncated or hidden behind disclosure UI. */
export const eventHealthNotice =
  'Health education only — no diagnosis, treatment or individual medical advice. ' +
  'For medical concerns please speak to your GP or NHS 111, and call 999 in an emergency.'

/** Calm education-only boundary shown with the community workshop listings. */
export const workshopBoundaryNotice =
  'These workshops are for public education only. They do not provide diagnosis, treatment, ' +
  'individual medical advice or personalised protocols. Please contact your GP, NHS 111 or 999 ' +
  'in an emergency for medical concerns.'
