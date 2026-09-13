// ─── packages/db/src/intakeV2/registry.ts ─────────────────────────────────────
// NI Pre-Consultation Health Intake (V2) — the question registry.
//
// EVERY question, label, help line and option below is ORIGINAL NI wording,
// written fresh for a lay reader in NI's voice. Nothing is sourced from any
// external case-history form, college material, professional-body template
// or branded document. Clinical domains and everyday symptom vocabulary are
// common professional ground; the phrasing is ours.
//
// Registry rules (tested in registry.test.ts):
//   • ids are unique and stable; never renumbered or reused
//   • every question carries section, screen, type, servicePath, source,
//     practitioner-view mapping, summary mapping and a SaMD classification
//   • user-facing copy contains no interpretive/claims language
//   • safety-relevant options are enumerated in safetyOptions — captured and
//     marked for practitioner review, never triaged to the client.

import type { V2QuestionDef, V2SectionDef, V2SectionId } from './types'

// ─── Shared option sets ───────────────────────────────────────────────────────

export const FREQUENCY_OPTIONS = [
  'Rarely or never', 'A few times a month', 'A few times a week', 'Most days', 'Every day',
] as const

const YESNO_UNSURE = ['Yes', 'No', 'Not sure']

export const BODY_SYSTEMS = [
  'Digestion',
  'Head, nerves & senses',
  'Sleep',
  'Mood & stress',
  'Energy, hormones & metabolism',
  'Immune system & allergies',
  'Breathing, sinuses, throat & ears',
  'Urinary',
  'Heart & circulation',
  'Muscles & joints',
  'Skin, hair & nails',
  'Reproductive health',
] as const

// ─── Sections (the health story path) ────────────────────────────────────────

export const V2_SECTIONS: V2SectionDef[] = [
  { id: 'arrival',         title: 'Arriving',                    estimateMinutes: 1, intro: 'A gentle start — there are no wrong answers here.' },
  { id: 'about',           title: 'About you',                   estimateMinutes: 1 },
  { id: 'care_in_place',   title: 'Care already in place',       estimateMinutes: 1 },
  { id: 'concerns',        title: 'What brings you here',        estimateMinutes: 2, intro: 'Your own words first. Lists come later.' },
  { id: 'medical_history', title: 'Your medical history',        estimateMinutes: 2 },
  { id: 'medication',      title: 'Medication',                  estimateMinutes: 1 },
  { id: 'supplements',     title: 'Supplements & natural remedies', estimateMinutes: 1 },
  { id: 'family',          title: 'Family health',               estimateMinutes: 1, optional: true },
  { id: 'early_life',      title: 'Early life & past health',    estimateMinutes: 1, optional: true },
  { id: 'systems_overview', title: 'A quick check across your body', estimateMinutes: 1 },
  { id: 'digestion',       title: 'Digestion',                   estimateMinutes: 1, showIf: { questionId: 'v2.systems.noticed', includesAny: ['Digestion'] } },
  { id: 'nervous',         title: 'Head, nerves & senses',       estimateMinutes: 1, showIf: { questionId: 'v2.systems.noticed', includesAny: ['Head, nerves & senses'] } },
  { id: 'sleep',           title: 'Sleep',                       estimateMinutes: 1, showIf: { questionId: 'v2.systems.noticed', includesAny: ['Sleep'] } },
  { id: 'mood_stress',     title: 'Mood & stress',               estimateMinutes: 1, showIf: { questionId: 'v2.systems.noticed', includesAny: ['Mood & stress'] } },
  { id: 'energy_metabolic', title: 'Energy, hormones & metabolism', estimateMinutes: 1, showIf: { questionId: 'v2.systems.noticed', includesAny: ['Energy, hormones & metabolism'] } },
  { id: 'reproductive',    title: 'Reproductive health',         estimateMinutes: 2, showIf: { questionId: 'v2.systems.noticed', includesAny: ['Reproductive health'] }, optional: true },
  { id: 'immune',          title: 'Immune system & allergies',   estimateMinutes: 1, showIf: { questionId: 'v2.systems.noticed', includesAny: ['Immune system & allergies'] } },
  { id: 'breathing',       title: 'Breathing, sinuses, throat & ears', estimateMinutes: 1, showIf: { questionId: 'v2.systems.noticed', includesAny: ['Breathing, sinuses, throat & ears'] } },
  { id: 'urinary',         title: 'Urinary',                     estimateMinutes: 1, showIf: { questionId: 'v2.systems.noticed', includesAny: ['Urinary'] } },
  { id: 'heart',           title: 'Heart & circulation',         estimateMinutes: 1, showIf: { questionId: 'v2.systems.noticed', includesAny: ['Heart & circulation'] } },
  { id: 'muscles_joints',  title: 'Muscles & joints',            estimateMinutes: 1, showIf: { questionId: 'v2.systems.noticed', includesAny: ['Muscles & joints'] } },
  { id: 'skin',            title: 'Skin, hair & nails',          estimateMinutes: 1, showIf: { questionId: 'v2.systems.noticed', includesAny: ['Skin, hair & nails'] } },
  { id: 'food_diary',      title: 'What you actually eat',       estimateMinutes: 2, optional: true },
  { id: 'food_frequency',  title: 'How often foods appear',      estimateMinutes: 1 },
  { id: 'eating_habits',   title: 'Eating habits & your kitchen', estimateMinutes: 1 },
  { id: 'drinks',          title: 'Drinks',                      estimateMinutes: 1 },
  { id: 'lifestyle',       title: 'Life & routine',              estimateMinutes: 1 },
  { id: 'timeline',        title: 'Your timeline',               estimateMinutes: 1, optional: true },
  { id: 'review',          title: 'Read it back',                estimateMinutes: 1 },
]

// ─── Question builder helpers ─────────────────────────────────────────────────

type QIn = Omit<V2QuestionDef, 'version' | 'servicePath' | 'source' | 'samd' | 'practitionerViewSection' | 'summarySection'> &
  Partial<Pick<V2QuestionDef, 'servicePath' | 'source' | 'samd' | 'practitionerViewSection' | 'summarySection'>>

function q(def: QIn): V2QuestionDef {
  return {
    version: 1,
    servicePath: 'all',
    source: 'client',
    samd: 'collect_only',
    practitionerViewSection: def.practitionerViewSection ?? def.section,
    summarySection: def.summarySection ?? def.section,
    ...def,
  }
}

// ─── The registry ─────────────────────────────────────────────────────────────

export const V2_QUESTIONS: V2QuestionDef[] = [

  // ── 1. Arrival ──────────────────────────────────────────────────────────────
  q({ id: 'v2.arrival.feeling', section: 'arrival', screen: 1, type: 'multichip',
      label: 'How are you feeling about your health, arriving here today?',
      help: 'Choose anything that fits, or say it in your own way below.',
      options: ['Hopeful', 'Tired of not knowing', 'Worried', 'Curious', 'Frustrated', 'Ready for a change', 'Overwhelmed', 'Calm'] }),
  q({ id: 'v2.arrival.feeling_words', section: 'arrival', screen: 1, type: 'textarea',
      label: 'Anything you want to add in your own words?' }),

  // ── 2. About you ────────────────────────────────────────────────────────────
  q({ id: 'v2.about.full_name', section: 'about', screen: 1, type: 'text', required: true, skippable: false,
      label: 'Your full name' }),
  q({ id: 'v2.about.preferred_name', section: 'about', screen: 1, type: 'text',
      label: 'What should we call you?', help: 'The name you like to be addressed by.' }),
  q({ id: 'v2.about.dob', section: 'about', screen: 2, type: 'date', required: true, skippable: false,
      label: 'Your date of birth' }),
  q({ id: 'v2.about.pathway', section: 'about', screen: 2, type: 'select', required: true, skippable: false,
      label: 'Which best describes you, for the health questions that differ by body?',
      whyWeAsk: 'Some questions — cycles, pregnancies, prostate — only make sense for some bodies. This routes you past the ones that don’t apply.',
      options: ['Female health questions apply to me', 'Male health questions apply to me', 'Prefer to discuss with a practitioner', 'Prefer not to say'] }),
  q({ id: 'v2.about.address', section: 'about', screen: 3, type: 'textarea',
      label: 'Your address' }),
  q({ id: 'v2.about.phone', section: 'about', screen: 3, type: 'text', label: 'Phone number' }),
  q({ id: 'v2.about.relationship', section: 'about', screen: 4, type: 'select',
      label: 'Relationship situation',
      options: ['Single', 'In a relationship', 'Married / civil partnership', 'Separated or divorced', 'Widowed', 'Prefer not to say'] }),
  q({ id: 'v2.about.children', section: 'about', screen: 4, type: 'text',
      label: 'Children, and their ages (if any)' }),
  q({ id: 'v2.about.occupation', section: 'about', screen: 5, type: 'text',
      label: 'What do you do for work?' }),
  q({ id: 'v2.about.work_pattern', section: 'about', screen: 5, type: 'select',
      label: 'Your working pattern',
      options: ['Daytime hours', 'Shifts including nights', 'Part-time', 'Not currently working', 'Retired', 'Student', 'Other'] }),
  q({ id: 'v2.about.height', section: 'about', screen: 6, type: 'text', label: 'Height (however you know it)' }),
  q({ id: 'v2.about.weight', section: 'about', screen: 6, type: 'text', label: 'Weight (however you know it)' }),
  q({ id: 'v2.about.how_found', section: 'about', screen: 6, type: 'select',
      label: 'How did you come to Natural Intelligence?',
      options: ['A friend or family member', 'A practitioner', 'A workshop or event', 'Searching online', 'Social media', 'Other'] }),

  // ── 3. Care already in place ────────────────────────────────────────────────
  q({ id: 'v2.care.gp_name', section: 'care_in_place', screen: 1, type: 'text', label: 'Your GP’s name (if you have one)' }),
  q({ id: 'v2.care.gp_practice', section: 'care_in_place', screen: 1, type: 'text', label: 'GP practice name' }),
  q({ id: 'v2.care.gp_address', section: 'care_in_place', screen: 1, type: 'textarea', label: 'GP practice address' }),
  q({ id: 'v2.care.gp_phone', section: 'care_in_place', screen: 1, type: 'text', label: 'GP practice phone number' }),
  q({ id: 'v2.care.gp_contact_permission', section: 'care_in_place', screen: 2, type: 'select', sensitive: true,
      label: 'May Natural Intelligence contact your GP if a practitioner believes it would help your care?',
      whyWeAsk: 'This is its own separate permission — nothing is sent to your GP without it, and you can change it at any time in Privacy & Data Controls.',
      options: ['Yes, you may contact my GP', 'No, not at the moment', 'Ask me first each time'] }),
  q({ id: 'v2.care.specialists', section: 'care_in_place', screen: 3, type: 'textarea',
      label: 'Any consultants or specialists you see, or have seen recently' }),
  q({ id: 'v2.care.other_practitioners', section: 'care_in_place', screen: 3, type: 'textarea',
      label: 'Any other practitioners you currently see — conventional or complementary' }),
  q({ id: 'v2.care.awaiting', section: 'care_in_place', screen: 3, type: 'select',
      label: 'Are you waiting for any investigations, results or appointments?',
      options: YESNO_UNSURE }),
  q({ id: 'v2.care.awaiting_detail', section: 'care_in_place', screen: 3, type: 'textarea',
      label: 'If yes — what are you waiting for?',
      showIf: { questionId: 'v2.care.awaiting', equals: 'Yes' } }),

  // ── 4. What brings you here ─────────────────────────────────────────────────
  q({ id: 'v2.concerns.own_words', section: 'concerns', screen: 1, type: 'textarea', required: true, skippable: false,
      label: 'In your own words, what would you most like help to understand or improve?',
      help: 'Take your time. This is the most important answer in the whole intake.' }),
  q({ id: 'v2.concerns.list', section: 'concerns', screen: 2, type: 'repeatable',
      label: 'If it helps, break that into separate concerns',
      help: 'Add up to five. A practitioner will go through each one with you properly — you don’t need to cover everything here.',
      itemFields: [
        { key: 'name',      label: 'The concern, in a few of your own words', type: 'text' },
        { key: 'duration',  label: 'Roughly how long it has been going on',   type: 'select',
          options: ['Days', 'Weeks', 'Months', 'A year or two', 'Several years', 'As long as I can remember'] },
        { key: 'changing',  label: 'Is it changing?', type: 'select',
          options: ['Getting better', 'About the same', 'Getting worse', 'Comes and goes'] },
        { key: 'tried',     label: 'What you have already tried', type: 'text' },
        { key: 'good_outcome', label: 'What would a good outcome look like for you?', type: 'text' },
      ] }),
  q({ id: 'v2.concerns.anything_else', section: 'concerns', screen: 3, type: 'textarea',
      label: 'Is there anything else you want us to know before we go on?' }),

  // ── 5. Medical history ──────────────────────────────────────────────────────
  q({ id: 'v2.history.diagnosed', section: 'medical_history', screen: 1, type: 'repeatable',
      label: 'Conditions a doctor has formally told you that you have',
      itemFields: [
        { key: 'condition', label: 'Condition', type: 'text' },
        { key: 'when',      label: 'Roughly when (year is fine)', type: 'text' },
      ] }),
  q({ id: 'v2.history.significant_illness', section: 'medical_history', screen: 2, type: 'textarea',
      label: 'Significant illnesses over your life, even if long past' }),
  q({ id: 'v2.history.admissions', section: 'medical_history', screen: 2, type: 'textarea',
      label: 'Hospital admissions, and roughly when' }),
  q({ id: 'v2.history.surgery', section: 'medical_history', screen: 2, type: 'textarea',
      label: 'Operations or procedures, and roughly when' }),
  q({ id: 'v2.history.recent_tests', section: 'medical_history', screen: 3, type: 'textarea',
      label: 'Tests or investigations in the last year or so',
      help: 'If you have a copy of a lab report, you can add it in BioHub — your practitioner will be able to see the organised results.' }),
  q({ id: 'v2.history.specialist_care', section: 'medical_history', screen: 3, type: 'select',
      label: 'Are you currently under, or waiting for, specialist care?',
      options: YESNO_UNSURE }),

  // ── 6. Medication ───────────────────────────────────────────────────────────
  q({ id: 'v2.medication.items', section: 'medication', screen: 1, type: 'repeatable',
      label: 'Medication you take, or have recently taken',
      help: 'Include hormonal contraception, HRT, and anything you buy over the counter and take regularly. Copy amounts from the label — no need to translate them.',
      itemFields: [
        { key: 'name',     label: 'Name of the medication', type: 'text' },
        { key: 'for',      label: 'What you take it for, in your words', type: 'text' },
        { key: 'amount',   label: 'Amount, as written on the label', type: 'text' },
        { key: 'often',    label: 'How often', type: 'text' },
        { key: 'started',  label: 'When you started (roughly)', type: 'text' },
        { key: 'current',  label: 'Current or past?', type: 'select', options: ['Current', 'Past'] },
        { key: 'effects',  label: 'Anything you have noticed while on it', type: 'text' },
        { key: 'source',   label: 'Who prescribes or supplies it (if known)', type: 'text' },
      ] }),

  // ── 7. Supplements & natural remedies ───────────────────────────────────────
  q({ id: 'v2.supplements.items', section: 'supplements', screen: 1, type: 'repeatable',
      label: 'Supplements and natural remedies you take or use',
      help: 'Herbs, vitamins, minerals, powders, teas, tinctures — and anything you put on your skin for health reasons, like oils or creams.',
      itemFields: [
        { key: 'name',    label: 'Product name', type: 'text' },
        { key: 'brand',   label: 'Brand', type: 'text' },
        { key: 'for',     label: 'What you take or use it for', type: 'text' },
        { key: 'amount',  label: 'Amount, as written on the label', type: 'text' },
        { key: 'often',   label: 'How often', type: 'text' },
        { key: 'started', label: 'When you started (roughly)', type: 'text' },
        { key: 'suggested_by', label: 'Who suggested it?', type: 'select',
          options: ['A practitioner', 'My GP', 'Friend or family', 'I chose it myself', 'Other'] },
        { key: 'route',   label: 'Taken by mouth or applied to skin?', type: 'select',
          options: ['By mouth', 'Applied to skin', 'Both / other'] },
      ] }),

  // ── 8. Family health ────────────────────────────────────────────────────────
  q({ id: 'v2.family.members', section: 'family', screen: 1, type: 'repeatable', sensitive: true,
      label: 'Health conditions in your close family, as far as you know',
      whyWeAsk: 'Family patterns help a practitioner understand your wider picture. ‘Not sure’ is a completely fine answer.',
      itemFields: [
        { key: 'relative', label: 'Family member', type: 'select',
          options: ['Mother', 'Father', 'Maternal grandmother', 'Maternal grandfather', 'Paternal grandmother', 'Paternal grandfather', 'Brother', 'Sister', 'Child'] },
        { key: 'areas', label: 'Anything in these areas?', type: 'select',
          options: ['Cancer', 'Diabetes', 'Heart or circulation', 'Blood pressure', 'Stroke', 'Autoimmune condition', 'Thyroid', 'Osteoporosis', 'Dementia or neurological', 'Mental health', 'Digestive', 'Other', 'Not sure'] },
        { key: 'notes', label: 'Any detail you know (optional)', type: 'text' },
      ] }),

  // ── 9. Early life & past health ─────────────────────────────────────────────
  q({ id: 'v2.early.birth', section: 'early_life', screen: 1, type: 'textarea',
      label: 'Anything you know about your birth and infancy',
      help: 'Early or late, feeding as a baby, anything your family mentioned. ‘Don’t know’ is fine.' }),
  q({ id: 'v2.early.childhood_illness', section: 'early_life', screen: 1, type: 'textarea',
      label: 'Illnesses that kept coming back in childhood, or conditions doctors named back then' }),
  q({ id: 'v2.early.childhood_medication', section: 'early_life', screen: 2, type: 'textarea',
      label: 'Medication you remember taking often as a child — antibiotics, inhalers, anything else' }),
  q({ id: 'v2.early.vaccine_reactions', section: 'early_life', screen: 2, type: 'textarea',
      label: 'Any reactions to vaccinations you or your family noticed' }),
  q({ id: 'v2.early.injuries', section: 'early_life', screen: 3, type: 'textarea',
      label: 'Significant accidents or injuries, at any age' }),
  q({ id: 'v2.early.major_events', section: 'early_life', screen: 3, type: 'textarea',
      label: 'Major health events in your adult life we haven’t covered yet' }),

  // ── 10. Systems overview ────────────────────────────────────────────────────
  q({ id: 'v2.systems.noticed', section: 'systems_overview', screen: 1, type: 'multichip',
      label: 'Where have you noticed anything — big or small?',
      help: 'Choose any areas of your body that have been on your mind. We’ll only ask more about the areas you pick.',
      options: [...BODY_SYSTEMS, 'None of these'] }),

  // ── 11. Digestion ───────────────────────────────────────────────────────────
  q({ id: 'v2.digestion.noticed', section: 'digestion', screen: 1, type: 'multichip',
      label: 'Select anything you have noticed with your digestion',
      options: ['Heartburn or reflux', 'Bad breath', 'Bloating', 'Burping', 'Wind', 'Tummy pain or cramping',
        'Constipation', 'Loose stools or diarrhoea', 'Needing to go urgently', 'Going very often', 'Going infrequently',
        'A change in your usual bowel habit', 'Mucus in the stool', 'Blood in the stool', 'Black, tar-like stool',
        'Feeling sick', 'Vomiting', 'Reactions to particular foods', 'Difficulty swallowing', 'None of these'],
      samd: 'safety_capture',
      safetyOptions: ['Blood in the stool', 'Black, tar-like stool', 'Difficulty swallowing', 'A change in your usual bowel habit'] }),
  q({ id: 'v2.digestion.bowel_frequency', section: 'digestion', screen: 2, type: 'select',
      label: 'How often do your bowels usually open?',
      options: ['More than three times a day', 'One to three times a day', 'Most days', 'Every two or three days', 'Less often than that'] }),
  q({ id: 'v2.digestion.stool_form', section: 'digestion', screen: 2, type: 'stool_form',
      label: 'Which picture looks most like your usual stool?',
      whyWeAsk: 'What leaves the body says a lot about what’s happening inside it. Practitioners find this genuinely useful.',
      options: ['Hard separate lumps', 'Lumpy and sausage-shaped', 'Sausage-shaped with surface cracks', 'Smooth and soft', 'Soft blobs', 'Mushy with ragged edges', 'Entirely liquid'] }),

  // ── 12. Head, nerves & senses ───────────────────────────────────────────────
  q({ id: 'v2.nervous.noticed', section: 'nervous', screen: 1, type: 'multichip',
      label: 'Select anything you have noticed',
      options: ['Headaches', 'Migraines', 'Dizziness', 'The room spinning (vertigo)', 'Fainting or blacking out',
        'A seizure or convulsion', 'Weakness', 'Sudden weakness in an arm or leg', 'Brain fog or memory slips',
        'Trouble concentrating', 'Pins and needles', 'Numbness', 'Shaking or tremor', 'Ringing in the ears',
        'Changes in your vision', 'Losing part or all of your vision', 'None of these'],
      samd: 'safety_capture',
      safetyOptions: ['Fainting or blacking out', 'A seizure or convulsion', 'Sudden weakness in an arm or leg', 'Losing part or all of your vision'] }),

  // ── 13. Sleep ───────────────────────────────────────────────────────────────
  q({ id: 'v2.sleep.hours', section: 'sleep', screen: 1, type: 'select',
      label: 'Roughly how many hours do you sleep most nights?',
      options: ['Under 5', '5–6', '6–7', '7–8', '8–9', 'More than 9', 'It varies wildly'] }),
  q({ id: 'v2.sleep.noticed', section: 'sleep', screen: 1, type: 'multichip',
      label: 'Anything you have noticed about your sleep?',
      options: ['Takes a long time to fall asleep', 'Waking in the night', 'Hard to get back to sleep once awake',
        'Waking very early', 'Waking unrefreshed', 'An irregular pattern', 'Vivid or disturbing dreams',
        'Night sweats', 'Night sweats that soak the bedding', 'None of these'],
      samd: 'safety_capture',
      safetyOptions: ['Night sweats that soak the bedding'] }),

  // ── 14. Mood & stress ───────────────────────────────────────────────────────
  q({ id: 'v2.mood.noticed', section: 'mood_stress', screen: 1, type: 'multichip',
      label: 'Anything you have noticed in yourself lately?',
      options: ['Anxiety', 'Low mood', 'Low motivation', 'Irritability', 'Mood swings', 'Feeling overwhelmed',
        'Finding it hard to cope', 'Pulling away from people', 'None of these'] }),
  q({ id: 'v2.mood.load', section: 'mood_stress', screen: 2, type: 'select',
      label: 'How does life’s load feel at the moment?',
      options: ['Light at the moment', 'Manageable', 'Heavy', 'Very hard to carry', 'Prefer not to say'] }),
  q({ id: 'v2.mood.stressors', section: 'mood_stress', screen: 2, type: 'textarea',
      label: 'What is weighing on you most, if anything?' }),
  q({ id: 'v2.mood.coping', section: 'mood_stress', screen: 2, type: 'textarea',
      label: 'What helps you unwind or cope?' }),
  q({ id: 'v2.mood.safety', section: 'mood_stress', screen: 3, type: 'select', sensitive: true,
      label: 'Have you had thoughts of harming yourself recently?',
      whyWeAsk: 'We ask everyone this, so your practitioner can care for the whole of you. You can skip it.',
      help: 'If things feel very hard right now, you can call Samaritans free any time on 116 123, contact NHS 111, or call 999 in an emergency. Support is there whatever you answer here.',
      options: ['No', 'Sometimes', 'Yes', 'Prefer not to say'],
      samd: 'safety_capture',
      safetyOptions: ['Sometimes', 'Yes'] }),

  // ── 15. Energy, hormones & metabolism ───────────────────────────────────────
  q({ id: 'v2.energy.noticed', section: 'energy_metabolic', screen: 1, type: 'multichip',
      label: 'Anything you have noticed with energy, appetite or temperature?',
      options: ['Tiredness that doesn’t lift', 'Low energy', 'Energy that crashes at certain times of day',
        'Feeling shaky if a meal is missed', 'Strong cravings', 'Unusual thirst', 'Passing water very often',
        'Weight going up without change in habits', 'Weight going down without trying', 'Feeling unusually cold',
        'Feeling unusually hot', 'Sweating heavily', 'A thyroid condition I know about', 'Swelling at the front of the neck', 'None of these'],
      samd: 'safety_capture',
      safetyOptions: ['Weight going down without trying', 'Swelling at the front of the neck'] }),

  // ── 16. Reproductive health (routed) ────────────────────────────────────────
  q({ id: 'v2.repro.female', section: 'reproductive', screen: 1, type: 'multichip', sensitive: true,
      label: 'Anything you have noticed? (female health)',
      whyWeAsk: 'Cycles and hormones touch energy, mood, skin and sleep — this helps your practitioner see the whole picture. Skip anything you prefer to discuss in person.',
      showIf: { questionId: 'v2.about.pathway', equals: 'Female health questions apply to me' },
      options: ['Irregular cycles', 'Heavy periods', 'Painful periods', 'Bleeding between periods', 'Bleeding after sex',
        'Pelvic pain', 'Symptoms in the days before a period', 'Thrush or infections', 'Hot flushes', 'Night sweats',
        'Vaginal dryness', 'Changes in desire', 'Fertility concerns', 'Menopause or perimenopause symptoms', 'None of these'],
      samd: 'safety_capture',
      safetyOptions: ['Bleeding between periods', 'Bleeding after sex'] }),
  q({ id: 'v2.repro.female_status', section: 'reproductive', screen: 2, type: 'select', sensitive: true,
      label: 'Which describes your cycle at the moment?',
      whyWeAsk: 'Cycle stage changes which later questions make sense — nothing more is read into it.',
      showIf: { questionId: 'v2.about.pathway', equals: 'Female health questions apply to me' },
      options: ['Regular cycles', 'Irregular cycles', 'No periods currently', 'Pregnant or possibly pregnant', 'Breastfeeding', 'Perimenopause', 'Post-menopause', 'Prefer not to say'],
      samd: 'safety_capture',
      safetyOptions: ['Pregnant or possibly pregnant'] }),
  q({ id: 'v2.repro.pregnancies', section: 'reproductive', screen: 2, type: 'textarea', sensitive: true,
      label: 'Pregnancies and their outcomes, if you are comfortable sharing',
      whyWeAsk: 'Pregnancy history can shape hormonal and nutritional context. Share only what feels right — you can leave this blank.',
      showIf: { questionId: 'v2.about.pathway', equals: 'Female health questions apply to me' } }),
  q({ id: 'v2.repro.male', section: 'reproductive', screen: 1, type: 'multichip', sensitive: true,
      label: 'Anything you have noticed? (male health)',
      whyWeAsk: 'These questions touch hormones, sleep and circulation — they help your practitioner see the whole picture. Skip anything you prefer to discuss in person.',
      showIf: { questionId: 'v2.about.pathway', equals: 'Male health questions apply to me' },
      options: ['Changes in desire', 'Fertility concerns', 'Difficulty with erections', 'Passing water very often',
        'Difficulty starting to pass water', 'A weak stream', 'Not feeling fully empty afterwards',
        'Discomfort in the pelvis or testicles', 'None of these'],
      samd: 'safety_capture',
      safetyOptions: ['Discomfort in the pelvis or testicles'] }),
  q({ id: 'v2.repro.children', section: 'reproductive', screen: 2, type: 'text', sensitive: true,
      label: 'Do you have children?',
      whyWeAsk: 'Simply part of the fertility picture — nothing more is read into it.',
      showIf: { questionId: 'v2.about.pathway', equals: 'Male health questions apply to me' } }),
  q({ id: 'v2.repro.sexual_health', section: 'reproductive', screen: 3, type: 'textarea', sensitive: true,
      label: 'Anything from your sexual health history you would like noted? (completely optional)',
      whyWeAsk: 'Some infections, medications and hormones can be relevant to a health history. This is entirely yours to skip — a practitioner will only ever ask what is relevant and comfortable.' }),

  // ── 17. Immune & allergies ──────────────────────────────────────────────────
  q({ id: 'v2.immune.noticed', section: 'immune', screen: 1, type: 'multichip',
      label: 'Anything you have noticed with immunity, allergies or healing?',
      options: ['Allergies I know about', 'Foods I suspect don’t agree with me', 'Wounds that heal slowly',
        'Asthma', 'Eczema', 'Hives', 'Infections that keep coming', 'Cold sores', 'An autoimmune condition',
        'Swelling or lumps I can’t explain', 'A fever that won’t go away', 'A reaction to a recent vaccination', 'None of these'],
      samd: 'safety_capture',
      safetyOptions: ['Swelling or lumps I can’t explain', 'A fever that won’t go away'] }),
  q({ id: 'v2.immune.allergy_detail', section: 'immune', screen: 2, type: 'textarea',
      label: 'If you have allergies or suspected intolerances, tell us what and what happens',
      showIf: { questionId: 'v2.immune.noticed', includesAny: ['Allergies I know about', 'Foods I suspect don’t agree with me'] } }),

  // ── 18. Breathing, sinuses, throat & ears ───────────────────────────────────
  q({ id: 'v2.breathing.noticed', section: 'breathing', screen: 1, type: 'multichip',
      label: 'Anything you have noticed with breathing, sinuses, throat or ears?',
      options: ['Wheezing', 'Asthma', 'Chest infections', 'Mucus dripping down the back of the throat', 'Coughing up mucus',
        'Sinus trouble', 'Getting out of breath easily', 'Sudden breathlessness', 'Throat or tonsil infections',
        'Ear infections', 'A cough that won’t go', 'A dry cough', 'A dry throat', 'Blood when coughing',
        'Lips turning blue', 'Swelling of the face, lips, tongue or throat', 'None of these'],
      samd: 'safety_capture',
      safetyOptions: ['Sudden breathlessness', 'Blood when coughing', 'Lips turning blue', 'Swelling of the face, lips, tongue or throat', 'A cough that won’t go'] }),

  // ── 19. Urinary ─────────────────────────────────────────────────────────────
  q({ id: 'v2.urinary.noticed', section: 'urinary', screen: 1, type: 'multichip',
      label: 'Anything you have noticed when passing water?',
      options: ['Going very often', 'Sudden urgency', 'Burning or pain', 'Blood in the urine', 'Pain in the side or lower back',
        'Difficulty going', 'Not feeling fully empty', 'Water infections that keep coming back', 'Changes in colour or smell', 'None of these'],
      samd: 'safety_capture',
      safetyOptions: ['Blood in the urine', 'Pain in the side or lower back'] }),

  // ── 20. Heart & circulation ─────────────────────────────────────────────────
  q({ id: 'v2.heart.noticed', section: 'heart', screen: 1, type: 'multichip',
      label: 'Anything you have noticed with your heart or circulation?',
      options: ['Chest pain or tightness', 'Getting short of breath', 'A racing, thumping or fluttering heart',
        'Swollen ankles or legs', 'Fainting', 'Varicose veins', 'Cold hands and feet',
        'Blood pressure I know about', 'Cholesterol I know about',
        'A painful calf that is swollen, warm or tender', 'None of these'],
      samd: 'safety_capture',
      safetyOptions: ['Chest pain or tightness', 'Fainting', 'A painful calf that is swollen, warm or tender'] }),

  // ── 21. Muscles & joints ────────────────────────────────────────────────────
  q({ id: 'v2.muscles.noticed', section: 'muscles_joints', screen: 1, type: 'multichip',
      label: 'Anything you have noticed with muscles, joints or your back?',
      options: ['Joint pain', 'Joint stiffness', 'Joint swelling', 'Back pain', 'Neck pain', 'An injury that hasn’t settled',
        'Muscle spasms', 'Cramps', 'Very slow recovery after exertion',
        'Severe bone pain that doesn’t ease', 'Low back trouble along with difficulty passing water, opening bowels, or numbness underneath', 'None of these'],
      samd: 'safety_capture',
      safetyOptions: ['Severe bone pain that doesn’t ease', 'Low back trouble along with difficulty passing water, opening bowels, or numbness underneath'] }),

  // ── 22. Skin, hair & nails ──────────────────────────────────────────────────
  q({ id: 'v2.skin.noticed', section: 'skin', screen: 1, type: 'multichip',
      label: 'Anything you have noticed with skin, hair or nails?',
      options: ['Acne or breakouts', 'Dry skin', 'Oily skin', 'Eczema', 'Reactions where things touch the skin',
        'Psoriasis', 'Fungal problems', 'Sensitive skin', 'A rash', 'Itching', 'Hair thinning or loss',
        'Changes in your nails', 'A mole or skin patch that is changing', 'None of these'],
      samd: 'safety_capture',
      safetyOptions: ['A mole or skin patch that is changing'] }),
  q({ id: 'v2.skin.products', section: 'skin', screen: 2, type: 'textarea',
      label: 'What do you put on your skin and hair? Brands are helpful if you know them.' }),

  // ── 23. Food diary ──────────────────────────────────────────────────────────
  q({ id: 'v2.diary.entries', section: 'food_diary', screen: 1, type: 'diary',
      label: 'What have you actually eaten and drunk?',
      help: 'Start with today or yesterday — meals, snacks and drinks, with rough times. Add up to three days if you can; skip and come back whenever suits. Nobody is judging your plate.' }),

  // ── 24. Food frequency ──────────────────────────────────────────────────────
  ...([
    ['fruit', 'Fruit'], ['vegetables', 'Vegetables'], ['greens', 'Leafy greens specifically'],
    ['legumes', 'Beans, lentils and pulses'], ['red_meat', 'Red meat'], ['poultry', 'Chicken and other poultry'],
    ['fish', 'Fish'], ['eggs', 'Eggs'], ['dairy', 'Dairy'], ['plant_protein', 'Plant proteins like tofu or tempeh'],
    ['gluten', 'Bread, pasta and other gluten-containing foods'], ['refined', 'Refined or sugary foods'],
    ['sweets', 'Sweets and confectionery'], ['tinned', 'Tinned foods'], ['frozen', 'Frozen meals'],
    ['takeaway', 'Takeaways'], ['prepackaged', 'Pre-packaged meals'],
  ] as const).map(([key, label]) =>
    q({ id: `v2.foodfreq.${key}`, section: 'food_frequency', screen: 1, type: 'frequency',
        label, options: [...FREQUENCY_OPTIONS] })),

  // ── 25. Eating habits & kitchen reality ─────────────────────────────────────
  q({ id: 'v2.eating.pattern', section: 'eating_habits', screen: 1, type: 'multichip',
      label: 'How would you describe the way you eat?',
      options: ['Omnivore', 'Vegetarian', 'Vegan', 'Pescatarian', 'Halal', 'Gluten-free', 'Dairy-free', 'Other'] }),
  q({ id: 'v2.eating.restrictions', section: 'eating_habits', screen: 1, type: 'textarea',
      label: 'Any restrictions, and the reason behind them?' }),
  q({ id: 'v2.eating.reactions', section: 'eating_habits', screen: 2, type: 'textarea',
      label: 'Foods that clearly disagree with you, and what happens' }),
  q({ id: 'v2.eating.dislikes', section: 'eating_habits', screen: 2, type: 'textarea',
      label: 'Foods you simply can’t stand' }),
  q({ id: 'v2.eating.how', section: 'eating_habits', screen: 3, type: 'multichip',
      label: 'How does eating usually happen for you?',
      options: ['I eat quickly', 'I eat slowly', 'I chew well', 'I barely chew', 'Often on the move', 'Often while stressed',
        'Often at a table, unhurried', 'I skip meals', 'I often eat past full', 'Small portions', 'Large portions'] }),
  q({ id: 'v2.kitchen.cooks', section: 'eating_habits', screen: 4, type: 'select',
      label: 'Who mostly cooks at home?',
      options: ['Me', 'Someone else', 'Shared', 'Mostly not cooked at home'] }),
  q({ id: 'v2.kitchen.confidence', section: 'eating_habits', screen: 4, type: 'select',
      label: 'How confident are you in the kitchen?',
      options: ['Very confident', 'Comfortable with basics', 'Limited', 'I avoid cooking'] }),
  q({ id: 'v2.kitchen.methods', section: 'eating_habits', screen: 4, type: 'multichip',
      label: 'How is food usually cooked?',
      options: ['Fresh from scratch', 'Batch cooked', 'Oven', 'Hob', 'Air fryer', 'Microwave', 'Deep fried', 'Raw or salads', 'Slow cooker'] }),
  q({ id: 'v2.kitchen.shopping', section: 'eating_habits', screen: 5, type: 'text',
      label: 'Where do you mostly shop for food?' }),
  q({ id: 'v2.kitchen.budget', section: 'eating_habits', screen: 5, type: 'select', sensitive: true,
      label: 'How does the food budget feel?',
      whyWeAsk: 'Real suggestions from a practitioner have to fit real life. This stays between you and them.',
      options: ['Comfortable', 'Okay with care', 'Tight', 'Very tight', 'Prefer not to say'] }),
  q({ id: 'v2.kitchen.recipe_support', section: 'eating_habits', screen: 5, type: 'select',
      label: 'Would recipe ideas from your practitioner be welcome?',
      options: ['Yes please', 'Maybe', 'No thanks'] }),
  q({ id: 'v2.kitchen.change_hard', section: 'eating_habits', screen: 5, type: 'textarea',
      label: 'Honestly — what would make changing how you eat hard to stick to?' }),

  // ── 26. Drinks ──────────────────────────────────────────────────────────────
  ...([
    ['water', 'Water — roughly how much a day?', ['Hardly any', 'A glass or two', 'Around a litre', '1–2 litres', 'More than 2 litres']],
    ['caffeine', 'Tea or coffee — how many cups a day?', ['None', '1–2', '3–4', '5 or more']],
    ['alcohol', 'Alcohol — how often?', ['Never', 'Special occasions', 'Most weeks', 'Most days']],
    ['herbal', 'Herbal teas — how often?', ['Rarely or never', 'Sometimes', 'Most days']],
    ['juices', 'Juices — how often?', ['Rarely or never', 'Sometimes', 'Most days']],
    ['sugary', 'Sugary or fizzy drinks — how often?', ['Rarely or never', 'Sometimes', 'Most days']],
  ] as [string, string, string[]][]).map(([key, label, options]) =>
    q({ id: `v2.drinks.${key}`, section: 'drinks', screen: 1, type: 'select', label, options })),
  q({ id: 'v2.drinks.other', section: 'drinks', screen: 1, type: 'text',
      label: 'Anything else you drink regularly?' }),

  // ── 27. Life & routine ──────────────────────────────────────────────────────
  q({ id: 'v2.life.balance', section: 'lifestyle', screen: 1, type: 'select',
      label: 'How does the balance between work and the rest of life feel?',
      options: ['Healthy', 'Mostly fine', 'Tilted the wrong way', 'Consumed by work', 'Prefer not to say'] }),
  q({ id: 'v2.life.movement', section: 'lifestyle', screen: 1, type: 'textarea',
      label: 'How does movement show up in your week? Exercise, walking, anything at all — type, how often, how long.' }),
  q({ id: 'v2.life.hobbies', section: 'lifestyle', screen: 2, type: 'textarea',
      label: 'What do you do for joy?' }),
  q({ id: 'v2.life.smoking', section: 'lifestyle', screen: 2, type: 'select',
      label: 'Do you smoke or vape?',
      options: ['No, never have', 'Used to, stopped', 'Occasionally', 'Daily'] }),
  q({ id: 'v2.life.drugs', section: 'lifestyle', screen: 2, type: 'select', sensitive: true,
      label: 'Do you use recreational drugs?',
      whyWeAsk: 'Asked without judgement — some substances interact with herbs, supplements and medication, and your practitioner needs the true picture.',
      options: ['No', 'Occasionally', 'Regularly', 'Prefer not to say'] }),
  q({ id: 'v2.life.caring', section: 'lifestyle', screen: 3, type: 'textarea',
      label: 'Do you care for anyone — children, parents, others?' }),
  q({ id: 'v2.life.faith_practices', section: 'lifestyle', screen: 3, type: 'textarea', sensitive: true,
      label: 'Any faith or cultural practices that shape your eating, fasting, routines or appointments?',
      whyWeAsk: 'So suggestions and scheduling can respect how you actually live — fasting periods, food practices, prayer times, modesty preferences.' }),

  // ── 28. Timeline ────────────────────────────────────────────────────────────
  q({ id: 'v2.timeline.events', section: 'timeline', screen: 1, type: 'timeline',
      label: 'Your health and life timeline',
      help: 'Add the moments that mattered — an illness, a move, a loss, a birth, a change. Age or year, what happened, and a note if you like. No interpretation, just your story in order.' }),

  // ── 29. Review ──────────────────────────────────────────────────────────────
  q({ id: 'v2.review.confirmed', section: 'review', screen: 1, type: 'yesno', required: true, skippable: false,
      label: 'I have read my answers back and they are mine, as I meant them.',
      help: 'Your health intake will not be submitted until the required choices for your selected NI service are complete.' }),
]

// ─── Lookups ──────────────────────────────────────────────────────────────────

export function v2QuestionsForSection(section: V2SectionId): V2QuestionDef[] {
  return V2_QUESTIONS.filter((question) => question.section === section)
}

export function v2QuestionById(id: string): V2QuestionDef | undefined {
  return V2_QUESTIONS.find((question) => question.id === id)
}

/** All safety-capture question ids (internal review marking, never client-facing). */
export function v2SafetyCaptureIds(): string[] {
  return V2_QUESTIONS.filter((question) => question.samd === 'safety_capture').map((question) => question.id)
}
