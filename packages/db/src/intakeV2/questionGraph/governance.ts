// ─── packages/db/src/intakeV2/questionGraph/governance.ts ───────────────────
// Reports what governance metadata each canonical field and question carries,
// and what it does not.
//
// THIS MODULE DELIBERATELY FILLS IN NOTHING.
//
// Purpose, Article 6 lawful basis, Article 9 handling and retention are legal
// determinations. Code can report that they are absent; it must not invent
// them, and it must not let a validation suite pass by quietly supplying a
// default. A green test run that hid a missing lawful basis would be worse
// than no test at all.
//
// CURRENT POSITION, from the registry as it stands:
//
//   · V2FieldDef has no key for purpose, lawful basis, Article 9 handling or
//     retention. All 384 fields therefore lack all four.
//   · V2QuestionDef declares `retentionCategory?: string` — and not one of
//     the 115 questions sets it. Declared is not implemented.
//   · V2QuestionDef does populate `samd` on all 115, which is a different
//     control (Software as a Medical Device classification) and is not a
//     substitute for any of the four.

import { V2_FIELD_REGISTRY, type V2FieldDef } from '../fieldRegistry'
import { V2_QUESTIONS } from '../registry'

export type GovernanceRequirement = 'purpose' | 'article6_lawful_basis' | 'article9_handling' | 'retention'

export const GOVERNANCE_REQUIREMENTS: readonly GovernanceRequirement[] = Object.freeze([
  'purpose', 'article6_lawful_basis', 'article9_handling', 'retention',
])

/** Keys that would carry each requirement if they existed on V2FieldDef.
 *  Checked reflectively so that adding the key later makes the gap close
 *  on its own, rather than needing this file edited too. */
const FIELD_KEY_FOR: Record<GovernanceRequirement, string> = {
  purpose: 'purpose',
  article6_lawful_basis: 'lawfulBasis',
  article9_handling: 'article9Handling',
  retention: 'retention',
}

export interface FieldGovernanceGap {
  fieldId: string
  domain: string
  /** True where the field holds special-category health data and the Article
   *  9 gap therefore matters most. Derived from the registry's own `sensitive`
   *  flag and health-bearing domains — NOT a legal determination, only a
   *  prioritisation hint. */
  likelySpecialCategory: boolean
  missing: GovernanceRequirement[]
}

const HEALTH_DOMAINS = new Set([
  'concerns', 'diagnoses', 'medications', 'supplements', 'family', 'early_life',
  'systems', 'reproductive', 'timeline', 'observation', 'safety', 'analysis',
])

function missingFor(field: V2FieldDef): GovernanceRequirement[] {
  const asRecord = field as unknown as Record<string, unknown>
  return GOVERNANCE_REQUIREMENTS.filter((req) => {
    const value = asRecord[FIELD_KEY_FOR[req]]
    return value === undefined || value === null || value === ''
  })
}

export function fieldGovernanceGaps(): FieldGovernanceGap[] {
  return V2_FIELD_REGISTRY
    .map((field) => ({
      fieldId: field.id,
      domain: field.domain,
      likelySpecialCategory: HEALTH_DOMAINS.has(field.domain) || field.sensitive === true,
      missing: missingFor(field),
    }))
    .filter((g) => g.missing.length > 0)
}

export interface QuestionGovernanceGap {
  questionId: string
  missingRetentionCategory: boolean
  missingWhyWeAsk: boolean
  hasSamd: boolean
}

export function questionGovernanceGaps(): QuestionGovernanceGap[] {
  return V2_QUESTIONS
    .map((q) => ({
      questionId: q.id,
      missingRetentionCategory: !q.retentionCategory,
      // Only flagged where the question is marked sensitive: a why-we-ask
      // line is required there, and merely nice elsewhere.
      missingWhyWeAsk: q.sensitive === true && !q.whyWeAsk,
      hasSamd: Boolean(q.samd),
    }))
    .filter((g) => g.missingRetentionCategory || g.missingWhyWeAsk || !g.hasSamd)
}

export interface GovernanceSummary {
  totalFields: number
  fieldsWithAnyGap: number
  fieldsMissingByRequirement: Record<GovernanceRequirement, number>
  fieldsLikelySpecialCategoryWithGaps: number
  totalQuestions: number
  questionsMissingRetentionCategory: number
  sensitiveQuestionsMissingWhyWeAsk: number
  questionsWithSamd: number
  /** True when nothing is missing anywhere. Currently false, and it should
   *  stay false until the metadata is actually authored. */
  complete: boolean
}

export function summariseGovernance(): GovernanceSummary {
  const fieldGaps = fieldGovernanceGaps()
  const qGaps = questionGovernanceGaps()

  const byReq = { purpose: 0, article6_lawful_basis: 0, article9_handling: 0, retention: 0 } as Record<GovernanceRequirement, number>
  for (const g of fieldGaps) for (const m of g.missing) byReq[m] += 1

  return {
    totalFields: V2_FIELD_REGISTRY.length,
    fieldsWithAnyGap: fieldGaps.length,
    fieldsMissingByRequirement: byReq,
    fieldsLikelySpecialCategoryWithGaps: fieldGaps.filter((g) => g.likelySpecialCategory).length,
    totalQuestions: V2_QUESTIONS.length,
    questionsMissingRetentionCategory: qGaps.filter((g) => g.missingRetentionCategory).length,
    sensitiveQuestionsMissingWhyWeAsk: qGaps.filter((g) => g.missingWhyWeAsk).length,
    questionsWithSamd: V2_QUESTIONS.filter((q) => Boolean(q.samd)).length,
    complete: fieldGaps.length === 0 && qGaps.length === 0,
  }
}
