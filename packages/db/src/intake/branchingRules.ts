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
      value:      ['bloat', 'digest', 'gut', 'bowel', 'constipat', 'diarrh', 'reflux', 'heartburn', 'colon'],
    },
    activates: { type: 'subBranch', target: 'section2/digestive', reason: 'Digestive concern detected' },
    priority:  40,
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
    id:       'sec_urinary',
    when:     {
      questionId: 'primary_concerns',
      op:         'contains',
      value:      ['urin', 'bladder', 'kidney'],
    },
    activates: { type: 'section', target: 'systems_urinary', reason: 'Urinary concern detected' },
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

]
