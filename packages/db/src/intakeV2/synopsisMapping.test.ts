// ─── Intake-to-Synopsis mapping v1 — order, coverage and safety tests ─────────

import { describe, it, expect } from 'vitest'
import {
  V2_SYNOPSIS_SECTIONS, V2_INTAKE_SCREEN_SEQUENCE, v2FieldsForSynopsisSection,
  deriveV2SafetyReviewItems, V2_SAFETY_BLOCK_TITLE, V2_SAFETY_BOUNDARY_TEXT, V2_SAFETY_EMPTY_STATE,
  V2_NON_MONITORING_WORDING, buildV2SynopsisAuditMetadata,
  V2_INTAKE_SCHEMA_VERSION, V2_SYNOPSIS_WORKFLOW_VERSION,
} from './synopsisMapping'
import { buildV2QuestionWordingReview } from './wordingReview'
import { V2_FIELD_REGISTRY } from './fieldRegistry'
import { V2_QUESTIONS } from './registry'

describe('synopsis section sequence', () => {
  it('is the approved 13-section order, safety first, Analysis & Plan last as a separate tab', () => {
    expect(V2_SYNOPSIS_SECTIONS.map((section) => section.id)).toEqual([
      'safety_review', 'case_snapshot', 'concerns', 'diagnoses', 'timeline',
      'medications_supplements', 'family_history', 'early_life', 'systems_review',
      'physical_observations', 'food_kitchen', 'lifestyle_environment', 'analysis_plan',
    ])
    expect(V2_SYNOPSIS_SECTIONS.map((section) => section.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
    expect(V2_SYNOPSIS_SECTIONS[0].title).toBe(V2_SAFETY_BLOCK_TITLE)
    expect(V2_SYNOPSIS_SECTIONS.at(-1)?.separateTab).toBe(true)
  })

  it('carries the exact approved safety boundary and empty-state wording', () => {
    // Solicitor-approved heading (18 Sep 2026 terminology ruling).
    expect(V2_SAFETY_BLOCK_TITLE).toBe('Safety-related information reported by client')
    expect(V2_SAFETY_BOUNDARY_TEXT).toBe(
      'Natural Intelligence surfaces reported answers for practitioner review. It does not assess risk, rank urgency or make referral decisions.')
    expect(V2_SAFETY_EMPTY_STATE).toBe('No safety-review answers are currently available from the approved trigger set.')
  })

  it('every registry destination is a real section, and every section has fields', () => {
    const sectionIds = new Set(V2_SYNOPSIS_SECTIONS.map((section) => section.id))
    for (const field of V2_FIELD_REGISTRY) {
      if (field.synopsisSection !== null) {
        expect(sectionIds.has(field.synopsisSection), field.id).toBe(true)
      }
    }
    for (const section of V2_SYNOPSIS_SECTIONS) {
      expect(v2FieldsForSynopsisSection(section.id).length, section.id).toBeGreaterThan(0)
    }
  })
})

describe('intake screen sequence', () => {
  it('is the approved 16-screen order: consent first, review last', () => {
    expect(V2_INTAKE_SCREEN_SEQUENCE).toHaveLength(16)
    expect(V2_INTAKE_SCREEN_SEQUENCE[0]).toBe('Consent gate')
    expect(V2_INTAKE_SCREEN_SEQUENCE[1]).toBe('Confirm your details')
    expect(V2_INTAKE_SCREEN_SEQUENCE.at(-1)).toBe('Review and submit')
  })
})

describe('safety review derivation — clinician-owned metadata only', () => {
  const flaggedQuestion = V2_QUESTIONS.find((q) => q.samd === 'safety_capture' && q.safetyOptions && q.safetyOptions.length > 0)!
  const flaggedOption = flaggedQuestion.safetyOptions![0]
  const plainOption = (flaggedQuestion.options ?? []).find((option) => !flaggedQuestion.safetyOptions!.includes(option))!

  it('surfaces the RAW answer when a clinician-enumerated option is present', () => {
    const items = deriveV2SafetyReviewItems([
      { questionId: flaggedQuestion.id, value: [flaggedOption, plainOption], capturedAt: '2026-09-16T10:00:00Z' },
    ])
    expect(items).toHaveLength(1)
    expect(items[0].sourceQuestionId).toBe(flaggedQuestion.id)
    expect(items[0].rawAnswer).toEqual([flaggedOption, plainOption]) // verbatim, complete
    expect(items[0].matchedOptions).toEqual([flaggedOption])
    expect(items[0].capturedAt).toBe('2026-09-16T10:00:00Z')
    expect(items[0].reviewStatus).toBe('unreviewed') // practitioner adjudicates
  })

  it('invents NO flags: answers outside the clinician set produce nothing', () => {
    expect(deriveV2SafetyReviewItems([
      { questionId: flaggedQuestion.id, value: [plainOption] },
      { questionId: 'v2.arrival.feeling_words', value: 'free text mentioning anything at all' },
      { questionId: 'not.a.question', value: ['whatever'] },
    ])).toEqual([])
  })

  it('produces no ranking, urgency, referral or triage concept — only the approved fields', () => {
    const items = deriveV2SafetyReviewItems([{ questionId: flaggedQuestion.id, value: [flaggedOption] }])
    expect(Object.keys(items[0]).sort()).toEqual(
      ['capturedAt', 'matchedOptions', 'questionLabel', 'rawAnswer', 'reviewStatus', 'sourceQuestionId'])
  })
})

describe('control 2 — static emergency / non-monitoring wording', () => {
  it('carries the exact solicitor-required sentence, as a static constant', () => {
    expect(V2_NON_MONITORING_WORDING).toBe(
      'Natural Intelligence is not an emergency service, and information submitted through this ' +
      'intake is not continuously monitored. If you need urgent medical help, contact your GP, ' +
      'NHS 111 or 999 as appropriate.')
  })
})

describe('control 4 — synopsis provenance / audit metadata', () => {
  it('the audit record carries every solicitor-required property and is frozen', () => {
    const metadata = buildV2SynopsisAuditMetadata({
      generatedAt: '2026-09-18T10:00:00Z',
      sourceSubmissionRef: 'intake-session:synthetic-fixture',
      sourceFieldIds: ['intake.concerns[n].own_words', 'intake.medications[n].name'],
    })
    expect(metadata.generatedAt).toBe('2026-09-18T10:00:00Z')
    expect(metadata.sourceSubmissionRef).toBe('intake-session:synthetic-fixture')
    expect(metadata.intakeSchemaVersion).toBe(V2_INTAKE_SCHEMA_VERSION)
    expect(metadata.synopsisWorkflowVersion).toBe(V2_SYNOPSIS_WORKFLOW_VERSION)
    expect(metadata.sourceFieldIds).toEqual(['intake.concerns[n].own_words', 'intake.medications[n].name'])
    expect(Object.isFrozen(metadata)).toBe(true)
    expect(Object.keys(metadata).sort()).toEqual(
      ['generatedAt', 'intakeSchemaVersion', 'sourceFieldIds', 'sourceSubmissionRef', 'synopsisWorkflowVersion'])
  })
})

describe('task 10 — question-wording review pack', () => {
  const pack = buildV2QuestionWordingReview()

  it('is generated from the canonical registry: every question id appears with its verbatim label', () => {
    for (const question of V2_QUESTIONS) {
      expect(pack).toContain(`\`${question.id}\``)
      expect(pack).toContain(question.label)
    }
    expect(pack).toContain('SOLICITOR WORDING REVIEW REQUIRED')
    expect(pack).toContain('LEGAL SECOND PASS — GREEN')
  })

  it('contains no synthetic client answers and no legal conclusions', () => {
    expect(pack).not.toContain('Rowan')
    expect(pack).not.toMatch(/we (conclude|advise|consider) /i)
  })
})
