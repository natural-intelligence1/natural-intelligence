// ─── Care V2 preview — SYNTHETIC FIXTURES ONLY ────────────────────────────────
// Design-and-structure build for the Intake V2 (client) and Practitioner
// Synopsis V2 previews. Every value in this file is invented for one
// fictional person, "Rowan Example". Nothing here touches intake_sessions,
// intake_answers, client_cases, ai_summaries or any real record.
//
// ┌─ INTEGRATION TODO (SEPARATE, LATER TASK — DO NOT WIRE HERE) ──────────────┐
// │ The live Synopsis V2 will consume real client health data. Its live-data │
// │ version MUST be built on the approved Sprint 3 data-access model:        │
// │ consent-at-start enforcement (hasAllConsents, fail-closed), the          │
// │ de-identification / review-pack boundary, and the client_cases access    │
// │ controls — and requires clinician sign-off before any real case is       │
// │ rendered. Until that task is authorised, these previews read this file   │
// │ and nothing else.                                                        │
// └───────────────────────────────────────────────────────────────────────────┘
//
// FIREWALL: fixtures carry facts a client could state and facts a
// practitioner could record. No diagnosis, inference, root cause, risk
// score, likelihood, triage or treatment recommendation appears anywhere.

import { V2_QUESTIONS } from '@natural-intelligence/db/intakeV2'

// ─── Provenance (audit trail on every claim) ─────────────────────────────────

export type Provenance = 'client' | 'verified' | 'corrected' | 'missing'

/** A fact with its audit trail. The client's original wording is never
 *  overwritten: a correction sits BESIDE it. */
export interface Sourced<T = string> {
  value: T
  provenance: Provenance
  /** Present only when provenance === 'corrected'. */
  correction?: T
  correctedBy?: string
  correctedAt?: string
}

export const s = <T,>(value: T, provenance: Provenance = 'client'): Sourced<T> =>
  ({ value, provenance })

// ─── Fixture shapes (mirror the synopsis sections one-to-one) ────────────────

export interface FixtureConcern {
  title: string
  ownWords: Sourced
  onset: Sourced
  /** Client-described course over time — their words, never a trajectory judgement. */
  course: Sourced
  betterWith: Sourced
  worseWith: Sourced
  impact: Sourced
}

export interface FixtureTimelineMoment {
  when: string
  event: string
  category: 'health' | 'life'
  keyMoment: boolean
  note?: string
}

export interface FixtureMedication {
  name: Sourced
  doseAsWritten: Sourced
  suggestedBy: Sourced
  status: 'current' | 'past'
  reasonStopped?: Sourced
}

export interface FixtureRelative {
  relative: string
  notes: Sourced
}

export interface FixtureSystemAnswer {
  questionId: string
  label: string
  answer: Sourced<string[] | string>
}

export interface FixtureSystem {
  system: string
  answers: FixtureSystemAnswer[]
}

export interface FixtureObservation {
  area: 'Nails' | 'Tongue' | 'Face' | 'Distribution'
  note: Sourced | null // null = not yet recorded at consultation
}

export interface FixtureCase {
  banner: string
  client: {
    fullName: string; preferredName: string; dob: string; pathway: string
    occupation: Sourced; gp: Sourced; gpContactPermission: Sourced
    intakeCompleted: string; chaptersCompleted: string
  }
  concerns: FixtureConcern[]
  timeline: FixtureTimelineMoment[]
  medications: FixtureMedication[]
  supplements: FixtureMedication[]
  family: FixtureRelative[]
  systems: FixtureSystem[]
  observations: FixtureObservation[]
  food: {
    goodDay: Sourced; averageDay: Sourced; difficultDay: Sourced
    kitchenReality: Sourced; drinks: Sourced
  }
  lifestyle: { movement: Sourced; work: Sourced; faithPractice: Sourced; connection: Sourced }
}

// ─── Safety derivation — clinician-owned metadata, never invented here ───────
// Which answers are safety-relevant is defined ONCE, in the V2 question
// registry (samd: 'safety_capture' + enumerated safetyOptions — the
// clinician-reviewed flag set). This function only INTERSECTS a fixture
// answer with that metadata; the preview never decides relevance itself,
// and it renders the RAW reported answer for the practitioner to
// adjudicate — no urgency label, rank, referral or triage is produced.

export interface SafetyReviewItem {
  questionId: string
  questionLabel: string
  reportedAnswer: string[]
  flaggedOptions: string[]
}

export function deriveSafetyReviewItems(
  answers: { questionId: string; value: string[] | string }[],
): SafetyReviewItem[] {
  const items: SafetyReviewItem[] = []
  for (const entry of answers) {
    const question = V2_QUESTIONS.find((q) => q.id === entry.questionId)
    if (!question || question.samd !== 'safety_capture' || !question.safetyOptions) continue
    const reported = Array.isArray(entry.value) ? entry.value : [entry.value]
    const flagged = reported.filter((option) => question.safetyOptions!.includes(option))
    if (flagged.length > 0) {
      items.push({
        questionId: question.id,
        questionLabel: question.label,
        reportedAnswer: reported,
        flaggedOptions: flagged,
      })
    }
  }
  return items
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
    chaptersCompleted: '17 of 19 chapters (family health and food diary skipped for now)',
  },

  concerns: [
    {
      title: 'Bloating after meals',
      ownWords: s('I feel really swollen and uncomfortable after most evening meals — like a balloon. It has slowly become an everyday thing.'),
      onset: s('Started around two years ago, after a very stressful school year'),
      course: s('Client describes it as gradually more frequent over the last six months'),
      betterWith: s('Smaller meals, walking after dinner, days off work'),
      worseWith: s('Large or late dinners, bread-heavy days, stressful weeks'),
      impact: s('Avoids eating out; sleep is disturbed on bad evenings'),
    },
    {
      title: 'Tiredness through the afternoon',
      ownWords: s('By 3pm I am flat. Coffee helps for an hour and then I crash harder.'),
      onset: s('Client first noticed it about a year ago'),
      course: s('Client describes it as up and down — worse in term time, easier in holidays'),
      betterWith: s('Early nights, holidays, mornings outdoors'),
      worseWith: s('Marking evenings, skipped lunches, poor sleep'),
      impact: s('Stopped evening exercise classes; weekends spent recovering'),
    },
  ],

  timeline: [
    { when: '1990 (age 5)', event: 'Recurrent ear infections, several antibiotic courses', category: 'health', keyMoment: false },
    { when: '2003 (age 18)', event: 'Moved away from home for university', category: 'life', keyMoment: false },
    { when: '2016', event: 'First teaching post — long commuting year', category: 'life', keyMoment: false },
    { when: '2019', event: 'Glandular fever — six weeks off work', category: 'health', keyMoment: true, note: 'Client marks this as the point “my energy never fully came back”.' },
    { when: '2022', event: 'House move and bereavement in the same term', category: 'life', keyMoment: true, note: 'Client links the start of the bloating to this period.' },
    { when: '2024', event: 'Started waking at 3am several nights a week', category: 'health', keyMoment: false },
    { when: '2026', event: 'Decided to seek naturopathic support', category: 'life', keyMoment: false },
  ],

  medications: [
    {
      name: s('Cetirizine (hay fever)'),
      doseAsWritten: s('10 mg, one tablet daily in summer months — as written on the pack'),
      suggestedBy: s('Pharmacist'),
      status: 'current',
    },
    {
      name: s('Omeprazole'),
      doseAsWritten: s('20 mg daily — as written on the prescription'),
      suggestedBy: s('GP'),
      status: 'past',
      reasonStopped: s('Client stopped it in 2025 with the GP: “it did not seem to change anything for me”.'),
    },
  ],

  supplements: [
    {
      name: s('Vitamin D drops'),
      doseAsWritten: s('1000 IU daily, as written on the bottle'),
      suggestedBy: s('GP, after a winter blood test'),
      status: 'current',
    },
    {
      name: { value: 'Magnesium (client unsure which form)', provenance: 'corrected', correction: 'Magnesium citrate 200 mg — confirmed from the client’s photo of the label', correctedBy: 'Practitioner (preview fixture)', correctedAt: '2026-09-12' },
      doseAsWritten: s('“Two capsules at night” — as the client wrote it'),
      suggestedBy: s('A friend'),
      status: 'current',
    },
    {
      name: s('A probiotic blend (brand not recalled)'),
      doseAsWritten: s('Client does not recall the dose'),
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

  // System answers reuse REAL registry question ids so the safety block can
  // be derived from the registry's clinician-owned safety_capture metadata.
  systems: [
    {
      system: 'Digestion',
      answers: [
        {
          questionId: 'v2.digestion.noticed',
          label: 'Anything you have noticed with digestion',
          answer: s(['Bloating', 'A change in your usual bowel habit']),
        },
      ],
    },
    {
      system: 'Energy, hormones & metabolism',
      answers: [
        {
          questionId: 'v2.energy.noticed',
          label: 'Anything you have noticed with energy',
          answer: s(['Energy that crashes at certain times of day', 'Feeling unusually cold']),
        },
      ],
    },
    {
      system: 'Sleep',
      answers: [
        {
          questionId: 'v2.sleep.noticed',
          label: 'Anything you have noticed with sleep',
          answer: { value: ['Waking very early'], provenance: 'verified' },
        },
      ],
    },
  ],

  observations: [
    { area: 'Nails', note: s('Practitioner note (fixture): vertical ridging both thumbs; no other change recorded.') },
    { area: 'Tongue', note: null },
    { area: 'Face', note: null },
    { area: 'Distribution', note: null },
  ],

  food: {
    goodDay: s('Porridge with berries; leftover soup lunch; fish, potatoes and greens; fruit after dinner'),
    averageDay: s('Toast grabbed on the way out; meal-deal sandwich; pasta with a jar sauce; biscuits with evening marking'),
    difficultDay: s('No breakfast; staff-room cake; takeaway pizza late; wine on Fridays'),
    kitchenReality: s('Cooks 3–4 evenings a week; partner cooks weekends; freezer meals in busy terms'),
    drinks: s('2–3 coffees before noon; tap water “when I remember”; wine most Fridays and Saturdays'),
  },

  lifestyle: {
    movement: s('Walks the school run daily; used to swim twice a week, lapsed last year'),
    work: s('Term-time intensity with marking most evenings; holidays genuinely restful'),
    faithPractice: s('Attends church most Sundays; describes it as a steady anchor'),
    connection: s('Close to sister; misses the swimming group friendships'),
  },
}

/** Flat answer list for safety derivation. */
export const FIXTURE_SYSTEM_ANSWERS = FIXTURE_CASE.systems.flatMap((sys) =>
  sys.answers.map((a) => ({ questionId: a.questionId, value: a.answer.value })))
