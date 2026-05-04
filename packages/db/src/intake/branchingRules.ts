// ─── packages/db/src/intake/branchingRules.ts ─────────────────────────────────
// Seed branching rules for the UI engine.
// These control which form sections and sub-branches activate based on answers.
// DO NOT mix with clinicalScoringRules.ts — different concern, different pipeline.
//
// Priority spread: 40/30/20/10 (10-point steps, room for future insertions).
// Exclusive rules compete within a group; highest priority wins.
// Non-exclusive rules (flags, concurrent sections) always fire additively.

import type { Rule } from './types'

export const BRANCHING_RULES: Rule[] = [

  // ── Sub-branch competition for section2 ────────────────────────────────────
  // Exclusive = true: only ONE sub-branch activates per section2 group.
  // Digestive wins over all others (priority 40).

  {
    id:       'sb_digestive',
    when:     {
      questionId: 'primary_concerns',
      op:         'contains',
      value:      [
        'bloat', 'digest', 'gut', 'bowel', 'constipat', 'diarrh',
        'reflux', 'heartburn', 'colon', 'stomach', 'tum', 'nausea', 'abdomen',
      ],
    },
    activates: { type: 'subBranch', target: 'section2/digestive', reason: 'Digestive concern detected' },
    priority:  40,
    exclusive: true,
  },

  // Priority 30: between digestive (40) and energy (20), preserving
  // detectPrimarySystem priority order: digestive > hormonal > energy > cognitive.
  {
    id:       'sb_hormonal',
    when:     {
      questionId: 'primary_concerns',
      op:         'contains',
      value:      [
        'hormonal', 'pcos', 'oestrogen', 'estrogen', 'progesterone',
        'menstrual', 'menopause', 'perimenopause', 'endometriosis',
        'thyroid', 'period', 'cycle issue',
      ],
    },
    activates: { type: 'subBranch', target: 'section2/hormonal', reason: 'Hormonal concern detected' },
    priority:  30,
    exclusive: true,
  },

  {
    id:       'sb_energy',
    when:     {
      questionId: 'primary_concerns',
      op:         'contains',
      value:      ['tired', 'fatigue', 'exhaust', 'energy', 'wired but tired', 'crashing'],
    },
    activates: { type: 'subBranch', target: 'section2/energy', reason: 'Energy / fatigue concern detected' },
    priority:  20,
    exclusive: true,
  },

  {
    id:       'sb_cognitive',
    when:     {
      questionId: 'primary_concerns',
      op:         'contains',
      value:      ['brain fog', 'focus', 'memory', 'concentrat', 'foggy', 'sluggish thinking'],
    },
    activates: { type: 'subBranch', target: 'section2/cognitive', reason: 'Cognitive concern detected' },
    priority:  10,
    exclusive: true,
  },

  // ── Additive section activation ────────────────────────────────────────────
  // Exclusive = false: sections fire independently, multiple can activate.

  {
    id:       'sb_urinary',
    when:     {
      questionId: 'primary_concerns',
      op:         'contains',
      value:      ['urin', 'bladder', 'kidney'],
    },
    // type: subBranch so it lands in activeSubBranches['systems'] = ['urinary']
    // NOT type: section — was incorrectly 'systems_urinary' flat string before
    activates: { type: 'subBranch', target: 'systems/urinary', reason: 'Urinary concern detected' },
    priority:  10,
    exclusive: false,
  },

  // ── Severity flag ──────────────────────────────────────────────────────────
  // Fires additively regardless of sub-branch competition.

  {
    id:       'flag_severity',
    when:     {
      questionId: 'severity_now',
      op:         'gte',
      value:      8,
    },
    activates: { type: 'flag', target: 'red_flag_severity', reason: 'Severity ≥ 8 — may need urgent review' },
    priority:  40,
    exclusive: false,
  },

  // ── Sprint 16.3 Tier 1 flag rules ─────────────────────────────────────────
  // R8: all Tier 1 rules activate type='flag' only. No section/sub-branch changes.
  // R9: evaluateRules, normalizeAnswers, types.ts untouched.
  // Naming convention: flag_<domain>_<descriptor> (R1).

  {
    id:       'flag_severity_high',
    when:     {
      questionId: 'concern_severity_baseline',
      op:         'gte',
      value:      8,
    },
    activates: {
      type:   'flag',
      target: 'flag_severity_high',
      reason: 'High impact on daily life reported — worth discussing with a practitioner',
    },
    priority:  40,
    exclusive: false,
  },

  {
    id:       'flag_post_exertional_pattern',
    when:     {
      questionId: 'post_exertional_worsening',
      op:         'eq',
      value:      true,
    },
    activates: {
      type:   'flag',
      target: 'flag_post_exertional_pattern',
      reason: 'Post-exertional worsening pattern reported — worth discussing with a practitioner',
    },
    priority:  40,
    exclusive: false,
  },

]
