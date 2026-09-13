// ─── packages/db/src/intakeV2/callSheet.ts ────────────────────────────────────
// Practitioner call-sheet SCAFFOLD (internal only — no live practitioner
// exposure; no UI route ships with this module).
//
// Purpose: turn the client's POSITIVE selections into practitioner prompts so
// the consultation starts prepared, while keeping ALL deep case-taking — and
// every conclusion — in the human practitioner layer. The software structures
// questions; it never analyses answers, never concludes, never plans.
//
// Digging trees below are ORIGINAL NI wording, symptom-specific (not one
// generic list reused everywhere). A shared factual frame (when it started /
// how often / what it feels like / where / better–worse / timing / company /
// tests / previous advice / response) is used only where it genuinely fits,
// and each tree adds its own specific prompts.

export interface CallSheetPrompt {
  id: string
  prompt: string
  /** Marked when this prompt exists because a safety-capture answer was selected. */
  safetyFollowUp?: boolean
}

export interface CallSheetTree {
  key: string
  /** Client selections (question id + option value) that surface this tree. */
  triggers: { questionId: string; option: string }[]
  title: string
  prompts: CallSheetPrompt[]
}

/** Entry on the practitioner call sheet — never overwrites the client answer. */
export interface CallSheetEntry {
  questionId: string
  clientAnswer: unknown             // original, immutable
  practitionerNote: string | null   // factual notes only
  practitionerCorrection: unknown | null // recorded ALONGSIDE, never over, the client answer
  verificationStatus: 'client_reported' | 'practitioner_verified' | 'practitioner_corrected'
  missingInformation: string | null // flags gaps, never clinical significance
  actor: string | null
  recordedAt: string | null
}

const frame = (key: string, specifics: CallSheetPrompt[]): CallSheetPrompt[] => [
  { id: `${key}.started`,  prompt: 'When did this first appear, and what was happening in life around then?' },
  { id: `${key}.often`,    prompt: 'How often does it happen, and how long does an episode last?' },
  { id: `${key}.feels`,    prompt: 'How would they describe the sensation, in their own words?' },
  { id: `${key}.better_worse`, prompt: 'What makes it better? What makes it worse?' },
  { id: `${key}.timing`,   prompt: 'Any pattern — time of day, food, cycle, stress, season?' },
  { id: `${key}.company`,  prompt: 'What else shows up alongside it?' },
  { id: `${key}.tests`,    prompt: 'Any tests or investigations so far, and what came back?' },
  { id: `${key}.advice`,   prompt: 'What has already been advised or tried, and what happened?' },
  ...specifics,
]

export const CALL_SHEET_TREES: CallSheetTree[] = [
  {
    key: 'bloating',
    triggers: [{ questionId: 'v2.digestion.noticed', option: 'Bloating' }],
    title: 'Bloating',
    prompts: frame('bloating', [
      { id: 'bloating.onset_meal', prompt: 'Does it build during or after eating — and how soon after?' },
      { id: 'bloating.day_shape', prompt: 'Flat in the morning and swollen by evening, or constant?' },
      { id: 'bloating.foods', prompt: 'Which foods or drinks do they associate with it?' },
      { id: 'bloating.relief', prompt: 'Is it relieved by wind, stool, or neither?' },
    ]),
  },
  {
    key: 'reflux',
    triggers: [{ questionId: 'v2.digestion.noticed', option: 'Heartburn or reflux' }],
    title: 'Heartburn / reflux',
    prompts: frame('reflux', [
      { id: 'reflux.position', prompt: 'Worse lying down, bending, or after large meals?' },
      { id: 'reflux.night', prompt: 'Does it wake them at night? Any cough or hoarseness with it?' },
      { id: 'reflux.swallow', prompt: 'Any difficulty or pain swallowing? (safety follow-up if yes)', safetyFollowUp: true },
      { id: 'reflux.meds', prompt: 'Any antacids or acid-suppressing medication — how often, how long?' },
    ]),
  },
  {
    key: 'headache',
    triggers: [{ questionId: 'v2.nervous.noticed', option: 'Headaches' }, { questionId: 'v2.nervous.noticed', option: 'Migraines' }],
    title: 'Headache / migraine',
    prompts: frame('headache', [
      { id: 'headache.location', prompt: 'Where does it sit — one side, both, behind the eyes, back of the head?' },
      { id: 'headache.aura', prompt: 'Any visual changes, tingling or speech change before or during?' },
      { id: 'headache.sudden', prompt: 'Ever a sudden, worst-ever headache? (safety follow-up)', safetyFollowUp: true },
      { id: 'headache.triggers', prompt: 'Known triggers — sleep, screens, foods, hormones, weather?' },
    ]),
  },
  {
    key: 'dizziness',
    triggers: [{ questionId: 'v2.nervous.noticed', option: 'Dizziness' }, { questionId: 'v2.nervous.noticed', option: 'The room spinning (vertigo)' }],
    title: 'Dizziness / vertigo',
    prompts: frame('dizziness', [
      { id: 'dizziness.kind', prompt: 'Light-headed and floaty, or the room actually spinning?' },
      { id: 'dizziness.position', prompt: 'Brought on by standing, turning the head, or rolling in bed?' },
      { id: 'dizziness.hearing', prompt: 'Any ear fullness, hearing change or ringing alongside?' },
      { id: 'dizziness.faint', prompt: 'Any blackouts or falls with it? (safety follow-up)', safetyFollowUp: true },
    ]),
  },
  {
    key: 'fatigue',
    triggers: [{ questionId: 'v2.energy.noticed', option: 'Tiredness that doesn’t lift' }, { questionId: 'v2.energy.noticed', option: 'Low energy' }],
    title: 'Fatigue',
    prompts: frame('fatigue', [
      { id: 'fatigue.shape', prompt: 'Worst on waking, mid-afternoon, or constant? Does rest actually restore them?' },
      { id: 'fatigue.exertion', prompt: 'Does modest exertion pay them back the next day?' },
      { id: 'fatigue.sleep_link', prompt: 'How do their sleep answers line up with the tiredness story?' },
      { id: 'fatigue.weight_appetite', prompt: 'Any weight change or appetite change alongside? (safety follow-up if unintentional loss)', safetyFollowUp: true },
    ]),
  },
  {
    key: 'joint_pain',
    triggers: [{ questionId: 'v2.muscles.noticed', option: 'Joint pain' }],
    title: 'Joint pain',
    prompts: frame('joint_pain', [
      { id: 'joint.which', prompt: 'Which joints — small or large, one side or both, moving around or fixed?' },
      { id: 'joint.morning', prompt: 'Morning stiffness — how long until they loosen up?' },
      { id: 'joint.swelling', prompt: 'Visible swelling, heat or redness in any joint?' },
      { id: 'joint.systemic', prompt: 'Any fevers, rashes or gut changes travelling with it?' },
    ]),
  },
  {
    key: 'urinary_frequency',
    triggers: [{ questionId: 'v2.urinary.noticed', option: 'Going very often' }],
    title: 'Urinary frequency',
    prompts: frame('urinary_frequency', [
      { id: 'urinary.volume', prompt: 'Large volumes each time, or small amounts often?' },
      { id: 'urinary.night', prompt: 'How many times a night?' },
      { id: 'urinary.thirst', prompt: 'Unusual thirst alongside? Cross-check the energy/metabolism answers.' },
      { id: 'urinary.pain_blood', prompt: 'Any burning or blood? (safety follow-up)', safetyFollowUp: true },
    ]),
  },
  {
    key: 'chest_pain',
    triggers: [{ questionId: 'v2.heart.noticed', option: 'Chest pain or tightness' }],
    title: 'Chest pain — safety capture',
    prompts: [
      { id: 'chest.current', prompt: 'Is any chest pain present NOW or recurring at rest? If so, pause the consultation and direct to urgent NHS care first.', safetyFollowUp: true },
      { id: 'chest.pattern', prompt: 'When it happens: with exertion, with meals, with breathing, with movement of the chest wall?', safetyFollowUp: true },
      { id: 'chest.company', prompt: 'Breathlessness, sweating, nausea, arm or jaw involvement alongside?', safetyFollowUp: true },
      { id: 'chest.reviewed', prompt: 'Has a doctor assessed this chest pain? When, and what was found?', safetyFollowUp: true },
    ],
  },
  {
    key: 'reproductive_concern',
    triggers: [
      { questionId: 'v2.repro.female', option: 'Bleeding between periods' },
      { questionId: 'v2.repro.female', option: 'Bleeding after sex' },
      { questionId: 'v2.repro.male', option: 'Discomfort in the pelvis or testicles' },
    ],
    title: 'Reproductive concern — sensitive, safety-aware',
    prompts: [
      { id: 'repro.comfort', prompt: 'Begin by asking what they are comfortable discussing; take only what is offered.' },
      { id: 'repro.pattern', prompt: 'For bleeding changes: since when, how often, relationship to cycle — and has a GP been told? (safety follow-up)', safetyFollowUp: true },
      { id: 'repro.exam', prompt: 'Any examinations, smears or scans already done, and when?' },
      { id: 'repro.hormonal', prompt: 'Hormonal medication or contraception context from the medication section — confirm it is current.' },
    ],
  },
]

/** Trees surfaced by the client's actual selections. Purely structural. */
export function callSheetTreesForAnswers(answers: Record<string, unknown>): CallSheetTree[] {
  return CALL_SHEET_TREES.filter((tree) =>
    tree.triggers.some((trigger) => {
      const value = answers[trigger.questionId]
      return Array.isArray(value) ? (value as unknown[]).includes(trigger.option) : value === trigger.option
    }),
  )
}
