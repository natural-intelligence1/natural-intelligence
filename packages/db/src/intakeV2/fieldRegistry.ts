// ─── packages/db/src/intakeV2/fieldRegistry.ts ────────────────────────────────
// Intake-to-Synopsis FIELD REGISTRY v1 — the KR-approved Field Mapping v1
// encoded as data. Field IDs are the exact approved strings.
//
// Approved architecture (sources):
//   account_profile      — live identity (ask ONCE in onboarding; intake confirms)
//   care_profile         — live health/care context (ask only if missing)
//   case_snapshot        — frozen point-in-time context at submission (derived)
//   intake_v2            — client-reported factual health story
//   practitioner_call_sheet — verification, missing details, safety
//                          acknowledgement, physical observations
//   practitioner_analysis — the separate, manual Analysis & Plan area
//   safety_derived       — safety review items derived ONLY from the
//                          clinician-owned safety_capture metadata
//
// FIREWALL encoded here: intake never writes a practitioner.* field; the
// registry carries no scoring, ranking, risk, triage or recommendation
// concept anywhere; safety fields are derived, never asked, never invented
// in code. Facts may inform practitioner thinking — NI does not interpret
// them.

export type V2FieldSource =
  | 'account_profile' | 'care_profile' | 'case_snapshot' | 'intake_v2'
  | 'practitioner_call_sheet' | 'practitioner_analysis' | 'safety_derived'

export type V2SynopsisSectionId =
  | 'safety_review' | 'case_snapshot' | 'concerns' | 'diagnoses' | 'timeline'
  | 'medications_supplements' | 'family_history' | 'early_life'
  | 'systems_review' | 'physical_observations' | 'food_kitchen'
  | 'lifestyle_environment' | 'analysis_plan'

export type V2FieldDomain =
  | 'identity' | 'care_context' | 'case_snapshot' | 'care_in_place'
  | 'concerns' | 'diagnoses' | 'medications' | 'supplements' | 'family'
  | 'early_life' | 'systems' | 'reproductive' | 'food' | 'lifestyle'
  | 'timeline' | 'observation' | 'safety' | 'analysis'

export interface V2FieldDef {
  /** Exact approved field ID (Field Mapping v1). */
  id: string
  label: string
  domain: V2FieldDomain
  source: V2FieldSource
  /** Where the field lands in the practitioner synopsis; null = not shown there. */
  synopsisSection: V2SynopsisSectionId | null
  /** Asked once in onboarding/profile — the intake only CONFIRMS it. */
  askOnce?: boolean
  repeatable?: boolean
  /** Needs why-we-ask wording client-side. */
  sensitive?: boolean
  skippable?: boolean
  /** Never asked client-side and never intake-writable. */
  practitionerOnly?: boolean
  /** Computed/derived — never asked to anyone. */
  derived?: boolean
  /** Operational — excluded from practitioner export by default. */
  exportExcluded?: boolean
  /** Design/spec placeholder only (uploads, photo) — no active storage. */
  placeholderOnly?: boolean
  /** Also lands on the practitioner call sheet. */
  callSheet?: boolean
  notes?: string
}

const f = (def: V2FieldDef): V2FieldDef => def

// ─── A. Identity — account_profile (ask once; intake confirms only) ──────────

const IDENTITY: V2FieldDef[] = [
  f({ id: 'profile.legal_name', label: 'Legal name', domain: 'identity', source: 'account_profile', synopsisSection: 'case_snapshot', askOnce: true,
      notes: 'Flows into case_snapshot; practitioner view uses pseudonymised display where appropriate.' }),
  f({ id: 'profile.preferred_name', label: 'Preferred name', domain: 'identity', source: 'account_profile', synopsisSection: 'case_snapshot', askOnce: true }),
  f({ id: 'profile.dob', label: 'Date of birth', domain: 'identity', source: 'account_profile', synopsisSection: 'case_snapshot', askOnce: true,
      notes: 'Age is derived in case_snapshot.' }),
  f({ id: 'profile.email', label: 'Email', domain: 'identity', source: 'account_profile', synopsisSection: null, askOnce: true, exportExcluded: true,
      notes: 'Operational — excluded from practitioner export by default.' }),
  f({ id: 'profile.phone', label: 'Phone', domain: 'identity', source: 'account_profile', synopsisSection: null, askOnce: true, exportExcluded: true,
      notes: 'Operational — excluded from practitioner export by default.' }),
  f({ id: 'profile.address', label: 'Address', domain: 'identity', source: 'account_profile', synopsisSection: null, askOnce: true, exportExcluded: true,
      notes: 'Operational — excluded from practitioner export by default.' }),
]

// ─── B. Care context — care_profile (ask only if missing; confirm) ───────────

const CARE_CONTEXT: V2FieldDef[] = [
  f({ id: 'care_profile.sex', label: 'Sex', domain: 'care_context', source: 'care_profile', synopsisSection: 'case_snapshot', askOnce: true, sensitive: true }),
  f({ id: 'care_profile.reproductive_pathway', label: 'Reproductive question pathway', domain: 'care_context', source: 'care_profile', synopsisSection: 'case_snapshot', askOnce: true, sensitive: true,
      notes: 'Drives the reproductive branch of the intake.' }),
  f({ id: 'care_profile.household', label: 'Household', domain: 'care_context', source: 'care_profile', synopsisSection: 'case_snapshot', askOnce: true }),
  f({ id: 'care_profile.children', label: 'Children', domain: 'care_context', source: 'care_profile', synopsisSection: 'case_snapshot', askOnce: true, sensitive: true }),
  f({ id: 'care_profile.occupation', label: 'Occupation', domain: 'care_context', source: 'care_profile', synopsisSection: 'case_snapshot', askOnce: true,
      notes: 'Also appears in the Lifestyle context section.' }),
  f({ id: 'care_profile.height', label: 'Height', domain: 'care_context', source: 'care_profile', synopsisSection: 'case_snapshot', askOnce: true,
      notes: 'May support a factual BMI number only — never a label or category.' }),
  f({ id: 'care_profile.weight', label: 'Weight', domain: 'care_context', source: 'care_profile', synopsisSection: 'case_snapshot', askOnce: true,
      notes: 'May support a factual BMI number only — never a label or category.' }),
]

// ─── C. Case snapshot — derived, frozen at submission ────────────────────────

const CASE_SNAPSHOT: V2FieldDef[] = [
  f({ id: 'case_snapshot.age_derived', label: 'Age at submission (derived)', domain: 'case_snapshot', source: 'case_snapshot', synopsisSection: 'case_snapshot', derived: true }),
  f({ id: 'case_snapshot.bmi_derived', label: 'BMI (number only, derived)', domain: 'case_snapshot', source: 'case_snapshot', synopsisSection: 'case_snapshot', derived: true,
      notes: 'Number only — no label, category or interpretation, ever.' }),
  f({ id: 'case_snapshot.submitted_at', label: 'Submitted at', domain: 'case_snapshot', source: 'case_snapshot', synopsisSection: 'case_snapshot', derived: true }),
  f({ id: 'case_snapshot.profile_frozen', label: 'Profile, frozen at submission', domain: 'case_snapshot', source: 'case_snapshot', synopsisSection: 'case_snapshot', derived: true }),
  f({ id: 'case_snapshot.intake_frozen', label: 'Intake answers, frozen at submission', domain: 'case_snapshot', source: 'case_snapshot', synopsisSection: 'case_snapshot', derived: true }),
]

// ─── D. Care already in place ─────────────────────────────────────────────────

const CARE_IN_PLACE: V2FieldDef[] = [
  f({ id: 'intake.care.gp_name', label: 'GP name', domain: 'care_in_place', source: 'intake_v2', synopsisSection: 'case_snapshot' }),
  f({ id: 'intake.care.gp_practice', label: 'GP practice', domain: 'care_in_place', source: 'intake_v2', synopsisSection: 'case_snapshot' }),
  f({ id: 'intake.care.gp_contact_permission', label: 'Permission to contact GP', domain: 'care_in_place', source: 'intake_v2', synopsisSection: 'case_snapshot' }),
  f({ id: 'intake.care.specialists[n].name', label: 'Specialist — name', domain: 'care_in_place', source: 'intake_v2', synopsisSection: 'diagnoses', repeatable: true }),
  f({ id: 'intake.care.specialists[n].specialty', label: 'Specialist — specialty', domain: 'care_in_place', source: 'intake_v2', synopsisSection: 'diagnoses', repeatable: true }),
  f({ id: 'intake.care.specialists[n].status', label: 'Specialist — current or past', domain: 'care_in_place', source: 'intake_v2', synopsisSection: 'diagnoses', repeatable: true }),
  f({ id: 'intake.care.other_practitioners[n].name', label: 'Other practitioner — name', domain: 'care_in_place', source: 'intake_v2', synopsisSection: 'diagnoses', repeatable: true }),
  f({ id: 'intake.care.other_practitioners[n].discipline', label: 'Other practitioner — discipline', domain: 'care_in_place', source: 'intake_v2', synopsisSection: 'diagnoses', repeatable: true }),
  f({ id: 'intake.care.pending_referrals[n].description', label: 'Pending referral — description', domain: 'care_in_place', source: 'intake_v2', synopsisSection: 'diagnoses', repeatable: true,
      notes: 'May surface in Safety ONLY if clinician-approved metadata exists for it.' }),
  f({ id: 'intake.care.pending_referrals[n].status', label: 'Pending referral — status', domain: 'care_in_place', source: 'intake_v2', synopsisSection: 'diagnoses', repeatable: true }),
  f({ id: 'intake.care.pending_investigations[n].description', label: 'Pending investigation — description', domain: 'care_in_place', source: 'intake_v2', synopsisSection: 'diagnoses', repeatable: true,
      notes: 'May surface in Safety ONLY if clinician-approved metadata exists for it.' }),
  f({ id: 'intake.care.pending_investigations[n].status', label: 'Pending investigation — status', domain: 'care_in_place', source: 'intake_v2', synopsisSection: 'diagnoses', repeatable: true }),
  f({ id: 'intake.care.uploads[n].file_ref', label: 'Upload — file reference', domain: 'care_in_place', source: 'intake_v2', synopsisSection: 'diagnoses', repeatable: true, placeholderOnly: true,
      notes: 'Placeholder/spec only — no active storage until storage, retention and legal handling are authorised. Never auto-parsed or interpreted.' }),
  f({ id: 'intake.care.uploads[n].label', label: 'Upload — label', domain: 'care_in_place', source: 'intake_v2', synopsisSection: 'diagnoses', repeatable: true, placeholderOnly: true }),
]

// ─── E. Main concerns (moderate client-side depth; deep digging = call sheet) ─

const CONCERN_FIELDS: [string, string, Partial<V2FieldDef>?][] = [
  ['own_words', 'The concern, in the client’s own words', { notes: 'Verbatim quote in the synopsis.' }],
  ['label', 'Short label for the concern'],
  ['duration', 'How long it has been present'],
  ['course', 'Course over time, as the client describes it'],
  ['location', 'Where it is felt'],
  ['character', 'What it feels like'],
  ['frequency', 'How often it happens'],
  ['aggravating', 'What makes it harder (client-reported)'],
  ['relieving', 'What eases it (client-reported)'],
  ['already_tried', 'What the client has already tried'],
  ['related_diagnosis', 'Reported diagnosis connected to this concern', { notes: 'Displays only as “reported diagnosis” / “diagnosed by X, as reported” — NI never asserts it.' }],
  ['related_tests', 'Tests connected to this concern, as reported'],
  ['desired_outcome', 'What the client hopes for'],
  ['missing_prompt', 'Details still to gather (call sheet)', { derived: true, callSheet: true, synopsisSection: null, notes: 'Derived for the practitioner call sheet — not asked client-side and never a conclusion.' }],
]

const CONCERNS: V2FieldDef[] = CONCERN_FIELDS.map(([key, label, extra]) =>
  f({ id: `intake.concerns[n].${key}`, label, domain: 'concerns', source: 'intake_v2', synopsisSection: 'concerns', repeatable: true, ...extra }))

// ─── F. Diagnoses / investigations / referrals ───────────────────────────────

const DIAGNOSES: V2FieldDef[] = [
  ['condition', 'Condition, as reported'],
  ['diagnosed_by', 'Who made the diagnosis (attribution)'],
  ['approx_date', 'Approximate date'],
  ['status', 'Status, as reported'],
  ['tests_done', 'Tests done, as reported'],
  ['tests_pending', 'Tests pending, as reported'],
  ['referral_status', 'Referral status, as reported'],
].map(([key, label]) =>
  f({ id: `intake.diagnoses[n].${key}`, label, domain: 'diagnoses', source: 'intake_v2', synopsisSection: 'diagnoses', repeatable: true,
      notes: key === 'condition' ? 'Every diagnosis is attributed/reported — NI never asserts one independently.' : undefined }))
DIAGNOSES.push(
  f({ id: 'intake.diagnoses[n].documents[m].file_ref', label: 'Related document (placeholder)', domain: 'diagnoses', source: 'intake_v2', synopsisSection: 'diagnoses', repeatable: true, placeholderOnly: true,
      notes: 'Links/placeholders only — never auto-parsed or interpreted.' }))

// ─── G/H. Medications & supplements ──────────────────────────────────────────

const MED_KEYS: [string, string][] = [
  ['name', 'Name, as written'],
  ['amount', 'Amount, exactly as written'],
  ['frequency', 'How often, as written'],
  ['form', 'Form (tablet, drops…)'],
  ['reason', 'Reason, in the client’s words'],
  ['advised_by', 'Who advised it'],
  ['start_duration', 'When it started / how long'],
  ['current_past', 'Current or past'],
  ['stopped_reason', 'Why it stopped (client’s account)'],
  ['effects', 'Effects noticed, in the client’s words'],
]

const MEDICATIONS: V2FieldDef[] = MED_KEYS.map(([key, label]) =>
  f({ id: `intake.medications[n].${key}`, label, domain: 'medications', source: 'intake_v2', synopsisSection: 'medications_supplements', repeatable: true }))
MEDICATIONS.push(
  f({ id: 'practitioner.medications.interaction_review', label: 'Interaction review (practitioner)', domain: 'medications', source: 'practitioner_call_sheet', synopsisSection: null, practitionerOnly: true, callSheet: true,
      notes: 'Call sheet only, never intake. NI draws no interaction conclusions.' }))

const SUPPLEMENTS: V2FieldDef[] = [...MED_KEYS, ['brand', 'Brand, as written'] as [string, string]].map(([key, label]) =>
  f({ id: `intake.supplements[n].${key}`, label, domain: 'supplements', source: 'intake_v2', synopsisSection: 'medications_supplements', repeatable: true,
      notes: key === 'brand' ? 'As written. NI never validates, promotes or suggests supplement changes.' : undefined }))

// ─── I. Family history — relative × category grid ────────────────────────────

export const V2_FAMILY_RELATIVES = [
  'mother', 'father', 'sibling[n]', 'child[n]',
  'grandparent_maternal_grandmother', 'grandparent_maternal_grandfather',
  'grandparent_paternal_grandmother', 'grandparent_paternal_grandfather',
  'other[n]',
] as const

export const V2_FAMILY_CATEGORIES = [
  'cardiovascular', 'blood_pressure', 'stroke', 'diabetes', 'cancer',
  'autoimmune', 'thyroid_endocrine', 'digestive', 'respiratory',
  'neuro_dementia', 'mental_health', 'atopy', 'osteoporosis_joint',
  'other', 'not_sure', 'detail',
] as const

const FAMILY: V2FieldDef[] = V2_FAMILY_RELATIVES.flatMap((relative) =>
  V2_FAMILY_CATEGORIES.map((category) =>
    f({ id: `intake.family.${relative}.${category}`,
        label: `Family history — ${relative.replace(/_/g, ' ').replace('[n]', '')} — ${category.replace(/_/g, ' ')}`,
        domain: 'family', source: 'intake_v2', synopsisSection: 'family_history', skippable: true,
        repeatable: relative.includes('[n]'),
        sensitive: category === 'mental_health',
        notes: category === 'mental_health'
          ? 'Sensitive — needs why-we-ask. Family history is never safety logic and NI never infers personal risk from it.'
          : undefined })))

// ─── J. Early life / past health (all skippable / “if known”) ────────────────

const EARLY_LIFE: V2FieldDef[] = [
  ['birth_details', 'Birth details, if known'],
  ['feeding', 'Early feeding, if known'],
  ['childhood_illnesses', 'Childhood illnesses'],
  ['recurrent_infections', 'Recurrent infections'],
  ['antibiotic_history', 'Antibiotic history, as recalled'],
  ['vaccination_reactions', 'Vaccination reactions (only if volunteered)'],
  ['injuries[n].description', 'Injury — what happened'],
  ['injuries[n].age', 'Injury — age'],
  ['surgeries[n].description', 'Surgery — what happened'],
  ['surgeries[n].age', 'Surgery — age'],
  ['dental', 'Dental history'],
  ['allergies', 'Allergies, as reported'],
].map(([key, label]) =>
  f({ id: `intake.early_life.${key}`, label, domain: 'early_life', source: 'intake_v2', synopsisSection: 'early_life', skippable: true,
      repeatable: key.includes('[n]'),
      notes: key === 'allergies' ? 'May surface in Safety ONLY if clinician-approved metadata exists.'
        : key === 'vaccination_reactions' ? 'Captured only if volunteered.' : undefined }))

// ─── K. Systems review — per-system instantiation ────────────────────────────

export const V2_SYSTEM_KEYS = [
  'digestive', 'nervous_head_senses', 'sleep', 'mood_stress',
  'energy_endocrine', 'immune_allergy', 'respiratory', 'urinary',
  'cardiovascular', 'musculoskeletal', 'skin_hair_nails', 'reproductive',
] as const

const SYSTEMS: V2FieldDef[] = V2_SYSTEM_KEYS.flatMap((system) => [
  f({ id: `intake.systems.${system}.symptoms`, label: `Systems — ${system.replace(/_/g, ' ')} — noticed (chips)`, domain: 'systems', source: 'intake_v2', synopsisSection: 'systems_review',
      notes: 'Safety surfacing comes ONLY from the clinician-owned safety_capture metadata on the underlying question.' }),
  f({ id: `intake.systems.${system}.frequency`, label: `Systems — ${system.replace(/_/g, ' ')} — how often (light)`, domain: 'systems', source: 'intake_v2', synopsisSection: 'systems_review' }),
  f({ id: `intake.systems.${system}.free_text`, label: `Systems — ${system.replace(/_/g, ' ')} — in their words`, domain: 'systems', source: 'intake_v2', synopsisSection: 'systems_review' }),
  f({ id: `intake.systems.${system}.none_reported`, label: `Systems — ${system.replace(/_/g, ' ')} — nothing noticed`, domain: 'systems', source: 'intake_v2', synopsisSection: 'systems_review' }),
  f({ id: `intake.systems.${system}.missing_prompt`, label: `Systems — ${system.replace(/_/g, ' ')} — still to gather (call sheet)`, domain: 'systems', source: 'intake_v2', synopsisSection: null, derived: true, callSheet: true,
      notes: 'Practitioner follow-up prompt, never a conclusion.' }),
])

// ─── L. Reproductive pathway (routed; all skippable; all sensitive) ──────────

const REPRODUCTIVE: V2FieldDef[] = [
  ['contraception_hrt_current', 'Contraception / HRT — current'],
  ['contraception_hrt_past', 'Contraception / HRT — past'],
  ['cycle_regularity', 'Cycle regularity'],
  ['cycle_length', 'Cycle length'],
  ['bleeding_duration', 'Bleeding duration'],
  ['heavy_periods', 'Heavy periods'],
  ['painful_periods', 'Painful periods'],
  ['irregular_periods', 'Irregular periods'],
  ['amenorrhoea', 'Absent periods'],
  ['intermenstrual_bleeding', 'Bleeding between periods'],
  ['bleeding_after_sex', 'Bleeding after sex'],
  ['pregnancies[n].outcome', 'Pregnancy — outcome'],
  ['pregnancies[n].year', 'Pregnancy — year'],
  ['pregnancy_losses[n].detail', 'Pregnancies or pregnancy losses you feel comfortable sharing'],
  ['fertility_concerns', 'Fertility, in their words'],
  ['current_pregnancy', 'Currently pregnant or possibly pregnant'],
  ['postpartum', 'Postpartum'],
  ['perimenopause_menopause', 'Perimenopause / menopause'],
  ['libido_sexual_health', 'Libido & sexual health'],
].map(([key, label]) =>
  f({ id: `intake.reproductive.${key}`, label, domain: 'reproductive', source: 'intake_v2', synopsisSection: 'systems_review', sensitive: true, skippable: true,
      repeatable: key.includes('[n]'),
      notes: key === 'pregnancy_losses[n].detail'
        ? 'Gentle and optional — no forced detail, no interpretation, never counted into anything. Safety surfacing only if clinician-approved metadata exists.'
        : 'Shown only when the pathway is selected; gentle why-we-ask language; no interpretation.' }))

// ─── M. Food, drink & kitchen reality ────────────────────────────────────────

const FOOD: V2FieldDef[] = [
  ['mode', 'How the client chose to describe food (diary OR good/average/difficult day)'],
  ['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner'], ['snacks', 'Snacks'],
  ['drinks', 'Drinks'], ['caffeine', 'Caffeine'], ['alcohol', 'Alcohol, as reported'],
  ['water', 'Water'], ['reactions', 'Foods that seem to disagree'], ['dislikes', 'Dislikes'],
  ['eating_speed', 'Eating speed'], ['chewing', 'Chewing'], ['screens_while_eating', 'Screens while eating'],
  ['on_the_go', 'Eating on the go'], ['skipped_meals', 'Skipped meals'], ['fullness_overeating', 'Fullness & overeating'],
  ['who_cooks', 'Who cooks'], ['shopping', 'Shopping'], ['budget', 'Budget reality'],
  ['batch_cooking', 'Batch cooking'], ['oils', 'Oils used'], ['cookware', 'Cookware'],
  ['appliances', 'Appliances'], ['barriers', 'Barriers to eating as they’d like'],
].map(([key, label]) =>
  f({ id: `intake.food.${key}`, label, domain: 'food', source: 'intake_v2', synopsisSection: 'food_kitchen',
      sensitive: key === 'alcohol',
      notes: key === 'alcohol' ? 'May surface only if clinician-approved. No automatic assessment.'
        : key === 'mode' ? 'Supports a diary OR the good/average/difficult-day pattern. Never assessed or graded.' : undefined }))

// ─── N. Lifestyle / environmental ────────────────────────────────────────────

const LIFESTYLE: V2FieldDef[] = [
  ['work_type', 'Work type'],
  ['physical_demands', 'Physical demands'],
  ['working_hours', 'Working hours'],
  ['movement_exercise', 'Movement & exercise'],
  ['sleep_routine', 'Sleep routine'],
  ['stress_load', 'Stress load, self-described'],
  ['coping_unwinding', 'Coping & unwinding'],
  ['caring_responsibilities', 'Caring responsibilities'],
  ['smoking_vaping', 'Smoking / vaping'],
  ['alcohol_pattern', 'Alcohol pattern, as reported'],
  ['recreational_substances', 'Recreational substances, as reported'],
  ['heat_cold_exposure', 'Heat / cold exposure'],
  ['mould_damp', 'Mould or damp at home'],
  ['home_environment', 'Home environment'],
  ['household_products', 'Household products'],
  ['cosmetics_skincare_hair', 'Cosmetics, skincare & hair products'],
  ['faith_cultural_practices', 'Faith & cultural practices'],
].map(([key, label]) =>
  f({ id: `intake.lifestyle.${key}`, label, domain: 'lifestyle', source: 'intake_v2', synopsisSection: 'lifestyle_environment',
      sensitive: ['smoking_vaping', 'alcohol_pattern', 'recreational_substances', 'stress_load'].includes(key),
      notes: key === 'faith_cultural_practices'
        ? 'Framed ONLY as practitioner accommodation — food, fasting, modesty and routine.'
        : key === 'stress_load' ? 'Self-reported, never NI-computed.' : undefined }))

// ─── O. Timeline ──────────────────────────────────────────────────────────────

const TIMELINE: V2FieldDef[] = [
  ['age_year', 'Age or year'],
  ['event_type', 'Health or life'],
  ['event_words', 'What happened, verbatim'],
  ['approx_confirmed', 'Approximate or confirmed'],
  ['source', 'Where the entry came from (typed, or suggested from the client’s own entries and confirmed by them)'],
  ['linked_concern', 'Linked concern, if the client links one'],
  ['key_moment', 'Client-marked key moment'],
].map(([key, label]) =>
  f({ id: `intake.timeline[n].${key}`, label, domain: 'timeline', source: 'intake_v2', synopsisSection: 'timeline', repeatable: true,
      notes: key === 'source'
        ? 'Suggestions may come ONLY from facts the client already entered, and must be client-confirmed/edited before submission. No interpretation.'
        : undefined }))

// ─── P. Physical observations — practitioner records; never asked client-side ─

const OBSERVATIONS: V2FieldDef[] = [
  ['tongue', 'Tongue'], ['nails', 'Nails'], ['face_eyes', 'Face & eyes'], ['skin', 'Skin'],
  ['build_distribution', 'Build & distribution'], ['other_notes', 'Other observation notes'],
].map(([key, label]) =>
  f({ id: `practitioner.observation.${key}`, label: `Observation — ${label}`, domain: 'observation', source: 'practitioner_call_sheet', synopsisSection: 'physical_observations', practitionerOnly: true, callSheet: true,
      notes: 'Recorded by the practitioner at consultation; the client is never asked to self-assess.' }))
OBSERVATIONS.push(
  f({ id: 'practitioner.observation.photo', label: 'Observation — photo (future module)', domain: 'observation', source: 'practitioner_call_sheet', synopsisSection: 'physical_observations', practitionerOnly: true, callSheet: true, placeholderOnly: true,
      notes: 'Future module only — storage/retention/legal decision required before build.' }))

// ─── Q. Safety review items — derived, never asked, never invented ───────────

const SAFETY: V2FieldDef[] = [
  ['source_question_id', 'Source question ID'],
  ['raw_answer', 'Raw reported answer'],
  ['captured_at', 'Captured at'],
  ['review_status', 'Practitioner review status'],
  ['acknowledgement', 'Practitioner acknowledgement'],
  ['action_note', 'Practitioner action note'],
].map(([key, label]) =>
  f({ id: `safety.review_item[n].${key}`, label: `Safety review — ${label}`, domain: 'safety', source: 'safety_derived', synopsisSection: 'safety_review', repeatable: true, derived: true,
      practitionerOnly: ['review_status', 'acknowledgement', 'action_note'].includes(key),
      notes: 'Derived ONLY from clinician-owned safety_capture metadata. Raw answers only — never a rank, urgency label, referral, test suggestion or triage. The practitioner adjudicates.' }))

// ─── R. Analysis & Plan — practitioner-authored; empty by default ────────────

const ANALYSIS: V2FieldDef[] = [
  ['antecedents', 'Antecedents'],
  ['triggers', 'Triggers'],
  ['mediators', 'Mediators'],
  ['systems_under_stress', 'Systems under stress'],
  ['red_flags_referrals', 'Red flags & referrals (practitioner’s adjudication)'],
  ['nutritional_assessment', 'Nutritional assessment (practitioner-authored)'],
  ['therapeutic_aims', 'Therapeutic aims'],
  ['diet_lifestyle_plan', 'Diet & lifestyle plan (practitioner-authored)'],
  ['supplement_plan', 'Supplement plan (practitioner-authored)'],
  ['review_interval', 'Review interval'],
  ['future_considerations', 'Future considerations'],
].map(([key, label]) =>
  f({ id: `practitioner.analysis.${key}`, label: `Analysis & Plan — ${label}`, domain: 'analysis', source: 'practitioner_analysis', synopsisSection: 'analysis_plan', practitionerOnly: true,
      notes: 'NI never pre-fills, suggests or drafts this. Intake may inform practitioner thinking, but NI does not write here. Any proposed AI assistance for this tab stops for Legal/MHRA review.' }))

// ─── The registry ─────────────────────────────────────────────────────────────

export const V2_FIELD_REGISTRY: V2FieldDef[] = [
  ...IDENTITY, ...CARE_CONTEXT, ...CASE_SNAPSHOT, ...CARE_IN_PLACE, ...CONCERNS,
  ...DIAGNOSES, ...MEDICATIONS, ...SUPPLEMENTS, ...FAMILY, ...EARLY_LIFE,
  ...SYSTEMS, ...REPRODUCTIVE, ...FOOD, ...LIFESTYLE, ...TIMELINE,
  ...OBSERVATIONS, ...SAFETY, ...ANALYSIS,
]

export function v2FieldById(id: string): V2FieldDef | undefined {
  return V2_FIELD_REGISTRY.find((field) => field.id === id)
}

/** Fields the CLIENT intake is allowed to write: never practitioner-only,
 *  never derived, and sourced from intake_v2 (profile/care-profile fields are
 *  ask-once elsewhere — the intake only CONFIRMS them). */
export function v2IntakeWritableFields(): V2FieldDef[] {
  return V2_FIELD_REGISTRY.filter((field) =>
    field.source === 'intake_v2' && !field.practitionerOnly && !field.derived)
}

/** Fields the intake screen shows read-only for confirmation (ask-once). */
export function v2ConfirmOnlyFields(): V2FieldDef[] {
  return V2_FIELD_REGISTRY.filter((field) => field.askOnce === true)
}

export function v2FieldsForDomain(domain: V2FieldDomain): V2FieldDef[] {
  return V2_FIELD_REGISTRY.filter((field) => field.domain === domain)
}
