// ─── RootFinder display-layer theme labels (SaMD softening) ───────────────────
// Counsel ruling: self-serve RootFinder stays outside SaMD only as BROAD
// educational symptom grouping — no dysfunction/pathophysiology labels, no
// root-cause conclusions, no confidence, no ranking, no protocols.
//
// The root_causes table stores clinical-sounding names ("HPA Axis
// Dysregulation" etc.). Those rows are UNCHANGED (no data/schema change, and
// practitioner-facing use may need them later) — this map converts each key
// to a broad educational theme AT DISPLAY TIME for the self-serve surface.
// Unknown keys fall back to a generic label so a future knowledge-base row
// can never leak an uncleared clinical label to members (default deny).

export const THEME_LABELS: Record<string, string> = {
  blood_sugar_dysregulation:     'Blood sugar & energy balance',
  chronic_inflammation:          'Inflammation & recovery',
  gut_permeability:              'Gut & digestion',
  hpa_dysregulation:             'Stress response & resilience',
  mitochondrial_dysfunction:     'Energy & vitality',
  nervous_system_dysregulation:  'Nervous system & calm',
  nutrient_deficiency:           'Nutrition & nourishment',
  sex_hormone_imbalance:         'Hormonal balance',
  thyroid_dysregulation:         'Thyroid & metabolism',
  toxic_burden:                  'Environmental load',
}

export function themeLabel(key: string | null | undefined): string {
  if (!key) return 'General wellbeing theme'
  return THEME_LABELS[key] ?? 'General wellbeing theme'
}
