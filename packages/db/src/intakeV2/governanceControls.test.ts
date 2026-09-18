// ─── Solicitor controls 6, 7 & 8 — guard and gate tests ───────────────────────

import { describe, it, expect } from 'vitest'
import {
  canStudentAccessCase, canVerifyClinicalFacts, canSignClinicalConclusions,
  studentEntryRequiresClientConfirmation, canWriteAnalysisField,
  V2_STUDENT_ACCESS_REQUIREMENTS, LEGAL_MHRA_GATE_LABEL, LEGAL_MHRA_GATED_CAPABILITIES,
  type V2Actor, type V2StudentAccessContext,
} from './governanceControls'
import { V2_FIELD_REGISTRY } from './fieldRegistry'
import { deriveV2SafetyReviewItems } from './synopsisMapping'
import { V2_QUESTIONS } from './registry'

const fullContext: V2StudentAccessContext = {
  clientInformedOfStudent: true,
  namedSupervisorId: 'supervisor-1',
  supervisionActive: true,
  caseInvolvementActive: true,
}

describe('control 6 — student access is fail-closed', () => {
  it('grants access only when EVERY approved condition holds', () => {
    expect(canStudentAccessCase(fullContext)).toBe(true)
    expect(canStudentAccessCase({ ...fullContext, clientInformedOfStudent: false })).toBe(false)
    expect(canStudentAccessCase({ ...fullContext, namedSupervisorId: null })).toBe(false)
    expect(canStudentAccessCase({ ...fullContext, namedSupervisorId: '' })).toBe(false)
    expect(canStudentAccessCase({ ...fullContext, supervisionActive: false })).toBe(false)
    expect(canStudentAccessCase({ ...fullContext, caseInvolvementActive: false })).toBe(false)
  })

  it('a student can never independently verify facts or sign conclusions', () => {
    expect(canVerifyClinicalFacts('student')).toBe(false)
    expect(canSignClinicalConclusions('student')).toBe(false)
    expect(canVerifyClinicalFacts('practitioner')).toBe(true)
    expect(canSignClinicalConclusions('practitioner')).toBe(true)
  })

  it('student entries require client confirmation; the nine approved requirements are recorded', () => {
    expect(studentEntryRequiresClientConfirmation('student')).toBe(true)
    expect(studentEntryRequiresClientConfirmation('practitioner')).toBe(false)
    expect(V2_STUDENT_ACCESS_REQUIREMENTS).toHaveLength(9)
  })
})

describe('control 7 — practitioner-only Analysis & Plan', () => {
  const analysisIds = V2_FIELD_REGISTRY
    .filter((field) => field.id.startsWith('practitioner.analysis.'))
    .map((field) => field.id)

  it('ONLY the practitioner may write any practitioner.analysis.* field', () => {
    const blocked: V2Actor[] = ['client_intake', 'ai', 'ni_admin', 'student', 'automated_job', 'synopsis_generation']
    for (const fieldId of analysisIds) {
      expect(canWriteAnalysisField('practitioner', fieldId), fieldId).toBe(true)
      for (const actor of blocked) {
        expect(canWriteAnalysisField(actor, fieldId), `${actor} → ${fieldId}`).toBe(false)
      }
    }
  })

  it('the guard refuses non-analysis fields for everyone (it is not a general write path)', () => {
    expect(canWriteAnalysisField('practitioner', 'intake.concerns[n].own_words')).toBe(false)
    expect(canWriteAnalysisField('ai', 'intake.concerns[n].own_words')).toBe(false)
  })
})

describe('control 8 — hard LEGAL/MHRA change-control gate', () => {
  it('the gate is labelled exactly and lists all fifteen gated capabilities', () => {
    expect(LEGAL_MHRA_GATE_LABEL).toBe('LEGAL/MHRA REVIEW REQUIRED')
    expect(LEGAL_MHRA_GATED_CAPABILITIES).toHaveLength(15)
    for (const capability of ['confidence scores', 'disease prediction', 'personalised red-flag triage',
      'automated Analysis & Plan content', 'automatic care-plan generation']) {
      expect(LEGAL_MHRA_GATED_CAPABILITIES).toContain(capability)
    }
  })

  it('the current registry contains NO gated concept: no scoring/severity/risk/prediction field exists', () => {
    for (const field of V2_FIELD_REGISTRY) {
      expect(field.id, field.id).not.toMatch(/score|severity|risk|confidence|prediction|triage/i)
    }
  })

  it('no safety ranking/urgency/triage logic exists: derivation output shape is pinned and flat', () => {
    const flagged = V2_QUESTIONS.find((question) => question.samd === 'safety_capture' && question.safetyOptions?.length)!
    const [item] = deriveV2SafetyReviewItems([{ questionId: flagged.id, value: [flagged.safetyOptions![0]] }])
    expect(Object.keys(item).sort()).toEqual(
      ['capturedAt', 'matchedOptions', 'questionLabel', 'rawAnswer', 'reviewStatus', 'sourceQuestionId'])
    expect(JSON.stringify(item)).not.toMatch(/rank|urgen|triage|refer|severity|score/i)
  })
})
