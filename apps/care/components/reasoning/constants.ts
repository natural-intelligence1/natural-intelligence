// ─── apps/care/components/reasoning/constants.ts ─────────────────────────────
// Visual constants for the Clinical Reasoning Trace UI.
// Shared between the /cases/[caseId]/reasoning page and the B.2 workspace.

export const ENTRY_TYPE_LABELS: Record<string, string> = {
  observation:          'Observation',
  hypothesis:           'Hypothesis',
  evidence_for:         'Evidence for',
  evidence_against:     'Evidence against',
  weighting:            'Weighting',
  decision:             'Decision',
  uncertainty:          'Uncertainty',
  recommendation:       'Recommendation',
  escalation_flag:      'Escalation flag',
  practitioner_comment: 'Practitioner comment',
  client_explanation:   'Client explanation',
}

export const ENTRY_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  observation:          { bg: '#EEF6FF', text: '#2563EB', border: '#BFDBFE' },
  hypothesis:           { bg: '#F5F3FF', text: '#7C3AED', border: '#DDD6FE' },
  evidence_for:         { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
  evidence_against:     { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
  weighting:            { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' },
  decision:             { bg: '#F8FAFC', text: '#1A1917', border: '#E2E8F0' },
  uncertainty:          { bg: '#FFF7ED', text: '#C2410C', border: '#FDBA74' },
  recommendation:       { bg: '#F0FDF4', text: '#166534', border: '#A7F3D0' },
  escalation_flag:      { bg: '#FEF2F2', text: '#991B1B', border: '#FCA5A5' },
  practitioner_comment: { bg: '#F8F6F2', text: '#1A1917', border: '#D4B07A' },
  client_explanation:   { bg: '#F9FAFB', text: '#374151', border: '#D1D5DB' },
}

export const AGENT_LABELS: Record<string, string> = {
  case_historian:      'Case Historian',
  medical_records:     'Medical Records',
  food_environment:    'Food Environment',
  root_cause:          'Root Cause',
  protocol_builder:    'Protocol Builder',
  safety_scope:        'Safety & Scope',
  practitioner_review: 'Practitioner Review',
}
