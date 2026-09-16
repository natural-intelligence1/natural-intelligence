// ─── Care V2 preview — SYNTHETIC FIXTURES ONLY ────────────────────────────────
// Design-and-structure build for the Intake V2 (client) and Practitioner
// Synopsis V2 previews, now driven by the Intake-to-Synopsis FIELD REGISTRY
// v1 (packages/db/src/intakeV2/fieldRegistry.ts). Every value in this file
// is invented for one fictional person, "Rowan Example". Nothing here
// touches intake_sessions, intake_answers, client_cases,
// case_practitioner_work, ai_summaries, review packs or any real record.
//
// ┌─ INTEGRATION TODO (SEPARATE, LATER TASK — DO NOT WIRE HERE) ──────────────┐
// │ The live Synopsis V2 will consume real client health data. Its live-data │
// │ version MUST be built on the approved Sprint 3 data-access model:        │
// │ consent-at-start enforcement (hasAllConsents, fail-closed), the          │
// │ de-identification / review-pack boundary, and the client_cases access    │
// │ controls — and live rendering of real cases requires clinician sign-off  │
// │ and KR authorisation. Until that task is authorised, these previews read │
// │ this file and nothing else.                                              │
// └───────────────────────────────────────────────────────────────────────────┘
//
// FIREWALL: fixtures carry facts a client could state and facts a
// practitioner could record. No diagnosis by NI, no inference, no ranking,
// no scoring, no triage and no recommendation appears anywhere.

import {
  buildCaseSnapshot, deriveV2SafetyReviewItems,
  type V2Provenance, type V2SafetyReviewItem,
} from '@natural-intelligence/db/intakeV2'

// Canonical provenance states from the registry (Field Mapping v1).
export type Provenance = V2Provenance
export type { V2SafetyReviewItem as SafetyReviewItem }

/** A fact with its audit trail. The client's original wording is never
 *  overwritten: a correction sits BESIDE it with actor and time. */
export interface Sourced<T = string> {
  value: T
  provenance: Provenance
  correction?: T
  correctedBy?: string
  correctedAt?: string
}

export const s = <T,>(value: T, provenance: Provenance = 'client_reported'): Sourced<T> =>
  ({ value, provenance })

// ─── Fixture shapes (mirror the synopsis sections one-to-one) ────────────────

export interface FixtureConcern {
  title: string
  ownWords: Sourced
  duration: Sourced
  course: Sourced
  location: Sourced
  character: Sourced
  frequency: Sourced
  betterWith: Sourced
  worseWith: Sourced
  alreadyTried: Sourced
  relatedDiagnosis: Sourced
  desiredOutcome: Sourced
}

export interface FixtureDiagnosis {
  condition: Sourced
  diagnosedBy: Sourced
  approxDate: Sourced
  status: Sourced
  testsDone: Sourced
  testsPending: Sourced
  referralStatus: Sourced
}

export interface FixtureTimelineMoment {
  when: string
  event: string
  category: 'health' | 'life'
  keyMoment: boolean
  source: 'typed' | 'suggested-confirmed'
  note?: string
}

export interface FixtureMedication {
  name: Sourced
  brand?: Sourced
  doseAsWritten: Sourced
  frequency: Sourced
  reason: Sourced
  suggestedBy: Sourced
  status: 'current' | 'past'
  reasonStopped?: Sourced
  effects?: Sourced
}

export interface FixtureRelative { relative: string; notes: Sourced }

export interface FixtureSystemAnswer {
  questionId: string
  label: string
  answer: Sourced<string[] | string>
  capturedAt: string
}

export interface FixtureSystem { system: string; answers: FixtureSystemAnswer[] }

export interface FixtureObservation {
  area: 'Nails' | 'Tongue' | 'Face & eyes' | 'Skin' | 'Build & distribution'
  note: Sourced | null // null = not yet recorded at consultation
}

export interface FixtureCase {
  banner: string
  client: {
    fullName: string; preferredName: string; dob: string; pathway: string
    occupation: Sourced; gp: Sourced; gpContactPermission: Sourced
    intakeCompleted: string; chaptersCompleted: string
  }
  careInPlace: {
    specialists: { name: Sourced; specialty: Sourced; status: Sourced }[]
    otherPractitioners: { name: Sourced; discipline: Sourced }[]
    pendingReferrals: { description: Sourced; status: Sourced }[]
    pendingInvestigations: { description: Sourced; status: Sourced }[]
  }
  concerns: FixtureConcern[]
  diagnoses: FixtureDiagnosis[]
  timeline: FixtureTimelineMoment[]
  medications: FixtureMedication[]
  supplements: FixtureMedication[]
  family: FixtureRelative[]
  earlyLife: { label: string; fact: Sourced }[]
  systems: FixtureSystem[]
  observations: FixtureObservation[]
  food: {
    mode: Sourced
    goodDay: Sourced; averageDay: Sourced; difficultDay: Sourced
    kitchenReality: Sourced; drinks: Sourced; water: Sourced; caffeine: Sourced
    reactions: Sourced; barriers: Sourced
  }
  lifestyle: {
    work: Sourced; movement: Sourced; stressLoad: Sourced; coping: Sourced
    caring: Sourced; homeEnvironment: Sourced; faithPractice: Sourced
  }
}

// ─── The one synthetic case ───────────────────────────────────────────────────

export const FIXTURE_CASE: FixtureCase = {
  banner: 'Synthetic preview data — “Rowan Example” is fictional. No real client, no live records.',
  client: {
    fullName: 'Rowan Example',
    preferredName: 'Rowan',
    dob: '1985-03-14',
    pathway: 'Practitioner-led care',
    occupation: s('Primary school teacher, four days a week'),
    gp: s('The Example Surgery, 1 Sample Street, Exampleton'),
    gpContactPermission: s('Yes — happy for my practitioner to contact my GP if needed'),
    intakeCompleted: '2026-09-10',
    chaptersCompleted: '15 of 16 chapters (family history partly skipped for now)',
  },

  careInPlace: {
    specialists: [
      { name: s('Not recalled — clinic letter to follow'), specialty: s('Gastroenterology'), status: s('Seen once, 2025') },
    ],
    otherPractitioners: [
      { name: s('A local massage therapist'), discipline: s('Massage') },
    ],
    pendingReferrals: [
      { description: s('GP mentioned a possible dietitian referral'), status: s('Client unsure whether it was sent') },
    ],
    pendingInvestigations: [
      { description: s('Repeat blood test booked at the surgery'), status: s('Booked for next month') },
    ],
  },

  concerns: [
    {
      title: 'Bloating after meals',
      ownWords: s('I feel really swollen and uncomfortable after most evening meals — like a balloon. It has slowly become an everyday thing.'),
      duration: s('Around two years'),
      course: s('Client describes it as gradually more frequent over the last six months'),
      location: s('Whole tummy, worst low down'),
      character: s('“Pressure, stretched, sometimes crampy”'),
      frequency: s('Most evenings; rarely at breakfast'),
      betterWith: s('Smaller meals, walking after dinner, days off work'),
      worseWith: s('Large or late dinners, bread-heavy days, stressful weeks'),
      alreadyTried: s('Peppermint tea, cutting bread for a fortnight, an over-the-counter product from the pharmacy'),
      relatedDiagnosis: s('Reported diagnosis: “IBS”, diagnosed by GP (as reported by the client, 2025)'),
      desiredOutcome: s('“To eat dinner with my family without dreading the evening.”'),
    },
    {
      title: 'Tiredness through the afternoon',
      ownWords: s('By 3pm I am flat. Coffee helps for an hour and then I crash harder.'),
      duration: s('About a year'),
      course: s('Client describes it as up and down — worse in term time, easier in holidays'),
      location: s('“Whole body — heavy legs, foggy head”'),
      character: s('“Flat, drained, foggy”'),
      frequency: s('Most weekday afternoons'),
      betterWith: s('Early nights, holidays, mornings outdoors'),
      worseWith: s('Marking evenings, skipped lunches, poor sleep'),
      alreadyTried: s('Earlier bedtime for a month; a multivitamin'),
      relatedDiagnosis: s('None reported'),
      desiredOutcome: s('“Energy for my own children after work, not just my class.”'),
    },
  ],

  diagnoses: [
    {
      condition: s('“IBS” — as reported by the client'),
      diagnosedBy: s('GP, as reported'),
      approxDate: s('2025'),
      status: s('“The GP said to keep an eye on it” (client’s words)'),
      testsDone: s('Coeliac blood test 2025 — client recalls it was “fine”'),
      testsPending: s('Repeat bloods booked at the surgery'),
      referralStatus: s('Possible dietitian referral mentioned; client unsure if sent'),
    },
    {
      condition: s('Hay fever — as reported by the client'),
      diagnosedBy: s('Pharmacist, as reported'),
      approxDate: s('Since teens'),
      status: s('Summer months only'),
      testsDone: s('None recalled'),
      testsPending: s('None'),
      referralStatus: s('None'),
    },
  ],

  timeline: [
    { when: '1990 (age 5)', event: 'Recurrent ear infections, several antibiotic courses', category: 'health', keyMoment: false, source: 'typed' },
    { when: '2003 (age 18)', event: 'Moved away from home for university', category: 'life', keyMoment: false, source: 'typed' },
    { when: '2016', event: 'First teaching post — long commuting year', category: 'life', keyMoment: false, source: 'typed' },
    { when: '2019', event: 'Glandular fever — six weeks off work', category: 'health', keyMoment: true, source: 'typed', note: 'Client marks this as the point “my energy never fully came back”.' },
    { when: '2022', event: 'House move and bereavement in the same term', category: 'life', keyMoment: true, source: 'typed', note: 'Client links the start of the bloating to this period.' },
    { when: '2025', event: '“IBS” reported diagnosis by GP', category: 'health', keyMoment: false, source: 'suggested-confirmed', note: 'Suggested from the client’s own diagnosis entry; confirmed by the client before submission.' },
    { when: '2026', event: 'Decided to seek naturopathic support', category: 'life', keyMoment: false, source: 'typed' },
  ],

  medications: [
    {
      name: s('Cetirizine (hay fever)'),
      doseAsWritten: s('10 mg, one tablet daily in summer months — as written on the pack'),
      frequency: s('Daily in summer'),
      reason: s('Hay fever'),
      suggestedBy: s('Pharmacist'),
      status: 'current',
      effects: s('“Takes the edge off; a bit drowsy the first days.”'),
    },
    {
      name: s('Omeprazole'),
      doseAsWritten: s('20 mg daily — as written on the prescription'),
      frequency: s('Daily'),
      reason: s('“For the bloating and burping” (client’s words)'),
      suggestedBy: s('GP'),
      status: 'past',
      reasonStopped: s('Client stopped it in 2025 with the GP: “it did not seem to change anything for me”.'),
    },
  ],

  supplements: [
    {
      name: s('Vitamin D drops'),
      brand: s('Own-brand from the supermarket, as written'),
      doseAsWritten: s('1000 IU daily, as written on the bottle'),
      frequency: s('Daily'),
      reason: s('Winter blood test at the GP'),
      suggestedBy: s('GP'),
      status: 'current',
    },
    {
      name: { value: 'Magnesium (client unsure which form)', provenance: 'corrected', correction: 'Magnesium citrate 200 mg — confirmed from the client’s photo of the label', correctedBy: 'Practitioner (preview fixture)', correctedAt: '2026-09-12' },
      brand: s('Not recalled'),
      doseAsWritten: s('“Two capsules at night” — as the client wrote it'),
      frequency: s('Nightly'),
      reason: s('“A friend said it might help sleep.”'),
      suggestedBy: s('A friend'),
      status: 'current',
    },
    {
      name: s('A probiotic blend (brand not recalled)'),
      doseAsWritten: s('Client does not recall the dose'),
      frequency: s('Was daily'),
      reason: s('“For digestion”'),
      suggestedBy: s('Health-food shop'),
      status: 'past',
      reasonStopped: s('“Ran out and did not notice a difference, so I did not re-order.”'),
    },
  ],

  family: [
    { relative: 'Mother', notes: s('Underactive thyroid diagnosed by her GP in her fifties; ongoing prescription from her doctor') },
    { relative: 'Father', notes: s('High blood pressure noted by his GP; otherwise well at 70') },
    { relative: 'Maternal grandmother', notes: s('Type 2 diabetes diagnosed by her doctor, late in life') },
    { relative: 'Sibling (younger brother)', notes: { value: '', provenance: 'missing' } },
  ],

  earlyLife: [
    { label: 'Childhood illnesses', fact: s('Recurrent ear infections to about age seven') },
    { label: 'Antibiotic history, as recalled', fact: s('“Several courses as a child; a long course for acne at seventeen.”') },
    { label: 'Surgery', fact: s('Grommets, around age six') },
    { label: 'Allergies, as reported', fact: s('Hay fever; no food allergies known to the client') },
    { label: 'Birth details', fact: { value: '', provenance: 'missing' } },
  ],

  // System answers reuse REAL registry question ids so the safety block is
  // derived from the registry's clinician-owned safety_capture metadata.
  systems: [
    {
      system: 'Digestion',
      answers: [
        {
          questionId: 'v2.digestion.noticed',
          label: 'Anything noticed with digestion',
          answer: s(['Bloating', 'A change in your usual bowel habit']),
          capturedAt: '2026-09-10T19:42:00Z',
        },
      ],
    },
    {
      system: 'Energy, hormones & metabolism',
      answers: [
        {
          questionId: 'v2.energy.noticed',
          label: 'Anything noticed with energy',
          answer: s(['Energy that crashes at certain times of day', 'Feeling unusually cold']),
          capturedAt: '2026-09-10T19:48:00Z',
        },
      ],
    },
    {
      system: 'Sleep',
      answers: [
        {
          questionId: 'v2.sleep.noticed',
          label: 'Anything noticed about sleep',
          answer: { value: ['Waking very early'], provenance: 'practitioner_verified' },
          capturedAt: '2026-09-10T19:45:00Z',
        },
      ],
    },
  ],

  observations: [
    { area: 'Nails', note: s('Practitioner note (fixture): vertical ridging both thumbs; no other change recorded.') },
    { area: 'Tongue', note: null },
    { area: 'Face & eyes', note: null },
    { area: 'Skin', note: null },
    { area: 'Build & distribution', note: null },
  ],

  food: {
    mode: s('Chose the good / average / difficult-day pattern (not a diary)'),
    goodDay: s('Porridge with berries; leftover soup lunch; fish, potatoes and greens; fruit after dinner'),
    averageDay: s('Toast grabbed on the way out; meal-deal sandwich; pasta with a jar sauce; biscuits with evening marking'),
    difficultDay: s('No breakfast; staff-room cake; takeaway pizza late; wine on Fridays'),
    kitchenReality: s('Cooks 3–4 evenings a week; partner cooks weekends; freezer meals in busy terms; one decent pan, no food processor'),
    drinks: s('2–3 coffees before noon; herbal tea after lunch'),
    water: s('“When I remember — maybe three glasses.”'),
    caffeine: s('2–3 coffees, all before noon'),
    reactions: s('“Bread days feel worse; onions maybe.”'),
    barriers: s('Marking evenings, budget in the last week of the month, children’s different tastes'),
  },

  lifestyle: {
    work: s('Term-time intensity with marking most evenings; holidays genuinely restful'),
    movement: s('Walks the school run daily; used to swim twice a week, lapsed last year'),
    stressLoad: s('Client rates their own load as “high in term time, low in holidays” — their words'),
    coping: s('Baths, reading, phone scrolling “more than I’d like”'),
    caring: s('Two children, 8 and 11; no other caring responsibilities'),
    homeEnvironment: s('1930s house; some damp in the bathroom corner'),
    faithPractice: s('Attends church most Sundays; no food or fasting practices the practitioner needs to accommodate'),
  },
}

// ─── Derived, registry-driven pieces ─────────────────────────────────────────

/** Flat answer list for safety derivation (canonical function from the db
 *  registry — code invents no flags). */
export const FIXTURE_SYSTEM_ANSWERS = FIXTURE_CASE.systems.flatMap((sys) =>
  sys.answers.map((a) => ({ questionId: a.questionId, value: a.answer.value, capturedAt: a.capturedAt })))

export const FIXTURE_SAFETY_ITEMS: V2SafetyReviewItem[] =
  deriveV2SafetyReviewItems(FIXTURE_SYSTEM_ANSWERS)

/** The frozen case snapshot for the synthetic case, built with the pure
 *  builder from the registry package (no persistence, no migration). */
export const FIXTURE_SNAPSHOT = buildCaseSnapshot({
  accountProfile: {
    legalName: FIXTURE_CASE.client.fullName,
    preferredName: FIXTURE_CASE.client.preferredName,
    dob: FIXTURE_CASE.client.dob,
    // Operational contact fields exist on the account but are excluded from
    // the practitioner-facing snapshot by the builder itself:
    email: 'rowan@example.test', phone: '07000 000000', address: '1 Sample Street, Exampleton',
  },
  careProfile: {
    sex: 'female', reproductivePathway: 'Periods, cycles or menopause questions',
    household: 'Partner and two children', children: 'Two (8 and 11)',
    occupation: 'Primary school teacher', heightCm: 165, weightKg: 62,
  },
  intakeAnswers: { 'intake.concerns[0].own_words': FIXTURE_CASE.concerns[0].ownWords.value },
  submittedAt: '2026-09-10T19:55:00Z',
})
