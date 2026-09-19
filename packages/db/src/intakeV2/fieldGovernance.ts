// ─── packages/db/src/intakeV2/fieldGovernance.ts ──────────────────────────────
// Solicitor controls 1 and 5 (LEGAL SECOND PASS — GREEN, 18 Sep 2026):
//   Control 1 — field-purpose / data-minimisation metadata
//   Control 5 — retention / deletion rules in the field registry
//
// Every field in the Field Registry v1 resolves — directly or through
// domain inheritance — to a complete governance record: purpose,
// required/optional, conditional rule, sensitivity, access scope, sharing
// scope, export eligibility, provenance behaviour, Article 6 / Article 9
// placeholders, and retention/deletion metadata.
//
// LEGAL VALUES COME FROM THE APPROVED FRAMEWORK, NEVER GUESSED. The
// solicitor has approved the Article 6/9 framework and the ADULT
// retention/deletion baseline (see legalProfiles.ts): fields inherit
// pathway-based PROFILES, with Article 9(2)(h) never applied automatically
// (safe default remains explicit consent) and minors NEVER inheriting the
// adult retention schedule (hard gate in legalProfiles.resolveRetention).
// Still outstanding with the solicitor: the 115-question wording pass and
// final safeguarding SOP wording.

import type { V2FieldDef, V2FieldDomain } from './fieldRegistry'
import { V2_FIELD_REGISTRY } from './fieldRegistry'
import {
  LAWFUL_BASIS_PROFILES, RETENTION_PROFILES, resolvePractitionerCareArticle9,
  type LawfulBasisProfileId, type RetentionProfileId,
  type Article6Basis, type Article9Condition,
} from './legalProfiles'

// ─── Resolved governance record ───────────────────────────────────────────────

/** Kept for any future field whose basis is genuinely unresolved. */
export type V2LegalBasisState = 'legal_review_required'

export type V2DeletionEligibility =
  /* A */ | 'eligible_for_deletion_on_request'
  /* B */ | 'retained_subject_to_documented_rule'
  | 'retention_policy_pending'
  | 'legal_review_required'

export interface V2FieldGovernance {
  purpose: string
  requirement: 'required' | 'optional'
  conditionalRule: string | null
  sensitivity: 'standard' | 'sensitive'
  accessScope: 'client_and_practitioner' | 'practitioner_only' | 'operational_only'
  sharingScope: 'assigned_practitioner_only' | 'not_shared_operational'
  exportEligible: boolean
  provenanceBehaviour: 'sourced_fact' | 'derived' | 'practitioner_authored'
  /** Solicitor-approved lawful-basis PROFILE this field inherits. */
  lawfulBasisProfile: LawfulBasisProfileId
  /** UK GDPR Article 6 basis — from the approved framework. */
  article6Basis: Article6Basis
  /** UK GDPR Article 9 condition — from the approved framework. For
   *  practitioner-care health fields this is the SAFE DEFAULT 9(2)(a);
   *  9(2)(h) applies only via resolvePractitionerCareArticle9 where the
   *  qualifying confidentiality route is actually established. */
  article9Condition: Article9Condition
  retentionProfileId: RetentionProfileId
  retentionRuleId: string
  retentionStatus: 'adult_baseline_approved'
  deletionEligibility: V2DeletionEligibility
  retentionReason: string
}

/** Candidate lawful bases, quoted from the published privacy policy §4
 *  ("Legal basis for processing") — for SOLICITOR CONFIRMATION per domain.
 *  These are candidates only; no field resolves to them until confirmed. */
export const V2_CANDIDATE_LAWFUL_BASES = {
  source: 'apps/web/app/legal/privacy — §4 Legal basis for processing (published policy)',
  candidates: [
    'Contract — processing necessary to provide the service you have signed up for.',
    'Explicit consent — for special-category health data you voluntarily enter (Article 9(2)(a) UK GDPR).',
    'Legitimate interests — for platform security and abuse prevention.',
  ],
} as const

// ─── Domain defaults (inheritance layer) ──────────────────────────────────────

interface DomainDefaults {
  purpose: string
  conditionalRule: string | null
  sensitivity: 'standard' | 'sensitive'
  retentionProfileId: RetentionProfileId
  lawfulBasisProfile: LawfulBasisProfileId
}

// Practitioner-care intake fields inherit the practitioner-care record
// retention profile (approved adult baseline: 8 years after the care
// episode ends) and the QUALIFYING_HEALTHCARE lawful-basis profile with
// the SAFE-DEFAULT Article 9 routing (explicit consent unless the
// qualifying confidentiality route is established for the case).
const HEALTH_RECORD_RETENTION = {
  retentionProfileId: 'practitioner_care_record' as const,
  lawfulBasisProfile: 'QUALIFYING_HEALTHCARE' as const,
}

const DOMAIN_DEFAULTS: Record<V2FieldDomain, DomainDefaults> = {
  identity: {
    purpose: 'Identify the account holder and address them correctly (asked once at onboarding; intake confirms only).',
    conditionalRule: null, sensitivity: 'standard',
    retentionProfileId: 'account_identity',
    lawfulBasisProfile: 'ACCOUNT_OPERATION',
  },
  care_context: {
    purpose: 'Care context the practitioner needs to take the case respectfully (asked once; intake confirms only).',
    conditionalRule: null, sensitivity: 'sensitive', ...HEALTH_RECORD_RETENTION,
  },
  case_snapshot: {
    purpose: 'Point-in-time record of what was submitted, so the case as seen at submission is preserved.',
    conditionalRule: 'Derived only at submission; never asked.', sensitivity: 'sensitive', ...HEALTH_RECORD_RETENTION,
  },
  care_in_place: {
    purpose: 'Record the care the client already has so NI care fits around it (GP, specialists, pending items).',
    conditionalRule: null, sensitivity: 'sensitive', ...HEALTH_RECORD_RETENTION,
  },
  concerns: {
    purpose: 'Capture the client’s presenting concerns factually, in their own words, for their practitioner.',
    conditionalRule: null, sensitivity: 'sensitive', ...HEALTH_RECORD_RETENTION,
  },
  diagnoses: {
    purpose: 'Record diagnoses, investigations and referrals exactly as reported and attributed by the client.',
    conditionalRule: null, sensitivity: 'sensitive', ...HEALTH_RECORD_RETENTION,
  },
  medications: {
    purpose: 'Record medication facts exactly as written so the practitioner sees the full picture.',
    conditionalRule: null, sensitivity: 'sensitive', ...HEALTH_RECORD_RETENTION,
  },
  supplements: {
    purpose: 'Record supplement facts exactly as written so the practitioner sees the full picture.',
    conditionalRule: null, sensitivity: 'sensitive', ...HEALTH_RECORD_RETENTION,
  },
  family: {
    purpose: 'Family health context as the client recalls it — context for the practitioner, never NI inference.',
    conditionalRule: 'Whole chapter optional; every cell skippable.', sensitivity: 'sensitive', ...HEALTH_RECORD_RETENTION,
  },
  early_life: {
    purpose: 'Early-life and past-health context, "if known" — part of the whole-person story.',
    conditionalRule: 'Every field skippable / "if known".', sensitivity: 'sensitive', ...HEALTH_RECORD_RETENTION,
  },
  systems: {
    purpose: 'Screening-depth factual review across body systems, in the client’s selections and words.',
    conditionalRule: 'System detail appears only when the client selects that system in the overview.',
    sensitivity: 'sensitive', ...HEALTH_RECORD_RETENTION,
  },
  reproductive: {
    purpose: 'Reproductive and hormonal health facts, captured respectfully on the client’s chosen pathway.',
    conditionalRule: 'Shown only when the client’s selected reproductive pathway includes it; every question skippable.',
    sensitivity: 'sensitive', ...HEALTH_RECORD_RETENTION,
  },
  food: {
    purpose: 'The honest food, drink and kitchen reality — facts for the practitioner, never assessed by NI.',
    conditionalRule: 'Mode-dependent: diary OR good/average/difficult-day pattern, as the client chooses.',
    sensitivity: 'sensitive', ...HEALTH_RECORD_RETENTION,
  },
  lifestyle: {
    purpose: 'Life, work, environment and practice context so care fits the client’s actual life.',
    conditionalRule: null, sensitivity: 'sensitive', ...HEALTH_RECORD_RETENTION,
  },
  timeline: {
    purpose: 'The client’s own health-and-life timeline, with their emphasis, for the practitioner.',
    conditionalRule: 'Suggestions only from facts the client already entered; client-confirmed before joining.',
    sensitivity: 'sensitive', ...HEALTH_RECORD_RETENTION,
  },
  observation: {
    purpose: 'Practitioner-recorded physical observations at consultation (never client self-assessment).',
    conditionalRule: 'Recorded by the practitioner at consultation only.', sensitivity: 'sensitive', ...HEALTH_RECORD_RETENTION,
  },
  safety: {
    purpose: 'Surface clinician-flagged reported answers, raw and unassessed, for practitioner adjudication.',
    conditionalRule: 'Derived only from clinician-owned safety_capture metadata; never asked.',
    sensitivity: 'sensitive', ...HEALTH_RECORD_RETENTION,
  },
  analysis: {
    purpose: 'The practitioner’s own analysis and plan — authored, owned and approved by the practitioner alone.',
    conditionalRule: 'Practitioner-authored only; empty until the practitioner writes.', sensitivity: 'sensitive', ...HEALTH_RECORD_RETENTION,
  },
}

// ─── Resolver ─────────────────────────────────────────────────────────────────

/** The only REQUIRED fields — mirrors the legally-required set already
 *  enforced in the question registry (full name, DOB, pathway, the concern
 *  in the client's own words). Everything else is optional/skippable —
 *  data minimisation by default. */
export const V2_REQUIRED_FIELD_IDS = [
  'profile.legal_name',
  'profile.dob',
  'care_profile.reproductive_pathway',
  'intake.concerns[n].own_words',
] as const

export function resolveV2FieldGovernance(field: V2FieldDef): V2FieldGovernance {
  const defaults = DOMAIN_DEFAULTS[field.domain]
  const operational = field.exportExcluded === true

  // Field-level profile overrides (kept to the genuinely different cases —
  // no 384 bespoke decisions):
  //  • optional faith/cultural disclosure → OPTIONAL_SPECIAL_CATEGORY;
  //  • student case-activity fields would map student_case_activity when a
  //    student surface exists (none does yet).
  const lawfulBasisProfile: LawfulBasisProfileId =
    field.id === 'intake.lifestyle.faith_cultural_practices' ? 'OPTIONAL_SPECIAL_CATEGORY'
    : defaults.lawfulBasisProfile
  const profile = LAWFUL_BASIS_PROFILES[lawfulBasisProfile]

  // Practitioner-care health fields carry the SAFE-DEFAULT Article 9
  // (explicit consent). 9(2)(h) applies only per case via
  // resolvePractitionerCareArticle9 when the qualifying confidentiality
  // route is actually established — never automatically.
  const article9 = lawfulBasisProfile === 'QUALIFYING_HEALTHCARE'
    ? resolvePractitionerCareArticle9({ qualifyingConfidentialityEstablished: false })
    : profile.article9

  const retention = RETENTION_PROFILES[defaults.retentionProfileId]

  return {
    purpose: defaults.purpose + (field.notes ? ` ${field.notes}` : ''),
    requirement: (V2_REQUIRED_FIELD_IDS as readonly string[]).includes(field.id) ? 'required' : 'optional',
    conditionalRule: defaults.conditionalRule,
    sensitivity: field.sensitive ? 'sensitive' : defaults.sensitivity,
    accessScope: operational ? 'operational_only'
      : field.practitionerOnly ? 'practitioner_only'
      : 'client_and_practitioner',
    sharingScope: operational ? 'not_shared_operational' : 'assigned_practitioner_only',
    exportEligible: !operational && field.synopsisSection !== null,
    provenanceBehaviour: field.source === 'practitioner_analysis' || field.practitionerOnly ? 'practitioner_authored'
      : field.derived ? 'derived'
      : 'sourced_fact',
    lawfulBasisProfile,
    article6Basis: profile.article6,
    article9Condition: article9,
    retentionProfileId: defaults.retentionProfileId,
    retentionRuleId: `retention.${defaults.retentionProfileId}.adult.v1`,
    retentionStatus: 'adult_baseline_approved',
    deletionEligibility: retention.deletionEligibility,
    retentionReason: retention.adultBaseline,
  }
}

/** Full resolved table — used by tests and the wording-review generator. */
export function resolveAllV2FieldGovernance(): { field: V2FieldDef; governance: V2FieldGovernance }[] {
  return V2_FIELD_REGISTRY.map((field) => ({ field, governance: resolveV2FieldGovernance(field) }))
}
