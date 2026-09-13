// V2 question registry validation + branching + no-interpretation guarantees.
import { describe, it, expect, afterEach } from 'vitest'
import { V2_QUESTIONS, V2_SECTIONS, v2SafetyCaptureIds } from './registry'
import {
  isIntakeV2Enabled, visibleSections, visibleQuestions, missingRequired,
  hasSafetyCaptureAnswers,
} from './flow'
import { CALL_SHEET_TREES, callSheetTreesForAnswers } from './callSheet'

const SECTION_IDS = V2_SECTIONS.map((s) => s.id)

describe('V2 registry — structural validity', () => {
  it('question ids are unique and v2-prefixed', () => {
    const ids = V2_QUESTIONS.map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id.startsWith('v2.')).toBe(true)
  })

  it('every question has a valid section, screen, version and type', () => {
    for (const q of V2_QUESTIONS) {
      expect(SECTION_IDS).toContain(q.section)
      expect(q.screen).toBeGreaterThan(0)
      expect(q.version).toBe(1)
      expect(q.type.length).toBeGreaterThan(0)
      expect(q.label.length).toBeGreaterThan(3)
    }
  })

  it('every question carries a SaMD classification, service path, source and mappings', () => {
    for (const q of V2_QUESTIONS) {
      expect(['collect_only', 'safety_capture', 'practitioner_only', 'held_back']).toContain(q.samd)
      expect(['all', 'self_serve', 'practitioner_led']).toContain(q.servicePath)
      expect(q.source).toBe('client') // the client flow ships client questions only
      expect(q.practitionerViewSection.length).toBeGreaterThan(0)
      expect(q.summarySection.length).toBeGreaterThan(0)
    }
  })

  it('select/multichip/frequency questions all carry options', () => {
    for (const q of V2_QUESTIONS) {
      if (['select', 'multichip', 'frequency', 'stool_form'].includes(q.type)) {
        expect(q.options && q.options.length >= 2, q.id).toBe(true)
      }
      if (q.type === 'repeatable') {
        expect(q.itemFields && q.itemFields.length >= 1, q.id).toBe(true)
      }
    }
  })

  it('legally required questions are present and required', () => {
    for (const id of ['v2.about.full_name', 'v2.about.dob', 'v2.about.pathway', 'v2.concerns.own_words', 'v2.review.confirmed']) {
      const q = V2_QUESTIONS.find((entry) => entry.id === id)
      expect(q, id).toBeDefined()
      expect(q!.required).toBe(true)
    }
    // GP-contact permission exists as its OWN question (separate consent)
    expect(V2_QUESTIONS.find((q) => q.id === 'v2.care.gp_contact_permission')).toBeDefined()
  })

  it('every required client-flow domain is covered by at least one question', () => {
    const covered = new Set(V2_QUESTIONS.map((q) => q.section))
    for (const section of SECTION_IDS.filter((s) => s !== 'review')) {
      expect(covered.has(section), section).toBe(true)
    }
  })

  it('safety-capture questions enumerate their safety options', () => {
    for (const q of V2_QUESTIONS.filter((entry) => entry.samd === 'safety_capture')) {
      expect(q.safetyOptions && q.safetyOptions.length > 0, q.id).toBe(true)
      for (const option of q.safetyOptions!) {
        expect(q.options, q.id).toContain(option)
      }
    }
    expect(v2SafetyCaptureIds().length).toBeGreaterThanOrEqual(10)
  })

  it('user-facing copy contains no banned interpretive/claims language', () => {
    const banned = [
      'root cause', 'most likely', 'diagnos', 'detect', 'predict', 'prognosis',
      'we recommend', 'prescription', 'dosage', 'protocol', 'high risk', 'low risk',
      'urgent risk', 'likely condition', 'clinical risk', 'this suggests', 'this explains',
    ]
    for (const q of V2_QUESTIONS) {
      const copy = [q.label, q.help ?? '', q.whyWeAsk ?? '', ...(q.options ?? []),
        ...(q.itemFields ?? []).flatMap((f) => [f.label, ...(f.options ?? [])])].join(' | ').toLowerCase()
      for (const term of banned) {
        expect(copy.includes(term), `${q.id} contains banned term '${term}'`).toBe(false)
      }
    }
  })

  it('sensitive questions explain why we ask', () => {
    for (const q of V2_QUESTIONS.filter((entry) => entry.sensitive)) {
      expect((q.whyWeAsk ?? '').length > 10 || (q.help ?? '').length > 10, q.id).toBe(true)
    }
  })
})

describe('V2 flow — flag, branching and progressive disclosure', () => {
  const FLAG = 'INTAKE_V2_ENABLED'
  const saved = process.env[FLAG]
  afterEach(() => { if (saved === undefined) delete process.env[FLAG]; else process.env[FLAG] = saved })

  it('V2 is OFF by default and only exactly "true" enables it', () => {
    delete process.env[FLAG]
    expect(isIntakeV2Enabled()).toBe(false)
    for (const v of ['TRUE', '1', 'yes', 'false']) { process.env[FLAG] = v; expect(isIntakeV2Enabled()).toBe(false) }
    process.env[FLAG] = 'true'
    expect(isIntakeV2Enabled()).toBe(true)
  })

  it('system detail sections appear only when the system is selected', () => {
    const none = visibleSections({ 'v2.systems.noticed': ['None of these'] }).map((s) => s.id)
    expect(none).not.toContain('digestion')
    expect(none).not.toContain('heart')
    const some = visibleSections({ 'v2.systems.noticed': ['Digestion', 'Sleep'] }).map((s) => s.id)
    expect(some).toContain('digestion')
    expect(some).toContain('sleep')
    expect(some).not.toContain('urinary')
  })

  it('reproductive questions route by pathway and never cross over', () => {
    const female = visibleQuestions('reproductive', { 'v2.about.pathway': 'Female health questions apply to me' }).map((q) => q.id)
    expect(female).toContain('v2.repro.female')
    expect(female).not.toContain('v2.repro.male')
    const male = visibleQuestions('reproductive', { 'v2.about.pathway': 'Male health questions apply to me' }).map((q) => q.id)
    expect(male).toContain('v2.repro.male')
    expect(male).not.toContain('v2.repro.female')
    // prefer-not-to-say sees neither branch, only the skippable shared question
    const neither = visibleQuestions('reproductive', { 'v2.about.pathway': 'Prefer not to say' }).map((q) => q.id)
    expect(neither).not.toContain('v2.repro.female')
    expect(neither).not.toContain('v2.repro.male')
    expect(neither).toContain('v2.repro.sexual_health')
  })

  it('missingRequired gates submission on the factual essentials only', () => {
    const missing = missingRequired({}).map((q) => q.id)
    expect(missing).toContain('v2.about.full_name')
    expect(missing).toContain('v2.concerns.own_words')
    const done = missingRequired({
      'v2.about.full_name': 'Test Person', 'v2.about.dob': '1980-01-01',
      'v2.about.pathway': 'Prefer not to say',
      'v2.concerns.own_words': 'I would like to understand my energy.',
      'v2.review.confirmed': 'Yes',
    })
    expect(done).toHaveLength(0)
  })

  it('safety-capture detection is internal and structural (no client-facing output)', () => {
    expect(hasSafetyCaptureAnswers({ 'v2.digestion.noticed': ['Bloating'] })).toBe(false)
    expect(hasSafetyCaptureAnswers({ 'v2.digestion.noticed': ['Blood in the stool'] })).toBe(true)
    expect(hasSafetyCaptureAnswers({ 'v2.mood.safety': 'Sometimes' })).toBe(true)
    expect(hasSafetyCaptureAnswers({ 'v2.mood.safety': 'No' })).toBe(false)
  })
})

describe('practitioner call-sheet scaffold — structural only', () => {
  it('trees have unique keys, valid triggers and symptom-specific prompts', () => {
    const keys = CALL_SHEET_TREES.map((t) => t.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const tree of CALL_SHEET_TREES) {
      for (const trigger of tree.triggers) {
        const q = V2_QUESTIONS.find((entry) => entry.id === trigger.questionId)
        expect(q, `${tree.key} trigger question`).toBeDefined()
        expect(q!.options, `${tree.key} trigger option`).toContain(trigger.option)
      }
      expect(tree.prompts.length).toBeGreaterThanOrEqual(4)
    }
    // Not one generic list: specific prompt ids must differ between trees
    const specific = (key: string) => CALL_SHEET_TREES.find((t) => t.key === key)!.prompts.map((p) => p.id).join(',')
    expect(specific('bloating')).not.toBe(specific('headache'))
  })

  it('trees surface only from actual client selections', () => {
    expect(callSheetTreesForAnswers({})).toHaveLength(0)
    const surfaced = callSheetTreesForAnswers({ 'v2.digestion.noticed': ['Bloating', 'Wind'] }).map((t) => t.key)
    expect(surfaced).toEqual(['bloating'])
  })

  it('no tree prompt concludes, scores or plans', () => {
    const banned = ['diagnos', 'this means', 'likely condition', 'we recommend', 'start the', 'protocol', 'dose', 'score']
    for (const tree of CALL_SHEET_TREES) {
      for (const prompt of tree.prompts) {
        const text = prompt.prompt.toLowerCase()
        for (const term of banned) expect(text.includes(term), `${prompt.id} contains '${term}'`).toBe(false)
      }
    }
  })
})
