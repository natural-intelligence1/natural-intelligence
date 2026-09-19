// ─── packages/db/src/intakeV2/legalProfiles.ts ────────────────────────────────
// Solicitor follow-up (approved): the Article 6/9 FRAMEWORK and the ADULT
// retention/deletion baseline. Encoded as pathway-based PROFILES with
// routing/purpose inheritance — not 384 bespoke legal decisions.
//
// Still outstanding with the solicitor (NOT covered here): the actual
// 115-question wording pass, and final safeguarding SOP wording.

// ═══ C1 — Lawful-basis profiles ═══════════════════════════════════════════════

export type Article6Basis =
  | 'art6_1_b_contract'
  | 'art6_1_a_consent'
  | 'art6_1_f_legitimate_interests'
  | 'case_specific_assessment_required'

export type Article9Condition =
  | 'art9_2_a_explicit_consent'
  | 'art9_2_h_health_social_care'
  | 'art9_2_c_vital_interests'
  | 'not_special_category'
  | 'case_specific_assessment_required'

export type LawfulBasisProfileId =
  | 'SELF_SERVE_HEALTH'
  | 'QUALIFYING_HEALTHCARE'
  | 'OPTIONAL_SPECIAL_CATEGORY'
  | 'SECURITY_ACCESS_AUDIT'
  | 'SAFEGUARDING'
  | 'VITAL_INTERESTS'
  | 'ACCOUNT_OPERATION'

export interface LawfulBasisProfile {
  id: LawfulBasisProfileId
  article6: Article6Basis
  article9: Article9Condition
  note: string
}

export const LAWFUL_BASIS_PROFILES: Record<LawfulBasisProfileId, LawfulBasisProfile> = {
  SELF_SERVE_HEALTH: {
    id: 'SELF_SERVE_HEALTH',
    article6: 'art6_1_b_contract',
    article9: 'art9_2_a_explicit_consent',
    note: 'Self-serve health data: contract + explicit consent.',
  },
  QUALIFYING_HEALTHCARE: {
    id: 'QUALIFYING_HEALTHCARE',
    article6: 'art6_1_b_contract',
    article9: 'art9_2_h_health_social_care',
    note: 'ONLY where the qualifying professional/confidentiality requirements are actually satisfied — see resolvePractitionerCareArticle9.',
  },
  OPTIONAL_SPECIAL_CATEGORY: {
    id: 'OPTIONAL_SPECIAL_CATEGORY',
    article6: 'art6_1_a_consent',
    article9: 'art9_2_a_explicit_consent',
    note: 'Optional special-category disclosures (e.g. faith practices): consent + explicit consent.',
  },
  SECURITY_ACCESS_AUDIT: {
    id: 'SECURITY_ACCESS_AUDIT',
    article6: 'art6_1_f_legitimate_interests',
    article9: 'not_special_category',
    note: 'Security/access/audit records: legitimate interests; avoid health content where possible.',
  },
  SAFEGUARDING: {
    id: 'SAFEGUARDING',
    article6: 'case_specific_assessment_required',
    article9: 'case_specific_assessment_required',
    note: 'CASE-SPECIFIC ONLY — never a generic health-data permission; assessed per incident under the SOP.',
  },
  VITAL_INTERESTS: {
    id: 'VITAL_INTERESTS',
    article6: 'case_specific_assessment_required',
    article9: 'art9_2_c_vital_interests',
    note: 'Only a genuine emergency where consent cannot be obtained.',
  },
  ACCOUNT_OPERATION: {
    id: 'ACCOUNT_OPERATION',
    article6: 'art6_1_b_contract',
    article9: 'not_special_category',
    note: 'Account identity/operation: the published privacy-policy §4 Contract basis; identity fields are not special-category data. Composition of approved framework elements — flagged for solicitor confirmation alongside the wording pass.',
  },
}

/** Article 9 routing for practitioner-led care. Article 9(2)(h) is NEVER
 *  applied automatically: it applies only where the qualifying
 *  professional/confidentiality requirements are actually established.
 *  For Category-2-only cases (or wherever that route is not established),
 *  explicit Article 9(2)(a) consent is the safe default. */
export function resolvePractitionerCareArticle9(context: {
  qualifyingConfidentialityEstablished: boolean
}): Article9Condition {
  return context.qualifyingConfidentialityEstablished
    ? 'art9_2_h_health_social_care'
    : 'art9_2_a_explicit_consent'
}

// ═══ C2 — Retention profiles (solicitor-approved ADULT baseline) ══════════════

export const MINOR_RETENTION_GATE =
  'MINOR RETENTION / SAFEGUARDING SCHEDULE REQUIRED BEFORE PRACTITIONER-LED UNDER-18 SERVICE ACTIVATION'

export type RetentionProfileId =
  | 'account_identity'
  | 'self_serve_health'
  | 'practitioner_care_record' // intake, case snapshot, corrections, Analysis & Plan, clinical provenance/audit
  | 'assignment_access_history'
  | 'student_case_activity'
  | 'governance_review_packs'
  | 'consent_records'
  | 'rights_requests'
  | 'safeguarding_records'

export interface RetentionProfile {
  id: RetentionProfileId
  adultBaseline: string
  deletionEligibility: 'eligible_for_deletion_on_request' | 'retained_subject_to_documented_rule'
  note?: string
}

export const RETENTION_PROFILES: Record<RetentionProfileId, RetentionProfile> = {
  account_identity: {
    id: 'account_identity',
    adultBaseline: 'While active/necessary; routine profile deletion within 90 days after closure, except justified retained records.',
    deletionEligibility: 'eligible_for_deletion_on_request',
  },
  self_serve_health: {
    id: 'self_serve_health',
    adultBaseline: 'While the account is active and the data is genuinely used by the functionality; user-deletable; dormant-account review required.',
    deletionEligibility: 'eligible_for_deletion_on_request',
  },
  practitioner_care_record: {
    id: 'practitioner_care_record',
    adultBaseline: '8 years after the care episode ends (intake, case snapshot, practitioner corrections/verifications, Analysis & Plan, clinical provenance/audit).',
    deletionEligibility: 'retained_subject_to_documented_rule',
  },
  assignment_access_history: {
    id: 'assignment_access_history',
    adultBaseline: 'Same case period (normally 8 years) where it evidences responsibility/access; raw technical security logs may be shorter.',
    deletionEligibility: 'retained_subject_to_documented_rule',
  },
  student_case_activity: {
    id: 'student_case_activity',
    adultBaseline: '8 years when part of care/provenance; standalone training/access administration may be shorter.',
    deletionEligibility: 'retained_subject_to_documented_rule',
  },
  governance_review_packs: {
    id: 'governance_review_packs',
    adultBaseline: '6 years after supersession unless client-specific, then inherit the client-record period.',
    deletionEligibility: 'retained_subject_to_documented_rule',
  },
  consent_records: {
    id: 'consent_records',
    adultBaseline: 'While relied upon, plus 6 years after withdrawal/end of reliance.',
    deletionEligibility: 'retained_subject_to_documented_rule',
  },
  rights_requests: {
    id: 'rights_requests',
    adultBaseline: '3 years after closure; up to 6 years where disputed/complained/legal relevance exists.',
    deletionEligibility: 'retained_subject_to_documented_rule',
  },
  safeguarding_records: {
    id: 'safeguarding_records',
    adultBaseline: 'Normally 8 years after adult case closure; longer where a legal hold applies.',
    deletionEligibility: 'retained_subject_to_documented_rule',
  },
}

/** Retention resolution. Minors NEVER silently inherit the adult schedule:
 *  the hard gate applies until a minor schedule is approved. */
export function resolveRetention(profileId: RetentionProfileId, context: { subjectIsMinor: boolean }):
  | { status: 'adult_baseline_approved'; profile: RetentionProfile }
  | { status: 'minor_schedule_required'; gate: typeof MINOR_RETENTION_GATE } {
  if (context.subjectIsMinor) return { status: 'minor_schedule_required', gate: MINOR_RETENTION_GATE }
  return { status: 'adult_baseline_approved', profile: RETENTION_PROFILES[profileId] }
}
